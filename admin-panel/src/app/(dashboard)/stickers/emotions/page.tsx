'use client'

import { useEffect, useState, useCallback } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'
import { getStickerUrl, type Sticker, type Celebrity } from '@/lib/supabase'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'

const EMOTION_SUGGESTIONS = [
  { tag: 'feliz', color: 'bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/30' },
  { tag: 'debochada', color: 'bg-purple-500/20 text-purple-300 hover:bg-purple-500/30' },
  { tag: 'animada', color: 'bg-pink-500/20 text-pink-300 hover:bg-pink-500/30' },
  { tag: 'chocada', color: 'bg-red-500/20 text-red-300 hover:bg-red-500/30' },
  { tag: 'ironica', color: 'bg-orange-500/20 text-orange-300 hover:bg-orange-500/30' },
  { tag: 'sensual', color: 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30' },
  { tag: 'triste', color: 'bg-blue-500/20 text-blue-300 hover:bg-blue-500/30' },
  { tag: 'pensativa', color: 'bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30' },
  { tag: 'surpresa', color: 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30' },
  { tag: 'raiva', color: 'bg-red-600/20 text-red-400 hover:bg-red-600/30' },
]

const CONTEXT_SUGGESTIONS = [
  { tag: 'dancando', color: 'bg-green-500/20 text-green-300 hover:bg-green-500/30' },
  { tag: 'comemorando', color: 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30' },
  { tag: 'rindo', color: 'bg-lime-500/20 text-lime-300 hover:bg-lime-500/30' },
  { tag: 'fofocando', color: 'bg-violet-500/20 text-violet-300 hover:bg-violet-500/30' },
  { tag: 'posando', color: 'bg-fuchsia-500/20 text-fuchsia-300 hover:bg-fuchsia-500/30' },
  { tag: 'mandando_beijo', color: 'bg-pink-500/20 text-pink-300 hover:bg-pink-500/30' },
]

const PAGE_SIZE = 30

type FilterStatus = 'pending' | 'all' | 'approved' | 'no_emotion'

export default function EmotionsPage() {
  const [stickers, setStickers] = useState<Sticker[]>([])
  const [celebrities, setCelebrities] = useState<Celebrity[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('pending')
  const [filterCelebrity, setFilterCelebrity] = useState<string>('all')
  const [searchTag, setSearchTag] = useState('')
  const [currentPage, setCurrentPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [stats, setStats] = useState({ total: 0, classified: 0, approved: 0 })

  // Modal state
  const [selectedSticker, setSelectedSticker] = useState<Sticker | null>(null)
  const [editTags, setEditTags] = useState<string[]>([])
  const [editCelebrity, setEditCelebrity] = useState<string>('none')
  const [newTag, setNewTag] = useState('')
  const [saving, setSaving] = useState(false)

  const loadCelebrities = useCallback(async () => {
    const supabase = getSupabaseBrowserClient()
    const { data } = await supabase
      .from('celebrities')
      .select('id, name, slug')
      .order('name')
    if (data) setCelebrities(data)
  }, [])

  const loadStats = useCallback(async () => {
    const supabase = getSupabaseBrowserClient()
    const [totalRes, classifiedRes, approvedRes] = await Promise.all([
      supabase.from('stickers').select('*', { count: 'exact', head: true }).eq('face_detected', true),
      supabase.from('stickers').select('*', { count: 'exact', head: true }).eq('face_detected', true).not('emotion_tags', 'is', null),
      supabase.from('stickers').select('*', { count: 'exact', head: true }).eq('emotion_approved', true),
    ])
    setStats({
      total: totalRes.count || 0,
      classified: classifiedRes.count || 0,
      approved: approvedRes.count || 0,
    })
  }, [])

  const loadStickers = useCallback(async () => {
    setLoading(true)
    const supabase = getSupabaseBrowserClient()

    let query = supabase
      .from('stickers')
      .select('id, storage_path, tipo, emotion_tags, emotion_approved, celebrity_id, celebrities(name)', { count: 'exact' })
      .eq('face_detected', true)

    if (filterStatus === 'pending') {
      query = query.not('emotion_tags', 'is', null).or('emotion_approved.is.null,emotion_approved.eq.false')
    } else if (filterStatus === 'approved') {
      query = query.eq('emotion_approved', true)
    } else if (filterStatus === 'no_emotion') {
      query = query.is('emotion_tags', null)
    } else {
      query = query.not('emotion_tags', 'is', null)
    }

    if (filterCelebrity && filterCelebrity !== 'all') {
      query = query.eq('celebrity_id', filterCelebrity)
    }

    if (searchTag.trim()) {
      query = query.contains('emotion_tags', [searchTag.trim().toLowerCase()])
    }

    if (filterStatus === 'no_emotion') {
      query = query.order('id', { ascending: false })
    } else {
      query = query.order('emotion_classified_at', { ascending: false, nullsFirst: false })
    }

    query = query.range(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE - 1)

    const { data, count, error } = await query

    if (error) {
      console.error('Error loading stickers:', error.message, error.details, error.hint)
    } else {
      setStickers(data || [])
      setTotalCount(count || 0)
    }

    setLoading(false)
  }, [filterStatus, filterCelebrity, searchTag, currentPage])

  useEffect(() => {
    loadCelebrities()
    loadStats()
  }, [loadCelebrities, loadStats])

  useEffect(() => {
    loadStickers()
  }, [loadStickers])

  const openEditModal = (sticker: Sticker) => {
    setSelectedSticker(sticker)
    setEditTags([...(sticker.emotion_tags || [])])
    setEditCelebrity(sticker.celebrity_id || 'none')
    setNewTag('')
  }

  const closeModal = () => {
    setSelectedSticker(null)
    setEditTags([])
    setEditCelebrity('none')
    setNewTag('')
  }

  const addTag = (tag: string) => {
    const normalized = tag.toLowerCase().trim()
    if (normalized && !editTags.includes(normalized)) {
      setEditTags([...editTags, normalized])
    }
    setNewTag('')
  }

  const removeTag = (index: number) => {
    setEditTags(editTags.filter((_, i) => i !== index))
  }

  const saveSticker = async (approve: boolean = false) => {
    if (!selectedSticker) return
    setSaving(true)
    const supabase = getSupabaseBrowserClient()

    const { error } = await supabase
      .from('stickers')
      .update({
        emotion_tags: editTags.length > 0 ? editTags : null,
        celebrity_id: editCelebrity === 'none' ? null : editCelebrity,
        ...(approve && { emotion_approved: true }),
      })
      .eq('id', selectedSticker.id)

    if (error) {
      console.error('Error saving:', error)
      alert('Erro ao salvar: ' + error.message)
    } else {
      closeModal()
      loadStickers()
      loadStats()
    }

    setSaving(false)
  }

  const rejectSticker = async () => {
    if (!selectedSticker) return
    if (!confirm('Remover todas as tags deste sticker?')) return
    setSaving(true)
    const supabase = getSupabaseBrowserClient()

    const { error } = await supabase
      .from('stickers')
      .update({
        emotion_tags: null,
        emotion_approved: false,
      })
      .eq('id', selectedSticker.id)

    if (error) {
      console.error('Error rejecting:', error)
    } else {
      closeModal()
      loadStickers()
      loadStats()
    }

    setSaving(false)
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  return (
    <div className="space-y-6">
      {/* Stats Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="text-sm">
            {stats.approved} aprovados
          </Badge>
          <Badge variant="outline" className="text-sm">
            {stats.classified} classificados
          </Badge>
          <Badge variant="outline" className="text-sm">
            {stats.total} total
          </Badge>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { loadStickers(); loadStats() }}
        >
          Atualizar
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v as FilterStatus); setCurrentPage(0) }}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pendentes de revisão</SelectItem>
              <SelectItem value="all">Todos com emoção</SelectItem>
              <SelectItem value="approved">Aprovados</SelectItem>
              <SelectItem value="no_emotion">Sem emoção</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterCelebrity} onValueChange={(v) => { setFilterCelebrity(v); setCurrentPage(0) }}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Todas celebridades" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas celebridades</SelectItem>
              {celebrities.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            placeholder="Buscar tag..."
            value={searchTag}
            onChange={(e) => { setSearchTag(e.target.value); setCurrentPage(0) }}
            className="w-[160px]"
          />

          <span className="ml-auto text-sm text-muted-foreground">
            {totalCount} stickers
          </span>
        </div>
      </Card>

      {/* Stickers Grid */}
      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="aspect-square" />
              <div className="p-3 space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-5 w-full" />
              </div>
            </Card>
          ))}
        </div>
      ) : stickers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="text-muted-foreground">Nenhum sticker encontrado</div>
          <p className="mt-2 text-sm text-muted-foreground/60">
            Tente ajustar os filtros
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {stickers.map((sticker) => (
            <Card
              key={sticker.id}
              className={`group cursor-pointer overflow-hidden transition-all hover:ring-2 hover:ring-primary/50 ${
                sticker.emotion_approved ? 'ring-1 ring-green-500/50' : ''
              }`}
              onClick={() => openEditModal(sticker)}
            >
              <div className="aspect-square bg-muted/50 p-2 flex items-center justify-center">
                <img
                  src={getStickerUrl(sticker)}
                  alt="Sticker"
                  className="max-h-full max-w-full object-contain transition-transform group-hover:scale-105"
                  loading="lazy"
                />
              </div>
              <div className="p-3 space-y-2">
                {(Array.isArray(sticker.celebrities) ? sticker.celebrities[0]?.name : sticker.celebrities?.name) && (
                  <p className="text-xs font-medium text-purple-400 truncate">
                    {Array.isArray(sticker.celebrities) ? sticker.celebrities[0]?.name : sticker.celebrities?.name}
                  </p>
                )}
                <div className="flex flex-wrap gap-1">
                  {(sticker.emotion_tags || []).slice(0, 3).map((tag, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                  {(sticker.emotion_tags || []).length > 3 && (
                    <span className="text-xs text-muted-foreground">
                      +{(sticker.emotion_tags || []).length - 3}
                    </span>
                  )}
                </div>
                {sticker.emotion_approved && (
                  <p className="text-xs text-green-500">Aprovado</p>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
            disabled={currentPage === 0}
          >
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground px-4">
            Página {currentPage + 1} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={currentPage >= totalPages - 1}
          >
            Próximo
          </Button>
        </div>
      )}

      {/* Edit Modal */}
      <Dialog open={!!selectedSticker} onOpenChange={() => closeModal()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Classificação</DialogTitle>
          </DialogHeader>

          {selectedSticker && (
            <div className="space-y-6">
              {/* Image Preview */}
              <div className="flex justify-center rounded-lg bg-muted/50 p-4">
                <img
                  src={getStickerUrl(selectedSticker)}
                  alt="Sticker"
                  className="max-h-48 object-contain"
                />
              </div>

              {/* Celebrity Selector */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Celebridade</label>
                <Select value={editCelebrity} onValueChange={setEditCelebrity}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione uma celebridade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {celebrities.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Current Tags */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Tags atuais</label>
                <div className="flex flex-wrap gap-2 min-h-[32px]">
                  {editTags.length === 0 ? (
                    <span className="text-sm text-muted-foreground">Nenhuma tag</span>
                  ) : (
                    editTags.map((tag, i) => (
                      <Badge key={i} variant="secondary" className="gap-1 pr-1">
                        {tag}
                        <button
                          onClick={() => removeTag(i)}
                          className="ml-1 rounded-full hover:bg-destructive/20 p-0.5"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </Badge>
                    ))
                  )}
                </div>
              </div>

              {/* Add New Tag */}
              <div className="flex gap-2">
                <Input
                  placeholder="Nova tag..."
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addTag(newTag)}
                  className="flex-1"
                />
                <Button variant="secondary" onClick={() => addTag(newTag)}>
                  Adicionar
                </Button>
              </div>

              {/* Emotion Suggestions */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Emoções</label>
                <div className="flex flex-wrap gap-1.5">
                  {EMOTION_SUGGESTIONS.map(({ tag, color }) => (
                    <button
                      key={tag}
                      onClick={() => addTag(tag)}
                      disabled={editTags.includes(tag)}
                      className={`px-2 py-1 rounded text-xs transition-colors ${color} ${
                        editTags.includes(tag) ? 'opacity-40 cursor-not-allowed' : ''
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Context Suggestions */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Contexto</label>
                <div className="flex flex-wrap gap-1.5">
                  {CONTEXT_SUGGESTIONS.map(({ tag, color }) => (
                    <button
                      key={tag}
                      onClick={() => addTag(tag)}
                      disabled={editTags.includes(tag)}
                      className={`px-2 py-1 rounded text-xs transition-colors ${color} ${
                        editTags.includes(tag) ? 'opacity-40 cursor-not-allowed' : ''
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={() => saveSticker(true)}
                  disabled={saving}
                >
                  Salvar e Aprovar
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => saveSticker(false)}
                  disabled={saving}
                >
                  Salvar
                </Button>
                <Button
                  variant="destructive"
                  onClick={rejectSticker}
                  disabled={saving}
                >
                  Rejeitar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
