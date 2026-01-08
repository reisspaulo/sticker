'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { GitBranch } from 'lucide-react'

export default function UsersFlowPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Fluxo de Usuarios
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Em breve: Visualizacao do funil de conversao.
          </p>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            <li>- Primeiro contato -&gt; Primeiro sticker</li>
            <li>- Retorno D1, D7, D30</li>
            <li>- Visualizou upgrade -&gt; Pagou</li>
            <li>- Taxa de conversao por etapa</li>
            <li>- Comparacao por cohort</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
