'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ArrowLeft,
  Image as ImageIcon,
  Upload,
  Plus,
  Trash2,
  RefreshCw,
  Loader2,
  Eye,
  Pencil,
  Megaphone,
  Tag,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface BotSticker {
  id: string
  name: string
  description: string | null
  storage_path: string
  sticker_url: string
  tags: string[]
  category: string
  is_animated: boolean
  is_active: boolean
  usage_count: number
  campaigns_count: number
  created_at: string
  updated_at: string
}

const categoryConfig: Record<string, { label: string; color: string }> = {
  geral: { label: 'Geral', color: 'bg-zinc-500/20 text-zinc-400' },
  feature: { label: 'Feature', color: 'bg-blue-500/20 text-blue-400' },
  emotion: { label: 'Emocao', color: 'bg-pink-500/20 text-pink-400' },
  promo: { label: 'Promo', color: 'bg-amber-500/20 text-amber-400' },
  welcome: { label: 'Boas-vindas', color: 'bg-emerald-500/20 text-emerald-400' },
  celebration: { label: 'Celebracao', color: 'bg-purple-500/20 text-purple-400' },
}

export default function StickersLibraryPage() {
  const [stickers, setStickers] = useState<BotSticker[]>([])
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState<string[]>([])
  const [categoryFilter, setCategoryFilter] = useState('all')

  // Upload state
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadPreview, setUploadPreview] = useState<string | null>(null)
  const [uploadName, setUploadName] = useState('')
  const [uploadDescription, setUploadDescription] = useState('')
  const [uploadCategory, setUploadCategory] = useState('geral')
  const [uploadTags, setUploadTags] = useState('')
  const [uploadAnimated, setUploadAnimated] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Edit state
  const [editOpen, setEditOpen] = useState(false)
  const [editSticker, setEditSticker] = useState<BotSticker | null>(null)
  const [editSaving, setEditSaving] = useState(false)

  // Delete state
  const [deleting, setDeleting] = useState<string | null>(null)

  const fetchStickers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (categoryFilter !== 'all') params.set('category', categoryFilter)

      const response = await fetch(`/api/campaigns/stickers?${params}`)
      if (!response.ok) throw new Error('Failed to fetch stickers')
      const data = await response.json()
      setStickers(data.stickers || [])
      setCategories(data.categories || [])
    } catch (error) {
      console.error('Error fetching stickers:', error)
    } finally {
      setLoading(false)
    }
  }, [categoryFilter])

  useEffect(() => {
    fetchStickers()
  }, [fetchStickers])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const validTypes = ['image/webp', 'image/png', 'image/gif']
    if (!validTypes.includes(file.type)) {
      alert('Tipo de arquivo invalido. Use WebP, PNG ou GIF.')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Arquivo muito grande. Maximo 5MB.')
      return
    }

    setUploadFile(file)
    setUploadPreview(URL.createObjectURL(file))

    // Auto-detect animated based on file type
    if (file.type === 'image/gif') {
      setUploadAnimated(true)
    }
  }

  const handleUpload = async () => {
    if (!uploadFile || !uploadName.trim()) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', uploadFile)
      formData.append('name', uploadName)
      formData.append('description', uploadDescription)
      formData.append('category', uploadCategory)
      formData.append('tags', uploadTags)
      formData.append('is_animated', String(uploadAnimated))

      const response = await fetch('/api/campaigns/stickers/upload', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()
      if (!response.ok) {
        alert(result.error || 'Erro ao fazer upload')
        return
      }

      setUploadOpen(false)
      resetUploadForm()
      fetchStickers()
    } catch (error) {
      console.error('Error uploading:', error)
      alert('Erro ao fazer upload')
    } finally {
      setUploading(false)
    }
  }

  const resetUploadForm = () => {
    setUploadFile(null)
    setUploadPreview(null)
    setUploadName('')
    setUploadDescription('')
    setUploadCategory('geral')
    setUploadTags('')
    setUploadAnimated(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleEdit = async () => {
    if (!editSticker) return
    setEditSaving(true)
    try {
      const response = await fetch(`/api/campaigns/stickers/${editSticker.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editSticker.name,
          description: editSticker.description,
          category: editSticker.category,
          tags: editSticker.tags,
          is_active: editSticker.is_active,
        }),
      })

      if (!response.ok) {
        const result = await response.json()
        alert(result.error || 'Erro ao salvar')
        return
      }

      setEditOpen(false)
      setEditSticker(null)
      fetchStickers()
    } catch (error) {
      console.error('Error saving:', error)
      alert('Erro ao salvar')
    } finally {
      setEditSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este sticker? Esta acao nao pode ser desfeita.')) return
    setDeleting(id)
    try {
      const response = await fetch(`/api/campaigns/stickers/${id}`, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error('Failed to delete')
      fetchStickers()
    } catch (error) {
      console.error('Error deleting:', error)
      alert('Erro ao excluir')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/campaigns">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ImageIcon className="h-6 w-6" />
              Biblioteca de Stickers
            </h1>
            <p className="text-muted-foreground">
              Figurinhas para usar em campanhas do bot
            </p>
          </div>
        </div>
        <Button onClick={() => setUploadOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Upload Sticker
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas categorias</SelectItem>
            {Object.entries(categoryConfig).map(([key, config]) => (
              <SelectItem key={key} value={key}>{config.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={fetchStickers} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
        <span className="text-sm text-muted-foreground">
          {stickers.length} stickers
        </span>
      </div>

      {/* Stickers Grid */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-32 w-32 mx-auto rounded-lg" />
                <Skeleton className="h-4 w-24 mx-auto mt-4" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : stickers.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <ImageIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum sticker encontrado</p>
              <Button className="mt-4" onClick={() => setUploadOpen(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Fazer Upload
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
          {stickers.map(sticker => {
            const cat = categoryConfig[sticker.category] || categoryConfig.geral
            return (
              <Card key={sticker.id} className={`transition-all hover:border-primary/30 ${!sticker.is_active ? 'opacity-50' : ''}`}>
                <CardContent className="pt-6">
                  <div className="relative group">
                    <div className="h-32 w-32 mx-auto rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                      <img
                        src={sticker.sticker_url}
                        alt={sticker.name}
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                    {sticker.is_animated && (
                      <Badge className="absolute top-0 right-0 text-xs bg-purple-500">
                        GIF
                      </Badge>
                    )}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 rounded-lg">
                      <Button
                        variant="secondary"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          setEditSticker({ ...sticker })
                          setEditOpen(true)
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleDelete(sticker.id)}
                        disabled={deleting === sticker.id}
                      >
                        {deleting === sticker.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 text-center">
                    <p className="font-medium truncate">{sticker.name}</p>
                    <div className="flex items-center justify-center gap-2 mt-2">
                      <Badge variant="secondary" className={cat.color}>
                        {cat.label}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {sticker.usage_count}
                      </span>
                      <span className="flex items-center gap-1">
                        <Megaphone className="h-3 w-3" />
                        {sticker.campaigns_count}
                      </span>
                    </div>
                    {sticker.tags.length > 0 && (
                      <div className="flex items-center justify-center gap-1 mt-2 flex-wrap">
                        {sticker.tags.slice(0, 3).map(tag => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {sticker.tags.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{sticker.tags.length - 3}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Upload Modal */}
      <Dialog open={uploadOpen} onOpenChange={(open) => {
        setUploadOpen(open)
        if (!open) resetUploadForm()
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upload de Sticker</DialogTitle>
            <DialogDescription>
              Adicione uma nova figurinha a biblioteca
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Drop Zone / Preview */}
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                uploadPreview ? 'border-primary' : 'border-muted-foreground/25 hover:border-muted-foreground/50'
              }`}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploadPreview ? (
                <div className="relative">
                  <img
                    src={uploadPreview}
                    alt="Preview"
                    className="max-h-40 mx-auto rounded-lg"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-0 right-0 h-6 w-6"
                    onClick={(e) => {
                      e.stopPropagation()
                      setUploadFile(null)
                      setUploadPreview(null)
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Clique ou arraste um arquivo
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    WebP, PNG ou GIF (max 5MB)
                  </p>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".webp,.png,.gif,image/webp,image/png,image/gif"
                onChange={handleFileSelect}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                value={uploadName}
                onChange={(e) => setUploadName(e.target.value)}
                placeholder="nome_do_sticker"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descricao (opcional)</Label>
              <Input
                id="description"
                value={uploadDescription}
                onChange={(e) => setUploadDescription(e.target.value)}
                placeholder="Descricao breve"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Categoria</Label>
              <Select value={uploadCategory} onValueChange={setUploadCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(categoryConfig).map(([key, config]) => (
                    <SelectItem key={key} value={key}>{config.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">Tags (separadas por virgula)</Label>
              <Input
                id="tags"
                value={uploadTags}
                onChange={(e) => setUploadTags(e.target.value)}
                placeholder="twitter, feature, promo"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="animated"
                checked={uploadAnimated}
                onChange={(e) => setUploadAnimated(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="animated" className="text-sm font-normal">
                E um sticker animado (GIF)
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpload} disabled={uploading || !uploadFile || !uploadName.trim()}>
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Sticker</DialogTitle>
          </DialogHeader>
          {editSticker && (
            <div className="space-y-4 py-4">
              <div className="flex justify-center">
                <div className="h-24 w-24 rounded-lg overflow-hidden bg-muted">
                  <img
                    src={editSticker.sticker_url}
                    alt={editSticker.name}
                    className="h-full w-full object-contain"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-name">Nome</Label>
                <Input
                  id="edit-name"
                  value={editSticker.name}
                  onChange={(e) => setEditSticker({ ...editSticker, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-description">Descricao</Label>
                <Input
                  id="edit-description"
                  value={editSticker.description || ''}
                  onChange={(e) => setEditSticker({ ...editSticker, description: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-category">Categoria</Label>
                <Select
                  value={editSticker.category}
                  onValueChange={(v) => setEditSticker({ ...editSticker, category: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(categoryConfig).map(([key, config]) => (
                      <SelectItem key={key} value={key}>{config.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-tags">Tags</Label>
                <Input
                  id="edit-tags"
                  value={editSticker.tags.join(', ')}
                  onChange={(e) => setEditSticker({
                    ...editSticker,
                    tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean)
                  })}
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="edit-active"
                  checked={editSticker.is_active}
                  onChange={(e) => setEditSticker({ ...editSticker, is_active: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="edit-active" className="text-sm font-normal">
                  Sticker ativo
                </Label>
              </div>

              <div className="text-xs text-muted-foreground">
                Usado {editSticker.usage_count} vezes em {editSticker.campaigns_count} campanhas
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleEdit} disabled={editSaving}>
              {editSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
