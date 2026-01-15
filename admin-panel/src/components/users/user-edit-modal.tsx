'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import {
  Pencil,
  Loader2,
  Crown,
  Zap,
  RotateCcw,
  Gift,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react'
import { format, addDays } from 'date-fns'

interface UserData {
  id: string
  whatsapp_number: string
  name: string | null
  subscription_plan: string
  subscription_status: string | null
  subscription_ends_at: string | null
  daily_count: number
  bonus_credits_today: number
  daily_limit?: number
}

interface UserEditModalProps {
  open: boolean
  onClose: () => void
  user: UserData
  onUpdate: (updatedUser: UserData) => void
}

interface QuickAction {
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  action: () => Record<string, unknown>
}

export function UserEditModal({ open, onClose, user, onUpdate }: UserEditModalProps) {
  const [formData, setFormData] = useState({
    subscription_plan: user.subscription_plan,
    subscription_status: user.subscription_status || '',
    subscription_ends_at: user.subscription_ends_at || '',
    daily_count: user.daily_count,
    bonus_credits_today: user.bonus_credits_today,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [confirmAction, setConfirmAction] = useState<QuickAction | null>(null)

  const quickActions: QuickAction[] = [
    {
      label: 'Dar 5 Bonus',
      description: 'Adiciona 5 creditos bonus para uso hoje',
      icon: Gift,
      color: 'text-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20',
      action: () => ({ bonus_credits_today: formData.bonus_credits_today + 5 }),
    },
    {
      label: 'Dar 10 Bonus',
      description: 'Adiciona 10 creditos bonus para uso hoje',
      icon: Gift,
      color: 'text-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20',
      action: () => ({ bonus_credits_today: formData.bonus_credits_today + 10 }),
    },
    {
      label: 'Resetar Contador',
      description: 'Zera o contador diario de stickers',
      icon: RotateCcw,
      color: 'text-blue-500 bg-blue-500/10 hover:bg-blue-500/20',
      action: () => ({ daily_count: 0 }),
    },
    {
      label: 'Premium 30d',
      description: 'Upgrade para Premium por 30 dias',
      icon: Crown,
      color: 'text-purple-500 bg-purple-500/10 hover:bg-purple-500/20',
      action: () => ({
        subscription_plan: 'premium',
        subscription_status: 'active',
        subscription_ends_at: addDays(new Date(), 30).toISOString(),
      }),
    },
    {
      label: 'Ultra 30d',
      description: 'Upgrade para Ultra por 30 dias',
      icon: Zap,
      color: 'text-amber-500 bg-amber-500/10 hover:bg-amber-500/20',
      action: () => ({
        subscription_plan: 'ultra',
        subscription_status: 'active',
        subscription_ends_at: addDays(new Date(), 30).toISOString(),
      }),
    },
  ]

  const handleQuickAction = (action: QuickAction) => {
    setConfirmAction(action)
  }

  const executeQuickAction = async () => {
    if (!confirmAction) return

    const updates = confirmAction.action()
    setFormData(prev => ({ ...prev, ...updates }))
    setConfirmAction(null)

    // Auto-save quick actions
    await saveChanges({ ...formData, ...updates })
  }

  const saveChanges = async (data: typeof formData) => {
    setSaving(true)
    setError(null)
    setSuccess(false)

    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription_plan: data.subscription_plan,
          subscription_status: data.subscription_status || null,
          subscription_ends_at: data.subscription_ends_at || null,
          daily_count: data.daily_count,
          bonus_credits_today: data.bonus_credits_today,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update user')
      }

      setSuccess(true)
      setFormData({
        subscription_plan: result.user.subscription_plan,
        subscription_status: result.user.subscription_status || '',
        subscription_ends_at: result.user.subscription_ends_at || '',
        daily_count: result.user.daily_count,
        bonus_credits_today: result.user.bonus_credits_today,
      })
      onUpdate(result.user)

      // Auto close after success
      setTimeout(() => {
        setSuccess(false)
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await saveChanges(formData)
  }

  const handleClose = () => {
    setError(null)
    setSuccess(false)
    onClose()
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5" />
              Editar Usuario
            </DialogTitle>
            <DialogDescription>
              {user.name || 'Usuario'} - {user.whatsapp_number}
            </DialogDescription>
          </DialogHeader>

          {/* Quick Actions */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Acoes Rapidas</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {quickActions.map((action) => {
                const Icon = action.icon
                return (
                  <Button
                    key={action.label}
                    variant="outline"
                    size="sm"
                    className={`h-auto flex-col gap-1 py-3 ${action.color}`}
                    onClick={() => handleQuickAction(action)}
                    disabled={saving}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-xs font-medium">{action.label}</span>
                  </Button>
                )
              })}
            </div>
          </div>

          <Separator />

          {/* Edit Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Subscription Plan */}
              <div className="space-y-2">
                <Label htmlFor="plan">Plano</Label>
                <Select
                  value={formData.subscription_plan}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, subscription_plan: value }))
                  }
                >
                  <SelectTrigger id="plan">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                    <SelectItem value="ultra">Ultra</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Subscription Status */}
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.subscription_status}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, subscription_status: value }))
                  }
                >
                  <SelectTrigger id="status">
                    <SelectValue placeholder="Nenhum" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhum</SelectItem>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="canceled">Cancelado</SelectItem>
                    <SelectItem value="expired">Expirado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Subscription End Date */}
              <div className="space-y-2">
                <Label htmlFor="ends_at">Expira em</Label>
                <Input
                  id="ends_at"
                  type="date"
                  value={
                    formData.subscription_ends_at
                      ? format(new Date(formData.subscription_ends_at), 'yyyy-MM-dd')
                      : ''
                  }
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      subscription_ends_at: e.target.value
                        ? new Date(e.target.value).toISOString()
                        : '',
                    }))
                  }
                />
              </div>

              {/* Daily Count */}
              <div className="space-y-2">
                <Label htmlFor="daily_count">Stickers Hoje</Label>
                <Input
                  id="daily_count"
                  type="number"
                  min={0}
                  value={formData.daily_count}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      daily_count: parseInt(e.target.value) || 0,
                    }))
                  }
                />
              </div>

              {/* Bonus Credits */}
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="bonus">Bonus Hoje</Label>
                <Input
                  id="bonus"
                  type="number"
                  min={0}
                  value={formData.bonus_credits_today}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      bonus_credits_today: parseInt(e.target.value) || 0,
                    }))
                  }
                />
              </div>
            </div>

            {/* Error/Success Messages */}
            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-red-500/10 p-3 text-sm text-red-500">
                <AlertTriangle className="h-4 w-4" />
                {error}
              </div>
            )}

            {success && (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-500">
                <CheckCircle2 className="h-4 w-4" />
                Alteracoes salvas com sucesso!
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar Alteracoes'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Acao</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction && (
                <>
                  Voce esta prestes a executar: <strong>{confirmAction.label}</strong>
                  <br />
                  {confirmAction.description}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={executeQuickAction}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
