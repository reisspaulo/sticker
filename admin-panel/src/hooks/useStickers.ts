import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import type { Sticker } from '@/lib/supabase'

export interface UseStickersOptions {
  tipo?: 'all' | 'estatico' | 'animado'
  search?: string
  dateFrom?: Date | null
  dateTo?: Date | null
  status?: 'pending' | 'all' | 'approved' | 'no_emotion'
  celebrityId?: string
  tagSearch?: string
  pageSize: number
  page: number
}

export interface UseStickersResult {
  stickers: Sticker[]
  loading: boolean
  error: Error | null
  totalCount: number
  refetch: () => void
}

export function useStickers(options: UseStickersOptions): UseStickersResult {
  const [stickers, setStickers] = useState<Sticker[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [totalCount, setTotalCount] = useState(0)

  const fetchStickers = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      let query = supabase
        .from('stickers')
        .select('id, storage_path, tipo, emotion_tags, emotion_approved, celebrity_id, face_detected, created_at, celebrities(name)', { count: 'exact' })

      // Filter by tipo
      if (options.tipo && options.tipo !== 'all') {
        query = query.eq('tipo', options.tipo)
      }

      // Filter by search (ID or filename)
      if (options.search && options.search.trim()) {
        const searchTerm = options.search.trim()
        query = query.or(`id.ilike.%${searchTerm}%,storage_path.ilike.%${searchTerm}%`)
      }

      // Filter by date range
      if (options.dateFrom) {
        query = query.gte('created_at', options.dateFrom.toISOString())
      }
      if (options.dateTo) {
        query = query.lte('created_at', options.dateTo.toISOString())
      }

      // Filter by status (for emotions page)
      if (options.status) {
        if (options.status === 'pending') {
          query = query.not('emotion_tags', 'is', null).or('emotion_approved.is.null,emotion_approved.eq.false')
        } else if (options.status === 'approved') {
          query = query.eq('emotion_approved', true)
        } else if (options.status === 'no_emotion') {
          query = query.is('emotion_tags', null)
        } else if (options.status === 'all') {
          query = query.not('emotion_tags', 'is', null)
        }
      }

      // Filter by celebrity
      if (options.celebrityId && options.celebrityId !== 'all') {
        query = query.eq('celebrity_id', options.celebrityId)
      }

      // Filter by tag search
      if (options.tagSearch && options.tagSearch.trim()) {
        query = query.contains('emotion_tags', [options.tagSearch.trim().toLowerCase()])
      }

      // Sort by created_at descending (newest first) or emotion_classified_at if status filter is active
      if (options.status && options.status !== 'no_emotion') {
        query = query.order('emotion_classified_at', { ascending: false, nullsFirst: false })
      } else {
        query = query.order('created_at', { ascending: false })
      }

      // Pagination
      const start = options.page * options.pageSize
      const end = start + options.pageSize - 1
      query = query.range(start, end)

      const { data, count, error: queryError } = await query

      if (queryError) {
        throw queryError
      }

      setStickers(data || [])
      setTotalCount(count || 0)
    } catch (err) {
      console.error('Error fetching stickers:', err)
      setError(err instanceof Error ? err : new Error('Unknown error'))
      setStickers([])
      setTotalCount(0)
    } finally {
      setLoading(false)
    }
  }, [
    options.tipo,
    options.search,
    options.dateFrom,
    options.dateTo,
    options.status,
    options.celebrityId,
    options.tagSearch,
    options.pageSize,
    options.page,
  ])

  useEffect(() => {
    fetchStickers()
  }, [fetchStickers])

  return {
    stickers,
    loading,
    error,
    totalCount,
    refetch: fetchStickers,
  }
}
