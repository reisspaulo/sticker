# Video Selection System Implementation

## Overview

Implemented a complete video selection system for tweets with multiple videos. When a user sends a Twitter URL that contains multiple videos, the system now allows them to choose which video to download instead of automatically downloading the first one.

## Features

- **Automatic Detection**: Detects when a tweet has multiple videos
- **Interactive Selection**: Prompts user to select which video they want
- **Context Management**: Uses Redis to track user selection state with 5-minute TTL
- **Robust Validation**: Validates user responses (numeric selection, cancel, invalid input)
- **Complete Flow**: Downloads and sends the selected video with metadata

## Implementation Details

### Files Modified

#### 1. `src/types/twitter.ts`
**Changes**: Added interfaces for multiple video support

```typescript
// New interface for individual video info
export interface TwitterVideoInfo {
  url: string;
  thumbnailUrl?: string;
  duration?: number;
  durationSec?: number;
  resolution: string;
  type: 'video' | 'gif';
  width: number;
  height: number;
}

// Updated TwitterVideoMetadata
export interface TwitterVideoMetadata {
  // ... existing fields ...
  hasMultipleVideos?: boolean;  // NEW
  allVideos?: TwitterVideoInfo[];  // NEW - array of all videos
}
```

#### 2. `src/services/twitterService.ts`
**Changes**: Modified to detect and return ALL videos instead of just the first one

```typescript
// BEFORE: Found only first video
const videoMedia = data.media_extended.find(
  (m) => m.type === 'video' || m.type === 'gif'
);

// AFTER: Get all videos
const allVideoMedia = data.media_extended.filter(
  (m) => m.type === 'video' || m.type === 'gif'
);

const hasMultipleVideos = allVideoMedia.length > 1;

// Build array of all videos
const allVideos = allVideoMedia.map((media) => ({ ... }));
```

**Location**: src/services/twitterService.ts:47-77

#### 3. `src/utils/videoSelectionContext.ts` (NEW FILE - 132 lines)
**Purpose**: Manages Redis-based context for video selection flow

**Key Functions**:

```typescript
// Save context to Redis with 5min TTL
export async function saveVideoSelectionContext(
  userNumber: string,
  context: Omit<VideoSelectionContext, 'expiresAt'>
): Promise<void>

// Retrieve context
export async function getVideoSelectionContext(
  userNumber: string
): Promise<VideoSelectionContext | null>

// Process numeric response (1, 2, 3...) or cancel
export function processVideoSelectionResponse(
  response: string,
  videoCount: number
): number | 'invalid' | 'cancel'

// Clear context
export async function clearVideoSelectionContext(
  userNumber: string
): Promise<void>
```

**Redis Schema**:
- Key: `video_selection:{userNumber}`
- TTL: 300 seconds (5 minutes)
- Value: JSON stringified VideoSelectionContext

#### 4. `src/services/messageService.ts`
**Changes**: Added video selection message function

```typescript
export async function sendVideoSelectionMessage(
  userNumber: string,
  userName: string,
  videos: Array<{
    url: string;
    duration?: number;
    durationSec?: number;
    resolution: string;
    type: 'video' | 'gif';
  }>,
  remainingDownloads: number
): Promise<void>
```

**Message Format**:
```
Oi, {userName}!

Este tweet tem {N} vídeos disponíveis.

Por favor, escolha qual você quer baixar:

1. Vídeo - 15.0s - 1920x1080
2. Vídeo - 10.0s - 1280x720
3. GIF - 5.0s - 640x480

Responda com o número do vídeo que deseja (1-3) ou "cancelar" para desistir.

⏱️ Aguardando sua resposta...
```

**Location**: src/services/messageService.ts:417-469

#### 5. `src/worker.ts`
**Changes**: Modified Twitter video worker to detect multiple videos and initiate selection flow

