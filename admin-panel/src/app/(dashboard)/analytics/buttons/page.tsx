'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { createClient } from '@/lib/supabase/client'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Cell,
  PieChart,
  Pie,
  Area,
  AreaChart,
} from 'recharts'
import {
  MousePointer2,
  TrendingDown,
  Users,
  CreditCard,
  Clock,
  AlertTriangle,
  CheckCircle,
  Twitter,
  Gift,
  XCircle,
  Zap,
  ArrowRight,
  Eye,
  Target,
  Send,
  Timer,
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/lib/utils'

// Types
interface ButtonClick {
  botao: string
  texto_botao: string
  cliques: number
  usuarios: number
}

interface DailyClick {
  dia: string
  cliques: number
}

interface FunnelStep {
  etapa: string
  usuarios: number
  icon: React.ComponentType<{ className?: string }>
  color: string
}

interface PendingPayment {
  id: string
  user_name: string
  user_number: string
  plan: string
  amount: number
  created_at: string
}

interface ReminderStats {
  reminder_type: string
  status: string
  total: number
}

// Chart theme colors (for dark mode)
const chartColors = {
  axis: '#a1a1aa',
  grid: '#27272a',
  tooltip: {
    bg: '#18181b',
    border: '#3f3f46',
    text: '#fafafa',
  },
}

// Button category config with icons
const BUTTON_CATEGORIES: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  'button_twitter': { label: 'Twitter', color: '#1da1f2', icon: Twitter },
  'btn_twitter': { label: 'Twitter', color: '#1da1f2', icon: Twitter },
  'button_upgrade': { label: 'Upgrade', color: '#10b981', icon: Zap },
  'button_dismiss': { label: 'Recusar', color: '#ef4444', icon: XCircle },
  'button_use_bonus': { label: 'Bônus', color: '#f59e0b', icon: Gift },
  'payment_pix': { label: 'PIX', color: '#8b5cf6', icon: CreditCard },
  'payment_card': { label: 'Cartão', color: '#3b82f6', icon: CreditCard },
  'button_confirm': { label: 'Confirmar', color: '#10b981', icon: CheckCircle },
  'plan_': { label: 'Planos', color: '#6366f1', icon: Target },
}

function getButtonCategory(buttonId: string) {
  for (const [prefix, config] of Object.entries(BUTTON_CATEGORIES)) {
    if (buttonId?.startsWith(prefix)) {
      return config
    }
  }
  return { label: 'Outros', color: '#64748b', icon: MousePointer2 }
}

// Remove emojis from text
function cleanText(text: string): string {
  return text?.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F000}-\u{1F02F}]|[\u{1F0A0}-\u{1F0FF}]/gu, '').trim() || text
}

// Custom tooltip component
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null

  return (
    <div className="bg-card border border-border rounded-lg shadow-xl p-3 animate-in fade-in-0 zoom-in-95 duration-200">
      <p className="text-sm font-medium text-foreground mb-1">{label}</p>
      {payload.map((entry: any, index: number) => (
        <p key={index} className="text-sm" style={{ color: entry.color }}>
          {entry.name}: <span className="font-semibold">{entry.value}</span>
        </p>
      ))}
    </div>
  )
}

