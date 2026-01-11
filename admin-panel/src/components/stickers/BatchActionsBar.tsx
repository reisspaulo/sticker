import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ChevronDown } from 'lucide-react'

export interface BatchActionsBarProps {
  selectedCount: number
  selectedOnCurrentPage?: number
  onAction: (action: string, params?: unknown) => void
  onClearSelection: () => void
  onSelectAll: () => void
}

export function BatchActionsBar({
  selectedCount,
  selectedOnCurrentPage,
  onAction,
  onClearSelection,
  onSelectAll,
}: BatchActionsBarProps) {
  const hasSelectionsFromOtherPages = selectedOnCurrentPage !== undefined && selectedOnCurrentPage < selectedCount

  return (
    <div className="fixed bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50">
      <div className="container flex items-center justify-between py-3 px-4 lg:px-6">
        {/* Selection count */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">
            {selectedCount} selecionado{selectedCount !== 1 ? 's' : ''}
            {hasSelectionsFromOtherPages && (
              <span className="text-muted-foreground ml-1">
                ({selectedOnCurrentPage} nesta página)
              </span>
            )}
          </span>
          <Button variant="ghost" size="sm" onClick={onClearSelection}>
            Limpar seleção
          </Button>
          <Button variant="ghost" size="sm" onClick={onSelectAll}>
            Selecionar página
          </Button>
        </div>

        {/* Actions dropdown */}
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                Ações em lote
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => onAction('approve')}>
                Aprovar selecionados
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAction('reject')}>
                Rejeitar selecionados
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAction('addTags')}>
                Adicionar tags
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAction('assignCelebrity')}>
                Atribuir celebridade
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onAction('delete')}
                className="text-destructive focus:text-destructive"
              >
                Deletar selecionados
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  )
}
