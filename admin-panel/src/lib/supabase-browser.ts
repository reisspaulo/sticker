'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

// Usar window como armazenamento global para garantir singleton verdadeiro
declare global {
  interface Window {
    __supabaseClient?: SupabaseClient
    __supabaseClientCreating?: boolean
  }
}

export function getSupabaseBrowserClient() {
  // NUNCA criar cliente no servidor - apenas no cliente
  if (typeof window === 'undefined') {
    throw new Error('getSupabaseBrowserClient() can only be called in the browser')
  }

  // No cliente, usar singleton verdadeiro via window com lock para prevenir race conditions
  if (!window.__supabaseClient && !window.__supabaseClientCreating) {
    window.__supabaseClientCreating = true
    window.__supabaseClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    window.__supabaseClientCreating = false
  } else if (window.__supabaseClientCreating) {
    // Busy wait até que a criação seja concluída (normalmente muito rápido)
    while (window.__supabaseClientCreating) {
      // Espera ativa
    }
  }

  return window.__supabaseClient!
}
