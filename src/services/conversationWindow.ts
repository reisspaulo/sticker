/**
 * Conversation Window Service
 *
 * Manages the Meta Cloud API 24-hour conversation window.
 * When a user sends a message, a 24h window opens where the bot can reply freely.
 * Outside this window, only pre-approved template messages can be sent.
 *
 * This service tracks the last user-initiated message timestamp and provides
 * utility functions to check if a conversation window is active.
 */

import { supabase } from '../config/supabase';
import logger from '../config/logger';

const WINDOW_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Check if the 24h conversation window is open for a user
 *
 * @param userNumber - WhatsApp number (e.g., "5511988709202")
 * @returns true if within 24h window (free messages allowed)
 */
export async function isConversationWindowOpen(userNumber: string): Promise<boolean> {
  try {
    const sanitized = userNumber.replace('@s.whatsapp.net', '');

    const { data: user } = await supabase
      .from('users')
      .select('last_interaction')
      .eq('whatsapp_number', sanitized)
      .single();

    if (!user?.last_interaction) {
      return false;
    }

    const lastInteraction = new Date(user.last_interaction).getTime();
    const now = Date.now();
    const isOpen = now - lastInteraction < WINDOW_DURATION_MS;

    logger.debug({
      msg: '[WINDOW] Conversation window check',
      userNumber: sanitized,
      lastInteraction: user.last_interaction,
      isOpen,
      hoursAgo: Math.round(((now - lastInteraction) / (60 * 60 * 1000)) * 10) / 10,
    });

    return isOpen;
  } catch (error) {
    logger.error({
      msg: '[WINDOW] Error checking conversation window',
      userNumber,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    // Default to false (use template) to avoid sending errors
    return false;
  }
}

/**
 * Update the last interaction timestamp (call when user sends a message)
 *
 * @param userNumber - WhatsApp number
 */
export async function updateLastInteraction(userNumber: string): Promise<void> {
  try {
    const sanitized = userNumber.replace('@s.whatsapp.net', '');

    await supabase
      .from('users')
      .update({ last_interaction: new Date().toISOString() })
      .eq('whatsapp_number', sanitized);
  } catch (error) {
    logger.error({
      msg: '[WINDOW] Error updating last interaction',
      userNumber,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
