'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Settings } from 'lucide-react'

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configurações
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Em breve: Configurações do sistema.
          </p>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            <li>- Feature flags</li>
            <li>- Limites por plano</li>
            <li>- Mensagens/Copy do bot</li>
            <li>- Gerenciar admins</li>
            <li>- Webhooks</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
