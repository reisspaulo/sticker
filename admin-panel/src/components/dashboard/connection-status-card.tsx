'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import {
  Wifi,
  WifiOff,
  RefreshCw,
  Phone,
  MessageSquare,
  Clock,
  AlertTriangle,
  Circle,
  QrCode,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { QRCodeModal } from './qr-code-modal'

interface ConnectionDetails {
  state?: string
  profileName?: string
  profilePicture?: string
  jid?: string
  loggedIn?: boolean
}

interface ConnectionResult {
  connected: boolean
  lastChecked: string
  details?: ConnectionDetails
  error?: string
}

interface ConnectionStatusResponse {
  evolution: ConnectionResult
  avisa: ConnectionResult
  timestamp: string
}

function formatTimeAgo(dateStr: string) {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)

  if (diffSec < 10) return 'agora'
  if (diffSec < 60) return `${diffSec}s`
  if (diffMin < 60) return `${diffMin}min`
  return `${Math.floor(diffMin / 60)}h`
}

function StatusIndicator({ connected, className }: { connected: boolean; className?: string }) {
  return (
    <div className={cn('relative flex items-center justify-center', className)}>
      <Circle
        className={cn(
          'h-2.5 w-2.5 fill-current transition-colors duration-300',
          connected ? 'text-emerald-500' : 'text-red-500'
        )}
      />
      {connected && (
        <span className="absolute h-2.5 w-2.5 animate-ping rounded-full bg-emerald-500/60" />
      )}
    </div>
  )
}

interface ConnectionItemProps {
  name: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  connected: boolean
  state?: string
  error?: string
  onReconnect?: () => void
}

function ConnectionItem({ name, description, icon: Icon, connected, state, error, onReconnect }: ConnectionItemProps) {
  return (
    <div
      className={cn(
        'group relative flex items-center justify-between rounded-xl border p-4 transition-all duration-300',
        connected
          ? 'border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-500/30 hover:bg-emerald-500/10'
          : 'border-red-500/20 bg-red-500/5 hover:border-red-500/30 hover:bg-red-500/10'
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-lg transition-colors duration-300',
            connected ? 'bg-emerald-500/10' : 'bg-red-500/10'
          )}
        >
          <Icon
            className={cn(
              'h-5 w-5 transition-colors duration-300',
              connected ? 'text-emerald-500' : 'text-red-500'
            )}
          />
        </div>
        <div className="space-y-0.5">
          <p className="font-medium text-sm">{name}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
          {error && (
            <p className="text-xs text-red-400 mt-1">{error}</p>
          )}
        </div>
      </div>

      <div className="flex flex-col items-end gap-1.5">
        <div className="flex items-center gap-2">
          <StatusIndicator connected={connected} />
          <span
            className={cn(
              'text-xs font-medium transition-colors duration-300',
              connected ? 'text-emerald-500' : 'text-red-500'
            )}
          >
            {connected ? 'Online' : 'Offline'}
          </span>
        </div>
        {state && connected && (
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
            {state}
          </span>
        )}
        {!connected && onReconnect && (
          <Button
            variant="outline"
            size="sm"
            onClick={onReconnect}
            className="h-7 px-2.5 text-xs mt-1 border-red-500/30 hover:bg-red-500/10 hover:text-red-500"
          >
            <QrCode className="h-3 w-3 mr-1.5" />
            Reconectar
          </Button>
        )}
      </div>
    </div>
  )
}

