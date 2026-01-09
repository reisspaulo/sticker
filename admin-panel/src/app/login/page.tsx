'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      console.log('🔐 Tentando login...')

      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      console.log('📧 Resposta do Supabase:', {
        hasUser: !!data?.user,
        error: authError?.message
      })

    if (authError) {
      console.error('❌ Erro de autenticação:', authError)
      setError(authError.message)
      setLoading(false)
      return
    }

    if (data.user) {
      console.log('👤 Usuário autenticado, verificando role...')

      // Verificar se é admin
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', data.user.id)
        .single()

      console.log('👔 Profile:', { role: profile?.role, error: profileError?.message })

      if (profile?.role !== 'admin') {
        console.warn('⛔ Usuário não é admin')
        await supabase.auth.signOut()
        setError('Acesso negado. Apenas administradores podem acessar.')
        setLoading(false)
        return
      }

      console.log('✅ Admin verificado, redirecionando...')
      router.push('/')
      router.refresh()
    }
    } catch (err) {
      console.error('💥 Erro não tratado:', err)
      setError('Erro ao fazer login. Verifique o console.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Stickers Admin</CardTitle>
          <CardDescription>
            Entre com suas credenciais para acessar o painel
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <Input
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Senha</label>
              <Input
                type="password"
                placeholder="********"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && (
              <div className="text-sm text-red-500 bg-red-500/10 p-3 rounded-md">
                {error}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
