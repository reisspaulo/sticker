import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * GET /api/campaigns/[id]
 * Get campaign details with steps, messages, and analytics
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get campaign
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', id)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      )
    }

    // Get steps with messages
    const { data: steps, error: stepsError } = await supabase
      .from('campaign_steps')
      .select(`
        *,
        messages:campaign_messages(*)
      `)
      .eq('campaign_id', id)
      .order('step_order', { ascending: true })

    if (stepsError) {
      console.error('Error fetching steps:', stepsError)
    }

    // Get user counts by status
    const { data: userStats, error: userStatsError } = await supabase
      .from('user_campaigns')
      .select('status')
      .eq('campaign_id', id)

    if (userStatsError) {
      console.error('Error fetching user stats:', userStatsError)
    }

    const statusCounts = {
      total: userStats?.length || 0,
      active: userStats?.filter(u => u.status === 'active').length || 0,
      pending: userStats?.filter(u => u.status === 'pending').length || 0,
      completed: userStats?.filter(u => u.status === 'completed').length || 0,
      cancelled: userStats?.filter(u => u.status === 'cancelled').length || 0,
    }

    // Get recent events
    const { data: recentEvents, error: eventsError } = await supabase
      .from('campaign_events')
      .select(`
        *,
        user:users(whatsapp_number, name)
      `)
      .eq('campaign_id', id)
      .order('created_at', { ascending: false })
      .limit(20)

    if (eventsError) {
      console.error('Error fetching events:', eventsError)
    }

    // Get funnel data (users by current_step)
    const { data: funnelData, error: funnelError } = await supabase
      .from('user_campaigns')
      .select('current_step, status')
      .eq('campaign_id', id)

    if (funnelError) {
      console.error('Error fetching funnel data:', funnelError)
    }

    // Build funnel by step
    const funnel: Record<number, { total: number; active: number; completed: number }> = {}
    funnelData?.forEach(u => {
      const step = u.current_step || 0
      if (!funnel[step]) {
        funnel[step] = { total: 0, active: 0, completed: 0 }
      }
      funnel[step].total++
      if (u.status === 'active') funnel[step].active++
      if (u.status === 'completed') funnel[step].completed++
    })

    return NextResponse.json({
      campaign,
      steps: steps || [],
      stats: statusCounts,
      funnel,
      recentEvents: recentEvents || [],
    })
  } catch (error) {
    console.error('Error fetching campaign:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch campaign' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/campaigns/[id]
 * Update campaign status, settings, etc.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Allowed fields to update
    const allowedFields = [
      'status',
      'description',
      'priority',
      'settings',
      'scheduled_start_at',
      'scheduled_end_at',
      'updated_by',
    ]

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    for (const field of allowedFields) {
      if (field in body) {
        updateData[field] = body[field]
      }
    }

    const { data: campaign, error } = await supabase
      .from('campaigns')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      campaign,
    })
  } catch (error) {
    console.error('Error updating campaign:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update campaign' },
      { status: 500 }
    )
  }
}
