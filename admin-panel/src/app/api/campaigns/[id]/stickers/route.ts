import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * GET /api/campaigns/[id]/stickers
 * List stickers linked to a campaign
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: linkedStickers, error } = await supabase
      .from('campaign_sticker_pool')
      .select(`
        id,
        step_key,
        priority,
        sticker:bot_stickers(id, name, sticker_url, category, is_animated, usage_count)
      `)
      .eq('campaign_id', id)
      .order('priority', { ascending: true })

    if (error) {
      throw error
    }

    return NextResponse.json({
      stickers: linkedStickers || [],
      total: linkedStickers?.length || 0,
    })
  } catch (error) {
    console.error('Error fetching campaign stickers:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch stickers' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/campaigns/[id]/stickers
 * Link a sticker to a campaign
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { sticker_id, step_key, priority } = body

    if (!sticker_id) {
      return NextResponse.json(
        { error: 'sticker_id is required' },
        { status: 400 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verify campaign exists
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('id')
      .eq('id', id)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      )
    }

    // Link sticker to campaign
    const { data: link, error } = await supabase
      .from('campaign_sticker_pool')
      .insert({
        campaign_id: id,
        sticker_id,
        step_key: step_key || null,
        priority: priority || 0,
      })
      .select(`
        id,
        step_key,
        priority,
        sticker:bot_stickers(id, name, sticker_url, category, is_animated)
      `)
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'This sticker is already linked to this campaign for this step' },
          { status: 400 }
        )
      }
      throw error
    }

    return NextResponse.json({
      success: true,
      link,
    })
  } catch (error) {
    console.error('Error linking sticker:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to link sticker' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/campaigns/[id]/stickers
 * Unlink a sticker from a campaign
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const linkId = searchParams.get('link_id')
    const stickerId = searchParams.get('sticker_id')

    if (!linkId && !stickerId) {
      return NextResponse.json(
        { error: 'link_id or sticker_id is required' },
        { status: 400 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    let query = supabase
      .from('campaign_sticker_pool')
      .delete()
      .eq('campaign_id', id)

    if (linkId) {
      query = query.eq('id', linkId)
    } else if (stickerId) {
      query = query.eq('sticker_id', stickerId)
    }

    const { error } = await query

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      message: 'Sticker unlinked from campaign',
    })
  } catch (error) {
    console.error('Error unlinking sticker:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to unlink sticker' },
      { status: 500 }
    )
  }
}
