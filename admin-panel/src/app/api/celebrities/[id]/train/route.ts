import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Create Supabase client lazily to avoid build-time errors
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// VPS Training API configuration
function getVpsConfig() {
  return {
    url: process.env.VPS_TRAINING_API_URL || 'http://YOUR_VPS_IP:8765',
    apiKey: process.env.VPS_TRAINING_API_KEY || '',
  }
}

interface RouteContext {
  params: Promise<{ id: string }>
}

// POST - Start training for a celebrity
export async function POST(request: NextRequest, context: RouteContext) {
  const supabase = getSupabase()
  const vpsConfig = getVpsConfig()

  try {
    const { id: celebrityId } = await context.params

    // Verify celebrity exists and get slug
    const { data: celebrity, error: celebError } = await supabase
      .from('celebrities')
      .select('id, slug, name, training_status')
      .eq('id', celebrityId)
      .single()

    if (celebError || !celebrity) {
      return NextResponse.json({ error: 'Celebrity not found' }, { status: 404 })
    }

    // Check if already training
    if (celebrity.training_status === 'training') {
      return NextResponse.json(
        { error: 'Training already in progress' },
        { status: 409 }
      )
    }

    // Get all photos for this celebrity
    const { data: photos, error: photosError } = await supabase
      .from('celebrity_photos')
      .select('id, storage_path, file_name')
      .eq('celebrity_id', celebrityId)

    if (photosError || !photos || photos.length < 1) {
      return NextResponse.json(
        { error: 'Celebrity has no photos. Upload at least 1 photo before training.' },
        { status: 400 }
      )
    }

    // Generate signed URLs for all photos (valid for 1 hour)
    const photosWithUrls = await Promise.all(
      photos.map(async (photo) => {
        const { data: signedData } = await supabase.storage
          .from('celebrity-training')
          .createSignedUrl(photo.storage_path, 3600) // 1 hour expiry

        return {
          filename: photo.file_name,
          url: signedData?.signedUrl || '',
        }
      })
    )

    // Filter out any photos that failed to get signed URLs
    const validPhotos = photosWithUrls.filter((p) => p.url)

    if (validPhotos.length === 0) {
      return NextResponse.json(
        { error: 'Failed to generate access URLs for photos' },
        { status: 500 }
      )
    }

    // Update status to training
    await supabase
      .from('celebrities')
      .update({ training_status: 'training', training_error: null })
      .eq('id', celebrityId)

    // Call VPS Training API with signed URLs
    const vpsResponse = await fetch(`${vpsConfig.url}/train`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': vpsConfig.apiKey,
      },
      body: JSON.stringify({
        celebrity_slug: celebrity.slug,
        celebrity_id: celebrityId,
        photos: validPhotos, // Include signed URLs
      }),
    })

    if (!vpsResponse.ok) {
      const errorData = await vpsResponse.json().catch(() => ({}))

      // Revert status on failure
      await supabase
        .from('celebrities')
        .update({
          training_status: 'failed',
          training_error: errorData.detail || 'Failed to start training'
        })
        .eq('id', celebrityId)

      return NextResponse.json(
        { error: errorData.detail || 'Failed to start training on VPS' },
        { status: vpsResponse.status }
      )
    }

    const result = await vpsResponse.json()

    return NextResponse.json({
      status: 'training',
      message: `Training started for ${celebrity.name}`,
      job_id: result.job_id,
      photos_count: validPhotos.length,
    })
  } catch (error) {
    console.error('Error starting training:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET - Get training status for a celebrity
export async function GET(request: NextRequest, context: RouteContext) {
  const supabase = getSupabase()
  const vpsConfig = getVpsConfig()

  try {
    const { id: celebrityId } = await context.params

    // Get celebrity status from database
    const { data: celebrity, error } = await supabase
      .from('celebrities')
      .select('id, slug, name, training_status, training_error, last_trained_at, embeddings_count')
      .eq('id', celebrityId)
      .single()

    if (error || !celebrity) {
      return NextResponse.json({ error: 'Celebrity not found' }, { status: 404 })
    }

    // If status is "training", check VPS for actual status and sync
    if (celebrity.training_status === 'training') {
      try {
        const vpsResponse = await fetch(`${vpsConfig.url}/status/${celebrity.slug}`, {
          headers: { 'X-API-Key': vpsConfig.apiKey },
        })

        if (vpsResponse.ok) {
          const vpsStatus = await vpsResponse.json()

          // Sync VPS status to database if training completed or failed
          if (vpsStatus.status === 'completed' || vpsStatus.status === 'failed') {
            const updateData: Record<string, unknown> = {
              training_status: vpsStatus.status === 'completed' ? 'trained' : 'failed',
              last_trained_at: vpsStatus.status === 'completed' ? new Date().toISOString() : null,
            }

            if (vpsStatus.result?.embeddings_count) {
              updateData.embeddings_count = vpsStatus.result.embeddings_count
            }

            if (vpsStatus.result?.error) {
              updateData.training_error = vpsStatus.result.error
            }

            await supabase
              .from('celebrities')
              .update(updateData)
              .eq('id', celebrityId)

            // Update local object for response
            celebrity.training_status = updateData.training_status as string
            celebrity.training_error = updateData.training_error as string | null
            celebrity.embeddings_count = (updateData.embeddings_count as number) || celebrity.embeddings_count
            celebrity.last_trained_at = updateData.last_trained_at as string | null
          }
        }
      } catch {
        // VPS check failed, just return DB status
        console.log('VPS status check failed, using DB status')
      }
    }

    // Get photo count
    const { count: photoCount } = await supabase
      .from('celebrity_photos')
      .select('*', { count: 'exact', head: true })
      .eq('celebrity_id', celebrityId)

    return NextResponse.json({
      id: celebrity.id,
      slug: celebrity.slug,
      name: celebrity.name,
      training_status: celebrity.training_status || 'pending',
      training_error: celebrity.training_error,
      last_trained_at: celebrity.last_trained_at,
      embeddings_count: celebrity.embeddings_count || 0,
      photos_count: photoCount || 0,
    })
  } catch (error) {
    console.error('Error getting training status:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
