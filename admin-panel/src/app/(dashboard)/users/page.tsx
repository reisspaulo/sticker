'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users } from 'lucide-react'

export default function UsersPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Lista de Usuarios
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Em breve: Lista de usuarios com filtros, busca e acoes.
          </p>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            <li>- Busca por numero</li>
            <li>- Filtro por plano (Free, Premium, etc)</li>
            <li>- Filtro por periodo de cadastro</li>
            <li>- Ver detalhes do usuario</li>
            <li>- Timeline de interacoes</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
