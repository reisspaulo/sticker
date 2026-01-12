import { supabase } from '../config/supabase';
import logger from '../config/logger';

const BUCKET_NAME = 'twitter-videos';

export interface UploadVideoResult {
  path: string;
  url: string;
  size: number;
}

/**
 * Upload video to Supabase Storage (twitter-videos bucket)
 * @param videoBuffer - Video file buffer
 * @param userNumber - User's WhatsApp number (e.g., "5511999999999")
 * @param tweetId - Tweet ID
 * @returns Object with storage path and public URL
 */
export async function uploadTwitterVideo(
  videoBuffer: Buffer,
  userNumber: string,
  tweetId: string
): Promise<UploadVideoResult> {
  try {
    // Generate unique filename: {userNumber}/{tweetId}-{timestamp}.mp4
    const timestamp = Date.now();
    const sanitizedNumber = userNumber.replace('@s.whatsapp.net', '');
    const fileName = `${sanitizedNumber}/${tweetId}-${timestamp}.mp4`;

    logger.info({
      msg: 'Uploading Twitter video to Supabase Storage',
      bucket: BUCKET_NAME,
      fileName,
      fileSize: videoBuffer.length,
    });

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage.from(BUCKET_NAME).upload(fileName, videoBuffer, {
      contentType: 'video/mp4',
      upsert: false, // Don't overwrite if exists
    });

    if (error) {
      logger.error({
        msg: 'Error uploading Twitter video to Supabase',
        error: error.message,
        fileName,
      });
      throw new Error(`Failed to upload video: ${error.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(fileName);

    const publicUrl = urlData.publicUrl;

    logger.info({
      msg: 'Twitter video uploaded successfully',
      bucket: BUCKET_NAME,
      path: data.path,
      url: publicUrl,
      size: videoBuffer.length,
    });

    return {
      path: data.path,
      url: publicUrl,
      size: videoBuffer.length,
    };
  } catch (error) {
    logger.error({
      msg: 'Error in uploadTwitterVideo',
      error: error instanceof Error ? error.message : 'Unknown error',
      userNumber,
      tweetId,
    });
    throw error;
  }
}

/**
 * Delete video from Supabase Storage
 * @param path - Storage path (e.g., "5511999999999/1234567890-1234567890.mp4")
 */
export async function deleteTwitterVideo(path: string): Promise<void> {
  try {
    logger.info({
      msg: 'Deleting Twitter video from Supabase Storage',
      bucket: BUCKET_NAME,
      path,
    });

    const { error } = await supabase.storage.from(BUCKET_NAME).remove([path]);

    if (error) {
      logger.error({
        msg: 'Error deleting Twitter video',
        error: error.message,
        path,
      });
      throw new Error(`Failed to delete video: ${error.message}`);
    }

    logger.info({
      msg: 'Twitter video deleted successfully',
      path,
    });
  } catch (error) {
    logger.error({
      msg: 'Error in deleteTwitterVideo',
      error: error instanceof Error ? error.message : 'Unknown error',
      path,
    });
    throw error;
  }
}

/**
 * Get public URL for a video
 * @param path - Storage path
 * @returns Public URL
 */
export function getTwitterVideoUrl(path: string): string {
  const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(path);
  return data.publicUrl;
}
