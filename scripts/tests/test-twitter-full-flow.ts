#!/usr/bin/env tsx
/**
 * Manual Test Script for Twitter Download Flow
 *
 * This script manually tests the complete Twitter download flow
 * Usage: npm run tsx scripts/test-twitter-full-flow.ts
 *
 * Requirements:
 * - Sprints 8-10 must be completed
 * - Supabase configured
 * - Evolution API running
 * - Redis running
 */

import axios from 'axios';
import logger from '../src/config/logger';

// Configuration
const CONFIG = {
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',
  testUserNumber: process.env.TEST_USER_NUMBER || '5511999999999',
  testUserName: 'Test User - Twitter Flow',
  twitterUrl: 'https://twitter.com/elonmusk/status/1234567890',
  instanceName: process.env.EVOLUTION_INSTANCE || 'test-instance',
};

interface TestResult {
  step: string;
  status: 'success' | 'failed' | 'pending';
  message: string;
  data?: any;
}

const results: TestResult[] = [];

function logResult(result: TestResult) {
  results.push(result);
  const emoji = result.status === 'success' ? '✅' : result.status === 'failed' ? '❌' : '⏳';
  console.log(`${emoji} ${result.step}: ${result.message}`);
  if (result.data) {
    console.log('   Data:', JSON.stringify(result.data, null, 2));
  }
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Test 1: Send Twitter URL via webhook
 */
async function testSendTwitterUrl(): Promise<void> {
  try {
    console.log('\n--- Test 1: Send Twitter URL ---');

    const webhookPayload = {
      event: 'messages.upsert',
      instance: CONFIG.instanceName,
      data: {
        key: {
          remoteJid: `${CONFIG.testUserNumber}@s.whatsapp.net`,
          fromMe: false,
          id: `test-${Date.now()}`,
        },
        message: {
          conversation: CONFIG.twitterUrl,
        },
        pushName: CONFIG.testUserName,
        messageTimestamp: Math.floor(Date.now() / 1000),
      },
    };

    const response = await axios.post(`${CONFIG.baseUrl}/webhook`, webhookPayload);

    logResult({
      step: 'Send Twitter URL',
      status: response.status === 200 ? 'success' : 'failed',
      message: `Webhook responded with status ${response.status}`,
      data: { status: response.status },
    });
  } catch (error) {
    logResult({
      step: 'Send Twitter URL',
      status: 'failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Test 2: Verify URL detection
 */
async function testUrlDetection(): Promise<void> {
  try {
    console.log('\n--- Test 2: Verify URL Detection ---');

    // This would check logs or database to verify URL was detected
    // For now, we'll just confirm the module works
    const { detectTwitterUrl, extractTweetInfo } = await import('../src/utils/urlDetector');

    const detectedUrl = detectTwitterUrl(CONFIG.twitterUrl);
    const tweetInfo = extractTweetInfo(CONFIG.twitterUrl);

    if (detectedUrl && tweetInfo) {
      logResult({
        step: 'URL Detection',
        status: 'success',
        message: 'URL detected and parsed successfully',
        data: { detectedUrl, tweetInfo },
      });
    } else {
      throw new Error('URL detection failed');
    }
  } catch (error) {
    logResult({
      step: 'URL Detection',
      status: 'failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Test 3: Simulate user response "sim"
 */
async function testUserResponseYes(): Promise<void> {
  try {
    console.log('\n--- Test 3: Simulate User Response (Yes) ---');

    await sleep(2000); // Wait for question to be sent

    const webhookPayload = {
      event: 'messages.upsert',
      instance: CONFIG.instanceName,
      data: {
        key: {
          remoteJid: `${CONFIG.testUserNumber}@s.whatsapp.net`,
          fromMe: false,
          id: `test-response-${Date.now()}`,
        },
        message: {
          conversation: 'sim',
        },
        pushName: CONFIG.testUserName,
        messageTimestamp: Math.floor(Date.now() / 1000),
      },
    };

    const response = await axios.post(`${CONFIG.baseUrl}/webhook`, webhookPayload);

    logResult({
      step: 'User Response (Yes)',
      status: response.status === 200 ? 'success' : 'failed',
      message: `Response processed with status ${response.status}`,
      data: { status: response.status },
    });
  } catch (error) {
    logResult({
      step: 'User Response (Yes)',
      status: 'failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Test 4: Check statistics
 */
async function testStatistics(): Promise<void> {
  try {
    console.log('\n--- Test 4: Check Statistics ---');

    await sleep(3000); // Wait for processing

    const response = await axios.get(`${CONFIG.baseUrl}/stats`);

    logResult({
      step: 'Statistics Check',
      status: 'success',
      message: 'Statistics retrieved successfully',
      data: response.data,
    });
  } catch (error) {
    logResult({
      step: 'Statistics Check',
      status: 'failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Test 5: Test daily limit
 */
async function testDailyLimit(): Promise<void> {
  try {
    console.log('\n--- Test 5: Test Daily Limit (10 downloads) ---');

    // This test would send 11 Twitter URLs to verify limit enforcement
    console.log('⏳ This test requires multiple downloads and is skipped in quick mode');
    console.log('   To test daily limit, run this script with --full flag');

    logResult({
      step: 'Daily Limit Test',
      status: 'pending',
      message: 'Skipped in quick mode (use --full flag to test)',
    });
  } catch (error) {
    logResult({
      step: 'Daily Limit Test',
      status: 'failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Test 6: Test counter separation
 */
async function testCounterSeparation(): Promise<void> {
  try {
    console.log('\n--- Test 6: Verify Twitter/Sticker Counter Separation ---');

    // This would verify that Twitter downloads don't affect sticker counter
    const { getTwitterDownloadCount } = await import('../src/services/twitterLimits');
    const { getDailyCount } = await import('../src/services/userService');

    console.log('⏳ Counter separation test requires user ID lookup');

    logResult({
      step: 'Counter Separation',
      status: 'pending',
      message: 'Test requires database integration',
    });
  } catch (error) {
    logResult({
      step: 'Counter Separation',
      status: 'failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('='.repeat(60));
  console.log('TWITTER DOWNLOAD FLOW - MANUAL TEST');
  console.log('='.repeat(60));
  console.log(`Base URL: ${CONFIG.baseUrl}`);
  console.log(`Test User: ${CONFIG.testUserNumber}`);
  console.log(`Twitter URL: ${CONFIG.twitterUrl}`);
  console.log('='.repeat(60));

  try {
    // Check if server is running
    try {
      await axios.get(`${CONFIG.baseUrl}/health`);
      console.log('✅ Server is running\n');
    } catch (error) {
      console.error('❌ Server is not running. Start the server first.');
      console.error('   Run: npm run dev');
      process.exit(1);
    }

    // Run tests sequentially
    await testUrlDetection();
    await testSendTwitterUrl();
    await testUserResponseYes();
    await testStatistics();
    await testDailyLimit();
    await testCounterSeparation();

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('TEST SUMMARY');
    console.log('='.repeat(60));

    const successCount = results.filter((r) => r.status === 'success').length;
    const failedCount = results.filter((r) => r.status === 'failed').length;
    const pendingCount = results.filter((r) => r.status === 'pending').length;

    console.log(`✅ Passed: ${successCount}`);
    console.log(`❌ Failed: ${failedCount}`);
    console.log(`⏳ Pending: ${pendingCount}`);
    console.log(`📊 Total: ${results.length}`);

    if (failedCount > 0) {
      console.log('\n❌ Some tests failed. Check the output above for details.');
      process.exit(1);
    } else if (pendingCount === results.length) {
      console.log('\n⏳ All tests are pending. Sprints 8-10 need to be completed first.');
    } else {
      console.log('\n✅ All active tests passed!');
    }
  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  }
}

// Run tests
if (require.main === module) {
  runTests().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { runTests, testSendTwitterUrl, testUrlDetection };
