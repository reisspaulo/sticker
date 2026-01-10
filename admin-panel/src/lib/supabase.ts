'use client'

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

if (typeof window !== 'undefined') {
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Supabase env vars missing:', {
      url: supabaseUrl ? 'ok' : 'MISSING',
      key: supabaseKey ? 'ok' : 'MISSING'
    })
  } else {
    console.log('✅ Supabase configured:', supabaseUrl)
  }
}

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
  created_at?: string
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
