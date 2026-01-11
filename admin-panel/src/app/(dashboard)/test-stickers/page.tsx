'use client'

import { useState } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useStickers } from '@/hooks/useStickers'

const PAGE_SIZE = 30

export default function TestStickersPage() {
  const [page, setPage] = useState(0)
  const [tipo, setTipo] = useState<'all' | 'estatico' | 'animado'>('all')

  // Test useStickers hook
  const { stickers, loading, totalCount } = useStickers({
    tipo,
    search: '',
    dateFrom: null,
    dateTo: null,
    pageSize: PAGE_SIZE,
    page,
  })

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">Test Stickers Page</h1>

      <Select value={tipo} onValueChange={(v) => setTipo(v as 'all' | 'estatico' | 'animado')}>
        <SelectTrigger className="w-[140px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          <SelectItem value="estatico">Estático</SelectItem>
          <SelectItem value="animado">Animado</SelectItem>
        </SelectContent>
      </Select>

      <div>
        <p>Loading: {loading ? 'Yes' : 'No'}</p>
        <p>Total: {totalCount}</p>
        <p>Stickers count: {stickers.length}</p>
        <p>Tipo: {tipo}</p>
        <p>Page: {page}</p>
      </div>
    </div>
  )
}
