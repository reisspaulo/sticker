/**
 * URL Detector for Twitter/X URLs
 * Detects and validates Twitter/X URLs in messages
 */

export interface TweetInfo {
  username: string;
  tweetId: string;
  originalUrl: string;
}

// Regex pattern to match Twitter/X URLs
// Matches:
// - https://twitter.com/username/status/1234567890
// - https://x.com/username/status/1234567890
// - https://x.com/username/status/1234567890?s=20
// - http://twitter.com/username/status/1234567890
// - http://x.com/username/status/1234567890
const TWITTER_URL_REGEX =
  /https?:\/\/(?:www\.)?(twitter|x)\.com\/([^/]+)\/status\/(\d+)(?:\?[^\s]*)?/i;

/**
 * Detects if a message contains a Twitter/X URL
 * @param text - The text to search for Twitter URLs
 * @returns The detected Twitter URL or null if not found
 */
export function detectTwitterUrl(text: string): string | null {
  if (!text || typeof text !== 'string') {
    return null;
  }

  const match = text.match(TWITTER_URL_REGEX);

  if (!match) {
    return null;
  }

  // Return the full matched URL
  return match[0];
}

/**
 * Extracts tweet information from a Twitter URL
 * @param url - The Twitter URL to parse
 * @returns TweetInfo object with username and tweet ID, or null if invalid
 */
export function extractTweetInfo(url: string): TweetInfo | null {
  if (!url || typeof url !== 'string') {
    return null;
  }

  const match = url.match(TWITTER_URL_REGEX);

  if (!match) {
    return null;
  }

  const [fullUrl, , username, tweetId] = match;

  // Validate that we have both username and tweetId
  if (!username || !tweetId) {
    return null;
  }

  return {
    username,
    tweetId,
    originalUrl: fullUrl,
  };
}

/**
 * Validates if a string is a valid Twitter/X URL
 * @param url - The URL to validate
 * @returns True if the URL is a valid Twitter/X URL
 */
export function isTwitterUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  return TWITTER_URL_REGEX.test(url);
}
