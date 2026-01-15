import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * GET /api/analytics/classification
 * Returns top emotions and top celebrities stats
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || '30' // days

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Calculate date filter
    const daysAgo = parseInt(period)
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - daysAgo)
    const startDateISO = daysAgo === 0 ? null : startDate.toISOString()

    // Query for top emotions using raw SQL
    // unnest expands the array into rows, then we count occurrences
    const { data: emotionsData, error: emotionsError } = await supabase.rpc(
      'get_top_emotions',
      {
        start_date: startDateISO,
        limit_count: 10
      }
    )

    // If RPC doesn't exist, fall back to manual counting
    let topEmotions: { emotion: string; count: number }[] = []

    if (emotionsError || !emotionsData) {
      // Fallback: fetch all stickers with emotions and count manually
      const query = supabase
        .from('stickers')
        .select('emotion_tags')
        .not('emotion_tags', 'is', null)

      if (startDateISO) {
        query.gte('created_at', startDateISO)
      }

      const { data: stickers } = await query

      if (stickers) {
        const emotionCounts: Record<string, number> = {}
        stickers.forEach(s => {
          if (Array.isArray(s.emotion_tags)) {
            s.emotion_tags.forEach((emotion: string) => {
              emotionCounts[emotion] = (emotionCounts[emotion] || 0) + 1
            })
          }
        })

        topEmotions = Object.entries(emotionCounts)
          .map(([emotion, count]) => ({ emotion, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10)
      }
    } else {
      topEmotions = emotionsData
    }

    // Query for top celebrities
    const celebrityQuery = supabase
      .from('stickers')
      .select(`
        celebrity_id,
        celebrities!inner (
          id,
          name,
          slug
        )
      `)
      .not('celebrity_id', 'is', null)

    if (startDateISO) {
      celebrityQuery.gte('created_at', startDateISO)
    }

    const { data: celebrityStickers } = await celebrityQuery

    // Count celebrities manually
    const celebrityCounts: Record<string, { name: string; slug: string; count: number }> = {}

    if (celebrityStickers) {
      celebrityStickers.forEach((s: any) => {
        const celeb = s.celebrities
        if (celeb) {
          const key = celeb.id
          if (!celebrityCounts[key]) {
            celebrityCounts[key] = {
              name: celeb.name,
              slug: celeb.slug,
              count: 0
            }
          }
          celebrityCounts[key].count++
        }
      })
    }

    const topCelebrities = Object.values(celebrityCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    // Get total stats
    const statsQuery = supabase
      .from('stickers')
      .select('id, emotion_tags, celebrity_id', { count: 'exact' })

    if (startDateISO) {
      statsQuery.gte('created_at', startDateISO)
    }

    const { count: totalStickers } = await statsQuery

    const classifiedQuery = supabase
      .from('stickers')
      .select('id', { count: 'exact' })
      .not('emotion_tags', 'is', null)

    if (startDateISO) {
      classifiedQuery.gte('created_at', startDateISO)
    }

    const { count: withEmotions } = await classifiedQuery

    const celebQuery = supabase
      .from('stickers')
      .select('id', { count: 'exact' })
      .not('celebrity_id', 'is', null)

    if (startDateISO) {
      celebQuery.gte('created_at', startDateISO)
    }

    const { count: withCelebrity } = await celebQuery

    return NextResponse.json({
      topEmotions,
      topCelebrities,
      stats: {
        totalStickers: totalStickers || 0,
        withEmotions: withEmotions || 0,
        withCelebrity: withCelebrity || 0,
        emotionRate: totalStickers ? Math.round((withEmotions || 0) / totalStickers * 100) : 0,
        celebrityRate: totalStickers ? Math.round((withCelebrity || 0) / totalStickers * 100) : 0,
      },
      period: daysAgo === 0 ? 'all' : `${daysAgo}d`,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error fetching classification analytics:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch analytics' },
      { status: 500 }
    )
  }
}
