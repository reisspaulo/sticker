'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Users,
  Plus,
  Trash2,
  Loader2,
  AlertCircle,
  CheckCircle,
  Filter,
} from 'lucide-react'

// Filter field definitions with human-readable labels
const FILTER_FIELDS = [
  {
    value: 'subscription_plan',
    label: 'Plano',
    type: 'select',
    options: [
      { value: 'free', label: 'Free' },
      { value: 'basic', label: 'Basic' },
      { value: 'premium', label: 'Premium' },
      { value: 'ultra', label: 'Ultra' },
    ]
  },
  {
    value: 'subscription_status',
    label: 'Status da Assinatura',
    type: 'select',
    options: [
      { value: 'active', label: 'Ativa' },
      { value: 'canceled', label: 'Cancelada' },
      { value: 'past_due', label: 'Pagamento Atrasado' },
    ]
  },
  {
    value: 'stickers_created',
    label: 'Figurinhas Criadas',
    type: 'number',
  },
  {
    value: 'days_since_signup',
    label: 'Dias Desde Cadastro',
    type: 'number',
  },
  {
    value: 'days_since_last_use',
    label: 'Dias Inativo',
    type: 'number',
  },
  {
    value: 'twitter_feature_used',
    label: 'Usou Twitter',
    type: 'boolean',
  },
  {
    value: 'cleanup_feature_used',
    label: 'Usou Cleanup',
    type: 'boolean',
  },
  {
    value: 'country_prefix',
    label: 'País',
    type: 'select',
    options: [
      { value: '55', label: 'Brasil (+55)' },
      { value: '1', label: 'EUA (+1)' },
      { value: '351', label: 'Portugal (+351)' },
      { value: '34', label: 'Espanha (+34)' },
    ]
  },
  {
    value: 'ab_test_group',
    label: 'Grupo A/B',
    type: 'select',
    options: [
      { value: 'control', label: 'Controle' },
      { value: 'bonus', label: 'Bonus' },
    ]
  },
  {
    value: 'in_campaign',
    label: 'Está em Campanha',
    type: 'boolean',
  },
]

// Operators by type with human-readable labels
const OPERATORS_BY_TYPE: Record<string, { value: string; label: string }[]> = {
  select: [
    { value: 'eq', label: 'é igual a' },
    { value: 'neq', label: 'não é igual a' },
  ],
  number: [
    { value: 'eq', label: 'é igual a' },
    { value: 'neq', label: 'não é igual a' },
    { value: 'gt', label: 'é maior que' },
    { value: 'gte', label: 'é maior ou igual a' },
    { value: 'lt', label: 'é menor que' },
    { value: 'lte', label: 'é menor ou igual a' },
  ],
  boolean: [
    { value: 'eq', label: 'é' },
  ],
  text: [
    { value: 'eq', label: 'é igual a' },
    { value: 'neq', label: 'não é igual a' },
    { value: 'contains', label: 'contém' },
  ],
}

export interface FilterCondition {
  id: string
  field: string
  operator: string
  value: string
}

interface AudiencePreview {
  total: number
  totalBase: number
  byPlan: Record<string, number>
  sampleUsers: {
    id: string
    whatsapp_number: string
    name: string | null
    subscription_plan: string
    stickers_created: number
    last_interaction: string | null
  }[]
}

interface AudienceBuilderProps {
  conditions: FilterCondition[]
  onChange: (conditions: FilterCondition[]) => void
  showPreview?: boolean
}

