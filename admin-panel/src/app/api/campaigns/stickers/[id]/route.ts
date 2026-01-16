import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * GET /api/campaigns/stickers/[id]
 * Get a single sticker with campaign usage
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get sticker
    const { data: sticker, error } = await supabase
      .from('bot_stickers')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !sticker) {
      return NextResponse.json(
        { error: 'Sticker not found' },
        { status: 404 }
      )
    }

    // Get campaigns using this sticker
    const { data: campaigns } = await supabase
      .from('campaign_sticker_pool')
      .select(`
        campaign_id,
        step_key,
        priority,
        campaign:campaigns(id, name, status)
      `)
      .eq('sticker_id', id)

    return NextResponse.json({
      sticker,
      campaigns: campaigns || [],
    })
  } catch (error) {
    console.error('Error fetching sticker:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch sticker' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/campaigns/stickers/[id]
 * Update a sticker
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const allowedFields = ['name', 'description', 'tags', 'category', 'is_active', 'is_animated']
    const updateData: Record<string, unknown> = {}

    for (const field of allowedFields) {
      if (field in body) {
        updateData[field] = body[field]
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      )
    }

    const { data: sticker, error } = await supabase
      .from('bot_stickers')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      sticker,
    })
  } catch (error) {
    console.error('Error updating sticker:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update sticker' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/campaigns/stickers/[id]
 * Delete a sticker (also removes from storage)
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get sticker to get storage path
    const { data: sticker, error: fetchError } = await supabase
      .from('bot_stickers')
      .select('storage_path')
      .eq('id', id)
      .single()

    if (fetchError || !sticker) {
      return NextResponse.json(
        { error: 'Sticker not found' },
        { status: 404 }
      )
    }

    // Delete from storage
    if (sticker.storage_path) {
      const { error: storageError } = await supabase.storage
        .from('bot-stickers')
        .remove([sticker.storage_path.replace('bot-stickers/', '')])

      if (storageError) {
        console.error('Error deleting from storage:', storageError)
      }
    }

    // Delete from database (cascades to campaign_sticker_pool)
    const { error: deleteError } = await supabase
      .from('bot_stickers')
      .delete()
      .eq('id', id)

    if (deleteError) {
      throw deleteError
    }

    return NextResponse.json({
      success: true,
      message: 'Sticker deleted',
    })
  } catch (error) {
    console.error('Error deleting sticker:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete sticker' },
      { status: 500 }
    )
  }
}
