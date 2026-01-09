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
  if (typeof window === 'undefined') {
    // No servidor, criar nova instância (não importa pois é descartada)
    return createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
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
