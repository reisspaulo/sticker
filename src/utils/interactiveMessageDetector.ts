import logger from '../config/logger';

/**
 * Interactive message response types
 */
export type InteractiveResponseType = 'button' | 'list' | 'none';

export interface ButtonResponse {
  type: 'button';
  id: string;
  displayText: string;
  originalMessageId?: string;
}

export interface ListResponse {
  type: 'list';
  id: string;
  title: string;
  description?: string;
  originalMessageId?: string;
}

export type InteractiveResponse = ButtonResponse | ListResponse | { type: 'none' };

/**
 * Detect and extract interactive message responses
 * @param message - WhatsApp message object from webhook
 * @returns Structured interactive response data
 */
export function extractInteractiveResponse(message: any): InteractiveResponse {
  // Button response
  if (message.buttonsResponseMessage) {
    const buttonData = message.buttonsResponseMessage;

    logger.debug({
      msg: 'Detected button response',
      selectedButtonId: buttonData.selectedButtonId,
      selectedDisplayText: buttonData.selectedDisplayText,
    });

    return {
      type: 'button',
      id: buttonData.selectedButtonId,
      displayText: buttonData.selectedDisplayText,
      originalMessageId: buttonData.contextInfo?.stanzaId,
    };
  }

  // List response
  if (message.listResponseMessage) {
    const listData = message.listResponseMessage;

    logger.debug({
      msg: 'Detected list response',
      selectedRowId: listData.singleSelectReply?.selectedRowId,
      title: listData.title,
    });

    return {
      type: 'list',
      id: listData.singleSelectReply?.selectedRowId || '',
      title: listData.title || '',
      description: listData.description,
      originalMessageId: listData.contextInfo?.stanzaId,
    };
  }

  return { type: 'none' };
}

/**
 * Check if message is an interactive response
 */
export function isInteractiveResponse(message: any): boolean {
  return !!(message.buttonsResponseMessage || message.listResponseMessage);
}

/**
 * Get interactive response type
 */
export function getInteractiveType(message: any): InteractiveResponseType {
  if (message.buttonsResponseMessage) return 'button';
  if (message.listResponseMessage) return 'list';
  return 'none';
}
