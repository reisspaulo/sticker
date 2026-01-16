import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * GET /api/campaigns/optouts
 * List all opt-outs
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    let query = supabase
      .from('campaign_optouts')
      .select(`
        *,
        user:users(name, whatsapp_number)
      `, { count: 'exact' })
      .order('opted_out_at', { ascending: false })

    if (search) {
      query = query.ilike('whatsapp_number', `%${search}%`)
    }

    const from = (page - 1) * limit
    const to = from + limit - 1

    const { data: optouts, error, count } = await query.range(from, to)

    if (error) {
      throw error
    }

    return NextResponse.json({
      optouts: optouts || [],
      total: count || 0,
      page,
      limit,
    })
  } catch (error) {
    console.error('Error fetching optouts:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch optouts' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/campaigns/optouts
 * Add a new opt-out (admin action)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { whatsapp_number, reason, notes, admin_email } = body

    if (!whatsapp_number) {
      return NextResponse.json(
        { error: 'whatsapp_number is required' },
        { status: 400 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Find user by number
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('whatsapp_number', whatsapp_number)
      .single()

    // Insert opt-out
    const { data: optout, error } = await supabase
      .from('campaign_optouts')
      .insert({
        user_id: user?.id || null,
        whatsapp_number,
        reason: reason || 'admin',
        source: 'admin_panel',
        opted_out_by: admin_email ? `admin:${admin_email}` : 'admin',
        notes,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Este número já está na lista de opt-out' },
          { status: 409 }
        )
      }
      throw error
    }

    // Cancel any active campaigns for this user
    if (user?.id) {
      await supabase
        .from('user_campaigns')
        .update({
          status: 'cancelled',
          cancel_reason: 'admin_optout',
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .in('status', ['active', 'pending'])
    }

    return NextResponse.json({
      success: true,
      optout,
    })
  } catch (error) {
    console.error('Error adding optout:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to add optout' },
      { status: 500 }
    )
  }
}
