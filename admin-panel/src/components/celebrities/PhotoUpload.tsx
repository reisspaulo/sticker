'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { createClient } from '@/utils/supabase/client'
import { Button } from '@/components/ui/button'
import { X, Upload, Image as ImageIcon, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export interface UploadedPhoto {
  id?: string
  storage_path: string
  file_name: string
  url: string
  isNew?: boolean
}

interface PhotoUploadProps {
  celebritySlug: string
  photos: UploadedPhoto[]
  onPhotosChange: (photos: UploadedPhoto[]) => void
  disabled?: boolean
  maxPhotos?: number
}

export function PhotoUpload({
  celebritySlug,
  photos,
  onPhotosChange,
  disabled = false,
  maxPhotos = 10,
}: PhotoUploadProps) {
  const [uploading, setUploading] = useState(false)

  const uploadFile = async (file: File): Promise<UploadedPhoto | null> => {
    const supabase = createClient()

    // Generate unique filename
    const timestamp = Date.now()
    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const fileName = `${celebritySlug}_${timestamp}.${extension}`
    const storagePath = `${celebritySlug}/${fileName}`

    try {
      const { error } = await supabase.storage
        .from('celebrity-training')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false,
        })

      if (error) throw error

      // Get public URL (bucket is private, but we can generate signed URLs)
      const { data: urlData } = await supabase.storage
        .from('celebrity-training')
        .createSignedUrl(storagePath, 3600) // 1 hour expiry

      return {
        storage_path: storagePath,
        file_name: file.name,
        url: urlData?.signedUrl || '',
        isNew: true,
      }
    } catch (error) {
      console.error('Error uploading file:', error)
      toast.error(`Erro ao fazer upload de ${file.name}`)
      return null
    }
  }

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (disabled) return

      const remainingSlots = maxPhotos - photos.length
      if (remainingSlots <= 0) {
        toast.error(`Máximo de ${maxPhotos} fotos permitido`)
        return
      }

      const filesToUpload = acceptedFiles.slice(0, remainingSlots)

      if (filesToUpload.length < acceptedFiles.length) {
        toast.warning(`Apenas ${remainingSlots} foto(s) podem ser adicionadas`)
      }

      setUploading(true)

      const uploadPromises = filesToUpload.map(uploadFile)
      const results = await Promise.all(uploadPromises)
      const successfulUploads = results.filter((r): r is UploadedPhoto => r !== null)

      if (successfulUploads.length > 0) {
        onPhotosChange([...photos, ...successfulUploads])
        toast.success(`${successfulUploads.length} foto(s) enviada(s)`)
      }

      setUploading(false)
    },
    [photos, onPhotosChange, celebritySlug, disabled, maxPhotos]
  )

  const removePhoto = async (photo: UploadedPhoto) => {
    if (disabled) return

    // If it's a new photo, remove from storage
    if (photo.isNew) {
      const supabase = createClient()
      await supabase.storage.from('celebrity-training').remove([photo.storage_path])
    }

    onPhotosChange(photos.filter((p) => p.storage_path !== photo.storage_path))
    toast.success('Foto removida')
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
    },
    disabled: disabled || uploading || photos.length >= maxPhotos,
    maxSize: 5 * 1024 * 1024, // 5MB
  })

  return (
    <div className="space-y-4">
      {/* Photo Grid */}
      {photos.length > 0 && (
        <div className="grid grid-cols-5 gap-3">
          {photos.map((photo, index) => (
            <div
              key={photo.storage_path}
              className="relative aspect-square rounded-lg overflow-hidden border bg-muted group"
            >
              <img
                src={photo.url}
                alt={`Foto ${index + 1}`}
                className="w-full h-full object-cover"
              />
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removePhoto(photo)}
                  className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
              {photo.isNew && (
                <span className="absolute bottom-1 left-1 text-[10px] bg-green-500 text-white px-1.5 py-0.5 rounded">
                  Nova
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Dropzone */}
      {photos.length < maxPhotos && (
        <div
          {...getRootProps()}
          className={cn(
            'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors',
            isDragActive
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 hover:border-primary/50',
            (disabled || uploading) && 'opacity-50 cursor-not-allowed'
          )}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center gap-2">
            {uploading ? (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Enviando...</p>
              </>
            ) : isDragActive ? (
              <>
                <Upload className="h-8 w-8 text-primary" />
                <p className="text-sm text-primary">Solte as fotos aqui</p>
              </>
            ) : (
              <>
                <ImageIcon className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Arraste fotos ou clique para selecionar
                </p>
                <p className="text-xs text-muted-foreground">
                  JPG, PNG ou WebP • Máx 5MB • {photos.length}/{maxPhotos} fotos
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Info */}
      <p className="text-xs text-muted-foreground">
        Use 3-5 fotos com o rosto visível e em diferentes ângulos para melhor reconhecimento.
      </p>
    </div>
  )
}
