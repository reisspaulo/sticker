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
  AlertCircle,
  RefreshCw,
  Search,
  Clock,
  Loader2,
  CheckCircle,
  ArrowLeft,
  XCircle,
  AlertTriangle,
  Bug,
  TrendingUp,
  TrendingDown,
} from 'lucide-react'
import { format, subDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import Link from 'next/link'

interface ErrorLog {
  id: string
  action: string
  user_number: string
  created_at: string
  details: {
    error?: string
    message?: string
    stack?: string
    type?: string
    [key: string]: unknown
  } | null
}

interface ErrorStats {
  total: number
  today: number
  yesterday: number
  change: number
  byType: Record<string, number>
}

export default function ErrorsPage() {
  const [errors, setErrors] = useState<ErrorLog[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [periodFilter, setPeriodFilter] = useState('today')
  const [stats, setStats] = useState<ErrorStats | null>(null)
  const [expandedError, setExpandedError] = useState<string | null>(null)

  const loadErrors = useCallback(async () => {
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

    // Fetch errors
    let query = supabase
      .from('usage_logs')
      .select('id, action, user_number, created_at, details')
      .ilike('action', '%error%')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false })
      .limit(200)

    if (search) {
      query = query.ilike('user_number', `%${search}%`)
    }

    const { data } = await query

    setErrors(data || [])

    // Calculate stats
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const yesterday = subDays(today, 1)

    const todayErrors = (data || []).filter(e => new Date(e.created_at) >= today).length
    const yesterdayQuery = await supabase
      .from('usage_logs')
      .select('id')
      .ilike('action', '%error%')
      .gte('created_at', yesterday.toISOString())
      .lt('created_at', today.toISOString())

    const yesterdayErrors = yesterdayQuery.data?.length || 0
    const change = yesterdayErrors > 0
      ? ((todayErrors - yesterdayErrors) / yesterdayErrors) * 100
      : 0

    // Group by type
    const byType: Record<string, number> = {}
    data?.forEach(e => {
      const type = e.action.replace('_error', '').replace('error_', '')
      byType[type] = (byType[type] || 0) + 1
    })

    setStats({
      total: data?.length || 0,
      today: todayErrors,
      yesterday: yesterdayErrors,
      change,
      byType,
    })

    setLoading(false)
  }, [periodFilter, search])

  useEffect(() => {
    loadErrors()
  }, [loadErrors])

  function formatTime(dateStr: string) {
    return format(new Date(dateStr), 'HH:mm:ss', { locale: ptBR })
  }

  function formatDate(dateStr: string) {
    return format(new Date(dateStr), 'dd/MM/yyyy', { locale: ptBR })
  }

  function maskNumber(number: string) {
    if (!number) return '---'
    return number.replace(/^55/, '+55 ').replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
  }

  function getErrorSeverity(action: string): 'critical' | 'warning' | 'info' {
    if (action.includes('fatal') || action.includes('critical')) return 'critical'
    if (action.includes('warning')) return 'warning'
    return 'info'
  }

  function getSeverityColor(severity: string) {
    switch (severity) {
      case 'critical':
        return 'bg-red-500/20 text-red-300 border-red-500/30'
      case 'warning':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30'
      default:
        return 'bg-orange-500/20 text-orange-300 border-orange-500/30'
    }
  }

  function getSeverityIcon(severity: string) {
    switch (severity) {
      case 'critical':
        return XCircle
      case 'warning':
        return AlertTriangle
      default:
        return Bug
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
              <AlertCircle className="h-6 w-6 text-red-500" />
              Erros do Sistema
            </h1>
            <p className="text-muted-foreground">Monitoramento de erros</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={loadErrors} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-red-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Erros no Periodo</p>
                  <p className="text-3xl font-bold text-red-500">{stats.total}</p>
                </div>
                <AlertCircle className="h-10 w-10 text-red-500/50" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Hoje</p>
                  <p className="text-2xl font-bold">{stats.today}</p>
                  {stats.change !== 0 && (
                    <div className="flex items-center gap-1 mt-1">
                      {stats.change > 0 ? (
                        <TrendingUp className="h-3 w-3 text-red-500" />
                      ) : (
                        <TrendingDown className="h-3 w-3 text-emerald-500" />
                      )}
                      <span
                        className={`text-xs ${
                          stats.change > 0 ? 'text-red-500' : 'text-emerald-500'
                        }`}
                      >
                        {stats.change > 0 ? '+' : ''}{stats.change.toFixed(0)}%
                      </span>
                    </div>
                  )}
                </div>
                <Clock className="h-8 w-8 text-muted-foreground/50" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Ontem</p>
                  <p className="text-2xl font-bold">{stats.yesterday}</p>
                </div>
                <Clock className="h-8 w-8 text-muted-foreground/50" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div>
                <p className="text-sm text-muted-foreground mb-2">Por Tipo</p>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(stats.byType).slice(0, 4).map(([type, count]) => (
                    <Badge key={type} variant="outline" className="text-xs">
                      {type}: {count}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

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
          </div>
        </CardContent>
      </Card>

      {/* Errors List */}
      <Card>
        <CardHeader>
          <CardTitle>Erros Recentes</CardTitle>
          <CardDescription>
            {errors.length} erros no periodo selecionado
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : errors.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center gap-2">
              <CheckCircle className="h-12 w-12 text-emerald-500" />
              <p className="text-emerald-500 font-medium">Nenhum erro encontrado!</p>
              <p className="text-sm text-muted-foreground">O sistema esta funcionando bem.</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-3">
                {errors.map((error) => {
                  const severity = getErrorSeverity(error.action)
                  const Icon = getSeverityIcon(severity)
                  const isExpanded = expandedError === error.id

                  return (
                    <div
                      key={error.id}
                      className={`rounded-lg border p-4 cursor-pointer transition-all ${getSeverityColor(severity)}`}
                      onClick={() => setExpandedError(isExpanded ? null : error.id)}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <Icon className="h-5 w-5 shrink-0 mt-0.5" />
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="destructive" className="text-xs">
                                {error.action.replace(/_/g, ' ')}
                              </Badge>
                              <span className="text-xs font-mono opacity-70">
                                {maskNumber(error.user_number)}
                              </span>
                            </div>
                            {error.details?.message && (
                              <p className="text-sm mt-2 font-medium">
                                {String(error.details.message)}
                              </p>
                            )}
                            {error.details?.error && (
                              <p className={`text-xs mt-1 opacity-70 ${isExpanded ? '' : 'line-clamp-2'}`}>
                                {String(error.details.error)}
                              </p>
                            )}
                            {isExpanded && error.details?.stack && (
                              <pre className="text-xs mt-2 p-2 bg-black/20 rounded overflow-x-auto">
                                {String(error.details.stack)}
                              </pre>
                            )}
                            {isExpanded && error.details && (
                              <div className="mt-2 text-xs opacity-70">
                                <p className="font-medium mb-1">Detalhes:</p>
                                <pre className="p-2 bg-black/20 rounded overflow-x-auto">
                                  {JSON.stringify(error.details, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-mono">{formatTime(error.created_at)}</p>
                          <p className="text-xs opacity-70">{formatDate(error.created_at)}</p>
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
