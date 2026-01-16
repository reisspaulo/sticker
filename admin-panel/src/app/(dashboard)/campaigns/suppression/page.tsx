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
  ShieldBan,
  Plus,
  Trash2,
  RefreshCw,
  AlertTriangle,
  Loader2,
  Scale,
  MessageSquareWarning,
  Crown,
  TestTube,
  Handshake,
  HelpCircle,
} from 'lucide-react'
import Link from 'next/link'
import { format, formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface Suppression {
  id: string
  whatsapp_number: string
  reason: string
  description: string | null
  added_by: string
  added_at: string
  expires_at: string | null
}

const reasonConfig: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  legal: { label: 'Legal', color: 'bg-red-500/20 text-red-400', icon: Scale },
  complaint: { label: 'Reclamação', color: 'bg-orange-500/20 text-orange-400', icon: MessageSquareWarning },
  vip: { label: 'VIP', color: 'bg-purple-500/20 text-purple-400', icon: Crown },
  test: { label: 'Teste', color: 'bg-blue-500/20 text-blue-400', icon: TestTube },
  partner: { label: 'Parceiro', color: 'bg-green-500/20 text-green-400', icon: Handshake },
  other: { label: 'Outro', color: 'bg-zinc-500/20 text-zinc-400', icon: HelpCircle },
}

export default function SuppressionPage() {
  const [suppressions, setSuppressions] = useState<Suppression[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [reasonFilter, setReasonFilter] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  // Form state
  const [formNumber, setFormNumber] = useState('')
  const [formReason, setFormReason] = useState('other')
  const [formDescription, setFormDescription] = useState('')
  const [formExpires, setFormExpires] = useState('')

  const fetchSuppressions = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (reasonFilter !== 'all') params.set('reason', reasonFilter)

      const response = await fetch(`/api/campaigns/suppression?${params}`)
      if (!response.ok) throw new Error('Failed to fetch suppressions')
      const data = await response.json()
      setSuppressions(data.suppressions || [])
      setTotal(data.total || 0)
    } catch (error) {
      console.error('Error fetching suppressions:', error)
    } finally {
      setLoading(false)
    }
  }, [reasonFilter])

  useEffect(() => {
    fetchSuppressions()
  }, [fetchSuppressions])

  const handleAdd = async () => {
    if (!formNumber.trim() || !formReason) return
    setAdding(true)
    try {
      const response = await fetch('/api/campaigns/suppression', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          whatsapp_number: formNumber.replace(/\D/g, ''),
          reason: formReason,
          description: formDescription || null,
          expires_at: formExpires ? new Date(formExpires).toISOString() : null,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        alert(error.error || 'Erro ao adicionar à lista')
        return
      }

      setDialogOpen(false)
      setFormNumber('')
      setFormReason('other')
      setFormDescription('')
      setFormExpires('')
      fetchSuppressions()
    } catch (error) {
      console.error('Error adding suppression:', error)
      alert('Erro ao adicionar à lista')
    } finally {
      setAdding(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Remover este número da lista de supressão?')) return
    setDeleting(id)
    try {
      const response = await fetch(`/api/campaigns/suppression/${id}`, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error('Failed to delete suppression')
      fetchSuppressions()
    } catch (error) {
      console.error('Error deleting suppression:', error)
      alert('Erro ao remover da lista')
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
              <ShieldBan className="h-6 w-6" />
              Lista de Supressão
            </h1>
            <p className="text-muted-foreground">
              Números que nunca devem receber campanhas
            </p>
          </div>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Número
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar à Lista de Supressão</DialogTitle>
              <DialogDescription>
                Números nesta lista nunca receberão campanhas, independente de outras configurações.
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
                    <SelectItem value="legal">Legal (processo, advogado)</SelectItem>
                    <SelectItem value="complaint">Reclamação grave</SelectItem>
                    <SelectItem value="vip">VIP (não incomodar)</SelectItem>
                    <SelectItem value="test">Teste interno</SelectItem>
                    <SelectItem value="partner">Parceiro comercial</SelectItem>
                    <SelectItem value="other">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  placeholder="Detalhes do motivo..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expires">Expira em (opcional)</Label>
                <Input
                  id="expires"
                  type="date"
                  value={formExpires}
                  onChange={(e) => setFormExpires(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Deixe em branco para permanente
                </p>
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

      {/* Warning Card */}
      <Card className="border-red-500/20 bg-red-500/5">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-red-400">Lista de Supressão</p>
              <p className="text-muted-foreground mt-1">
                Use esta lista para casos sérios: processos judiciais, reclamações graves, parceiros,
                ou números de teste. Números aqui nunca receberão campanhas, mesmo que não tenham
                feito opt-out.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filter */}
      <div className="flex items-center gap-4">
        <Select value={reasonFilter} onValueChange={setReasonFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filtrar por motivo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os motivos</SelectItem>
            <SelectItem value="legal">Legal</SelectItem>
            <SelectItem value="complaint">Reclamação</SelectItem>
            <SelectItem value="vip">VIP</SelectItem>
            <SelectItem value="test">Teste</SelectItem>
            <SelectItem value="partner">Parceiro</SelectItem>
            <SelectItem value="other">Outro</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={fetchSuppressions}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
        <span className="text-sm text-muted-foreground">
          Total: <span className="font-medium text-foreground">{total}</span> números
        </span>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(reasonConfig).map(([key, config]) => {
          const Icon = config.icon
          return (
            <Badge key={key} variant="secondary" className={config.color}>
              <Icon className="h-3 w-3 mr-1" />
              {config.label}
            </Badge>
          )
        })}
      </div>

      {/* List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Números Suprimidos</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : suppressions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ShieldBan className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum número na lista de supressão</p>
            </div>
          ) : (
            <div className="space-y-2">
              {suppressions.map(suppression => {
                const reason = reasonConfig[suppression.reason] || reasonConfig.other
                const ReasonIcon = reason.icon
                const isExpired = suppression.expires_at && new Date(suppression.expires_at) < new Date()

                return (
                  <div
                    key={suppression.id}
                    className={`flex items-center justify-between p-4 border rounded-lg ${isExpired ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center ${reason.color}`}>
                        <ReasonIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-mono">
                            {suppression.whatsapp_number.replace(/^55/, '+55 ').replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')}
                          </p>
                          <Badge variant="secondary" className={reason.color}>
                            {reason.label}
                          </Badge>
                          {isExpired && (
                            <Badge variant="outline" className="text-yellow-400 border-yellow-400/30">
                              Expirado
                            </Badge>
                          )}
                        </div>
                        {suppression.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {suppression.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <span>
                            Adicionado {formatDistanceToNow(new Date(suppression.added_at), { addSuffix: true, locale: ptBR })}
                          </span>
                          <span>por {suppression.added_by}</span>
                          {suppression.expires_at && (
                            <span>
                              • Expira: {format(new Date(suppression.expires_at), 'dd/MM/yyyy')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(suppression.id)}
                      disabled={deleting === suppression.id}
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    >
                      {deleting === suppression.id ? (
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
