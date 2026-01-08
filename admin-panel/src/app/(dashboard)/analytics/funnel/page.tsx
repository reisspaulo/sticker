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
import { PieChart } from '@/components/charts'
import {
  TrendingUp,
  ArrowDown,
  ArrowRight,
  Loader2,
  Calendar,
  RefreshCw,
  Users,
  Image,
  Crown,
  Target,
} from 'lucide-react'
import { subDays } from 'date-fns'

interface FunnelStep {
  name: string
  count: number
  percentage: number
  dropoff: number
  icon: typeof Users
  color: string
}

interface DropoffReason {
  name: string
  value: number
  color: string
  [key: string]: string | number
}

export default function FunnelPage() {
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('30')
  const [funnel, setFunnel] = useState<FunnelStep[]>([])
  const [dropoffReasons, setDropoffReasons] = useState<DropoffReason[]>([])

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
      .select('id, whatsapp_number, created_at, first_sticker_at, subscription_plan, last_interaction')
      .gte('created_at', startDate.toISOString())

    // Fetch stickers
    const { data: stickers } = await supabase
      .from('stickers')
      .select('user_number, created_at')
      .gte('created_at', startDate.toISOString())

    // Fetch upgrade events
    const { data: upgradeLogs } = await supabase
      .from('usage_logs')
      .select('user_number, action')
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
    const usersReturned = users.filter(u => {
      if (!u.last_interaction || !u.first_sticker_at) return false
      const firstSticker = new Date(u.first_sticker_at)
      const lastInt = new Date(u.last_interaction)
      const diff = (lastInt.getTime() - firstSticker.getTime()) / (1000 * 60 * 60 * 24)
      return diff >= 1
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
        name: 'Visitantes',
        count: totalUsers,
        percentage: 100,
        dropoff: 0,
        icon: Users,
        color: 'hsl(var(--primary))',
      },
      {
        name: 'Primeiro Sticker',
        count: usersWithStickers,
        percentage: totalUsers > 0 ? (usersWithStickers / totalUsers) * 100 : 0,
        dropoff: totalUsers > 0 ? ((totalUsers - usersWithStickers) / totalUsers) * 100 : 0,
        icon: Image,
        color: 'hsl(217 91% 60%)',
      },
      {
        name: 'Engajados (3+)',
        count: usersWithMultipleStickers,
        percentage: totalUsers > 0 ? (usersWithMultipleStickers / totalUsers) * 100 : 0,
        dropoff: usersWithStickers > 0 ? ((usersWithStickers - usersWithMultipleStickers) / usersWithStickers) * 100 : 0,
        icon: TrendingUp,
        color: 'hsl(262 83% 58%)',
      },
      {
        name: 'Retornaram',
        count: usersReturned,
        percentage: totalUsers > 0 ? (usersReturned / totalUsers) * 100 : 0,
        dropoff: usersWithMultipleStickers > 0 ? ((usersWithMultipleStickers - usersReturned) / usersWithMultipleStickers) * 100 : 0,
        icon: RefreshCw,
        color: 'hsl(142 76% 36%)',
      },
      {
        name: 'Viram Upgrade',
        count: usersShownUpgrade,
        percentage: totalUsers > 0 ? (usersShownUpgrade / totalUsers) * 100 : 0,
        dropoff: usersReturned > 0 ? ((usersReturned - usersShownUpgrade) / usersReturned) * 100 : 0,
        icon: Target,
        color: 'hsl(38 92% 50%)',
      },
      {
        name: 'Clicaram',
        count: usersClickedUpgrade,
        percentage: totalUsers > 0 ? (usersClickedUpgrade / totalUsers) * 100 : 0,
        dropoff: usersShownUpgrade > 0 ? ((usersShownUpgrade - usersClickedUpgrade) / usersShownUpgrade) * 100 : 0,
        icon: ArrowRight,
        color: 'hsl(0 84% 60%)',
      },
      {
        name: 'Assinaram',
        count: usersSubscribed,
        percentage: totalUsers > 0 ? (usersSubscribed / totalUsers) * 100 : 0,
        dropoff: usersClickedUpgrade > 0 ? ((usersClickedUpgrade - usersSubscribed) / usersClickedUpgrade) * 100 : 0,
        icon: Crown,
        color: 'hsl(48 96% 53%)',
      },
    ]

    setFunnel(funnelData)

    // Calculate where users dropped off
    const neverCreated = totalUsers - usersWithStickers
    const createdOnce = usersWithStickers - usersWithMultipleStickers
    const didNotReturn = usersWithMultipleStickers - usersReturned
    const neverSawUpgrade = usersReturned - usersShownUpgrade
    const sawButDidntClick = usersShownUpgrade - usersClickedUpgrade
    const clickedButDidntPay = usersClickedUpgrade - usersSubscribed

    setDropoffReasons([
      { name: 'Nunca criou sticker', value: neverCreated, color: 'hsl(0 84% 60%)' },
      { name: 'Criou apenas 1-2', value: createdOnce, color: 'hsl(38 92% 50%)' },
      { name: 'Nao retornou', value: didNotReturn, color: 'hsl(262 83% 58%)' },
      { name: 'Nao viu upgrade', value: neverSawUpgrade, color: 'hsl(217 91% 60%)' },
      { name: 'Viu mas nao clicou', value: sawButDidntClick, color: 'hsl(142 76% 36%)' },
      { name: 'Clicou mas nao pagou', value: clickedButDidntPay, color: 'hsl(48 96% 53%)' },
    ])

    setLoading(false)
  }

  const maxCount = funnel[0]?.count || 1

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="h-6 w-6" />
            Funil de Conversao
          </h1>
          <p className="text-muted-foreground">Da chegada ate a assinatura</p>
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
          {/* Visual Funnel */}
          <Card>
            <CardHeader>
              <CardTitle>Funil Visual</CardTitle>
              <CardDescription>Jornada do usuario</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {funnel.map((step, index) => {
                  const Icon = step.icon
                  const width = Math.max((step.count / maxCount) * 100, 8)

                  return (
                    <div key={step.name}>
                      <div className="flex items-center gap-4">
                        <div className="w-28 flex items-center gap-2">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium truncate">{step.name}</span>
                        </div>
                        <div className="flex-1 relative">
                          <div
                            className="h-12 rounded-lg flex items-center justify-between px-4 transition-all"
                            style={{
                              width: `${width}%`,
                              backgroundColor: step.color,
                            }}
                          >
                            <span className="text-sm font-bold text-white">
                              {step.count.toLocaleString()}
                            </span>
                            <Badge
                              variant="secondary"
                              className="bg-white/20 text-white border-0"
                            >
                              {step.percentage.toFixed(1)}%
                            </Badge>
                          </div>
                        </div>
                      </div>
                      {index < funnel.length - 1 && step.dropoff > 0 && (
                        <div className="flex items-center gap-2 ml-32 my-1">
                          <ArrowDown className="h-3 w-3 text-red-500" />
                          <span className="text-xs text-red-500">
                            -{step.dropoff.toFixed(1)}% perdidos
                          </span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Dropoff Analysis */}
            <Card>
              <CardHeader>
                <CardTitle>Onde Usuarios Sairam</CardTitle>
                <CardDescription>Analise de abandono</CardDescription>
              </CardHeader>
              <CardContent>
                <PieChart
                  data={dropoffReasons.filter(d => d.value > 0)}
                  height={300}
                  showLegend
                />
              </CardContent>
            </Card>

            {/* Key Metrics */}
            <Card>
              <CardHeader>
                <CardTitle>Metricas Chave</CardTitle>
                <CardDescription>Taxas de conversao</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {funnel.length > 0 && (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Ativacao</p>
                        <p className="text-xs text-muted-foreground">Visitantes → Primeiro Sticker</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold">
                          {funnel[1]?.percentage.toFixed(1)}%
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {funnel[1]?.count} de {funnel[0]?.count}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Engajamento</p>
                        <p className="text-xs text-muted-foreground">Primeiro Sticker → 3+ Stickers</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold">
                          {funnel[1]?.count > 0
                            ? ((funnel[2]?.count / funnel[1]?.count) * 100).toFixed(1)
                            : 0}%
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {funnel[2]?.count} de {funnel[1]?.count}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Retencao</p>
                        <p className="text-xs text-muted-foreground">Engajados → Retornaram</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold">
                          {funnel[2]?.count > 0
                            ? ((funnel[3]?.count / funnel[2]?.count) * 100).toFixed(1)
                            : 0}%
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {funnel[3]?.count} de {funnel[2]?.count}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t pt-4">
                      <div>
                        <p className="text-sm font-medium">Conversao Total</p>
                        <p className="text-xs text-muted-foreground">Visitantes → Assinantes</p>
                      </div>
                      <div className="text-right">
                        <p className="text-3xl font-bold text-emerald-500">
                          {funnel[6]?.percentage.toFixed(2)}%
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {funnel[6]?.count} de {funnel[0]?.count}
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
