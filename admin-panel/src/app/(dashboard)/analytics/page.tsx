'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart3 } from 'lucide-react'

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Em breve: Metricas e graficos detalhados.
          </p>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            <li>- Novos usuarios por dia (grafico de linha)</li>
            <li>- Stickers criados por hora (heatmap)</li>
            <li>- Comparacao com periodo anterior</li>
            <li>- Taxa de conversao ao longo do tempo</li>
            <li>- Receita/MRR</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
