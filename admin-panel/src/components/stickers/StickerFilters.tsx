import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { Calendar as CalendarIcon } from 'lucide-react'
import { format } from 'date-fns'
import type { Celebrity } from '@/lib/supabase'

export interface StickerFiltersConfig {
  tipo: 'all' | 'estatico' | 'animado'
  search: string
  dateFrom: Date | null
  dateTo: Date | null
  status?: 'pending' | 'all' | 'approved' | 'no_emotion'
  celebrityId?: string
  tagSearch?: string
}

export interface StickerFiltersProps {
  filters: StickerFiltersConfig
  onFilterChange: (filters: StickerFiltersConfig) => void
  stats: { total: number }
  showEmotionFilters?: boolean
  celebrities?: Celebrity[]
  onRefresh?: () => void
}

export function StickerFilters({
  filters,
  onFilterChange,
  stats,
  showEmotionFilters = false,
  celebrities = [],
  onRefresh,
}: StickerFiltersProps) {
  const updateFilter = <K extends keyof StickerFiltersConfig>(
    key: K,
    value: StickerFiltersConfig[K]
  ) => {
    onFilterChange({ ...filters, [key]: value })
  }

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center gap-3">
        {/* Tipo Filter */}
        <Select
          value={filters.tipo}
          onValueChange={(v) => updateFilter('tipo', v as 'all' | 'estatico' | 'animado')}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="estatico">Estático</SelectItem>
            <SelectItem value="animado">Animado</SelectItem>
          </SelectContent>
        </Select>

        {/* Search Filter */}
        <Input
          placeholder="Buscar ID ou arquivo..."
          value={filters.search}
          onChange={(e) => updateFilter('search', e.target.value)}
          className="w-[200px]"
        />

        {/* Date From */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-[160px] justify-start text-left font-normal">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {filters.dateFrom ? format(filters.dateFrom, 'dd/MM/yyyy') : 'Data início'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={filters.dateFrom || undefined}
              onSelect={(date) => updateFilter('dateFrom', date || null)}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        {/* Date To */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-[160px] justify-start text-left font-normal">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {filters.dateTo ? format(filters.dateTo, 'dd/MM/yyyy') : 'Data fim'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={filters.dateTo || undefined}
              onSelect={(date) => updateFilter('dateTo', date || null)}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        {/* Clear Date Filters */}
        {(filters.dateFrom || filters.dateTo) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              updateFilter('dateFrom', null)
              updateFilter('dateTo', null)
            }}
          >
            Limpar datas
          </Button>
        )}

        {/* Emotion-specific filters */}
        {showEmotionFilters && (
          <>
            {/* Status Filter */}
            <Select
              value={filters.status || 'all'}
              onValueChange={(v) => updateFilter('status', v as 'pending' | 'all' | 'approved' | 'no_emotion')}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pendentes de revisão</SelectItem>
                <SelectItem value="all">Todos com emoção</SelectItem>
                <SelectItem value="approved">Aprovados</SelectItem>
                <SelectItem value="no_emotion">Sem emoção</SelectItem>
              </SelectContent>
            </Select>

            {/* Celebrity Filter */}
            <Select
              value={filters.celebrityId || 'all'}
              onValueChange={(v) => updateFilter('celebrityId', v)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Todas celebridades" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas celebridades</SelectItem>
                {celebrities.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Tag Search */}
            <Input
              placeholder="Buscar tag..."
              value={filters.tagSearch || ''}
              onChange={(e) => updateFilter('tagSearch', e.target.value)}
              className="w-[160px]"
            />
          </>
        )}

        {/* Stats and Refresh */}
        <span className="ml-auto text-sm text-muted-foreground">
          {stats.total} stickers
        </span>

        {onRefresh && (
          <Button variant="outline" size="sm" onClick={onRefresh}>
            Atualizar
          </Button>
        )}
      </div>
    </Card>
  )
}
