import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { getStickerUrl, type Sticker } from '@/lib/supabase'

export interface StickerCardProps {
  sticker: Sticker
  onClick: (sticker: Sticker) => void
  selectable?: boolean
  selected?: boolean
  onSelectionChange?: (id: string) => void
  showHoverPreview?: boolean
}

export function StickerCard({
  sticker,
  onClick,
  selectable = false,
  selected = false,
  onSelectionChange,
  showHoverPreview = true,
}: StickerCardProps) {
  const handleCardClick = (e: React.MouseEvent) => {
    // If clicking on checkbox, don't trigger card click
    if ((e.target as HTMLElement).closest('[data-checkbox]')) {
      return
    }
    onClick(sticker)
  }

  const handleCheckboxChange = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onSelectionChange) {
      onSelectionChange(sticker.id)
    }
  }

  const celebrityName = Array.isArray(sticker.celebrities)
    ? sticker.celebrities[0]?.name
    : sticker.celebrities?.name

  return (
    <Card
      className={`group cursor-pointer overflow-hidden transition-all hover:ring-2 hover:ring-primary/50 relative ${
        sticker.emotion_approved ? 'ring-1 ring-green-500/50' : ''
      } ${selected ? 'ring-2 ring-primary' : ''}`}
      onClick={handleCardClick}
    >
      {/* Checkbox overlay (top-left) */}
      {selectable && (
        <div
          className="absolute top-2 left-2 z-10"
          data-checkbox
          onClick={handleCheckboxChange}
        >
          <Checkbox checked={selected} />
        </div>
      )}

      {/* Image */}
      <div className="aspect-square bg-muted/50 p-2 flex items-center justify-center relative">
        <img
          src={getStickerUrl(sticker)}
          alt="Sticker"
          className="max-h-full max-w-full object-contain transition-transform group-hover:scale-105"
          loading="lazy"
        />

        {/* Type badge (top-right) */}
        <div className="absolute top-2 right-2">
          <Badge variant="secondary" className="text-xs">
            {sticker.tipo}
          </Badge>
        </div>
      </div>

      {/* Metadata */}
      <div className="p-3 space-y-2">
        {/* Celebrity name */}
        {celebrityName && (
          <p className="text-xs font-medium text-purple-400 truncate">
            {celebrityName}
          </p>
        )}

        {/* Emotion tags */}
        <div className="flex flex-wrap gap-1">
          {(sticker.emotion_tags || []).slice(0, 3).map((tag, i) => (
            <Badge key={i} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
          {(sticker.emotion_tags || []).length > 3 && (
            <span className="text-xs text-muted-foreground">
              +{(sticker.emotion_tags || []).length - 3}
            </span>
          )}
        </div>

        {/* Approved indicator */}
        {sticker.emotion_approved && (
          <p className="text-xs text-green-500">Aprovado</p>
        )}
      </div>
    </Card>
  )
}
