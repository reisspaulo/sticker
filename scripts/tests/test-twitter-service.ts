/**
 * Test Script for Twitter Service
 * Tests the Twitter video download functionality using VxTwitter API
 *
 * Usage:
 *   npx tsx scripts/test-twitter-service.ts <twitter-url>
 *
 * Examples:
 *   npx tsx scripts/test-twitter-service.ts https://x.com/username/status/1234567890
 *   npx tsx scripts/test-twitter-service.ts https://twitter.com/username/status/1234567890
 */

import { detectTwitterUrl, extractTweetInfo } from '../src/utils/urlDetector';
import { downloadTwitterVideo, getVideoMetadata } from '../src/services/twitterService';
import fs from 'fs';
import path from 'path';

async function testTwitterService(tweetUrl: string) {
  console.log('\n========================================');
  console.log('Twitter Video Download Service Test');
  console.log('========================================\n');

  try {
    // Step 1: Test URL Detection
    console.log('Step 1: Testing URL Detection');
    console.log(`Input URL: ${tweetUrl}\n`);

    const detectedUrl = detectTwitterUrl(tweetUrl);
    if (!detectedUrl) {
      console.error('ERROR: Failed to detect Twitter URL');
      process.exit(1);
    }
    console.log(`✓ URL Detected: ${detectedUrl}\n`);

    // Step 2: Extract Tweet Info
    console.log('Step 2: Extracting Tweet Information');
    const tweetInfo = extractTweetInfo(detectedUrl);
    if (!tweetInfo) {
      console.error('ERROR: Failed to extract tweet info');
      process.exit(1);
    }
    console.log(`✓ Username: @${tweetInfo.username}`);
    console.log(`✓ Tweet ID: ${tweetInfo.tweetId}\n`);

    // Step 3: Get Video Metadata
    console.log('Step 3: Fetching Video Metadata from VxTwitter API');
    const metadata = await getVideoMetadata(tweetInfo.username, tweetInfo.tweetId);
    if (!metadata) {
      console.error('ERROR: No video found in tweet');
      process.exit(1);
    }

    console.log('\n✓ Video Metadata Retrieved:');
    console.log(`  Author: ${metadata.author} (@${metadata.username})`);
    console.log(`  Tweet: "${metadata.text}"`);
    console.log(`  Type: ${metadata.type}`);
    console.log(`  Duration: ${metadata.durationSec?.toFixed(1) || 'N/A'}s`);
    console.log(`  Resolution: ${metadata.resolution}`);
    console.log(`  Video URL: ${metadata.videoUrl}`);
    if (metadata.thumbnailUrl) {
      console.log(`  Thumbnail: ${metadata.thumbnailUrl}`);
    }
    console.log(`  Likes: ${metadata.likes}`);
    console.log(`  Retweets: ${metadata.retweets}\n`);

    // Step 4: Download Video
    console.log('Step 4: Downloading Video');
    const downloadResult = await downloadTwitterVideo(tweetInfo.username, tweetInfo.tweetId);

    if (!downloadResult.success) {
      console.error(`ERROR: ${downloadResult.error}`);
      process.exit(1);
    }

    if (!downloadResult.buffer || !downloadResult.metadata) {
      console.error('ERROR: Missing buffer or metadata in download result');
      process.exit(1);
    }

    const fileSizeMB = (downloadResult.buffer.length / 1024 / 1024).toFixed(2);
    const fileSizeKB = (downloadResult.buffer.length / 1024).toFixed(2);

    console.log('\n✓ Video Downloaded Successfully:');
    console.log(`  Size: ${fileSizeMB} MB (${fileSizeKB} KB)`);
    console.log(`  Bytes: ${downloadResult.buffer.length.toLocaleString()}\n`);

    // Step 5: Save to Temp Directory
    console.log('Step 5: Saving to Temp Directory');
    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const timestamp = Date.now();
    const extension = downloadResult.metadata.type === 'gif' ? 'mp4' : 'mp4';
    const filename = `twitter-${downloadResult.metadata.username}-${downloadResult.metadata.tweetId}-${timestamp}.${extension}`;
    const outputPath = path.join(tempDir, filename);

    fs.writeFileSync(outputPath, downloadResult.buffer);

    console.log(`✓ File saved: ${outputPath}\n`);

    // Step 6: WhatsApp Validations
    console.log('Step 6: WhatsApp Compatibility Check');
    const maxSizeMB = 16;
    const maxDurationSec = 90;

    const sizeOk = downloadResult.buffer.length <= maxSizeMB * 1024 * 1024;
    const durationOk = !downloadResult.metadata.durationSec ||
                       downloadResult.metadata.durationSec <= maxDurationSec;

    if (sizeOk) {
      console.log(`  ✓ Size OK: ${fileSizeMB} MB (limit: ${maxSizeMB} MB)`);
    } else {
      console.log(`  ✗ Size TOO LARGE: ${fileSizeMB} MB (limit: ${maxSizeMB} MB)`);
    }

    if (durationOk) {
      console.log(`  ✓ Duration OK: ${downloadResult.metadata.durationSec?.toFixed(1) || 'N/A'}s (limit: ${maxDurationSec}s)`);
    } else {
      console.log(`  ✗ Duration TOO LONG: ${downloadResult.metadata.durationSec?.toFixed(1)}s (limit: ${maxDurationSec}s)`);
    }

    console.log('\n========================================');
    console.log('Test Completed Successfully!');
    console.log('========================================\n');

    console.log('Summary:');
    console.log(`  Tweet: @${downloadResult.metadata.username}`);
    console.log(`  File: ${filename}`);
    console.log(`  Size: ${fileSizeMB} MB`);
    console.log(`  Duration: ${downloadResult.metadata.durationSec?.toFixed(1) || 'N/A'}s`);
    console.log(`  Type: ${downloadResult.metadata.type}`);
    console.log(`  WhatsApp Compatible: ${sizeOk && durationOk ? 'YES' : 'NO'}\n`);

    process.exit(0);
  } catch (error) {
    console.error('\n========================================');
    console.error('Test Failed!');
    console.error('========================================\n');

    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
      if (error.stack) {
        console.error('\nStack trace:');
        console.error(error.stack);
      }
    } else {
      console.error('Unknown error:', error);
    }

    console.error('\n');
    process.exit(1);
  }
}

// Main execution
const tweetUrl = process.argv[2];

if (!tweetUrl) {
  console.log('\nUsage: npx tsx scripts/test-twitter-service.ts <twitter-url>\n');
  console.log('Examples:');
  console.log('  npx tsx scripts/test-twitter-service.ts https://x.com/username/status/1234567890');
  console.log('  npx tsx scripts/test-twitter-service.ts https://twitter.com/username/status/1234567890\n');
  process.exit(1);
}

testTwitterService(tweetUrl);
