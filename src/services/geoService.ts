import logger from '../config/logger';
import type { GeoInfo } from '../types/links';

// MaxMind GeoLite2 integration
// Note: Requires downloading GeoLite2-City.mmdb from MaxMind
// For now, we use a simple IP-based geo lookup via free API as fallback

let maxmindReader: any = null;

/**
 * Initialize MaxMind GeoLite2 database
 * Call this on server startup
 */
export async function initGeoService(): Promise<void> {
  try {
    // Try to load MaxMind database if available
    const maxmind = await import('maxmind');
    const path = await import('path');
    const fs = await import('fs');

    const dbPath = path.join(process.cwd(), 'data', 'GeoLite2-City.mmdb');

    if (fs.existsSync(dbPath)) {
      maxmindReader = await maxmind.open(dbPath);
      logger.info({ msg: 'MaxMind GeoLite2 database loaded', path: dbPath });
    } else {
      logger.warn({
        msg: 'MaxMind GeoLite2 database not found, geo lookup will be limited',
        expectedPath: dbPath,
      });
    }
  } catch (error) {
    logger.warn({
      msg: 'Failed to initialize MaxMind, geo lookup will be limited',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Get geo information from IP address
 * Uses MaxMind if available, otherwise returns null
 * @param ip IP address
 * @returns GeoInfo or null
 */
export function getGeoFromIP(ip: string): GeoInfo | null {
  // Skip private/local IPs
  if (isPrivateIP(ip)) {
    return null;
  }

  // Use MaxMind if available
  if (maxmindReader) {
    try {
      const result = maxmindReader.get(ip);
      if (result) {
        return {
          country_code: result.country?.iso_code || null,
          country_name: result.country?.names?.en || null,
          city: result.city?.names?.en || null,
        };
      }
    } catch (error) {
      logger.debug({
        msg: 'MaxMind lookup failed',
        ip,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return null;
}

/**
 * Get geo information asynchronously (for background processing)
 * Uses external API as fallback if MaxMind not available
 * @param ip IP address
 * @returns Promise<GeoInfo | null>
 */
export async function getGeoFromIPAsync(ip: string): Promise<GeoInfo | null> {
  // First try local MaxMind
  const localResult = getGeoFromIP(ip);
  if (localResult) {
    return localResult;
  }

  // Skip private IPs for external lookup
  if (isPrivateIP(ip)) {
    return null;
  }

  // Fallback to free IP-API (limited to 45 req/min)
  try {
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=countryCode,country,city`);

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as {
      status?: string;
      countryCode?: string;
      country?: string;
      city?: string;
    };

    if (data.status === 'fail') {
      return null;
    }

    return {
      country_code: data.countryCode || null,
      country_name: data.country || null,
      city: data.city || null,
    };
  } catch (error) {
    logger.debug({
      msg: 'IP-API lookup failed',
      ip,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

/**
 * Check if IP is private/local
 */
function isPrivateIP(ip: string): boolean {
  // IPv4 private ranges
  const privateRanges = [
    /^10\./,
    /^172\.(1[6-9]|2\d|3[0-1])\./,
    /^192\.168\./,
    /^127\./,
    /^localhost$/i,
    /^::1$/,
    /^fc00:/i,
    /^fe80:/i,
  ];

  return privateRanges.some((range) => range.test(ip));
}

/**
 * Check if MaxMind is initialized
 */
export function isMaxMindInitialized(): boolean {
  return maxmindReader !== null;
}
