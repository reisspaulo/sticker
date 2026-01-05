import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { validateApiKey } from '../middleware/auth';
import { validateMessage, getMessageType } from '../utils/messageValidator';
import { processStickerQueue, downloadTwitterVideoQueue, activatePixSubscriptionQueue } from '../config/queue';
import { extractInteractiveResponse } from '../utils/interactiveMessageDetector';
import { WebhookPayload, ProcessStickerJobData, TwitterVideoJobData } from '../types/evolution';
import { getUserOrCreate, getDailyCount } from '../services/userService';
import { getTwitterDownloadCount } from '../services/twitterLimits';
import { getUserLimits } from '../services/subscriptionService';
import { sendWelcomeMessage } from '../services/messageService';
import { sendText, sendVideo } from '../services/evolutionApi';
import { logWebhookReceived, logMessageReceived, logError } from '../services/usageLogs';
import { extractTweetInfo } from '../utils/urlDetector';
import {
  getVideoSelectionContext,
  clearVideoSelectionContext,
  processVideoSelectionResponse,
} from '../utils/videoSelectionContext';
import {
  getConversationContext,
  saveConversationContext,
  clearConversationContext,
} from '../utils/conversationContext';
import {
  getLimitReachedMenu,
  getPaymentLinkMessage,
  getSubscriptionActiveMessage,
  getHelpMessage,
  logMenuInteraction,
  sendPlansListMenu,
  sendPaymentMethodList,
  sendPixPaymentWithButton,
} from '../services/menuService';
import { getUserPlan, hasActiveSubscription } from '../services/subscriptionService';
import { uploadTwitterVideo } from '../services/twitterStorage';
import { incrementTwitterDownloadCount } from '../services/twitterLimits';
import { supabase } from '../config/supabase';
import axios from 'axios';
import {
  createPendingPixPayment,
  confirmPixPayment,
  getPendingPixPayment,
} from '../services/pixPaymentService';
import type { PlanType } from '../types/subscription';

