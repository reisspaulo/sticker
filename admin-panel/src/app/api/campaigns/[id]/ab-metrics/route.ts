import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/campaigns/[id]/ab-metrics
 * Get A/B test metrics for a campaign
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get real-time metrics using RPC
    const { data: metrics, error } = await supabase.rpc('get_campaign_ab_metrics', {
      p_campaign_id: id,
    })

    if (error) {
      console.error('Error fetching A/B metrics:', error)
      throw error
    }

    // Group by step_key for easier frontend consumption
    const groupedByStep: Record<string, typeof metrics> = {}
    for (const row of metrics || []) {
      if (!groupedByStep[row.step_key]) {
        groupedByStep[row.step_key] = []
      }
      groupedByStep[row.step_key].push(row)
    }

    return NextResponse.json({
      metrics: metrics || [],
      byStep: groupedByStep,
    })
  } catch (error) {
    console.error('Error fetching A/B metrics:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Falha ao buscar métricas A/B' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/campaigns/[id]/ab-metrics
 * Refresh/update cached A/B metrics
 */
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Update cached results
    const { error } = await supabase.rpc('update_campaign_ab_results', {
      p_campaign_id: id,
    })

    if (error) {
      console.error('Error updating A/B results:', error)
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating A/B results:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Falha ao atualizar métricas A/B' },
      { status: 500 }
    )
  }
}
