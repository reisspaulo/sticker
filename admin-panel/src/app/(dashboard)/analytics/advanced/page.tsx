'use client'

import { useEffect, useState, useMemo } from 'react'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  BarChart3,
  Users,
  Image,
  Clock,
  Calendar,
  RefreshCw,
  Loader2,
  Zap,
  TrendingUp,
  Timer,
  Target,
} from 'lucide-react'
import { subDays, format, getHours, getDay, differenceInMinutes } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const DAYS_OF_WEEK = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab']
const HOURS = Array.from({ length: 24 }, (_, i) => i)

interface HeatmapData {
  stickers: number[][]
  signups: number[][]
  active: number[][]
}

interface HourlyData {
  hour: number
  stickers: number
  signups: number
  conversions: number
  limitReached: number
}

interface TimeToFirstSticker {
  range: string
  count: number
  percentage: number
}

interface RetentionCohort {
  date: string
  total: number
  d1: number
  d7: number
  d30: number
  d1Rate: number
  d7Rate: number
  d30Rate: number
}

export default function AdvancedAnalyticsPage() {
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('30')
  const [activeTab, setActiveTab] = useState('heatmap')

  const [heatmapData, setHeatmapData] = useState<HeatmapData>({
    stickers: Array(7).fill(null).map(() => Array(24).fill(0)),
    signups: Array(7).fill(null).map(() => Array(24).fill(0)),
    active: Array(7).fill(null).map(() => Array(24).fill(0)),
  })

  const [hourlyData, setHourlyData] = useState<HourlyData[]>([])
  const [timeToFirstSticker, setTimeToFirstSticker] = useState<TimeToFirstSticker[]>([])
  const [retentionCohorts, setRetentionCohorts] = useState<RetentionCohort[]>([])
  const [peakTimes, setPeakTimes] = useState<{ stickers: { day: number; hour: number; count: number }; signups: { day: number; hour: number; count: number } }>({
    stickers: { day: 0, hour: 0, count: 0 },
    signups: { day: 0, hour: 0, count: 0 },
  })

  useEffect(() => {
    fetchData()
  }, [period])

  async function fetchData() {
    setLoading(true)
    const supabase = createClient()
    const days = parseInt(period)
    const startDate = subDays(new Date(), days)

    // Fetch users
    const { data: users } = await supabase
      .from('users')
      .select('id, whatsapp_number, created_at, first_sticker_at, last_interaction, subscription_plan')
      .gte('created_at', startDate.toISOString())

    // Fetch stickers
    const { data: stickers } = await supabase
      .from('stickers')
      .select('id, user_number, created_at, tipo')
      .gte('created_at', startDate.toISOString())

    // Fetch usage logs for conversions and limit reached
    const { data: usageLogs } = await supabase
      .from('usage_logs')
      .select('user_number, action, details, created_at')
      .gte('created_at', startDate.toISOString())

    if (!users || !stickers) {
      setLoading(false)
      return
    }

    // Calculate heatmap data
    const stickerHeatmap = Array(7).fill(null).map(() => Array(24).fill(0))
    const signupHeatmap = Array(7).fill(null).map(() => Array(24).fill(0))
    const activeHeatmap = Array(7).fill(null).map(() => Array(24).fill(0))

    stickers.forEach(s => {
      const date = new Date(s.created_at)
      const day = getDay(date)
      const hour = getHours(date)
      stickerHeatmap[day][hour]++
    })

    users.forEach(u => {
      const date = new Date(u.created_at)
      const day = getDay(date)
      const hour = getHours(date)
      signupHeatmap[day][hour]++

      if (u.last_interaction) {
        const lastDate = new Date(u.last_interaction)
        const lastDay = getDay(lastDate)
        const lastHour = getHours(lastDate)
        activeHeatmap[lastDay][lastHour]++
      }
    })

    setHeatmapData({
      stickers: stickerHeatmap,
      signups: signupHeatmap,
      active: activeHeatmap,
    })

    // Find peak times
    let maxStickerCount = 0
    let maxStickerDay = 0
    let maxStickerHour = 0
    let maxSignupCount = 0
    let maxSignupDay = 0
    let maxSignupHour = 0

    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        if (stickerHeatmap[day][hour] > maxStickerCount) {
          maxStickerCount = stickerHeatmap[day][hour]
          maxStickerDay = day
          maxStickerHour = hour
        }
        if (signupHeatmap[day][hour] > maxSignupCount) {
          maxSignupCount = signupHeatmap[day][hour]
          maxSignupDay = day
          maxSignupHour = hour
        }
      }
    }

    setPeakTimes({
      stickers: { day: maxStickerDay, hour: maxStickerHour, count: maxStickerCount },
      signups: { day: maxSignupDay, hour: maxSignupHour, count: maxSignupCount },
    })

    // Calculate hourly totals
    const hourlyTotals: HourlyData[] = HOURS.map(hour => {
      const hourStickers = stickers.filter(s => getHours(new Date(s.created_at)) === hour).length
      const hourSignups = users.filter(u => getHours(new Date(u.created_at)) === hour).length

      const hourConversions = users.filter(u => {
        if (u.subscription_plan === 'free') return false
        // Check if conversion happened in this hour (simplified)
        return getHours(new Date(u.created_at)) === hour
      }).length

      const hourLimitReached = usageLogs?.filter(l => {
        if (l.action !== 'limit_reached') return false
        return getHours(new Date(l.created_at)) === hour
      }).length || 0

      return {
        hour,
        stickers: hourStickers,
        signups: hourSignups,
        conversions: hourConversions,
        limitReached: hourLimitReached,
      }
    })

    setHourlyData(hourlyTotals)

    // Calculate time to first sticker
    const timeRanges = [
      { label: '< 1 min', min: 0, max: 1 },
      { label: '1-5 min', min: 1, max: 5 },
      { label: '5-15 min', min: 5, max: 15 },
      { label: '15-30 min', min: 15, max: 30 },
      { label: '30-60 min', min: 30, max: 60 },
      { label: '1-6 horas', min: 60, max: 360 },
      { label: '6-24 horas', min: 360, max: 1440 },
      { label: '> 24 horas', min: 1440, max: Infinity },
    ]

    const usersWithFirstSticker = users.filter(u => u.first_sticker_at)
    const timeToFirstData: TimeToFirstSticker[] = timeRanges.map(range => {
      const count = usersWithFirstSticker.filter(u => {
        const minutes = differenceInMinutes(new Date(u.first_sticker_at), new Date(u.created_at))
        return minutes >= range.min && minutes < range.max
      }).length

      return {
        range: range.label,
        count,
        percentage: usersWithFirstSticker.length > 0
          ? (count / usersWithFirstSticker.length) * 100
          : 0,
      }
    })

    setTimeToFirstSticker(timeToFirstData)

    // Calculate retention cohorts (last 4 weeks)
    const cohorts: RetentionCohort[] = []
    const now = new Date()

    for (let week = 0; week < 4; week++) {
      const cohortStart = subDays(now, (week + 1) * 7)
      const cohortEnd = subDays(now, week * 7)

      const cohortUsers = users.filter(u => {
        const created = new Date(u.created_at)
        return created >= cohortStart && created < cohortEnd
      })

      if (cohortUsers.length === 0) continue

      const d1Active = cohortUsers.filter(u => {
        if (!u.last_interaction) return false
        const lastActive = new Date(u.last_interaction)
        const created = new Date(u.created_at)
        const daysSinceCreation = Math.floor((lastActive.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))
        return daysSinceCreation >= 1
      }).length

      const d7Active = cohortUsers.filter(u => {
        if (!u.last_interaction) return false
        const lastActive = new Date(u.last_interaction)
        const created = new Date(u.created_at)
        const daysSinceCreation = Math.floor((lastActive.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))
        return daysSinceCreation >= 7
      }).length

      const d30Active = cohortUsers.filter(u => {
        if (!u.last_interaction) return false
        const lastActive = new Date(u.last_interaction)
        const created = new Date(u.created_at)
        const daysSinceCreation = Math.floor((lastActive.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))
        return daysSinceCreation >= 30
      }).length

      cohorts.push({
        date: format(cohortStart, 'dd/MM', { locale: ptBR }),
        total: cohortUsers.length,
        d1: d1Active,
        d7: d7Active,
        d30: d30Active,
        d1Rate: (d1Active / cohortUsers.length) * 100,
        d7Rate: (d7Active / cohortUsers.length) * 100,
        d30Rate: (d30Active / cohortUsers.length) * 100,
      })
    }

    setRetentionCohorts(cohorts.reverse())
    setLoading(false)
  }

  // Get color intensity for heatmap cell
  const getHeatmapColor = (value: number, max: number) => {
    if (max === 0) return 'bg-muted'
    const intensity = value / max
    if (intensity === 0) return 'bg-muted'
    if (intensity < 0.2) return 'bg-emerald-500/20'
    if (intensity < 0.4) return 'bg-emerald-500/40'
    if (intensity < 0.6) return 'bg-emerald-500/60'
    if (intensity < 0.8) return 'bg-emerald-500/80'
    return 'bg-emerald-500'
  }

  const maxStickers = useMemo(() => Math.max(...heatmapData.stickers.flat()), [heatmapData.stickers])
  const maxSignups = useMemo(() => Math.max(...heatmapData.signups.flat()), [heatmapData.signups])
  const maxActive = useMemo(() => Math.max(...heatmapData.active.flat()), [heatmapData.active])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            Analytics Avancado
          </h1>
          <p className="text-muted-foreground">Analise detalhada por hora e dia da semana</p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[150px]">
              <Calendar className="mr-2 h-4 w-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Ultimos 7 dias</SelectItem>
              <SelectItem value="14">Ultimos 14 dias</SelectItem>
              <SelectItem value="30">Ultimos 30 dias</SelectItem>
              <SelectItem value="60">Ultimos 60 dias</SelectItem>
              <SelectItem value="90">Ultimos 90 dias</SelectItem>
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
          {/* Peak Times Summary */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Pico de Stickers</p>
                    <p className="text-2xl font-bold">
                      {DAYS_OF_WEEK[peakTimes.stickers.day]} {peakTimes.stickers.hour.toString().padStart(2, '0')}h
                    </p>
                    <p className="text-sm text-emerald-500">{peakTimes.stickers.count} stickers</p>
                  </div>
                  <Image className="h-10 w-10 text-muted-foreground/50" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Pico de Cadastros</p>
                    <p className="text-2xl font-bold">
                      {DAYS_OF_WEEK[peakTimes.signups.day]} {peakTimes.signups.hour.toString().padStart(2, '0')}h
                    </p>
                    <p className="text-sm text-emerald-500">{peakTimes.signups.count} cadastros</p>
                  </div>
                  <Users className="h-10 w-10 text-muted-foreground/50" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="heatmap">Heatmap</TabsTrigger>
              <TabsTrigger value="hourly">Por Hora</TabsTrigger>
              <TabsTrigger value="firstSticker">Primeiro Sticker</TabsTrigger>
              <TabsTrigger value="retention">Retencao</TabsTrigger>
            </TabsList>

            {/* Heatmap Tab */}
            <TabsContent value="heatmap" className="space-y-6">
              {/* Stickers Heatmap */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Image className="h-4 w-4" />
                    Stickers por Hora e Dia
                  </CardTitle>
                  <CardDescription>Distribuicao de stickers criados</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <div className="min-w-[800px]">
                      {/* Hours header */}
                      <div className="flex mb-1">
                        <div className="w-12"></div>
                        {HOURS.map(hour => (
                          <div key={hour} className="w-8 text-center text-xs text-muted-foreground">
                            {hour.toString().padStart(2, '0')}
                          </div>
                        ))}
                      </div>
                      {/* Rows */}
                      {DAYS_OF_WEEK.map((day, dayIndex) => (
                        <div key={day} className="flex mb-1">
                          <div className="w-12 text-xs text-muted-foreground flex items-center">{day}</div>
                          {HOURS.map(hour => (
                            <div
                              key={hour}
                              className={`w-8 h-6 rounded-sm mx-px ${getHeatmapColor(heatmapData.stickers[dayIndex][hour], maxStickers)}`}
                              title={`${day} ${hour}h: ${heatmapData.stickers[dayIndex][hour]} stickers`}
                            />
                          ))}
                        </div>
                      ))}
                      {/* Legend */}
                      <div className="flex items-center gap-2 mt-4 text-xs text-muted-foreground">
                        <span>Menos</span>
                        <div className="w-4 h-4 rounded-sm bg-muted" />
                        <div className="w-4 h-4 rounded-sm bg-emerald-500/20" />
                        <div className="w-4 h-4 rounded-sm bg-emerald-500/40" />
                        <div className="w-4 h-4 rounded-sm bg-emerald-500/60" />
                        <div className="w-4 h-4 rounded-sm bg-emerald-500/80" />
                        <div className="w-4 h-4 rounded-sm bg-emerald-500" />
                        <span>Mais</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Signups Heatmap */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Cadastros por Hora e Dia
                  </CardTitle>
                  <CardDescription>Distribuicao de novos usuarios</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <div className="min-w-[800px]">
                      <div className="flex mb-1">
                        <div className="w-12"></div>
                        {HOURS.map(hour => (
                          <div key={hour} className="w-8 text-center text-xs text-muted-foreground">
                            {hour.toString().padStart(2, '0')}
                          </div>
                        ))}
                      </div>
                      {DAYS_OF_WEEK.map((day, dayIndex) => (
                        <div key={day} className="flex mb-1">
                          <div className="w-12 text-xs text-muted-foreground flex items-center">{day}</div>
                          {HOURS.map(hour => (
                            <div
                              key={hour}
                              className={`w-8 h-6 rounded-sm mx-px ${getHeatmapColor(heatmapData.signups[dayIndex][hour], maxSignups).replace('emerald', 'blue')}`}
                              title={`${day} ${hour}h: ${heatmapData.signups[dayIndex][hour]} cadastros`}
                            />
                          ))}
                        </div>
                      ))}
                      <div className="flex items-center gap-2 mt-4 text-xs text-muted-foreground">
                        <span>Menos</span>
                        <div className="w-4 h-4 rounded-sm bg-muted" />
                        <div className="w-4 h-4 rounded-sm bg-blue-500/20" />
                        <div className="w-4 h-4 rounded-sm bg-blue-500/40" />
                        <div className="w-4 h-4 rounded-sm bg-blue-500/60" />
                        <div className="w-4 h-4 rounded-sm bg-blue-500/80" />
                        <div className="w-4 h-4 rounded-sm bg-blue-500" />
                        <span>Mais</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Hourly Tab */}
            <TabsContent value="hourly" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Metricas por Hora do Dia
                  </CardTitle>
                  <CardDescription>Agregado de todos os dias do periodo</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="pb-2 text-left font-medium">Hora</th>
                          <th className="pb-2 text-center font-medium">Stickers</th>
                          <th className="pb-2 text-center font-medium">Cadastros</th>
                          <th className="pb-2 text-center font-medium">Limite Atingido</th>
                          <th className="pb-2 text-center font-medium">% Stickers</th>
                        </tr>
                      </thead>
                      <tbody>
                        {hourlyData.map((data) => {
                          const totalStickers = hourlyData.reduce((sum, d) => sum + d.stickers, 0)
                          const percentage = totalStickers > 0 ? (data.stickers / totalStickers) * 100 : 0
                          const isHighActivity = percentage > 6 // Above average (100/24 = ~4.17%)

                          return (
                            <tr key={data.hour} className={`border-b border-border/50 ${isHighActivity ? 'bg-emerald-500/10' : ''}`}>
                              <td className="py-2 font-mono">{data.hour.toString().padStart(2, '0')}:00</td>
                              <td className="py-2 text-center font-medium">{data.stickers}</td>
                              <td className="py-2 text-center">{data.signups}</td>
                              <td className="py-2 text-center text-orange-500">{data.limitReached}</td>
                              <td className="py-2 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-emerald-500"
                                      style={{ width: `${Math.min(percentage * 3, 100)}%` }}
                                    />
                                  </div>
                                  <span className="text-xs text-muted-foreground w-12">
                                    {percentage.toFixed(1)}%
                                  </span>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* First Sticker Tab */}
            <TabsContent value="firstSticker" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Timer className="h-4 w-4" />
                    Tempo ate o Primeiro Sticker
                  </CardTitle>
                  <CardDescription>Quanto tempo apos o cadastro o usuario cria o primeiro sticker</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {timeToFirstSticker.map((data) => (
                      <div key={data.range} className="flex items-center gap-4">
                        <div className="w-24 text-sm text-muted-foreground">{data.range}</div>
                        <div className="flex-1 h-8 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all"
                            style={{ width: `${data.percentage}%` }}
                          />
                        </div>
                        <div className="w-20 text-sm text-right">
                          <span className="font-medium">{data.count}</span>
                          <span className="text-muted-foreground ml-1">({data.percentage.toFixed(1)}%)</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Summary */}
                  <div className="mt-6 pt-4 border-t grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-emerald-500">
                        {timeToFirstSticker.slice(0, 3).reduce((sum, d) => sum + d.count, 0)}
                      </p>
                      <p className="text-xs text-muted-foreground">Em ate 15 min</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-yellow-500">
                        {timeToFirstSticker.slice(3, 5).reduce((sum, d) => sum + d.count, 0)}
                      </p>
                      <p className="text-xs text-muted-foreground">15 min - 1 hora</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-red-500">
                        {timeToFirstSticker.slice(5).reduce((sum, d) => sum + d.count, 0)}
                      </p>
                      <p className="text-xs text-muted-foreground">Mais de 1 hora</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Retention Tab */}
            <TabsContent value="retention" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Retencao por Coorte
                  </CardTitle>
                  <CardDescription>Usuarios que voltaram apos D1, D7 e D30</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="pb-2 text-left font-medium">Semana</th>
                          <th className="pb-2 text-center font-medium">Total</th>
                          <th className="pb-2 text-center font-medium">D1</th>
                          <th className="pb-2 text-center font-medium">D7</th>
                          <th className="pb-2 text-center font-medium">D30</th>
                        </tr>
                      </thead>
                      <tbody>
                        {retentionCohorts.map((cohort) => (
                          <tr key={cohort.date} className="border-b border-border/50">
                            <td className="py-3 font-mono">{cohort.date}</td>
                            <td className="py-3 text-center font-medium">{cohort.total}</td>
                            <td className="py-3 text-center">
                              <div className="flex flex-col items-center">
                                <span className={cohort.d1Rate > 30 ? 'text-emerald-500' : cohort.d1Rate > 15 ? 'text-yellow-500' : 'text-red-500'}>
                                  {cohort.d1Rate.toFixed(0)}%
                                </span>
                                <span className="text-xs text-muted-foreground">({cohort.d1})</span>
                              </div>
                            </td>
                            <td className="py-3 text-center">
                              <div className="flex flex-col items-center">
                                <span className={cohort.d7Rate > 20 ? 'text-emerald-500' : cohort.d7Rate > 10 ? 'text-yellow-500' : 'text-red-500'}>
                                  {cohort.d7Rate.toFixed(0)}%
                                </span>
                                <span className="text-xs text-muted-foreground">({cohort.d7})</span>
                              </div>
                            </td>
                            <td className="py-3 text-center">
                              <div className="flex flex-col items-center">
                                <span className={cohort.d30Rate > 10 ? 'text-emerald-500' : cohort.d30Rate > 5 ? 'text-yellow-500' : 'text-red-500'}>
                                  {cohort.d30Rate.toFixed(0)}%
                                </span>
                                <span className="text-xs text-muted-foreground">({cohort.d30})</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Retention Legend */}
                  <div className="mt-4 flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-emerald-500" />
                      <span>Bom</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-yellow-500" />
                      <span>Medio</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-red-500" />
                      <span>Baixo</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  )
}
