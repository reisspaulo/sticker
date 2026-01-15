'use client'

import { ConnectionStatusCard } from '@/components/dashboard/connection-status-card'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Radio, Info } from 'lucide-react'

export default function ConnectionsMonitoringPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Radio className="h-6 w-6" />
          Conexoes WhatsApp
        </h1>
        <p className="text-muted-foreground mt-1">
          Monitore e gerencie as conexoes das APIs de WhatsApp
        </p>
      </div>

      {/* Connection Status Card */}
      <ConnectionStatusCard />

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="h-4 w-4" />
            Sobre as APIs
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border p-4 space-y-2">
              <h3 className="font-medium">Evolution API</h3>
              <p className="text-sm text-muted-foreground">
                API principal para envio e recebimento de mensagens WhatsApp.
                Responsavel por toda comunicacao do bot com os usuarios.
              </p>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                <li>Envio de stickers</li>
                <li>Recebimento de imagens</li>
                <li>Mensagens de texto</li>
                <li>Webhooks de eventos</li>
              </ul>
            </div>

            <div className="rounded-lg border p-4 space-y-2">
              <h3 className="font-medium">Avisa API</h3>
              <p className="text-sm text-muted-foreground">
                API complementar para envio de botoes interativos.
                Usada apenas para numeros brasileiros.
              </p>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                <li>Botoes de acao</li>
                <li>Listas de selecao</li>
                <li>Menus interativos</li>
                <li>Fallback automatico se offline</li>
              </ul>
            </div>
          </div>

          <div className="rounded-lg bg-muted/50 p-4">
            <h4 className="font-medium text-sm mb-2">Reconexao Automatica</h4>
            <p className="text-sm text-muted-foreground">
              O sistema verifica as conexoes a cada 5 minutos. Se uma API desconectar,
              voce recebera um alerta no WhatsApp cadastrado. Use o botao &quot;Reconectar&quot;
              acima para escanear o QR Code e restaurar a conexao.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
