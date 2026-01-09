'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

// Usar window como armazenamento global para garantir singleton verdadeiro
declare global {
  interface Window {
    __supabaseClient?: SupabaseClient
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

  // No cliente, usar singleton verdadeiro via window
  if (!window.__supabaseClient) {
    window.__supabaseClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }

  return window.__supabaseClient
}
