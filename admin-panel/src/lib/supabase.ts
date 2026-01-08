'use client'

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey)

export interface Sticker {
  id: string
  storage_path: string
  tipo: 'estatico' | 'animado'
  emotion_tags: string[] | null
  emotion_approved: boolean | null
  emotion_classified_at?: string | null
  face_detected?: boolean
  celebrity_id: string | null
  celebrities?: { name: string } | { name: string }[] | null
}

export interface Celebrity {
  id: string
  name: string
  slug: string
}

export function getStickerUrl(sticker: Pick<Sticker, 'tipo' | 'storage_path'>): string {
  const bucket = sticker.tipo === 'estatico' ? 'stickers-estaticos' : 'stickers-animados'
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${sticker.storage_path}`
}
