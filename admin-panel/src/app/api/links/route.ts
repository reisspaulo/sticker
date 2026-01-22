import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Base URL for short links
const SHORT_URL_BASE = 'https://your-shortener.com/l'

interface CreateLinkBody {
  original_url: string
  title?: string
  short_code?: string
  campaign_id?: string
  step_id?: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_content?: string
}

/**
 * GET /api/links
 * List all links with pagination
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const search = searchParams.get('search') || ''
    const campaignId = searchParams.get('campaign_id') || ''

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const offset = (page - 1) * limit

    let query = supabase
      .from('url_links')
      .select('*', { count: 'exact' })

    // Apply search filter
    if (search) {
      query = query.or(`title.ilike.%${search}%,short_code.ilike.%${search}%,original_url.ilike.%${search}%`)
    }

    // Apply campaign filter
    if (campaignId) {
      query = query.eq('campaign_id', campaignId)
    }

    // Apply pagination and sorting
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data: links, error, count } = await query

    if (error) {
      throw error
    }

    // Add short_url to each link
    const linksWithUrls = (links || []).map((link) => ({
      ...link,
      short_url: `${SHORT_URL_BASE}/${link.short_code}`,
    }))

    // Get overview stats
    const { count: totalLinks } = await supabase
      .from('url_links')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)

    const { data: clicksData } = await supabase
      .from('url_links')
      .select('clicks_count')
      .eq('is_active', true)

    const totalClicks = (clicksData || []).reduce((sum, link) => sum + (link.clicks_count || 0), 0)

    // Clicks today
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const { count: clicksToday } = await supabase
      .from('url_clicks')
      .select('*', { count: 'exact', head: true })
      .gte('clicked_at', today.toISOString())

    return NextResponse.json({
      links: linksWithUrls,
      total: count || 0,
      page,
      limit,
      stats: {
        total_links: totalLinks || 0,
        total_clicks: totalClicks,
        clicks_today: clicksToday || 0,
      },
    })
  } catch (error) {
    console.error('Error fetching links:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Falha ao buscar links' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/links
 * Create a new link
 */
export async function POST(request: Request) {
  try {
    const body: CreateLinkBody = await request.json()

    if (!body.original_url) {
      return NextResponse.json(
        { error: 'URL original é obrigatória' },
        { status: 400 }
      )
    }

    // Validate URL format
    try {
      new URL(body.original_url)
    } catch {
      return NextResponse.json(
        { error: 'Formato de URL inválido' },
        { status: 400 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Generate short code if not provided
    let shortCode = body.short_code?.toLowerCase()
    if (!shortCode) {
      // Generate random code
      const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
      shortCode = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
    }

    // Validate short code format
    if (!/^[a-z0-9-]{3,20}$/.test(shortCode)) {
      return NextResponse.json(
        { error: 'Código curto inválido (3-20 caracteres, apenas letras, números e hífens)' },
        { status: 400 }
      )
    }

    // Check if code already exists
    const { data: existing } = await supabase
      .from('url_links')
      .select('id')
      .eq('short_code', shortCode)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'Este código já está em uso' },
        { status: 409 }
      )
    }

    // Insert link
    const { data: link, error } = await supabase
      .from('url_links')
      .insert({
        short_code: shortCode,
        original_url: body.original_url,
        title: body.title || null,
        campaign_id: body.campaign_id || null,
        step_id: body.step_id || null,
        utm_source: body.utm_source || null,
        utm_medium: body.utm_medium || null,
        utm_campaign: body.utm_campaign || null,
        utm_content: body.utm_content || null,
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      link: {
        ...link,
        short_url: `${SHORT_URL_BASE}/${link.short_code}`,
      },
    })
  } catch (error) {
    console.error('Error creating link:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Falha ao criar link' },
      { status: 500 }
    )
  }
}
