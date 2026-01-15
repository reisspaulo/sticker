'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DataTable } from '@/components/data-table'
import { ColumnDef } from '@tanstack/react-table'
import {
  Users,
  Search,
  ArrowUpDown,
  Eye,
  Loader2,
  Crown,
  Smartphone,
  Calendar,
  Image,
} from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import Link from 'next/link'

interface User {
  id: string
  whatsapp_number: string
  name: string | null
  subscription_plan: string
  subscription_status: string | null
  ab_test_group: string | null
  daily_count: number
  daily_limit: number
  created_at: string
  last_interaction: string | null
  first_sticker_at: string | null
  sticker_count?: number
}

const planColors: Record<string, string> = {
  free: 'bg-zinc-500/20 text-zinc-300',
  basic: 'bg-blue-500/20 text-blue-300',
  premium: 'bg-purple-500/20 text-purple-300',
  pro: 'bg-amber-500/20 text-amber-300',
}

const groupColors: Record<string, string> = {
  control: 'bg-zinc-500/20 text-zinc-300',
  bonus: 'bg-emerald-500/20 text-emerald-300',
}

function getColumns(): ColumnDef<User>[] {
  return [
    {
      accessorKey: 'whatsapp_number',
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="-ml-4"
        >
          <Smartphone className="mr-2 h-4 w-4" />
          Número
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="font-mono text-sm">
          {row.original.whatsapp_number.replace(/^55/, '+55 ').replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')}
        </div>
      ),
    },
    {
      accessorKey: 'name',
      header: 'Nome',
      cell: ({ row }) => (
        <div className="max-w-[150px] truncate">
          {row.original.name || '-'}
        </div>
      ),
    },
    {
      accessorKey: 'subscription_plan',
      header: 'Plano',
      cell: ({ row }) => {
        const plan = row.original.subscription_plan || 'free'
        return (
          <Badge className={planColors[plan] || planColors.free}>
            {plan === 'free' ? 'Free' : plan}
            {plan !== 'free' && <Crown className="ml-1 h-3 w-3" />}
          </Badge>
        )
      },
      filterFn: (row, id, value) => {
        return value === 'all' || row.getValue(id) === value
      },
    },
    {
      accessorKey: 'ab_test_group',
      header: 'Grupo',
      cell: ({ row }) => {
        const group = row.original.ab_test_group || 'control'
        return (
          <Badge variant="outline" className={groupColors[group] || groupColors.control}>
            {group}
          </Badge>
        )
      },
      filterFn: (row, id, value) => {
        return value === 'all' || row.getValue(id) === value
      },
    },
    {
      accessorKey: 'daily_count',
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="-ml-4"
        >
          <Image className="mr-2 h-4 w-4" />
          Hoje/Limite
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const count = row.original.daily_count
        const limit = row.original.daily_limit
        const isAtLimit = count >= limit
        return (
          <div className={`text-center font-mono ${isAtLimit ? 'text-red-400' : ''}`}>
            {count}/{limit}
          </div>
        )
      },
    },
    {
      accessorKey: 'sticker_count',
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="-ml-4"
        >
          Total
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="text-center">{row.original.sticker_count ?? '-'}</div>
      ),
    },
    {
      accessorKey: 'created_at',
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="-ml-4"
        >
          <Calendar className="mr-2 h-4 w-4" />
          Cadastro
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="text-sm text-muted-foreground">
          {format(new Date(row.original.created_at), 'dd/MM/yy HH:mm')}
        </div>
      ),
    },
    {
      accessorKey: 'last_interaction',
      header: 'Última atividade',
      cell: ({ row }) => {
        const lastInteraction = row.original.last_interaction
        if (!lastInteraction) return <span className="text-muted-foreground">-</span>
        return (
          <div className="text-sm text-muted-foreground">
            {formatDistanceToNow(new Date(lastInteraction), {
              addSuffix: true,
              locale: ptBR
            })}
          </div>
        )
      },
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <Link href={`/users/${row.original.id}`}>
          <Button variant="ghost" size="sm">
            <Eye className="h-4 w-4" />
          </Button>
        </Link>
      ),
    },
  ]
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [planFilter, setPlanFilter] = useState('all')
  const [groupFilter, setGroupFilter] = useState('all')
  const [stats, setStats] = useState({
    total: 0,
    today: 0,
    premium: 0,
    active: 0,
  })

  useEffect(() => {
    fetchUsers()
  }, [])

  async function fetchUsers() {
    setLoading(true)
    const supabase = createClient()

    // Fetch users with sticker count
    // Note: Supabase has a default limit of 1000 rows, so we need to set a higher limit
    const { data: usersData, error, count } = await supabase
      .from('users')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(10000)

    if (error) {
      console.error('Error fetching users:', error)
      setLoading(false)
      return
    }

    // Get sticker counts per user using aggregation to avoid row limit issues
    const { data: stickerCounts } = await supabase
      .from('stickers')
      .select('user_number')
      .limit(100000)

    const countMap: Record<string, number> = {}
    stickerCounts?.forEach((s) => {
      countMap[s.user_number] = (countMap[s.user_number] || 0) + 1
    })

    const usersWithCounts = usersData?.map((user) => ({
      ...user,
      sticker_count: countMap[user.whatsapp_number] || 0,
    })) || []

    setUsers(usersWithCounts)

    // Calculate stats
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const activeThreshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) // 7 days

    setStats({
      total: count ?? usersWithCounts.length, // Use exact count from Supabase
      today: usersWithCounts.filter(u => new Date(u.created_at) >= todayStart).length,
      premium: usersWithCounts.filter(u => u.subscription_plan !== 'free').length,
      active: usersWithCounts.filter(u => u.last_interaction && new Date(u.last_interaction) >= activeThreshold).length,
    })

    setLoading(false)
  }

  const filteredUsers = users.filter((user) => {
    const matchesSearch = search === '' ||
      user.whatsapp_number.includes(search) ||
      (user.name?.toLowerCase().includes(search.toLowerCase()))

    const matchesPlan = planFilter === 'all' || user.subscription_plan === planFilter
    const matchesGroup = groupFilter === 'all' || user.ab_test_group === groupFilter

    return matchesSearch && matchesPlan && matchesGroup
  })

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Usuários</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Novos Hoje</p>
                <p className="text-2xl font-bold text-emerald-500">{stats.today}</p>
              </div>
              <Calendar className="h-8 w-8 text-emerald-500/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Premium</p>
                <p className="text-2xl font-bold text-purple-500">{stats.premium}</p>
              </div>
              <Crown className="h-8 w-8 text-purple-500/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Ativos (7d)</p>
                <p className="text-2xl font-bold text-blue-500">{stats.active}</p>
              </div>
              <Smartphone className="h-8 w-8 text-blue-500/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Lista de Usuários
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="mb-6 flex flex-wrap gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por número ou nome..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={planFilter} onValueChange={setPlanFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Plano" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos planos</SelectItem>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="basic">Basic</SelectItem>
                <SelectItem value="premium">Premium</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
              </SelectContent>
            </Select>
            <Select value={groupFilter} onValueChange={setGroupFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Grupo AB" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos grupos</SelectItem>
                <SelectItem value="control">Control</SelectItem>
                <SelectItem value="bonus">Bonus</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={fetchUsers}>
              Atualizar
            </Button>
          </div>

          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <DataTable columns={getColumns()} data={filteredUsers} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
