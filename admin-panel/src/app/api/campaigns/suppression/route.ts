import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * GET /api/campaigns/suppression
 * List suppression list
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const reason = searchParams.get('reason')

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    let query = supabase
      .from('campaign_suppression_list')
      .select('*', { count: 'exact' })
      .order('added_at', { ascending: false })

    if (reason) {
      query = query.eq('reason', reason)
    }

    const { data: suppressions, error, count } = await query

    if (error) {
      throw error
    }

    return NextResponse.json({
      suppressions: suppressions || [],
      total: count || 0,
    })
  } catch (error) {
    console.error('Error fetching suppression list:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch suppression list' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/campaigns/suppression
 * Add number to suppression list
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { whatsapp_number, reason, description, expires_at, admin_email } = body

    if (!whatsapp_number || !reason) {
      return NextResponse.json(
        { error: 'whatsapp_number and reason are required' },
        { status: 400 }
      )
    }

    const validReasons = ['legal', 'complaint', 'vip', 'test', 'partner', 'other']
    if (!validReasons.includes(reason)) {
      return NextResponse.json(
        { error: `reason must be one of: ${validReasons.join(', ')}` },
        { status: 400 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: suppression, error } = await supabase
      .from('campaign_suppression_list')
      .insert({
        whatsapp_number,
        reason,
        description,
        expires_at: expires_at || null,
        added_by: admin_email || 'admin',
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Este número já está na lista de supressão' },
          { status: 409 }
        )
      }
      throw error
    }

    // Also cancel any active campaigns for this number
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('whatsapp_number', whatsapp_number)
      .single()

    if (user?.id) {
      await supabase
        .from('user_campaigns')
        .update({
          status: 'cancelled',
          cancel_reason: 'suppression_list',
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .in('status', ['active', 'pending'])
    }

    return NextResponse.json({
      success: true,
      suppression,
    })
  } catch (error) {
    console.error('Error adding to suppression list:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to add to suppression list' },
      { status: 500 }
    )
  }
}
