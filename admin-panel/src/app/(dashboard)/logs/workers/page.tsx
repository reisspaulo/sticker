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
  Bot,
  Zap,
  Scan,
  Brain,
  Star,
} from 'lucide-react'
import { format, formatDistanceToNow, subDays, eachDayOfInterval, startOfDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import Link from 'next/link'
import { AreaChart } from '@/components/charts/area-chart'

interface WorkerLog {
  id: string
  worker_name: 'face_worker' | 'emotion_worker'
  status: 'started' | 'completed' | 'failed'
  stickers_processed: number
  stickers_success: number
  stickers_error: number
  faces_detected: number
  celebrities_identified: number
  emotions_classified: number
  duration_ms: number | null
  error_message: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  completed_at: string | null
}

interface WorkerStats {
  total: number
  completed: number
  failed: number
  avgDuration: number
  lastFaceWorker: WorkerLog | null
  lastEmotionWorker: WorkerLog | null
  totalFacesDetected: number
  totalEmotionsClassified: number
  totalCelebritiesIdentified: number
}

interface DailyData {
  date: string
  value: number
  label: string
}

const workerIcons: Record<string, typeof Clock> = {
  'face_worker': Scan,
  'emotion_worker': Brain,
}

const workerDescriptions: Record<string, string> = {
  'face_worker': 'Detecta rostos e identifica celebridades (a cada hora)',
  'emotion_worker': 'Classifica emocoes com LLaVA (todo dia as 03:00)',
}

const workerLabels: Record<string, string> = {
  'face_worker': 'Face Worker',
  'emotion_worker': 'Emotion Worker',
}

export default function WorkerLogsPage() {
  const [logs, setLogs] = useState<WorkerLog[]>([])
  const [loading, setLoading] = useState(true)
  const [workerFilter, setWorkerFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [periodFilter, setPeriodFilter] = useState('week')
  const [stats, setStats] = useState<WorkerStats | null>(null)
  const [expandedLog, setExpandedLog] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [dailyProcessing, setDailyProcessing] = useState<DailyData[]>([])
  const [chartsLoading, setChartsLoading] = useState(true)

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
      .from('worker_logs')
      .select('*')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false })
      .limit(200)

    if (workerFilter !== 'all') {
      query = query.eq('worker_name', workerFilter)
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

    // Get last successful runs for each worker
    const lastFaceWorker = (data || []).find(l =>
      l.worker_name === 'face_worker' && l.status === 'completed'
    ) || null

    const lastEmotionWorker = (data || []).find(l =>
      l.worker_name === 'emotion_worker' && l.status === 'completed'
    ) || null

    // Sum totals
    const totalFacesDetected = completed
      .filter(l => l.worker_name === 'face_worker')
      .reduce((sum, l) => sum + (l.faces_detected || 0), 0)

    const totalEmotionsClassified = completed
      .filter(l => l.worker_name === 'emotion_worker')
      .reduce((sum, l) => sum + (l.emotions_classified || 0), 0)

    const totalCelebritiesIdentified = completed
      .filter(l => l.worker_name === 'face_worker')
      .reduce((sum, l) => sum + (l.celebrities_identified || 0), 0)

    setStats({
      total: data?.length || 0,
      completed: completed.length,
      failed: failed.length,
      avgDuration,
      lastFaceWorker,
      lastEmotionWorker,
      totalFacesDetected,
      totalEmotionsClassified,
      totalCelebritiesIdentified,
    })

    setLoading(false)
  }, [workerFilter, statusFilter, periodFilter])

  const loadChartData = useCallback(async () => {
    setChartsLoading(true)
    const supabase = createClient()

    const today = new Date()
    const sevenDaysAgo = subDays(today, 7)
    const days = eachDayOfInterval({ start: sevenDaysAgo, end: today })

    // Fetch stickers processed per day (using face_classified_at)
    const { data: stickersData } = await supabase
      .from('stickers')
      .select('face_classified_at, emotion_classified_at')
      .gte('face_classified_at', startOfDay(sevenDaysAgo).toISOString())

    // Count per day
    const countsByDay: Record<string, number> = {}
    days.forEach(d => {
      countsByDay[format(d, 'yyyy-MM-dd')] = 0
    })

    stickersData?.forEach(s => {
      if (s.face_classified_at) {
        const day = format(new Date(s.face_classified_at), 'yyyy-MM-dd')
        if (countsByDay[day] !== undefined) {
          countsByDay[day]++
        }
      }
    })

    const chartData: DailyData[] = days.map(d => ({
      date: format(d, 'yyyy-MM-dd'),
      value: countsByDay[format(d, 'yyyy-MM-dd')] || 0,
      label: format(d, 'dd/MM'),
    }))

    setDailyProcessing(chartData)
    setChartsLoading(false)
  }, [])

  useEffect(() => {
    loadLogs()
    loadChartData()
  }, [loadLogs, loadChartData])

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
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    return `${Math.round(ms / 60000)}min`
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
              <Bot className="h-6 w-6 text-purple-500" />
              Workers de IA
            </h1>
            <p className="text-muted-foreground">Face Recognition e Emotion Classification</p>
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
          {/* Last Face Worker */}
          <Card className="border-cyan-500/20">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Face Worker</p>
                  {stats.lastFaceWorker ? (
                    <>
                      <p className="text-lg font-bold text-cyan-400">
                        {stats.lastFaceWorker.faces_detected} rostos
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatTimeAgo(stats.lastFaceWorker.created_at)}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-amber-400">Sem logs ainda</p>
                  )}
                </div>
                <Scan className="h-8 w-8 text-cyan-500/50" />
              </div>
            </CardContent>
          </Card>

          {/* Last Emotion Worker */}
          <Card className="border-purple-500/20">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Emotion Worker</p>
                  {stats.lastEmotionWorker ? (
                    <>
                      <p className="text-lg font-bold text-purple-400">
                        {stats.lastEmotionWorker.emotions_classified} emocoes
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatTimeAgo(stats.lastEmotionWorker.created_at)}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-amber-400">Sem logs ainda</p>
                  )}
                </div>
                <Brain className="h-8 w-8 text-purple-500/50" />
              </div>
            </CardContent>
          </Card>

          {/* Totals */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total no Periodo</p>
                  <p className="text-2xl font-bold">{stats.totalFacesDetected + stats.totalEmotionsClassified}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stats.totalFacesDetected} rostos + {stats.totalEmotionsClassified} emocoes
                  </p>
                </div>
                <CheckCircle className="h-8 w-8 text-emerald-500/50" />
              </div>
            </CardContent>
          </Card>

          {/* Celebrities */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Celebridades</p>
                  <p className="text-2xl font-bold">{stats.totalCelebritiesIdentified}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    identificadas no periodo
                  </p>
                </div>
                <Star className="h-8 w-8 text-yellow-500/50" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Processing Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Stickers Processados (7 dias)</CardTitle>
          <CardDescription>Volume de processamento dos workers</CardDescription>
        </CardHeader>
        <CardContent>
          {chartsLoading ? (
            <div className="h-[200px] flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <AreaChart
              data={dailyProcessing}
              color="hsl(280, 100%, 70%)"
              height={200}
            />
          )}
        </CardContent>
      </Card>

      {/* Worker Schedule Info */}
      <Card className="border-dashed">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <span className="font-medium">Agendamento dos Workers</span>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Scan className="h-5 w-5 text-cyan-500" />
              <div>
                <p className="font-medium">face_worker</p>
                <p className="text-sm text-muted-foreground">A cada hora (cron 0 * * * *)</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Brain className="h-5 w-5 text-purple-500" />
              <div>
                <p className="font-medium">emotion_worker (LLaVA)</p>
                <p className="text-sm text-muted-foreground">Todo dia as 03:00 (cron 0 3 * * *)</p>
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
            <Select value={workerFilter} onValueChange={setWorkerFilter}>
              <SelectTrigger className="w-[200px]">
                <Server className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Filtrar worker" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os workers</SelectItem>
                <SelectItem value="face_worker">Face Worker</SelectItem>
                <SelectItem value="emotion_worker">Emotion Worker</SelectItem>
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
              <Bot className="h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground">Nenhuma execucao encontrada</p>
              <p className="text-sm text-muted-foreground">
                Os workers ainda nao logaram no Supabase. Configure os scripts para salvar logs.
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-3">
                {logs.map((log) => {
                  const StatusIcon = getStatusIcon(log.status)
                  const WorkerIcon = workerIcons[log.worker_name] || Bot
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
                            <WorkerIcon className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium">{workerLabels[log.worker_name] || log.worker_name}</span>
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
                            {log.status === 'completed' && (
                              <p className="text-sm mt-2 opacity-80">
                                {log.stickers_processed} processados
                                {log.worker_name === 'face_worker' && (
                                  <> | {log.faces_detected} rostos | {log.celebrities_identified} celebridades</>
                                )}
                                {log.worker_name === 'emotion_worker' && (
                                  <> | {log.emotions_classified} emocoes classificadas</>
                                )}
                              </p>
                            )}

                            {/* Error message */}
                            {log.status === 'failed' && log.error_message && (
                              <p className={`text-sm mt-2 text-red-300 ${isExpanded ? '' : 'line-clamp-2'}`}>
                                {log.error_message}
                              </p>
                            )}

                            {/* Expanded details */}
                            {isExpanded && log.metadata && Object.keys(log.metadata).length > 0 && (
                              <div className="mt-2">
                                <p className="text-xs font-medium mb-1">Metadata:</p>
                                <pre className="text-xs p-2 bg-black/20 rounded overflow-x-auto">
                                  {JSON.stringify(log.metadata, null, 2)}
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
