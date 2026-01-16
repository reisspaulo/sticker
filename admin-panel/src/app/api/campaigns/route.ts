import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * GET /api/campaigns
 * List all campaigns with stats
 */
export async function GET() {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Use the RPC to get campaigns with stats
    const { data: campaigns, error } = await supabase.rpc('list_campaigns_with_stats')

    if (error) {
      console.error('Error fetching campaigns:', error)
      throw error
    }

    return NextResponse.json({
      campaigns: campaigns || [],
      total: campaigns?.length || 0,
    })
  } catch (error) {
    console.error('Error fetching campaigns:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch campaigns' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/campaigns
 * Create a new campaign with steps and messages
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { campaign, steps } = body

    if (!campaign?.name) {
      return NextResponse.json(
        { error: 'Nome da campanha é obrigatório' },
        { status: 400 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Check if name already exists
    const { data: existing } = await supabase
      .from('campaigns')
      .select('id')
      .eq('name', campaign.name)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'Já existe uma campanha com este nome' },
        { status: 400 }
      )
    }

    // Use RPC to create campaign with steps
    const { data: result, error } = await supabase.rpc('create_campaign_with_steps', {
      p_campaign: campaign,
      p_steps: steps || [],
    })

    if (error) {
      throw error
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error creating campaign:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Falha ao criar campanha' },
      { status: 500 }
    )
  }
}
