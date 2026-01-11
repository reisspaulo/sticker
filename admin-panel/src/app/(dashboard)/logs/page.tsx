'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  FileText,
  RefreshCw,
  Search,
  Filter,
  Loader2,
  Activity,
  Clock,
  AlertCircle,
  CheckCircle,
  Zap,
  MessageSquare,
  Image,
  Crown,
  CalendarClock,
  Bot,
} from 'lucide-react'
import { formatDistanceToNow, format, subDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import Link from 'next/link'

interface Log {
  id: string
  action: string
  user_number: string
  created_at: string
  details: Record<string, unknown> | null
}

interface ActionStats {
  action: string
  count: number
}

const actionIcons: Record<string, typeof Activity> = {
  sticker_sent: Image,
  sticker_created: Image,
  menu_shown: MessageSquare,
  limit_reached: AlertCircle,
  bonus_used: Zap,
  subscription_started: Crown,
  error: AlertCircle,
  default: Activity,
}

const actionColors: Record<string, string> = {
  sticker_sent: 'bg-emerald-500/20 text-emerald-300',
  sticker_created: 'bg-blue-500/20 text-blue-300',
  menu_shown: 'bg-purple-500/20 text-purple-300',
  limit_reached: 'bg-amber-500/20 text-amber-300',
  bonus_used: 'bg-cyan-500/20 text-cyan-300',
  subscription_started: 'bg-yellow-500/20 text-yellow-300',
  error: 'bg-red-500/20 text-red-300',
  default: 'bg-zinc-500/20 text-zinc-300',
}

export default function LogsPage() {
  const [logs, setLogs] = useState<Log[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('all')
  const [periodFilter, setPeriodFilter] = useState('today')
  const [stats, setStats] = useState<ActionStats[]>([])
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
        startDate = new Date()
        startDate.setHours(0, 0, 0, 0)
    }

    // Build query
    let query = supabase
      .from('usage_logs')
      .select('id, action, user_number, created_at, details')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false })
      .limit(500)

    if (actionFilter !== 'all') {
      query = query.eq('action', actionFilter)
    }

    if (search) {
      query = query.ilike('user_number', `%${search}%`)
    }

    const { data } = await query
    setLogs(data || [])

    // Calculate stats
    const actionCounts: Record<string, number> = {}
    data?.forEach(log => {
      actionCounts[log.action] = (actionCounts[log.action] || 0) + 1
    })

    const statsArray = Object.entries(actionCounts)
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    setStats(statsArray)
    setLoading(false)
  }, [actionFilter, periodFilter, search])

  useEffect(() => {
    loadLogs()
  }, [loadLogs])

  // Auto-refresh every 30 seconds if enabled
  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(loadLogs, 30000)
    return () => clearInterval(interval)
  }, [autoRefresh, loadLogs])

  function formatTime(dateStr: string) {
    return format(new Date(dateStr), 'HH:mm:ss', { locale: ptBR })
  }

  function formatDate(dateStr: string) {
    return format(new Date(dateStr), 'dd/MM', { locale: ptBR })
  }

  function getActionColor(action: string) {
    if (action.includes('error')) return actionColors.error
    for (const [key, color] of Object.entries(actionColors)) {
      if (action.includes(key)) return color
    }
    return actionColors.default
  }

  function getActionIcon(action: string) {
    if (action.includes('error')) return AlertCircle
    for (const [key, Icon] of Object.entries(actionIcons)) {
      if (action.includes(key)) return Icon
    }
    return Activity
  }

  function maskNumber(number: string) {
    if (!number) return '---'
    return number.replace(/^55/, '+55 ').replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
  }

  // Get unique actions for filter
  const uniqueActions = Array.from(new Set(logs.map(l => l.action)))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6" />
            Logs do Sistema
          </h1>
          <p className="text-muted-foreground">Atividades em tempo real</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={autoRefresh ? 'default' : 'outline'}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <Activity className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-pulse' : ''}`} />
            {autoRefresh ? 'Live' : 'Paused'}
          </Button>
          <Button variant="outline" size="sm" onClick={loadLogs} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Logs</p>
                <p className="text-2xl font-bold">{logs.length}</p>
              </div>
              <FileText className="h-8 w-8 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>
        {stats.slice(0, 3).map(stat => {
          const Icon = getActionIcon(stat.action)
          return (
            <Card key={stat.action}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground truncate max-w-[120px]">
                      {stat.action.replace(/_/g, ' ')}
                    </p>
                    <p className="text-2xl font-bold">{stat.count}</p>
                  </div>
                  <Icon className="h-8 w-8 text-muted-foreground/50" />
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por numero..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
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
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Filtrar acao" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas acoes</SelectItem>
                {uniqueActions.map(action => (
                  <SelectItem key={action} value={action}>
                    {action.replace(/_/g, ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Link href="/logs/jobs">
              <Button variant="outline">
                <CalendarClock className="mr-2 h-4 w-4 text-blue-500" />
                Jobs Agendados
              </Button>
            </Link>
            <Link href="/logs/workers">
              <Button variant="outline">
                <Bot className="mr-2 h-4 w-4 text-purple-500" />
                Workers IA
              </Button>
            </Link>
            <Link href="/logs/errors">
              <Button variant="outline">
                <AlertCircle className="mr-2 h-4 w-4 text-red-500" />
                Ver Erros
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Logs List */}
      <Card>
        <CardHeader>
          <CardTitle>Atividades Recentes</CardTitle>
          <CardDescription>
            {logs.length} registros no periodo selecionado
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center gap-2">
              <CheckCircle className="h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground">Nenhum log encontrado</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-2">
                {logs.map((log) => {
                  const Icon = getActionIcon(log.action)
                  return (
                    <div
                      key={log.id}
                      className="flex items-center gap-4 rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                    >
                      <div className={`p-2 rounded-lg ${getActionColor(log.action)}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {log.action.replace(/_/g, ' ')}
                          </Badge>
                          <span className="text-xs text-muted-foreground font-mono">
                            {maskNumber(log.user_number)}
                          </span>
                        </div>
                        {log.details && Object.keys(log.details).length > 0 && (
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            {Object.entries(log.details)
                              .slice(0, 3)
                              .map(([k, v]) => `${k}: ${String(v).slice(0, 30)}`)
                              .join(' | ')}
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-mono">{formatTime(log.created_at)}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(log.created_at)}</p>
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
