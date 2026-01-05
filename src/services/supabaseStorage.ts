import { supabase } from '../config/supabase';
import logger from '../config/logger';
import { randomBytes } from 'crypto';

interface UploadResult {
  path: string;
  url: string;
}

/**
 * Upload a sticker to Supabase Storage
 * @param buffer - The sticker file buffer
 * @param userNumber - User's WhatsApp number (without @s.whatsapp.net)
 * @param tipo - Type of sticker (estatico or animado)
 * @returns Object with path and public URL
 */
export async function uploadSticker(
  buffer: Buffer,
  userNumber: string,
  tipo: 'estatico' | 'animado'
): Promise<UploadResult> {
  try {
    // Sanitize user number (remove any special characters)
    const sanitizedNumber = userNumber.replace(/[^0-9]/g, '');

    // Generate unique filename: user_{number}/{timestamp}_{randomId}.webp
    const timestamp = Date.now();
    const randomId = randomBytes(8).toString('hex');
    const filename = `${timestamp}_${randomId}.webp`;
    const path = `user_${sanitizedNumber}/${filename}`;

    // Determine bucket based on type
    const bucket = tipo === 'estatico' ? 'stickers-estaticos' : 'stickers-animados';

    logger.info({
      msg: 'Uploading sticker to Supabase',
      bucket,
      path,
      size: buffer.length,
    });

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage.from(bucket).upload(path, buffer, {
      contentType: 'image/webp',
      cacheControl: '3600',
      upsert: false, // Don't overwrite existing files
    });

    if (error) {
      logger.error({
        msg: 'Error uploading to Supabase Storage',
        error: error.message,
        bucket,
        path,
      });
      throw new Error(`Supabase upload failed: ${error.message}`);
    }

    logger.info({
      msg: 'Sticker uploaded successfully',
      bucket,
      path: data.path,
    });

    // Get public URL
    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);

    logger.info({
      msg: 'Public URL generated',
      url: urlData.publicUrl,
    });

    return {
      path: data.path,
      url: urlData.publicUrl,
    };
  } catch (error) {
    logger.error({
      msg: 'Error in uploadSticker',
      error: error instanceof Error ? error.message : 'Unknown error',
      userNumber,
      tipo,
    });
    throw error;
  }
}

/**
 * Delete a sticker from Supabase Storage
 * @param path - File path in storage
 * @param tipo - Type of sticker
 */
export async function deleteSticker(path: string, tipo: 'estatico' | 'animado'): Promise<void> {
  try {
    const bucket = tipo === 'estatico' ? 'stickers-estaticos' : 'stickers-animados';

    logger.info({
      msg: 'Deleting sticker from Supabase',
      bucket,
      path,
    });

    const { error } = await supabase.storage.from(bucket).remove([path]);

    if (error) {
      logger.error({
        msg: 'Error deleting from Supabase Storage',
        error: error.message,
        bucket,
        path,
      });
      throw new Error(`Supabase delete failed: ${error.message}`);
    }

    logger.info({
      msg: 'Sticker deleted successfully',
      bucket,
      path,
    });
  } catch (error) {
    logger.error({
      msg: 'Error in deleteSticker',
      error: error instanceof Error ? error.message : 'Unknown error',
      path,
      tipo,
    });
    throw error;
  }
}
