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
  params: Promise<{ id: string; photoId: string }>
}

// GET - Get single photo details
export async function GET(request: NextRequest, context: RouteContext) {
  const supabase = getSupabase()

  try {
    const { id: celebrityId, photoId } = await context.params

    const { data: photo, error } = await supabase
      .from('celebrity_photos')
      .select('id, storage_path, file_name, file_size, mime_type, created_at')
      .eq('id', photoId)
      .eq('celebrity_id', celebrityId)
      .single()

    if (error || !photo) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 })
    }

    // Generate signed URL
    const { data: urlData } = await supabase.storage
      .from('celebrity-training')
      .createSignedUrl(photo.storage_path, 3600)

    return NextResponse.json({
      photo: {
        ...photo,
        url: urlData?.signedUrl || '',
      },
    })
  } catch (error) {
    console.error('Error getting photo:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Delete a photo
export async function DELETE(request: NextRequest, context: RouteContext) {
  const supabase = getSupabase()

  try {
    const { id: celebrityId, photoId } = await context.params

    // Get photo to find storage path
    const { data: photo, error: fetchError } = await supabase
      .from('celebrity_photos')
      .select('id, storage_path')
      .eq('id', photoId)
      .eq('celebrity_id', celebrityId)
      .single()

    if (fetchError || !photo) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 })
    }

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from('celebrity-training')
      .remove([photo.storage_path])

    if (storageError) {
      console.error('Storage delete error:', storageError)
      // Continue to delete from database even if storage fails
    }

    // Delete from database
    const { error: dbError } = await supabase
      .from('celebrity_photos')
      .delete()
      .eq('id', photoId)

    if (dbError) {
      console.error('Database delete error:', dbError)
      return NextResponse.json(
        { error: `Database error: ${dbError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting photo:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
