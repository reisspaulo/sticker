#!/usr/bin/env tsx

/**
 * Test Script - User Provided Links
 * Tests Twitter video and image links
 */

import { config } from 'dotenv';
config();

import { detectTwitterUrl, extractTweetInfo } from '../src/utils/urlDetector';
import { downloadTwitterVideo, getVideoMetadata } from '../src/services/twitterService';

const LINKS = [
  {
    name: 'Twitter Video',
    url: 'https://x.com/httpsrealitys/status/2007146046741418108?s=46',
    type: 'video'
  },
  {
    name: 'Twitter Image (Direct CDN)',
    url: 'https://pbs.twimg.com/media/G9u75izXsAA5jGu?format=jpg&name=large',
    type: 'image'
  }
];

async function testLink(testCase: { name: string; url: string; type: string }) {
  console.log('\n========================================');
  console.log(`Testing: ${testCase.name}`);
  console.log('========================================\n');
  console.log(`URL: ${testCase.url}`);
  console.log(`Expected Type: ${testCase.type}\n`);

  try {
    // Test URL Detection
    console.log('Step 1: URL Detection');
    const detectedUrl = detectTwitterUrl(testCase.url);

    if (!detectedUrl) {
      console.log('❌ Not detected as Twitter URL');
      if (testCase.type === 'image' && testCase.url.includes('pbs.twimg.com')) {
        console.log('ℹ️  This is a direct CDN image link (not a tweet link)');
        console.log('ℹ️  System only processes tweet links, not direct media links');
      }
      return { success: false, reason: 'Not a tweet URL' };
    }

    console.log(`✅ Detected: ${detectedUrl}\n`);

    // Extract Tweet Info
    console.log('Step 2: Extract Tweet Info');
    const tweetInfo = extractTweetInfo(detectedUrl);

    if (!tweetInfo) {
      console.log('❌ Failed to extract tweet info');
      return { success: false, reason: 'Invalid tweet format' };
    }

    console.log(`✅ Username: @${tweetInfo.username}`);
    console.log(`✅ Tweet ID: ${tweetInfo.tweetId}\n`);

    // Get Video Metadata
    console.log('Step 3: Fetch Metadata from VxTwitter API');
    const metadata = await getVideoMetadata(tweetInfo.username, tweetInfo.tweetId);

    if (!metadata) {
      console.log('❌ No video found in this tweet');
      console.log('ℹ️  Tweet may contain only images or text');
      return { success: false, reason: 'No video in tweet' };
    }

    console.log('✅ Video Found!');
    console.log(`   Author: ${metadata.author_name} (@${metadata.author_username})`);
    console.log(`   Text: ${metadata.tweet_text?.substring(0, 100)}...`);
    console.log(`   Video URL: ${metadata.video_url}`);
    console.log(`   Duration: ${metadata.duration_sec}s`);
    console.log(`   Resolution: ${metadata.video_resolution}`);
    console.log(`   Size: ${(metadata.video_size_bytes / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Likes: ${metadata.likes} | Retweets: ${metadata.retweets}\n`);

    // Download Video
    console.log('Step 4: Download Video');
    const result = await downloadTwitterVideo(
      metadata,
      tweetInfo.tweetId,
      '5511999999999', // Test user
      'Test User'
    );

    if (result.success) {
      console.log('✅ Download Successful!');
      console.log(`   File: ${result.fileName}`);
      console.log(`   Path: ${result.filePath}`);
      console.log(`   URL: ${result.publicUrl}\n`);
      return { success: true, result };
    } else {
      console.log('❌ Download Failed');
      console.log(`   Error: ${result.error}\n`);
      return { success: false, reason: result.error };
    }

  } catch (error) {
    console.log('❌ Error:', error instanceof Error ? error.message : error);
    return { success: false, reason: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function main() {
  console.log('\n🧪 Testing User Provided Links\n');
  console.log('Testing 2 links:');
  LINKS.forEach((link, i) => {
    console.log(`  ${i + 1}. ${link.name} (${link.type})`);
  });

  const results = [];

  for (const link of LINKS) {
    const result = await testLink(link);
    results.push({ ...link, ...result });
  }

  // Summary
  console.log('\n========================================');
  console.log('SUMMARY');
  console.log('========================================\n');

  results.forEach((result, i) => {
    const status = result.success ? '✅ SUCCESS' : '❌ FAILED';
    console.log(`${i + 1}. ${result.name}: ${status}`);
    if (!result.success) {
      console.log(`   Reason: ${result.reason}`);
    }
  });

  const successCount = results.filter(r => r.success).length;
  console.log(`\n📊 Results: ${successCount}/${results.length} successful\n`);

  process.exit(successCount === results.length ? 0 : 1);
}

main();
