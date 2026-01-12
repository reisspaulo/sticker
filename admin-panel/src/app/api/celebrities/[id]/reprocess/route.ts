import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Create Supabase client lazily to avoid build-time errors
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

interface RouteContext {
  params: Promise<{ id: string }>
}

// POST - Queue stickers for reprocessing after training a new celebrity
export async function POST(request: NextRequest, context: RouteContext) {
  const supabase = getSupabase()

  try {
    const { id: celebrityId } = await context.params
    const body = await request.json().catch(() => ({}))
    const { mode = 'unrecognized' } = body

    // Verify celebrity exists and is trained
    const { data: celebrity, error: celebError } = await supabase
      .from('celebrities')
      .select('id, slug, name, training_status, pack_id')
      .eq('id', celebrityId)
      .single()

    if (celebError || !celebrity) {
      return NextResponse.json({ error: 'Celebrity not found' }, { status: 404 })
    }

    if (celebrity.training_status !== 'trained') {
      return NextResponse.json(
        { error: 'Celebrity must be trained before reprocessing stickers' },
        { status: 400 }
      )
    }

    let updateResult
    let affectedCount = 0

    if (mode === 'unrecognized') {
      // Reset stickers that have face detected but no celebrity assigned
      // This allows the VPS worker to re-run face recognition on them
      const { data, error } = await supabase
        .from('stickers')
        .update({
          face_detected: null,
          celebrity_id: null,
          face_classified_at: null,
        })
        .eq('face_detected', true)
        .is('celebrity_id', null)
        .select('id')

      if (error) {
        console.error('Error resetting unrecognized stickers:', error)
        return NextResponse.json(
          { error: 'Failed to queue stickers for reprocessing' },
          { status: 500 }
        )
      }

      affectedCount = data?.length || 0
      updateResult = data

    } else if (mode === 'pack' && celebrity.pack_id) {
      // Reset all stickers from the celebrity's pack
      // First get sticker IDs from the pack
      const { data: packStickers, error: packError } = await supabase
        .from('sticker_pack_items')
        .select('sticker_id')
        .eq('pack_id', celebrity.pack_id)

      if (packError) {
        console.error('Error fetching pack stickers:', packError)
        return NextResponse.json(
          { error: 'Failed to fetch pack stickers' },
          { status: 500 }
        )
      }

      if (packStickers && packStickers.length > 0) {
        const stickerIds = packStickers.map(ps => ps.sticker_id)

        const { data, error } = await supabase
          .from('stickers')
          .update({
            face_detected: null,
            celebrity_id: null,
            face_classified_at: null,
          })
          .in('id', stickerIds)
          .select('id')

        if (error) {
          console.error('Error resetting pack stickers:', error)
          return NextResponse.json(
            { error: 'Failed to queue pack stickers for reprocessing' },
            { status: 500 }
          )
        }

        affectedCount = data?.length || 0
        updateResult = data
      }

    } else if (mode === 'all') {
      // Reset ALL stickers with face_detected = true (dangerous, admin only)
      const { data, error } = await supabase
        .from('stickers')
        .update({
          face_detected: null,
          celebrity_id: null,
          face_classified_at: null,
        })
        .eq('face_detected', true)
        .select('id')

      if (error) {
        console.error('Error resetting all stickers:', error)
        return NextResponse.json(
          { error: 'Failed to queue all stickers for reprocessing' },
          { status: 500 }
        )
      }

      affectedCount = data?.length || 0
      updateResult = data
    }

    return NextResponse.json({
      success: true,
      message: `${affectedCount} stickers queued for reprocessing`,
      stickers_affected: affectedCount,
      mode,
      celebrity: {
        id: celebrity.id,
        name: celebrity.name,
        slug: celebrity.slug,
      },
    })

  } catch (error) {
    console.error('Error in reprocess endpoint:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET - Get count of stickers that would be affected by reprocessing
export async function GET(request: NextRequest, context: RouteContext) {
  const supabase = getSupabase()

  try {
    const { id: celebrityId } = await context.params

    // Verify celebrity exists
    const { data: celebrity, error: celebError } = await supabase
      .from('celebrities')
      .select('id, slug, name, training_status, pack_id')
      .eq('id', celebrityId)
      .single()

    if (celebError || !celebrity) {
      return NextResponse.json({ error: 'Celebrity not found' }, { status: 404 })
    }

    // Count unrecognized stickers (face detected but no celebrity)
    const { count: unrecognizedCount } = await supabase
      .from('stickers')
      .select('*', { count: 'exact', head: true })
      .eq('face_detected', true)
      .is('celebrity_id', null)

    // Count pack stickers (if celebrity has a pack)
    let packCount = 0
    if (celebrity.pack_id) {
      const { count } = await supabase
        .from('sticker_pack_items')
        .select('*', { count: 'exact', head: true })
        .eq('pack_id', celebrity.pack_id)

      packCount = count || 0
    }

    // Count all stickers with face detected
    const { count: totalWithFace } = await supabase
      .from('stickers')
      .select('*', { count: 'exact', head: true })
      .eq('face_detected', true)

    return NextResponse.json({
      celebrity: {
        id: celebrity.id,
        name: celebrity.name,
        slug: celebrity.slug,
        training_status: celebrity.training_status,
        has_pack: !!celebrity.pack_id,
      },
      counts: {
        unrecognized: unrecognizedCount || 0,
        pack: packCount,
        total_with_face: totalWithFace || 0,
      },
    })

  } catch (error) {
    console.error('Error getting reprocess counts:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
