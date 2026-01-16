'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Megaphone,
  Settings,
  XCircle,
  MessageSquare,
  Image,
  Eye,
  Plus,
  Trash2,
  Zap,
  Clock,
  Target,
} from 'lucide-react'
import Link from 'next/link'
import { AudienceBuilder, FilterCondition, conditionsToTargetFilter } from '@/components/campaigns/audience-builder'

// Types
interface CampaignStep {
  step_key: string
  delay_hours: number
  messages: {
    variant: string
    content_type: string
    title: string
    body: string
    footer: string
    buttons: { id: string; text: string }[]
  }[]
}

interface BotSticker {
  id: string
  name: string
  sticker_url: string
  category: string
}

// Step indicator component
function StepIndicator({ currentStep, totalSteps }: { currentStep: number; totalSteps: number }) {
  const steps = [
    { num: 1, label: 'Informações' },
    { num: 2, label: 'Trigger' },
    { num: 3, label: 'Audiência' },
    { num: 4, label: 'Cancelamento' },
    { num: 5, label: 'Mensagens' },
    { num: 6, label: 'Stickers' },
    { num: 7, label: 'Revisão' },
  ]

  return (
    <div className="flex items-center justify-between mb-8">
      {steps.map((step, index) => (
        <div key={step.num} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                step.num < currentStep
                  ? 'bg-primary text-primary-foreground'
                  : step.num === currentStep
                  ? 'bg-primary text-primary-foreground ring-4 ring-primary/20'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {step.num < currentStep ? <Check className="h-5 w-5" /> : step.num}
            </div>
            <span className={`text-xs mt-1 ${step.num === currentStep ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
              {step.label}
            </span>
          </div>
          {index < steps.length - 1 && (
            <div className={`h-0.5 w-12 mx-2 ${step.num < currentStep ? 'bg-primary' : 'bg-muted'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

export default function NewCampaignPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [saving, setSaving] = useState(false)

  // Step 1: Informações básicas
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [campaignType, setCampaignType] = useState('drip')
  const [priority, setPriority] = useState('10')
  const [maxUsers, setMaxUsers] = useState('')

  // Step 2: Trigger
  const [triggerEvent, setTriggerEvent] = useState('')
  const [triggerDelayHours, setTriggerDelayHours] = useState('0')

  // Step 3: Audiência (novo builder visual)
  const [audienceConditions, setAudienceConditions] = useState<FilterCondition[]>([])

  // Step 4: Cancelamento
  const [cancelCondition, setCancelCondition] = useState('')

  // Step 5: Steps/Mensagens
  const [steps, setSteps] = useState<CampaignStep[]>([
    {
      step_key: 'day_0',
      delay_hours: 0,
      messages: [{ variant: 'default', content_type: 'text', title: '', body: '', footer: '', buttons: [] }],
    },
  ])

  // Step 6: Stickers
  const [availableStickers, setAvailableStickers] = useState<BotSticker[]>([])
  const [selectedStickers, setSelectedStickers] = useState<string[]>([])

  // Step 7: Settings
  const [batchSize, setBatchSize] = useState('50')
  const [rateLimit, setRateLimit] = useState('200')
  const [sendWindowStart, setSendWindowStart] = useState('8')
  const [sendWindowEnd, setSendWindowEnd] = useState('22')

  // Fetch stickers for step 6
  useEffect(() => {
    if (currentStep === 6) {
      fetch('/api/campaigns/stickers')
        .then(res => res.json())
        .then(data => setAvailableStickers(data.stickers || []))
        .catch(console.error)
    }
  }, [currentStep])

  // Add step
  const addStep = () => {
    const newStepNum = steps.length
    setSteps([
      ...steps,
      {
        step_key: `day_${newStepNum * 7}`,
        delay_hours: 168, // 7 dias
        messages: [{ variant: 'default', content_type: 'text', title: '', body: '', footer: '', buttons: [] }],
      },
    ])
  }

  // Remove step
  const removeStep = (index: number) => {
    if (steps.length > 1) {
      setSteps(steps.filter((_, i) => i !== index))
    }
  }

  // Update step
  const updateStep = (index: number, field: keyof CampaignStep, value: unknown) => {
    const newSteps = [...steps]
    if (field === 'messages') {
      newSteps[index].messages = value as CampaignStep['messages']
    } else if (field === 'step_key') {
      newSteps[index].step_key = value as string
    } else if (field === 'delay_hours') {
      newSteps[index].delay_hours = value as number
    }
    setSteps(newSteps)
  }

  // Update message in step
  const updateMessage = (stepIndex: number, messageIndex: number, field: 'variant' | 'content_type' | 'title' | 'body' | 'footer', value: string) => {
    const newSteps = [...steps]
    newSteps[stepIndex].messages[messageIndex][field] = value
    setSteps(newSteps)
  }

  // Navigation
  const canGoNext = () => {
    switch (currentStep) {
      case 1:
        return name.trim().length > 0
      case 2:
        return true // Trigger é opcional
      case 3:
        return true // Filtros são opcionais
      case 4:
        return true // Cancelamento é opcional
      case 5:
        return steps.length > 0 && steps.every(s => s.messages.some(m => m.body.trim().length > 0))
      case 6:
        return true // Stickers são opcionais
      case 7:
        return true
      default:
        return false
    }
  }

  const goNext = () => {
    if (currentStep < 7 && canGoNext()) {
      setCurrentStep(currentStep + 1)
    }
  }

  const goBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  // Save campaign
  const saveCampaign = async (activate: boolean = false) => {
    setSaving(true)
    try {
      // Build target_filter from conditions
      const targetFilter = conditionsToTargetFilter(audienceConditions)

      // Build trigger_config
      const triggerConfig: Record<string, unknown> = {}
      if (triggerEvent) triggerConfig.event_name = triggerEvent
      if (triggerDelayHours) triggerConfig.initial_delay_hours = parseInt(triggerDelayHours)

      const campaignData = {
        name,
        description: description || null,
        campaign_type: campaignType,
        priority: parseInt(priority),
        max_users: maxUsers ? parseInt(maxUsers) : null,
        trigger_config: Object.keys(triggerConfig).length > 0 ? triggerConfig : null,
        target_filter: Object.keys(targetFilter).length > 0 ? targetFilter : null,
        cancel_condition: cancelCondition || null,
        settings: {
          batch_size: parseInt(batchSize),
          rate_limit_ms: parseInt(rateLimit),
          send_window: {
            start: parseInt(sendWindowStart),
            end: parseInt(sendWindowEnd),
          },
        },
        created_by: 'admin',
      }

      const response = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaign: campaignData,
          steps: steps,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        alert(result.error || 'Erro ao criar campanha')
        return
      }

      // Link stickers if any selected
      if (selectedStickers.length > 0 && result.campaign_id) {
        for (const stickerId of selectedStickers) {
          await fetch(`/api/campaigns/${result.campaign_id}/stickers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sticker_id: stickerId }),
          })
        }
      }

      // Activate if requested
      if (activate && result.campaign_id) {
        await fetch(`/api/campaigns/${result.campaign_id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'active' }),
        })
      }

      router.push(`/campaigns/${result.campaign_id}`)
    } catch (error) {
      console.error('Erro ao criar campanha:', error)
      alert('Erro ao criar campanha')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/campaigns">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Megaphone className="h-6 w-6" />
            Nova Campanha
          </h1>
          <p className="text-muted-foreground">
            Configure sua campanha em 7 passos
          </p>
        </div>
      </div>

      {/* Step Indicator */}
      <StepIndicator currentStep={currentStep} totalSteps={7} />

      {/* Step Content */}
      <Card>
        <CardContent className="pt-6">
          {/* Step 1: Informações Básicas */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-4">
                <Settings className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Informações Básicas</h2>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome da Campanha *</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="ex: welcome_new_users_v1"
                  />
                  <p className="text-xs text-muted-foreground">
                    Use snake_case sem espaços. Este nome deve ser único.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Descreva o objetivo desta campanha..."
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="type">Tipo de Campanha</Label>
                    <Select value={campaignType} onValueChange={setCampaignType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="drip">Drip (Sequência temporal)</SelectItem>
                        <SelectItem value="event">Evento (Disparo por ação)</SelectItem>
                        <SelectItem value="hybrid">Híbrida (Evento + Drip)</SelectItem>
                        <SelectItem value="instant">Instantânea (Uma mensagem)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="priority">Prioridade</Label>
                    <Input
                      id="priority"
                      type="number"
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                      min="1"
                      max="100"
                    />
                    <p className="text-xs text-muted-foreground">
                      Menor número = maior prioridade
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxUsers">Limite de Usuários (opcional)</Label>
                  <Input
                    id="maxUsers"
                    type="number"
                    value={maxUsers}
                    onChange={(e) => setMaxUsers(e.target.value)}
                    placeholder="Deixe vazio para ilimitado"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Trigger */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Configuração do Trigger</h2>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="triggerEvent">Evento Disparador</Label>
                  <Select value={triggerEvent || '_none'} onValueChange={(v) => setTriggerEvent(v === '_none' ? '' : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um evento..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Nenhum (disparo manual)</SelectItem>
                      <SelectItem value="user_created">Usuário criado</SelectItem>
                      <SelectItem value="first_sticker">Primeira figurinha</SelectItem>
                      <SelectItem value="limit_hit">Limite atingido</SelectItem>
                      <SelectItem value="payment_intent">Intenção de pagamento</SelectItem>
                      <SelectItem value="subscription_cancelled">Assinatura cancelada</SelectItem>
                      <SelectItem value="inactive_7d">Inativo há 7 dias</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    O evento que inicia a campanha para o usuário
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="triggerDelay">Delay Inicial (horas)</Label>
                  <Input
                    id="triggerDelay"
                    type="number"
                    value={triggerDelayHours}
                    onChange={(e) => setTriggerDelayHours(e.target.value)}
                    min="0"
                  />
                  <p className="text-xs text-muted-foreground">
                    Tempo de espera após o evento antes de enviar a primeira mensagem
                  </p>
                </div>

                {!triggerEvent && (
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      Sem evento disparador, a campanha precisará ser ativada manualmente
                      ou os usuários serão inscritos via código.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Audiência */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-4">
                <Target className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Segmentação de Audiência</h2>
              </div>

              <p className="text-muted-foreground">
                Defina os critérios para selecionar quais usuários receberão esta campanha.
                A prévia é atualizada em tempo real conforme você adiciona filtros.
              </p>

              <AudienceBuilder
                conditions={audienceConditions}
                onChange={setAudienceConditions}
                showPreview={true}
              />
            </div>
          )}

          {/* Step 4: Cancelamento */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-4">
                <XCircle className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Condição de Cancelamento</h2>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Cancelar Automaticamente Quando</Label>
                  <Select value={cancelCondition || '_none'} onValueChange={(v) => setCancelCondition(v === '_none' ? '' : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma condição..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Nenhuma (completar todos os steps)</SelectItem>
                      <SelectItem value="twitter_feature_used = true">Usuário usou feature Twitter</SelectItem>
                      <SelectItem value="cleanup_feature_used = true">Usuário usou feature Cleanup</SelectItem>
                      <SelectItem value="subscription_plan != 'free'">Usuário fez upgrade</SelectItem>
                      <SelectItem value="subscription_status = 'active'">Assinatura ativa</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    A campanha será cancelada automaticamente quando esta condição for verdadeira
                  </p>
                </div>

                {cancelCondition && (
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                    <p className="text-sm text-emerald-400">
                      Quando a condição for atendida, o usuário sairá da campanha automaticamente
                      e não receberá mais mensagens.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 5: Mensagens */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-primary" />
                  <h2 className="text-lg font-semibold">Steps e Mensagens</h2>
                </div>
                <Button variant="outline" size="sm" onClick={addStep}>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Step
                </Button>
              </div>

              <div className="space-y-6">
                {steps.map((step, stepIndex) => (
                  <Card key={stepIndex} className="border-2">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Badge variant="outline">{stepIndex + 1}</Badge>
                          <Input
                            value={step.step_key}
                            onChange={(e) => updateStep(stepIndex, 'step_key', e.target.value)}
                            className="w-32 h-8"
                            placeholder="step_key"
                          />
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <Input
                              type="number"
                              value={step.delay_hours}
                              onChange={(e) => updateStep(stepIndex, 'delay_hours', parseInt(e.target.value))}
                              className="w-20 h-8"
                              min="0"
                            />
                            <span className="text-sm text-muted-foreground">horas</span>
                          </div>
                          {steps.length > 1 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-400"
                              onClick={() => removeStep(stepIndex)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {step.messages.map((message, msgIndex) => (
                        <div key={msgIndex} className="space-y-3">
                          <div className="space-y-2">
                            <Label>Título (opcional)</Label>
                            <Input
                              value={message.title}
                              onChange={(e) => updateMessage(stepIndex, msgIndex, 'title', e.target.value)}
                              placeholder="Título da mensagem"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Corpo da Mensagem *</Label>
                            <Textarea
                              value={message.body}
                              onChange={(e) => updateMessage(stepIndex, msgIndex, 'body', e.target.value)}
                              placeholder="Digite o texto da mensagem..."
                              rows={4}
                            />
                            <p className="text-xs text-muted-foreground">
                              Use {'{name}'} para o nome do usuário
                            </p>
                          </div>
                          <div className="space-y-2">
                            <Label>Rodapé (opcional)</Label>
                            <Input
                              value={message.footer}
                              onChange={(e) => updateMessage(stepIndex, msgIndex, 'footer', e.target.value)}
                              placeholder="Texto do rodapé"
                            />
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Step 6: Stickers */}
          {currentStep === 6 && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-4">
                <Image className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Vincular Stickers</h2>
              </div>

              <p className="text-muted-foreground">
                Selecione os stickers que podem ser enviados junto com as mensagens desta campanha.
              </p>

              {availableStickers.length === 0 ? (
                <div className="text-center py-8">
                  <Image className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">Nenhum sticker disponível</p>
                  <Link href="/campaigns/stickers">
                    <Button variant="outline" className="mt-4">
                      Ir para Biblioteca de Stickers
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-4">
                  {availableStickers.map((sticker) => (
                    <div
                      key={sticker.id}
                      onClick={() => {
                        if (selectedStickers.includes(sticker.id)) {
                          setSelectedStickers(selectedStickers.filter(id => id !== sticker.id))
                        } else {
                          setSelectedStickers([...selectedStickers, sticker.id])
                        }
                      }}
                      className={`cursor-pointer p-4 rounded-lg border-2 transition-all ${
                        selectedStickers.includes(sticker.id)
                          ? 'border-primary bg-primary/10'
                          : 'border-transparent bg-muted hover:border-muted-foreground/30'
                      }`}
                    >
                      <div className="h-20 w-20 mx-auto rounded-lg overflow-hidden bg-background flex items-center justify-center">
                        <img
                          src={sticker.sticker_url}
                          alt={sticker.name}
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                      <p className="text-center text-sm mt-2 truncate">{sticker.name}</p>
                      {selectedStickers.includes(sticker.id) && (
                        <div className="flex justify-center mt-2">
                          <Check className="h-5 w-5 text-primary" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {selectedStickers.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  {selectedStickers.length} sticker(s) selecionado(s)
                </p>
              )}
            </div>
          )}

          {/* Step 7: Revisão */}
          {currentStep === 7 && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-4">
                <Eye className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Revisão e Configurações Finais</h2>
              </div>

              {/* Summary */}
              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-lg space-y-3">
                  <h3 className="font-medium">Resumo da Campanha</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-muted-foreground">Nome:</div>
                    <div className="font-medium">{name}</div>
                    <div className="text-muted-foreground">Tipo:</div>
                    <div className="font-medium">{campaignType}</div>
                    <div className="text-muted-foreground">Steps:</div>
                    <div className="font-medium">{steps.length}</div>
                    <div className="text-muted-foreground">Stickers:</div>
                    <div className="font-medium">{selectedStickers.length}</div>
                    <div className="text-muted-foreground">Filtros:</div>
                    <div className="font-medium">
                      {audienceConditions.length > 0
                        ? `${audienceConditions.length} condição(ões)`
                        : 'Todos os usuários'
                      }
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Settings */}
                <h3 className="font-medium">Configurações de Envio</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tamanho do Lote</Label>
                    <Input
                      type="number"
                      value={batchSize}
                      onChange={(e) => setBatchSize(e.target.value)}
                      min="1"
                      max="100"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Rate Limit (ms)</Label>
                    <Input
                      type="number"
                      value={rateLimit}
                      onChange={(e) => setRateLimit(e.target.value)}
                      min="100"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Janela de Envio - Início</Label>
                    <Input
                      type="number"
                      value={sendWindowStart}
                      onChange={(e) => setSendWindowStart(e.target.value)}
                      min="0"
                      max="23"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Janela de Envio - Fim</Label>
                    <Input
                      type="number"
                      value={sendWindowEnd}
                      onChange={(e) => setSendWindowEnd(e.target.value)}
                      min="0"
                      max="23"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Mensagens só serão enviadas entre {sendWindowStart}h e {sendWindowEnd}h
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={goBack} disabled={currentStep === 1}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>

        <div className="flex gap-2">
          {currentStep === 7 ? (
            <>
              <Button variant="outline" onClick={() => saveCampaign(false)} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Salvar como Rascunho
              </Button>
              <Button onClick={() => saveCampaign(true)} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                Criar e Ativar
              </Button>
            </>
          ) : (
            <Button onClick={goNext} disabled={!canGoNext()}>
              Próximo
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
