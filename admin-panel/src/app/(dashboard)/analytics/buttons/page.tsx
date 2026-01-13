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
  FunnelChart,
  Funnel,
  LabelList,
  Cell,
  PieChart,
  Pie,
} from 'recharts'
import {
  MousePointer2,
  TrendingUp,
  TrendingDown,
  Users,
  CreditCard,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface ButtonClick {
  botao: string
  texto_botao: string
  cliques: number
  usuarios: number
}

interface DailyClick {
  dia: string
  botao: string
  cliques: number
}

interface FunnelStep {
  etapa: string
  usuarios: number
  fill: string
}

interface PendingPayment {
  id: string
  user_name: string
  user_number: string
  plan: string
  amount: number
  created_at: string
  status: string
}

interface ReminderStats {
  reminder_type: string
  status: string
  total: number
}

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1', '#14b8a6']

const BUTTON_CATEGORIES: Record<string, { label: string; color: string }> = {
  'button_twitter': { label: 'Twitter', color: '#1da1f2' },
  'button_upgrade': { label: 'Upgrade', color: '#10b981' },
  'button_dismiss': { label: 'Dismiss', color: '#ef4444' },
  'button_use_bonus': { label: 'Bonus', color: '#f59e0b' },
  'payment_pix': { label: 'PIX', color: '#8b5cf6' },
  'payment_card': { label: 'Cartao', color: '#3b82f6' },
  'button_confirm': { label: 'Confirmar', color: '#10b981' },
  'plan_': { label: 'Planos', color: '#6366f1' },
}

function getButtonCategory(buttonId: string): { label: string; color: string } {
  for (const [prefix, config] of Object.entries(BUTTON_CATEGORIES)) {
    if (buttonId?.startsWith(prefix)) {
      return config
    }
  }
  return { label: 'Outros', color: '#64748b' }
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
      // 1. Button clicks by button
      const { data: clicks } = await supabase.rpc('get_button_clicks_summary')

      // Fallback query if RPC doesn't exist
      if (!clicks) {
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
      } else {
        setButtonClicks(clicks)
      }

      // 2. Daily clicks (last 14 days)
      const { data: daily } = await supabase
        .from('usage_logs')
        .select('details, created_at')
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
          Array.from(dailyMap.entries()).map(([dia, cliques]) => ({
            dia,
            botao: 'total',
            cliques,
          }))
        )
      }

      // 3. Funnel data from experiment_events
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
          { etapa: 'Menu visto', usuarios: eventCounts['menu_shown']?.size || 0, fill: '#8b5cf6' },
          { etapa: 'Clicou upgrade', usuarios: eventCounts['upgrade_clicked']?.size || 0, fill: '#3b82f6' },
          { etapa: 'Intencao pagar', usuarios: eventCounts['payment_intent']?.size || 0, fill: '#10b981' },
          { etapa: 'Iniciou pag.', usuarios: eventCounts['payment_started']?.size || 0, fill: '#f59e0b' },
          { etapa: 'Converteu', usuarios: eventCounts['converted']?.size || 0, fill: '#ef4444' },
        ]
        setFunnelData(funnel)
        setTotals(prev => ({ ...prev, conversions: eventCounts['converted']?.size || 0 }))
      }

      // 4. Pending PIX payments
      const { data: pending } = await supabase
        .from('pix_payments')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      if (pending) {
        setPendingPayments(pending)
      }

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

  // Process data for charts
  const barChartData = buttonClicks.slice(0, 10).map((item) => ({
    name: item.texto_botao?.slice(0, 20) || item.botao.slice(0, 20),
    cliques: item.cliques,
    usuarios: item.usuarios,
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
  }, [] as { name: string; value: number; fill: string }[])

  const reminderChartData = [
    {
      name: 'Wave 1 (30min)',
      enviados: reminderStats.find(r => r.reminder_type === 'payment_reminder_wave1' && r.status === 'sent')?.total || 0,
      cancelados: reminderStats.find(r => r.reminder_type === 'payment_reminder_wave1' && r.status === 'canceled')?.total || 0,
    },
    {
      name: 'Wave 2 (6h)',
      enviados: reminderStats.find(r => r.reminder_type === 'payment_reminder_wave2' && r.status === 'sent')?.total || 0,
      cancelados: reminderStats.find(r => r.reminder_type === 'payment_reminder_wave2' && r.status === 'canceled')?.total || 0,
    },
    {
      name: 'Wave 3 (48h)',
      enviados: reminderStats.find(r => r.reminder_type === 'payment_reminder_wave3' && r.status === 'sent')?.total || 0,
      cancelados: reminderStats.find(r => r.reminder_type === 'payment_reminder_wave3' && r.status === 'canceled')?.total || 0,
    },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Analytics de Botoes</h1>
        <p className="text-muted-foreground">
          Analise estrategica de cliques em botoes e funil de conversao
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-violet-500/20 rounded-lg">
                <MousePointer2 className="h-6 w-6 text-violet-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Cliques</p>
                <p className="text-2xl font-bold">{totals.clicks}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/20 rounded-lg">
                <Users className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Usuarios Unicos</p>
                <p className="text-2xl font-bold">{totals.users}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-500/20 rounded-lg">
                <CreditCard className="h-6 w-6 text-amber-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">PIX Pendentes</p>
                <p className="text-2xl font-bold">{pendingPayments.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-500/20 rounded-lg">
                <CheckCircle className="h-6 w-6 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Conversoes</p>
                <p className="text-2xl font-bold">{totals.conversions}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="buttons" className="space-y-4">
        <TabsList>
          <TabsTrigger value="buttons">Botoes</TabsTrigger>
          <TabsTrigger value="funnel">Funil</TabsTrigger>
          <TabsTrigger value="reminders">Lembretes</TabsTrigger>
          <TabsTrigger value="abandoned">Abandonos</TabsTrigger>
        </TabsList>

        {/* Buttons Tab */}
        <TabsContent value="buttons" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Bar Chart - Most Clicked */}
            <Card>
              <CardHeader>
                <CardTitle>Botoes Mais Clicados</CardTitle>
                <CardDescription>Top 10 botoes por numero de cliques</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barChartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" stroke="hsl(var(--muted-foreground))" />
                      <YAxis
                        dataKey="name"
                        type="category"
                        width={120}
                        stroke="hsl(var(--muted-foreground))"
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                      <Bar dataKey="cliques" radius={[0, 4, 4, 0]}>
                        {barChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Pie Chart - Categories */}
            <Card>
              <CardHeader>
                <CardTitle>Cliques por Categoria</CardTitle>
                <CardDescription>Distribuicao de cliques por tipo de botao</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={80}
                        outerRadius={140}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                      >
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Timeline Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Cliques por Dia</CardTitle>
              <CardDescription>Evolucao de cliques nos ultimos 14 dias</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailyClicks}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="dia" stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="cliques"
                      stroke="#8b5cf6"
                      strokeWidth={2}
                      dot={{ fill: '#8b5cf6', strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Button Details Table */}
          <Card>
            <CardHeader>
              <CardTitle>Detalhes dos Botoes</CardTitle>
              <CardDescription>Todos os botoes com metricas detalhadas</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4">Botao</th>
                      <th className="text-left py-3 px-4">Categoria</th>
                      <th className="text-right py-3 px-4">Cliques</th>
                      <th className="text-right py-3 px-4">Usuarios</th>
                      <th className="text-right py-3 px-4">Cliques/Usuario</th>
                    </tr>
                  </thead>
                  <tbody>
                    {buttonClicks.map((btn, idx) => {
                      const category = getButtonCategory(btn.botao)
                      return (
                        <tr key={idx} className="border-b hover:bg-muted/50">
                          <td className="py-3 px-4">
                            <div>
                              <div className="font-medium">{btn.texto_botao || btn.botao}</div>
                              <code className="text-xs text-muted-foreground">{btn.botao}</code>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <Badge style={{ backgroundColor: category.color + '20', color: category.color }}>
                              {category.label}
                            </Badge>
                          </td>
                          <td className="text-right py-3 px-4 font-mono">{btn.cliques}</td>
                          <td className="text-right py-3 px-4 font-mono">{btn.usuarios}</td>
                          <td className="text-right py-3 px-4 font-mono">
                            {(btn.cliques / btn.usuarios).toFixed(1)}
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
        <TabsContent value="funnel" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Funil de Conversao</CardTitle>
                <CardDescription>Da visualizacao do menu ate a conversao</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <FunnelChart>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                      <Funnel
                        data={funnelData}
                        dataKey="usuarios"
                        nameKey="etapa"
                        isAnimationActive
                      >
                        <LabelList
                          position="right"
                          fill="hsl(var(--foreground))"
                          stroke="none"
                          dataKey="etapa"
                        />
                        {funnelData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Funnel>
                    </FunnelChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Taxa de Conversao</CardTitle>
                <CardDescription>Conversao entre cada etapa do funil</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6 py-4">
                  {funnelData.map((step, idx) => {
                    const prevStep = idx > 0 ? funnelData[idx - 1] : null
                    const conversionRate = prevStep && prevStep.usuarios > 0
                      ? ((step.usuarios / prevStep.usuarios) * 100).toFixed(1)
                      : '100'
                    const dropOff = prevStep
                      ? prevStep.usuarios - step.usuarios
                      : 0

                    return (
                      <div key={idx} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: step.fill }}
                            />
                            <span className="font-medium">{step.etapa}</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-lg font-bold">{step.usuarios}</span>
                            {idx > 0 && (
                              <Badge variant={Number(conversionRate) > 50 ? 'default' : 'destructive'}>
                                {conversionRate}%
                              </Badge>
                            )}
                          </div>
                        </div>
                        {idx > 0 && dropOff > 0 && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground ml-6">
                            <TrendingDown className="h-4 w-4 text-red-500" />
                            <span>-{dropOff} usuarios ({(100 - Number(conversionRate)).toFixed(1)}% drop)</span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Reminders Tab */}
        <TabsContent value="reminders" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Lembretes de Pagamento</CardTitle>
              <CardDescription>Performance das waves de remarketing (PIX abandonado)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={reminderChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Bar dataKey="enviados" name="Enviados" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="cancelados" name="Cancelados (pagou)" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {reminderChartData.map((wave, idx) => {
              const total = wave.enviados + wave.cancelados
              const successRate = total > 0 ? ((wave.cancelados / total) * 100).toFixed(1) : '0'

              return (
                <Card key={idx}>
                  <CardContent className="pt-6">
                    <div className="text-center space-y-2">
                      <div className="flex items-center justify-center gap-2">
                        <Clock className="h-5 w-5 text-muted-foreground" />
                        <span className="font-medium">{wave.name}</span>
                      </div>
                      <div className="text-3xl font-bold">{successRate}%</div>
                      <p className="text-sm text-muted-foreground">
                        converteram antes de receber
                      </p>
                      <div className="flex justify-center gap-4 text-sm pt-2">
                        <span className="text-violet-500">{wave.enviados} enviados</span>
                        <span className="text-emerald-500">{wave.cancelados} convertidos</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>

        {/* Abandoned Tab */}
        <TabsContent value="abandoned" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                PIX Abandonados
              </CardTitle>
              <CardDescription>
                Usuarios que iniciaram pagamento PIX mas nao finalizaram
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pendingPayments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-emerald-500" />
                  <p>Nenhum pagamento PIX pendente!</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4">Usuario</th>
                        <th className="text-left py-3 px-4">Numero</th>
                        <th className="text-left py-3 px-4">Plano</th>
                        <th className="text-right py-3 px-4">Valor</th>
                        <th className="text-left py-3 px-4">Data</th>
                        <th className="text-left py-3 px-4">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingPayments.map((payment) => (
                        <tr key={payment.id} className="border-b hover:bg-muted/50">
                          <td className="py-3 px-4 font-medium">{payment.user_name}</td>
                          <td className="py-3 px-4 font-mono text-sm">
                            {payment.user_number.replace(/(\d{2})(\d{2})(\d{5})(\d{4})/, '+$1 ($2) $3-$4')}
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant={payment.plan === 'ultra' ? 'default' : 'secondary'}>
                              {payment.plan}
                            </Badge>
                          </td>
                          <td className="text-right py-3 px-4 font-mono">
                            R$ {Number(payment.amount).toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-muted-foreground">
                            {format(new Date(payment.created_at), "dd/MM HH:mm", { locale: ptBR })}
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant="outline" className="border-amber-500 text-amber-500">
                              <Clock className="h-3 w-3 mr-1" />
                              Pendente
                            </Badge>
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
