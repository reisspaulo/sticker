import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { StickerCard } from './StickerCard'
import { HoverPreviewTooltip } from './HoverPreviewTooltip'
import type { Sticker } from '@/lib/supabase'

export interface StickerGridProps {
  stickers: Sticker[]
  loading: boolean
  onStickerClick: (sticker: Sticker) => void
  selectable?: boolean
  selectedIds?: string[]
  onSelectionChange?: (id: string) => void
  showHoverPreview?: boolean
}

export function StickerGrid({
  stickers,
  loading,
  onStickerClick,
  selectable = false,
  selectedIds = [],
  onSelectionChange,
  showHoverPreview = true,
}: StickerGridProps) {
  // Loading state
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {Array.from({ length: 12 }).map((_, i) => (
          <Card key={i} className="overflow-hidden">
            <Skeleton className="aspect-square" />
            <div className="p-3 space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-5 w-full" />
            </div>
          </Card>
        ))}
      </div>
    )
  }

  // Empty state
  if (stickers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="text-muted-foreground">Nenhum sticker encontrado</div>
        <p className="mt-2 text-sm text-muted-foreground/60">
          Tente ajustar os filtros
        </p>
      </div>
    )
  }

  // Grid with stickers
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {stickers.map((sticker) => {
        const card = (
          <StickerCard
            key={sticker.id}
            sticker={sticker}
            onClick={onStickerClick}
            selectable={selectable}
            selected={selectedIds.includes(sticker.id)}
            onSelectionChange={onSelectionChange}
            showHoverPreview={showHoverPreview}
          />
        )

        // Wrap in hover preview tooltip if enabled
        if (showHoverPreview && !selectable) {
          return (
            <HoverPreviewTooltip key={sticker.id} sticker={sticker}>
              {card}
            </HoverPreviewTooltip>
          )
        }

        return card
      })}
    </div>
  )
}