export default async function webhookRoutes(fastify: FastifyInstance) {
  // GET route for testing (no auth required)
  fastify.get('/', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(200).send({
      status: 'online',
      message: 'Webhook endpoint is active',
      timestamp: new Date().toISOString(),
      note: 'This endpoint accepts POST requests from Evolution API',
    });
  });

  // Add API key validation hook for POST requests only
  fastify.addHook('preHandler', async (request, reply) => {
    if (request.method === 'POST') {
      await validateApiKey(request, reply);
    }
  });

  fastify.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const startTime = Date.now();

    try {
      const body = request.body as WebhookPayload;

      // DEBUG: Log full message payload
      fastify.log.info({
        msg: 'DEBUG: Full webhook payload',
        event: body.event,
        fromMe: body.data?.key?.fromMe,
        messageData: body.data?.message,
        fullPayload: JSON.stringify(body).substring(0, 500),
      });

      // Log incoming webhook
      fastify.log.info({
        msg: 'Webhook received',
        event: body.event,
        instance: body.instance,
        messageType: body.data?.messageType,
      });

      // Log to database
      await logWebhookReceived({
        instance: body.instance,
        event: body.event,
        messageType: body.data?.messageType,
      });

      // Ignore messages from ourselves
      if (body.data?.key?.fromMe) {
        fastify.log.info('❌ Ignoring message from self');
        return reply.status(200).send({
          status: 'ignored',
          reason: 'message from self',
        });
      }
      fastify.log.info('✅ Not from self');

      // Only process messages.upsert events (case-insensitive, supports both . and _)
      const eventType = body.event?.toLowerCase().replace(/_/g, '.');
      fastify.log.info({ event: body.event, normalized: eventType }, 'Event type check');
      if (eventType !== 'messages.upsert') {
        fastify.log.info({ event: body.event, normalized: eventType }, '❌ Ignoring non-message event');
        return reply.status(200).send({
          status: 'ignored',
          reason: 'not a message event',
        });
      }
      fastify.log.info('✅ Event type is messages.upsert');

      // Extract user info
      const userNumber = body.data.key.remoteJid.replace('@s.whatsapp.net', '');
      const userName = body.data.pushName || 'Usuário';
      const message = body.data.message;

      fastify.log.info({ userNumber, userName, hasMessage: !!message }, '📱 User info extracted');

      // Check if message exists
      if (!message) {
        fastify.log.info({ userNumber }, '❌ No message content in webhook');
        return reply.status(200).send({
          status: 'ignored',
          reason: 'no message content',
        });
      }
      fastify.log.info('✅ Message exists');

      // Detect message type
      const detectedType = getMessageType(message);

      // DEBUG: Log message content for Twitter URL detection
      const textContent = message.conversation || message.extendedTextMessage?.text;

      fastify.log.info({
        msg: 'Processing message',
        userNumber,
        userName,
        detectedType,
        textContent: textContent ? textContent.substring(0, 200) : null,
        hasConversation: !!message.conversation,
        hasExtendedText: !!message.extendedTextMessage?.text,
      });

      // Check for text commands and conversation context
      const textMessage = message.conversation || message.extendedTextMessage?.text || '';
      const normalizedText = textMessage.toLowerCase().trim();

      // Get or create user first for menu interactions
      const user = await getUserOrCreate(userNumber, userName);

      // Handle interactive message responses (buttons and lists from Avisa API)
      if (detectedType === 'button_response' || detectedType === 'list_response') {
        const interactive = extractInteractiveResponse(message);

        // Skip if no valid interactive response
        if (interactive.type === 'none') {
          fastify.log.warn({ userNumber }, 'Interactive message detected but no response extracted');
          return reply.status(200).send({ status: 'no_interactive_response' });
        }

        fastify.log.info({
          msg: 'Interactive response detected',
          userNumber,
          type: interactive.type,
          id: interactive.id,
        });

        // Handle PIX payment confirmation button
        if (interactive.id === 'button_confirm_pix') {
          try {
            const success = await confirmPixPayment(userNumber);

            if (!success) {
              await sendText(
                userNumber,
                `❌ *Pagamento não encontrado*\n\nNão encontramos um pagamento pendente para você.\n\nDigite *planos* para ver as opções disponíveis.`
              );
              return reply.status(200).send({ status: 'pix_not_found' });
            }

            // Get pending payment details
            const pending = await getPendingPixPayment(userNumber);

            if (pending) {
              // Queue delayed job to activate after 5 minutes
              await activatePixSubscriptionQueue.add(
                'activate-pix-subscription',
                {
                  userNumber: pending.userNumber,
                  userName: pending.userName,
                  userId: pending.userId,
                  plan: pending.plan,
                },
                {
                  delay: 5 * 60 * 1000, // 5 minutes
                  jobId: `pix-activation-${userNumber}-${Date.now()}`,
                }
              );

              await sendText(
                userNumber,
                `✅ *Confirmação Recebida!*\n\n🔄 Estamos processando seu pagamento PIX.\n\n⏱️ Seu plano *${pending.plan === 'premium' ? 'Premium' : 'Ultra'}* será ativado em até 5 minutos após a confirmação do pagamento pelo banco.\n\n📱 Você receberá uma mensagem de confirmação assim que seu plano estiver ativo.\n\nAgradecemos pela confiança! 🙏`
              );

              fastify.log.info({
                msg: 'PIX payment confirmed, activation job queued',
                userNumber,
                plan: pending.plan,
              });
            }

            return reply.status(200).send({ status: 'pix_confirmed' });
          } catch (error) {
            fastify.log.error({
              msg: 'Error confirming PIX payment',
              userNumber,
              error: error instanceof Error ? error.message : 'Unknown error',
            });

            await sendText(
              userNumber,
              `😔 *Erro ao processar confirmação*\n\nOcorreu um erro ao processar sua confirmação.\n\nPor favor, tente novamente ou digite *ajuda* para mais informações.`
            );

            return reply.status(500).send({ status: 'error' });
          }
        }

        // Handle Twitter feature presentation buttons
        if (interactive.id === 'button_twitter_learn') {
          const { handleTwitterLearnMore } = await import('../services/onboardingService');
          await handleTwitterLearnMore(userNumber, userName);

          fastify.log.info({
            msg: 'Twitter learn more button clicked',
            userNumber,
          });

          return reply.status(200).send({ status: 'twitter_learn_more' });
        }

        if (interactive.id === 'button_twitter_dismiss') {
          const { handleTwitterDismiss } = await import('../services/onboardingService');
          await handleTwitterDismiss(userNumber, userName);

          fastify.log.info({
            msg: 'Twitter dismiss button clicked',
            userNumber,
          });

          return reply.status(200).send({ status: 'twitter_dismissed' });
        }

        // Handle plan selection from list
        if (interactive.id === 'plan_premium' || interactive.id === 'plan_ultra' || interactive.id === 'plan_free') {
          const selectedPlan = interactive.id.replace('plan_', '') as PlanType;

          logMenuInteraction(userNumber, 'plan_selected', selectedPlan);

          // If free plan selected, just acknowledge
          if (selectedPlan === 'free') {
            await sendText(
              userNumber,
              `✅ *Plano Gratuito*\n\nVocê já está usando o plano gratuito!\n\n🎁 *Benefícios:*\n• 4 figurinhas por dia\n• 4 vídeos do Twitter por dia\n\nQuer mais? Digite *planos* para fazer upgrade!`
            );
            return reply.status(200).send({ status: 'free_plan_selected' });
          }

          // For paid plans, send payment method selection list via Avisa API
          await sendPaymentMethodList(userNumber, selectedPlan);

          // Save context for payment method selection
          await saveConversationContext(userNumber, 'awaiting_payment_method', {
            selected_plan: selectedPlan,
          });

          return reply.status(200).send({ status: 'payment_method_requested', plan: selectedPlan });
        }

        // Handle payment method selection from list
        if (interactive.id === 'payment_card' || interactive.id === 'payment_boleto' || interactive.id === 'payment_pix') {
          const paymentMethod = interactive.id.replace('payment_', '');

          // Get selected plan from conversation context
          const context = await getConversationContext(userNumber);
          const planFromContext = context?.metadata?.selected_plan as PlanType | undefined;

          if (!planFromContext || planFromContext === 'free') {
            await sendText(
              userNumber,
              `❌ *Erro*\n\nNão encontramos o plano selecionado.\n\nDigite *planos* para começar novamente.`
            );
            return reply.status(200).send({ status: 'plan_not_found' });
          }

          // At this point, selectedPlan can only be 'premium' or 'ultra'
          const selectedPlan = planFromContext as 'premium' | 'ultra';

          logMenuInteraction(userNumber, 'payment_method_selected', paymentMethod);

          // Handle PIX payment
          if (paymentMethod === 'pix') {
            try {
              // Create pending PIX payment
              const payment = await createPendingPixPayment(
                userNumber,
                userName,
                user.id,
                selectedPlan
              );

              // Send PIX payment instructions with interactive button via Avisa API
              await sendPixPaymentWithButton(userNumber, payment.pixKey, selectedPlan);

              // Clear conversation context
              await clearConversationContext(userNumber);

              fastify.log.info({
                msg: 'PIX payment created',
                userNumber,
                plan: selectedPlan,
                pixKey: payment.pixKey,
              });

              return reply.status(200).send({ status: 'pix_payment_created' });
            } catch (error) {
              fastify.log.error({
                msg: 'Error creating PIX payment',
                userNumber,
                error: error instanceof Error ? error.message : 'Unknown error',
              });

              await sendText(
                userNumber,
                `😔 *Erro ao gerar PIX*\n\nOcorreu um erro ao gerar o pagamento PIX.\n\nPor favor, tente novamente ou digite *ajuda*.`
              );

              return reply.status(500).send({ status: 'error' });
            }
          }

          // Handle Card/Boleto payment (Stripe)
          if (paymentMethod === 'card' || paymentMethod === 'boleto') {
            await sendText(userNumber, getPaymentLinkMessage(selectedPlan, userNumber));
            await clearConversationContext(userNumber);

            return reply.status(200).send({
              status: 'payment_link_sent',
              plan: selectedPlan,
              method: paymentMethod,
            });
          }

          return reply.status(200).send({ status: 'payment_method_handled' });
        }

        // Unknown interactive response
        fastify.log.warn({
          msg: 'Unknown interactive response',
          userNumber,
          id: interactive.id,
        });

        return reply.status(200).send({ status: 'unknown_interactive' });
      }

      // Handle global text commands
      if (normalizedText === 'planos' || normalizedText === 'plans') {
        logMenuInteraction(userNumber, 'plans_overview');
        // Send interactive list via Avisa API
        await sendPlansListMenu(userNumber);
        return reply.status(200).send({ status: 'menu_sent', menuType: 'plans_overview' });
      }

      if (normalizedText === 'status' || normalizedText === 'assinatura') {
        logMenuInteraction(userNumber, 'subscription_status');

        const hasActive = await hasActiveSubscription(user.id);
        if (!hasActive) {
          await sendText(
            userNumber,
            `📊 *Seu Status*\n\nPlano: Gratuito 🆓\n\nVocê tem 4 figurinhas e 4 vídeos do Twitter por dia.\n\nQuer mais? Digite *planos* para fazer upgrade!`
          );
        } else {
          const currentPlan = await getUserPlan(user.id);
          const { data: userData } = await supabase
            .from('users')
            .select('subscription_ends_at')
            .eq('id', user.id)
            .single();

          if (userData?.subscription_ends_at) {
            await sendText(
              userNumber,
              getSubscriptionActiveMessage(currentPlan, new Date(userData.subscription_ends_at))
            );
          }
        }
        return reply.status(200).send({ status: 'status_sent' });
      }

      if (normalizedText === 'ajuda' || normalizedText === 'help' || normalizedText === 'começar') {
        logMenuInteraction(userNumber, 'help');
        await sendText(userNumber, getHelpMessage());
        return reply.status(200).send({ status: 'help_sent' });
      }

      // Check for pending video selection BEFORE ignoring "other" messages
      if (detectedType === 'other') {
        const videoContext = await getVideoSelectionContext(userNumber);

        if (videoContext) {
          // User has pending video selection - process their response
          const textMessage = message.conversation || message.extendedTextMessage?.text || '';

          fastify.log.info({
            msg: 'Processing video selection response',
            userNumber,
            textMessage,
            videoCount: videoContext.metadata.allVideos?.length,
          });

          const selectionResult = processVideoSelectionResponse(
            textMessage,
            videoContext.metadata.allVideos?.length || 0
          );

          if (selectionResult === 'cancel') {
            // User cancelled
            await clearVideoSelectionContext(userNumber);
            await sendText(userNumber, 'Download cancelado. Envie outro link quando quiser.');
            fastify.log.info({ userNumber }, 'Video selection cancelled by user');

            return reply.status(200).send({
              status: 'selection_cancelled',
            });
          } else if (selectionResult === 'invalid') {
            // Invalid response
            await sendText(
              userNumber,
              `Resposta inválida. Por favor, responda com um número de 1 a ${videoContext.metadata.allVideos?.length} ou "cancelar".`
            );

            return reply.status(200).send({
              status: 'invalid_selection',
            });
          } else {
            // Valid selection number
            const videoIndex = selectionResult - 1; // Convert to 0-based index
            const selectedVideo = videoContext.metadata.allVideos?.[videoIndex];

            if (!selectedVideo) {
              await sendText(userNumber, 'Erro ao encontrar o vídeo selecionado.');
              await clearVideoSelectionContext(userNumber);

              return reply.status(200).send({
                status: 'error',
                error: 'Video not found',
              });
            }

            fastify.log.info({
              msg: 'User selected video',
              userNumber,
              selection: selectionResult,
              videoUrl: selectedVideo.url,
            });

            // Download the selected video
            try {
              await sendText(userNumber, `Baixando vídeo ${selectionResult}...`);

              const videoResponse = await axios.get(selectedVideo.url, {
                responseType: 'arraybuffer',
                timeout: 60000,
                maxContentLength: 16 * 1024 * 1024,
                maxBodyLength: 16 * 1024 * 1024,
              });

              const buffer = Buffer.from(videoResponse.data);

              // Upload to Supabase
              const { path, url } = await uploadTwitterVideo(
                buffer,
                userNumber,
                videoContext.tweetId
              );

              // Send video to user
              const caption = `🐦 Vídeo ${selectionResult} do Twitter baixado!\n\n📊 Informações:\n• Autor: @${videoContext.metadata.username}\n• Duração: ${selectedVideo.durationSec?.toFixed(1)}s\n• Resolução: ${selectedVideo.resolution}\n• Tamanho: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`;

              await sendVideo(userNumber, url, caption);

              // Get or create user for userId
              const user = await getUserOrCreate(userNumber, userName);

              // Save metadata to database
              await supabase.from('twitter_downloads').insert({
                user_number: userNumber,
                tweet_id: videoContext.tweetId,
                tweet_url: `https://x.com/${videoContext.username}/status/${videoContext.tweetId}`,
                video_url: selectedVideo.url,
                author_username: videoContext.metadata.username,
                author_name: videoContext.metadata.author,
                tweet_text: videoContext.metadata.text,
                video_duration_ms: selectedVideo.duration,
                video_size_bytes: buffer.length,
                video_resolution: selectedVideo.resolution,
                likes: videoContext.metadata.likes,
                retweets: videoContext.metadata.retweets,
                storage_path: path,
                processed_url: url,
                downloaded_at: new Date().toISOString(),
                sent_at: new Date().toISOString(),
                converted_to_sticker: false,
              });

              // Increment download count
              await incrementTwitterDownloadCount(user.id);

              // Clear context
              await clearVideoSelectionContext(userNumber);

              fastify.log.info({
                msg: 'Selected video downloaded and sent successfully',
                userNumber,
                selection: selectionResult,
              });

              return reply.status(200).send({
                status: 'video_sent',
                selection: selectionResult,
              });
            } catch (error) {
              fastify.log.error({
                msg: 'Error downloading selected video',
                userNumber,
                selection: selectionResult,
                error: error instanceof Error ? error.message : 'Unknown error',
              });

              await sendText(
                userNumber,
                `❌ Erro ao baixar o vídeo selecionado.\n\n${error instanceof Error ? error.message : 'Erro desconhecido'}\n\nTente novamente.`
              );

              return reply.status(500).send({
                status: 'error',
                error: error instanceof Error ? error.message : 'Unknown error',
              });
            }
          }
        }

        // No pending video selection - ignore non-media message
        fastify.log.debug({ userNumber }, 'Ignoring non-media message');
        return reply.status(200).send({
          status: 'ignored',
          reason: 'not an image or gif',
        });
      }

      // Validate the message
      const validation = validateMessage(message);

      // Log message received
      await logMessageReceived({
        userNumber,
        userName,
        messageType: detectedType,
        messageId: body.data.key.id,
      });

      if (!validation.valid) {
        // Log validation error
        fastify.log.warn({
          msg: 'Message validation failed',
          userNumber,
          error: validation.error,
          errorCode: validation.errorCode,
        });

        // Log error to database
        await logError({
          userNumber,
          errorMessage: validation.error || 'Validation failed',
          context: {
            errorCode: validation.errorCode,
            messageType: detectedType,
          },
        });

        // Send error message to user
        try {
          await sendText(userNumber, validation.error || 'Formato não suportado.');
        } catch (err) {
          fastify.log.error({ error: err, userNumber }, 'Failed to send error message to user');
        }

        return reply.status(400).send({
          status: 'validation_failed',
          error: validation.error,
          errorCode: validation.errorCode,
        });
      }

      // User was already created at the top of the handler

      // Check if this is a new user (created just now)
      const isNewUser = new Date(user.created_at).getTime() > Date.now() - 5000; // Created within last 5 seconds

      if (isNewUser) {
        // Send welcome message to new users
        await sendWelcomeMessage(userNumber, userName);
        fastify.log.info({ userNumber, userName }, 'Welcome message sent to new user');
      }

      // Handle Twitter video messages differently
      if (validation.messageType === 'twitter_video' && validation.tweetUrl) {
        const tweetInfo = extractTweetInfo(validation.tweetUrl);

        if (!tweetInfo) {
          return reply.status(400).send({
            status: 'error',
            error: 'Invalid Twitter URL',
          });
        }

        // Check Twitter-specific daily limit based on subscription
        const userLimits = await getUserLimits(user.id);
        const currentTwitterCount = await getTwitterDownloadCount(user.id);
        const hasReachedTwitterLimit = currentTwitterCount >= userLimits.daily_twitter_limit;

        fastify.log.info({
          msg: 'Twitter limits check',
          userId: user.id,
          currentTwitterCount,
          dailyTwitterLimit: userLimits.daily_twitter_limit,
          hasReachedTwitterLimit,
        });

        if (hasReachedTwitterLimit) {
          // User has reached Twitter download limit - send upgrade menu
          const currentPlan = await getUserPlan(user.id);
          await sendText(
            userNumber,
            getLimitReachedMenu({
              currentPlan,
              dailyCount: currentTwitterCount,
              dailyLimit: userLimits.daily_twitter_limit,
              isTwitter: true,
            })
          );

          fastify.log.info({
            msg: 'Twitter download limit reached',
            userNumber,
            userName,
          });

          return reply.status(200).send({
            status: 'limit_reached',
            messageType: 'twitter_video',
            message: 'Twitter daily limit reached',
          });
        }

        // Create Twitter video job data
        const twitterJobData: TwitterVideoJobData = {
          userNumber,
          userName,
          tweetUrl: validation.tweetUrl,
          tweetId: tweetInfo.tweetId,
          username: tweetInfo.username,
          userId: user.id,
          messageId: body.data.key.id,
        };

        // Add job to Twitter video queue
        const job = await downloadTwitterVideoQueue.add('download-twitter-video', twitterJobData, {
          jobId: `twitter-${userNumber}-${Date.now()}`,
        });

        const processingTime = Date.now() - startTime;

        fastify.log.info({
          msg: 'Twitter video job added to queue',
          jobId: job.id,
          userNumber,
          tweetId: tweetInfo.tweetId,
          processingTime,
        });

        return reply.status(200).send({
          status: 'queued',
          jobId: job.id,
          messageType: 'twitter_video',
          processingTime,
        });
      }

      // Get user limits based on subscription
      const userLimits = await getUserLimits(user.id);
      const currentDailyCount = await getDailyCount(user.id);
      const hasReachedLimit = currentDailyCount >= userLimits.daily_sticker_limit;

      fastify.log.info({
        msg: 'User limits check',
        userId: user.id,
        currentDailyCount,
        dailyStickerLimit: userLimits.daily_sticker_limit,
        hasReachedLimit,
      });

      // Message is valid - create job data for images/GIFs
      const jobData: ProcessStickerJobData = {
        userNumber,
        userName,
        messageType: validation.messageType as 'image' | 'gif',
        fileUrl: validation.fileUrl,
        messageKey: body.data.key, // For downloading media via Evolution API
        mimetype: validation.mimetype,
        fileLength: validation.fileLength,
        duration: validation.duration,
        userId: user.id,
        status: hasReachedLimit ? 'pendente' : 'enviado',
      };

      // Add job to queue
      const job = await processStickerQueue.add('process-sticker', jobData, {
        jobId: `${userNumber}-${Date.now()}`,
      });

      const processingTime = Date.now() - startTime;

      fastify.log.info({
        msg: 'Job added to queue',
        jobId: job.id,
        userNumber,
        messageType: validation.messageType,
        processingTime,
      });

      return reply.status(200).send({
        status: 'queued',
        jobId: job.id,
        messageType: validation.messageType,
        processingTime,
      });
    } catch (error) {
      const processingTime = Date.now() - startTime;

      fastify.log.error({
        msg: 'Webhook error',
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        processingTime,
      });

      // Try to log error to database
      try {
        const body = request.body as WebhookPayload;
        const userNumber = body.data?.key?.remoteJid?.replace('@s.whatsapp.net', '') || 'unknown';

        await logError({
          userNumber,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          errorStack: error instanceof Error ? error.stack : undefined,
          context: {
            event: body.event,
            instance: body.instance,
            processingTime,
          },
        });
      } catch (logErr) {
        fastify.log.error({ error: logErr }, 'Failed to log webhook error to database');
      }

      return reply.status(500).send({
        status: 'error',
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  });
}
