'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/data-table'
import { ColumnDef } from '@tanstack/react-table'
import {
  Link2,
  Search,
  ArrowUpDown,
  Eye,
  Loader2,
  Plus,
  MousePointerClick,
  ExternalLink,
  Copy,
  Check,
  BarChart3,
  Calendar,
} from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import Link from 'next/link'
import { toast } from 'sonner'

interface UrlLink {
  id: string
  short_code: string
  short_url: string
  original_url: string
  title: string | null
  campaign_id: string | null
  clicks_count: number
  is_active: boolean
  created_at: string
  updated_at: string
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    await navigator.clipboard.writeText(text)
    setCopied(true)
    toast.success('Link copiado!')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleCopy} className="h-6 w-6 p-0">
      {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
    </Button>
  )
}

function getColumns(): ColumnDef<UrlLink>[] {
  return [
    {
      accessorKey: 'title',
      header: 'Link',
      cell: ({ row }) => (
        <div className="max-w-[250px]">
          <div className="font-medium truncate">
            {row.original.title || row.original.short_code}
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className="font-mono text-blue-400">{row.original.short_url}</span>
            <CopyButton text={row.original.short_url} />
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'original_url',
      header: 'Destino',
      cell: ({ row }) => (
        <div className="max-w-[200px] truncate text-sm text-muted-foreground">
          {row.original.original_url}
        </div>
      ),
    },
    {
      accessorKey: 'clicks_count',
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="-ml-4"
        >
          <MousePointerClick className="mr-2 h-4 w-4" />
          Cliques
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="text-center font-mono font-semibold">
          {row.original.clicks_count}
        </div>
      ),
    },
    {
      accessorKey: 'utm_source',
      header: 'UTM',
      cell: ({ row }) => {
        const { utm_source, utm_medium, utm_campaign } = row.original
        if (!utm_source && !utm_medium && !utm_campaign) {
          return <span className="text-muted-foreground">-</span>
        }
        return (
          <div className="flex flex-wrap gap-1">
            {utm_source && (
              <Badge variant="outline" className="text-xs">
                {utm_source}
              </Badge>
            )}
            {utm_medium && (
              <Badge variant="outline" className="text-xs">
                {utm_medium}
              </Badge>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: 'is_active',
      header: 'Status',
      cell: ({ row }) => (
        <Badge
          className={
            row.original.is_active
              ? 'bg-emerald-500/20 text-emerald-300'
              : 'bg-zinc-500/20 text-zinc-400'
          }
        >
          {row.original.is_active ? 'Ativo' : 'Inativo'}
        </Badge>
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
          Criado
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
      id: 'actions',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <a
            href={row.original.short_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
          >
            <Button variant="ghost" size="sm">
              <ExternalLink className="h-4 w-4" />
            </Button>
          </a>
          <Link href={`/links/${row.original.id}`}>
            <Button variant="ghost" size="sm">
              <Eye className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      ),
    },
  ]
}

export default function LinksPage() {
  const [links, setLinks] = useState<UrlLink[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [stats, setStats] = useState({
    total_links: 0,
    total_clicks: 0,
    clicks_today: 0,
  })

  useEffect(() => {
    fetchLinks()
  }, [])

  async function fetchLinks() {
    setLoading(true)
    try {
      const response = await fetch('/api/links')
      if (!response.ok) throw new Error('Failed to fetch links')
      const data = await response.json()
      setLinks(data.links || [])
      setStats(data.stats || { total_links: 0, total_clicks: 0, clicks_today: 0 })
    } catch (error) {
      console.error('Error fetching links:', error)
      toast.error('Erro ao carregar links')
    } finally {
      setLoading(false)
    }
  }

  const filteredLinks = links.filter((link) => {
    if (!search) return true
    const searchLower = search.toLowerCase()
    return (
      link.short_code.toLowerCase().includes(searchLower) ||
      link.title?.toLowerCase().includes(searchLower) ||
      link.original_url.toLowerCase().includes(searchLower)
    )
  })

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Links</p>
                <p className="text-2xl font-bold">{stats.total_links}</p>
              </div>
              <Link2 className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Cliques</p>
                <p className="text-2xl font-bold text-blue-500">{stats.total_clicks}</p>
              </div>
              <MousePointerClick className="h-8 w-8 text-blue-500/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Cliques Hoje</p>
                <p className="text-2xl font-bold text-emerald-500">{stats.clicks_today}</p>
              </div>
              <BarChart3 className="h-8 w-8 text-emerald-500/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Links Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Links Rastreados
            </CardTitle>
            <Link href="/links/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Novo Link
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="mb-6 flex flex-wrap gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por título, código ou URL..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button variant="outline" onClick={fetchLinks}>
              Atualizar
            </Button>
          </div>

          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredLinks.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center text-muted-foreground">
              <Link2 className="mb-4 h-12 w-12" />
              <p>Nenhum link encontrado</p>
              <Link href="/links/new" className="mt-4">
                <Button variant="outline">
                  <Plus className="mr-2 h-4 w-4" />
                  Criar primeiro link
                </Button>
              </Link>
            </div>
          ) : (
            <DataTable columns={getColumns()} data={filteredLinks} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
