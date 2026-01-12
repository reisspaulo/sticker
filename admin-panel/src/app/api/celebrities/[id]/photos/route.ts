import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use service role for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface RouteContext {
  params: Promise<{ id: string }>
}

// GET - List photos for a celebrity
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: celebrityId } = await context.params

    const { data: photos, error } = await supabase
      .from('celebrity_photos')
      .select('id, storage_path, file_name, file_size, mime_type, created_at')
      .eq('celebrity_id', celebrityId)
      .order('created_at')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Generate signed URLs for each photo
    const photosWithUrls = await Promise.all(
      (photos || []).map(async (photo) => {
        const { data: urlData } = await supabase.storage
          .from('celebrity-training')
          .createSignedUrl(photo.storage_path, 3600) // 1 hour expiry

        return {
          ...photo,
          url: urlData?.signedUrl || '',
        }
      })
    )

    return NextResponse.json({ photos: photosWithUrls })
  } catch (error) {
    console.error('Error listing photos:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Upload a new photo
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: celebrityId } = await context.params

    // Verify celebrity exists
    const { data: celebrity, error: celebError } = await supabase
      .from('celebrities')
      .select('id, slug')
      .eq('id', celebrityId)
      .single()

    if (celebError || !celebrity) {
      return NextResponse.json({ error: 'Celebrity not found' }, { status: 404 })
    }

    // Parse multipart form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: JPEG, PNG, WebP' },
        { status: 400 }
      )
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size: 5MB' },
        { status: 400 }
      )
    }

    // Check photo count limit (max 10 per celebrity)
    const { count } = await supabase
      .from('celebrity_photos')
      .select('*', { count: 'exact', head: true })
      .eq('celebrity_id', celebrityId)

    if (count && count >= 10) {
      return NextResponse.json(
        { error: 'Maximum 10 photos per celebrity' },
        { status: 400 }
      )
    }

    // Generate unique filename
    const timestamp = Date.now()
    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const fileName = `${celebrity.slug}_${timestamp}.${extension}`
    const storagePath = `${celebrity.slug}/${fileName}`

    // Convert File to ArrayBuffer for upload
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('celebrity-training')
      .upload(storagePath, buffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false,
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return NextResponse.json(
        { error: `Upload failed: ${uploadError.message}` },
        { status: 500 }
      )
    }

    // Save metadata to database
    const { data: photo, error: dbError } = await supabase
      .from('celebrity_photos')
      .insert({
        celebrity_id: celebrityId,
        storage_path: storagePath,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
      })
      .select('id, storage_path, file_name, file_size, mime_type, created_at')
      .single()

    if (dbError) {
      // Rollback: delete uploaded file
      await supabase.storage.from('celebrity-training').remove([storagePath])
      console.error('Database error:', dbError)
      return NextResponse.json(
        { error: `Database error: ${dbError.message}` },
        { status: 500 }
      )
    }

    // Generate signed URL for response
    const { data: urlData } = await supabase.storage
      .from('celebrity-training')
      .createSignedUrl(storagePath, 3600)

    return NextResponse.json({
      photo: {
        ...photo,
        url: urlData?.signedUrl || '',
      },
    })
  } catch (error) {
    console.error('Error uploading photo:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
