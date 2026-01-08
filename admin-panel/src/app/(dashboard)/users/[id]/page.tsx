'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  ArrowLeft,
  User,
  Smartphone,
  Calendar,
  Crown,
  Image,
  MessageSquare,
  Clock,
  Send,
  CheckCircle,
  AlertCircle,
  Zap,
  Loader2,
  ExternalLink,
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import Link from 'next/link'

interface UserDetails {
  id: string
  whatsapp_number: string
  name: string | null
  subscription_plan: string
  subscription_status: string | null
  subscription_starts_at: string | null
  subscription_ends_at: string | null
  ab_test_group: string | null
  daily_count: number
  bonus_credits_today: number
  created_at: string
  last_interaction: string | null
  first_sticker_at: string | null
  onboarding_step: string | null
  cleanup_feature_shown: boolean
  cleanup_feature_used: boolean
  twitter_feature_shown: boolean
  twitter_feature_used: boolean
  twitter_download_count: number
}

interface Sticker {
  id: string
  created_at: string
  tipo: string
  status: string
  storage_path: string | null
  celebrity_id: string | null
  emotion_tags: string[] | null
}

interface ActivityLog {
  id: string
  action: string
  details: Record<string, unknown> | null
  created_at: string
}

const actionIcons: Record<string, typeof Send> = {
  sticker_sent: Send,
  sticker_created: Image,
  menu_shown: MessageSquare,
  limit_reached: AlertCircle,
  bonus_used: Zap,
  subscription_started: Crown,
  default: Clock,
}

const actionColors: Record<string, string> = {
  sticker_sent: 'text-emerald-500 bg-emerald-500/10',
  sticker_created: 'text-blue-500 bg-blue-500/10',
  menu_shown: 'text-purple-500 bg-purple-500/10',
  limit_reached: 'text-amber-500 bg-amber-500/10',
  bonus_used: 'text-cyan-500 bg-cyan-500/10',
  subscription_started: 'text-yellow-500 bg-yellow-500/10',
  error: 'text-red-500 bg-red-500/10',
  default: 'text-zinc-500 bg-zinc-500/10',
}

