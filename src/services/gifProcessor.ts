import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import ffprobePath from 'ffprobe-static';
import { unlinkSync, existsSync, promises as fsPromises, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import logger from '../config/logger';
import { downloadMedia } from './evolutionApi';
import { MessageKey } from '../types/evolution';

// Set ffmpeg and ffprobe paths
if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
}
if (ffprobePath?.path) {
  ffmpeg.setFfprobePath(ffprobePath.path);
}

interface ProcessAnimatedStickerResult {
  buffer: Buffer;
  width: number;
  height: number;
  fileSize: number;
  duration: number;
}

/**
 * Downloads media via Evolution API and saves to temporary file
 */
async function downloadFile(messageKey: MessageKey): Promise<string> {
  const tempPath = join(tmpdir(), `input-${Date.now()}.mp4`);

  try {
    logger.info({ messageId: messageKey.id, tempPath }, 'Downloading GIF file via Evolution API');

    // Download media using Evolution API (handles WhatsApp encryption)
    const buffer = await downloadMedia(messageKey);

    // Write buffer to temporary file
    writeFileSync(tempPath, buffer);

    logger.info({ tempPath, size: buffer.length }, 'File downloaded successfully');

    return tempPath;
  } catch (error) {
    logger.error({ error, messageId: messageKey.id }, 'Failed to download file');
    throw new Error(
      `Failed to download file: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Gets video metadata (duration, dimensions)
 */
async function getVideoMetadata(
  inputPath: string
): Promise<{ width: number; height: number; duration: number }> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) {
        logger.error({ error: err, inputPath }, 'Failed to get video metadata');
        return reject(err);
      }

      const videoStream = metadata.streams.find((s) => s.codec_type === 'video');
      if (!videoStream) {
        return reject(new Error('No video stream found'));
      }

      resolve({
        width: videoStream.width || 512,
        height: videoStream.height || 512,
        duration: metadata.format.duration || 0,
      });
    });
  });
}

/**
 * Converts video/GIF to animated WebP sticker
 * - Max dimensions: 512x512
 * - Target size: <500KB
 * - FPS: 15
 * - Quality: 75
 */
async function convertToAnimatedWebP(
  inputPath: string,
  outputPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    logger.info({ inputPath, outputPath }, 'Starting FFmpeg conversion');

    // Build video filter string
    const videoFilter = 'fps=15,scale=512:512:force_original_aspect_ratio=decrease';

    ffmpeg(inputPath)
      .outputOptions([
        '-vf',
        videoFilter,
        '-vcodec',
        'libwebp',
        '-q:v',
        '75',
        '-loop',
        '0',
        '-preset',
        'default',
        '-an', // No audio
        '-vsync',
        '0',
      ])
      .toFormat('webp')
      .on('start', (commandLine) => {
        logger.debug({ commandLine }, 'FFmpeg command');
      })
      .on('progress', (progress) => {
        logger.debug({ progress }, 'FFmpeg progress');
      })
      .on('end', () => {
        logger.info({ outputPath }, 'FFmpeg conversion completed');
        resolve();
      })
      .on('error', (error) => {
        logger.error({ error, inputPath, outputPath }, 'FFmpeg conversion failed');
        reject(error);
      })
      .save(outputPath);
  });
}

/**
 * Reads file into buffer
 */
async function readFileToBuffer(filePath: string): Promise<Buffer> {
  return await fsPromises.readFile(filePath);
}

/**
 * Process animated sticker from a Buffer (for Twitter GIFs, etc.)
 * @param buffer Video/GIF buffer to process
 * @returns Processed WebP sticker details
 */
export async function processAnimatedStickerFromBuffer(
  buffer: Buffer
): Promise<ProcessAnimatedStickerResult> {
  const startTime = Date.now();
  let inputPath: string | null = null;
  let outputPath: string | null = null;

  try {
    logger.info({ bufferSize: buffer.length }, 'Processing animated sticker from buffer');

    // Write buffer to temporary file
    inputPath = join(tmpdir(), `input-${Date.now()}.mp4`);
    writeFileSync(inputPath, buffer);
    logger.info({ inputPath, size: buffer.length }, 'Buffer written to temp file');

    // Get metadata
    const metadata = await getVideoMetadata(inputPath);
    logger.info({ metadata }, 'Video metadata');

    // Convert to WebP
    outputPath = join(tmpdir(), `output-${Date.now()}.webp`);
    await convertToAnimatedWebP(inputPath, outputPath);

    // Read result
    const processedBuffer = await readFileToBuffer(outputPath);
    const fileSize = processedBuffer.length;

    // Validate size
    const maxSize = 500 * 1024; // 500KB
    if (fileSize > maxSize) {
      logger.warn(
        { fileSize, maxSize },
        'Animated sticker exceeds max size - may need quality reduction'
      );
    }

    const processingTime = Date.now() - startTime;
    logger.info(
      {
        fileSize,
        processingTime,
        width: 512,
        height: 512,
      },
      'Animated sticker from buffer processed successfully'
    );

    return {
      buffer: processedBuffer,
      width: 512,
      height: 512,
      fileSize,
      duration: metadata.duration,
    };
  } catch (error) {
    const processingTime = Date.now() - startTime;
    logger.error(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime,
      },
      'Failed to process animated sticker from buffer'
    );

    throw new Error(
      `Failed to process animated sticker from buffer: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  } finally {
    // Cleanup temp files
    try {
      if (inputPath && existsSync(inputPath)) {
        unlinkSync(inputPath);
        logger.debug({ inputPath }, 'Cleaned up input file');
      }
      if (outputPath && existsSync(outputPath)) {
        unlinkSync(outputPath);
        logger.debug({ outputPath }, 'Cleaned up output file');
      }
    } catch (cleanupError) {
      logger.warn({ cleanupError }, 'Failed to cleanup temp files');
    }
  }
}

/**
 * Main function to process animated sticker from WhatsApp message
 * @param messageKey Message key for downloading from Evolution API
 * @returns Buffer of the processed WebP sticker
 */
export async function processAnimatedSticker(
  messageKey: MessageKey
): Promise<ProcessAnimatedStickerResult> {
  const startTime = Date.now();
  let inputPath: string | null = null;
  let outputPath: string | null = null;

  try {
    logger.info({ messageId: messageKey.id }, 'Processing animated sticker');

    // Download file
    inputPath = await downloadFile(messageKey);

    // Get metadata
    const metadata = await getVideoMetadata(inputPath);
    logger.info({ metadata }, 'Video metadata');

    // Convert to WebP
    outputPath = join(tmpdir(), `output-${Date.now()}.webp`);
    await convertToAnimatedWebP(inputPath, outputPath);

    // Read result
    const buffer = await readFileToBuffer(outputPath);
    const fileSize = buffer.length;

    // Validate size
    const maxSize = 500 * 1024; // 500KB
    if (fileSize > maxSize) {
      logger.warn(
        { fileSize, maxSize },
        'Animated sticker exceeds max size - may need quality reduction'
      );
    }

    const processingTime = Date.now() - startTime;
    logger.info(
      {
        fileSize,
        processingTime,
        width: 512,
        height: 512,
      },
      'Animated sticker processed successfully'
    );

    return {
      buffer,
      width: 512,
      height: 512,
      fileSize,
      duration: metadata.duration,
    };
  } catch (error) {
    const processingTime = Date.now() - startTime;
    logger.error(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        messageId: messageKey.id,
        processingTime,
      },
      'Failed to process animated sticker'
    );

    throw new Error(
      `Failed to process animated sticker: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  } finally {
    // Cleanup temp files
    try {
      if (inputPath && existsSync(inputPath)) {
        unlinkSync(inputPath);
        logger.debug({ inputPath }, 'Cleaned up input file');
      }
      if (outputPath && existsSync(outputPath)) {
        unlinkSync(outputPath);
        logger.debug({ outputPath }, 'Cleaned up output file');
      }
    } catch (cleanupError) {
      logger.warn({ cleanupError }, 'Failed to cleanup temp files');
    }
  }
}
