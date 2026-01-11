'use client'

import { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { StickerGrid } from '@/components/stickers/StickerGrid'
import { StickerFilters, type StickerFiltersConfig } from '@/components/stickers/StickerFilters'
import { BatchActionsBar } from '@/components/stickers/BatchActionsBar'
import { useStickers } from '@/hooks/useStickers'
import { useStickerSelection } from '@/hooks/useStickerSelection'
import { useBatchActions } from '@/hooks/useBatchActions'
import { createClient } from '@/utils/supabase/client'
import type { Sticker, Celebrity } from '@/lib/supabase'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TooltipProvider } from '@/components/ui/tooltip'
import { toast } from 'sonner'

const PAGE_SIZE = 30

export default function StickersPage() {
  const [filters, setFilters] = useState<StickerFiltersConfig>({
    tipo: 'all',
    search: '',
    dateFrom: null,
    dateTo: null,
  })
  const [page, setPage] = useState(0)
  const [batchMode, setBatchMode] = useState(false)

  // Batch actions dialogs
  const [addTagsDialog, setAddTagsDialog] = useState(false)
  const [newTags, setNewTags] = useState('')
  const [assignCelebrityDialog, setAssignCelebrityDialog] = useState(false)
  const [selectedCelebrityId, setSelectedCelebrityId] = useState<string>('none')
  const [celebrities, setCelebrities] = useState<Celebrity[]>([])

  // Load celebrities
  useEffect(() => {
    const supabase = createClient()
    async function loadCelebrities() {
      const { data } = await supabase
        .from('celebrities')
        .select('id, name, slug')
        .order('name')
      if (data) setCelebrities(data)
    }
    loadCelebrities()
  }, [])

  // Hooks
  const stickerOptions = useMemo(() => ({
    tipo: filters.tipo,
    search: filters.search,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    pageSize: PAGE_SIZE,
    page,
  }), [filters.tipo, filters.search, filters.dateFrom, filters.dateTo, page])

  const { stickers, loading, totalCount, refetch } = useStickers(stickerOptions)

  const stickerIds = useMemo(() => stickers.map((s) => s.id), [stickers])

  const { selectedIds, toggleSelection, selectAll, clearSelection, isSelected } =
    useStickerSelection(stickerIds)

  const batchActions = useBatchActions()

  // Pagination
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  // Handlers
  const handleStickerClick = (sticker: Sticker) => {
    if (batchMode) {
      toggleSelection(sticker.id)
    } else {
      // Open detail modal (to be implemented)
      console.log('Open detail for:', sticker.id)
    }
  }

  const handleBatchAction = async (action: string) => {
    let result: { success: boolean; error?: string } | undefined

    switch (action) {
      case 'approve':
        result = await batchActions.approveStickers(selectedIds)
        break

      case 'reject':
        result = await batchActions.rejectStickers(selectedIds)
        break

      case 'delete':
        result = await batchActions.deleteStickers(selectedIds, stickers)
        break

      case 'addTags':
        setAddTagsDialog(true)
        return

      case 'assignCelebrity':
        setAssignCelebrityDialog(true)
        return

      default:
        return
    }

    if (result) {
      if (result.success) {
        toast.success('Ação executada com sucesso.')
        clearSelection()
        refetch()
      } else {
        toast.error(result.error || 'Erro ao executar ação.')
      }
    }
  }

  const handleAddTags = async () => {
    const tags = newTags
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0)

    if (tags.length === 0) {
      toast.error('Digite pelo menos uma tag.')
      return
    }

    const result = await batchActions.addTagsToStickers(selectedIds, tags, stickers)

    if (result.success) {
      toast.success(`Tags adicionadas a ${selectedIds.length} stickers.`)
      setAddTagsDialog(false)
      setNewTags('')
      clearSelection()
      refetch()
    } else {
      toast.error(result.error || 'Erro ao adicionar tags.')
    }
  }

  const handleAssignCelebrity = async () => {
    const result = await batchActions.assignCelebrity(selectedIds, selectedCelebrityId)

    if (result.success) {
      const celebName = celebrities.find(c => c.id === selectedCelebrityId)?.name || 'celebridade'
      toast.success(`${selectedIds.length} stickers atribuídos a ${celebName}.`)
      setAssignCelebrityDialog(false)
      setSelectedCelebrityId('none')
      clearSelection()
      refetch()
    } else {
      toast.error(result.error || 'Erro ao atribuir celebridade.')
    }
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Todos os Stickers</h1>
          <Button
            variant={batchMode ? 'default' : 'outline'}
            onClick={() => {
              setBatchMode(!batchMode)
              if (batchMode) {
                clearSelection()
              }
            }}
          >
            {batchMode ? 'Sair do modo seleção' : 'Selecionar múltiplos'}
          </Button>
        </div>

      {/* Filters */}
      <StickerFilters
        filters={filters}
        onFilterChange={(newFilters) => {
          setFilters(newFilters)
          setPage(0) // Reset to first page when filters change
        }}
        stats={{ total: totalCount }}
        showEmotionFilters={false}
        onRefresh={refetch}
      />

      {/* Grid */}
      <StickerGrid
        stickers={stickers}
        loading={loading}
        onStickerClick={handleStickerClick}
        selectable={batchMode}
        selectedIds={selectedIds}
        onSelectionChange={toggleSelection}
        showHoverPreview={!batchMode}
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground px-4">
            Página {page + 1} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
          >
            Próximo
          </Button>
        </div>
      )}

      {/* Batch Actions Bar */}
      {batchMode && selectedIds.length > 0 && (
        <BatchActionsBar
          selectedCount={selectedIds.length}
          onAction={handleBatchAction}
          onClearSelection={clearSelection}
          onSelectAll={selectAll}
        />
      )}

      {/* Add Tags Dialog */}
      <Dialog open={addTagsDialog} onOpenChange={setAddTagsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Tags</DialogTitle>
            <DialogDescription>
              Adicione tags aos {selectedIds.length} stickers selecionados. Separe múltiplas tags
              com vírgula.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="tags">Tags (separadas por vírgula)</Label>
              <Input
                id="tags"
                placeholder="feliz, animada, rindo"
                value={newTags}
                onChange={(e) => setNewTags(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddTagsDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddTags}>Adicionar Tags</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Celebrity Dialog */}
      <Dialog open={assignCelebrityDialog} onOpenChange={setAssignCelebrityDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atribuir Celebridade</DialogTitle>
            <DialogDescription>
              Atribua uma celebridade aos {selectedIds.length} stickers selecionados.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="celebrity">Celebridade</Label>
              <Select value={selectedCelebrityId} onValueChange={setSelectedCelebrityId}>
                <SelectTrigger id="celebrity">
                  <SelectValue placeholder="Selecione uma celebridade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma (remover celebridade)</SelectItem>
                  {celebrities.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {celebrities.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Nenhuma celebridade cadastrada. Crie uma em Stickers → Celebridades.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignCelebrityDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAssignCelebrity} disabled={celebrities.length === 0}>
              Atribuir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </TooltipProvider>
  )
}