// KPI Card component with animation
function KpiCard({
  title,
  value,
  icon: Icon,
  color,
  delay = 0,
}: {
  title: string
  value: number | string
  icon: React.ComponentType<{ className?: string }>
  color: string
  delay?: number
}) {
  return (
    <Card className="overflow-hidden transition-all duration-300 hover:shadow-lg hover:scale-[1.02] hover:border-primary/50">
      <CardContent className="pt-6">
        <div className="flex items-center gap-4">
          <div
            className="p-3 rounded-xl transition-transform duration-300 hover:scale-110"
            style={{ backgroundColor: `${color}20`, color }}
          >
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p
              className="text-2xl font-bold animate-in slide-in-from-bottom-2 duration-500"
              style={{ animationDelay: `${delay}ms` }}
            >
              {value}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function ButtonsAnalyticsPage() {
  const [buttonClicks, setButtonClicks] = useState<ButtonClick[]>([])
  const [dailyClicks, setDailyClicks] = useState<DailyClick[]>([])
  const [funnelData, setFunnelData] = useState<FunnelStep[]>([])
  const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([])
  const [reminderStats, setReminderStats] = useState<ReminderStats[]>([])
  const [loading, setLoading] = useState(true)
  const [totals, setTotals] = useState({ clicks: 0, users: 0, conversions: 0 })

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    const supabase = createClient()

    try {
      // 1. Button clicks
      const { data: rawClicks } = await supabase
        .from('usage_logs')
        .select('details, user_number')
        .eq('action', 'button_clicked')

      if (rawClicks) {
        const clickMap = new Map<string, { cliques: number; usuarios: Set<string>; texto: string }>()

        rawClicks.forEach((log: any) => {
          const buttonId = log.details?.button_id || 'unknown'
          const buttonText = log.details?.button_text || ''

          if (!clickMap.has(buttonId)) {
            clickMap.set(buttonId, { cliques: 0, usuarios: new Set(), texto: buttonText })
          }
          const entry = clickMap.get(buttonId)!
          entry.cliques++
          entry.usuarios.add(log.user_number)
        })

        const processedClicks = Array.from(clickMap.entries())
          .map(([botao, data]) => ({
            botao,
            texto_botao: data.texto,
            cliques: data.cliques,
            usuarios: data.usuarios.size,
          }))
          .sort((a, b) => b.cliques - a.cliques)
          .slice(0, 15)

        setButtonClicks(processedClicks)
        setTotals(prev => ({
          ...prev,
          clicks: rawClicks.length,
          users: new Set(rawClicks.map((r: any) => r.user_number)).size,
        }))
      }

      // 2. Daily clicks (last 14 days)
      const { data: daily } = await supabase
        .from('usage_logs')
        .select('created_at')
        .eq('action', 'button_clicked')
        .gte('created_at', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: true })

      if (daily) {
        const dailyMap = new Map<string, number>()
        daily.forEach((log: any) => {
          const date = format(new Date(log.created_at), 'dd/MM')
          dailyMap.set(date, (dailyMap.get(date) || 0) + 1)
        })

        setDailyClicks(
          Array.from(dailyMap.entries()).map(([dia, cliques]) => ({ dia, cliques }))
        )
      }

      // 3. Funnel data
      const { data: funnelRaw } = await supabase
        .from('experiment_events')
        .select('event_type, user_id')

      if (funnelRaw) {
        const eventCounts: Record<string, Set<string>> = {}
        funnelRaw.forEach((e: any) => {
          if (!eventCounts[e.event_type]) {
            eventCounts[e.event_type] = new Set()
          }
          eventCounts[e.event_type].add(e.user_id)
        })

        const funnel: FunnelStep[] = [
          { etapa: 'Menu visto', usuarios: eventCounts['menu_shown']?.size || 0, icon: Eye, color: '#8b5cf6' },
          { etapa: 'Clicou upgrade', usuarios: eventCounts['upgrade_clicked']?.size || 0, icon: Zap, color: '#3b82f6' },
          { etapa: 'Intenção pagar', usuarios: eventCounts['payment_intent']?.size || 0, icon: Target, color: '#10b981' },
          { etapa: 'Iniciou pagamento', usuarios: eventCounts['payment_started']?.size || 0, icon: CreditCard, color: '#f59e0b' },
          { etapa: 'Converteu', usuarios: eventCounts['converted']?.size || 0, icon: CheckCircle, color: '#22c55e' },
        ]
        setFunnelData(funnel)
        setTotals(prev => ({ ...prev, conversions: eventCounts['converted']?.size || 0 }))
      }

      // 4. Pending payments
      const { data: pending } = await supabase
        .from('pix_payments')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      if (pending) setPendingPayments(pending)

      // 5. Reminder stats
      const { data: reminders } = await supabase
        .from('scheduled_reminders')
        .select('reminder_type, status')

      if (reminders) {
        const statsMap = new Map<string, { sent: number; canceled: number; pending: number }>()

        reminders.forEach((r: any) => {
          if (!statsMap.has(r.reminder_type)) {
            statsMap.set(r.reminder_type, { sent: 0, canceled: 0, pending: 0 })
          }
          const entry = statsMap.get(r.reminder_type)!
          if (r.status === 'sent') entry.sent++
          else if (r.status === 'canceled') entry.canceled++
          else if (r.status === 'pending') entry.pending++
        })

        const stats: ReminderStats[] = []
        statsMap.forEach((value, key) => {
          stats.push({ reminder_type: key, status: 'sent', total: value.sent })
          stats.push({ reminder_type: key, status: 'canceled', total: value.canceled })
          stats.push({ reminder_type: key, status: 'pending', total: value.pending })
        })
        setReminderStats(stats)
      }

    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Process chart data
  const barChartData = buttonClicks.slice(0, 10).map((item) => ({
    name: cleanText(item.texto_botao)?.slice(0, 18) || item.botao.slice(0, 18),
    cliques: item.cliques,
    fill: getButtonCategory(item.botao).color,
  }))

  const categoryData = buttonClicks.reduce((acc, item) => {
    const category = getButtonCategory(item.botao).label
    const existing = acc.find(a => a.name === category)
    if (existing) {
      existing.value += item.cliques
    } else {
      acc.push({ name: category, value: item.cliques, fill: getButtonCategory(item.botao).color })
    }
    return acc
  }, [] as { name: string; value: number; fill: string }[]).sort((a, b) => b.value - a.value)

  const reminderChartData = [
    {
      name: 'Wave 1',
      tempo: '30min',
      enviados: reminderStats.find(r => r.reminder_type === 'payment_reminder_wave1' && r.status === 'sent')?.total || 0,
      convertidos: reminderStats.find(r => r.reminder_type === 'payment_reminder_wave1' && r.status === 'canceled')?.total || 0,
    },
    {
      name: 'Wave 2',
      tempo: '6h',
      enviados: reminderStats.find(r => r.reminder_type === 'payment_reminder_wave2' && r.status === 'sent')?.total || 0,
      convertidos: reminderStats.find(r => r.reminder_type === 'payment_reminder_wave2' && r.status === 'canceled')?.total || 0,
    },
    {
      name: 'Wave 3',
      tempo: '48h',
      enviados: reminderStats.find(r => r.reminder_type === 'payment_reminder_wave3' && r.status === 'sent')?.total || 0,
      convertidos: reminderStats.find(r => r.reminder_type === 'payment_reminder_wave3' && r.status === 'canceled')?.total || 0,
    },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground animate-pulse">Carregando dados...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in-0 duration-500">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Analytics de Botões</h1>
        <p className="text-muted-foreground">
          Análise estratégica de cliques e funil de conversão
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Total de Cliques" value={totals.clicks} icon={MousePointer2} color="#8b5cf6" delay={0} />
        <KpiCard title="Usuários Únicos" value={totals.users} icon={Users} color="#3b82f6" delay={100} />
        <KpiCard title="PIX Pendentes" value={pendingPayments.length} icon={AlertTriangle} color="#f59e0b" delay={200} />
        <KpiCard title="Conversões" value={totals.conversions} icon={CheckCircle} color="#22c55e" delay={300} />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="buttons" className="space-y-6">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="buttons" className="gap-2 data-[state=active]:bg-background">
            <MousePointer2 className="h-4 w-4" />
            Botões
          </TabsTrigger>
          <TabsTrigger value="funnel" className="gap-2 data-[state=active]:bg-background">
            <Target className="h-4 w-4" />
            Funil
          </TabsTrigger>
          <TabsTrigger value="reminders" className="gap-2 data-[state=active]:bg-background">
            <Timer className="h-4 w-4" />
            Lembretes
          </TabsTrigger>
          <TabsTrigger value="abandoned" className="gap-2 data-[state=active]:bg-background">
            <AlertTriangle className="h-4 w-4" />
            Abandonos
          </TabsTrigger>
        </TabsList>

        {/* Buttons Tab */}
        <TabsContent value="buttons" className="space-y-6 animate-in fade-in-0 slide-in-from-bottom-4 duration-300">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Bar Chart */}
            <Card className="overflow-hidden">
              <CardHeader className="border-b bg-muted/30">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BarChart className="h-5 w-5 text-primary" />
                  Botões Mais Clicados
                </CardTitle>
                <CardDescription>Top 10 por número de cliques</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="h-[380px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barChartData} layout="vertical" margin={{ left: 10, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} horizontal={true} vertical={false} />
                      <XAxis
                        type="number"
                        stroke={chartColors.axis}
                        tick={{ fill: chartColors.axis, fontSize: 12 }}
                        axisLine={{ stroke: chartColors.grid }}
                      />
                      <YAxis
                        dataKey="name"
                        type="category"
                        width={130}
                        stroke={chartColors.axis}
                        tick={{ fill: chartColors.axis, fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                      <Bar dataKey="cliques" radius={[0, 6, 6, 0]} animationDuration={800}>
                        {barChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Pie Chart */}
            <Card className="overflow-hidden">
              <CardHeader className="border-b bg-muted/30">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <PieChart className="h-5 w-5 text-primary" />
                  Cliques por Categoria
                </CardTitle>
                <CardDescription>Distribuição por tipo de botão</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="h-[380px] flex items-center gap-4">
                  <div className="w-1/2 h-full flex-shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={3}
                          dataKey="value"
                          animationDuration={800}
                        >
                          {categoryData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} stroke="transparent" />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="w-1/2 h-full overflow-y-auto pr-2 space-y-2">
                    {categoryData.map((cat, idx) => {
                      const config = Object.values(BUTTON_CATEGORIES).find(c => c.label === cat.name) || { icon: MousePointer2 }
                      const Icon = config.icon
                      return (
                        <div
                          key={idx}
                          className="flex items-center gap-3 p-2 rounded-lg transition-colors hover:bg-muted/50"
                        >
                          <div
                            className="p-1.5 rounded-md"
                            style={{ backgroundColor: `${cat.fill}20`, color: cat.fill }}
                          >
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{cat.name}</p>
                          </div>
                          <p className="text-sm font-bold flex-shrink-0" style={{ color: cat.fill }}>{cat.value}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Area Chart - Timeline */}
          <Card className="overflow-hidden">
            <CardHeader className="border-b bg-muted/30">
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingDown className="h-5 w-5 text-primary" />
                Evolução Diária
              </CardTitle>
              <CardDescription>Cliques nos últimos 14 dias</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailyClicks} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorCliques" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
                    <XAxis
                      dataKey="dia"
                      stroke={chartColors.axis}
                      tick={{ fill: chartColors.axis, fontSize: 12 }}
                      axisLine={{ stroke: chartColors.grid }}
                      tickLine={false}
                    />
                    <YAxis
                      stroke={chartColors.axis}
                      tick={{ fill: chartColors.axis, fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="cliques"
                      stroke="#8b5cf6"
                      strokeWidth={2}
                      fill="url(#colorCliques)"
                      animationDuration={1000}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Table */}
          <Card className="overflow-hidden">
            <CardHeader className="border-b bg-muted/30">
              <CardTitle className="text-lg">Detalhes dos Botões</CardTitle>
              <CardDescription>Métricas completas de cada botão</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left py-4 px-6 font-medium text-muted-foreground">Botão</th>
                      <th className="text-left py-4 px-6 font-medium text-muted-foreground">Categoria</th>
                      <th className="text-right py-4 px-6 font-medium text-muted-foreground">Cliques</th>
                      <th className="text-right py-4 px-6 font-medium text-muted-foreground">Usuários</th>
                      <th className="text-right py-4 px-6 font-medium text-muted-foreground">Média</th>
                    </tr>
                  </thead>
                  <tbody>
                    {buttonClicks.map((btn, idx) => {
                      const category = getButtonCategory(btn.botao)
                      const Icon = category.icon
                      return (
                        <tr
                          key={idx}
                          className="border-b transition-colors hover:bg-muted/30"
                          style={{ animationDelay: `${idx * 50}ms` }}
                        >
                          <td className="py-4 px-6">
                            <div>
                              <p className="font-medium">{cleanText(btn.texto_botao) || btn.botao}</p>
                              <code className="text-xs text-muted-foreground">{btn.botao}</code>
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <div
                              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium"
                              style={{ backgroundColor: `${category.color}15`, color: category.color }}
                            >
                              <Icon className="h-3.5 w-3.5" />
                              {category.label}
                            </div>
                          </td>
                          <td className="text-right py-4 px-6 font-mono font-semibold">{btn.cliques}</td>
                          <td className="text-right py-4 px-6 font-mono text-muted-foreground">{btn.usuarios}</td>
                          <td className="text-right py-4 px-6 font-mono text-muted-foreground">
                            {(btn.cliques / btn.usuarios).toFixed(1)}x
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Funnel Tab */}
        <TabsContent value="funnel" className="space-y-6 animate-in fade-in-0 slide-in-from-bottom-4 duration-300">
          <Card className="overflow-hidden">
            <CardHeader className="border-b bg-muted/30">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Target className="h-5 w-5 text-primary" />
                Funil de Conversão
              </CardTitle>
              <CardDescription>Da visualização do menu até a conversão final</CardDescription>
            </CardHeader>
            <CardContent className="py-8">
              <div className="max-w-3xl mx-auto space-y-4">
                {funnelData.map((step, idx) => {
                  const Icon = step.icon
                  const prevStep = idx > 0 ? funnelData[idx - 1] : null
                  const firstStep = funnelData[0]
                  const conversionRate = prevStep && prevStep.usuarios > 0
                    ? ((step.usuarios / prevStep.usuarios) * 100).toFixed(1)
                    : '100'
                  const totalRate = firstStep.usuarios > 0
                    ? ((step.usuarios / firstStep.usuarios) * 100).toFixed(1)
                    : '100'
                  const dropOff = prevStep ? prevStep.usuarios - step.usuarios : 0
                  const barWidth = firstStep.usuarios > 0 ? (step.usuarios / firstStep.usuarios) * 100 : 100

                  return (
                    <div
                      key={idx}
                      className="animate-in slide-in-from-left duration-500"
                      style={{ animationDelay: `${idx * 100}ms` }}
                    >
                      <div className="flex items-center gap-4 mb-2">
                        <div
                          className="p-2.5 rounded-xl transition-transform hover:scale-110"
                          style={{ backgroundColor: `${step.color}20`, color: step.color }}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold">{step.etapa}</span>
                            <div className="flex items-center gap-3">
                              <span className="text-2xl font-bold">{step.usuarios}</span>
                              {idx > 0 && (
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    'font-mono',
                                    Number(conversionRate) >= 50 ? 'border-emerald-500 text-emerald-500' : 'border-red-500 text-red-500'
                                  )}
                                >
                                  {conversionRate}%
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="relative h-8 bg-muted rounded-lg overflow-hidden">
                            <div
                              className="absolute inset-y-0 left-0 rounded-lg transition-all duration-700 ease-out"
                              style={{
                                width: `${barWidth}%`,
                                backgroundColor: step.color,
                                opacity: 0.8,
                              }}
                            />
                            <div className="absolute inset-0 flex items-center justify-end pr-3">
                              <span className="text-xs font-medium text-foreground/70">{totalRate}% do total</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      {idx > 0 && dropOff > 0 && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground ml-14 mt-1">
                          <TrendingDown className="h-4 w-4 text-red-500" />
                          <span>-{dropOff} usuários perdidos ({(100 - Number(conversionRate)).toFixed(1)}% drop)</span>
                        </div>
                      )}
                      {idx < funnelData.length - 1 && (
                        <div className="flex justify-center my-2">
                          <ArrowRight className="h-5 w-5 text-muted-foreground/50 rotate-90" />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reminders Tab */}
        <TabsContent value="reminders" className="space-y-6 animate-in fade-in-0 slide-in-from-bottom-4 duration-300">
          <Card className="overflow-hidden">
            <CardHeader className="border-b bg-muted/30">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Timer className="h-5 w-5 text-primary" />
                Performance dos Lembretes
              </CardTitle>
              <CardDescription>Remarketing de PIX abandonado por wave</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={reminderChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
                    <XAxis
                      dataKey="name"
                      stroke={chartColors.axis}
                      tick={{ fill: chartColors.axis, fontSize: 12 }}
                      axisLine={{ stroke: chartColors.grid }}
                    />
                    <YAxis
                      stroke={chartColors.axis}
                      tick={{ fill: chartColors.axis, fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="enviados" name="Enviados" fill="#8b5cf6" radius={[6, 6, 0, 0]} animationDuration={800} />
                    <Bar dataKey="convertidos" name="Convertidos antes" fill="#22c55e" radius={[6, 6, 0, 0]} animationDuration={800} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {reminderChartData.map((wave, idx) => {
              const total = wave.enviados + wave.convertidos
              const successRate = total > 0 ? ((wave.convertidos / total) * 100).toFixed(0) : '0'

              return (
                <Card
                  key={idx}
                  className="overflow-hidden transition-all duration-300 hover:shadow-lg hover:border-primary/50 animate-in fade-in-0 slide-in-from-bottom-4"
                  style={{ animationDelay: `${idx * 100}ms` }}
                >
                  <CardContent className="pt-6">
                    <div className="text-center space-y-4">
                      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{wave.name}</span>
                        <Badge variant="outline" className="text-xs">{wave.tempo}</Badge>
                      </div>
                      <div>
                        <p className="text-4xl font-bold text-emerald-500">{successRate}%</p>
                        <p className="text-sm text-muted-foreground mt-1">converteram antes</p>
                      </div>
                      <div className="flex justify-center gap-6 pt-2 border-t">
                        <div className="text-center">
                          <Send className="h-4 w-4 mx-auto mb-1 text-violet-500" />
                          <p className="text-lg font-semibold">{wave.enviados}</p>
                          <p className="text-xs text-muted-foreground">enviados</p>
                        </div>
                        <div className="text-center">
                          <CheckCircle className="h-4 w-4 mx-auto mb-1 text-emerald-500" />
                          <p className="text-lg font-semibold">{wave.convertidos}</p>
                          <p className="text-xs text-muted-foreground">convertidos</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>

        {/* Abandoned Tab */}
        <TabsContent value="abandoned" className="animate-in fade-in-0 slide-in-from-bottom-4 duration-300">
          <Card className="overflow-hidden">
            <CardHeader className="border-b bg-muted/30">
              <CardTitle className="flex items-center gap-2 text-lg">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                PIX Abandonados
              </CardTitle>
              <CardDescription>Usuários que iniciaram mas não finalizaram o pagamento</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {pendingPayments.length === 0 ? (
                <div className="text-center py-16">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/20 mb-4">
                    <CheckCircle className="h-8 w-8 text-emerald-500" />
                  </div>
                  <p className="text-lg font-medium">Nenhum pagamento pendente!</p>
                  <p className="text-sm text-muted-foreground mt-1">Todos os PIX foram concluídos</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left py-4 px-6 font-medium text-muted-foreground">Usuário</th>
                        <th className="text-left py-4 px-6 font-medium text-muted-foreground">Número</th>
                        <th className="text-left py-4 px-6 font-medium text-muted-foreground">Plano</th>
                        <th className="text-right py-4 px-6 font-medium text-muted-foreground">Valor</th>
                        <th className="text-left py-4 px-6 font-medium text-muted-foreground">Data</th>
                        <th className="text-left py-4 px-6 font-medium text-muted-foreground">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingPayments.map((payment, idx) => (
                        <tr
                          key={payment.id}
                          className="border-b transition-colors hover:bg-muted/30 animate-in fade-in-0"
                          style={{ animationDelay: `${idx * 50}ms` }}
                        >
                          <td className="py-4 px-6 font-medium">{payment.user_name}</td>
                          <td className="py-4 px-6">
                            <code className="text-sm text-muted-foreground">
                              {payment.user_number.replace(/(\d{2})(\d{2})(\d{5})(\d{4})/, '+$1 ($2) $3-$4')}
                            </code>
                          </td>
                          <td className="py-4 px-6">
                            <Badge variant={payment.plan === 'ultra' ? 'default' : 'secondary'} className="capitalize">
                              {payment.plan}
                            </Badge>
                          </td>
                          <td className="text-right py-4 px-6 font-mono font-semibold">
                            R$ {Number(payment.amount).toFixed(2)}
                          </td>
                          <td className="py-4 px-6 text-muted-foreground">
                            {format(new Date(payment.created_at), "dd/MM HH:mm", { locale: ptBR })}
                          </td>
                          <td className="py-4 px-6">
                            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/15 text-amber-500 text-sm font-medium">
                              <Clock className="h-3.5 w-3.5" />
                              Pendente
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
