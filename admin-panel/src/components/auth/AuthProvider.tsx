'use client'

import { useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'

/**
 * AuthProvider Component
 * Inicializa o sistema de autenticação na montagem da aplicação
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { initialize } = useAuth()

  useEffect(() => {
    initialize()
  }, [initialize])

  return <>{children}</>
}
