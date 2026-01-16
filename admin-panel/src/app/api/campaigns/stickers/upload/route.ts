import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * POST /api/campaigns/stickers/upload
 * Upload a sticker file and create the database record
 */
export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const name = formData.get('name') as string | null
    const description = formData.get('description') as string | null
    const category = formData.get('category') as string | null
    const tags = formData.get('tags') as string | null
    const isAnimated = formData.get('is_animated') === 'true'

    if (!file) {
      return NextResponse.json(
        { error: 'File is required' },
        { status: 400 }
      )
    }

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      )
    }

    // Validate file type
    const validTypes = ['image/webp', 'image/png', 'image/gif']
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only WebP, PNG, and GIF are allowed' },
        { status: 400 }
      )
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 5MB' },
        { status: 400 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Generate unique filename
    const timestamp = Date.now()
    const sanitizedName = name.toLowerCase().replace(/[^a-z0-9]/g, '_')
    const extension = file.name.split('.').pop() || 'webp'
    const storagePath = `${sanitizedName}_${timestamp}.${extension}`

    // Upload to storage
    const arrayBuffer = await file.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('bot-stickers')
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      throw uploadError
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('bot-stickers')
      .getPublicUrl(storagePath)

    // Create database record
    const { data: sticker, error: dbError } = await supabase
      .from('bot_stickers')
      .insert({
        name,
        description: description || null,
        storage_path: `bot-stickers/${storagePath}`,
        sticker_url: publicUrl,
        tags: tags ? tags.split(',').map(t => t.trim()) : [],
        category: category || 'geral',
        is_animated: isAnimated,
      })
      .select()
      .single()

    if (dbError) {
      // Rollback storage upload on db error
      await supabase.storage.from('bot-stickers').remove([storagePath])
      throw dbError
    }

    return NextResponse.json({
      success: true,
      sticker,
    })
  } catch (error) {
    console.error('Error uploading sticker:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload sticker' },
      { status: 500 }
    )
  }
}
