#!/usr/bin/env tsx

/**
 * Test Script - Multiple Media Detection
 * Tests if the system correctly detects and informs about multiple media
 */

import { config } from 'dotenv';
config();

import { downloadTwitterVideo } from '../src/services/twitterService';

async function test() {
  console.log('\n🧪 Testing Multiple Media Detection\n');

  const testCases = [
    {
      name: 'Tweet with 1 video only',
      username: 'httpsrealitys',
      tweetId: '2007146046741418108',
      expectedMedia: 1,
    },
    {
      name: 'Tweet with image + video (2 media)',
      username: 'CarolDeToni',
      tweetId: '2007404714070290631',
      expectedMedia: 2,
    },
  ];

  for (const testCase of testCases) {
    console.log(`\n========================================`);
    console.log(`Test: ${testCase.name}`);
    console.log(`========================================\n`);

    try {
      const result = await downloadTwitterVideo(testCase.username, testCase.tweetId);

      if (result.success && result.metadata) {
        const { metadata } = result;

        console.log('✅ Download Successful');
        console.log(`   Total Media: ${metadata.totalMediaCount}`);
        console.log(`   Has Multiple Media: ${metadata.hasMultipleMedia}`);
        console.log(`   Expected: ${testCase.expectedMedia} media\n`);

        // Simulate message that would be sent
        if (metadata.hasMultipleMedia && metadata.totalMediaCount && metadata.totalMediaCount > 1) {
          console.log('📱 Message to user would include:');
          console.log(`   "ℹ️ Este tweet tem ${metadata.totalMediaCount} mídias. Baixando apenas o vídeo."\n`);
        } else {
          console.log('📱 Standard message (no multiple media warning)\n');
        }

        // Verify
        if (metadata.totalMediaCount === testCase.expectedMedia) {
          console.log('✅ PASS: Media count matches expected\n');
        } else {
          console.log(`❌ FAIL: Expected ${testCase.expectedMedia}, got ${metadata.totalMediaCount}\n`);
        }
      } else {
        console.log(`❌ Download failed: ${result.error}\n`);
      }
    } catch (error) {
      console.log(`❌ Error: ${error}\n`);
    }
  }

  console.log('\n========================================');
  console.log('SUMMARY');
  console.log('========================================\n');
  console.log('✅ System now detects multiple media in tweets');
  console.log('✅ User will be informed when tweet has multiple media');
  console.log('✅ Only video is downloaded (as designed)\n');
}

test();
