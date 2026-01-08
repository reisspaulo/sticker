'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Image } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function StickersPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Image className="h-5 w-5" />
            Todos os Stickers
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Navegue pelos stickers do sistema:
          </p>
          <div className="flex gap-4">
            <Link href="/stickers/emotions">
              <Button variant="outline">Classificar Emocoes</Button>
            </Link>
            <Link href="/stickers/celebrities">
              <Button variant="outline">Por Celebridade</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
