'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Clock,
  RefreshCw,
  Loader2,
  CheckCircle,
  XCircle,
  ArrowLeft,
  Timer,
  Server,
  PlayCircle,
  CalendarClock,
  Zap,
  Send,
  RotateCcw,
} from 'lucide-react'
import { format, formatDistanceToNow, subDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import Link from 'next/link'

interface JobLog {
  id: string
  job_name: string
  status: 'started' | 'completed' | 'failed'
  result: Record<string, unknown> | null
  error_message: string | null
  error_stack: string | null
  duration_ms: number | null
  worker_id: string | null
  created_at: string
  completed_at: string | null
}

interface JobStats {
  total: number
  completed: number
  failed: number
  avgDuration: number
  lastReset: JobLog | null
  lastSendPending: JobLog | null
}

const jobIcons: Record<string, typeof Clock> = {
  'reset-daily-counters': RotateCcw,
  'send-pending-stickers': Send,
}

const jobDescriptions: Record<string, string> = {
  'reset-daily-counters': 'Reseta contadores diarios dos usuarios (00:00)',
  'send-pending-stickers': 'Envia figurinhas pendentes (08:00)',
}

export default function JobLogsPage() {
  const [logs, setLogs] = useState<JobLog[]>([])
  const [loading, setLoading] = useState(true)
  const [jobFilter, setJobFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [periodFilter, setPeriodFilter] = useState('week')
  const [stats, setStats] = useState<JobStats | null>(null)
  const [expandedLog, setExpandedLog] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(false)

  const loadLogs = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

    // Calculate date range
    let startDate: Date
    switch (periodFilter) {
      case 'today':
        startDate = new Date()
        startDate.setHours(0, 0, 0, 0)
        break
      case 'yesterday':
        startDate = subDays(new Date(), 1)
        startDate.setHours(0, 0, 0, 0)
        break
      case 'week':
        startDate = subDays(new Date(), 7)
        break
      case 'month':
        startDate = subDays(new Date(), 30)
        break
      default:
        startDate = subDays(new Date(), 7)
    }

    // Build query
    let query = supabase
      .from('job_logs')
      .select('*')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false })
      .limit(200)

    if (jobFilter !== 'all') {
      query = query.eq('job_name', jobFilter)
    }

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter)
    }

    const { data } = await query
    setLogs(data || [])

    // Calculate stats
    const completed = (data || []).filter(l => l.status === 'completed')
    const failed = (data || []).filter(l => l.status === 'failed')
    const durations = completed.filter(l => l.duration_ms).map(l => l.duration_ms as number)
    const avgDuration = durations.length > 0
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 0

    // Get last successful runs for each job
    const lastReset = (data || []).find(l =>
      l.job_name === 'reset-daily-counters' && l.status === 'completed'
    ) || null

    const lastSendPending = (data || []).find(l =>
      l.job_name === 'send-pending-stickers' && l.status === 'completed'
    ) || null

    setStats({
      total: data?.length || 0,
      completed: completed.length,
      failed: failed.length,
      avgDuration,
      lastReset,
      lastSendPending,
    })

    setLoading(false)
  }, [jobFilter, statusFilter, periodFilter])

  useEffect(() => {
    loadLogs()
  }, [loadLogs])

  // Auto-refresh every 60 seconds if enabled
  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(loadLogs, 60000)
    return () => clearInterval(interval)
  }, [autoRefresh, loadLogs])

  function formatTime(dateStr: string) {
    return format(new Date(dateStr), 'HH:mm:ss', { locale: ptBR })
  }

  function formatDate(dateStr: string) {
    return format(new Date(dateStr), 'dd/MM/yyyy', { locale: ptBR })
  }

  function formatDuration(ms: number | null) {
    if (!ms) return '-'
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(2)}s`
  }

  function formatTimeAgo(dateStr: string) {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: ptBR })
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'completed':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
      case 'failed':
        return 'bg-red-500/20 text-red-300 border-red-500/30'
      case 'started':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30'
      default:
        return 'bg-zinc-500/20 text-zinc-300 border-zinc-500/30'
    }
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case 'completed':
        return CheckCircle
      case 'failed':
        return XCircle
      case 'started':
        return PlayCircle
      default:
        return Clock
    }
  }

  function getStatusLabel(status: string) {
    switch (status) {
      case 'completed':
        return 'Sucesso'
      case 'failed':
        return 'Falhou'
      case 'started':
        return 'Iniciado'
      default:
        return status
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/logs">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <CalendarClock className="h-6 w-6 text-blue-500" />
              Jobs Agendados
            </h1>
            <p className="text-muted-foreground">Monitoramento de tarefas automaticas</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={autoRefresh ? 'default' : 'outline'}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <Zap className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-pulse' : ''}`} />
            {autoRefresh ? 'Auto' : 'Manual'}
          </Button>
          <Button variant="outline" size="sm" onClick={loadLogs} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Last Reset Job */}
          <Card className="border-purple-500/20">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Reset Diario</p>
                  {stats.lastReset ? (
                    <>
                      <p className="text-lg font-bold text-purple-400">
                        {(stats.lastReset.result as Record<string, unknown>)?.users_reset || 0} usuarios
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatTimeAgo(stats.lastReset.created_at)}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-amber-400">Nunca executou</p>
                  )}
                </div>
                <RotateCcw className="h-8 w-8 text-purple-500/50" />
              </div>
            </CardContent>
          </Card>

          {/* Last Send Pending Job */}
          <Card className="border-blue-500/20">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Envio Pendentes</p>
                  {stats.lastSendPending ? (
                    <>
                      <p className="text-lg font-bold text-blue-400">
                        {(stats.lastSendPending.result as Record<string, unknown>)?.sent || 0} enviados
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatTimeAgo(stats.lastSendPending.created_at)}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-amber-400">Nunca executou</p>
                  )}
                </div>
                <Send className="h-8 w-8 text-blue-500/50" />
              </div>
            </CardContent>
          </Card>

          {/* Success Rate */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Taxa de Sucesso</p>
                  <p className="text-2xl font-bold">
                    {stats.total > 0
                      ? `${((stats.completed / stats.total) * 100).toFixed(0)}%`
                      : '-'
                    }
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stats.completed} ok / {stats.failed} falhas
                  </p>
                </div>
                <CheckCircle className="h-8 w-8 text-emerald-500/50" />
              </div>
            </CardContent>
          </Card>

          {/* Avg Duration */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Duracao Media</p>
                  <p className="text-2xl font-bold">{formatDuration(stats.avgDuration)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stats.total} execucoes
                  </p>
                </div>
                <Timer className="h-8 w-8 text-muted-foreground/50" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Job Schedule Info */}
      <Card className="border-dashed">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <span className="font-medium">Agendamento dos Jobs</span>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <RotateCcw className="h-5 w-5 text-purple-500" />
              <div>
                <p className="font-medium">reset-daily-counters</p>
                <p className="text-sm text-muted-foreground">Todo dia as 00:00 (meia-noite)</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Send className="h-5 w-5 text-blue-500" />
              <div>
                <p className="font-medium">send-pending-stickers</p>
                <p className="text-sm text-muted-foreground">Todo dia as 08:00</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <Select value={periodFilter} onValueChange={setPeriodFilter}>
              <SelectTrigger className="w-[150px]">
                <Clock className="mr-2 h-4 w-4" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Hoje</SelectItem>
                <SelectItem value="yesterday">Ontem</SelectItem>
                <SelectItem value="week">Ultima semana</SelectItem>
                <SelectItem value="month">Ultimo mes</SelectItem>
              </SelectContent>
            </Select>
            <Select value={jobFilter} onValueChange={setJobFilter}>
              <SelectTrigger className="w-[220px]">
                <Server className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Filtrar job" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os jobs</SelectItem>
                <SelectItem value="reset-daily-counters">Reset Diario</SelectItem>
                <SelectItem value="send-pending-stickers">Envio Pendentes</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <CheckCircle className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="completed">Sucesso</SelectItem>
                <SelectItem value="failed">Falhou</SelectItem>
                <SelectItem value="started">Iniciado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Logs List */}
      <Card>
        <CardHeader>
          <CardTitle>Historico de Execucoes</CardTitle>
          <CardDescription>
            {logs.length} execucoes no periodo selecionado
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center gap-2">
              <CalendarClock className="h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground">Nenhuma execucao encontrada</p>
              <p className="text-sm text-muted-foreground">Os jobs ainda nao rodaram ou nao ha logs no periodo.</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-3">
                {logs.map((log) => {
                  const StatusIcon = getStatusIcon(log.status)
                  const JobIcon = jobIcons[log.job_name] || Clock
                  const isExpanded = expandedLog === log.id

                  return (
                    <div
                      key={log.id}
                      className={`rounded-lg border p-4 cursor-pointer transition-all hover:bg-muted/50 ${getStatusColor(log.status)}`}
                      onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-lg bg-background/50">
                            <JobIcon className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium">{log.job_name}</span>
                              <Badge variant="outline" className="text-xs">
                                <StatusIcon className="h-3 w-3 mr-1" />
                                {getStatusLabel(log.status)}
                              </Badge>
                              {log.duration_ms && (
                                <Badge variant="secondary" className="text-xs">
                                  <Timer className="h-3 w-3 mr-1" />
                                  {formatDuration(log.duration_ms)}
                                </Badge>
                              )}
                            </div>

                            {/* Result summary */}
                            {log.status === 'completed' && log.result && (
                              <p className="text-sm mt-2 opacity-80">
                                {Object.entries(log.result)
                                  .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`)
                                  .join(' | ')}
                              </p>
                            )}

                            {/* Error message */}
                            {log.status === 'failed' && log.error_message && (
                              <p className={`text-sm mt-2 text-red-300 ${isExpanded ? '' : 'line-clamp-2'}`}>
                                {log.error_message}
                              </p>
                            )}

                            {/* Worker ID */}
                            {log.worker_id && (
                              <p className="text-xs mt-1 opacity-50 font-mono">
                                Worker: {log.worker_id.slice(0, 12)}
                              </p>
                            )}

                            {/* Expanded details */}
                            {isExpanded && log.error_stack && (
                              <pre className="text-xs mt-2 p-2 bg-black/20 rounded overflow-x-auto max-h-40">
                                {log.error_stack}
                              </pre>
                            )}
                            {isExpanded && log.result && Object.keys(log.result).length > 0 && (
                              <div className="mt-2">
                                <p className="text-xs font-medium mb-1">Resultado completo:</p>
                                <pre className="text-xs p-2 bg-black/20 rounded overflow-x-auto">
                                  {JSON.stringify(log.result, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-mono">{formatTime(log.created_at)}</p>
                          <p className="text-xs opacity-70">{formatDate(log.created_at)}</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
