'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { createClient } from '@/utils/supabase/client'
import { PhotoUpload, type UploadedPhoto } from '@/components/celebrities/PhotoUpload'
import { toast } from 'sonner'
import { Loader2, Brain, AlertCircle } from 'lucide-react'

interface Celebrity {
  id: string
  name: string
  slug: string
  training_status?: string
  embeddings_count?: number
}

interface CelebrityDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  celebrity?: Celebrity | null
  onSuccess: () => void
}

export function CelebrityDialog({ open, onOpenChange, celebrity, onSuccess }: CelebrityDialogProps) {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [photos, setPhotos] = useState<UploadedPhoto[]>([])
  const [existingPhotos, setExistingPhotos] = useState<UploadedPhoto[]>([])
  const [createPack, setCreatePack] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadingPhotos, setLoadingPhotos] = useState(false)
  const [activeTab, setActiveTab] = useState('info')

  const isEditing = !!celebrity

  // Reset form when dialog opens/closes or celebrity changes
  useEffect(() => {
    if (open) {
      if (celebrity) {
        setName(celebrity.name)
        setSlug(celebrity.slug)
        setActiveTab('info')
        loadExistingPhotos(celebrity.id)
      } else {
        setName('')
        setSlug('')
        setPhotos([])
        setExistingPhotos([])
        setCreatePack(true)
        setActiveTab('info')
      }
    }
  }, [open, celebrity])

  const loadExistingPhotos = async (celebrityId: string) => {
    setLoadingPhotos(true)

    try {
      // Use API route to fetch photos with signed URLs
      const response = await fetch(`/api/celebrities/${celebrityId}/photos`)

      if (!response.ok) {
        throw new Error('Failed to load photos')
      }

      const { photos: photosData } = await response.json()

      const photosWithUrls: UploadedPhoto[] = (photosData || []).map(
        (photo: { id: string; storage_path: string; file_name: string; url: string }) => ({
          id: photo.id,
          storage_path: photo.storage_path,
          file_name: photo.file_name,
          url: photo.url,
        })
      )

      setExistingPhotos(photosWithUrls)
      setPhotos(photosWithUrls)
    } catch (error) {
      console.error('Error loading photos:', error)
    } finally {
      setLoadingPhotos(false)
    }
  }

  // Auto-generate slug from name
  const handleNameChange = (value: string) => {
    setName(value)
    if (!isEditing) {
      const generatedSlug = value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
      setSlug(generatedSlug)
    }
  }

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Nome é obrigatório')
      return
    }

    if (!slug.trim()) {
      toast.error('Slug é obrigatório')
      return
    }

    setSaving(true)

    try {
      const supabase = createClient()
      let celebrityId = celebrity?.id

      if (isEditing) {
        // Update existing celebrity
        const { error } = await supabase
          .from('celebrities')
          .update({ name: name.trim(), slug: slug.trim() })
          .eq('id', celebrity.id)

        if (error) throw error
      } else {
        // Create new celebrity
        const insertData: Record<string, unknown> = {
          name: name.trim(),
          slug: slug.trim(),
          training_status: 'pending',
        }

        const { data, error } = await supabase
          .from('celebrities')
          .insert(insertData)
          .select('id')
          .single()

        if (error) throw error
        celebrityId = data.id

        // Create pack if requested
        if (createPack) {
          const { data: packData, error: packError } = await supabase
            .from('sticker_packs')
            .insert({
              name: name.trim(),
              slug: slug.trim(),
              description: `Figurinhas de ${name.trim()}`,
              pack_type: 'celebrity',
              is_active: true,
            })
            .select('id')
            .single()

          if (!packError && packData) {
            await supabase
              .from('celebrities')
              .update({ pack_id: packData.id })
              .eq('id', celebrityId)
          }
        }
      }

      // Save new photos to celebrity_photos table
      const newPhotos = photos.filter((p) => p.isNew)
      if (newPhotos.length > 0 && celebrityId) {
        const photoInserts = newPhotos.map((photo) => ({
          celebrity_id: celebrityId,
          storage_path: photo.storage_path,
          file_name: photo.file_name,
        }))

        const { error: photoError } = await supabase
          .from('celebrity_photos')
          .insert(photoInserts)

        if (photoError) {
          console.error('Error saving photos:', photoError)
          toast.error('Celebridade salva, mas houve erro ao salvar fotos')
        }
      }

      // Delete removed photos
      const removedPhotos = existingPhotos.filter(
        (ep) => !photos.find((p) => p.storage_path === ep.storage_path)
      )
      for (const photo of removedPhotos) {
        if (photo.id) {
          await supabase.from('celebrity_photos').delete().eq('id', photo.id)
          await supabase.storage.from('celebrity-training').remove([photo.storage_path])
        }
      }

      toast.success(isEditing ? 'Celebridade atualizada' : 'Celebridade criada')
      onSuccess()
      onOpenChange(false)
    } catch (error) {
      console.error('Error saving celebrity:', error)
      if (error instanceof Error) {
        toast.error(error.message)
      } else {
        toast.error('Erro ao salvar celebridade')
      }
    } finally {
      setSaving(false)
    }
  }

  const newPhotosCount = photos.filter((p) => p.isNew).length
  const canTrain = photos.length >= 3

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Celebridade' : 'Nova Celebridade'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Atualize as informações e fotos de referência.'
              : 'Crie uma nova celebridade e adicione fotos para treinamento.'}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="info">Informações</TabsTrigger>
            <TabsTrigger value="photos">
              Fotos de Referência
              {photos.length > 0 && (
                <span className="ml-2 text-xs bg-primary/20 px-1.5 py-0.5 rounded">
                  {photos.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                placeholder="Ex: Ivete Sangalo"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                disabled={saving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Slug (identificador único)</Label>
              <Input
                id="slug"
                placeholder="Ex: ivete-sangalo"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                disabled={saving || isEditing}
              />
              <p className="text-xs text-muted-foreground">
                Usado para identificação. Apenas letras minúsculas, números e hífens.
              </p>
            </div>

            {!isEditing && (
              <div className="flex items-center space-x-2 pt-2">
                <Checkbox
                  id="createPack"
                  checked={createPack}
                  onCheckedChange={(checked) => setCreatePack(checked as boolean)}
                  disabled={saving}
                />
                <Label htmlFor="createPack" className="text-sm font-normal cursor-pointer">
                  Criar pack de figurinhas automaticamente
                </Label>
              </div>
            )}

            {isEditing && celebrity?.training_status && (
              <div className="pt-2 p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <Brain className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Status do Treinamento:</span>
                  <span
                    className={`text-sm ${
                      celebrity.training_status === 'trained'
                        ? 'text-green-500'
                        : celebrity.training_status === 'failed'
                        ? 'text-red-500'
                        : celebrity.training_status === 'training'
                        ? 'text-blue-500'
                        : 'text-yellow-500'
                    }`}
                  >
                    {celebrity.training_status === 'trained'
                      ? `Treinada (${celebrity.embeddings_count || 0} embeddings)`
                      : celebrity.training_status === 'failed'
                      ? 'Falhou'
                      : celebrity.training_status === 'training'
                      ? 'Treinando...'
                      : 'Pendente'}
                  </span>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="photos" className="py-4">
            {loadingPhotos ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <PhotoUpload
                  celebritySlug={slug || 'temp'}
                  celebrityId={isEditing ? celebrity?.id : undefined}
                  photos={photos}
                  onPhotosChange={setPhotos}
                  disabled={saving || !slug}
                  maxPhotos={10}
                />

                {!canTrain && photos.length > 0 && (
                  <div className="flex items-center gap-2 mt-4 p-3 rounded-lg bg-yellow-500/10 text-yellow-500">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm">
                      Adicione pelo menos 3 fotos para habilitar o treinamento.
                    </span>
                  </div>
                )}

                {!slug && (
                  <div className="flex items-center gap-2 mt-4 p-3 rounded-lg bg-muted">
                    <AlertCircle className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Preencha o nome primeiro para habilitar o upload de fotos.
                    </span>
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : isEditing ? (
              'Salvar Alterações'
            ) : (
              'Criar Celebridade'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
