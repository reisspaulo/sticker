/**
 * Auth Hook usando Zustand
 * Baseado no sistema do monitoring (brazyl/web)
 */

import { create } from 'zustand'
import { createClient } from '@/lib/supabase/client'

interface User {
  id: string
  email: string
  name?: string
}

interface AuthState {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  initialize: () => Promise<void>
}

// Cliente Supabase global para o hook
const supabase = createClient()

export const useAuth = create<AuthState>((set) => ({
  user: null,
  loading: true,

  initialize: async () => {
    console.log('Inicializando autenticação...')

    try {
      // Verificar sessão atual
      const { data: { session } } = await supabase.auth.getSession()
      console.log('Session:', session ? 'exists' : 'null')

      if (session?.user) {
        console.log('Usuário autenticado encontrado')
        set({
          user: {
            id: session.user.id,
            email: session.user.email || '',
            name: session.user.user_metadata?.name
          },
          loading: false
        })
      } else {
        console.log('Nenhuma sessão ativa')
        set({ user: null, loading: false })
      }

      // Escutar mudanças na autenticação
      supabase.auth.onAuthStateChange(async (event, session) => {
        console.log('Auth state changed:', event)

        if (session?.user) {
          set({
            user: {
              id: session.user.id,
              email: session.user.email || '',
              name: session.user.user_metadata?.name
            },
            loading: false
          })
        } else {
          set({ user: null, loading: false })
        }
      })
    } catch (error) {
      console.error('Error initializing auth:', error)
      set({ user: null, loading: false })
    }
  },

  signIn: async (email: string, password: string) => {
    try {
      set({ loading: true })

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) throw error

      if (!data.user) {
        throw new Error('Falha ao fazer login')
      }

      set({
        user: {
          id: data.user.id,
          email: data.user.email || '',
          name: data.user.user_metadata?.name
        },
        loading: false
      })
    } catch (error) {
      console.error('Sign in error:', error)
      set({ loading: false })
      throw error
    }
  },

  signOut: async () => {
    try {
      set({ loading: true })

      // Limpa o estado local PRIMEIRO
      set({ user: null, loading: false })
      console.log('Estado local limpo')

      // Tenta fazer logout no servidor com timeout de 2 segundos
      try {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 2000)
        )

        await Promise.race([
          supabase.auth.signOut(),
          timeoutPromise
        ])

        console.log('Logout no servidor concluído')
      } catch (serverError) {
        // Se der erro ou timeout, continua (estado local já foi limpo)
        console.warn('Erro/timeout ao deslogar no servidor (estado local já foi limpo):', serverError)
      }
    } catch (error) {
      console.error('Erro crítico no logout:', error)
      // Mesmo em caso de erro crítico, limpa o estado
      set({ user: null, loading: false })
    }
  },
}))
