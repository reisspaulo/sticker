'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ArrowLeft,
  Users,
  CheckCircle2,
  XCircle,
  Pause,
  Play,
  RefreshCw,
  Clock,
  Zap,
  MessageSquare,
  Target,
  Settings,
  TrendingUp,
  Copy,
  TestTube,
  Send,
  Loader2,
  StopCircle,
  User,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  FlaskConical,
} from 'lucide-react'
import Link from 'next/link'
import { format, formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface CampaignStep {
  id: string
  step_key: string
  step_order: number
  delay_hours: number
  messages: {
    id: string
    variant: string
    content_type: string
    title: string | null
    body: string
  }[]
}

interface CampaignEvent {
  id: string
  event_type: string
  step_key: string | null
  variant: string | null
  created_at: string
  user: {
    whatsapp_number: string
    name: string | null
  } | null
}

interface UserEnrollment {
  id: string
  user_id: string
  status: string
  current_step: number
  variant: string | null
  enrolled_at: string
  next_scheduled_at: string | null
  user: {
    id: string
    whatsapp_number: string
    name: string | null
    subscription_plan: string | null
    created_at: string
  } | null
}

interface CampaignDetails {
  campaign: {
    id: string
    name: string
    description: string | null
    campaign_type: string
    status: string
    priority: number
    trigger_config: Record<string, unknown> | null
    target_filter: Record<string, unknown> | null
    cancel_condition: string | null
    settings: {
      batch_size?: number
      rate_limit_ms?: number
      send_window?: { start: number; end: number }
    } | null
    created_at: string
    scheduled_start_at: string | null
    scheduled_end_at: string | null
  }
  steps: CampaignStep[]
  stats: {
    total: number
    active: number
    pending: number
    completed: number
    cancelled: number
  }
  funnel: Record<number, { total: number; active: number; completed: number }>
  recentEvents: CampaignEvent[]
}

interface ABMetric {
  step_key: string
  variant: string
  sample_size: number
  messages_sent: number
  messages_delivered: number
  messages_read: number
  button_clicks: number
  conversions: number
  conversion_rate: number
  revenue: number
  avg_revenue_per_user: number
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  active: { label: 'Ativa', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: Play },
  paused: { label: 'Pausada', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', icon: Pause },
  draft: { label: 'Rascunho', color: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30', icon: Clock },
  ended: { label: 'Encerrada', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: XCircle },
}

const eventTypeLabels: Record<string, string> = {
  enrolled: 'Inscrito',
  step_sent: 'Mensagem enviada',
  button_clicked: 'Botao clicado',
  cancelled: 'Cancelado',
  completed: 'Completou',
  test_sent: 'Teste enviado',
}

const userStatusConfig: Record<string, { label: string; color: string }> = {
  active: { label: 'Ativo', color: 'bg-emerald-500/20 text-emerald-400' },
  pending: { label: 'Pendente', color: 'bg-yellow-500/20 text-yellow-400' },
  completed: { label: 'Completo', color: 'bg-blue-500/20 text-blue-400' },
  cancelled: { label: 'Cancelado', color: 'bg-red-500/20 text-red-400' },
  processing: { label: 'Processando', color: 'bg-purple-500/20 text-purple-400' },
}

export default function CampaignDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const [data, setData] = useState<CampaignDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')

  // Users state
  const [users, setUsers] = useState<UserEnrollment[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [usersTotal, setUsersTotal] = useState(0)
  const [usersPage, setUsersPage] = useState(1)
  const [userStatusFilter, setUserStatusFilter] = useState('all')

  // Settings modal state
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsBatchSize, setSettingsBatchSize] = useState('50')
  const [settingsRateLimit, setSettingsRateLimit] = useState('200')
  const [settingsWindowStart, setSettingsWindowStart] = useState('8')
  const [settingsWindowEnd, setSettingsWindowEnd] = useState('22')
  const [settingsSaving, setSettingsSaving] = useState(false)

  // Test modal state
  const [testOpen, setTestOpen] = useState(false)
  const [testNumber, setTestNumber] = useState('')
  const [testStep, setTestStep] = useState('0')
  const [testSending, setTestSending] = useState(false)
  const [testResult, setTestResult] = useState<{
    message?: { title?: string; body?: string }
    success?: boolean
  } | null>(null)

  // Clone modal state
  const [cloneOpen, setCloneOpen] = useState(false)
  const [cloneName, setCloneName] = useState('')
  const [cloneMessages, setCloneMessages] = useState(true)
  const [cloneSettings, setCloneSettings] = useState(true)
  const [cloning, setCloning] = useState(false)

  // A/B Metrics state
  const [abMetrics, setAbMetrics] = useState<ABMetric[]>([])
  const [abMetricsByStep, setAbMetricsByStep] = useState<Record<string, ABMetric[]>>({})
  const [abLoading, setAbLoading] = useState(false)

  const fetchCampaign = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/campaigns/${params.id}`)
      if (!response.ok) {
        if (response.status === 404) {
          router.push('/campaigns')
          return
        }
        throw new Error('Failed to fetch campaign')
      }
      const result = await response.json()
      setData(result)

      // Initialize settings from campaign data
      if (result.campaign.settings) {
        setSettingsBatchSize(String(result.campaign.settings.batch_size || 50))
        setSettingsRateLimit(String(result.campaign.settings.rate_limit_ms || 200))
        setSettingsWindowStart(String(result.campaign.settings.send_window?.start || 8))
        setSettingsWindowEnd(String(result.campaign.settings.send_window?.end || 22))
      }
    } catch (error) {
      console.error('Error fetching campaign:', error)
    } finally {
      setLoading(false)
    }
  }, [params.id, router])

  const fetchUsers = useCallback(async () => {
    setUsersLoading(true)
    try {
      const queryParams = new URLSearchParams({
        page: String(usersPage),
        limit: '10',
        status: userStatusFilter,
      })
      const response = await fetch(`/api/campaigns/${params.id}/users?${queryParams}`)
      if (!response.ok) throw new Error('Failed to fetch users')
      const result = await response.json()
      setUsers(result.enrollments || [])
      setUsersTotal(result.total || 0)
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setUsersLoading(false)
    }
  }, [params.id, usersPage, userStatusFilter])

  const fetchAbMetrics = useCallback(async () => {
    setAbLoading(true)
    try {
      const response = await fetch(`/api/campaigns/${params.id}/ab-metrics`)
      if (!response.ok) throw new Error('Failed to fetch A/B metrics')
      const result = await response.json()
      setAbMetrics(result.metrics || [])
      setAbMetricsByStep(result.byStep || {})
    } catch (error) {
      console.error('Error fetching A/B metrics:', error)
    } finally {
      setAbLoading(false)
    }
  }, [params.id])

  useEffect(() => {
    fetchCampaign()
  }, [fetchCampaign])

  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers()
    }
    if (activeTab === 'ab-tests') {
      fetchAbMetrics()
    }
  }, [activeTab, fetchUsers, fetchAbMetrics])

  const handleToggleStatus = async (newStatus?: string) => {
    if (!data) return
    setUpdating(true)
    try {
      const targetStatus = newStatus || (data.campaign.status === 'active' ? 'paused' : 'active')
      const response = await fetch(`/api/campaigns/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: targetStatus }),
      })
      if (!response.ok) throw new Error('Failed to update campaign')
      await fetchCampaign()
    } catch (error) {
      console.error('Error updating campaign:', error)
    } finally {
      setUpdating(false)
    }
  }

  const handleSaveSettings = async () => {
    setSettingsSaving(true)
    try {
      const settings = {
        batch_size: parseInt(settingsBatchSize),
        rate_limit_ms: parseInt(settingsRateLimit),
        send_window: {
          start: parseInt(settingsWindowStart),
          end: parseInt(settingsWindowEnd),
        },
      }
      const response = await fetch(`/api/campaigns/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      })
      if (!response.ok) throw new Error('Failed to save settings')
      setSettingsOpen(false)
      await fetchCampaign()
    } catch (error) {
      console.error('Error saving settings:', error)
      alert('Erro ao salvar configuracoes')
    } finally {
      setSettingsSaving(false)
    }
  }

  const handleSendTest = async () => {
    if (!testNumber.trim()) return
    setTestSending(true)
    setTestResult(null)
    try {
      const response = await fetch(`/api/campaigns/${params.id}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          whatsapp_number: testNumber,
          step_order: parseInt(testStep),
        }),
      })
      const result = await response.json()
      if (!response.ok) {
        alert(result.error || 'Erro ao enviar teste')
        return
      }
      setTestResult(result)
    } catch (error) {
      console.error('Error sending test:', error)
      alert('Erro ao enviar teste')
    } finally {
      setTestSending(false)
    }
  }

  const handleClone = async () => {
    if (!cloneName.trim()) return
    setCloning(true)
    try {
      const response = await fetch(`/api/campaigns/${params.id}/clone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cloneName,
          clone_messages: cloneMessages,
          clone_settings: cloneSettings,
        }),
      })
      const result = await response.json()
      if (!response.ok) {
        alert(result.error || 'Erro ao clonar campanha')
        return
      }
      setCloneOpen(false)
      router.push(`/campaigns/${result.campaign.id}`)
    } catch (error) {
      console.error('Error cloning campaign:', error)
      alert('Erro ao clonar campanha')
    } finally {
      setCloning(false)
    }
  }

  const handleCancelUser = async (userId: string) => {
    if (!confirm('Cancelar inscricao deste usuario na campanha?')) return
    try {
      const response = await fetch(`/api/campaigns/${params.id}/users?user_id=${userId}`, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error('Failed to cancel enrollment')
      fetchUsers()
    } catch (error) {
      console.error('Error cancelling user:', error)
      alert('Erro ao cancelar usuario')
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Campanha nao encontrada</p>
      </div>
    )
  }

  const { campaign, steps, stats, funnel, recentEvents } = data
  const status = statusConfig[campaign.status] || statusConfig.draft
  const StatusIcon = status.icon
  const conversionRate = stats.total > 0 ? ((stats.completed / stats.total) * 100).toFixed(1) : '0'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/campaigns">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{campaign.name}</h1>
              <Badge variant="outline" className={status.color}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {status.label}
              </Badge>
            </div>
            {campaign.description && (
              <p className="text-muted-foreground">{campaign.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/campaigns/${params.id}/workflow`}>
            <Button variant="outline" size="sm">
              <FlaskConical className="h-4 w-4 mr-2" />
              Editor Visual
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={() => setTestOpen(true)}>
            <TestTube className="h-4 w-4 mr-2" />
            Testar
          </Button>
          <Button variant="outline" size="sm" onClick={() => {
            setCloneName(`${campaign.name}_copy`)
            setCloneOpen(true)
          }}>
            <Copy className="h-4 w-4 mr-2" />
            Clonar
          </Button>
          <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
          <Button variant="outline" size="sm" onClick={fetchCampaign} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          {campaign.status !== 'ended' && campaign.status !== 'draft' && (
            <>
              <Button
                variant={campaign.status === 'active' ? 'destructive' : 'default'}
                size="sm"
                onClick={() => handleToggleStatus()}
                disabled={updating}
              >
                {campaign.status === 'active' ? (
                  <>
                    <Pause className="h-4 w-4 mr-2" />
                    Pausar
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Ativar
                  </>
                )}
              </Button>
              {campaign.status === 'active' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (confirm('Encerrar esta campanha definitivamente?')) {
                      handleToggleStatus('ended')
                    }
                  }}
                  disabled={updating}
                  className="text-red-400 border-red-500/30 hover:bg-red-500/10"
                >
                  <StopCircle className="h-4 w-4 mr-2" />
                  Encerrar
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Inscritos</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Ativos</p>
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
                <p className="text-sm text-muted-foreground">Pendentes</p>
                <p className="text-2xl font-bold text-yellow-400">{stats.pending}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completados</p>
                <p className="text-2xl font-bold text-blue-400">{stats.completed}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-blue-500/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Conversao</p>
                <p className="text-2xl font-bold text-purple-400">{conversionRate}%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-500/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Visao Geral</TabsTrigger>
          <TabsTrigger value="users">Usuarios ({stats.total})</TabsTrigger>
          <TabsTrigger value="events">Eventos</TabsTrigger>
          <TabsTrigger value="ab-tests">
            <FlaskConical className="h-4 w-4 mr-1" />
            Testes A/B
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Funnel */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Funil por Step
                </CardTitle>
                <CardDescription>Usuarios em cada etapa da campanha</CardDescription>
              </CardHeader>
              <CardContent>
                {steps.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Nenhum step configurado</p>
                ) : (
                  <div className="space-y-3">
                    {steps.map((step) => {
                      const stepData = funnel[step.step_order] || { total: 0, active: 0, completed: 0 }
                      const maxTotal = Math.max(...Object.values(funnel).map(f => f.total), 1)
                      const percentage = (stepData.total / maxTotal) * 100

                      return (
                        <div key={step.id} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">{step.step_key}</span>
                            <span className="text-muted-foreground">
                              {stepData.total} usuarios ({step.delay_hours}h delay)
                            </span>
                          </div>
                          <div className="h-3 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Configuration */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Configuracao
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tipo</span>
                    <span className="font-medium">{campaign.campaign_type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Prioridade</span>
                    <span className="font-medium">{campaign.priority}</span>
                  </div>
                  {campaign.settings && (
                    <>
                      <Separator />
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Batch Size</span>
                        <span className="font-medium">{campaign.settings.batch_size || 50}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Rate Limit</span>
                        <span className="font-medium">{campaign.settings.rate_limit_ms || 200}ms</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Janela de Envio</span>
                        <span className="font-medium">
                          {campaign.settings.send_window?.start || 8}h - {campaign.settings.send_window?.end || 22}h
                        </span>
                      </div>
                    </>
                  )}
                  {campaign.trigger_config && (
                    <>
                      <Separator />
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Trigger</span>
                        <span className="font-medium font-mono text-xs">
                          {JSON.stringify(campaign.trigger_config)}
                        </span>
                      </div>
                    </>
                  )}
                  {campaign.cancel_condition && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cancelar se</span>
                      <span className="font-medium font-mono text-xs">{campaign.cancel_condition}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Criada em</span>
                    <span className="font-medium">
                      {format(new Date(campaign.created_at), "dd/MM/yyyy 'as' HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Steps */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Steps ({steps.length})
              </CardTitle>
              <CardDescription>Etapas e mensagens da campanha</CardDescription>
            </CardHeader>
            <CardContent>
              {steps.length === 0 ? (
                <p className="text-muted-foreground text-sm">Nenhum step configurado</p>
              ) : (
                <div className="space-y-4">
                  {steps.map((step, index) => (
                    <div key={step.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{index + 1}</Badge>
                          <span className="font-medium">{step.step_key}</span>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          Delay: {step.delay_hours}h
                        </span>
                      </div>
                      {step.messages.length > 0 && (
                        <div className="mt-2 space-y-2">
                          {step.messages.map(msg => (
                            <div key={msg.id} className="bg-muted/50 rounded p-3 text-sm">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="secondary" className="text-xs">
                                  {msg.content_type}
                                </Badge>
                                {msg.variant !== 'default' && (
                                  <Badge variant="outline" className="text-xs">
                                    {msg.variant}
                                  </Badge>
                                )}
                              </div>
                              {msg.title && <p className="font-medium">{msg.title}</p>}
                              <p className="text-muted-foreground line-clamp-2">{msg.body}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4">
          <div className="flex items-center gap-4">
            <Select value={userStatusFilter} onValueChange={(v) => { setUserStatusFilter(v); setUsersPage(1) }}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Ativos</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="completed">Completados</SelectItem>
                <SelectItem value="cancelled">Cancelados</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">
              {usersTotal} usuarios
            </span>
          </div>

          <Card>
            <CardContent className="pt-6">
              {usersLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-16" />
                  ))}
                </div>
              ) : users.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum usuario encontrado</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {users.map(enrollment => {
                    const statusInfo = userStatusConfig[enrollment.status] || userStatusConfig.pending
                    return (
                      <div
                        key={enrollment.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                            <User className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-mono">
                                {enrollment.user?.whatsapp_number?.replace(/^55/, '+55 ').replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3') || 'N/A'}
                              </p>
                              <Badge variant="secondary" className={statusInfo.color}>
                                {statusInfo.label}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                              <span>Step: {enrollment.current_step}</span>
                              {enrollment.variant && <span>Variant: {enrollment.variant}</span>}
                              <span>
                                Inscrito {formatDistanceToNow(new Date(enrollment.enrolled_at), { addSuffix: true, locale: ptBR })}
                              </span>
                            </div>
                          </div>
                        </div>
                        {enrollment.status === 'active' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCancelUser(enrollment.user_id)}
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Pagination */}
              {usersTotal > 10 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <span className="text-sm text-muted-foreground">
                    Pagina {usersPage} de {Math.ceil(usersTotal / 10)}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setUsersPage(p => Math.max(1, p - 1))}
                      disabled={usersPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setUsersPage(p => p + 1)}
                      disabled={usersPage >= Math.ceil(usersTotal / 10)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Events Tab */}
        <TabsContent value="events">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Eventos Recentes
              </CardTitle>
              <CardDescription>Ultimas atividades na campanha</CardDescription>
            </CardHeader>
            <CardContent>
              {recentEvents.length === 0 ? (
                <p className="text-muted-foreground text-sm">Nenhum evento registrado</p>
              ) : (
                <div className="space-y-2">
                  {recentEvents.map(event => (
                    <div
                      key={event.id}
                      className="flex items-center justify-between py-2 border-b border-border/50 last:border-0"
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="text-xs">
                          {eventTypeLabels[event.event_type] || event.event_type}
                        </Badge>
                        <span className="text-sm">
                          {event.user?.name || event.user?.whatsapp_number || 'Usuario'}
                        </span>
                        {event.step_key && (
                          <span className="text-xs text-muted-foreground">
                            Step: {event.step_key}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(event.created_at), { addSuffix: true, locale: ptBR })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* A/B Tests Tab */}
        <TabsContent value="ab-tests" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <FlaskConical className="h-5 w-5" />
                Dashboard de Testes A/B
              </h3>
              <p className="text-sm text-muted-foreground">
                Compare o desempenho das variantes por step
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={fetchAbMetrics} disabled={abLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${abLoading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>

          {abLoading ? (
            <div className="space-y-4">
              {[1, 2].map(i => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-5 w-32" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-32 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : Object.keys(abMetricsByStep).length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="font-medium">Nenhum dado de teste A/B</p>
                  <p className="text-sm mt-1">
                    Configure variantes nos steps para começar a coletar dados
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {Object.entries(abMetricsByStep).map(([stepKey, variants]) => (
                <Card key={stepKey}>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Badge variant="outline">{stepKey}</Badge>
                      <span className="text-muted-foreground text-sm font-normal">
                        {variants.length} variante(s)
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2 px-3 font-medium">Variante</th>
                            <th className="text-right py-2 px-3 font-medium">Amostra</th>
                            <th className="text-right py-2 px-3 font-medium">Enviadas</th>
                            <th className="text-right py-2 px-3 font-medium">Entregues</th>
                            <th className="text-right py-2 px-3 font-medium">Lidas</th>
                            <th className="text-right py-2 px-3 font-medium">Cliques</th>
                            <th className="text-right py-2 px-3 font-medium">Conversões</th>
                            <th className="text-right py-2 px-3 font-medium">Taxa Conv.</th>
                            <th className="text-right py-2 px-3 font-medium">Receita</th>
                          </tr>
                        </thead>
                        <tbody>
                          {variants.map((v, idx) => {
                            // Find the best conversion rate to highlight
                            const maxConvRate = Math.max(...variants.map(x => x.conversion_rate))
                            const isWinner = v.conversion_rate === maxConvRate && v.conversion_rate > 0

                            return (
                              <tr key={v.variant} className={`border-b last:border-0 ${isWinner ? 'bg-emerald-500/10' : ''}`}>
                                <td className="py-3 px-3">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{v.variant}</span>
                                    {isWinner && (
                                      <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-400 text-xs">
                                        Melhor
                                      </Badge>
                                    )}
                                  </div>
                                </td>
                                <td className="text-right py-3 px-3">{v.sample_size}</td>
                                <td className="text-right py-3 px-3">{v.messages_sent}</td>
                                <td className="text-right py-3 px-3">{v.messages_delivered}</td>
                                <td className="text-right py-3 px-3">{v.messages_read}</td>
                                <td className="text-right py-3 px-3">{v.button_clicks}</td>
                                <td className="text-right py-3 px-3">{v.conversions}</td>
                                <td className="text-right py-3 px-3">
                                  <span className={isWinner ? 'text-emerald-400 font-bold' : ''}>
                                    {v.conversion_rate}%
                                  </span>
                                </td>
                                <td className="text-right py-3 px-3">
                                  R$ {v.revenue.toFixed(2)}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Visual comparison bars */}
                    <div className="mt-4 pt-4 border-t space-y-2">
                      <p className="text-xs text-muted-foreground mb-2">Taxa de Conversão</p>
                      {variants.map(v => {
                        const maxRate = Math.max(...variants.map(x => x.conversion_rate), 1)
                        const percentage = (v.conversion_rate / maxRate) * 100

                        return (
                          <div key={v.variant} className="flex items-center gap-3">
                            <span className="text-xs w-20 truncate">{v.variant}</span>
                            <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                            <span className="text-xs w-12 text-right">{v.conversion_rate}%</span>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Settings Modal */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configuracoes da Campanha</DialogTitle>
            <DialogDescription>
              Ajuste os parametros de envio da campanha
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="batch-size">Batch Size</Label>
              <Input
                id="batch-size"
                type="number"
                value={settingsBatchSize}
                onChange={(e) => setSettingsBatchSize(e.target.value)}
                min={1}
                max={100}
              />
              <p className="text-xs text-muted-foreground">
                Quantidade de mensagens por lote (max 100)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rate-limit">Rate Limit (ms)</Label>
              <Input
                id="rate-limit"
                type="number"
                value={settingsRateLimit}
                onChange={(e) => setSettingsRateLimit(e.target.value)}
                min={100}
                max={5000}
              />
              <p className="text-xs text-muted-foreground">
                Intervalo entre mensagens em milissegundos (min 100)
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="window-start">Inicio da Janela (hora)</Label>
                <Input
                  id="window-start"
                  type="number"
                  value={settingsWindowStart}
                  onChange={(e) => setSettingsWindowStart(e.target.value)}
                  min={0}
                  max={23}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="window-end">Fim da Janela (hora)</Label>
                <Input
                  id="window-end"
                  type="number"
                  value={settingsWindowEnd}
                  onChange={(e) => setSettingsWindowEnd(e.target.value)}
                  min={0}
                  max={23}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Mensagens so serao enviadas entre {settingsWindowStart}h e {settingsWindowEnd}h
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveSettings} disabled={settingsSaving}>
              {settingsSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test Modal */}
      <Dialog open={testOpen} onOpenChange={setTestOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar Mensagem de Teste</DialogTitle>
            <DialogDescription>
              Visualize como a mensagem sera enviada
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="test-number">Numero WhatsApp</Label>
              <Input
                id="test-number"
                placeholder="5511999999999"
                value={testNumber}
                onChange={(e) => setTestNumber(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="test-step">Step</Label>
              <Select value={testStep} onValueChange={setTestStep}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {steps.map((step) => (
                    <SelectItem key={step.id} value={String(step.step_order)}>
                      {step.step_key} (Step {step.step_order})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {testResult && (
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <p className="font-medium mb-2">Preview da Mensagem:</p>
                <div className="text-sm space-y-1">
                  {testResult.message?.title && (
                    <p className="font-medium">{testResult.message.title}</p>
                  )}
                  {testResult.message?.body && (
                    <p className="text-muted-foreground">{testResult.message.body}</p>
                  )}
                </div>
                <Badge variant="outline" className="mt-2 bg-emerald-500/20 text-emerald-400">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Preview gerado
                </Badge>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setTestOpen(false); setTestResult(null) }}>
              Fechar
            </Button>
            <Button onClick={handleSendTest} disabled={testSending || !testNumber.trim()}>
              {testSending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Visualizar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clone Modal */}
      <Dialog open={cloneOpen} onOpenChange={setCloneOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clonar Campanha</DialogTitle>
            <DialogDescription>
              Criar uma copia desta campanha com todas as configuracoes
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="clone-name">Nome da Nova Campanha</Label>
              <Input
                id="clone-name"
                value={cloneName}
                onChange={(e) => setCloneName(e.target.value)}
                placeholder="nome_da_campanha"
              />
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="clone-messages"
                  checked={cloneMessages}
                  onChange={(e) => setCloneMessages(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="clone-messages" className="text-sm font-normal">
                  Clonar mensagens dos steps
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="clone-settings"
                  checked={cloneSettings}
                  onChange={(e) => setCloneSettings(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="clone-settings" className="text-sm font-normal">
                  Clonar configuracoes (rate limit, janela)
                </Label>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              A nova campanha sera criada como rascunho
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloneOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleClone} disabled={cloning || !cloneName.trim()}>
              {cloning ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Clonando...
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Clonar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
