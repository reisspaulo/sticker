#!/usr/bin/env tsx

import { config } from 'dotenv';
config();

import { downloadTwitterVideo } from '../src/services/twitterService';
import axios from 'axios';

async function test() {
  console.log('\n🧪 Testing meioindep tweet\n');

  const username = 'meioindep';
  const tweetId = '2007437061452595359';

  console.log(`Testing: https://x.com/${username}/status/${tweetId}\n`);

  // First, check what VxTwitter returns
  console.log('Step 1: Checking VxTwitter API response\n');
  try {
    const apiUrl = `https://api.vxtwitter.com/${username}/status/${tweetId}`;
    const response = await axios.get(apiUrl);
    const data = response.data;

    console.log('📊 Tweet Media Info:');
    console.log(`   Has Media: ${data.hasMedia}`);
    console.log(`   Total Media: ${data.media_extended?.length || 0}`);
    console.log(`   Media Types: ${data.media_extended?.map((m: any) => m.type).join(', ')}`);
    console.log('');

    if (data.media_extended && data.media_extended.length > 0) {
      console.log('📸 Media Details:');
      data.media_extended.forEach((media: any, index: number) => {
        console.log(`   ${index + 1}. Type: ${media.type}`);
        console.log(`      URL: ${media.url}`);
        console.log(`      Size: ${media.size?.width}x${media.size?.height}`);
        if (media.duration_millis) {
          console.log(`      Duration: ${(media.duration_millis / 1000).toFixed(1)}s`);
        }
        console.log('');
      });
    }
  } catch (error) {
    console.log('❌ Failed to get VxTwitter data:', error);
  }

  // Now test the download
  console.log('Step 2: Testing Download\n');
  try {
    const result = await downloadTwitterVideo(username, tweetId);

    if (result.success && result.metadata) {
      const { metadata } = result;

      console.log('✅ Download Successful');
      console.log(`   Author: ${metadata.author} (@${metadata.username})`);
      console.log(`   Text: ${metadata.text?.substring(0, 80)}...`);
      console.log(`   Total Media: ${metadata.totalMediaCount}`);
      console.log(`   Has Multiple Media: ${metadata.hasMultipleMedia}`);
      console.log(`   Downloaded Video Type: ${metadata.type}`);
      console.log(`   Duration: ${metadata.durationSec}s`);
      console.log(`   Resolution: ${metadata.resolution}`);
      console.log(`   Size: ${(result.buffer!.length / 1024 / 1024).toFixed(2)} MB\n`);

      if (metadata.hasMultipleMedia && metadata.totalMediaCount && metadata.totalMediaCount > 1) {
        console.log('📱 User Message:');
        console.log(`   "ℹ️ Este tweet tem ${metadata.totalMediaCount} mídias. Baixando apenas o vídeo."\n`);
      }
    } else {
      console.log(`❌ Download failed: ${result.error}`);
      console.log(`   Error code: ${result.errorCode}\n`);
    }
  } catch (error) {
    console.log(`❌ Error: ${error}\n`);
  }
}

test();
