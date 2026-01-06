import redis from '../config/redis';
import logger from '../config/logger';

export type ConversationState =
  | 'awaiting_payment_method'
  | 'awaiting_sticker_edit'
  | 'none';

export interface ConversationContext {
  user_number: string;
  state: ConversationState;
  metadata: {
    selected_plan?: 'premium' | 'ultra';
    payment_link?: string;
    timestamp?: string;
    sticker_url?: string;
    sticker_path?: string;
    message_key?: any; // MessageKey type from evolution.ts
    message_type?: 'image' | 'gif';
    tipo?: 'estatico' | 'animado';
  };
  created_at: string;
  expires_at: string;
}

const CONTEXT_EXPIRY_SECONDS = 600; // 10 minutes

/**
 * Save conversation context to Redis
 */
export async function saveConversationContext(
  userNumber: string,
  state: ConversationState,
  metadata: ConversationContext['metadata'] = {}
): Promise<void> {
  try {
    const now = new Date();
    const expiresAt = new Date(Date.now() + CONTEXT_EXPIRY_SECONDS * 1000);

    const context: ConversationContext = {
      user_number: userNumber,
      state,
      metadata: {
        ...metadata,
        timestamp: now.toISOString(),
      },
      created_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    };

    const key = `context:${userNumber}`;
    await redis.setex(key, CONTEXT_EXPIRY_SECONDS, JSON.stringify(context));

    logger.debug({
      msg: 'Conversation context saved to Redis',
      userNumber,
      state,
      metadata,
      ttl: CONTEXT_EXPIRY_SECONDS,
    });
  } catch (error) {
    logger.error({
      msg: 'Failed to save conversation context to Redis',
      userNumber,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    // Don't throw - context save failure shouldn't break the webhook flow
  }
}

/**
 * Get conversation context from Redis
 */
export async function getConversationContext(
  userNumber: string
): Promise<ConversationContext | null> {
  try {
    const key = `context:${userNumber}`;
    const data = await redis.get(key);

    if (!data) {
      return null;
    }

    const context: ConversationContext = JSON.parse(data);

    logger.debug({
      msg: 'Conversation context retrieved from Redis',
      userNumber,
      state: context.state,
    });

    return context;
  } catch (error) {
    logger.error({
      msg: 'Failed to get conversation context from Redis',
      userNumber,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

/**
 * Clear conversation context from Redis
 */
export async function clearConversationContext(userNumber: string): Promise<void> {
  try {
    const key = `context:${userNumber}`;
    await redis.del(key);

    logger.debug({
      msg: 'Conversation context cleared from Redis',
      userNumber,
    });
  } catch (error) {
    logger.error({
      msg: 'Failed to clear conversation context from Redis',
      userNumber,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    // Don't throw - context clearing failure shouldn't break the flow
  }
}

