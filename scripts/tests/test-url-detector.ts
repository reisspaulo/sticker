/**
 * Test Script for URL Detector
 * Tests URL detection and extraction functions
 */

import { detectTwitterUrl, extractTweetInfo, isTwitterUrl } from '../src/utils/urlDetector';

console.log('\n========================================');
console.log('Twitter URL Detector Test');
console.log('========================================\n');

// Test cases
const testCases = [
  {
    name: 'Twitter.com URL',
    input: 'Check this video: https://twitter.com/elonmusk/status/1234567890',
    expectedUrl: 'https://twitter.com/elonmusk/status/1234567890',
    expectedUsername: 'elonmusk',
    expectedTweetId: '1234567890',
  },
  {
    name: 'X.com URL',
    input: 'Look at this: https://x.com/NASA/status/9876543210',
    expectedUrl: 'https://x.com/NASA/status/9876543210',
    expectedUsername: 'NASA',
    expectedTweetId: '9876543210',
  },
  {
    name: 'HTTP URL (should upgrade)',
    input: 'http://twitter.com/user123/status/1111111111',
    expectedUrl: 'http://twitter.com/user123/status/1111111111',
    expectedUsername: 'user123',
    expectedTweetId: '1111111111',
  },
  {
    name: 'URL with extra text',
    input: 'Hey check this out https://x.com/SpaceX/status/5555555555 its amazing!',
    expectedUrl: 'https://x.com/SpaceX/status/5555555555',
    expectedUsername: 'SpaceX',
    expectedTweetId: '5555555555',
  },
  {
    name: 'No Twitter URL',
    input: 'This is just a regular message',
    expectedUrl: null,
    expectedUsername: null,
    expectedTweetId: null,
  },
  {
    name: 'Invalid Twitter URL',
    input: 'https://twitter.com/user/invalid',
    expectedUrl: null,
    expectedUsername: null,
    expectedTweetId: null,
  },
];

let passed = 0;
let failed = 0;

for (const testCase of testCases) {
  console.log(`Test: ${testCase.name}`);
  console.log(`  Input: "${testCase.input}"`);

  try {
    // Test detection
    const detectedUrl = detectTwitterUrl(testCase.input);
    console.log(`  Detected URL: ${detectedUrl || 'null'}`);

    if (detectedUrl !== testCase.expectedUrl) {
      console.log(`  FAILED: Expected "${testCase.expectedUrl}", got "${detectedUrl}"`);
      failed++;
      console.log('');
      continue;
    }

    // Test extraction if URL was detected
    if (detectedUrl) {
      const tweetInfo = extractTweetInfo(detectedUrl);
      console.log(`  Username: @${tweetInfo?.username || 'null'}`);
      console.log(`  Tweet ID: ${tweetInfo?.tweetId || 'null'}`);

      if (tweetInfo?.username !== testCase.expectedUsername) {
        console.log(`  FAILED: Expected username "${testCase.expectedUsername}", got "${tweetInfo?.username}"`);
        failed++;
        console.log('');
        continue;
      }

      if (tweetInfo?.tweetId !== testCase.expectedTweetId) {
        console.log(`  FAILED: Expected tweet ID "${testCase.expectedTweetId}", got "${tweetInfo?.tweetId}"`);
        failed++;
        console.log('');
        continue;
      }

      // Test isTwitterUrl
      const isValid = isTwitterUrl(detectedUrl);
      console.log(`  Is valid Twitter URL: ${isValid}`);

      if (!isValid) {
        console.log('  FAILED: isTwitterUrl returned false for valid URL');
        failed++;
        console.log('');
        continue;
      }
    }

    console.log('  PASSED');
    passed++;
  } catch (error) {
    console.log(`  FAILED: ${error instanceof Error ? error.message : 'Unknown error'}`);
    failed++;
  }

  console.log('');
}

console.log('========================================');
console.log('Test Results');
console.log('========================================');
console.log(`Total: ${testCases.length}`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log('========================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('All tests passed!\n');
  process.exit(0);
}
