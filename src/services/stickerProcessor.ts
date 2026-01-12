import sharp from 'sharp';
import logger from '../config/logger';
import { downloadMedia } from './evolutionApi';
import { MessageKey } from '../types/evolution';

/**
 * Process a static image into a WebP sticker format
 * - Download image via Evolution API (handles WhatsApp encryption)
 * - Resize to 512x512 (maintaining aspect ratio with transparent padding)
 * - Convert to WebP with 90% quality
 * - Ensure final size < 500KB
 */
export async function processStaticSticker(messageKey: MessageKey): Promise<Buffer> {
  const startTime = Date.now();

  try {
    logger.info({ msg: 'Downloading image via Evolution API', messageId: messageKey.id });

    // Download image using Evolution API (handles WhatsApp encryption)
    const imageBuffer = await downloadMedia(messageKey);

    logger.info({
      msg: 'Image downloaded',
      size: imageBuffer.length,
    });

    // Get image metadata to determine aspect ratio
    const metadata = await sharp(imageBuffer).metadata();
    logger.info({
      msg: 'Image metadata',
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
    });

    // Calculate dimensions to fit in 512x512 while maintaining aspect ratio
    let resizeWidth = 512;
    let resizeHeight = 512;

    if (metadata.width && metadata.height) {
      const aspectRatio = metadata.width / metadata.height;

      if (aspectRatio > 1) {
        // Width is larger - fit to width
        resizeHeight = Math.round(512 / aspectRatio);
      } else if (aspectRatio < 1) {
        // Height is larger - fit to height
        resizeWidth = Math.round(512 * aspectRatio);
      }
    }

    logger.info({
      msg: 'Calculated resize dimensions',
      resizeWidth,
      resizeHeight,
    });

    // Process image: resize and convert to WebP
    let sharpInstance = sharp(imageBuffer)
      .resize(resizeWidth, resizeHeight, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }, // Transparent background
      })
      .extend({
        top: Math.floor((512 - resizeHeight) / 2),
        bottom: Math.ceil((512 - resizeHeight) / 2),
        left: Math.floor((512 - resizeWidth) / 2),
        right: Math.ceil((512 - resizeWidth) / 2),
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      });

    let processedBuffer = await sharpInstance.webp({ quality: 90 }).toBuffer();

    logger.info({
      msg: 'Image processed',
      initialSize: imageBuffer.length,
      processedSize: processedBuffer.length,
    });

    // If file is still too large, reduce quality iteratively
    let quality = 90;
    const maxSize = 500 * 1024; // 500KB

    while (processedBuffer.length > maxSize && quality > 40) {
      quality -= 10;
      logger.info({
        msg: 'Reducing quality to meet size limit',
        currentSize: processedBuffer.length,
        targetSize: maxSize,
        newQuality: quality,
      });

      let reducedSharpInstance = sharp(imageBuffer)
        .resize(resizeWidth, resizeHeight, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .extend({
          top: Math.floor((512 - resizeHeight) / 2),
          bottom: Math.ceil((512 - resizeHeight) / 2),
          left: Math.floor((512 - resizeWidth) / 2),
          right: Math.ceil((512 - resizeWidth) / 2),
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        });

      processedBuffer = await reducedSharpInstance.webp({ quality }).toBuffer();
    }

    const processingTime = Date.now() - startTime;
    logger.info({
      msg: 'Sticker processing completed',
      finalSize: processedBuffer.length,
      finalQuality: quality,
      processingTimeMs: processingTime,
    });

    if (processedBuffer.length > maxSize) {
      throw new Error(
        `Unable to reduce file size below 500KB. Final size: ${processedBuffer.length} bytes`
      );
    }

    return processedBuffer;
  } catch (error) {
    const processingTime = Date.now() - startTime;
    logger.error({
      msg: 'Error processing sticker',
      error: error instanceof Error ? error.message : 'Unknown error',
      messageId: messageKey.id,
      processingTimeMs: processingTime,
    });
    throw error;
  }
}
