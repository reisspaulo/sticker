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
import { BarChart } from '@/components/charts'
import {
  FlaskConical,
  Loader2,
  Calendar,
  RefreshCw,
  TrendingUp,
  Users,
  MousePointerClick,
  CreditCard,
  Crown,
  ArrowRight,
  Eye,
} from 'lucide-react'
import { subDays, format } from 'date-fns'

interface Experiment {
  id: string
  name: string
  description: string
  status: 'active' | 'paused' | 'completed'
  variants: Record<string, { weight: number; config: Record<string, unknown> }>
  created_at: string
}

interface VariantMetrics {
  variant: string
  users: number
  menu_shown: number
  dismiss_clicked: number
  upgrade_clicked: number
  payment_started: number
  converted: number
  conversion_rate: number
  upgrade_rate: number
}

interface DailyMetric {
  date: string
  variant: string
  conversions: number
}

const VARIANT_COLORS: Record<string, string> = {
  control: 'hsl(217 91% 60%)',
  social_proof: 'hsl(142 76% 36%)',
  benefit: 'hsl(262 83% 58%)',
  hybrid: 'hsl(38 92% 50%)',
  // Legacy variants
  dismiss_now: 'hsl(0 84% 60%)',
  remind_2h: 'hsl(48 96% 53%)',
  remind_6h: 'hsl(280 65% 60%)',
}

const VARIANT_LABELS: Record<string, string> = {
  control: 'Control (Original)',
  social_proof: 'Social Proof',
  benefit: 'Benefício Claro',
  hybrid: 'Híbrido',
  // Legacy
  dismiss_now: 'Agora Não',
  remind_2h: 'Lembrar em 2h',
  remind_6h: 'Lembrar em 6h',
}