**Flow**:
1. Get video metadata first (before downloading)
2. Check if `hasMultipleVideos` is true
3. If yes:
   - Save video selection context to Redis
   - Send selection message to user
   - Return (don't download yet)
4. If no:
   - Proceed with normal download flow

**Location**: src/worker.ts:260-308

#### 6. `src/routes/webhook.ts`
**Changes**: Added video selection response handling

**New Logic** (before ignoring "other" messages):
1. Check if user has pending video selection context
2. If yes, process their response:
   - Parse selection number (1, 2, 3...)
   - Validate selection
   - Download selected video
   - Upload to Supabase
   - Send video to user
   - Save metadata
   - Increment download count
   - Clear context
3. If no, continue with existing logic

**Location**: src/routes/webhook.ts:102-255

### Files Created

#### 1. `scripts/test-video-selection.ts` (NEW - 204 lines)
**Purpose**: Comprehensive test script for video selection system

**Tests**:
- ✅ Video detection with mock data
- ✅ Context saving to Redis
- ✅ Context retrieval from Redis
- ✅ Response parsing (valid, invalid, cancel)
- ✅ Context clearing
- ✅ Redis TTL verification

**Test Results**: All tests passed ✅

## User Flow

### Scenario 1: Tweet with Multiple Videos

1. **User sends Twitter URL** with multiple videos
   ```
   https://x.com/user/status/123456789
   ```

2. **System detects multiple videos**
   - Worker gets metadata
   - Detects `hasMultipleVideos: true`
   - Saves context to Redis

3. **System sends selection message**
   ```
   Oi, Paulo!

   Este tweet tem 3 vídeos disponíveis.

   Por favor, escolha qual você quer baixar:

   1. Vídeo - 15.0s - 1920x1080
   2. Vídeo - 10.0s - 1280x720
   3. Vídeo - 20.0s - 1920x1080

   Responda com o número do vídeo que deseja (1-3) ou "cancelar" para desistir.

   ⏱️ Aguardando sua resposta...
   ```

4. **User responds with selection**
   - Valid: `"2"` → Downloads video 2
   - Invalid: `"5"` → Error message asking for valid number
   - Cancel: `"cancelar"` → Cancels and clears context

5. **System downloads and sends selected video**
   ```
   Baixando vídeo 2...

   [Video sent]

   🐦 Vídeo 2 do Twitter baixado!

   📊 Informações:
   • Autor: @username
   • Duração: 10.0s
   • Resolução: 1280x720
   • Tamanho: 5.32 MB
   ```

### Scenario 2: Tweet with Single Video

1. **User sends Twitter URL** with single video
2. **System detects single video**
   - Worker gets metadata
   - Detects `hasMultipleVideos: false`
3. **System downloads immediately** (existing behavior)
   - No selection message
   - Downloads and sends video automatically

## Response Validation

The `processVideoSelectionResponse()` function handles:

| User Input | Result | Action |
|------------|--------|--------|
| `"1"` | `1` | Download video 1 |
| `"2"` | `2` | Download video 2 |
| `"3"` | `3` | Download video 3 |
| `"4"` | `'invalid'` | Error message (out of range) |
| `"0"` | `'invalid'` | Error message (out of range) |
| `"cancelar"` | `'cancel'` | Cancel download |
| `"cancel"` | `'cancel'` | Cancel download |
| `"não"` | `'cancel'` | Cancel download |
| `"nao"` | `'cancel'` | Cancel download |
| `"n"` | `'cancel'` | Cancel download |
| `"abc"` | `'invalid'` | Error message |
| `""` | `'invalid'` | Error message |

**Location**: src/utils/videoSelectionContext.ts:102-123

## Redis Context

**Key Pattern**: `video_selection:{userNumber}`

**TTL**: 300 seconds (5 minutes)

**Data Structure**:
```typescript
{
  state: 'awaiting_video_selection',
  tweetId: string,
  username: string,
  metadata: TwitterVideoMetadata,  // Full metadata including all videos
  userNumber: string,
  userName: string,
  expiresAt: number  // Unix timestamp
}
```

## Error Handling

1. **Invalid Selection**: User enters invalid number or text
   - Response: "Resposta inválida. Por favor, responda com um número de 1 a 3 ou 'cancelar'."
   - Context: Remains active, user can try again

2. **Selection Timeout**: Context expires after 5 minutes
   - Redis automatically deletes context
   - Next message from user is treated as new interaction

3. **Download Failure**: Error downloading selected video
   - Response: Error message with details
   - Context: Not cleared, user can try again

4. **Video Not Found**: Selected video not in metadata
   - Response: "Erro ao encontrar o vídeo selecionado."
   - Context: Cleared

## Architecture Decisions

### Why Redis for Context?
- ✅ **TTL Support**: Automatic expiration after 5 minutes
- ✅ **Fast Access**: Quick lookups for every user message
- ✅ **Scalability**: Handles multiple concurrent users
- ✅ **Existing Infrastructure**: Already using Redis for BullMQ

### Why Check Before Download?
- ✅ **Better UX**: User knows immediately if multiple videos exist
- ✅ **Resource Efficiency**: Don't download unwanted videos
- ✅ **Bandwidth Savings**: Only download what user wants

### Why 5-Minute TTL?
- ✅ **User-Friendly**: Enough time to read and respond
- ✅ **Memory Efficient**: Cleans up abandoned sessions
- ✅ **Prevents Confusion**: Old contexts don't interfere with new tweets

## Testing

### Automated Tests
Run: `npx tsx scripts/test-video-selection.ts`

**Results**:
```
✅ Video selection context management works
✅ Response parsing works correctly
✅ Redis TTL and expiration work
```

### Manual Testing Steps

1. **Find a tweet with multiple videos** (or create test data)
2. **Send Twitter URL** via WhatsApp
3. **Verify selection message** appears with all videos listed
4. **Test valid selection**: Send "1", "2", or "3"
5. **Verify video download**: Should download and send selected video
6. **Test invalid selection**: Send "5" or "abc"
7. **Verify error message**: Should ask for valid number
8. **Test cancel**: Send "cancelar"
9. **Verify cancellation**: Should cancel and clear context

## Database Schema

No changes to database schema required. Uses existing `twitter_downloads` table.

The selected video is saved with the same structure as single-video downloads.

## Logging

Enhanced logging for video selection:

```typescript
// When multiple videos detected
logger.info({
  msg: 'Tweet has multiple videos, requesting user selection',
  jobId: job.id,
  videoCount: metadata.allVideos.length,
});

// When user makes selection
logger.info({
  msg: 'User selected video',
  userNumber,
  selection: selectionResult,
  videoUrl: selectedVideo.url,
});

// When selection completed
logger.info({
  msg: 'Selected video downloaded and sent successfully',
  userNumber,
  selection: selectionResult,
});
```

## Performance Impact

- **Minimal**: Extra Redis lookup on text messages (~1ms)
- **Efficient**: No unnecessary downloads
- **Scalable**: Redis handles thousands of concurrent users

## Future Enhancements

Potential improvements:

1. **Thumbnail Preview**: Send video thumbnails with selection message
2. **Video Quality Selection**: Let user choose quality (720p, 1080p, etc.)
3. **Batch Download**: Allow downloading multiple videos from same tweet
4. **Selection History**: Remember user preferences for auto-selection
5. **Analytics**: Track which videos users select most often

## Related Files

- `src/types/twitter.ts` - Type definitions
- `src/services/twitterService.ts` - Video metadata fetching
- `src/utils/videoSelectionContext.ts` - Context management
- `src/services/messageService.ts` - User messages
- `src/worker.ts` - Background processing
- `src/routes/webhook.ts` - Webhook handler
- `scripts/test-video-selection.ts` - Test script

## Summary

✅ **Complete video selection system implemented**
✅ **All tests passing**
✅ **Build successful with no errors**
✅ **Ready for production deployment**

The system provides a seamless experience for users downloading videos from tweets with multiple videos, while maintaining backward compatibility with single-video tweets.
