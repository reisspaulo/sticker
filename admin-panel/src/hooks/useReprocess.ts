'use client'

import { useState, useCallback } from 'react'

interface ReprocessCounts {
  unrecognized: number
  pack: number
  total_with_face: number
}

interface ReprocessResult {
  success: boolean
  stickers_affected: number
  mode: string
}

interface UseReprocessOptions {
  celebrityId: string | null
}

export function useReprocess({ celebrityId }: UseReprocessOptions) {
  const [counts, setCounts] = useState<ReprocessCounts | null>(null)
  const [loading, setLoading] = useState(false)
  const [reprocessing, setReprocessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchCounts = useCallback(async () => {
    if (!celebrityId) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/celebrities/${celebrityId}/reprocess`)

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to fetch counts')
      }

      const data = await response.json()
      setCounts(data.counts)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [celebrityId])

  const reprocess = useCallback(async (mode: 'unrecognized' | 'pack' | 'all' = 'unrecognized'): Promise<ReprocessResult> => {
    if (!celebrityId) return { success: false, stickers_affected: 0, mode }

    setReprocessing(true)
    setError(null)

    try {
      const response = await fetch(`/api/celebrities/${celebrityId}/reprocess`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reprocess')
      }

      // Refresh counts after reprocessing
      await fetchCounts()

      return {
        success: true,
        stickers_affected: data.stickers_affected,
        mode: data.mode,
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      return { success: false, stickers_affected: 0, mode }
    } finally {
      setReprocessing(false)
    }
  }, [celebrityId, fetchCounts])

  return {
    counts,
    loading,
    reprocessing,
    error,
    fetchCounts,
    reprocess,
  }
}
