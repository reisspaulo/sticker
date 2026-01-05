/**
 * Twitter/VxTwitter API Types
 */

/**
 * VxTwitter API Response
 * Based on VxTwitter API documentation
 */
export interface VxTwitterResponse {
  tweetID: string;
  user_name: string;
  user_screen_name: string;
  text: string;
  date: string;
  hasMedia: boolean;
  mediaURLs: string[];
  media_extended: Array<{
    type: 'video' | 'photo' | 'gif';
    url: string;
    thumbnail_url?: string;
    duration_millis?: number;
    size: {
      width: number;
      height: number;
    };
  }>;
  likes: number;
  retweets: number;
}

/**
 * Single Video Info
 */
export interface TwitterVideoInfo {
  url: string;
  thumbnailUrl?: string;
  duration?: number; // in milliseconds
  durationSec?: number; // in seconds
  resolution: string;
  type: 'video' | 'gif';
  width: number;
  height: number;
}

/**
 * Twitter Video Metadata
 * Extracted from VxTwitter response
 */
export interface TwitterVideoMetadata {
  tweetId: string;
  author: string;
  username: string;
  text: string;
  date: string;
  likes: number;
  retweets: number;
  videoUrl: string;
  thumbnailUrl?: string;
  duration?: number; // in milliseconds
  durationSec?: number; // in seconds
  resolution: string; // e.g., "1920x1080"
  type: 'video' | 'gif';
  width: number;
  height: number;
  // Multiple media info
  hasMultipleMedia?: boolean;
  totalMediaCount?: number;
  // Multiple videos
  hasMultipleVideos?: boolean;
  allVideos?: TwitterVideoInfo[];
}

/**
 * Download Result
 */
export interface TwitterDownloadResult {
  success: boolean;
  buffer?: Buffer;
  metadata?: TwitterVideoMetadata;
  error?: string;
  errorCode?: string;
}

/**
 * Job Data for Twitter Video Downloads
 * Used in BullMQ queue
 */
export interface TwitterDownloadJobData {
  userNumber: string;
  userName: string;
  tweetUrl: string;
  tweetId: string;
  username: string;
  userId?: string;
  messageId?: string;
}
