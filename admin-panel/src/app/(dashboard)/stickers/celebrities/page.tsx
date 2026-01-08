'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Star } from 'lucide-react'

interface CelebrityStat {
  id: string
  name: string
  slug: string
  total: number
  approved: number
  pending: number
}

export default function CelebritiesPage() {
  const [celebrities, setCelebrities] = useState<CelebrityStat[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadCelebrities() {
      // Load celebrities with sticker counts
      const { data: celebs } = await supabase
        .from('celebrities')
        .select('id, name, slug')
        .order('name')

      if (!celebs) {
        setLoading(false)
        return
      }

      // Get counts for each celebrity
      const stats = await Promise.all(
        celebs.map(async (celeb) => {
          const [totalRes, approvedRes] = await Promise.all([
            supabase
              .from('stickers')
              .select('*', { count: 'exact', head: true })
              .eq('celebrity_id', celeb.id),
            supabase
              .from('stickers')
              .select('*', { count: 'exact', head: true })
              .eq('celebrity_id', celeb.id)
              .eq('emotion_approved', true),
          ])

          return {
            ...celeb,
            total: totalRes.count || 0,
            approved: approvedRes.count || 0,
            pending: (totalRes.count || 0) - (approvedRes.count || 0),
          }
        })
      )

      // Sort by total stickers descending
      stats.sort((a, b) => b.total - a.total)
      setCelebrities(stats)
      setLoading(false)
    }

    loadCelebrities()
  }, [])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5" />
            Stickers por Celebridade
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-6 w-20" />
                </div>
              ))}
            </div>
          ) : celebrities.length === 0 ? (
            <p className="text-muted-foreground">Nenhuma celebridade cadastrada.</p>
          ) : (
            <div className="divide-y divide-border">
              {celebrities.map((celeb) => (
                <div
                  key={celeb.id}
                  className="flex items-center justify-between py-4 first:pt-0 last:pb-0"
                >
                  <div>
                    <p className="font-medium">{celeb.name}</p>
                    <p className="text-sm text-muted-foreground">@{celeb.slug}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">{celeb.total} total</Badge>
                    <Badge variant="secondary" className="bg-green-500/20 text-green-400">
                      {celeb.approved} aprovados
                    </Badge>
                    {celeb.pending > 0 && (
                      <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-400">
                        {celeb.pending} pendentes
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
