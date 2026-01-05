/**
 * Twitter Service
 * Downloads videos from Twitter/X using VxTwitter API
 */

import axios from 'axios';
import logger from '../config/logger';
import {
  VxTwitterResponse,
  TwitterVideoMetadata,
  TwitterDownloadResult,
} from '../types/twitter';

// Constants for validation
const MAX_FILE_SIZE = 16 * 1024 * 1024; // 16MB in bytes (WhatsApp limit)
const MAX_DURATION_SEC = 90; // 90 seconds (WhatsApp limit)
const VXTWITTER_API_BASE = 'https://api.vxtwitter.com';
const DOWNLOAD_TIMEOUT = 60000; // 60 seconds

/**
 * Get video metadata from a tweet
 * @param username - Twitter username
 * @param tweetId - Tweet ID
 * @returns Video metadata or null if not found
 */
export async function getVideoMetadata(
  username: string,
  tweetId: string
): Promise<TwitterVideoMetadata | null> {
  try {
    logger.info({ username, tweetId }, 'Fetching tweet metadata from VxTwitter');

    const apiUrl = `${VXTWITTER_API_BASE}/${username}/status/${tweetId}`;
    const response = await axios.get<VxTwitterResponse>(apiUrl, {
      timeout: 10000,
    });

    const data = response.data;

    // Check if tweet has media
    if (!data.hasMedia || !data.media_extended || data.media_extended.length === 0) {
      logger.warn({ tweetId }, 'Tweet does not contain media');
      return null;
    }

    // Find all videos/gifs in media
    const allVideoMedia = data.media_extended.filter(
      (m) => m.type === 'video' || m.type === 'gif'
    );

    if (allVideoMedia.length === 0) {
      logger.warn(
        { tweetId, mediaTypes: data.media_extended.map((m) => m.type) },
        'Tweet does not contain video or gif'
      );
      return null;
    }

    // Use first video as default
    const videoMedia = allVideoMedia[0];

    // Check if tweet has multiple media
    const totalMediaCount = data.media_extended.length;
    const hasMultipleMedia = totalMediaCount > 1;
    const hasMultipleVideos = allVideoMedia.length > 1;

    // Build array of all videos
    const allVideos = allVideoMedia.map((media) => ({
      url: media.url,
      thumbnailUrl: media.thumbnail_url,
      duration: media.duration_millis,
      durationSec: media.duration_millis ? media.duration_millis / 1000 : undefined,
      resolution: `${media.size.width}x${media.size.height}`,
      type: media.type as 'video' | 'gif',
      width: media.size.width,
      height: media.size.height,
    }));

    // Build metadata object
    const metadata: TwitterVideoMetadata = {
      tweetId: data.tweetID,
      author: data.user_name,
      username: data.user_screen_name,
      text: data.text,
      date: data.date,
      likes: data.likes,
      retweets: data.retweets,
      videoUrl: videoMedia.url,
      thumbnailUrl: videoMedia.thumbnail_url,
      duration: videoMedia.duration_millis,
      durationSec: videoMedia.duration_millis
        ? videoMedia.duration_millis / 1000
        : undefined,
      resolution: `${videoMedia.size.width}x${videoMedia.size.height}`,
      type: videoMedia.type as 'video' | 'gif',
      width: videoMedia.size.width,
      height: videoMedia.size.height,
      hasMultipleMedia,
      totalMediaCount,
      hasMultipleVideos,
      allVideos,
    };

    logger.info(
      {
        tweetId,
        author: metadata.username,
        duration: metadata.durationSec,
        resolution: metadata.resolution,
      },
      'Video metadata fetched successfully'
    );

    return metadata;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 404) {
        logger.warn({ username, tweetId }, 'Tweet not found (404)');
        throw new Error('Tweet não encontrado ou foi deletado');
      } else if (error.response?.status === 429) {
        logger.warn({ username, tweetId }, 'Rate limit reached (429)');
        throw new Error('Limite de requisições atingido. Tente novamente em alguns segundos');
      } else {
        logger.error(
          { error: error.message, status: error.response?.status },
          'Failed to fetch tweet metadata'
        );
        throw new Error(`Erro ao buscar tweet: ${error.message}`);
      }
    }

    logger.error({ error }, 'Unexpected error fetching tweet metadata');
    throw error;
  }
}

/**
 * Download Twitter video and return buffer
 * @param username - Twitter username
 * @param tweetId - Tweet ID
 * @returns Download result with buffer and metadata
 */
export async function downloadTwitterVideo(
  username: string,
  tweetId: string
): Promise<TwitterDownloadResult> {
  try {
    logger.info({ username, tweetId }, 'Starting Twitter video download');

    // Get video metadata
    const metadata = await getVideoMetadata(username, tweetId);

    if (!metadata) {
      return {
        success: false,
        error: 'Vídeo não encontrado no tweet',
        errorCode: 'NO_VIDEO_FOUND',
      };
    }

    // Validate duration (if available)
    if (metadata.durationSec && metadata.durationSec > MAX_DURATION_SEC) {
      logger.warn(
        { tweetId, duration: metadata.durationSec, maxDuration: MAX_DURATION_SEC },
        'Video exceeds maximum duration'
      );
      return {
        success: false,
        error: `Vídeo muito longo (${metadata.durationSec.toFixed(1)}s). O limite é ${MAX_DURATION_SEC}s`,
        errorCode: 'VIDEO_TOO_LONG',
      };
    }

    // Download video
    logger.info({ videoUrl: metadata.videoUrl }, 'Downloading video from URL');

    const videoResponse = await axios.get(metadata.videoUrl, {
      responseType: 'arraybuffer',
      timeout: DOWNLOAD_TIMEOUT,
      maxContentLength: MAX_FILE_SIZE,
      maxBodyLength: MAX_FILE_SIZE,
    });

    const buffer = Buffer.from(videoResponse.data);

    // Validate file size
    if (buffer.length > MAX_FILE_SIZE) {
      const sizeMB = (buffer.length / 1024 / 1024).toFixed(2);
      logger.warn(
        { tweetId, fileSize: buffer.length, maxSize: MAX_FILE_SIZE },
        'Video exceeds maximum file size'
      );
      return {
        success: false,
        error: `Arquivo muito grande (${sizeMB}MB). O limite é 16MB`,
        errorCode: 'FILE_TOO_LARGE',
      };
    }

    const fileSizeMB = (buffer.length / 1024 / 1024).toFixed(2);

    logger.info(
      {
        tweetId,
        fileSize: buffer.length,
        fileSizeMB,
        duration: metadata.durationSec,
      },
      'Video downloaded successfully'
    );

    return {
      success: true,
      buffer,
      metadata,
    };
  } catch (error) {
    if (error instanceof Error) {
      logger.error({ error: error.message, username, tweetId }, 'Failed to download video');
      return {
        success: false,
        error: error.message,
        errorCode: 'DOWNLOAD_FAILED',
      };
    }

    logger.error({ error, username, tweetId }, 'Unexpected error downloading video');
    return {
      success: false,
      error: 'Erro desconhecido ao baixar vídeo',
      errorCode: 'UNKNOWN_ERROR',
    };
  }
}
