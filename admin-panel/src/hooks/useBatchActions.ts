import { useCallback } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'
import { getStickerUrl, type Sticker } from '@/lib/supabase'

export interface UseBatchActionsResult {
  approveStickers: (ids: string[]) => Promise<{ success: boolean; error?: string }>
  rejectStickers: (ids: string[]) => Promise<{ success: boolean; error?: string }>
  deleteStickers: (ids: string[], stickers: Sticker[]) => Promise<{ success: boolean; error?: string }>
  addTagsToStickers: (ids: string[], tags: string[], existingStickers: Sticker[]) => Promise<{ success: boolean; error?: string }>
  assignCelebrity: (ids: string[], celebrityId: string) => Promise<{ success: boolean; error?: string }>
}

const MAX_BATCH_SIZE = 50

export function useBatchActions(): UseBatchActionsResult {
  const approveStickers = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) {
        return { success: false, error: 'Nenhum sticker selecionado' }
      }

      if (ids.length > MAX_BATCH_SIZE) {
        return { success: false, error: `Máximo de ${MAX_BATCH_SIZE} stickers por vez` }
      }

      try {
        const supabase = getSupabaseBrowserClient()
        const { error } = await supabase
          .from('stickers')
          .update({ emotion_approved: true })
          .in('id', ids)

        if (error) throw error

        return { success: true }
      } catch (error) {
        console.error('Error approving stickers:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Erro ao aprovar stickers',
        }
      }
    },
    []
  )

  const rejectStickers = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) {
        return { success: false, error: 'Nenhum sticker selecionado' }
      }

      if (ids.length > MAX_BATCH_SIZE) {
        return { success: false, error: `Máximo de ${MAX_BATCH_SIZE} stickers por vez` }
      }

      try {
        const supabase = getSupabaseBrowserClient()
        const { error } = await supabase
          .from('stickers')
          .update({
            emotion_tags: null,
            emotion_approved: false,
          })
          .in('id', ids)

        if (error) throw error

        return { success: true }
      } catch (error) {
        console.error('Error rejecting stickers:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Erro ao rejeitar stickers',
        }
      }
    },
    []
  )

  const deleteStickers = useCallback(
    async (ids: string[], stickers: Sticker[]) => {
      if (ids.length === 0) {
        return { success: false, error: 'Nenhum sticker selecionado' }
      }

      if (ids.length > MAX_BATCH_SIZE) {
        return { success: false, error: `Máximo de ${MAX_BATCH_SIZE} stickers por vez` }
      }

      if (!confirm(`Tem certeza que deseja deletar ${ids.length} stickers? Esta ação não pode ser desfeita.`)) {
        return { success: false, error: 'Operação cancelada' }
      }

      try {
        const supabase = getSupabaseBrowserClient()
        // Delete from database first
        const { error: dbError } = await supabase
          .from('stickers')
          .delete()
          .in('id', ids)

        if (dbError) throw dbError

        // Delete from storage (best effort - don't fail if storage deletion fails)
        const stickersToDelete = stickers.filter((s) => ids.includes(s.id))
        const deletePromises = stickersToDelete.map(async (sticker) => {
          const bucket = sticker.tipo === 'estatico' ? 'stickers-estaticos' : 'stickers-animados'
          try {
            await supabase.storage.from(bucket).remove([sticker.storage_path])
          } catch (err) {
            console.warn(`Failed to delete storage file for sticker ${sticker.id}:`, err)
          }
        })

        await Promise.allSettled(deletePromises)

        return { success: true }
      } catch (error) {
        console.error('Error deleting stickers:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Erro ao deletar stickers',
        }
      }
    },
    []
  )

  const addTagsToStickers = useCallback(
    async (ids: string[], tags: string[], existingStickers: Sticker[]) => {
      if (ids.length === 0) {
        return { success: false, error: 'Nenhum sticker selecionado' }
      }

      if (tags.length === 0) {
        return { success: false, error: 'Nenhuma tag fornecida' }
      }

      if (ids.length > MAX_BATCH_SIZE) {
        return { success: false, error: `Máximo de ${MAX_BATCH_SIZE} stickers por vez` }
      }

      try {
        const supabase = getSupabaseBrowserClient()
        // Get current stickers to merge tags
        const stickersToUpdate = existingStickers.filter((s) => ids.includes(s.id))

        // Update each sticker with merged tags
        const updatePromises = stickersToUpdate.map(async (sticker) => {
          const currentTags = sticker.emotion_tags || []
          const newTags = [...new Set([...currentTags, ...tags])]

          return supabase
            .from('stickers')
            .update({ emotion_tags: newTags })
            .eq('id', sticker.id)
        })

        const results = await Promise.allSettled(updatePromises)
        const failures = results.filter((r) => r.status === 'rejected')

        if (failures.length > 0) {
          throw new Error(`Falha ao atualizar ${failures.length} stickers`)
        }

        return { success: true }
      } catch (error) {
        console.error('Error adding tags to stickers:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Erro ao adicionar tags',
        }
      }
    },
    []
  )

  const assignCelebrity = useCallback(
    async (ids: string[], celebrityId: string) => {
      if (ids.length === 0) {
        return { success: false, error: 'Nenhum sticker selecionado' }
      }

      if (ids.length > MAX_BATCH_SIZE) {
        return { success: false, error: `Máximo de ${MAX_BATCH_SIZE} stickers por vez` }
      }

      try {
        const supabase = getSupabaseBrowserClient()
        const { error } = await supabase
          .from('stickers')
          .update({ celebrity_id: celebrityId === 'none' ? null : celebrityId })
          .in('id', ids)

        if (error) throw error

        return { success: true }
      } catch (error) {
        console.error('Error assigning celebrity:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Erro ao atribuir celebridade',
        }
      }
    },
    []
  )

  return {
    approveStickers,
    rejectStickers,
    deleteStickers,
    addTagsToStickers,
    assignCelebrity,
  }
}
