'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { FileText, RefreshCw } from 'lucide-react'

interface Log {
  id: string
  action: string
  user_number: string
  created_at: string
  metadata: Record<string, unknown>
}

export default function LogsPage() {
  const [logs, setLogs] = useState<Log[]>([])
  const [loading, setLoading] = useState(true)

  async function loadLogs() {
    setLoading(true)
    const { data } = await supabase
      .from('usage_logs')
      .select('id, action, user_number, created_at, metadata')
      .order('created_at', { ascending: false })
      .limit(100)

    setLogs(data || [])
    setLoading(false)
  }

  useEffect(() => {
    loadLogs()
  }, [])

  function formatTime(dateStr: string) {
    return new Date(dateStr).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  function getActionColor(action: string) {
    if (action.includes('error')) return 'bg-red-500/20 text-red-400'
    if (action.includes('created') || action.includes('completed')) return 'bg-green-500/20 text-green-400'
    if (action.includes('started')) return 'bg-blue-500/20 text-blue-400'
    return 'bg-gray-500/20 text-gray-400'
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
            <FileText className="h-5 w-5" />
            Logs do Sistema
          </CardTitle>
          <Button variant="outline" size="sm" onClick={loadLogs} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          ) : logs.length === 0 ? (
            <p className="text-muted-foreground">Nenhum log encontrado.</p>
          ) : (
            <div className="divide-y divide-border">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center gap-4 py-3 first:pt-0 last:pb-0"
                >
                  <span className="text-xs text-muted-foreground w-32 shrink-0 font-mono">
                    {formatTime(log.created_at)}
                  </span>
                  <Badge variant="secondary" className={getActionColor(log.action)}>
                    {log.action}
                  </Badge>
                  <span className="text-sm text-muted-foreground font-mono">
                    {maskNumber(log.user_number)}
                  </span>
                  {log.metadata && Object.keys(log.metadata).length > 0 && (
                    <span className="text-xs text-muted-foreground truncate max-w-xs">
                      {JSON.stringify(log.metadata)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