export function AudienceBuilder({
  conditions,
  onChange,
  showPreview = true,
}: AudienceBuilderProps) {
  const [preview, setPreview] = useState<AudiencePreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch preview when conditions change
  const fetchPreview = useCallback(async () => {
    if (!showPreview) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/campaigns/preview-audience', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conditions }),
      })

      if (!response.ok) {
        throw new Error('Erro ao calcular audiência')
      }

      const data = await response.json()
      setPreview(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }, [conditions, showPreview])

  // Debounced fetch
  useEffect(() => {
    const timer = setTimeout(fetchPreview, 500)
    return () => clearTimeout(timer)
  }, [fetchPreview])

  // Add new condition
  const addCondition = () => {
    const newCondition: FilterCondition = {
      id: `cond_${Date.now()}`,
      field: '',
      operator: 'eq',
      value: '',
    }
    onChange([...conditions, newCondition])
  }

  // Remove condition
  const removeCondition = (id: string) => {
    onChange(conditions.filter(c => c.id !== id))
  }

  // Update condition
  const updateCondition = (id: string, updates: Partial<FilterCondition>) => {
    onChange(conditions.map(c => {
      if (c.id !== id) return c

      // If field changed, reset operator and value
      if (updates.field && updates.field !== c.field) {
        const fieldDef = FILTER_FIELDS.find(f => f.value === updates.field)
        const defaultOperator = fieldDef?.type === 'boolean' ? 'eq' : 'eq'
        const defaultValue = fieldDef?.type === 'boolean' ? 'true' : ''
        return { ...c, ...updates, operator: defaultOperator, value: defaultValue }
      }

      return { ...c, ...updates }
    }))
  }

  // Get field definition
  const getFieldDef = (fieldValue: string) => {
    return FILTER_FIELDS.find(f => f.value === fieldValue)
  }

  // Get operators for field type
  const getOperators = (fieldValue: string) => {
    const fieldDef = getFieldDef(fieldValue)
    return OPERATORS_BY_TYPE[fieldDef?.type || 'text'] || OPERATORS_BY_TYPE.text
  }

  // Render value input based on field type
  const renderValueInput = (condition: FilterCondition) => {
    const fieldDef = getFieldDef(condition.field)

    if (!fieldDef) {
      return (
        <Input
          value={condition.value}
          onChange={(e) => updateCondition(condition.id, { value: e.target.value })}
          placeholder="Valor"
          className="w-32"
        />
      )
    }

    switch (fieldDef.type) {
      case 'select':
        return (
          <Select
            value={condition.value}
            onValueChange={(v) => updateCondition(condition.id, { value: v })}
          >
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              {fieldDef.options?.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )

      case 'boolean':
        return (
          <Select
            value={condition.value}
            onValueChange={(v) => updateCondition(condition.id, { value: v })}
          >
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">Sim</SelectItem>
              <SelectItem value="false">Não</SelectItem>
            </SelectContent>
          </Select>
        )

      case 'number':
        return (
          <Input
            type="number"
            value={condition.value}
            onChange={(e) => updateCondition(condition.id, { value: e.target.value })}
            placeholder="0"
            className="w-24"
            min="0"
          />
        )

      default:
        return (
          <Input
            value={condition.value}
            onChange={(e) => updateCondition(condition.id, { value: e.target.value })}
            placeholder="Valor"
            className="w-32"
          />
        )
    }
  }

  // Calculate percentage
  const percentage = preview?.totalBase && preview.totalBase > 0
    ? ((preview.total / preview.totalBase) * 100).toFixed(1)
    : '0'

  return (
    <div className="space-y-4">
      {/* Filter Builder */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Label className="text-sm font-medium">Incluir usuários onde:</Label>
        </div>

        {conditions.length === 0 ? (
          <div className="text-sm text-muted-foreground p-4 bg-muted/50 rounded-lg text-center">
            Nenhum filtro aplicado. Todos os usuários serão incluídos.
          </div>
        ) : (
          <div className="space-y-2">
            {conditions.map((condition, index) => (
              <div key={condition.id} className="flex items-center gap-2 flex-wrap">
                {index > 0 && (
                  <Badge variant="secondary" className="text-xs">E</Badge>
                )}

                {/* Field selector */}
                <Select
                  value={condition.field}
                  onValueChange={(v) => updateCondition(condition.id, { field: v })}
                >
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="Campo..." />
                  </SelectTrigger>
                  <SelectContent>
                    {FILTER_FIELDS.map(field => (
                      <SelectItem key={field.value} value={field.value}>
                        {field.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Operator selector */}
                {condition.field && (
                  <Select
                    value={condition.operator}
                    onValueChange={(v) => updateCondition(condition.id, { operator: v })}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {getOperators(condition.field).map(op => (
                        <SelectItem key={op.value} value={op.value}>
                          {op.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {/* Value input */}
                {condition.field && renderValueInput(condition)}

                {/* Inline count indicator */}
                {condition.field && condition.value && !loading && preview && (
                  <span className="text-xs text-emerald-500 ml-1">
                    <CheckCircle className="h-3 w-3 inline mr-1" />
                  </span>
                )}

                {/* Remove button */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-red-400"
                  onClick={() => removeCondition(condition.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Add condition button */}
        <Button
          variant="outline"
          size="sm"
          onClick={addCondition}
          className="mt-2"
        >
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Condição
        </Button>
      </div>

      {/* Preview Panel */}
      {showPreview && (
        <Card className="border-2 border-dashed">
          <CardContent className="pt-4">
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Calculando...</span>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center py-6 text-red-400">
                <AlertCircle className="h-5 w-5 mr-2" />
                {error}
              </div>
            ) : preview ? (
              <div className="space-y-4">
                {/* Main count */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Users className="h-6 w-6 text-primary" />
                    <span className="text-3xl font-bold">{preview.total.toLocaleString()}</span>
                  </div>
                  <div className="text-muted-foreground">
                    <span>de {preview.totalBase.toLocaleString()} usuários</span>
                    <span className="ml-2 text-primary font-medium">({percentage}%)</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-500"
                    style={{ width: `${Math.min(parseFloat(percentage), 100)}%` }}
                  />
                </div>

                {/* Breakdown by plan */}
                {preview.byPlan && Object.keys(preview.byPlan).length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {Object.entries(preview.byPlan).map(([plan, count]) => (
                      <Badge key={plan} variant="secondary">
                        {plan}: {count.toLocaleString()}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Sample users */}
                {preview.sampleUsers && preview.sampleUsers.length > 0 && (
                  <div className="mt-4">
                    <Label className="text-sm text-muted-foreground mb-2 block">
                      Amostra de usuários:
                    </Label>
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium">Número</th>
                            <th className="px-3 py-2 text-left font-medium">Plano</th>
                            <th className="px-3 py-2 text-left font-medium">Stickers</th>
                            <th className="px-3 py-2 text-left font-medium">Último Uso</th>
                          </tr>
                        </thead>
                        <tbody>
                          {preview.sampleUsers.slice(0, 5).map((user) => (
                            <tr key={user.id} className="border-t border-muted">
                              <td className="px-3 py-2 font-mono text-xs">
                                {user.whatsapp_number.replace(/^55/, '+55 ').slice(0, 15)}...
                              </td>
                              <td className="px-3 py-2">
                                <Badge variant="outline" className="text-xs">
                                  {user.subscription_plan || 'free'}
                                </Badge>
                              </td>
                              <td className="px-3 py-2">{user.stickers_created || 0}</td>
                              <td className="px-3 py-2 text-muted-foreground text-xs">
                                {user.last_interaction
                                  ? new Date(user.last_interaction).toLocaleDateString('pt-BR')
                                  : '-'
                                }
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {preview.total > 5 && (
                        <div className="px-3 py-2 text-center text-xs text-muted-foreground bg-muted/30">
                          ...e mais {(preview.total - 5).toLocaleString()} usuários
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                Configure os filtros para ver a prévia
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// Helper function to convert conditions to target_filter format
export function conditionsToTargetFilter(conditions: FilterCondition[]): Record<string, unknown> {
  const filter: Record<string, unknown> = {}

  for (const condition of conditions) {
    if (!condition.field || !condition.value) continue

    const fieldDef = FILTER_FIELDS.find(f => f.value === condition.field)
    let value: unknown = condition.value

    // Convert value based on type
    if (fieldDef?.type === 'boolean') {
      value = condition.value === 'true'
    } else if (fieldDef?.type === 'number') {
      value = parseInt(condition.value)
    }

    // Build filter object with operator
    if (condition.operator === 'eq') {
      filter[condition.field] = value
    } else {
      filter[condition.field] = { [condition.operator]: value }
    }
  }

  return filter
}
