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
  // During build-time prerendering, we're not in a browser
  // Skip client creation to avoid env var issues during static generation
  if (typeof window === 'undefined') {
    // Return a placeholder that will be properly initialized on client
    // This allows components using useEffect to work correctly
    return null as unknown as SupabaseClient
  }

  if (client) {
    return client
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  client = createBrowserClient(supabaseUrl, supabaseAnonKey)

  return client
}
