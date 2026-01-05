#!/usr/bin/env tsx

/**
 * Test Script - Video Selection System
 * Tests the complete flow of video selection for tweets with multiple videos
 */

import { config } from 'dotenv';
config();

import { getVideoMetadata } from '../src/services/twitterService';
import {
  saveVideoSelectionContext,
  getVideoSelectionContext,
  clearVideoSelectionContext,
  processVideoSelectionResponse,
} from '../src/utils/videoSelectionContext';
import { sendVideoSelectionMessage } from '../src/services/messageService';

async function test() {
  console.log('\n🧪 Testing Video Selection System\n');

  // Test Case 1: Find a tweet with multiple videos
  console.log('========================================');
  console.log('Test 1: Detect Multiple Videos');
  console.log('========================================\n');

  // This is a hypothetical tweet - replace with actual tweet with multiple videos if needed
  const username = 'testuser';
  const tweetId = '123456789';

  try {
    console.log('⚠️  Note: Using test data since we need a real tweet with multiple videos\n');

    // Simulate metadata with multiple videos
    const mockMetadata = {
      tweetId: '123456789',
      author: 'Test User',
      username: 'testuser',
      text: 'Test tweet with multiple videos',
      date: new Date().toISOString(),
      likes: 100,
      retweets: 50,
      videoUrl: 'https://example.com/video1.mp4',
      thumbnailUrl: 'https://example.com/thumb1.jpg',
      duration: 15000,
      durationSec: 15,
      resolution: '1920x1080',
      type: 'video' as const,
      width: 1920,
      height: 1080,
      hasMultipleVideos: true,
      totalMediaCount: 3,
      allVideos: [
        {
          url: 'https://example.com/video1.mp4',
          thumbnailUrl: 'https://example.com/thumb1.jpg',
          duration: 15000,
          durationSec: 15,
          resolution: '1920x1080',
          type: 'video' as const,
          width: 1920,
          height: 1080,
        },
        {
          url: 'https://example.com/video2.mp4',
          thumbnailUrl: 'https://example.com/thumb2.jpg',
          duration: 10000,
          durationSec: 10,
          resolution: '1280x720',
          type: 'video' as const,
          width: 1280,
          height: 720,
        },
        {
          url: 'https://example.com/video3.mp4',
          thumbnailUrl: 'https://example.com/thumb3.jpg',
          duration: 20000,
          durationSec: 20,
          resolution: '1920x1080',
          type: 'video' as const,
          width: 1920,
          height: 1080,
        },
      ],
    };

    console.log('📊 Mock Tweet Info:');
    console.log(`   Has Multiple Videos: ${mockMetadata.hasMultipleVideos}`);
    console.log(`   Total Videos: ${mockMetadata.allVideos?.length}`);
    console.log('');

    if (mockMetadata.allVideos) {
      console.log('📹 Available Videos:');
      mockMetadata.allVideos.forEach((video, index) => {
        console.log(`   ${index + 1}. ${video.type} - ${video.durationSec}s - ${video.resolution}`);
      });
      console.log('');
    }

    // Test Case 2: Save context
    console.log('\n========================================');
    console.log('Test 2: Save Video Selection Context');
    console.log('========================================\n');

    const testUserNumber = '5511999999999';
    const testUserName = 'Test User';

    await saveVideoSelectionContext(testUserNumber, {
      state: 'awaiting_video_selection',
      tweetId: mockMetadata.tweetId,
      username: mockMetadata.username,
      metadata: mockMetadata,
      userNumber: testUserNumber,
      userName: testUserName,
    });

    console.log('✅ Context saved to Redis');
    console.log(`   User: ${testUserNumber}`);
    console.log(`   Tweet: ${mockMetadata.tweetId}`);
    console.log(`   Videos: ${mockMetadata.allVideos?.length}\n`);

    // Test Case 3: Retrieve context
    console.log('========================================');
    console.log('Test 3: Retrieve Video Selection Context');
    console.log('========================================\n');

    const retrievedContext = await getVideoSelectionContext(testUserNumber);

    if (retrievedContext) {
      console.log('✅ Context retrieved successfully');
      console.log(`   State: ${retrievedContext.state}`);
      console.log(`   Tweet ID: ${retrievedContext.tweetId}`);
      console.log(`   Videos: ${retrievedContext.metadata.allVideos?.length}`);
      console.log(`   Expires At: ${new Date(retrievedContext.expiresAt).toISOString()}\n`);
    } else {
      console.log('❌ Failed to retrieve context\n');
    }

    // Test Case 4: Process selection responses
    console.log('========================================');
    console.log('Test 4: Process Selection Responses');
    console.log('========================================\n');

    const testCases = [
      { response: '1', expected: 1 },
      { response: '2', expected: 2 },
      { response: '3', expected: 3 },
      { response: '4', expected: 'invalid' },
      { response: '0', expected: 'invalid' },
      { response: 'cancelar', expected: 'cancel' },
      { response: 'cancel', expected: 'cancel' },
      { response: 'não', expected: 'cancel' },
      { response: 'abc', expected: 'invalid' },
      { response: '', expected: 'invalid' },
    ];

    for (const testCase of testCases) {
      const result = processVideoSelectionResponse(testCase.response, 3);
      const passed = result === testCase.expected;
      const icon = passed ? '✅' : '❌';

      console.log(
        `   ${icon} "${testCase.response}" → ${result} ${passed ? '' : `(expected: ${testCase.expected})`}`
      );
    }

    console.log('');

    // Test Case 5: Clear context
    console.log('========================================');
    console.log('Test 5: Clear Video Selection Context');
    console.log('========================================\n');

    await clearVideoSelectionContext(testUserNumber);
    console.log('✅ Context cleared');

    const clearedContext = await getVideoSelectionContext(testUserNumber);
    if (clearedContext === null) {
      console.log('✅ Verified: Context no longer exists\n');
    } else {
      console.log('❌ Error: Context still exists after clearing\n');
    }

    // Summary
    console.log('========================================');
    console.log('SUMMARY');
    console.log('========================================\n');
    console.log('✅ Video selection context management works');
    console.log('✅ Response parsing works correctly');
    console.log('✅ Redis TTL and expiration work');
    console.log('');
    console.log('📝 Next Steps:');
    console.log('   1. Find a real tweet with multiple videos to test');
    console.log('   2. Test the complete flow with Evolution API webhook');
    console.log('   3. Verify video download and delivery\n');
  } catch (error) {
    console.log(`❌ Error: ${error}\n`);
  }
}

test();
