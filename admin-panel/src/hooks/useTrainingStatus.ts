'use client'

import { useState, useEffect, useCallback } from 'react'

interface TrainingStatus {
  id: string
  slug: string
  name: string
  training_status: 'pending' | 'training' | 'trained' | 'failed'
  training_error: string | null
  last_trained_at: string | null
  embeddings_count: number
  photos_count: number
}

interface UseTrainingStatusOptions {
  celebrityId: string | null
  enabled?: boolean
  pollInterval?: number
}

export function useTrainingStatus({
  celebrityId,
  enabled = true,
  pollInterval = 3000,
}: UseTrainingStatusOptions) {
  const [status, setStatus] = useState<TrainingStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchStatus = useCallback(async () => {
    if (!celebrityId) return

    try {
      const response = await fetch(`/api/celebrities/${celebrityId}/train`)

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to fetch status')
      }

      const data = await response.json()
      setStatus(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
  }, [celebrityId])

  const startTraining = useCallback(async () => {
    if (!celebrityId) return { success: false, error: 'No celebrity ID' }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/celebrities/${celebrityId}/train`, {
        method: 'POST',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start training')
      }

      // Immediately fetch new status
      await fetchStatus()

      return { success: true, data }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      setLoading(false)
    }
  }, [celebrityId, fetchStatus])

  // Initial fetch
  useEffect(() => {
    if (enabled && celebrityId) {
      fetchStatus()
    }
  }, [enabled, celebrityId, fetchStatus])

  // Polling when training is in progress
  useEffect(() => {
    if (!enabled || !celebrityId || status?.training_status !== 'training') {
      return
    }

    const interval = setInterval(fetchStatus, pollInterval)
    return () => clearInterval(interval)
  }, [enabled, celebrityId, status?.training_status, pollInterval, fetchStatus])

  return {
    status,
    loading,
    error,
    startTraining,
    refetch: fetchStatus,
    isTraining: status?.training_status === 'training',
    canTrain: (status?.photos_count || 0) >= 3,
  }
}
