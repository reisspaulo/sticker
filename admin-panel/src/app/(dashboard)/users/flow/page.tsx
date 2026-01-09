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
import {
  GitBranch,
  Users,
  Image,
  Crown,
  ArrowDown,
  Loader2,
  TrendingUp,
  TrendingDown,
  Calendar,
  RefreshCw,
} from 'lucide-react'
import { subDays, format, startOfDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface FunnelStep {
  name: string
  count: number
  percentage: number
  dropoff: number
}

interface CohortData {
  date: string
  total: number
  d1: number
  d7: number
  d30: number
}

export default function UsersFlowPage() {
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('30')
  const [funnel, setFunnel] = useState<FunnelStep[]>([])
  const [cohorts, setCohorts] = useState<CohortData[]>([])
  const [abComparison, setAbComparison] = useState<{
    control: { total: number; converted: number; rate: number }
    bonus: { total: number; converted: number; rate: number }
  } | null>(null)

  useEffect(() => {
    fetchData()
  }, [period])

  async function fetchData() {
    setLoading(true)
    const supabase = createClient()
    const days = parseInt(period)
    const startDate = subDays(new Date(), days)

    // Fetch all users in period
    const { data: users } = await supabase
      .from('users')
      .select('id, whatsapp_number, created_at, first_sticker_at, subscription_plan, ab_test_group, last_interaction')
      .gte('created_at', startDate.toISOString())

    // Fetch stickers
    const { data: stickers } = await supabase
      .from('stickers')
      .select('user_number, created_at')
      .gte('created_at', startDate.toISOString())

    // Fetch upgrade events (from usage_logs)
    const { data: upgradeLogs } = await supabase
      .from('usage_logs')
      .select('user_number, action, created_at')
      .in('action', ['upgrade_shown', 'upgrade_clicked', 'subscription_started'])
      .gte('created_at', startDate.toISOString())

    if (!users) {
      setLoading(false)
      return
    }

    // Calculate funnel
    const totalUsers = users.length
    const usersWithStickers = users.filter(u => u.first_sticker_at).length
    const usersWithMultipleStickers = users.filter(u => {
      const userStickers = stickers?.filter(s => s.user_number === u.whatsapp_number) || []
      return userStickers.length >= 3
    }).length
    const usersShownUpgrade = new Set(
      upgradeLogs?.filter(l => l.action === 'upgrade_shown').map(l => l.user_number)
    ).size
    const usersClickedUpgrade = new Set(
      upgradeLogs?.filter(l => l.action === 'upgrade_clicked').map(l => l.user_number)
    ).size
    const usersSubscribed = users.filter(u => u.subscription_plan !== 'free').length

    const funnelData: FunnelStep[] = [
      {
        name: 'Novos usuários',
        count: totalUsers,
        percentage: 100,
        dropoff: 0,
      },
      {
        name: 'Primeiro sticker',
        count: usersWithStickers,
        percentage: totalUsers > 0 ? (usersWithStickers / totalUsers) * 100 : 0,
        dropoff: totalUsers > 0 ? ((totalUsers - usersWithStickers) / totalUsers) * 100 : 0,
      },
      {
        name: '3+ stickers',
        count: usersWithMultipleStickers,
        percentage: totalUsers > 0 ? (usersWithMultipleStickers / totalUsers) * 100 : 0,
        dropoff: usersWithStickers > 0 ? ((usersWithStickers - usersWithMultipleStickers) / usersWithStickers) * 100 : 0,
      },
      {
        name: 'Viu upgrade',
        count: usersShownUpgrade,
        percentage: totalUsers > 0 ? (usersShownUpgrade / totalUsers) * 100 : 0,
        dropoff: usersWithMultipleStickers > 0 ? ((usersWithMultipleStickers - usersShownUpgrade) / usersWithMultipleStickers) * 100 : 0,
      },
      {
        name: 'Clicou upgrade',
        count: usersClickedUpgrade,
        percentage: totalUsers > 0 ? (usersClickedUpgrade / totalUsers) * 100 : 0,
        dropoff: usersShownUpgrade > 0 ? ((usersShownUpgrade - usersClickedUpgrade) / usersShownUpgrade) * 100 : 0,
      },
      {
        name: 'Assinou',
        count: usersSubscribed,
        percentage: totalUsers > 0 ? (usersSubscribed / totalUsers) * 100 : 0,
        dropoff: usersClickedUpgrade > 0 ? ((usersClickedUpgrade - usersSubscribed) / usersClickedUpgrade) * 100 : 0,
      },
    ]

    setFunnel(funnelData)

    // Calculate cohorts (last 7 days)
    const cohortData: CohortData[] = []
    const now = new Date()

    for (let i = 30; i >= 1; i--) {
      const cohortDate = startOfDay(subDays(now, i))
      const nextDay = startOfDay(subDays(now, i - 1))

      const cohortUsers = users.filter(u => {
        const created = new Date(u.created_at)
        return created >= cohortDate && created < nextDay
      })

      if (cohortUsers.length === 0) continue

      const d1Threshold = subDays(cohortDate, -1)
      const d7Threshold = subDays(cohortDate, -7)
      const d30Threshold = subDays(cohortDate, -30)

      const d1Retention = cohortUsers.filter(u => {
        if (!u.last_interaction) return false
        const lastInt = new Date(u.last_interaction)
        return lastInt >= d1Threshold
      }).length

      const d7Retention = cohortUsers.filter(u => {
        if (!u.last_interaction) return false
        const lastInt = new Date(u.last_interaction)
        return lastInt >= d7Threshold
      }).length

      const d30Retention = cohortUsers.filter(u => {
        if (!u.last_interaction) return false
        const lastInt = new Date(u.last_interaction)
        return lastInt >= d30Threshold
      }).length

      cohortData.push({
        date: format(cohortDate, 'dd/MM', { locale: ptBR }),
        total: cohortUsers.length,
        d1: cohortUsers.length > 0 ? Math.round((d1Retention / cohortUsers.length) * 100) : 0,
        d7: cohortUsers.length > 0 ? Math.round((d7Retention / cohortUsers.length) * 100) : 0,
        d30: cohortUsers.length > 0 ? Math.round((d30Retention / cohortUsers.length) * 100) : 0,
      })
    }

    setCohorts(cohortData.slice(-14)) // Last 14 days with data

    // A/B Test comparison
    const controlUsers = users.filter(u => u.ab_test_group === 'control' || !u.ab_test_group)
    const bonusUsers = users.filter(u => u.ab_test_group === 'bonus')

    const controlConverted = controlUsers.filter(u => u.first_sticker_at).length
    const bonusConverted = bonusUsers.filter(u => u.first_sticker_at).length

    setAbComparison({
      control: {
        total: controlUsers.length,
        converted: controlConverted,
        rate: controlUsers.length > 0 ? (controlConverted / controlUsers.length) * 100 : 0,
      },
      bonus: {
        total: bonusUsers.length,
        converted: bonusConverted,
        rate: bonusUsers.length > 0 ? (bonusConverted / bonusUsers.length) * 100 : 0,
      },
    })

    setLoading(false)
  }

  const maxFunnelCount = funnel[0]?.count || 1

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <GitBranch className="h-6 w-6" />
            Fluxo de Usuários
          </h1>
          <p className="text-muted-foreground">Funil de conversão e retenção</p>
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
          {/* Conversion Funnel */}
          <Card>
            <CardHeader>
              <CardTitle>Funil de Conversão</CardTitle>
              <CardDescription>Da chegada até a assinatura</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {funnel.map((step, index) => (
                  <div key={step.name} className="relative">
                    <div className="flex items-center gap-4">
                      <div className="w-32 text-sm font-medium">{step.name}</div>
                      <div className="flex-1">
                        <div
                          className="h-10 rounded-lg bg-primary/80 flex items-center justify-end pr-3 transition-all"
                          style={{
                            width: `${Math.max((step.count / maxFunnelCount) * 100, 10)}%`,
                          }}
                        >
                          <span className="text-sm font-bold text-primary-foreground">
                            {step.count.toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <div className="w-20 text-right">
                        <Badge
                          variant={step.percentage >= 50 ? 'default' : 'secondary'}
                          className={
                            step.percentage >= 70
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : step.percentage >= 30
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-red-500/20 text-red-300'
                          }
                        >
                          {step.percentage.toFixed(1)}%
                        </Badge>
                      </div>
                    </div>
                    {index < funnel.length - 1 && step.dropoff > 0 && (
                      <div className="flex items-center gap-2 ml-36 my-1 text-xs text-muted-foreground">
                        <ArrowDown className="h-3 w-3" />
                        <span>-{step.dropoff.toFixed(1)}% dropoff</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* A/B Test Comparison */}
            {abComparison && (
              <Card>
                <CardHeader>
                  <CardTitle>Comparação A/B Test</CardTitle>
                  <CardDescription>Control vs Bonus - Primeiro sticker</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-4 rounded-lg border p-4">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline">Control</Badge>
                        <span className="text-sm text-muted-foreground">
                          {abComparison.control.total} usuários
                        </span>
                      </div>
                      <div className="text-center">
                        <p className="text-4xl font-bold">
                          {abComparison.control.rate.toFixed(1)}%
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {abComparison.control.converted} converteram
                        </p>
                      </div>
                    </div>
                    <div className="space-y-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
                      <div className="flex items-center justify-between">
                        <Badge className="bg-emerald-500/20 text-emerald-300">Bonus</Badge>
                        <span className="text-sm text-muted-foreground">
                          {abComparison.bonus.total} usuários
                        </span>
                      </div>
                      <div className="text-center">
                        <p className="text-4xl font-bold text-emerald-500">
                          {abComparison.bonus.rate.toFixed(1)}%
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {abComparison.bonus.converted} converteram
                        </p>
                      </div>
                    </div>
                  </div>
                  {abComparison.bonus.rate > abComparison.control.rate && (
                    <div className="mt-4 flex items-center justify-center gap-2 text-emerald-500">
                      <TrendingUp className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        Bonus +{(abComparison.bonus.rate - abComparison.control.rate).toFixed(1)}% melhor
                      </span>
                    </div>
                  )}
                  {abComparison.bonus.rate < abComparison.control.rate && (
                    <div className="mt-4 flex items-center justify-center gap-2 text-red-500">
                      <TrendingDown className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        Control +{(abComparison.control.rate - abComparison.bonus.rate).toFixed(1)}% melhor
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Retention Cohorts */}
            <Card>
              <CardHeader>
                <CardTitle>Retenção por Cohort</CardTitle>
                <CardDescription>Retorno após D1, D7, D30</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="pb-2 text-left font-medium">Cohort</th>
                        <th className="pb-2 text-center font-medium">Total</th>
                        <th className="pb-2 text-center font-medium">D1</th>
                        <th className="pb-2 text-center font-medium">D7</th>
                        <th className="pb-2 text-center font-medium">D30</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cohorts.map((cohort) => (
                        <tr key={cohort.date} className="border-b border-border/50">
                          <td className="py-2 font-mono">{cohort.date}</td>
                          <td className="py-2 text-center">{cohort.total}</td>
                          <td className="py-2 text-center">
                            <Badge
                              variant="outline"
                              className={
                                cohort.d1 >= 50
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : cohort.d1 >= 20
                                  ? 'bg-amber-500/20 text-amber-300'
                                  : 'bg-red-500/20 text-red-300'
                              }
                            >
                              {cohort.d1}%
                            </Badge>
                          </td>
                          <td className="py-2 text-center">
                            <Badge
                              variant="outline"
                              className={
                                cohort.d7 >= 30
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : cohort.d7 >= 10
                                  ? 'bg-amber-500/20 text-amber-300'
                                  : 'bg-red-500/20 text-red-300'
                              }
                            >
                              {cohort.d7}%
                            </Badge>
                          </td>
                          <td className="py-2 text-center">
                            <Badge
                              variant="outline"
                              className={
                                cohort.d30 >= 20
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : cohort.d30 >= 5
                                  ? 'bg-amber-500/20 text-amber-300'
                                  : 'bg-red-500/20 text-red-300'
                              }
                            >
                              {cohort.d30}%
                            </Badge>
                          </td>
                        </tr>
                      ))}
                      {cohorts.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-muted-foreground">
                            Sem dados suficientes para cohorts
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
