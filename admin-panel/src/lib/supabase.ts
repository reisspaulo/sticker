// Type definitions and utility functions for Supabase
// No client is created here to avoid SSR hydration issues

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''

// Note: Do not create a module-level Supabase client here!
// Creating a client at module level causes multiple GoTrueClient instances
// (one during SSR, one during CSR) which leads to React hydration errors.
// Use getSupabaseBrowserClient() instead for client-side operations.

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
  training_status?: string
  embeddings_count?: number
}

export function getStickerUrl(sticker: Pick<Sticker, 'tipo' | 'storage_path'>): string {
  const bucket = sticker.tipo === 'estatico' ? 'stickers-estaticos' : 'stickers-animados'
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${sticker.storage_path}`
}
