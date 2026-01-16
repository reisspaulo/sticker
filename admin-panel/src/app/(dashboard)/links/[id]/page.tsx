'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Link2,
  Loader2,
  ArrowLeft,
  ExternalLink,
  Copy,
  Check,
  MousePointerClick,
  Smartphone,
  Monitor,
  Tablet,
  Globe,
  Clock,
  Save,
  Trash2,
  BarChart3,
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { format, formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface LinkData {
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
  utm_content: string | null
}

interface LinkStats {
  total_clicks: number
  clicks_24h: number
  clicks_7d: number
  devices: Record<string, number>
  countries: Record<string, number>
  browsers: Record<string, number>
}

interface RecentClick {
  clicked_at: string
  device_type: string | null
  country_code: string | null
  city: string | null
  browser: string | null
  os: string | null
}

const countryNames: Record<string, string> = {
  BR: 'Brasil',
  US: 'EUA',
  PT: 'Portugal',
  AR: 'Argentina',
  MX: 'México',
  other: 'Outros',
}

export default function LinkDetailPage() {
  const params = useParams()
  const router = useRouter()
  const linkId = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [link, setLink] = useState<LinkData | null>(null)
  const [stats, setStats] = useState<LinkStats | null>(null)
  const [recentClicks, setRecentClicks] = useState<RecentClick[]>([])

  const [formData, setFormData] = useState({
    title: '',
    short_code: '',
    original_url: '',
    utm_source: '',
    utm_medium: '',
    utm_campaign: '',
    utm_content: '',
  })

  useEffect(() => {
    fetchLink()
  }, [linkId])

  async function fetchLink() {
    setLoading(true)
    try {
      const response = await fetch(`/api/links/${linkId}`)
      if (!response.ok) {
        if (response.status === 404) {
          toast.error('Link não encontrado')
          router.push('/links')
          return
        }
        throw new Error('Erro ao carregar link')
      }

      const data = await response.json()
      setLink(data.link)
      setStats(data.stats)
      setRecentClicks(data.recent_clicks || [])

      setFormData({
        title: data.link.title || '',
        short_code: data.link.short_code || '',
        original_url: data.link.original_url || '',
        utm_source: data.link.utm_source || '',
        utm_medium: data.link.utm_medium || '',
        utm_campaign: data.link.utm_campaign || '',
        utm_content: data.link.utm_content || '',
      })
    } catch (error) {
      console.error('Error fetching link:', error)
      toast.error('Erro ao carregar link')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const response = await fetch(`/api/links/${linkId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao salvar')
      }

      setLink(data.link)
      toast.success('Link atualizado!')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Tem certeza que deseja desativar este link?')) return

    setDeleting(true)
    try {
      const response = await fetch(`/api/links/${linkId}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Erro ao excluir')

      toast.success('Link desativado')
      router.push('/links')
    } catch (error) {
      toast.error('Erro ao excluir link')
    } finally {
      setDeleting(false)
    }
  }

  const handleCopy = async () => {
    if (link) {
      await navigator.clipboard.writeText(link.short_url)
      setCopied(true)
      toast.success('Link copiado!')
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!link) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/links">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold">{link.title || link.short_code}</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <code className="text-blue-400">{link.short_url}</code>
              <Button variant="ghost" size="sm" onClick={handleCopy} className="h-6 w-6 p-0">
                {copied ? (
                  <Check className="h-3 w-3 text-emerald-500" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
              <a href={link.short_url} target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </a>
            </div>
          </div>
        </div>
        <Badge
          className={
            link.is_active
              ? 'bg-emerald-500/20 text-emerald-300'
              : 'bg-zinc-500/20 text-zinc-400'
          }
        >
          {link.is_active ? 'Ativo' : 'Inativo'}
        </Badge>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Cliques</p>
                <p className="text-2xl font-bold">{stats?.total_clicks || 0}</p>
              </div>
              <MousePointerClick className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Últimas 24h</p>
                <p className="text-2xl font-bold text-blue-500">{stats?.clicks_24h || 0}</p>
              </div>
              <Clock className="h-8 w-8 text-blue-500/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Últimos 7 dias</p>
                <p className="text-2xl font-bold text-emerald-500">{stats?.clicks_7d || 0}</p>
              </div>
              <BarChart3 className="h-8 w-8 text-emerald-500/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Criado em</p>
                <p className="text-lg font-medium">
                  {format(new Date(link.created_at), 'dd/MM/yy')}
                </p>
              </div>
              <Link2 className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="stats">
        <TabsList>
          <TabsTrigger value="stats">Estatísticas</TabsTrigger>
          <TabsTrigger value="edit">Editar</TabsTrigger>
          <TabsTrigger value="clicks">Cliques Recentes</TabsTrigger>
        </TabsList>

        {/* Stats Tab */}
        <TabsContent value="stats" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {/* Devices */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Dispositivos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Smartphone className="h-4 w-4 text-blue-500" />
                      <span>Mobile</span>
                    </div>
                    <span className="font-mono font-semibold">{stats?.devices?.mobile || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Monitor className="h-4 w-4 text-emerald-500" />
                      <span>Desktop</span>
                    </div>
                    <span className="font-mono font-semibold">{stats?.devices?.desktop || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Tablet className="h-4 w-4 text-purple-500" />
                      <span>Tablet</span>
                    </div>
                    <span className="font-mono font-semibold">{stats?.devices?.tablet || 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Countries */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Países</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {stats?.countries && Object.keys(stats.countries).length > 0 ? (
                    Object.entries(stats.countries)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 5)
                      .map(([code, count]) => (
                        <div key={code} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Globe className="h-4 w-4 text-muted-foreground" />
                            <span>{countryNames[code] || code}</span>
                          </div>
                          <span className="font-mono font-semibold">{count}</span>
                        </div>
                      ))
                  ) : (
                    <p className="text-sm text-muted-foreground">Sem dados ainda</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Browsers */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Navegadores</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {stats?.browsers && Object.keys(stats.browsers).length > 0 ? (
                    Object.entries(stats.browsers)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 5)
                      .map(([browser, count]) => (
                        <div key={browser} className="flex items-center justify-between">
                          <span>{browser}</span>
                          <span className="font-mono font-semibold">{count}</span>
                        </div>
                      ))
                  ) : (
                    <p className="text-sm text-muted-foreground">Sem dados ainda</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Edit Tab */}
        <TabsContent value="edit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Editar Link</CardTitle>
              <CardDescription>Atualize as informações do link</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="title">Título</Label>
                  <Input
                    id="title"
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    placeholder="Nome do link"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="short_code">Código</Label>
                  <Input
                    id="short_code"
                    name="short_code"
                    value={formData.short_code}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="original_url">URL de Destino</Label>
                <Input
                  id="original_url"
                  name="original_url"
                  type="url"
                  value={formData.original_url}
                  onChange={handleChange}
                />
              </div>

              <div className="rounded-lg border p-4 space-y-4">
                <h4 className="font-medium">Parâmetros UTM</h4>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="utm_source">utm_source</Label>
                    <Input
                      id="utm_source"
                      name="utm_source"
                      value={formData.utm_source}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="utm_medium">utm_medium</Label>
                    <Input
                      id="utm_medium"
                      name="utm_medium"
                      value={formData.utm_medium}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="utm_campaign">utm_campaign</Label>
                    <Input
                      id="utm_campaign"
                      name="utm_campaign"
                      value={formData.utm_campaign}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="utm_content">utm_content</Label>
                    <Input
                      id="utm_content"
                      name="utm_content"
                      value={formData.utm_content}
                      onChange={handleChange}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-between">
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-2 h-4 w-4" />
                  )}
                  Desativar Link
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Salvar
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Recent Clicks Tab */}
        <TabsContent value="clicks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Cliques Recentes</CardTitle>
              <CardDescription>Últimos 20 cliques registrados</CardDescription>
            </CardHeader>
            <CardContent>
              {recentClicks.length === 0 ? (
                <div className="flex h-32 items-center justify-center text-muted-foreground">
                  <p>Nenhum clique registrado ainda</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentClicks.map((click, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                          {click.device_type === 'mobile' && <Smartphone className="h-4 w-4" />}
                          {click.device_type === 'desktop' && <Monitor className="h-4 w-4" />}
                          {click.device_type === 'tablet' && <Tablet className="h-4 w-4" />}
                          {!click.device_type && <Globe className="h-4 w-4" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 text-sm">
                            {click.browser && <span>{click.browser}</span>}
                            {click.os && <span className="text-muted-foreground">/ {click.os}</span>}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {click.city && click.country_code
                              ? `${click.city}, ${click.country_code}`
                              : click.country_code || 'Localização desconhecida'}
                          </div>
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(click.clicked_at), {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
