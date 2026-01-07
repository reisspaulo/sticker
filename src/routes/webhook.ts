import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { validateApiKey } from '../middleware/auth';
import { validateMessage, getMessageType } from '../utils/messageValidator';
import { processStickerQueue, downloadTwitterVideoQueue, activatePixSubscriptionQueue, convertTwitterStickerQueue, cleanupStickerQueue } from '../config/queue';
import { extractInteractiveResponse } from '../utils/interactiveMessageDetector';
import { WebhookPayload, ProcessStickerJobData, TwitterVideoJobData, CleanupStickerJobData } from '../types/evolution';
import { getUserOrCreate } from '../services/userService';
import { getTwitterDownloadCount } from '../services/twitterLimits';
import { getUserLimits } from '../services/subscriptionService';
import { sendWelcomeMessage } from '../services/messageService';
import { sendText, sendVideo } from '../services/evolutionApi';
import { logWebhookReceived, logMessageReceived, logTextMessageReceived, logError } from '../services/usageLogs';
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

      // Log text messages for analysis and debugging
      if (textMessage && textMessage.trim().length > 0) {
        // Determine if it's a command
        const commands = ['planos', 'plans', 'status', 'assinatura', 'ajuda', 'help', 'começar'];
        const isCommand = commands.includes(normalizedText);
        const commandType = isCommand ? normalizedText : undefined;

        // Save text message to usage_logs
        await logTextMessageReceived({
          userNumber,
          userName,
          messageId: body.data.key?.id || 'unknown',
          textContent: textMessage.substring(0, 500), // Limit to 500 chars
          isCommand,
          commandType,
        });
      }

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

        // Handle Twitter video conversion to sticker
        if (interactive.id.startsWith('button_convert_sticker_')) {
          const downloadId = interactive.id.replace('button_convert_sticker_', '');

          fastify.log.info({
            msg: 'User requested Twitter video conversion to sticker',
            userNumber,
            userName,
            downloadId,
          });

          // ATOMIC: Check and increment daily limit before converting
          const { checkAndIncrementDailyLimitAtomic, setLimitNotifiedAtomic } = await import(
            '../services/atomicLimitService'
          );

          const limitCheck = await checkAndIncrementDailyLimitAtomic(user.id);

          if (!limitCheck.allowed) {
            // User reached limit - send notification atomically
            const wasAlreadyNotified = await setLimitNotifiedAtomic(user.id);

            if (!wasAlreadyNotified) {
              const { sendText } = await import('../services/evolutionApi');
              await sendText(
                userNumber,
                `❌ *Limite Diário Atingido*\n\nVocê já usou todas as suas figurinhas de hoje!\n\n💎 Faça upgrade para continuar criando.`
              );
            }

            return reply.status(200).send({
              status: 'blocked',
              reason: 'daily_limit_reached',
              dailyCount: limitCheck.daily_count,
              dailyLimit: limitCheck.effective_limit,
            });
          }

          // Add job to dedicated conversion queue (using exported queue with Redis auth)
          await convertTwitterStickerQueue.add('convert', {
            downloadId,
            userNumber,
            userName,
          });

          return reply.status(200).send({ status: 'conversion_started', downloadId });
        }

        // Handle "video only" button (just acknowledge)
        if (interactive.id === 'button_video_only') {
          fastify.log.info({
            msg: 'User chose to keep video only',
            userNumber,
          });

          await sendText(
            userNumber,
            `✅ *Tudo certo!*\n\nSeu vídeo está salvo na conversa.\n\nSe mudar de ideia, é só me enviar o vídeo de volta! 📹`
          );

          return reply.status(200).send({ status: 'video_only' });
        }

        // Handle upgrade button clicks (A/B Test - Limit Reached Menu)
        if (interactive.id === 'button_upgrade_premium' || interactive.id === 'button_upgrade_ultra') {
          const selectedPlan = interactive.id.replace('button_upgrade_', '') as 'premium' | 'ultra';

          fastify.log.info({
            msg: 'User clicked upgrade button from limit menu',
            userNumber,
            plan: selectedPlan,
            abTestGroup: user.ab_test_group,
          });

          // Track A/B test conversion attempt
          logMenuInteraction(userNumber, 'ab_test_upgrade_click', selectedPlan);

          // Send payment method selection list
          await sendPaymentMethodList(userNumber, selectedPlan);

          // Save context for payment method selection
          await saveConversationContext(userNumber, 'awaiting_payment_method', {
            selected_plan: selectedPlan,
          });

          return reply.status(200).send({
            status: 'upgrade_payment_requested',
            plan: selectedPlan,
            abTestGroup: user.ab_test_group,
          });
        }

        // Handle bonus credit button click (A/B Test - Bonus Group)
        if (interactive.id === 'button_use_bonus') {
          fastify.log.info({
            msg: 'User clicked use bonus button',
            userNumber,
            userId: user.id,
            currentBonusUsed: user.bonus_credits_today || 0,
          });

          // Validate user is in bonus group
          if (user.ab_test_group !== 'bonus') {
            fastify.log.warn({
              msg: 'User tried to use bonus but not in bonus group',
              userNumber,
              abTestGroup: user.ab_test_group,
            });

            await sendText(
              userNumber,
              `❌ *Erro*\n\nEste recurso não está disponível para você.\n\nDigite *planos* para ver opções de upgrade.`
            );

            return reply.status(200).send({ status: 'bonus_not_available' });
          }

          // Check if user has bonus credits remaining
          const bonusUsed = user.bonus_credits_today || 0;
          if (bonusUsed >= 2) {
            await sendText(
              userNumber,
              `❌ *Limite de Bônus Atingido*\n\nVocê já usou seus *2 créditos extras* de hoje.\n\nSeu limite será renovado às *00:00* (horário de Brasília).\n\nDigite *planos* para fazer upgrade e ter mais!`
            );

            return reply.status(200).send({ status: 'bonus_limit_reached' });
          }

          // Grant bonus credit (increment bonus_credits_today)
          const { incrementBonusCredit } = await import('../services/userService');
          const newBonusCount = await incrementBonusCredit(user.id);

          const bonusRemaining = 2 - newBonusCount;

          // Track A/B test bonus usage
          logMenuInteraction(userNumber, 'ab_test_bonus_used', `${newBonusCount}/2`);

          await sendText(
            userNumber,
            `🎁 *Bônus Concedido!*\n\n✅ Você ganhou *+1 crédito extra* agora!\n\n${bonusRemaining > 0 ? `Você ainda pode usar *+${bonusRemaining} bônus* hoje.` : `Você usou todos os seus bônus extras de hoje.`}\n\nEnvie sua imagem, vídeo ou GIF! 🎨`
          );

          return reply.status(200).send({
            status: 'bonus_granted',
            bonusUsed: newBonusCount,
            bonusRemaining,
          });
        }

        // Handle dismiss upgrade button
        if (interactive.id === 'button_dismiss_upgrade') {
          fastify.log.info({
            msg: 'User dismissed upgrade offer',
            userNumber,
            abTestGroup: user.ab_test_group,
          });

          // Track A/B test dismissal
          logMenuInteraction(userNumber, 'ab_test_upgrade_dismissed', user.ab_test_group || 'unknown');

          await sendText(
            userNumber,
            `✅ *Tudo bem!*\n\nSeu limite será renovado às *00:00* (horário de Brasília).\n\nVolte amanhã para criar mais figurinhas! 🎨\n\nQuer fazer upgrade? Digite *planos*.`
          );

          return reply.status(200).send({ status: 'upgrade_dismissed' });
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

        // Handle sticker edit buttons - Remove Borders
        if (interactive.id === 'button_remove_borders') {
          fastify.log.info({
            msg: 'User requested to remove borders from sticker',
            userNumber,
            userId: user.id,
          });

          // Get conversation context
          const context = await getConversationContext(userNumber);

          if (!context || context.state !== 'awaiting_sticker_edit') {
            await sendText(
              userNumber,
              `❌ *Contexto expirado*\n\nEssa edição não está mais disponível.\n\nEnvie uma nova imagem para criar outra figurinha!`
            );
            return reply.status(200).send({ status: 'context_expired' });
          }

          // Clear context
          await clearConversationContext(userNumber);

          // Mark cleanup feature as used (first time)
          if (!(user as any).cleanup_feature_used) {
            await supabase
              .from('users')
              .update({
                cleanup_feature_used: true,
                updated_at: new Date().toISOString(),
              })
              .eq('id', user.id);
          }

          // Queue cleanup job to remove borders from the created sticker
          const cleanupJobData: CleanupStickerJobData = {
            userNumber,
            userName,
            messageKey: context.metadata.message_key,
            fileUrl: context.metadata.sticker_url!,
            mimetype: 'image/webp',
            isAnimated: context.metadata.tipo === 'animado',
            userId: user.id,
          };

          const cleanupJob = await cleanupStickerQueue.add('cleanup-sticker', cleanupJobData, {
            jobId: `borders-${userNumber}-${Date.now()}`,
          });

          fastify.log.info({
            msg: 'Remove borders job queued',
            jobId: cleanupJob.id,
            userNumber,
          });

          // Send feedback
          await sendText(
            userNumber,
            `🧹 *Removendo bordas...*\n\n✨ Estou limpando as bordas brancas da sua figurinha!\n\nAguarde alguns segundos... ⏳`
          );

          return reply.status(200).send({ status: 'borders_removal_started' });
        }

        // Handle sticker edit buttons - Remove Background
        if (interactive.id === 'button_remove_background') {
          fastify.log.info({
            msg: 'User requested to remove background from image',
            userNumber,
            userId: user.id,
          });

          // Get conversation context
          const context = await getConversationContext(userNumber);

          if (!context || context.state !== 'awaiting_sticker_edit') {
            await sendText(
              userNumber,
              `❌ *Contexto expirado*\n\nEssa edição não está mais disponível.\n\nEnvie uma nova imagem para criar outra figurinha!`
            );
            return reply.status(200).send({ status: 'context_expired' });
          }

          // Clear context
          await clearConversationContext(userNumber);

          // Mark cleanup feature as used (first time)
          if (!(user as any).cleanup_feature_used) {
            await supabase
              .from('users')
              .update({
                cleanup_feature_used: true,
                updated_at: new Date().toISOString(),
              })
              .eq('id', user.id);
          }

          // Queue job to remove background from ORIGINAL image and create new sticker
          const removeBackgroundJobData: CleanupStickerJobData = {
            userNumber,
            userName,
            messageKey: context.metadata.message_key,
            fileUrl: context.metadata.sticker_url!,
            mimetype: context.metadata.message_type === 'gif' ? 'video/mp4' : 'image/jpeg',
            isAnimated: context.metadata.tipo === 'animado',
            userId: user.id,
            messageType: context.metadata.message_type, // This triggers PATH A in worker
          };

          const bgJob = await cleanupStickerQueue.add('remove-background', removeBackgroundJobData, {
            jobId: `background-${userNumber}-${Date.now()}`,
          });

          fastify.log.info({
            msg: 'Remove background job queued',
            jobId: bgJob.id,
            userNumber,
          });

          // Send feedback
          await sendText(
            userNumber,
            `✨ *Removendo fundo...*\n\n🎨 Estou criando uma versão sem fundo da sua imagem!\n\nAguarde alguns segundos... ⏳`
          );

          return reply.status(200).send({ status: 'background_removal_started' });
        }

        // Handle sticker edit buttons - Perfect (no changes)
        if (interactive.id === 'button_sticker_perfect') {
          fastify.log.info({
            msg: 'User confirmed sticker is perfect (no edits)',
            userNumber,
            userId: user.id,
          });

          // Clear conversation context
          await clearConversationContext(userNumber);

          // Get remaining stickers count
          const userLimits = await getUserLimits(user.id);
          const { data: userData } = await supabase
            .from('users')
            .select('daily_count')
            .eq('id', user.id)
            .single();

          const remaining = Math.max(0, userLimits.daily_sticker_limit - (userData?.daily_count || 0));

          // Send confirmation
          await sendText(
            userNumber,
            `✅ *Ótimo!*\n\n🎁 Você tem *${remaining} figurinha${remaining !== 1 ? 's' : ''} restante${remaining !== 1 ? 's' : ''}* hoje.\n\nEnvie outra imagem quando quiser! 🎨`
          );

          return reply.status(200).send({ status: 'sticker_confirmed_perfect' });
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

      // Check if this is a new user who hasn't received welcome message yet
      // Use onboarding_step to prevent duplicate welcome messages when multiple images are sent
      if (user.onboarding_step === 0) {
        // Atomically update onboarding_step to prevent duplicate welcomes
        const { data: updated } = await supabase
          .from('users')
          .update({
            onboarding_step: 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id)
          .eq('onboarding_step', 0) // Only update if still 0 (prevents race condition)
          .select()
          .single();

        // Only send welcome if we successfully updated (prevents duplicates)
        if (updated) {
          await sendWelcomeMessage(userNumber, userName);
          fastify.log.info({ userNumber, userName }, 'Welcome message sent to new user');
        } else {
          fastify.log.info(
            { userNumber, userName },
            'Welcome message skipped (already sent by another request)'
          );
        }
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
          // User has reached Twitter download limit - send upgrade menu with A/B test
          const currentPlan = await getUserPlan(user.id);

          // Import the new interactive menu function
          const { sendLimitReachedMenu } = await import('../services/menuService');

          await sendLimitReachedMenu(userNumber, {
            userName,
            currentPlan,
            dailyCount: currentTwitterCount,
            dailyLimit: userLimits.daily_twitter_limit,
            isTwitter: true,
            abTestGroup: user.ab_test_group || 'control',
            bonusCreditsUsed: user.bonus_credits_today || 0,
          });

          fastify.log.info({
            msg: 'Twitter download limit reached',
            userNumber,
            userName,
            abTestGroup: user.ab_test_group,
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

      // ATOMIC: Check and increment daily limit in single transaction
      // This prevents race conditions when multiple images are sent simultaneously
      const { checkAndIncrementDailyLimitAtomic, setLimitNotifiedAtomic } = await import(
        '../services/atomicLimitService'
      );

      const limitCheck = await checkAndIncrementDailyLimitAtomic(user.id);

      fastify.log.info({
        msg: 'Atomic limit check completed',
        userId: user.id,
        allowed: limitCheck.allowed,
        dailyCount: limitCheck.daily_count,
        effectiveLimit: limitCheck.effective_limit,
        pendingCount: limitCheck.pending_count,
        abTestGroup: user.ab_test_group,
      });

      // A/B Test: Handle limit reached based on test group
      if (!limitCheck.allowed) {
        if (user.ab_test_group === 'control') {
          // CONTROL GROUP: Block completely, no pending stickers
          fastify.log.info({
            msg: 'User reached limit - CONTROL group - blocking',
            userNumber,
            abTestGroup: 'control',
          });

          // Atomically check and set notification to prevent duplicate messages
          const wasAlreadyNotified = await setLimitNotifiedAtomic(user.id);

          if (!wasAlreadyNotified) {
            const { sendLimitReachedMessage } = await import('../services/messageService');
            await sendLimitReachedMessage(userNumber, userName, 0);

            fastify.log.info({
              msg: 'Limit reached message sent - CONTROL group',
              userNumber,
            });
          } else {
            fastify.log.info({
              msg: 'User already notified today - skipping message - CONTROL group',
              userNumber,
            });
          }

          return reply.status(200).send({
            status: 'blocked',
            reason: 'daily_limit_reached_control',
            abTestGroup: 'control',
            currentDailyCount: limitCheck.daily_count,
            dailyLimit: limitCheck.effective_limit,
          });
        } else {
          // BONUS GROUP: Allow up to 2 pending stickers
          const pendingCount = limitCheck.pending_count;

          if (pendingCount >= 2) {
            // Already has 2 pending - block
            fastify.log.info({
              msg: 'User reached limit - BONUS group - max pending reached',
              userNumber,
              abTestGroup: 'bonus',
              pendingCount,
            });

            // Atomically check and set notification to prevent duplicate messages
            const wasAlreadyNotified = await setLimitNotifiedAtomic(user.id);

            if (!wasAlreadyNotified) {
              const { sendText } = await import('../services/evolutionApi');
              await sendText(
                userNumber,
                `❌ *Limite de Figurinhas Guardadas*\n\nVocê já tem *2 figurinhas* guardadas para amanhã!\n\n💎 Faça upgrade para criar mais agora.`
              );

              fastify.log.info({
                msg: 'Max pending message sent - BONUS group',
                userNumber,
              });
            } else {
              fastify.log.info({
                msg: 'User already notified today - skipping message - BONUS group',
                userNumber,
              });
            }

            return reply.status(200).send({
              status: 'blocked',
              reason: 'max_pending_reached',
              abTestGroup: 'bonus',
              pendingCount: 2,
              currentDailyCount: limitCheck.daily_count,
              dailyLimit: limitCheck.effective_limit,
            });
          }

          // Has less than 2 pending - allow and save as pending
          fastify.log.info({
            msg: 'User reached limit - BONUS group - saving as pending',
            userNumber,
            abTestGroup: 'bonus',
            pendingCount,
          });
        }
      }

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
        status: !limitCheck.allowed ? 'pendente' : 'enviado',
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