export function ConnectionStatusCard() {
  const [status, setStatus] = useState<ConnectionStatusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [qrModalOpen, setQrModalOpen] = useState(false)
  const [selectedApi, setSelectedApi] = useState<'evolution' | 'avisa'>('evolution')

  const fetchStatus = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    setError(null)

    try {
      const response = await fetch('/api/connections/status')
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      const data: ConnectionStatusResponse = await response.json()
      setStatus(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch status')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchStatus()

    // Auto-refresh every 30 seconds (only when page is visible)
    const interval = setInterval(() => {
      if (!document.hidden) {
        fetchStatus()
      }
    }, 30000)

    // Refresh immediately when user returns to tab
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchStatus()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [fetchStatus])

  const handleRefresh = () => {
    fetchStatus(true)
  }

  const handleOpenQrModal = (api: 'evolution' | 'avisa') => {
    setSelectedApi(api)
    setQrModalOpen(true)
  }

  const handleQrModalClose = () => {
    setQrModalOpen(false)
  }

  const handleConnected = () => {
    // Refresh status after successful connection
    setTimeout(() => fetchStatus(true), 1000)
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-5 w-48" />
          </div>
          <Skeleton className="h-4 w-32 mt-1" />
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-[88px] rounded-xl" />
            <Skeleton className="h-[88px] rounded-xl" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error && !status) {
    return (
      <Card className="border-red-500/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <WifiOff className="h-4 w-4 text-red-500" />
            Status das Conexões WhatsApp
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg bg-red-500/5 border border-red-500/20 p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-sm font-medium">Erro ao verificar conexões</p>
                <p className="text-xs text-muted-foreground">{error}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Tentar novamente
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  const evolution = status?.evolution
  const avisa = status?.avisa
  const allConnected = evolution?.connected && avisa?.connected
  const anyDisconnected = !evolution?.connected || !avisa?.connected

  return (
    <Card
      className={cn(
        'transition-all duration-300',
        anyDisconnected ? 'border-red-500/30' : 'border-border'
      )}
    >
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              {allConnected ? (
                <Wifi className="h-4 w-4 text-emerald-500 transition-colors duration-300" />
              ) : (
                <WifiOff className="h-4 w-4 text-red-500 transition-colors duration-300" />
              )}
              Status das Conexões WhatsApp
            </CardTitle>
            <CardDescription className="flex items-center gap-1.5">
              <Clock className="h-3 w-3" />
              <span>
                Última verificação: {status?.timestamp ? formatTimeAgo(status.timestamp) : '-'}
              </span>
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="h-8 px-3"
          >
            <RefreshCw
              className={cn(
                'h-4 w-4 transition-transform duration-500',
                refreshing && 'animate-spin'
              )}
            />
            <span className="ml-2 hidden sm:inline">Atualizar</span>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <ConnectionItem
            name="Evolution API"
            description={evolution?.details?.profileName || 'Envio e recebimento de mensagens'}
            icon={Phone}
            connected={evolution?.connected ?? false}
            state={evolution?.details?.state}
            error={evolution?.error}
            onReconnect={() => handleOpenQrModal('evolution')}
          />

          <ConnectionItem
            name="Avisa API"
            description="Botões interativos para números BR"
            icon={MessageSquare}
            connected={avisa?.connected ?? false}
            state={avisa?.details?.loggedIn ? 'logged_in' : undefined}
            error={avisa?.error}
            onReconnect={() => handleOpenQrModal('avisa')}
          />
        </div>

        {anyDisconnected && (
          <div
            className={cn(
              'flex items-start gap-3 rounded-lg border p-4 transition-all duration-300',
              'border-red-500/20 bg-red-500/5'
            )}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-500/10">
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </div>
            <div className="space-y-1 min-w-0">
              <p className="text-sm font-medium text-red-500">
                Conexão perdida
              </p>
              <p className="text-xs text-muted-foreground">
                {!evolution?.connected && (
                  <span className="block">
                    Evolution API offline - O bot não consegue enviar ou receber mensagens.
                  </span>
                )}
                {!avisa?.connected && (
                  <span className="block">
                    Avisa API offline - Botões interativos indisponíveis.
                  </span>
                )}
              </p>
              <p className="text-xs text-muted-foreground pt-1">
                Clique em &quot;Reconectar&quot; para escanear o QR Code.
              </p>
            </div>
          </div>
        )}
      </CardContent>

      <QRCodeModal
        open={qrModalOpen}
        onClose={handleQrModalClose}
        api={selectedApi}
        onConnected={handleConnected}
      />
    </Card>
  )
}
