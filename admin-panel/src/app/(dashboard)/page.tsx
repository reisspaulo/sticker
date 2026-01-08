'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Users,
  Image,
  TrendingUp,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react'

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

interface RecentActivity {
  id: string
  action: string
  user_number: string
  created_at: string
  metadata: Record<string, unknown>
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
            {previousValue !== undefined && (
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
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
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
        // Users today
        supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', todayISO),
        // Users yesterday
        supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', yesterdayISO)
          .lt('created_at', todayISO),
        // Stickers today
        supabase
          .from('stickers')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', todayISO),
        // Stickers yesterday
        supabase
          .from('stickers')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', yesterdayISO)
          .lt('created_at', todayISO),
        // Total users
        supabase.from('users').select('*', { count: 'exact', head: true }),
        // Total stickers
        supabase.from('stickers').select('*', { count: 'exact', head: true }),
        // Pending classification
        supabase
          .from('stickers')
          .select('*', { count: 'exact', head: true })
          .eq('face_detected', true)
          .or('emotion_approved.is.null,emotion_approved.eq.false'),
        // Errors today
        supabase
          .from('usage_logs')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', todayISO)
          .eq('action', 'error'),
        // Recent activity
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
      setLoading(false)
    }

    loadStats()
    // Refresh every 30 seconds
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
    if (diffMin < 60) return `ha ${diffMin}min`
    if (diffHours < 24) return `ha ${diffHours}h`
    return `ha ${diffDays}d`
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
          title="Usuarios Hoje"
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
          title="Pendente Classificacao"
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

      {/* Totals */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Total de Usuarios</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-10 w-32" />
            ) : (
              <div className="text-3xl font-bold">{stats.totalUsers.toLocaleString()}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Total de Stickers</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-10 w-32" />
            ) : (
              <div className="text-3xl font-bold">{stats.totalStickers.toLocaleString()}</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
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
  )
}
