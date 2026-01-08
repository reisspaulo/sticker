'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { AlertCircle, RefreshCw } from 'lucide-react'

interface ErrorLog {
  id: string
  action: string
  user_number: string
  created_at: string
  metadata: {
    error?: string
    message?: string
    stack?: string
    [key: string]: unknown
  }
}

export default function ErrorsPage() {
  const [errors, setErrors] = useState<ErrorLog[]>([])
  const [loading, setLoading] = useState(true)

  async function loadErrors() {
    setLoading(true)
    const { data } = await supabase
      .from('usage_logs')
      .select('id, action, user_number, created_at, metadata')
      .ilike('action', '%error%')
      .order('created_at', { ascending: false })
      .limit(50)

    setErrors(data || [])
    setLoading(false)
  }

  useEffect(() => {
    loadErrors()
  }, [])

  function formatTime(dateStr: string) {
    return new Date(dateStr).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  function maskNumber(number: string) {
    if (!number) return '---'
    return number.slice(0, 4) + '...' + number.slice(-4)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            Erros do Sistema
          </CardTitle>
          <Button variant="outline" size="sm" onClick={loadErrors} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Card key={i} className="p-4">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4 mt-2" />
                </Card>
              ))}
            </div>
          ) : errors.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-green-500 font-medium">Nenhum erro encontrado!</p>
              <p className="text-sm text-muted-foreground mt-1">O sistema esta funcionando bem.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {errors.map((error) => (
                <Card key={error.id} className="p-4 border-red-500/20">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="destructive">{error.action}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatTime(error.created_at)}
                    </span>
                  </div>
                  <p className="text-sm font-mono text-muted-foreground mb-2">
                    Usuario: {maskNumber(error.user_number)}
                  </p>
                  {error.metadata?.message && (
                    <p className="text-sm text-red-400">
                      {String(error.metadata.message)}
                    </p>
                  )}
                  {error.metadata?.error && (
                    <p className="text-xs text-muted-foreground mt-2 font-mono">
                      {String(error.metadata.error)}
                    </p>
                  )}
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
