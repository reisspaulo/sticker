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
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'
import type { Celebrity } from '@/lib/supabase'
import { toast } from 'sonner'

interface CelebrityDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  celebrity?: Celebrity | null
  onSuccess: () => void
}

export function CelebrityDialog({ open, onOpenChange, celebrity, onSuccess }: CelebrityDialogProps) {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [saving, setSaving] = useState(false)

  const supabase = getSupabaseBrowserClient()
  const isEditing = !!celebrity

  // Reset form when dialog opens/closes or celebrity changes
  useEffect(() => {
    if (open) {
      if (celebrity) {
        setName(celebrity.name)
        setSlug(celebrity.slug)
      } else {
        setName('')
        setSlug('')
      }
    }
  }, [open, celebrity])

  // Auto-generate slug from name
  const handleNameChange = (value: string) => {
    setName(value)
    if (!isEditing) {
      // Only auto-generate slug when creating (not editing)
      const generatedSlug = value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove accents
        .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with -
        .replace(/^-+|-+$/g, '') // Remove leading/trailing -
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
      if (isEditing) {
        // Update existing celebrity
        const { error } = await supabase
          .from('celebrities')
          .update({ name: name.trim(), slug: slug.trim() })
          .eq('id', celebrity.id)

        if (error) throw error

        toast.success('Celebridade atualizada com sucesso')
      } else {
        // Create new celebrity
        const { error } = await supabase
          .from('celebrities')
          .insert({ name: name.trim(), slug: slug.trim() })

        if (error) throw error

        toast.success('Celebridade criada com sucesso')
      }

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Celebridade' : 'Nova Celebridade'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Atualize as informações da celebridade.'
              : 'Crie uma nova celebridade para atribuir aos stickers.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
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
              disabled={saving}
            />
            <p className="text-xs text-muted-foreground">
              Usado para URLs e identificação. Apenas letras minúsculas, números e hífens.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : isEditing ? 'Atualizar' : 'Criar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
