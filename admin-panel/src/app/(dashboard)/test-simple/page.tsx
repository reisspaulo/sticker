'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export default function TestSimplePage() {
  const [tipo, setTipo] = useState('all')

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">Test Page</h1>

      <Select value={tipo} onValueChange={setTipo}>
        <SelectTrigger className="w-[140px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          <SelectItem value="estatico">Estático</SelectItem>
          <SelectItem value="animado">Animado</SelectItem>
        </SelectContent>
      </Select>

      <Button onClick={() => console.log('tipo:', tipo)}>
        Log Tipo
      </Button>

      <div>Selected: {tipo}</div>
    </div>
  )
}