export default function UserDetailPage() {
  const params = useParams()
  const router = useRouter()
  const userId = params.id as string

  const [user, setUser] = useState<UserDetails | null>(null)
  const [stickers, setStickers] = useState<Sticker[]>([])
  const [activities, setActivities] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (userId) {
      fetchUserData()
    }
  }, [userId])

  async function fetchUserData() {
    setLoading(true)
    const supabase = createClient()

    // Fetch user details
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    if (userError || !userData) {
      console.error('Error fetching user:', userError)
      setLoading(false)
      return
    }

    setUser(userData)

    // Fetch user's stickers
    const { data: stickersData } = await supabase
      .from('stickers')
      .select('id, created_at, tipo, status, storage_path, celebrity_id, emotion_tags')
      .eq('user_number', userData.whatsapp_number)
      .order('created_at', { ascending: false })
      .limit(50)

    setStickers(stickersData || [])

    // Fetch activity logs
    const { data: logsData } = await supabase
      .from('usage_logs')
      .select('*')
      .eq('user_number', userData.whatsapp_number)
      .order('created_at', { ascending: false })
      .limit(100)

    setActivities(logsData || [])
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">Usuario nao encontrado</p>
        <Button onClick={() => router.push('/users')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
      </div>
    )
  }

  const formatPhone = (phone: string) => {
    return phone.replace(/^55/, '+55 ').replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
  }

  const planColors: Record<string, string> = {
    free: 'bg-zinc-500/20 text-zinc-300',
    basic: 'bg-blue-500/20 text-blue-300',
    premium: 'bg-purple-500/20 text-purple-300',
    pro: 'bg-amber-500/20 text-amber-300',
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/users')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{user.name || 'Usuario'}</h1>
          <p className="font-mono text-sm text-muted-foreground">
            {formatPhone(user.whatsapp_number)}
          </p>
        </div>
        <Badge className={planColors[user.subscription_plan] || planColors.free}>
          {user.subscription_plan === 'free' ? 'Free' : user.subscription_plan}
          {user.subscription_plan !== 'free' && <Crown className="ml-1 h-3 w-3" />}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* User Info */}
        <div className="space-y-6 lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="h-4 w-4" />
                Informacoes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Grupo AB</span>
                <Badge variant="outline">{user.ab_test_group || 'control'}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Cadastro</span>
                <span className="text-sm">
                  {format(new Date(user.created_at), "dd/MM/yyyy 'as' HH:mm", { locale: ptBR })}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Ultimo acesso</span>
                <span className="text-sm">
                  {user.last_interaction
                    ? formatDistanceToNow(new Date(user.last_interaction), {
                        addSuffix: true,
                        locale: ptBR,
                      })
                    : '-'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Primeiro sticker</span>
                <span className="text-sm">
                  {user.first_sticker_at
                    ? format(new Date(user.first_sticker_at), 'dd/MM/yyyy', { locale: ptBR })
                    : '-'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Onboarding</span>
                <Badge variant="outline">{user.onboarding_step || 'completed'}</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Image className="h-4 w-4" />
                Estatisticas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Stickers hoje</span>
                <span className="text-xl font-bold">{user.daily_count}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Bonus hoje</span>
                <span className="text-xl font-bold text-emerald-500">{user.bonus_credits_today}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total stickers</span>
                <span className="text-xl font-bold">{stickers.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Twitter downloads</span>
                <span className="text-xl font-bold">{user.twitter_download_count}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Zap className="h-4 w-4" />
                Features
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Cleanup</span>
                <div className="flex gap-2">
                  {user.cleanup_feature_shown && (
                    <Badge variant="outline" className="text-xs">Visto</Badge>
                  )}
                  {user.cleanup_feature_used && (
                    <Badge className="bg-emerald-500/20 text-emerald-300 text-xs">Usado</Badge>
                  )}
                  {!user.cleanup_feature_shown && (
                    <span className="text-xs text-muted-foreground">-</span>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Twitter</span>
                <div className="flex gap-2">
                  {user.twitter_feature_shown && (
                    <Badge variant="outline" className="text-xs">Visto</Badge>
                  )}
                  {user.twitter_feature_used && (
                    <Badge className="bg-emerald-500/20 text-emerald-300 text-xs">Usado</Badge>
                  )}
                  {!user.twitter_feature_shown && (
                    <span className="text-xs text-muted-foreground">-</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Activity Timeline */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="h-4 w-4" />
              Atividades Recentes
              <Badge variant="outline" className="ml-auto">
                {activities.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px] pr-4">
              <div className="relative space-y-4">
                {/* Timeline line */}
                <div className="absolute left-4 top-0 h-full w-px bg-border" />

                {activities.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhuma atividade registrada
                  </p>
                ) : (
                  activities.map((activity) => {
                    const Icon = actionIcons[activity.action] || actionIcons.default
                    const colorClass = actionColors[activity.action] || actionColors.default

                    return (
                      <div key={activity.id} className="relative flex gap-4 pl-10">
                        {/* Icon */}
                        <div
                          className={`absolute left-0 flex h-8 w-8 items-center justify-center rounded-full ${colorClass}`}
                        >
                          <Icon className="h-4 w-4" />
                        </div>

                        {/* Content */}
                        <div className="flex-1 rounded-lg border bg-card p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-medium text-sm">
                                {activity.action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                              </p>
                              {activity.details && (
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {typeof activity.details === 'object'
                                    ? Object.entries(activity.details)
                                        .map(([k, v]) => `${k}: ${v}`)
                                        .join(' | ')
                                    : String(activity.details)}
                                </p>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {formatDistanceToNow(new Date(activity.created_at), {
                                addSuffix: true,
                                locale: ptBR,
                              })}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Recent Stickers */}
      {stickers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Image className="h-4 w-4" />
              Stickers Recentes
              <Badge variant="outline" className="ml-auto">
                {stickers.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
              {stickers.slice(0, 16).map((sticker) => (
                <div
                  key={sticker.id}
                  className="relative aspect-square rounded-lg border bg-muted/50 overflow-hidden group"
                >
                  {sticker.storage_path ? (
                    <img
                      src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${sticker.tipo === 'estatico' ? 'stickers-estaticos' : 'stickers-animados'}/${sticker.storage_path}`}
                      alt="Sticker"
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Image className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1 text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                    {format(new Date(sticker.created_at), 'dd/MM HH:mm')}
                  </div>
                  {sticker.status === 'completed' && (
                    <CheckCircle className="absolute top-1 right-1 h-4 w-4 text-emerald-500" />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
