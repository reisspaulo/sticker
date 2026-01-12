import { MessageContent, ValidationResult, ImageMessage, VideoMessage } from '../types/evolution';
import { detectTwitterUrl, extractTweetInfo } from './urlDetector';

// Constants for validation
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB in bytes
const MAX_GIF_DURATION = 10; // 10 seconds

const ALLOWED_IMAGE_MIMETYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

const ALLOWED_VIDEO_MIMETYPES = [
  'video/mp4',
  'video/webm',
  'image/gif', // Sometimes GIFs come as image/gif
];

export function validateMessage(message: MessageContent): ValidationResult {
  // Check for text message with Twitter URL
  const textContent = message.conversation || message.extendedTextMessage?.text;

  if (textContent) {
    const twitterUrl = detectTwitterUrl(textContent);
    if (twitterUrl) {
      return validateTwitterUrl(twitterUrl);
    }
  }

  // Check for image message
  if (message.imageMessage) {
    return validateImageMessage(message.imageMessage);
  }

  // Check for video message (GIF)
  if (message.videoMessage) {
    return validateVideoMessage(message.videoMessage);
  }

  // Not an image, video, or Twitter URL message
  return {
    valid: false,
    error: 'Only images and GIFs are supported',
    errorCode: 'UNSUPPORTED_MESSAGE_TYPE',
  };
}

function validateImageMessage(imageMsg: ImageMessage): ValidationResult {
  // Check if URL is present
  if (!imageMsg.url) {
    return {
      valid: false,
      error: 'Image URL not found',
      errorCode: 'MISSING_IMAGE_URL',
    };
  }

  // Validate mimetype
  const mimetype = imageMsg.mimetype || '';
  if (!ALLOWED_IMAGE_MIMETYPES.includes(mimetype.toLowerCase())) {
    return {
      valid: false,
      error: `Invalid image format. Supported formats: JPG, PNG, WebP`,
      errorCode: 'INVALID_IMAGE_FORMAT',
    };
  }

  // Validate file size
  const fileLength = imageMsg.fileLength || 0;
  if (fileLength > MAX_FILE_SIZE) {
    const sizeMB = (fileLength / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: `Image too large (${sizeMB}MB). Maximum size is 5MB`,
      errorCode: 'IMAGE_TOO_LARGE',
    };
  }

  // Validation passed
  return {
    valid: true,
    messageType: 'image',
    fileUrl: imageMsg.url,
    mimetype: imageMsg.mimetype || 'image/jpeg',
    fileLength: imageMsg.fileLength,
  };
}

function validateVideoMessage(videoMsg: VideoMessage): ValidationResult {
  // Check if URL is present
  if (!videoMsg.url) {
    return {
      valid: false,
      error: 'GIF URL not found',
      errorCode: 'MISSING_GIF_URL',
    };
  }

  // Validate mimetype
  const mimetype = videoMsg.mimetype || '';
  if (!ALLOWED_VIDEO_MIMETYPES.includes(mimetype.toLowerCase())) {
    return {
      valid: false,
      error: `Invalid GIF format. Supported formats: MP4, WebM`,
      errorCode: 'INVALID_GIF_FORMAT',
    };
  }

  // Validate file size
  const fileLength = videoMsg.fileLength || 0;
  if (fileLength > MAX_FILE_SIZE) {
    const sizeMB = (fileLength / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: `Vídeo muito grande (${sizeMB}MB). O tamanho máximo é 5MB.`,
      errorCode: 'VIDEO_TOO_LARGE',
    };
  }

  // Validate duration
  const duration = videoMsg.seconds || 0;
  if (duration > MAX_GIF_DURATION) {
    return {
      valid: false,
      error: `Vídeo muito longo (${Math.round(duration)}s). O limite é de ${MAX_GIF_DURATION} segundos para stickers animados.`,
      errorCode: 'VIDEO_TOO_LONG',
    };
  }

  // Validation passed
  return {
    valid: true,
    messageType: 'gif',
    fileUrl: videoMsg.url,
    mimetype: videoMsg.mimetype || 'video/mp4',
    fileLength: videoMsg.fileLength,
    duration: videoMsg.seconds,
  };
}

export function isImageMessage(message: MessageContent): boolean {
  return !!message.imageMessage;
}

export function isGifMessage(message: MessageContent): boolean {
  return !!message.videoMessage;
}

export type MessageType =
  | 'image'
  | 'gif'
  | 'twitter_video'
  | 'button_response'
  | 'list_response'
  | 'other';

export function getMessageType(message: any): MessageType {
  // Check for interactive responses FIRST (priority!)
  if (message.buttonsResponseMessage) {
    return 'button_response';
  }

  // Avisa API uses templateButtonReplyMessage format
  if (message.templateButtonReplyMessage) {
    return 'button_response';
  }

  if (message.listResponseMessage) {
    return 'list_response';
  }

  // Check for Twitter URL
  const textContent = message.conversation || message.extendedTextMessage?.text;
  if (textContent && detectTwitterUrl(textContent)) {
    return 'twitter_video';
  }

  if (isImageMessage(message)) return 'image';
  if (isGifMessage(message)) return 'gif';
  return 'other';
}

function validateTwitterUrl(twitterUrl: string): ValidationResult {
  const tweetInfo = extractTweetInfo(twitterUrl);

  if (!tweetInfo) {
    return {
      valid: false,
      error: 'URL do Twitter inválida',
      errorCode: 'INVALID_TWITTER_URL',
    };
  }

  // Validation passed
  return {
    valid: true,
    messageType: 'twitter_video',
    fileUrl: twitterUrl, // We'll use the URL as a placeholder
    mimetype: 'video/mp4', // Twitter videos are typically MP4
    tweetUrl: twitterUrl,
  };
}
