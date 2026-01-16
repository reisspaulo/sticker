import { supabase } from '../config/supabase';
import logger from '../config/logger';
import { generateUniqueCode, isValidCode, isCodeAvailable } from '../utils/shortCodeGenerator';
import type {
  UrlLink,
  CreateLinkInput,
  UpdateLinkInput,
  LinkWithStats,
  LinkStats,
} from '../types/links';

// Base URL for short links (includes /l prefix for redirect route)
const SHORT_URL_BASE = process.env.SHORT_URL_BASE || 'https://fig.ytem.com.br/l';

/**
 * Create a new tracked link
 */
export async function createLink(input: CreateLinkInput): Promise<LinkWithStats> {
  try {
    // Validate URL
    try {
      new URL(input.original_url);
    } catch {
      throw new Error('Invalid URL format');
    }

    // Handle short code
    let shortCode: string;
    if (input.short_code) {
      // Validate custom code
      if (!isValidCode(input.short_code)) {
        throw new Error('Invalid short code format (3-12 chars, alphanumeric and hyphens only)');
      }

      // Check availability
      const available = await isCodeAvailable(input.short_code);
      if (!available) {
        throw new Error('Short code already in use');
      }

      shortCode = input.short_code.toLowerCase();
    } else {
      // Generate unique code
      shortCode = await generateUniqueCode();
    }

    // Insert link
    const { data: link, error } = await supabase
      .from('url_links')
      .insert({
        short_code: shortCode,
        original_url: input.original_url,
        title: input.title || null,
        campaign_id: input.campaign_id || null,
        step_id: input.step_id || null,
        utm_source: input.utm_source || null,
        utm_medium: input.utm_medium || null,
        utm_campaign: input.utm_campaign || null,
        utm_content: input.utm_content || null,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    logger.info({
      msg: 'Link created',
      linkId: link.id,
      shortCode: link.short_code,
      originalUrl: link.original_url,
    });

    return {
      ...link,
      short_url: `${SHORT_URL_BASE}/${link.short_code}`,
    };
  } catch (error) {
    logger.error({
      msg: 'Error creating link',
      error: error instanceof Error ? error.message : 'Unknown error',
      input,
    });
    throw error;
  }
}

/**
 * Get link by ID with stats
 */
export async function getLinkById(id: string): Promise<LinkWithStats | null> {
  try {
    const { data: link, error } = await supabase
      .from('url_links')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return {
      ...link,
      short_url: `${SHORT_URL_BASE}/${link.short_code}`,
    };
  } catch (error) {
    logger.error({
      msg: 'Error getting link by ID',
      error: error instanceof Error ? error.message : 'Unknown error',
      id,
    });
    throw error;
  }
}

/**
 * Get link by short code
 */
export async function getLinkByCode(code: string): Promise<UrlLink | null> {
  try {
    const { data: link, error } = await supabase
      .from('url_links')
      .select('*')
      .eq('short_code', code.toLowerCase())
      .eq('is_active', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return link;
  } catch (error) {
    logger.error({
      msg: 'Error getting link by code',
      error: error instanceof Error ? error.message : 'Unknown error',
      code,
    });
    throw error;
  }
}

/**
 * List links with pagination and filters
 */
export async function listLinks(options: {
  page?: number;
  limit?: number;
  search?: string;
  campaign_id?: string;
  sort?: 'clicks_count' | 'created_at';
  order?: 'asc' | 'desc';
}): Promise<{ links: LinkWithStats[]; total: number }> {
  try {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const offset = (page - 1) * limit;
    const sort = options.sort || 'created_at';
    const order = options.order || 'desc';

    let query = supabase.from('url_links').select('*', { count: 'exact' });

    // Apply filters
    if (options.search) {
      query = query.or(`title.ilike.%${options.search}%,short_code.ilike.%${options.search}%`);
    }

    if (options.campaign_id) {
      query = query.eq('campaign_id', options.campaign_id);
    }

    // Apply sorting and pagination
    query = query
      .order(sort, { ascending: order === 'asc' })
      .range(offset, offset + limit - 1);

    const { data: links, error, count } = await query;

    if (error) {
      throw error;
    }

    const linksWithUrls = (links || []).map((link) => ({
      ...link,
      short_url: `${SHORT_URL_BASE}/${link.short_code}`,
    }));

    return {
      links: linksWithUrls,
      total: count || 0,
    };
  } catch (error) {
    logger.error({
      msg: 'Error listing links',
      error: error instanceof Error ? error.message : 'Unknown error',
      options,
    });
    throw error;
  }
}

/**
 * Update a link
 */
export async function updateLink(id: string, input: UpdateLinkInput): Promise<LinkWithStats> {
  try {
    // If updating short code, validate and check availability
    if (input.short_code) {
      if (!isValidCode(input.short_code)) {
        throw new Error('Invalid short code format');
      }

      // Check if code is available (excluding current link)
      const { data: existing } = await supabase
        .from('url_links')
        .select('id')
        .eq('short_code', input.short_code.toLowerCase())
        .neq('id', id)
        .single();

      if (existing) {
        throw new Error('Short code already in use');
      }

      input.short_code = input.short_code.toLowerCase();
    }

    const { data: link, error } = await supabase
      .from('url_links')
      .update({
        ...input,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    logger.info({
      msg: 'Link updated',
      linkId: id,
      updates: input,
    });

    return {
      ...link,
      short_url: `${SHORT_URL_BASE}/${link.short_code}`,
    };
  } catch (error) {
    logger.error({
      msg: 'Error updating link',
      error: error instanceof Error ? error.message : 'Unknown error',
      id,
      input,
    });
    throw error;
  }
}

/**
 * Delete (deactivate) a link
 */
export async function deleteLink(id: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('url_links')
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      throw error;
    }

    logger.info({
      msg: 'Link deactivated',
      linkId: id,
    });
  } catch (error) {
    logger.error({
      msg: 'Error deleting link',
      error: error instanceof Error ? error.message : 'Unknown error',
      id,
    });
    throw error;
  }
}

/**
 * Get link statistics
 */
export async function getLinkStats(id: string, days: number = 30): Promise<LinkStats> {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get clicks by day
    const { data: clicksByDay, error: clicksError } = await supabase
      .from('url_clicks')
      .select('clicked_at')
      .eq('link_id', id)
      .gte('clicked_at', startDate.toISOString())
      .order('clicked_at', { ascending: true });

    if (clicksError) {
      throw clicksError;
    }

    // Aggregate clicks by day
    const clicksMap: Record<string, number> = {};
    (clicksByDay || []).forEach((click) => {
      const date = click.clicked_at.split('T')[0];
      clicksMap[date] = (clicksMap[date] || 0) + 1;
    });

    const clicks_by_day = Object.entries(clicksMap).map(([date, clicks]) => ({
      date,
      clicks,
    }));

    // Get device distribution
    const { data: deviceData, error: deviceError } = await supabase
      .from('url_clicks')
      .select('device_type')
      .eq('link_id', id)
      .not('device_type', 'is', null);

    if (deviceError) {
      throw deviceError;
    }

    const devices: Record<string, number> = { mobile: 0, desktop: 0, tablet: 0 };
    (deviceData || []).forEach((click) => {
      if (click.device_type) {
        devices[click.device_type] = (devices[click.device_type] || 0) + 1;
      }
    });

    // Get country distribution
    const { data: countryData, error: countryError } = await supabase
      .from('url_clicks')
      .select('country_code')
      .eq('link_id', id)
      .not('country_code', 'is', null);

    if (countryError) {
      throw countryError;
    }

    const countryCounts: Record<string, number> = {};
    (countryData || []).forEach((click) => {
      if (click.country_code) {
        countryCounts[click.country_code] = (countryCounts[click.country_code] || 0) + 1;
      }
    });

    // Get top 5 countries + "other"
    const sortedCountries = Object.entries(countryCounts)
      .sort((a, b) => b[1] - a[1]);

    const countries: Record<string, number> = {};
    let otherCount = 0;
    sortedCountries.forEach(([code, count], index) => {
      if (index < 5) {
        countries[code] = count;
      } else {
        otherCount += count;
      }
    });
    if (otherCount > 0) {
      countries['other'] = otherCount;
    }

    // Get recent clicks
    const { data: recentData, error: recentError } = await supabase
      .from('url_clicks')
      .select('clicked_at, device_type, country_code, city')
      .eq('link_id', id)
      .order('clicked_at', { ascending: false })
      .limit(50);

    if (recentError) {
      throw recentError;
    }

    // Get total clicks
    const { count: totalClicks, error: totalError } = await supabase
      .from('url_clicks')
      .select('*', { count: 'exact', head: true })
      .eq('link_id', id);

    if (totalError) {
      throw totalError;
    }

    return {
      total_clicks: totalClicks || 0,
      clicks_by_day,
      devices: devices as Record<'mobile' | 'desktop' | 'tablet', number>,
      countries,
      recent_clicks: recentData || [],
    };
  } catch (error) {
    logger.error({
      msg: 'Error getting link stats',
      error: error instanceof Error ? error.message : 'Unknown error',
      id,
    });
    throw error;
  }
}

/**
 * Get overview stats for all links
 */
export async function getLinksOverview(): Promise<{
  total_links: number;
  total_clicks: number;
  clicks_today: number;
  top_link: LinkWithStats | null;
}> {
  try {
    // Total links
    const { count: totalLinks } = await supabase
      .from('url_links')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    // Total clicks (sum of all clicks_count)
    const { data: linksData } = await supabase
      .from('url_links')
      .select('clicks_count')
      .eq('is_active', true);

    const totalClicks = (linksData || []).reduce((sum, link) => sum + link.clicks_count, 0);

    // Clicks today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { count: clicksToday } = await supabase
      .from('url_clicks')
      .select('*', { count: 'exact', head: true })
      .gte('clicked_at', today.toISOString());

    // Top link by clicks
    const { data: topLinkData } = await supabase
      .from('url_links')
      .select('*')
      .eq('is_active', true)
      .order('clicks_count', { ascending: false })
      .limit(1)
      .single();

    const topLink = topLinkData
      ? {
          ...topLinkData,
          short_url: `${SHORT_URL_BASE}/${topLinkData.short_code}`,
        }
      : null;

    return {
      total_links: totalLinks || 0,
      total_clicks: totalClicks,
      clicks_today: clicksToday || 0,
      top_link: topLink,
    };
  } catch (error) {
    logger.error({
      msg: 'Error getting links overview',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}
