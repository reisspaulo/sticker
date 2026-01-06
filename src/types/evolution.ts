// Evolution API Types

export interface ImageMessage {
  url?: string;
  mimetype?: string;
  caption?: string;
  fileSha256?: string;
  fileLength?: number;
  height?: number;
  width?: number;
  mediaKey?: string;
  fileEncSha256?: string;
  directPath?: string;
  mediaKeyTimestamp?: number;
  jpegThumbnail?: string;
}

export interface VideoMessage {
  url?: string;
  mimetype?: string;
  caption?: string;
  fileSha256?: string;
  fileLength?: number;
  seconds?: number;
  mediaKey?: string;
  fileEncSha256?: string;
  directPath?: string;
  mediaKeyTimestamp?: number;
  jpegThumbnail?: string;
  gifPlayback?: boolean; // This indicates it's a GIF
}

export interface MessageContent {
  imageMessage?: ImageMessage;
  videoMessage?: VideoMessage;
  conversation?: string;
  extendedTextMessage?: {
    text?: string;
  };
}

export interface MessageKey {
  remoteJid: string;
  fromMe: boolean;
  id: string;
}

export interface WebhookData {
  key: MessageKey;
  pushName?: string;
  message?: MessageContent;
  messageType?: string;
  messageTimestamp?: number;
}

export interface WebhookPayload {
  event: string;
  instance: string;
  data: WebhookData;
}

export interface ProcessStickerJobData {
  userNumber: string;
  userName: string;
  messageType: 'image' | 'gif';
  fileUrl: string; // Deprecated - use messageKey instead
  messageKey: MessageKey; // For downloading media via Evolution API
  mimetype: string;
  fileLength?: number;
  duration?: number; // For GIFs
  userId?: string; // User ID from database
  status?: 'enviado' | 'pendente'; // Status for daily limit tracking
}

export interface CleanupStickerJobData {
  userNumber: string;
  userName: string;
  messageKey: MessageKey; // For downloading media via Evolution API
  fileUrl?: string; // Optional - for backward compatibility
  mimetype: string;
  isAnimated: boolean;
  userId: string;
  messageType?: 'image' | 'gif'; // If present, remove background from original image
}

export interface ValidationError {
  valid: false;
  error: string;
  errorCode: string;
}

export interface ValidationSuccess {
  valid: true;
  messageType: 'image' | 'gif' | 'twitter_video';
  fileUrl: string;
  mimetype: string;
  fileLength?: number;
  duration?: number;
  tweetUrl?: string; // For twitter_video messages
}

export type ValidationResult = ValidationError | ValidationSuccess;

// Twitter Video Download Job Data
export interface TwitterVideoJobData {
  userNumber: string;
  userName: string;
  tweetUrl: string;
  tweetId: string;
  username: string;
  userId?: string;
  messageId?: string;
}
