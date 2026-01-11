import { useState, useCallback } from 'react'

export interface UseStickerSelectionResult {
  selectedIds: string[]
  toggleSelection: (id: string) => void
  selectAll: () => void
  selectAllOnPage: () => void
  clearSelection: () => void
  isSelected: (id: string) => boolean
  selectedOnCurrentPage: number
}

export function useStickerSelection(availableIds: string[]): UseStickerSelectionResult {
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  // Count how many selected items are on current page
  const selectedOnCurrentPage = selectedIds.filter((id) => availableIds.includes(id)).length

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
    // Add all available IDs to selection (keeps existing selections from other pages)
    setSelectedIds((prev) => {
      const newIds = availableIds.filter((id) => !prev.includes(id))
      return [...prev, ...newIds]
    })
  }, [availableIds])

  const selectAllOnPage = useCallback(() => {
    // Select all on current page (same as selectAll but clearer name)
    setSelectedIds((prev) => {
      const newIds = availableIds.filter((id) => !prev.includes(id))
      return [...prev, ...newIds]
    })
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
    selectAllOnPage,
    clearSelection,
    isSelected,
    selectedOnCurrentPage,
  }
}
