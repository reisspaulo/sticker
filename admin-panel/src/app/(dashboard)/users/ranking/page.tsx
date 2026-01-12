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
import { Input } from '@/components/ui/input'
import {
  Trophy,
  Users,
  Image,
  Crown,
  Zap,
  Calendar,
  RefreshCw,
  Loader2,
  TrendingUp,
  Clock,
  Medal,
  Search,
  ArrowUpDown,
  Star,
} from 'lucide-react'
import { subDays, format, differenceInDays, formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import Link from 'next/link'

interface UserRanking {
  id: string
  whatsapp_number: string
  name: string | null
  subscription_plan: string
  created_at: string
  first_sticker_at: string | null
  last_interaction: string | null
  sticker_count: number
  stickers_period: number
  frequency: number // stickers per day in period
  days_active: number
  rank: number
}

interface PlanStats {
  plan: string
  count: number
  avgStickers: number
  avgFrequency: number
  topUser: string | null
}

type SortField = 'stickers_period' | 'sticker_count' | 'frequency' | 'days_active' | 'last_interaction'
type SortDirection = 'asc' | 'desc'

export default function UserRankingPage() {
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('30')
  const [planFilter, setPlanFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState<SortField>('stickers_period')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  const [users, setUsers] = useState<UserRanking[]>([])
  const [planStats, setPlanStats] = useState<PlanStats[]>([])
  const [totals, setTotals] = useState({
    totalUsers: 0,
    totalStickers: 0,
    avgPerUser: 0,
    topUserStickers: 0,
  })

  useEffect(() => {
    fetchData()
  }, [period])

  async function fetchData() {
    setLoading(true)
    const supabase = createClient()
    const days = parseInt(period)
    const startDate = subDays(new Date(), days)

    // Fetch all users
    const { data: usersData } = await supabase
      .from('users')
      .select('id, whatsapp_number, name, subscription_plan, created_at, first_sticker_at, last_interaction')

    // Fetch all stickers
    const { data: allStickers } = await supabase
      .from('stickers')
      .select('user_number, created_at')

    // Fetch stickers in period
    const { data: periodStickers } = await supabase
      .from('stickers')
      .select('user_number, created_at')
      .gte('created_at', startDate.toISOString())

    if (!usersData) {
      setLoading(false)
      return
    }

    // Count stickers per user
    const allStickerCount: Record<string, number> = {}
    const periodStickerCount: Record<string, number> = {}

    allStickers?.forEach(s => {
      allStickerCount[s.user_number] = (allStickerCount[s.user_number] || 0) + 1
    })

    periodStickers?.forEach(s => {
      periodStickerCount[s.user_number] = (periodStickerCount[s.user_number] || 0) + 1
    })

    // Build user rankings
    const now = new Date()
    const rankings: UserRanking[] = usersData.map(user => {
      const totalCount = allStickerCount[user.whatsapp_number] || 0
      const periodCount = periodStickerCount[user.whatsapp_number] || 0
      const daysActive = user.first_sticker_at
        ? differenceInDays(now, new Date(user.first_sticker_at)) + 1
        : 0
      const frequency = daysActive > 0 ? periodCount / Math.min(daysActive, days) : 0

      return {
        id: user.id,
        whatsapp_number: user.whatsapp_number,
        name: user.name,
        subscription_plan: user.subscription_plan || 'free',
        created_at: user.created_at,
        first_sticker_at: user.first_sticker_at,
        last_interaction: user.last_interaction,
        sticker_count: totalCount,
        stickers_period: periodCount,
        frequency,
        days_active: daysActive,
        rank: 0,
      }
    })

    // Sort and assign ranks
    rankings.sort((a, b) => b.stickers_period - a.stickers_period)
    rankings.forEach((user, index) => {
      user.rank = index + 1
    })

    setUsers(rankings)

    // Calculate plan stats
    const plans = ['free', 'premium', 'ultra']
    const stats: PlanStats[] = plans.map(plan => {
      const planUsers = rankings.filter(u => u.subscription_plan === plan)
      const totalStickers = planUsers.reduce((sum, u) => sum + u.stickers_period, 0)
      const totalFrequency = planUsers.reduce((sum, u) => sum + u.frequency, 0)
      const topUser = planUsers.length > 0 ? planUsers[0] : null

      return {
        plan,
        count: planUsers.length,
        avgStickers: planUsers.length > 0 ? totalStickers / planUsers.length : 0,
        avgFrequency: planUsers.length > 0 ? totalFrequency / planUsers.length : 0,
        topUser: topUser?.whatsapp_number || null,
      }
    })

    setPlanStats(stats)

    // Calculate totals
    const totalPeriodStickers = periodStickers?.length || 0
    const topUser = rankings[0]

    setTotals({
      totalUsers: usersData.length,
      totalStickers: totalPeriodStickers,
      avgPerUser: usersData.length > 0 ? totalPeriodStickers / usersData.length : 0,
      topUserStickers: topUser?.stickers_period || 0,
    })

    setLoading(false)
  }

  // Filter and sort users
  const filteredUsers = useMemo(() => {
    let result = [...users]

    // Filter by plan
    if (planFilter !== 'all') {
      result = result.filter(u => u.subscription_plan === planFilter)
    }

    // Filter by search
    if (search) {
      const searchLower = search.toLowerCase()
      result = result.filter(u =>
        u.whatsapp_number.includes(search) ||
        u.name?.toLowerCase().includes(searchLower)
      )
    }

    // Sort
    result.sort((a, b) => {
      let aVal: number | string | null = a[sortField]
      let bVal: number | string | null = b[sortField]

      // Handle null values for last_interaction
      if (sortField === 'last_interaction') {
        aVal = a.last_interaction ? new Date(a.last_interaction).getTime() : 0
        bVal = b.last_interaction ? new Date(b.last_interaction).getTime() : 0
      }

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'desc' ? bVal - aVal : aVal - bVal
      }
      return 0
    })

    return result
  }, [users, planFilter, search, sortField, sortDirection])

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const getPlanBadge = (plan: string) => {
    switch (plan) {
      case 'ultra':
        return <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/50"><Crown className="w-3 h-3 mr-1" />Ultra</Badge>
      case 'premium':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/50"><Star className="w-3 h-3 mr-1" />Premium</Badge>
      default:
        return <Badge variant="secondary">Free</Badge>
    }
  }

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="w-5 h-5 text-yellow-500" />
    if (rank === 2) return <Medal className="w-5 h-5 text-gray-400" />
    if (rank === 3) return <Medal className="w-5 h-5 text-amber-600" />
    return <span className="w-5 text-center text-muted-foreground">{rank}</span>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Trophy className="h-6 w-6" />
            Ranking de Usuarios
          </h1>
          <p className="text-muted-foreground">Top usuarios por uso e frequencia</p>
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
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Usuarios</p>
                    <p className="text-2xl font-bold">{totals.totalUsers}</p>
                  </div>
                  <Users className="h-8 w-8 text-muted-foreground/50" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Stickers no Periodo</p>
                    <p className="text-2xl font-bold">{totals.totalStickers}</p>
                  </div>
                  <Image className="h-8 w-8 text-muted-foreground/50" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Media por Usuario</p>
                    <p className="text-2xl font-bold">{totals.avgPerUser.toFixed(1)}</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-muted-foreground/50" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Top Usuario</p>
                    <p className="text-2xl font-bold">{totals.topUserStickers}</p>
                    <p className="text-xs text-muted-foreground">stickers</p>
                  </div>
                  <Trophy className="h-8 w-8 text-yellow-500/50" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Plan Stats */}
          <div className="grid gap-4 md:grid-cols-3">
            {planStats.map(stat => (
              <Card key={stat.plan}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center justify-between">
                    {stat.plan === 'ultra' ? (
                      <span className="flex items-center gap-1 text-purple-400"><Crown className="w-4 h-4" /> Ultra</span>
                    ) : stat.plan === 'premium' ? (
                      <span className="flex items-center gap-1 text-yellow-400"><Star className="w-4 h-4" /> Premium</span>
                    ) : (
                      <span className="text-muted-foreground">Free</span>
                    )}
                    <Badge variant="outline">{stat.count} usuarios</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Media stickers</p>
                      <p className="text-lg font-semibold">{stat.avgStickers.toFixed(1)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Freq. media</p>
                      <p className="text-lg font-semibold">{stat.avgFrequency.toFixed(2)}/dia</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por numero ou nome..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={planFilter} onValueChange={setPlanFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filtrar por plano" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os planos</SelectItem>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                    <SelectItem value="ultra">Ultra</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Ranking Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-4 w-4" />
                Ranking ({filteredUsers.length} usuarios)
              </CardTitle>
              <CardDescription>Ordenado por stickers no periodo</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="pb-3 text-left font-medium w-12">#</th>
                      <th className="pb-3 text-left font-medium">Usuario</th>
                      <th className="pb-3 text-center font-medium">Plano</th>
                      <th
                        className="pb-3 text-center font-medium cursor-pointer hover:text-primary"
                        onClick={() => toggleSort('stickers_period')}
                      >
                        <div className="flex items-center justify-center gap-1">
                          Periodo
                          <ArrowUpDown className="h-3 w-3" />
                        </div>
                      </th>
                      <th
                        className="pb-3 text-center font-medium cursor-pointer hover:text-primary"
                        onClick={() => toggleSort('sticker_count')}
                      >
                        <div className="flex items-center justify-center gap-1">
                          Total
                          <ArrowUpDown className="h-3 w-3" />
                        </div>
                      </th>
                      <th
                        className="pb-3 text-center font-medium cursor-pointer hover:text-primary"
                        onClick={() => toggleSort('frequency')}
                      >
                        <div className="flex items-center justify-center gap-1">
                          Freq/dia
                          <ArrowUpDown className="h-3 w-3" />
                        </div>
                      </th>
                      <th
                        className="pb-3 text-center font-medium cursor-pointer hover:text-primary"
                        onClick={() => toggleSort('last_interaction')}
                      >
                        <div className="flex items-center justify-center gap-1">
                          Ultima Ativ.
                          <ArrowUpDown className="h-3 w-3" />
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.slice(0, 100).map((user, index) => (
                      <tr
                        key={user.id}
                        className={`border-b border-border/50 hover:bg-muted/50 ${
                          index < 3 ? 'bg-yellow-500/5' : ''
                        }`}
                      >
                        <td className="py-3">
                          <div className="flex items-center justify-center">
                            {getRankIcon(user.rank)}
                          </div>
                        </td>
                        <td className="py-3">
                          <Link href={`/users/${user.id}`} className="hover:underline">
                            <div>
                              <p className="font-medium font-mono">{user.whatsapp_number}</p>
                              {user.name && (
                                <p className="text-xs text-muted-foreground">{user.name}</p>
                              )}
                            </div>
                          </Link>
                        </td>
                        <td className="py-3 text-center">
                          {getPlanBadge(user.subscription_plan)}
                        </td>
                        <td className="py-3 text-center">
                          <span className="font-bold text-lg">{user.stickers_period}</span>
                        </td>
                        <td className="py-3 text-center text-muted-foreground">
                          {user.sticker_count}
                        </td>
                        <td className="py-3 text-center">
                          <span className={user.frequency >= 1 ? 'text-emerald-500' : 'text-muted-foreground'}>
                            {user.frequency.toFixed(2)}
                          </span>
                        </td>
                        <td className="py-3 text-center text-muted-foreground text-xs">
                          {user.last_interaction ? (
                            formatDistanceToNow(new Date(user.last_interaction), { addSuffix: true, locale: ptBR })
                          ) : (
                            '-'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredUsers.length > 100 && (
                <p className="text-center text-sm text-muted-foreground mt-4">
                  Mostrando top 100 de {filteredUsers.length} usuarios
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
