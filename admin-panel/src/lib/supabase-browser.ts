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
    console.log('[Supabase] Creating new browser client instance (window.__supabaseClient is:', window.__supabaseClient, ')')
    window.__supabaseClientCreating = true
    window.__supabaseClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    window.__supabaseClientCreating = false
    console.log('[Supabase] Browser client created and stored in window. Now window.__supabaseClient is defined:', !!window.__supabaseClient)
  } else if (window.__supabaseClientCreating) {
    console.log('[Supabase] Waiting for client creation to complete...')
    // Busy wait até que a criação seja concluída (normalmente muito rápido)
    while (window.__supabaseClientCreating) {
      // Espera ativa
    }
    console.log('[Supabase] Client creation completed, using existing instance')
  } else {
    console.log('[Supabase] Reusing existing browser client from window (defined:', !!window.__supabaseClient, ')')
  }

  return window.__supabaseClient!
}
