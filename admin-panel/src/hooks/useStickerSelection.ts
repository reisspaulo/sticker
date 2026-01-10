import { useState, useCallback, useEffect } from 'react'

export interface UseStickerSelectionResult {
  selectedIds: string[]
  toggleSelection: (id: string) => void
  selectAll: () => void
  clearSelection: () => void
  isSelected: (id: string) => boolean
}

export function useStickerSelection(availableIds: string[]): UseStickerSelectionResult {
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  // Clear selection when available IDs change (e.g., page change)
  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => availableIds.includes(id)))
  }, [availableIds])

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((selectedId) => selectedId !== id)
      } else {
        return [...prev, id]
      }
    })
  }, [])

  const selectAll = useCallback(() => {
    setSelectedIds([...availableIds])
  }, [availableIds])

  const clearSelection = useCallback(() => {
    setSelectedIds([])
  }, [])

  const isSelected = useCallback(
    (id: string) => {
      return selectedIds.includes(id)
    },
    [selectedIds]
  )

  return {
    selectedIds,
    toggleSelection,
    selectAll,
    clearSelection,
    isSelected,
  }
}
