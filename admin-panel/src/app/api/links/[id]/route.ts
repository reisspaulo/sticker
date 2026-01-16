import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const SHORT_URL_BASE = 'https://fig.ytem.com.br/l'

interface UpdateLinkBody {
  original_url?: string
  title?: string
  short_code?: string
  is_active?: boolean
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_content?: string
}

/**
 * GET /api/links/[id]
 * Get link details with stats
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get link
    const { data: link, error } = await supabase
      .from('url_links')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !link) {
      return NextResponse.json(
        { error: 'Link não encontrado' },
        { status: 404 }
      )
    }

    // Get clicks stats
    const { data: clicks } = await supabase
      .from('url_clicks')
      .select('clicked_at, device_type, country_code, city, browser, os')
      .eq('link_id', id)
      .order('clicked_at', { ascending: false })
      .limit(100)

    // Calculate stats
    const now = new Date()
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const clicks24h = (clicks || []).filter(c => new Date(c.clicked_at) >= last24h).length
    const clicks7d = (clicks || []).filter(c => new Date(c.clicked_at) >= last7d).length

    // Device distribution
    const devices: Record<string, number> = { mobile: 0, desktop: 0, tablet: 0 }
    ;(clicks || []).forEach(c => {
      if (c.device_type && devices[c.device_type] !== undefined) {
        devices[c.device_type]++
      }
    })

    // Country distribution
    const countries: Record<string, number> = {}
    ;(clicks || []).forEach(c => {
      if (c.country_code) {
        countries[c.country_code] = (countries[c.country_code] || 0) + 1
      }
    })

    // Browser distribution
    const browsers: Record<string, number> = {}
    ;(clicks || []).forEach(c => {
      if (c.browser) {
        browsers[c.browser] = (browsers[c.browser] || 0) + 1
      }
    })

    return NextResponse.json({
      link: {
        ...link,
        short_url: `${SHORT_URL_BASE}/${link.short_code}`,
      },
      stats: {
        total_clicks: link.clicks_count || 0,
        clicks_24h: clicks24h,
        clicks_7d: clicks7d,
        devices,
        countries,
        browsers,
      },
      recent_clicks: (clicks || []).slice(0, 20),
    })
  } catch (error) {
    console.error('Error fetching link:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Falha ao buscar link' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/links/[id]
 * Update a link
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body: UpdateLinkBody = await request.json()
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verify link exists
    const { data: existingLink, error: fetchError } = await supabase
      .from('url_links')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !existingLink) {
      return NextResponse.json(
        { error: 'Link não encontrado' },
        { status: 404 }
      )
    }

    // Build update object
    const allowedFields = [
      'original_url',
      'title',
      'short_code',
      'is_active',
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_content',
    ]

    const updateData: Record<string, unknown> = {}

    for (const field of allowedFields) {
      if (field in body) {
        let value = body[field as keyof UpdateLinkBody]

        // Lowercase short_code
        if (field === 'short_code' && typeof value === 'string') {
          value = value.toLowerCase()

          // Validate format
          if (!/^[a-z0-9-]{3,20}$/.test(value)) {
            return NextResponse.json(
              { error: 'Código curto inválido' },
              { status: 400 }
            )
          }

          // Check if already in use by another link
          const { data: existing } = await supabase
            .from('url_links')
            .select('id')
            .eq('short_code', value)
            .neq('id', id)
            .single()

          if (existing) {
            return NextResponse.json(
              { error: 'Este código já está em uso' },
              { status: 409 }
            )
          }
        }

        // Validate URL if provided
        if (field === 'original_url' && typeof value === 'string') {
          try {
            new URL(value)
          } catch {
            return NextResponse.json(
              { error: 'Formato de URL inválido' },
              { status: 400 }
            )
          }
        }

        updateData[field] = value
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Nenhuma alteração',
        link: {
          ...existingLink,
          short_url: `${SHORT_URL_BASE}/${existingLink.short_code}`,
        },
      })
    }

    // Update link
    const { data: updatedLink, error: updateError } = await supabase
      .from('url_links')
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      throw updateError
    }

    return NextResponse.json({
      success: true,
      link: {
        ...updatedLink,
        short_url: `${SHORT_URL_BASE}/${updatedLink.short_code}`,
      },
    })
  } catch (error) {
    console.error('Error updating link:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Falha ao atualizar link' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/links/[id]
 * Soft delete a link (set is_active to false)
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { error } = await supabase
      .from('url_links')
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      message: 'Link desativado',
    })
  } catch (error) {
    console.error('Error deleting link:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Falha ao excluir link' },
      { status: 500 }
    )
  }
}
