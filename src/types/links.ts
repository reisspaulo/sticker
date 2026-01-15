// Types for URL tracking system

export interface UrlLink {
  id: string;
  short_code: string;
  original_url: string;
  title: string | null;
  campaign_id: string | null;
  step_id: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  clicks_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UrlClick {
  id: string;
  link_id: string;
  clicked_at: string;
  ip_address: string | null;
  user_agent: string | null;
  referer: string | null;
  country_code: string | null;
  country_name: string | null;
  city: string | null;
  device_type: DeviceType | null;
  browser: string | null;
  os: string | null;
}

export type DeviceType = 'mobile' | 'desktop' | 'tablet';

export interface CreateLinkInput {
  original_url: string;
  title?: string;
  short_code?: string;
  campaign_id?: string;
  step_id?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
}

export interface UpdateLinkInput {
  title?: string;
  short_code?: string;
  is_active?: boolean;
}

export interface LinkWithStats extends UrlLink {
  short_url: string;
}

export interface LinkStats {
  total_clicks: number;
  clicks_by_day: { date: string; clicks: number }[];
  devices: Record<DeviceType, number>;
  countries: Record<string, number>;
  recent_clicks: RecentClick[];
}

export interface RecentClick {
  clicked_at: string;
  device_type: DeviceType | null;
  country_code: string | null;
  city: string | null;
}

export interface GeoInfo {
  country_code: string | null;
  country_name: string | null;
  city: string | null;
}

export interface DeviceInfo {
  device_type: DeviceType;
  browser: string | null;
  os: string | null;
}

export interface ClickData {
  link_id: string;
  ip_address: string | null;
  user_agent: string | null;
  referer: string | null;
}
