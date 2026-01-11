/**
 * Supabase Client - Client-side
 * Para uso em Client Components ('use client')
 *
 * IMPORTANTE: Usa @supabase/ssr para armazenar sessão em COOKIES
 * Isso garante que middleware e server components leiam a mesma sessão
 *
 * CRÍTICO: Singleton para evitar múltiplas instâncias do GoTrueClient
 */

import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

// Instância global única
let client: SupabaseClient | undefined

export function createClient() {
  if (client) {
    return client
  }

  client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  return client
}
