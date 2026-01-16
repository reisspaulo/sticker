'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Megaphone,
  Users,
  CheckCircle2,
  XCircle,
  Pause,
  Play,
  Eye,
  RefreshCw,
  TrendingUp,
  Clock,
  Zap,
  Calendar,
  AlertCircle,
  Image,
  Plus,
} from 'lucide-react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface Campaign {
  id: string
  name: string
  description: string | null
  campaign_type: string
  status: string
  priority: number
  created_at: string
  scheduled_start_at: string | null
  scheduled_end_at: string | null
  total_enrolled: number
  total_active: number
  total_completed: number
  total_cancelled: number
  conversion_rate: number
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  active: { label: 'Ativa', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: Play },
  paused: { label: 'Pausada', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', icon: Pause },
  draft: { label: 'Rascunho', color: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30', icon: Clock },
  ended: { label: 'Encerrada', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: XCircle },
}

const typeConfig: Record<string, { label: string; color: string }> = {
  drip: { label: 'Drip', color: 'bg-blue-500/20 text-blue-400' },
  event: { label: 'Evento', color: 'bg-purple-500/20 text-purple-400' },
  hybrid: { label: 'Híbrida', color: 'bg-amber-500/20 text-amber-400' },
  instant: { label: 'Instant', color: 'bg-cyan-500/20 text-cyan-400' },
}

function CampaignCard({ campaign }: { campaign: Campaign }) {
  const status = statusConfig[campaign.status] || statusConfig.draft
  const type = typeConfig[campaign.campaign_type] || typeConfig.drip
  const StatusIcon = status.icon

  return (
    <Card className="transition-all hover:border-primary/30">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold truncate">{campaign.name}</h3>
              <Badge variant="outline" className={status.color}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {status.label}
              </Badge>
              <Badge variant="secondary" className={type.color}>
                {type.label}
              </Badge>
            </div>
            {campaign.description && (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {campaign.description}
              </p>
            )}
          </div>
          <Link href={`/campaigns/${campaign.id}`}>
            <Button variant="ghost" size="sm">
              <Eye className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        <div className="mt-4 grid grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold">{campaign.total_enrolled}</p>
            <p className="text-xs text-muted-foreground">Inscritos</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-emerald-400">{campaign.total_active}</p>
            <p className="text-xs text-muted-foreground">Ativos</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-blue-400">{campaign.total_completed}</p>
            <p className="text-xs text-muted-foreground">Completos</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-amber-400">{campaign.conversion_rate}%</p>
            <p className="text-xs text-muted-foreground">Conversão</p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <span>Prioridade: {campaign.priority}</span>
          <span>
            Criada {formatDistanceToNow(new Date(campaign.created_at), { addSuffix: true, locale: ptBR })}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')

  const fetchCampaigns = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/campaigns')
      if (!response.ok) throw new Error('Failed to fetch campaigns')
      const data = await response.json()
      setCampaigns(data.campaigns || [])
    } catch (error) {
      console.error('Error fetching campaigns:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCampaigns()
  }, [fetchCampaigns])

  const filteredCampaigns = campaigns.filter(c => {
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter
    const matchesType = typeFilter === 'all' || c.campaign_type === typeFilter
    return matchesStatus && matchesType
  })

  const stats = {
    total: campaigns.length,
    active: campaigns.filter(c => c.status === 'active').length,
    totalEnrolled: campaigns.reduce((sum, c) => sum + c.total_enrolled, 0),
    totalActive: campaigns.reduce((sum, c) => sum + c.total_active, 0),
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Megaphone className="h-6 w-6" />
            Campanhas
          </h1>
          <p className="text-muted-foreground">
            Gerencie campanhas de engajamento e comunicação
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchCampaigns} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Link href="/campaigns/new">
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Nova Campanha
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Campanhas</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Megaphone className="h-8 w-8 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Campanhas Ativas</p>
                <p className="text-2xl font-bold text-emerald-400">{stats.active}</p>
              </div>
              <Zap className="h-8 w-8 text-emerald-500/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Inscritos</p>
                <p className="text-2xl font-bold text-blue-400">{stats.totalEnrolled}</p>
              </div>
              <Users className="h-8 w-8 text-blue-500/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Usuários Ativos</p>
                <p className="text-2xl font-bold text-purple-400">{stats.totalActive}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-500/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Status</SelectItem>
            <SelectItem value="active">Ativas</SelectItem>
            <SelectItem value="paused">Pausadas</SelectItem>
            <SelectItem value="draft">Rascunhos</SelectItem>
            <SelectItem value="ended">Encerradas</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Tipos</SelectItem>
            <SelectItem value="drip">Drip</SelectItem>
            <SelectItem value="event">Evento</SelectItem>
            <SelectItem value="hybrid">Híbrida</SelectItem>
            <SelectItem value="instant">Instant</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Campaigns List */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-5 w-16" />
                </div>
                <Skeleton className="h-4 w-full" />
                <div className="grid grid-cols-4 gap-4">
                  <Skeleton className="h-12" />
                  <Skeleton className="h-12" />
                  <Skeleton className="h-12" />
                  <Skeleton className="h-12" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredCampaigns.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma campanha encontrada</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredCampaigns.map(campaign => (
            <CampaignCard key={campaign.id} campaign={campaign} />
          ))}
        </div>
      )}

      {/* Quick Links */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Biblioteca de Stickers</CardTitle>
            <CardDescription>Figurinhas para usar nas campanhas</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/campaigns/stickers">
              <Button variant="outline" size="sm">
                <Image className="h-4 w-4 mr-2" />
                Gerenciar Stickers
              </Button>
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Compliance</CardTitle>
            <CardDescription>Gerenciar opt-outs e lista de supressao</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-4">
            <Link href="/campaigns/optouts">
              <Button variant="outline" size="sm">
                <XCircle className="h-4 w-4 mr-2" />
                Opt-outs
              </Button>
            </Link>
            <Link href="/campaigns/suppression">
              <Button variant="outline" size="sm">
                <AlertCircle className="h-4 w-4 mr-2" />
                Supressao
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
