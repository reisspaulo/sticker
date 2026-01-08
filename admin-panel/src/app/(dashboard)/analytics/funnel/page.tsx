'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp } from 'lucide-react'

export default function FunnelPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Funil de Conversao
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Em breve: Visualizacao do funil de conversao completo.
          </p>

          {/* Preview do funil */}
          <div className="mt-6 space-y-3">
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>Primeiro Contato</span>
                <span className="text-muted-foreground">100%</span>
              </div>
              <div className="h-8 rounded bg-primary/80" />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>Primeiro Sticker</span>
                <span className="text-muted-foreground">~74%</span>
              </div>
              <div className="h-8 w-3/4 rounded bg-primary/60" />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>Retorno D7</span>
                <span className="text-muted-foreground">~41%</span>
              </div>
              <div className="h-8 w-2/5 rounded bg-primary/40" />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>Upgrade</span>
                <span className="text-muted-foreground">~7%</span>
              </div>
              <div className="h-8 w-[7%] rounded bg-primary/30" />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>Pagou</span>
                <span className="text-muted-foreground">~3%</span>
              </div>
              <div className="h-8 w-[3%] min-w-4 rounded bg-green-500/50" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
