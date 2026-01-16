import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

interface FilterCondition {
  id: string
  field: string
  operator: string
  value: string
}

/**
 * POST /api/campaigns/preview-audience
 * Preview how many users match the target filter with real-time count
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { conditions, target_filter } = body

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get total user count for percentage calculation
    const { count: totalBase } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })

    // Build query with filters
    let query = supabase
      .from('users')
      .select('id, whatsapp_number, name, subscription_plan, subscription_status, created_at, last_interaction, ab_test_group', { count: 'exact' })

    // Apply conditions if provided (new format)
    if (conditions && Array.isArray(conditions) && conditions.length > 0) {
      for (const condition of conditions as FilterCondition[]) {
        if (!condition.field || !condition.value) continue

        const { field, operator, value } = condition

        // Handle different field types and operators
        switch (field) {
          case 'subscription_plan':
          case 'subscription_status':
          case 'ab_test_group':
            if (operator === 'eq') {
              query = query.eq(field, value)
            } else if (operator === 'neq') {
              query = query.neq(field, value)
            }
            break

          case 'stickers_created':
            // This requires a subquery or RPC - simplified version
            // For now, we'll handle it in the RPC if needed
            break

          case 'days_since_signup': {
            const days = parseInt(value)
            const dateThreshold = new Date()
            dateThreshold.setDate(dateThreshold.getDate() - days)

            if (operator === 'gt') {
              query = query.lt('created_at', dateThreshold.toISOString())
            } else if (operator === 'gte') {
              query = query.lte('created_at', dateThreshold.toISOString())
            } else if (operator === 'lt') {
              query = query.gt('created_at', dateThreshold.toISOString())
            } else if (operator === 'lte') {
              query = query.gte('created_at', dateThreshold.toISOString())
            } else if (operator === 'eq') {
              const nextDay = new Date(dateThreshold)
              nextDay.setDate(nextDay.getDate() + 1)
              query = query.gte('created_at', dateThreshold.toISOString()).lt('created_at', nextDay.toISOString())
            }
            break
          }

          case 'days_since_last_use': {
            const days = parseInt(value)
            const dateThreshold = new Date()
            dateThreshold.setDate(dateThreshold.getDate() - days)

            if (operator === 'gt') {
              query = query.lt('last_interaction', dateThreshold.toISOString())
            } else if (operator === 'gte') {
              query = query.lte('last_interaction', dateThreshold.toISOString())
            } else if (operator === 'lt') {
              query = query.gt('last_interaction', dateThreshold.toISOString())
            } else if (operator === 'lte') {
              query = query.gte('last_interaction', dateThreshold.toISOString())
            }
            break
          }

          case 'twitter_feature_used':
          case 'cleanup_feature_used': {
            const boolValue = value === 'true'
            query = query.eq(field, boolValue)
            break
          }

          case 'country_prefix':
            if (operator === 'eq') {
              query = query.like('whatsapp_number', `${value}%`)
            } else if (operator === 'neq') {
              query = query.not('whatsapp_number', 'like', `${value}%`)
            }
            break

          case 'in_campaign': {
            // This would require a join with user_campaigns
            // Simplified for now
            break
          }
        }
      }
    }
    // Support legacy target_filter format
    else if (target_filter && typeof target_filter === 'object') {
      const filter = target_filter as Record<string, unknown>

      if (filter.subscription_plan) {
        query = query.eq('subscription_plan', filter.subscription_plan)
      }
      if (filter.created_after) {
        query = query.gte('created_at', filter.created_after)
      }
      if (typeof filter.twitter_feature_used === 'boolean') {
        query = query.eq('twitter_feature_used', filter.twitter_feature_used)
      }
      if (filter.country_prefix) {
        query = query.like('whatsapp_number', `${filter.country_prefix}%`)
      }
    }

    // Execute query with limit for sample
    const { data: users, count, error } = await query
      .order('last_interaction', { ascending: false, nullsFirst: false })
      .limit(10)

    if (error) {
      console.error('Error querying users:', error)
      throw error
    }

    // Calculate breakdown by plan
    const byPlan: Record<string, number> = {}

    // Get breakdown with a separate query (RPC may not exist yet)
    let planBreakdown = null
    try {
      const { data } = await supabase.rpc('get_audience_breakdown', {
        p_conditions: conditions || [],
      })
      planBreakdown = data
    } catch {
      // RPC doesn't exist, will use fallback
    }

    if (planBreakdown) {
      for (const row of planBreakdown) {
        byPlan[row.plan || 'free'] = row.count
      }
    } else {
      // Fallback: estimate from sample
      for (const user of users || []) {
        const plan = user.subscription_plan || 'free'
        byPlan[plan] = (byPlan[plan] || 0) + 1
      }
    }

    // Get sticker count for sample users
    const sampleUsers = await Promise.all(
      (users || []).slice(0, 5).map(async (user) => {
        const { count: stickerCount } = await supabase
          .from('stickers')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)

        return {
          id: user.id,
          whatsapp_number: user.whatsapp_number,
          name: user.name,
          subscription_plan: user.subscription_plan || 'free',
          stickers_created: stickerCount || 0,
          last_interaction: user.last_interaction,
        }
      })
    )

    return NextResponse.json({
      total: count || 0,
      totalBase: totalBase || 0,
      byPlan,
      sampleUsers,
    })
  } catch (error) {
    console.error('Error previewing audience:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Falha ao calcular audiência' },
      { status: 500 }
    )
  }
}
