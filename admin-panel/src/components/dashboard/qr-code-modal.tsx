'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Smartphone,
  Loader2,
  QrCode,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface QRCodeModalProps {
  open: boolean
  onClose: () => void
  api: 'evolution' | 'avisa'
  onConnected?: () => void
}

interface QRResponse {
  qrCode?: string | null
  pairingCode?: string | null
  alreadyConnected?: boolean
  message?: string
  error?: string
}

export function QRCodeModal({ open, onClose, api, onConnected }: QRCodeModalProps) {
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [pairingCode, setPairingCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const [checkingConnection, setCheckingConnection] = useState(false)

  const apiName = api === 'evolution' ? 'Evolution API' : 'Avisa API'
  const apiDescription = api === 'evolution'
    ? 'Principal - Envio e recebimento de mensagens'
    : 'Botoes interativos para numeros BR'

  const fetchQRCode = useCallback(async () => {
    setLoading(true)
    setError(null)
    setQrCode(null)
    setPairingCode(null)
    setConnected(false)

    try {
      const response = await fetch(`/api/connections/${api}/qr`)
      const data: QRResponse = await response.json()

      if (data.alreadyConnected) {
        setConnected(true)
        onConnected?.()
        return
      }

      if (data.error) {
        setError(data.error)
        return
      }

      if (data.qrCode) {
        // Add data:image prefix if not present
        const qr = data.qrCode.startsWith('data:image')
          ? data.qrCode
          : `data:image/png;base64,${data.qrCode}`
        setQrCode(qr)
      }

      if (data.pairingCode) {
        setPairingCode(data.pairingCode)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao obter QR Code')
    } finally {
      setLoading(false)
    }
  }, [api, onConnected])

  const checkConnection = useCallback(async () => {
    setCheckingConnection(true)
    try {
      const response = await fetch('/api/connections/status')
      const data = await response.json()

      const isConnected = api === 'evolution'
        ? data.evolution?.connected
        : data.avisa?.connected

      if (isConnected) {
        setConnected(true)
        onConnected?.()
      }
    } catch {
      // Ignore errors during polling
    } finally {
      setCheckingConnection(false)
    }
  }, [api, onConnected])

  // Fetch QR code when modal opens
  useEffect(() => {
    if (open && !connected) {
      fetchQRCode()
    }
  }, [open, connected, fetchQRCode])

  // Poll for connection status every 3 seconds while waiting for scan
  useEffect(() => {
    if (!open || connected || loading) return

    const interval = setInterval(checkConnection, 3000)
    return () => clearInterval(interval)
  }, [open, connected, loading, checkConnection])

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setQrCode(null)
      setPairingCode(null)
      setError(null)
      setConnected(false)
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Reconectar {apiName}
          </DialogTitle>
          <DialogDescription>
            {apiDescription}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center py-4">
          {/* Success State */}
          {connected && (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
                <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              </div>
              <div className="text-center">
                <p className="font-medium text-emerald-500">Conectado com sucesso!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  O {apiName} esta funcionando normalmente.
                </p>
              </div>
              <Button onClick={onClose} className="mt-2">
                Fechar
              </Button>
            </div>
          )}

          {/* Loading State */}
          {loading && !connected && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Skeleton className="h-64 w-64 rounded-lg" />
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Gerando QR Code...
              </div>
            </div>
          )}

          {/* Error State */}
          {error && !loading && !connected && (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
                <AlertTriangle className="h-8 w-8 text-red-500" />
              </div>
              <div className="text-center">
                <p className="font-medium text-red-500">Erro ao obter QR Code</p>
                <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                  {error}
                </p>
              </div>
              <Button onClick={fetchQRCode} variant="outline" className="mt-2">
                <RefreshCw className="h-4 w-4 mr-2" />
                Tentar novamente
              </Button>
            </div>
          )}

          {/* QR Code Display */}
          {qrCode && !loading && !connected && !error && (
            <>
              <div className="relative rounded-lg border bg-white p-4">
                <img
                  src={qrCode}
                  alt="QR Code para conexao"
                  className="h-64 w-64"
                />
              </div>

              {pairingCode && (
                <div className="mt-4 text-center">
                  <p className="text-xs text-muted-foreground">Codigo de pareamento:</p>
                  <p className="font-mono text-lg font-bold tracking-widest">
                    {pairingCode}
                  </p>
                </div>
              )}

              <div className="mt-6 space-y-2 text-center">
                <div className="flex items-center justify-center gap-2 text-sm">
                  {checkingConnection ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : (
                    <div className="relative flex h-4 w-4 items-center justify-center">
                      <span className="absolute h-3 w-3 animate-ping rounded-full bg-amber-500/60" />
                      <span className="h-2 w-2 rounded-full bg-amber-500" />
                    </div>
                  )}
                  <span className="text-muted-foreground">
                    Aguardando conexao...
                  </span>
                </div>
              </div>

              <div className="mt-6 rounded-lg bg-muted/50 p-4 text-sm">
                <div className="flex items-start gap-3">
                  <Smartphone className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="space-y-1.5 text-muted-foreground">
                    <p>1. Abra o WhatsApp no celular</p>
                    <p>2. Toque em <span className="font-medium text-foreground">Menu</span> ou <span className="font-medium text-foreground">Configuracoes</span></p>
                    <p>3. Toque em <span className="font-medium text-foreground">Aparelhos conectados</span></p>
                    <p>4. Toque em <span className="font-medium text-foreground">Conectar um aparelho</span></p>
                    <p>5. Aponte a camera para este QR Code</p>
                  </div>
                </div>
              </div>

              <Button
                onClick={fetchQRCode}
                variant="ghost"
                size="sm"
                className="mt-4"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Atualizar QR Code
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
