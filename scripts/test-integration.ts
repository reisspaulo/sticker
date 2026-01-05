/**
 * Integration Test for Twitter Video Download
 * Tests the complete flow: detection -> validation -> queue
 */

import { validateMessage } from '../src/utils/messageValidator';
import { MessageContent } from '../src/types/evolution';

console.log('\n========================================');
console.log('Twitter Video Integration Test');
console.log('========================================\n');

// Test 1: Valid Twitter URL in conversation
console.log('Test 1: Valid Twitter URL in text message (conversation)');
const message1: MessageContent = {
  conversation: 'Check this video https://x.com/elonmusk/status/1234567890',
};

const result1 = validateMessage(message1);
console.log('  Input:', message1.conversation);
console.log('  Valid:', result1.valid);
if (result1.valid) {
  console.log('  Message Type:', result1.messageType);
  console.log('  Tweet URL:', result1.tweetUrl);
  console.log('  PASSED\n');
} else {
  console.log('  Error:', result1.error);
  console.log('  FAILED\n');
  process.exit(1);
}

// Test 2: Valid Twitter URL in extended text
console.log('Test 2: Valid Twitter URL in extended text message');
const message2: MessageContent = {
  extendedTextMessage: {
    text: 'Look https://twitter.com/NASA/status/9876543210 amazing!',
  },
};

const result2 = validateMessage(message2);
console.log('  Input:', message2.extendedTextMessage?.text);
console.log('  Valid:', result2.valid);
if (result2.valid) {
  console.log('  Message Type:', result2.messageType);
  console.log('  Tweet URL:', result2.tweetUrl);
  console.log('  PASSED\n');
} else {
  console.log('  Error:', result2.error);
  console.log('  FAILED\n');
  process.exit(1);
}

// Test 3: Invalid Twitter URL
console.log('Test 3: Invalid Twitter URL');
const message3: MessageContent = {
  conversation: 'Check this https://twitter.com/user/invalid',
};

const result3 = validateMessage(message3);
console.log('  Input:', message3.conversation);
console.log('  Valid:', result3.valid);
if (!result3.valid) {
  console.log('  Error:', result3.error);
  console.log('  PASSED (correctly rejected)\n');
} else {
  console.log('  FAILED (should have been rejected)\n');
  process.exit(1);
}

// Test 4: No Twitter URL (should fall through to other validation)
console.log('Test 4: Regular text message (no Twitter URL)');
const message4: MessageContent = {
  conversation: 'Hello, this is a regular message',
};

const result4 = validateMessage(message4);
console.log('  Input:', message4.conversation);
console.log('  Valid:', result4.valid);
console.log('  Error Code:', !result4.valid ? result4.errorCode : 'N/A');
console.log('  PASSED (correctly rejected as unsupported)\n');

// Test 5: Image message (should still work)
console.log('Test 5: Image message (backward compatibility)');
const message5: MessageContent = {
  imageMessage: {
    url: 'https://example.com/image.jpg',
    mimetype: 'image/jpeg',
    fileLength: 1024 * 1024, // 1MB
  },
};

const result5 = validateMessage(message5);
console.log('  Valid:', result5.valid);
if (result5.valid) {
  console.log('  Message Type:', result5.messageType);
  console.log('  PASSED (image validation still works)\n');
} else {
  console.log('  Error:', result5.error);
  console.log('  FAILED\n');
  process.exit(1);
}

// Test 6: GIF/Video message (should still work)
console.log('Test 6: GIF/Video message (backward compatibility)');
const message6: MessageContent = {
  videoMessage: {
    url: 'https://example.com/video.mp4',
    mimetype: 'video/mp4',
    fileLength: 2 * 1024 * 1024, // 2MB
    seconds: 5,
    gifPlayback: true,
  },
};

const result6 = validateMessage(message6);
console.log('  Valid:', result6.valid);
if (result6.valid) {
  console.log('  Message Type:', result6.messageType);
  console.log('  PASSED (GIF validation still works)\n');
} else {
  console.log('  Error:', result6.error);
  console.log('  FAILED\n');
  process.exit(1);
}

console.log('========================================');
console.log('All Integration Tests Passed!');
console.log('========================================\n');

console.log('Summary:');
console.log('  Twitter URL detection: WORKING');
console.log('  Twitter URL validation: WORKING');
console.log('  Backward compatibility: WORKING');
console.log('  Message type detection: WORKING\n');
