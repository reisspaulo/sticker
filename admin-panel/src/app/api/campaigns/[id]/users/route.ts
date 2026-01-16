import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * GET /api/campaigns/[id]/users
 * List users enrolled in a campaign with filters
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'all'
    const step = searchParams.get('step')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const offset = (page - 1) * limit

    // Build query
    let query = supabase
      .from('user_campaigns')
      .select(`
        *,
        user:users(id, whatsapp_number, name, subscription_plan, created_at)
      `, { count: 'exact' })
      .eq('campaign_id', id)

    // Apply filters
    if (status !== 'all') {
      query = query.eq('status', status)
    }

    if (step !== null && step !== '') {
      query = query.eq('current_step', parseInt(step))
    }

    // Search by phone or name
    if (search) {
      query = query.or(`user.whatsapp_number.ilike.%${search}%,user.name.ilike.%${search}%`)
    }

    // Order and paginate
    query = query
      .order('enrolled_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data: enrollments, error, count } = await query

    if (error) {
      throw error
    }

    return NextResponse.json({
      enrollments: enrollments || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    })
  } catch (error) {
    console.error('Error fetching campaign users:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch users' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/campaigns/[id]/users
 * Cancel a user's enrollment in a campaign
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')

    if (!userId) {
      return NextResponse.json(
        { error: 'user_id is required' },
        { status: 400 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Update user campaign status to cancelled
    const { data, error } = await supabase
      .from('user_campaigns')
      .update({
        status: 'cancelled',
        cancel_reason: 'admin_cancelled',
        completed_at: new Date().toISOString(),
      })
      .eq('campaign_id', id)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      throw error
    }

    // Log the event
    await supabase.from('campaign_events').insert({
      user_campaign_id: data.id,
      user_id: userId,
      campaign_id: id,
      event_type: 'cancelled',
      metadata: { reason: 'admin_cancelled', cancelled_by: 'admin' },
    })

    return NextResponse.json({
      success: true,
      message: 'User removed from campaign',
    })
  } catch (error) {
    console.error('Error cancelling enrollment:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to cancel enrollment' },
      { status: 500 }
    )
  }
}
