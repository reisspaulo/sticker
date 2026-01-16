import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * GET /api/campaigns/stickers
 * List all bot stickers with stats
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const tags = searchParams.get('tags')
    const activeOnly = searchParams.get('active_only') !== 'false'

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: stickers, error } = await supabase.rpc('list_bot_stickers_with_stats', {
      p_category: category || null,
      p_tags: tags ? tags.split(',') : null,
      p_active_only: activeOnly,
    })

    if (error) {
      throw error
    }

    // Get categories for filter
    const { data: categories } = await supabase
      .from('bot_stickers')
      .select('category')
      .order('category')

    const uniqueCategories = [...new Set(categories?.map(c => c.category) || [])]

    return NextResponse.json({
      stickers: stickers || [],
      total: stickers?.length || 0,
      categories: uniqueCategories,
    })
  } catch (error) {
    console.error('Error fetching stickers:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch stickers' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/campaigns/stickers
 * Create a new bot sticker (metadata only, upload is separate)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, description, storage_path, sticker_url, tags, category, is_animated } = body

    if (!name || !storage_path || !sticker_url) {
      return NextResponse.json(
        { error: 'name, storage_path, and sticker_url are required' },
        { status: 400 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: sticker, error } = await supabase
      .from('bot_stickers')
      .insert({
        name,
        description: description || null,
        storage_path,
        sticker_url,
        tags: tags || [],
        category: category || 'geral',
        is_animated: is_animated || false,
      })
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
    console.error('Error creating sticker:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create sticker' },
      { status: 500 }
    )
  }
}
