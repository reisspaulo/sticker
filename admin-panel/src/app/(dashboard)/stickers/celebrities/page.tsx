'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Star, Plus, Pencil, Trash2, Brain, Camera, AlertCircle, CheckCircle, Clock, Loader2 } from 'lucide-react'
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
  training_status: string
  embeddings_count: number
  photos_count: number
}

export default function CelebritiesPage() {
  const [celebrities, setCelebrities] = useState<CelebrityStat[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingCelebrity, setEditingCelebrity] = useState<Celebrity | null>(null)

  const loadCelebrities = async () => {
    setLoading(true)
    const supabase = createClient()

    // Load celebrities with sticker counts
    const { data: celebs } = await supabase
      .from('celebrities')
      .select('id, name, slug, training_status, embeddings_count')
      .order('name')

    if (!celebs) {
      setLoading(false)
      return
    }

    // Get counts for each celebrity
    const stats = await Promise.all(
      celebs.map(async (celeb) => {
        const [totalRes, approvedRes, photosRes] = await Promise.all([
          supabase
            .from('stickers')
            .select('*', { count: 'exact', head: true })
            .eq('celebrity_id', celeb.id),
          supabase
            .from('stickers')
            .select('*', { count: 'exact', head: true })
            .eq('celebrity_id', celeb.id)
            .eq('emotion_approved', true),
          supabase
            .from('celebrity_photos')
            .select('*', { count: 'exact', head: true })
            .eq('celebrity_id', celeb.id),
        ])

        return {
          ...celeb,
          total: totalRes.count || 0,
          approved: approvedRes.count || 0,
          pending: (totalRes.count || 0) - (approvedRes.count || 0),
          training_status: celeb.training_status || 'pending',
          embeddings_count: celeb.embeddings_count || 0,
          photos_count: photosRes.count || 0,
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
    setEditingCelebrity({
      id: celeb.id,
      name: celeb.name,
      slug: celeb.slug,
      training_status: celeb.training_status,
      embeddings_count: celeb.embeddings_count,
    })
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
      const supabase = createClient()
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
                  <div className="flex items-center gap-3">
                    {/* Training Status Icon */}
                    <div className="flex-shrink-0">
                      {celeb.training_status === 'trained' ? (
                        <div className="p-2 rounded-full bg-green-500/10">
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        </div>
                      ) : celeb.training_status === 'training' ? (
                        <div className="p-2 rounded-full bg-blue-500/10">
                          <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                        </div>
                      ) : celeb.training_status === 'failed' ? (
                        <div className="p-2 rounded-full bg-red-500/10">
                          <AlertCircle className="h-5 w-5 text-red-500" />
                        </div>
                      ) : (
                        <div className="p-2 rounded-full bg-yellow-500/10">
                          <Clock className="h-5 w-5 text-yellow-500" />
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{celeb.name}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>@{celeb.slug}</span>
                        <span className="text-muted-foreground/40">•</span>
                        <span className="flex items-center gap-1">
                          <Camera className="h-3 w-3" />
                          {celeb.photos_count} fotos
                        </span>
                        {celeb.training_status === 'trained' && celeb.embeddings_count > 0 && (
                          <>
                            <span className="text-muted-foreground/40">•</span>
                            <span className="flex items-center gap-1">
                              <Brain className="h-3 w-3" />
                              {celeb.embeddings_count} embeddings
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* Training Status Badge */}
                    {celeb.training_status === 'trained' ? (
                      <Badge variant="secondary" className="bg-green-500/20 text-green-500">
                        Treinada
                      </Badge>
                    ) : celeb.training_status === 'training' ? (
                      <Badge variant="secondary" className="bg-blue-500/20 text-blue-500">
                        Treinando...
                      </Badge>
                    ) : celeb.training_status === 'failed' ? (
                      <Badge variant="secondary" className="bg-red-500/20 text-red-500">
                        Falhou
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-500">
                        Pendente
                      </Badge>
                    )}

                    {/* Sticker Counts */}
                    <Badge variant="outline">{celeb.total} stickers</Badge>
                    {celeb.approved > 0 && (
                      <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-400">
                        {celeb.approved} aprovados
                      </Badge>
                    )}
                    {celeb.pending > 0 && (
                      <Badge variant="secondary" className="bg-amber-500/20 text-amber-400">
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
