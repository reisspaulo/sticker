#!/usr/bin/env tsx

import { config } from 'dotenv';
config();

import { downloadTwitterVideo } from '../src/services/twitterService';

async function test() {
  console.log('\n🧪 Testing Twitter Video Download\n');

  const username = 'CarolDeToni';
  const tweetId = '2007404714070290631';

  console.log(`Testing tweet: https://x.com/${username}/status/${tweetId}\n`);

  try {
    const result = await downloadTwitterVideo(username, tweetId);

    if (result.success) {
      console.log('✅ SUCCESS!');
      console.log(`   Buffer size: ${(result.buffer!.length / 1024 / 1024).toFixed(2)} MB`);
      console.log(`   Author: ${result.metadata?.author} (@${result.metadata?.username})`);
      console.log(`   Text: ${result.metadata?.text?.substring(0, 100)}...`);
      console.log(`   Duration: ${result.metadata?.durationSec}s`);
      console.log(`   Resolution: ${result.metadata?.resolution}`);
      console.log(`   Video Type: ${result.metadata?.type}`);
      console.log(`   Likes: ${result.metadata?.likes} | Retweets: ${result.metadata?.retweets}\n`);
    } else {
      console.log('❌ FAILED');
      console.log(`   Error: ${result.error}`);
      console.log(`   Code: ${result.errorCode}\n`);
    }
  } catch (error) {
    console.log('❌ ERROR:', error);
  }
}

test();
