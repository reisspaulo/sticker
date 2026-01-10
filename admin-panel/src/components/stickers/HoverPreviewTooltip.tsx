import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Badge } from '@/components/ui/badge'
import { getStickerUrl, type Sticker } from '@/lib/supabase'
import { format } from 'date-fns'

export interface HoverPreviewTooltipProps {
  sticker: Sticker
  children: React.ReactNode
}

export function HoverPreviewTooltip({ sticker, children }: HoverPreviewTooltipProps) {
  const celebrityName = Array.isArray(sticker.celebrities)
    ? sticker.celebrities[0]?.name
    : sticker.celebrities?.name

  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side="right" className="w-80 p-0" sideOffset={10}>
          <div className="space-y-3 p-4">
            {/* Large preview image */}
            <div className="relative h-64 bg-muted/50 rounded-lg overflow-hidden">
              <img
                src={getStickerUrl(sticker)}
                alt="Preview"
                className="w-full h-full object-contain"
              />
            </div>

            {/* Metadata */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">ID:</span>
                <code className="text-xs">{sticker.id.slice(0, 8)}...</code>
              </div>

              <div className="flex justify-between">
                <span className="text-muted-foreground">Tipo:</span>
                <Badge variant="secondary">{sticker.tipo}</Badge>
              </div>

              {celebrityName && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Celebridade:</span>
                  <span className="truncate ml-2">{celebrityName}</span>
                </div>
              )}

              {sticker.created_at && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Criado:</span>
                  <span>{format(new Date(sticker.created_at), 'dd/MM/yyyy')}</span>
                </div>
              )}

              {sticker.emotion_tags && sticker.emotion_tags.length > 0 && (
                <div>
                  <span className="text-muted-foreground">Tags:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {sticker.emotion_tags.map((tag, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {sticker.storage_path && (
                <div>
                  <span className="text-muted-foreground">Arquivo:</span>
                  <code className="text-xs block mt-1 truncate">
                    {sticker.storage_path}
                  </code>
                </div>
              )}
            </div>
          </div>
        </TooltipContent>
    </Tooltip>
  )
}
