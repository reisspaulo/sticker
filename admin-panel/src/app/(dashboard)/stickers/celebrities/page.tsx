'use client'

import { useEffect, useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Star, Plus, Pencil, Trash2 } from 'lucide-react'
import { CelebrityDialog } from '@/components/stickers/CelebrityDialog'
import type { Celebrity } from '@/lib/supabase'
import { toast } from 'sonner'

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
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingCelebrity, setEditingCelebrity] = useState<Celebrity | null>(null)

  const loadCelebrities = async () => {
    setLoading(true)
    const supabase = getSupabaseBrowserClient()

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

  useEffect(() => {
    loadCelebrities()
  }, [])

  const handleEdit = (celeb: CelebrityStat) => {
    setEditingCelebrity({ id: celeb.id, name: celeb.name, slug: celeb.slug })
    setDialogOpen(true)
  }

  const handleDelete = async (celeb: CelebrityStat) => {
    if (celeb.total > 0) {
      toast.error(
        `Não é possível deletar ${celeb.name} porque existem ${celeb.total} stickers atribuídos a ela.`
      )
      return
    }

    if (!confirm(`Tem certeza que deseja deletar ${celeb.name}?`)) {
      return
    }

    try {
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase.from('celebrities').delete().eq('id', celeb.id)

      if (error) throw error

      toast.success('Celebridade deletada com sucesso')
      loadCelebrities()
    } catch (error) {
      console.error('Error deleting celebrity:', error)
      toast.error('Erro ao deletar celebridade')
    }
  }

  const handleNewCelebrity = () => {
    setEditingCelebrity(null)
    setDialogOpen(true)
  }

  const handleDialogSuccess = () => {
    loadCelebrities()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Celebridades</h1>
        <Button onClick={handleNewCelebrity}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Celebridade
        </Button>
      </div>

      {/* Celebrities List */}
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
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-muted-foreground mb-4">Nenhuma celebridade cadastrada.</p>
              <Button onClick={handleNewCelebrity} variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                Criar primeira celebridade
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {celebrities.map((celeb) => (
                <div
                  key={celeb.id}
                  className="flex items-center justify-between py-4 first:pt-0 last:pb-0 group"
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

                    {/* Action buttons */}
                    <div className="flex items-center gap-1 ml-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(celeb)}
                        className="h-8 w-8"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(celeb)}
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        disabled={celeb.total > 0}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Celebrity Dialog */}
      <CelebrityDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        celebrity={editingCelebrity}
        onSuccess={handleDialogSuccess}
      />
    </div>
  )
}
