'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { AreaChart } from '@/components/charts/area-chart'
import { PieChart } from '@/components/charts/pie-chart'
import { BarChart } from '@/components/charts/bar-chart'
import { ActivityHeatmap } from '@/components/charts/activity-heatmap'
import { ConnectionStatusCard } from '@/components/dashboard/connection-status-card'
import {
  Users,
  Image,
  TrendingUp,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Scan,
  Brain,
  CheckCircle,
  Star,
  Bot,
  Clock,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { format, subDays, subMonths, startOfDay, eachDayOfInterval } from 'date-fns'

interface Stats {
  usersToday: number
  usersYesterday: number
  stickersToday: number
  stickersYesterday: number
  totalUsers: number
  totalStickers: number
  pendingClassification: number
  errorsToday: number
}

interface AIStats {
  facesDetectedToday: number
  facesDetectedYesterday: number
  emotionsClassifiedToday: number
  emotionsClassifiedYesterday: number
  approvalRate: number
  celebritiesIdentifiedToday: number
}

interface WorkerStatus {
  name: string
  lastRun: string | null
  status: 'success' | 'error' | 'never'
  processedCount: number
}

interface DailyData {
  date: string
  value: number
  label: string
}

interface StickerTypeData {
  name: string
  value: number
  color: string
  [key: string]: string | number
}

interface RecentActivity {
  id: string
  action: string
  user_number: string
  created_at: string
  metadata: Record<string, unknown>
}

interface HeatmapData {
  date: string
  count: number
}

function StatCard({
  title,
  value,
  previousValue,
  icon: Icon,
  loading,
}: {
  title: string
  value: number
  previousValue?: number
  icon: React.ComponentType<{ className?: string }>
  loading: boolean
}) {
  const change = previousValue !== undefined && previousValue > 0
    ? ((value - previousValue) / previousValue) * 100
    : 0
  const isPositive = change >= 0

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <>
            <div className="text-2xl font-bold">{value.toLocaleString()}</div>
            {previousValue !== undefined && previousValue > 0 && (
              <p className={`flex items-center text-xs ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                {isPositive ? (
                  <ArrowUpRight className="mr-1 h-3 w-3" />
                ) : (
                  <ArrowDownRight className="mr-1 h-3 w-3" />
                )}
                {Math.abs(change).toFixed(1)}% vs ontem
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({
    usersToday: 0,
    usersYesterday: 0,
    stickersToday: 0,
    stickersYesterday: 0,
    totalUsers: 0,
    totalStickers: 0,
    pendingClassification: 0,
    errorsToday: 0,
  })
  const [usersDaily, setUsersDaily] = useState<DailyData[]>([])
  const [stickersDaily, setStickersDaily] = useState<DailyData[]>([])
  const [stickerTypes, setStickerTypes] = useState<StickerTypeData[]>([])
  const [topCelebrities, setTopCelebrities] = useState<{ name: string; value: number }[]>([])
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([])
  const [heatmapData, setHeatmapData] = useState<HeatmapData[]>([])
  const [aiStats, setAIStats] = useState<AIStats>({
    facesDetectedToday: 0,
    facesDetectedYesterday: 0,
    emotionsClassifiedToday: 0,
    emotionsClassifiedYesterday: 0,
    approvalRate: 0,
    celebritiesIdentifiedToday: 0,
  })
  const [workerStatus, setWorkerStatus] = useState<WorkerStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [chartsLoading, setChartsLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    async function loadStats() {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayISO = today.toISOString()

      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayISO = yesterday.toISOString()

      const [
        usersTodayRes,
        usersYesterdayRes,
        stickersTodayRes,
        stickersYesterdayRes,
        totalUsersRes,
        totalStickersRes,
        pendingRes,
        errorsTodayRes,
        activityRes,
      ] = await Promise.all([
        supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', todayISO),
        supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', yesterdayISO)
          .lt('created_at', todayISO),
        supabase
          .from('stickers')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', todayISO),
        supabase
          .from('stickers')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', yesterdayISO)
          .lt('created_at', todayISO),
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('stickers').select('*', { count: 'exact', head: true }),
        supabase
          .from('stickers')
          .select('*', { count: 'exact', head: true })
          .eq('face_detected', true)
          .or('emotion_approved.is.null,emotion_approved.eq.false'),
        supabase
          .from('usage_logs')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', todayISO)
          .ilike('action', '%error%'),
        supabase
          .from('usage_logs')
          .select('id, action, user_number, created_at, metadata')
          .order('created_at', { ascending: false })
          .limit(10),
      ])

      setStats({
        usersToday: usersTodayRes.count || 0,
        usersYesterday: usersYesterdayRes.count || 0,
        stickersToday: stickersTodayRes.count || 0,
        stickersYesterday: stickersYesterdayRes.count || 0,
        totalUsers: totalUsersRes.count || 0,
        totalStickers: totalStickersRes.count || 0,
        pendingClassification: pendingRes.count || 0,
        errorsToday: errorsTodayRes.count || 0,
      })

      setRecentActivity(activityRes.data || [])

      // Load AI Stats
      const [
        facesTodayRes,
        facesYesterdayRes,
        emotionsTodayRes,
        emotionsYesterdayRes,
        approvedRes,
        totalClassifiedRes,
        celebsTodayRes,
      ] = await Promise.all([
        // Rostos detectados hoje
        supabase
          .from('stickers')
          .select('*', { count: 'exact', head: true })
          .gte('face_classified_at', todayISO)
          .eq('face_detected', true),
        // Rostos detectados ontem
        supabase
          .from('stickers')
          .select('*', { count: 'exact', head: true })
          .gte('face_classified_at', yesterdayISO)
          .lt('face_classified_at', todayISO)
          .eq('face_detected', true),
        // Emoções classificadas hoje
        supabase
          .from('stickers')
          .select('*', { count: 'exact', head: true })
          .gte('emotion_classified_at', todayISO)
          .not('emotion_tags', 'is', null),
        // Emoções classificadas ontem
        supabase
          .from('stickers')
          .select('*', { count: 'exact', head: true })
          .gte('emotion_classified_at', yesterdayISO)
          .lt('emotion_classified_at', todayISO)
          .not('emotion_tags', 'is', null),
        // Total aprovados
        supabase
          .from('stickers')
          .select('*', { count: 'exact', head: true })
          .eq('emotion_approved', true),
        // Total classificados
        supabase
          .from('stickers')
          .select('*', { count: 'exact', head: true })
          .not('emotion_tags', 'is', null),
        // Celebridades identificadas hoje
        supabase
          .from('stickers')
          .select('*', { count: 'exact', head: true })
          .gte('face_classified_at', todayISO)
          .not('celebrity_id', 'is', null),
      ])

      const totalClassified = totalClassifiedRes.count || 0
      const totalApproved = approvedRes.count || 0
      const approvalRate = totalClassified > 0 ? Math.round((totalApproved / totalClassified) * 100) : 0

      setAIStats({
        facesDetectedToday: facesTodayRes.count || 0,
        facesDetectedYesterday: facesYesterdayRes.count || 0,
        emotionsClassifiedToday: emotionsTodayRes.count || 0,
        emotionsClassifiedYesterday: emotionsYesterdayRes.count || 0,
        approvalRate,
        celebritiesIdentifiedToday: celebsTodayRes.count || 0,
      })

      // Load Worker Status (using MAX timestamps from stickers as proxy)
      const [lastFaceRun, lastEmotionRun] = await Promise.all([
        supabase
          .from('stickers')
          .select('face_classified_at')
          .not('face_classified_at', 'is', null)
          .order('face_classified_at', { ascending: false })
          .limit(1)
          .single(),
        supabase
          .from('stickers')
          .select('emotion_classified_at')
          .not('emotion_classified_at', 'is', null)
          .order('emotion_classified_at', { ascending: false })
          .limit(1)
          .single(),
      ])

      setWorkerStatus([
        {
          name: 'Face Worker',
          lastRun: lastFaceRun.data?.face_classified_at || null,
          status: lastFaceRun.data ? 'success' : 'never',
          processedCount: facesTodayRes.count || 0,
        },
        {
          name: 'Emotion Worker',
          lastRun: lastEmotionRun.data?.emotion_classified_at || null,
          status: lastEmotionRun.data ? 'success' : 'never',
          processedCount: emotionsTodayRes.count || 0,
        },
      ])

      setLoading(false)
    }

    async function loadChartData() {
      const today = new Date()
      const thirtyDaysAgo = subDays(today, 30)
      const thirtyDaysAgoISO = startOfDay(thirtyDaysAgo).toISOString()

      // Get all days in range for proper labels
      const days = eachDayOfInterval({ start: thirtyDaysAgo, end: today })
      const dayLabels = days.map(d => format(d, 'dd/MM'))

      // Fetch users created in last 30 days
      const { data: usersData } = await supabase
        .from('users')
        .select('created_at')
        .gte('created_at', thirtyDaysAgoISO)
        .order('created_at', { ascending: true })

      // Fetch stickers created in last 30 days
      const { data: stickersData } = await supabase
        .from('stickers')
        .select('created_at, tipo')
        .gte('created_at', thirtyDaysAgoISO)
        .order('created_at', { ascending: true })

      // Count users per day
      const usersByDay: Record<string, number> = {}
      days.forEach(d => {
        usersByDay[format(d, 'yyyy-MM-dd')] = 0
      })
      usersData?.forEach(u => {
        const day = format(new Date(u.created_at), 'yyyy-MM-dd')
        if (usersByDay[day] !== undefined) {
          usersByDay[day]++
        }
      })

      const usersChartData: DailyData[] = days.map(d => ({
        date: format(d, 'yyyy-MM-dd'),
        value: usersByDay[format(d, 'yyyy-MM-dd')] || 0,
        label: format(d, 'dd/MM'),
      }))
      setUsersDaily(usersChartData)

      // Count stickers per day
      const stickersByDay: Record<string, number> = {}
      days.forEach(d => {
        stickersByDay[format(d, 'yyyy-MM-dd')] = 0
      })
      stickersData?.forEach(s => {
        const day = format(new Date(s.created_at), 'yyyy-MM-dd')
        if (stickersByDay[day] !== undefined) {
          stickersByDay[day]++
        }
      })

      const stickersChartData: DailyData[] = days.map(d => ({
        date: format(d, 'yyyy-MM-dd'),
        value: stickersByDay[format(d, 'yyyy-MM-dd')] || 0,
        label: format(d, 'dd/MM'),
      }))
      setStickersDaily(stickersChartData)

      // Count stickers by type
      let staticCount = 0
      let animatedCount = 0
      stickersData?.forEach(s => {
        if (s.tipo === 'animado') {
          animatedCount++
        } else {
          staticCount++
        }
      })

      // Get total counts (not just last 30 days)
      const [staticRes, animatedRes] = await Promise.all([
        supabase.from('stickers').select('*', { count: 'exact', head: true }).eq('tipo', 'estatico'),
        supabase.from('stickers').select('*', { count: 'exact', head: true }).eq('tipo', 'animado'),
      ])

      setStickerTypes([
        { name: 'Estáticos', value: staticRes.count || 0, color: 'hsl(var(--primary))' },
        { name: 'Animados', value: animatedRes.count || 0, color: 'hsl(142, 76%, 36%)' },
      ])

      // Top celebrities
      const { data: celebData } = await supabase
        .from('celebrities')
        .select('name, stickers:stickers(count)')
        .order('name')

      if (celebData) {
        const celebCounts = celebData
          .map(c => ({
            name: c.name,
            value: Array.isArray(c.stickers) ? c.stickers.length : (c.stickers as any)?.count || 0,
          }))
          .filter(c => c.value > 0)
          .sort((a, b) => b.value - a.value)
          .slice(0, 5)

        setTopCelebrities(celebCounts)
      }

      // Fetch heatmap data (last 12 months)
      const twelveMonthsAgo = subMonths(new Date(), 12)
      const { data: heatmapStickers } = await supabase
        .from('stickers')
        .select('created_at')
        .gte('created_at', twelveMonthsAgo.toISOString())

      // Group by date for heatmap
      const dateCounts: Record<string, number> = {}
      heatmapStickers?.forEach(sticker => {
        const date = format(new Date(sticker.created_at), 'yyyy-MM-dd')
        dateCounts[date] = (dateCounts[date] || 0) + 1
      })

      const heatmapArray: HeatmapData[] = Object.entries(dateCounts).map(([date, count]) => ({
        date,
        count,
      }))
      setHeatmapData(heatmapArray)

      setChartsLoading(false)
    }

    loadStats()
    loadChartData()

    // Refresh stats every 30 seconds
    const interval = setInterval(loadStats, 30000)
    return () => clearInterval(interval)
  }, [])

  function formatTimeAgo(dateStr: string) {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMin / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMin < 1) return 'agora'
    if (diffMin < 60) return `há ${diffMin}min`
    if (diffHours < 24) return `há ${diffHours}h`
    return `há ${diffDays}d`
  }

  function formatAction(action: string) {
    const actions: Record<string, string> = {
      sticker_created: 'Criou sticker',
      sticker_sent: 'Recebeu sticker',
      message_received: 'Enviou mensagem',
      upgrade_started: 'Iniciou upgrade',
      payment_completed: 'Pagamento confirmado',
      error: 'Erro',
    }
    return actions[action] || action
  }

  function maskNumber(number: string) {
    if (!number) return '---'
    return number.slice(0, 4) + '...' + number.slice(-4)
  }

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Usuários Hoje"
          value={stats.usersToday}
          previousValue={stats.usersYesterday}
          icon={Users}
          loading={loading}
        />
        <StatCard
          title="Stickers Hoje"
          value={stats.stickersToday}
          previousValue={stats.stickersYesterday}
          icon={Image}
          loading={loading}
        />
        <StatCard
          title="Pendente Classificação"
          value={stats.pendingClassification}
          icon={TrendingUp}
          loading={loading}
        />
        <StatCard
          title="Erros Hoje"
          value={stats.errorsToday}
          icon={AlertCircle}
          loading={loading}
        />
      </div>

      {/* AI Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Rostos Detectados Hoje"
          value={aiStats.facesDetectedToday}
          previousValue={aiStats.facesDetectedYesterday}
          icon={Scan}
          loading={loading}
        />
        <StatCard
          title="Emoções IA Hoje"
          value={aiStats.emotionsClassifiedToday}
          previousValue={aiStats.emotionsClassifiedYesterday}
          icon={Brain}
          loading={loading}
        />
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Taxa de Aprovação
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">{aiStats.approvalRate}%</div>
                <p className="text-xs text-muted-foreground">
                  Aprovados do total classificado
                </p>
              </>
            )}
          </CardContent>
        </Card>
        <StatCard
          title="Celebridades Hoje"
          value={aiStats.celebritiesIdentifiedToday}
          icon={Star}
          loading={loading}
        />
      </div>

      {/* WhatsApp Connection Status */}
      <ConnectionStatusCard />

      {/* Workers Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="h-4 w-4" />
            Status dos Workers de IA
          </CardTitle>
          <CardDescription>
            Última execução e processamento dos workers
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex gap-4">
              <Skeleton className="h-20 flex-1" />
              <Skeleton className="h-20 flex-1" />
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {workerStatus.map((worker) => (
                <div
                  key={worker.name}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="space-y-1">
                    <p className="font-medium">{worker.name}</p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {worker.lastRun ? formatTimeAgo(worker.lastRun) : 'Nunca executou'}
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <Badge
                      variant={worker.status === 'success' ? 'default' : 'secondary'}
                      className={worker.status === 'success' ? 'bg-green-500/20 text-green-400' : ''}
                    >
                      {worker.status === 'success' ? 'Ativo' : 'Inativo'}
                    </Badge>
                    <p className="text-sm text-muted-foreground">
                      {worker.processedCount} hoje
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Activity Heatmap */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4" />
            Atividade Geral (12 meses)
          </CardTitle>
          <CardDescription>
            Frequência de criação de stickers por dia
          </CardDescription>
        </CardHeader>
        <CardContent>
          {chartsLoading ? (
            <Skeleton className="h-[150px] w-full" />
          ) : (
            <ActivityHeatmap
              data={heatmapData}
              months={12}
              colorScheme="green"
            />
          )}
        </CardContent>
      </Card>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Users Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Novos Usuários (30 dias)</CardTitle>
          </CardHeader>
          <CardContent>
            {chartsLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <AreaChart
                data={usersDaily}
                color="hsl(47, 100%, 50%)"
                height={300}
              />
            )}
          </CardContent>
        </Card>

        {/* Stickers Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Stickers Criados (30 dias)</CardTitle>
          </CardHeader>
          <CardContent>
            {chartsLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <AreaChart
                data={stickersDaily}
                color="hsl(142, 76%, 36%)"
                height={300}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Second Charts Row */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Sticker Types Pie */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Stickers por Tipo</CardTitle>
          </CardHeader>
          <CardContent>
            {chartsLoading ? (
              <Skeleton className="h-[250px] w-full" />
            ) : (
              <PieChart
                data={stickerTypes}
                height={250}
                innerRadius={50}
              />
            )}
          </CardContent>
        </Card>

        {/* Top Celebrities */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Top Celebridades</CardTitle>
          </CardHeader>
          <CardContent>
            {chartsLoading ? (
              <Skeleton className="h-[250px] w-full" />
            ) : topCelebrities.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhuma celebridade com stickers</p>
            ) : (
              <BarChart
                data={topCelebrities}
                color="hsl(var(--primary))"
                height={250}
                horizontal
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Totals + Activity Row */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Totals */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Totais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total de Usuários</span>
              {loading ? (
                <Skeleton className="h-6 w-16" />
              ) : (
                <span className="text-xl font-bold">{stats.totalUsers.toLocaleString()}</span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total de Stickers</span>
              {loading ? (
                <Skeleton className="h-6 w-16" />
              ) : (
                <span className="text-xl font-bold">{stats.totalStickers.toLocaleString()}</span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Média por Usuário</span>
              {loading ? (
                <Skeleton className="h-6 w-16" />
              ) : (
                <span className="text-xl font-bold">
                  {stats.totalUsers > 0
                    ? (stats.totalStickers / stats.totalUsers).toFixed(1)
                    : '0'}
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Atividade Recente</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-20 ml-auto" />
                  </div>
                ))}
              </div>
            ) : recentActivity.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhuma atividade recente</p>
            ) : (
              <div className="space-y-3">
                {recentActivity.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-center justify-between border-b border-border pb-3 last:border-0 last:pb-0"
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-muted-foreground w-16">
                        {formatTimeAgo(activity.created_at)}
                      </span>
                      <span className="text-sm">
                        {formatAction(activity.action)}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground font-mono">
                      {maskNumber(activity.user_number)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
