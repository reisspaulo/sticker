'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { BarChart } from '@/components/charts'
import {
  Brain,
  Star,
  Calendar,
  RefreshCw,
  Loader2,
  TrendingUp,
  Sparkles,
  Users,
} from 'lucide-react'

interface EmotionData {
  emotion: string
  count: number
}

interface CelebrityData {
  name: string
  slug: string
  count: number
}

interface ClassificationStats {
  totalStickers: number
  withEmotions: number
  withCelebrity: number
  emotionRate: number
  celebrityRate: number
}

interface ClassificationResponse {
  topEmotions: EmotionData[]
  topCelebrities: CelebrityData[]
  stats: ClassificationStats
  period: string
}

// Emotion name translations/formatting
const emotionLabels: Record<string, string> = {
  happy: 'Feliz',
  sad: 'Triste',
  angry: 'Raiva',
  surprised: 'Surpreso',
  disgusted: 'Nojo',
  fearful: 'Medo',
  neutral: 'Neutro',
  laughing: 'Rindo',
  crying: 'Chorando',
  love: 'Amor',
  thinking: 'Pensativo',
  cool: 'Estiloso',
  excited: 'Animado',
  confused: 'Confuso',
  sleepy: 'Sonolento',
  shocked: 'Chocado',
  proud: 'Orgulhoso',
  embarrassed: 'Envergonhado',
  worried: 'Preocupado',
  bored: 'Entediado',
}

function formatEmotion(emotion: string): string {
  return emotionLabels[emotion.toLowerCase()] || emotion
}

export default function ClassificationAnalyticsPage() {
  const [data, setData] = useState<ClassificationResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('30')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/analytics/classification?period=${period}`)
      if (!response.ok) throw new Error('Failed to fetch data')
      const result: ClassificationResponse = await response.json()
      setData(result)
    } catch (error) {
      console.error('Error fetching classification data:', error)
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const emotionChartData = data?.topEmotions.map(e => ({
    name: formatEmotion(e.emotion),
    value: e.count,
  })) || []

  const celebrityChartData = data?.topCelebrities.map(c => ({
    name: c.name,
    value: c.count,
  })) || []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6" />
            Analytics de Classificacao
          </h1>
          <p className="text-muted-foreground">
            Top emocoes e celebridades identificadas nos stickers
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[160px]">
              <Calendar className="mr-2 h-4 w-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Ultimos 7 dias</SelectItem>
              <SelectItem value="30">Ultimos 30 dias</SelectItem>
              <SelectItem value="90">Ultimos 90 dias</SelectItem>
              <SelectItem value="0">Todo o periodo</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-6">
          {/* Loading Stats */}
          <div className="grid gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map(i => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <Skeleton className="h-8 w-20 mb-2" />
                  <Skeleton className="h-4 w-32" />
                </CardContent>
              </Card>
            ))}
          </div>
          {/* Loading Charts */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-[350px]" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-[350px]" />
              </CardContent>
            </Card>
          </div>
        </div>
      ) : data ? (
        <>
          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total de Stickers</p>
                    <p className="text-3xl font-bold">{data.stats.totalStickers.toLocaleString()}</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-muted-foreground/50" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Com Emocoes</p>
                    <p className="text-3xl font-bold">{data.stats.withEmotions.toLocaleString()}</p>
                    <Badge variant="secondary" className="mt-1">
                      {data.stats.emotionRate}% do total
                    </Badge>
                  </div>
                  <Brain className="h-8 w-8 text-muted-foreground/50" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Com Celebridade</p>
                    <p className="text-3xl font-bold">{data.stats.withCelebrity.toLocaleString()}</p>
                    <Badge variant="secondary" className="mt-1">
                      {data.stats.celebrityRate}% do total
                    </Badge>
                  </div>
                  <Star className="h-8 w-8 text-muted-foreground/50" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Emocoes Unicas</p>
                    <p className="text-3xl font-bold">{data.topEmotions.length}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      identificadas no periodo
                    </p>
                  </div>
                  <Users className="h-8 w-8 text-muted-foreground/50" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Top Emotions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  Top 10 Emocoes
                </CardTitle>
                <CardDescription>
                  Emocoes mais identificadas nos stickers
                </CardDescription>
              </CardHeader>
              <CardContent>
                {emotionChartData.length > 0 ? (
                  <BarChart
                    data={emotionChartData}
                    height={350}
                    color="hsl(262, 83%, 58%)"
                    horizontal
                  />
                ) : (
                  <div className="flex h-[350px] items-center justify-center text-muted-foreground">
                    Nenhuma emocao classificada no periodo
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top Celebrities */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5" />
                  Top 10 Celebridades
                </CardTitle>
                <CardDescription>
                  Celebridades mais identificadas nos stickers
                </CardDescription>
              </CardHeader>
              <CardContent>
                {celebrityChartData.length > 0 ? (
                  <BarChart
                    data={celebrityChartData}
                    height={350}
                    color="hsl(47, 100%, 50%)"
                    horizontal
                  />
                ) : (
                  <div className="flex h-[350px] items-center justify-center text-muted-foreground">
                    Nenhuma celebridade identificada no periodo
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Detailed Tables */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Emotions Table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Todas as Emocoes</CardTitle>
                <CardDescription>Ranking completo de emocoes</CardDescription>
              </CardHeader>
              <CardContent>
                {data.topEmotions.length > 0 ? (
                  <div className="space-y-2">
                    {data.topEmotions.map((emotion, index) => (
                      <div
                        key={emotion.emotion}
                        className="flex items-center justify-between py-2 border-b border-border/50 last:border-0"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium text-muted-foreground w-6">
                            #{index + 1}
                          </span>
                          <span className="font-medium">{formatEmotion(emotion.emotion)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">
                            {emotion.count.toLocaleString()} stickers
                          </span>
                          <div
                            className="h-2 rounded-full bg-purple-500"
                            style={{
                              width: `${Math.max(20, (emotion.count / data.topEmotions[0].count) * 100)}px`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">Nenhuma emocao encontrada</p>
                )}
              </CardContent>
            </Card>

            {/* Celebrities Table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Todas as Celebridades</CardTitle>
                <CardDescription>Ranking completo de celebridades</CardDescription>
              </CardHeader>
              <CardContent>
                {data.topCelebrities.length > 0 ? (
                  <div className="space-y-2">
                    {data.topCelebrities.map((celebrity, index) => (
                      <div
                        key={celebrity.slug}
                        className="flex items-center justify-between py-2 border-b border-border/50 last:border-0"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium text-muted-foreground w-6">
                            #{index + 1}
                          </span>
                          <span className="font-medium">{celebrity.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">
                            {celebrity.count.toLocaleString()} stickers
                          </span>
                          <div
                            className="h-2 rounded-full bg-yellow-500"
                            style={{
                              width: `${Math.max(20, (celebrity.count / data.topCelebrities[0].count) * 100)}px`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">Nenhuma celebridade encontrada</p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <Card>
          <CardContent className="py-10">
            <div className="flex flex-col items-center gap-4 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-muted-foreground">Erro ao carregar dados. Tente novamente.</p>
              <Button onClick={fetchData}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Tentar novamente
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
