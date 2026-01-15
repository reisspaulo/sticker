import { supabase } from '../config/supabase';
import logger from '../config/logger';
import { UAParser } from 'ua-parser-js';
import { getGeoFromIPAsync } from './geoService';
import type { ClickData, DeviceInfo, DeviceType } from '../types/links';

/**
 * Record a click on a link
 * This is designed to be fast - geo lookup happens async
 */
export async function recordClick(data: ClickData): Promise<void> {
  try {
    // Parse user agent for device info
    const deviceInfo = parseUserAgent(data.user_agent);

    // Insert click with basic info immediately
    const { data: click, error } = await supabase
      .from('url_clicks')
      .insert({
        link_id: data.link_id,
        ip_address: data.ip_address,
        user_agent: data.user_agent,
        referer: data.referer,
        device_type: deviceInfo.device_type,
        browser: deviceInfo.browser,
        os: deviceInfo.os,
      })
      .select('id')
      .single();

    if (error) {
      throw error;
    }

    logger.debug({
      msg: 'Click recorded',
      clickId: click.id,
      linkId: data.link_id,
      deviceType: deviceInfo.device_type,
    });

    // Update geo info asynchronously (don't block the redirect)
    if (data.ip_address) {
      updateGeoInfo(click.id, data.ip_address).catch((err) => {
        logger.warn({
          msg: 'Failed to update geo info',
          clickId: click.id,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      });
    }
  } catch (error) {
    logger.error({
      msg: 'Error recording click',
      error: error instanceof Error ? error.message : 'Unknown error',
      data,
    });
    // Don't throw - we don't want to break the redirect
  }
}

/**
 * Update geo information for a click (called async)
 */
async function updateGeoInfo(clickId: string, ip: string): Promise<void> {
  const geoInfo = await getGeoFromIPAsync(ip);

  if (geoInfo) {
    await supabase
      .from('url_clicks')
      .update({
        country_code: geoInfo.country_code,
        country_name: geoInfo.country_name,
        city: geoInfo.city,
      })
      .eq('id', clickId);

    logger.debug({
      msg: 'Geo info updated',
      clickId,
      country: geoInfo.country_code,
      city: geoInfo.city,
    });
  }
}

/**
 * Parse user agent string to extract device info
 */
export function parseUserAgent(userAgent: string | null): DeviceInfo {
  if (!userAgent) {
    return {
      device_type: 'desktop',
      browser: null,
      os: null,
    };
  }

  const parser = new UAParser(userAgent);
  const result = parser.getResult();

  // Determine device type
  let deviceType: DeviceType = 'desktop';
  const deviceInfo = result.device;

  if (deviceInfo.type === 'mobile') {
    deviceType = 'mobile';
  } else if (deviceInfo.type === 'tablet') {
    deviceType = 'tablet';
  } else if (deviceInfo.type === 'console' || deviceInfo.type === 'smarttv') {
    deviceType = 'desktop'; // Treat as desktop
  } else {
    // Check OS for mobile indicators
    const os = result.os.name?.toLowerCase() || '';
    if (os.includes('android') || os.includes('ios')) {
      deviceType = 'mobile';
    }
  }

  return {
    device_type: deviceType,
    browser: result.browser.name || null,
    os: result.os.name || null,
  };
}

/**
 * Get the real IP from request headers
 */
export function getClientIP(request: {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
}): string | null {
  // Check X-Forwarded-For (common proxy header)
  const forwardedFor = request.headers['x-forwarded-for'];
  if (forwardedFor) {
    const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
    // Get the first IP (client IP)
    return ips.split(',')[0].trim();
  }

  // Check X-Real-IP (nginx)
  const realIp = request.headers['x-real-ip'];
  if (realIp) {
    return Array.isArray(realIp) ? realIp[0] : realIp;
  }

  // Check CF-Connecting-IP (Cloudflare)
  const cfIp = request.headers['cf-connecting-ip'];
  if (cfIp) {
    return Array.isArray(cfIp) ? cfIp[0] : cfIp;
  }

  // Fallback to request IP
  return request.ip || null;
}