export default function ExperimentsPage() {
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('30')
  const [experiments, setExperiments] = useState<Experiment[]>([])
  const [selectedExperiment, setSelectedExperiment] = useState<string>('')
  const [metrics, setMetrics] = useState<VariantMetrics[]>([])
  const [dailyData, setDailyData] = useState<DailyMetric[]>([])

  useEffect(() => {
    fetchExperiments()
  }, [])

  useEffect(() => {
    if (selectedExperiment) {
      fetchMetrics()
    }
  }, [selectedExperiment, period])

  async function fetchExperiments() {
    const supabase = createClient()

    const { data } = await supabase
      .from('experiments')
      .select('*')
      .order('created_at', { ascending: false })

    if (data && data.length > 0) {
      setExperiments(data)
      // Select the first active experiment by default
      const activeExp = data.find(e => e.status === 'active') || data[0]
      setSelectedExperiment(activeExp.id)
    }

    setLoading(false)
  }

  async function fetchMetrics() {
    setLoading(true)
    const supabase = createClient()
    const days = parseInt(period)
    const startDate = subDays(new Date(), days)

    // Get experiment events
    const { data: events } = await supabase
      .from('experiment_events')
      .select('*')
      .eq('experiment_id', selectedExperiment)
      .gte('created_at', startDate.toISOString())

    // Get user assignments for this experiment
    const { data: assignments } = await supabase
      .from('user_experiments')
      .select('*')
      .eq('experiment_id', selectedExperiment)
      .gte('assigned_at', startDate.toISOString())

    if (!events || !assignments) {
      setLoading(false)
      return
    }

    // Group events by variant
    const variantMap = new Map<string, VariantMetrics>()

    // Initialize with all variants from assignments
    assignments.forEach(a => {
      if (!variantMap.has(a.variant)) {
        variantMap.set(a.variant, {
          variant: a.variant,
          users: 0,
          menu_shown: 0,
          dismiss_clicked: 0,
          upgrade_clicked: 0,
          payment_started: 0,
          converted: 0,
          conversion_rate: 0,
          upgrade_rate: 0,
        })
      }
      const m = variantMap.get(a.variant)!
      m.users++
    })

    // Count events by type and variant
    events.forEach(e => {
      const m = variantMap.get(e.variant)
      if (!m) return

      switch (e.event_type) {
        case 'menu_shown':
          m.menu_shown++
          break
        case 'dismiss_clicked':
          m.dismiss_clicked++
          break
        case 'upgrade_clicked':
          m.upgrade_clicked++
          break
        case 'payment_started':
          m.payment_started++
          break
        case 'converted':
          m.converted++
          break
      }
    })

    // Calculate rates
    variantMap.forEach(m => {
      m.conversion_rate = m.menu_shown > 0 ? (m.converted / m.menu_shown) * 100 : 0
      m.upgrade_rate = m.menu_shown > 0 ? (m.upgrade_clicked / m.menu_shown) * 100 : 0
    })

    setMetrics(Array.from(variantMap.values()).sort((a, b) =>
      b.conversion_rate - a.conversion_rate
    ))

    // Calculate daily conversions by variant
    const dailyMap = new Map<string, Map<string, number>>()

    events
      .filter(e => e.event_type === 'converted')
      .forEach(e => {
        const date = format(new Date(e.created_at), 'yyyy-MM-dd')
        if (!dailyMap.has(date)) {
          dailyMap.set(date, new Map())
        }
        const dayMap = dailyMap.get(date)!
        dayMap.set(e.variant, (dayMap.get(e.variant) || 0) + 1)
      })

    const daily: DailyMetric[] = []
    dailyMap.forEach((variants, date) => {
      variants.forEach((count, variant) => {
        daily.push({ date, variant, conversions: count })
      })
    })

    setDailyData(daily.sort((a, b) => a.date.localeCompare(b.date)))
    setLoading(false)
  }

  const selectedExp = experiments.find(e => e.id === selectedExperiment)
  const totalUsers = metrics.reduce((acc, m) => acc + m.users, 0)
  const totalConversions = metrics.reduce((acc, m) => acc + m.converted, 0)
  const overallRate = totalUsers > 0 ? (totalConversions / totalUsers) * 100 : 0

  // Prepare chart data - conversion rates
  const chartData = metrics.map(m => ({
    name: VARIANT_LABELS[m.variant] || m.variant,
    value: parseFloat(m.conversion_rate.toFixed(2)),
    color: VARIANT_COLORS[m.variant] || 'hsl(var(--primary))',
  }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FlaskConical className="h-6 w-6" />
            Experimentos A/B
          </h1>
          <p className="text-muted-foreground">Análise de variantes e conversão</p>
        </div>
        <div className="flex items-center gap-4">
          {experiments.length > 0 && (
            <Select value={selectedExperiment} onValueChange={setSelectedExperiment}>
              <SelectTrigger className="w-[200px]">
                <FlaskConical className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Experimento" />
              </SelectTrigger>
              <SelectContent>
                {experiments.map(exp => (
                  <SelectItem key={exp.id} value={exp.id}>
                    <div className="flex items-center gap-2">
                      {exp.name}
                      <Badge variant={exp.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                        {exp.status}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
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
          <Button variant="outline" onClick={fetchMetrics}>
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
          {/* Experiment Info */}
          {selectedExp && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">{selectedExp.name}</CardTitle>
                    <CardDescription>{selectedExp.description}</CardDescription>
                  </div>
                  <Badge variant={selectedExp.status === 'active' ? 'default' : 'secondary'}>
                    {selectedExp.status === 'active' ? 'Ativo' : selectedExp.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-6 text-sm">
                  <div>
                    <span className="text-muted-foreground">Variantes:</span>{' '}
                    <span className="font-medium">{Object.keys(selectedExp.variants || {}).length}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Usuários no período:</span>{' '}
                    <span className="font-medium">{totalUsers}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Conversões:</span>{' '}
                    <span className="font-medium text-emerald-500">{totalConversions}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Taxa geral:</span>{' '}
                    <span className="font-medium">{overallRate.toFixed(2)}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            {metrics.slice(0, 4).map((m, idx) => (
              <Card key={m.variant}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: VARIANT_COLORS[m.variant] || 'hsl(var(--primary))' }}
                    />
                    {VARIANT_LABELS[m.variant] || m.variant}
                    {idx === 0 && m.conversion_rate > 0 && (
                      <Badge variant="outline" className="ml-auto text-xs text-emerald-500 border-emerald-500">
                        Melhor
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{m.conversion_rate.toFixed(2)}%</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {m.converted} conversões de {m.menu_shown} visualizações
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Comparison Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Taxa de Conversão por Variante</CardTitle>
              <CardDescription>Porcentagem de usuários que converteram</CardDescription>
            </CardHeader>
            <CardContent>
              {chartData.length > 0 ? (
                <BarChart
                  data={chartData}
                  height={300}
                  formatValue={(v) => `${v}%`}
                />
              ) : (
                <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                  Sem dados para o período selecionado
                </div>
              )}
            </CardContent>
          </Card>

          {/* Detailed Funnel by Variant */}
          <Card>
            <CardHeader>
              <CardTitle>Funil por Variante</CardTitle>
              <CardDescription>Detalhamento do funil de conversão</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-2 font-medium">Variante</th>
                      <th className="text-center py-3 px-2 font-medium">
                        <div className="flex items-center justify-center gap-1">
                          <Users className="h-4 w-4" />
                          Usuários
                        </div>
                      </th>
                      <th className="text-center py-3 px-2 font-medium">
                        <div className="flex items-center justify-center gap-1">
                          <Eye className="h-4 w-4" />
                          Menu Visto
                        </div>
                      </th>
                      <th className="text-center py-3 px-2 font-medium">
                        <div className="flex items-center justify-center gap-1">
                          <MousePointerClick className="h-4 w-4" />
                          Clicou Upgrade
                        </div>
                      </th>
                      <th className="text-center py-3 px-2 font-medium">
                        <div className="flex items-center justify-center gap-1">
                          <CreditCard className="h-4 w-4" />
                          Iniciou Pag.
                        </div>
                      </th>
                      <th className="text-center py-3 px-2 font-medium">
                        <div className="flex items-center justify-center gap-1">
                          <Crown className="h-4 w-4" />
                          Converteu
                        </div>
                      </th>
                      <th className="text-center py-3 px-2 font-medium">
                        <div className="flex items-center justify-center gap-1">
                          <TrendingUp className="h-4 w-4" />
                          Taxa
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.map((m, idx) => (
                      <tr key={m.variant} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-2">
                            <div
                              className="h-3 w-3 rounded-full"
                              style={{ backgroundColor: VARIANT_COLORS[m.variant] || 'hsl(var(--primary))' }}
                            />
                            <span className="font-medium">{VARIANT_LABELS[m.variant] || m.variant}</span>
                            {idx === 0 && m.conversion_rate > 0 && (
                              <Badge variant="outline" className="text-xs text-emerald-500 border-emerald-500">
                                Melhor
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="text-center py-3 px-2">{m.users}</td>
                        <td className="text-center py-3 px-2">{m.menu_shown}</td>
                        <td className="text-center py-3 px-2">
                          <div>
                            {m.upgrade_clicked}
                            <span className="text-xs text-muted-foreground ml-1">
                              ({m.upgrade_rate.toFixed(1)}%)
                            </span>
                          </div>
                        </td>
                        <td className="text-center py-3 px-2">{m.payment_started}</td>
                        <td className="text-center py-3 px-2 font-medium text-emerald-500">
                          {m.converted}
                        </td>
                        <td className="text-center py-3 px-2">
                          <Badge
                            variant={idx === 0 && m.conversion_rate > 0 ? 'default' : 'secondary'}
                            className={idx === 0 && m.conversion_rate > 0 ? 'bg-emerald-500' : ''}
                          >
                            {m.conversion_rate.toFixed(2)}%
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Dismiss Analysis */}
          {metrics.some(m => m.dismiss_clicked > 0) && (
            <Card>
              <CardHeader>
                <CardTitle>Análise do Botão Dismiss</CardTitle>
                <CardDescription>Quantos usuários clicaram em "Agora Não" ou similares</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-4">
                  {metrics.map(m => {
                    const dismissRate = m.menu_shown > 0 ? (m.dismiss_clicked / m.menu_shown) * 100 : 0
                    return (
                      <div key={m.variant} className="p-4 rounded-lg border">
                        <div className="flex items-center gap-2 mb-2">
                          <div
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: VARIANT_COLORS[m.variant] || 'hsl(var(--primary))' }}
                          />
                          <span className="text-sm font-medium">{VARIANT_LABELS[m.variant] || m.variant}</span>
                        </div>
                        <div className="text-2xl font-bold">{dismissRate.toFixed(1)}%</div>
                        <p className="text-xs text-muted-foreground">
                          {m.dismiss_clicked} de {m.menu_shown} fecharam
                        </p>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
