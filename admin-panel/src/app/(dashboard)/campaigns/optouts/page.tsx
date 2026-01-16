'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  ArrowLeft,
  Ban,
  Search,
  Plus,
  Trash2,
  RefreshCw,
  AlertCircle,
  User,
  Calendar,
  Loader2,
} from 'lucide-react'
import Link from 'next/link'
import { format, formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface Optout {
  id: string
  user_id: string | null
  whatsapp_number: string
  reason: string | null
  source: string | null
  opted_out_at: string
  opted_out_by: string | null
  notes: string | null
  user: {
    name: string | null
    whatsapp_number: string
  } | null
}

const reasonLabels: Record<string, { label: string; color: string }> = {
  user_requested: { label: 'Solicitado', color: 'bg-blue-500/20 text-blue-400' },
  complaint: { label: 'Reclamação', color: 'bg-red-500/20 text-red-400' },
  admin: { label: 'Admin', color: 'bg-purple-500/20 text-purple-400' },
  bounce: { label: 'Bounce', color: 'bg-yellow-500/20 text-yellow-400' },
}

export default function OptoutsPage() {
  const [optouts, setOptouts] = useState<Optout[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [total, setTotal] = useState(0)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  // Form state
  const [formNumber, setFormNumber] = useState('')
  const [formReason, setFormReason] = useState('admin')
  const [formNotes, setFormNotes] = useState('')

  const fetchOptouts = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)

      const response = await fetch(`/api/campaigns/optouts?${params}`)
      if (!response.ok) throw new Error('Failed to fetch optouts')
      const data = await response.json()
      setOptouts(data.optouts || [])
      setTotal(data.total || 0)
    } catch (error) {
      console.error('Error fetching optouts:', error)
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    fetchOptouts()
  }, [fetchOptouts])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchOptouts()
  }

  const handleAdd = async () => {
    if (!formNumber.trim()) return
    setAdding(true)
    try {
      const response = await fetch('/api/campaigns/optouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          whatsapp_number: formNumber.replace(/\D/g, ''),
          reason: formReason,
          notes: formNotes || null,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        alert(error.error || 'Erro ao adicionar opt-out')
        return
      }

      setDialogOpen(false)
      setFormNumber('')
      setFormReason('admin')
      setFormNotes('')
      fetchOptouts()
    } catch (error) {
      console.error('Error adding optout:', error)
      alert('Erro ao adicionar opt-out')
    } finally {
      setAdding(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Remover este opt-out? O usuário poderá receber campanhas novamente.')) return
    setDeleting(id)
    try {
      const response = await fetch(`/api/campaigns/optouts/${id}`, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error('Failed to delete optout')
      fetchOptouts()
    } catch (error) {
      console.error('Error deleting optout:', error)
      alert('Erro ao remover opt-out')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/campaigns">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Ban className="h-6 w-6" />
              Opt-outs de Campanhas
            </h1>
            <p className="text-muted-foreground">
              Usuários que optaram por não receber mensagens de campanhas
            </p>
          </div>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Opt-out
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Opt-out</DialogTitle>
              <DialogDescription>
                Adicionar um número à lista de opt-out. Campanhas ativas serão canceladas.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="number">Número WhatsApp</Label>
                <Input
                  id="number"
                  placeholder="5511999999999"
                  value={formNumber}
                  onChange={(e) => setFormNumber(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reason">Motivo</Label>
                <Select value={formReason} onValueChange={setFormReason}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user_requested">Solicitado pelo usuário</SelectItem>
                    <SelectItem value="complaint">Reclamação</SelectItem>
                    <SelectItem value="admin">Decisão do admin</SelectItem>
                    <SelectItem value="bounce">Bounce/Erro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Observações (opcional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Motivo detalhado..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAdd} disabled={adding || !formNumber.trim()}>
                {adding ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Adicionando...
                  </>
                ) : (
                  'Adicionar'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Info Card */}
      <Card className="border-blue-500/20 bg-blue-500/5">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-400 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-blue-400">Sobre Opt-outs</p>
              <p className="text-muted-foreground mt-1">
                Usuários com opt-out não serão inscritos em novas campanhas e terão campanhas ativas
                canceladas automaticamente. Eles ainda podem usar o bot normalmente.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por número..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="outline">
          Buscar
        </Button>
        <Button type="button" variant="outline" onClick={fetchOptouts}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </form>

      {/* Stats */}
      <div className="text-sm text-muted-foreground">
        Total: <span className="font-medium text-foreground">{total}</span> opt-outs
      </div>

      {/* List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lista de Opt-outs</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : optouts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Ban className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum opt-out encontrado</p>
            </div>
          ) : (
            <div className="space-y-2">
              {optouts.map(optout => {
                const reason = reasonLabels[optout.reason || 'admin'] || reasonLabels.admin
                return (
                  <div
                    key={optout.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                        <User className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-mono">
                          {optout.whatsapp_number.replace(/^55/, '+55 ').replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className={reason.color}>
                            {reason.label}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(optout.opted_out_at), { addSuffix: true, locale: ptBR })}
                          </span>
                          {optout.opted_out_by && (
                            <span className="text-xs text-muted-foreground">
                              por {optout.opted_out_by}
                            </span>
                          )}
                        </div>
                        {optout.notes && (
                          <p className="text-xs text-muted-foreground mt-1">{optout.notes}</p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(optout.id)}
                      disabled={deleting === optout.id}
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    >
                      {deleting === optout.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
