'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { AreaChart, BarChart } from '@/components/charts'
import {
  BarChart3,
  Users,
  Image,
  TrendingUp,
  TrendingDown,
  Calendar,
  Clock,
  RefreshCw,
  Loader2,
  Zap,
} from 'lucide-react'
import { subDays, format, startOfDay, getHours } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface DailyStats {
  date: string
  label: string
  users: number
  stickers: number
}

interface HourlyStats {
  hour: number
  name: string
  value: number
}

interface ComparisonStats {
  current: number
  previous: number
  change: number
  isPositive: boolean
}

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('30')
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([])
  const [hourlyStats, setHourlyStats] = useState<HourlyStats[]>([])
  const [comparison, setComparison] = useState<{
    users: ComparisonStats
    stickers: ComparisonStats
    active: ComparisonStats
  } | null>(null)
  const [peakHour, setPeakHour] = useState<{ hour: number; count: number } | null>(null)

  useEffect(() => {
    fetchData()
  }, [period])

  async function fetchData() {
    setLoading(true)
    const supabase = createClient()
    const days = parseInt(period)
    const now = new Date()
    const startDate = subDays(now, days)
    const previousStart = subDays(startDate, days)

    // Fetch users data
    const { data: currentUsers } = await supabase
      .from('users')
      .select('created_at')
      .gte('created_at', startDate.toISOString())

    const { data: previousUsers } = await supabase
      .from('users')
      .select('created_at')
      .gte('created_at', previousStart.toISOString())
      .lt('created_at', startDate.toISOString())

    // Fetch stickers data
    const { data: currentStickers } = await supabase
      .from('stickers')
      .select('created_at')
      .gte('created_at', startDate.toISOString())

    const { data: previousStickers } = await supabase
      .from('stickers')
      .select('created_at')
      .gte('created_at', previousStart.toISOString())
      .lt('created_at', startDate.toISOString())

    // Fetch active users (last_interaction)
    const { data: currentActive } = await supabase
      .from('users')
      .select('last_interaction')
      .gte('last_interaction', startDate.toISOString())

    const { data: previousActive } = await supabase
      .from('users')
      .select('last_interaction')
      .gte('last_interaction', previousStart.toISOString())
      .lt('last_interaction', startDate.toISOString())

    // Calculate comparison
    const usersChange = previousUsers?.length
      ? ((currentUsers?.length || 0) - previousUsers.length) / previousUsers.length * 100
      : 0

    const stickersChange = previousStickers?.length
      ? ((currentStickers?.length || 0) - previousStickers.length) / previousStickers.length * 100
      : 0

    const activeChange = previousActive?.length
      ? ((currentActive?.length || 0) - previousActive.length) / previousActive.length * 100
      : 0

    setComparison({
      users: {
        current: currentUsers?.length || 0,
        previous: previousUsers?.length || 0,
        change: usersChange,
        isPositive: usersChange >= 0,
      },
      stickers: {
        current: currentStickers?.length || 0,
        previous: previousStickers?.length || 0,
        change: stickersChange,
        isPositive: stickersChange >= 0,
      },
      active: {
        current: currentActive?.length || 0,
        previous: previousActive?.length || 0,
        change: activeChange,
        isPositive: activeChange >= 0,
      },
    })

    // Calculate daily stats
    const dailyData: Record<string, { users: number; stickers: number }> = {}

    for (let i = days - 1; i >= 0; i--) {
      const date = format(subDays(now, i), 'yyyy-MM-dd')
      dailyData[date] = { users: 0, stickers: 0 }
    }

    currentUsers?.forEach(u => {
      const date = format(new Date(u.created_at), 'yyyy-MM-dd')
      if (dailyData[date]) dailyData[date].users++
    })

    currentStickers?.forEach(s => {
      const date = format(new Date(s.created_at), 'yyyy-MM-dd')
      if (dailyData[date]) dailyData[date].stickers++
    })

    const stats: DailyStats[] = Object.entries(dailyData).map(([date, data]) => ({
      date,
      label: format(new Date(date), 'dd/MM', { locale: ptBR }),
      users: data.users,
      stickers: data.stickers,
    }))

    setDailyStats(stats)

    // Calculate hourly distribution
    const hourlyData: number[] = Array(24).fill(0)
    currentStickers?.forEach(s => {
      const hour = getHours(new Date(s.created_at))
      hourlyData[hour]++
    })

    const hourlyStats: HourlyStats[] = hourlyData.map((count, hour) => ({
      hour,
      name: `${hour.toString().padStart(2, '0')}h`,
      value: count,
    }))

    setHourlyStats(hourlyStats)

    // Find peak hour
    const maxHour = hourlyData.reduce(
      (max, count, hour) => (count > max.count ? { hour, count } : max),
      { hour: 0, count: 0 }
    )
    setPeakHour(maxHour)

    setLoading(false)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            Analytics
          </h1>
          <p className="text-muted-foreground">Métricas detalhadas do período</p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[150px]">
              <Calendar className="mr-2 h-4 w-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="14">Últimos 14 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex h-96 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Comparison Cards */}
          {comparison && (
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Novos Usuários</p>
                      <p className="text-3xl font-bold">{comparison.users.current}</p>
                      <div className="flex items-center gap-1 mt-1">
                        {comparison.users.isPositive ? (
                          <TrendingUp className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-red-500" />
                        )}
                        <span
                          className={`text-sm ${
                            comparison.users.isPositive ? 'text-emerald-500' : 'text-red-500'
                          }`}
                        >
                          {comparison.users.change >= 0 ? '+' : ''}
                          {comparison.users.change.toFixed(1)}%
                        </span>
                        <span className="text-xs text-muted-foreground">
                          vs período anterior
                        </span>
                      </div>
                    </div>
                    <Users className="h-10 w-10 text-muted-foreground/50" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Stickers Criados</p>
                      <p className="text-3xl font-bold">{comparison.stickers.current}</p>
                      <div className="flex items-center gap-1 mt-1">
                        {comparison.stickers.isPositive ? (
                          <TrendingUp className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-red-500" />
                        )}
                        <span
                          className={`text-sm ${
                            comparison.stickers.isPositive ? 'text-emerald-500' : 'text-red-500'
                          }`}
                        >
                          {comparison.stickers.change >= 0 ? '+' : ''}
                          {comparison.stickers.change.toFixed(1)}%
                        </span>
                        <span className="text-xs text-muted-foreground">
                          vs período anterior
                        </span>
                      </div>
                    </div>
                    <Image className="h-10 w-10 text-muted-foreground/50" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Usuários Ativos</p>
                      <p className="text-3xl font-bold">{comparison.active.current}</p>
                      <div className="flex items-center gap-1 mt-1">
                        {comparison.active.isPositive ? (
                          <TrendingUp className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-red-500" />
                        )}
                        <span
                          className={`text-sm ${
                            comparison.active.isPositive ? 'text-emerald-500' : 'text-red-500'
                          }`}
                        >
                          {comparison.active.change >= 0 ? '+' : ''}
                          {comparison.active.change.toFixed(1)}%
                        </span>
                        <span className="text-xs text-muted-foreground">
                          vs período anterior
                        </span>
                      </div>
                    </div>
                    <Zap className="h-10 w-10 text-muted-foreground/50" />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Charts */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Novos Usuários por Dia
                </CardTitle>
              </CardHeader>
              <CardContent>
                <AreaChart
                  data={dailyStats.map(d => ({
                    date: d.date,
                    label: d.label,
                    value: d.users,
                  }))}
                  height={300}
                  color="hsl(var(--primary))"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Image className="h-4 w-4" />
                  Stickers por Dia
                </CardTitle>
              </CardHeader>
              <CardContent>
                <AreaChart
                  data={dailyStats.map(d => ({
                    date: d.date,
                    label: d.label,
                    value: d.stickers,
                  }))}
                  height={300}
                  color="hsl(142 76% 36%)"
                />
              </CardContent>
            </Card>
          </div>

          {/* Hourly Distribution */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Distribuição por Hora
                  </CardTitle>
                  <CardDescription>Stickers criados por hora do dia</CardDescription>
                </div>
                {peakHour && (
                  <Badge className="bg-emerald-500/20 text-emerald-300">
                    Pico: {peakHour.hour.toString().padStart(2, '0')}h ({peakHour.count} stickers)
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <BarChart
                data={hourlyStats}
                height={250}
                color="hsl(var(--primary))"
              />
            </CardContent>
          </Card>

          {/* Stats Table */}
          <Card>
            <CardHeader>
              <CardTitle>Dados Diários</CardTitle>
              <CardDescription>Últimos {period} dias</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="pb-2 text-left font-medium">Data</th>
                      <th className="pb-2 text-center font-medium">Novos Usuários</th>
                      <th className="pb-2 text-center font-medium">Stickers</th>
                      <th className="pb-2 text-center font-medium">Stickers/Usuário</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyStats.slice(-14).reverse().map((day) => (
                      <tr key={day.date} className="border-b border-border/50">
                        <td className="py-2 font-mono">{day.label}</td>
                        <td className="py-2 text-center">{day.users}</td>
                        <td className="py-2 text-center">{day.stickers}</td>
                        <td className="py-2 text-center">
                          {day.users > 0 ? (day.stickers / day.users).toFixed(1) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
