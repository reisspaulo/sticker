'use client'

import { useCallback, useState, useMemo } from 'react'
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  Handle,
  Position,
  BackgroundVariant,
  MarkerType,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  X,
  MessageSquare,
  Zap,
  CreditCard,
  Twitter,
  Settings,
  CheckCircle,
  HelpCircle,
  Image,
  Send,
  Clock,
  Download,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ============================================
// TIPOS
// ============================================

type NodeType = 'trigger' | 'action' | 'message' | 'decision' | 'end'

interface FlowNodeData extends Record<string, unknown> {
  label: string
  type: NodeType
  description?: string
  message?: {
    content: string
    buttons?: { id: string; text: string }[]
  }
}

// ============================================
// ESTILOS DOS NÓS
// ============================================

const nodeConfig = {
  trigger: {
    bg: 'bg-emerald-500/20',
    border: 'border-emerald-500',
    text: 'text-emerald-400',
    icon: Zap,
  },
  action: {
    bg: 'bg-blue-500/20',
    border: 'border-blue-500',
    text: 'text-blue-400',
    icon: Settings,
  },
  message: {
    bg: 'bg-violet-500/20',
    border: 'border-violet-500',
    text: 'text-violet-400',
    icon: MessageSquare,
  },
  decision: {
    bg: 'bg-amber-500/20',
    border: 'border-amber-500',
    text: 'text-amber-400',
    icon: HelpCircle,
  },
  end: {
    bg: 'bg-slate-500/20',
    border: 'border-slate-500',
    text: 'text-slate-400',
    icon: CheckCircle,
  },
}

// ============================================
// COMPONENTE DE NÓ CUSTOMIZADO
// ============================================

function CustomNode({ data, selected }: { data: FlowNodeData; selected: boolean }) {
  const config = nodeConfig[data.type]
  const Icon = config.icon
  const hasMessage = !!data.message

  return (
    <div
      className={cn(
        'relative px-4 py-3 rounded-xl border-2 min-w-[180px] transition-all duration-200 cursor-pointer',
        'shadow-lg backdrop-blur-sm',
        config.bg,
        config.border,
        selected && 'ring-2 ring-white/50 ring-offset-2 ring-offset-background scale-105',
        hasMessage && 'hover:scale-105 hover:shadow-xl'
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-white/80 !border-2 !border-current"
        style={{ borderColor: 'inherit' }}
      />

      <div className="flex items-center gap-3">
        <div className={cn('p-2 rounded-lg', config.bg, config.border, 'border')}>
          <Icon className={cn('h-4 w-4', config.text)} />
        </div>
        <div className="flex-1">
          <div className={cn('font-semibold text-sm', config.text)}>{data.label}</div>
          {data.description && (
            <div className="text-xs text-muted-foreground mt-0.5">{data.description}</div>
          )}
        </div>
        {hasMessage && (
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-violet-500 rounded-full animate-pulse" />
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-white/80 !border-2"
        style={{ borderColor: 'inherit' }}
      />
    </div>
  )
}

const nodeTypes = {
  custom: CustomNode,
}

// ============================================
// DADOS DOS FLUXOS
// ============================================

// Fluxo Principal de Sticker
const stickerFlowNodes: Node<FlowNodeData>[] = [
  {
    id: 'user_sends',
    type: 'custom',
    position: { x: 300, y: 0 },
    data: { label: 'Usuário envia mídia', type: 'trigger', description: 'Imagem, GIF ou vídeo' },
  },
  {
    id: 'check_new_user',
    type: 'custom',
    position: { x: 300, y: 120 },
    data: { label: 'Usuário novo?', type: 'decision' },
  },
  {
    id: 'welcome_msg',
    type: 'custom',
    position: { x: 50, y: 240 },
    data: {
      label: 'Boas-vindas',
      type: 'message',
      message: {
        content: `👋 Olá, {nome}! Eu sou o *StickerBot*!

📸 Me envie uma *imagem* ou *GIF* e eu transformo em figurinha!

🆓 Você tem *4 figurinhas grátis* por dia.

💡 Comandos: *planos* | *status* | *ajuda*`,
      },
    },
  },
  {
    id: 'check_limit',
    type: 'custom',
    position: { x: 300, y: 360 },
    data: { label: 'Limite OK?', type: 'decision' },
  },
  {
    id: 'process_sticker',
    type: 'custom',
    position: { x: 50, y: 480 },
    data: { label: 'Processa sticker', type: 'action', description: 'Sharp + FFmpeg' },
  },
  {
    id: 'send_sticker',
    type: 'custom',
    position: { x: 50, y: 600 },
    data: { label: 'Envia figurinha', type: 'end', description: 'Via Evolution API' },
  },
  {
    id: 'limit_menu',
    type: 'custom',
    position: { x: 520, y: 480 },
    data: {
      label: 'Menu Upgrade',
      type: 'message',
      message: {
        content: `⚠️ *Limite Atingido!* 🎨

Você já usou *4/4 figurinhas* hoje.

Seu limite será renovado às *00:00*.

💎 *FAÇA UPGRADE E TENHA MAIS!*`,
        buttons: [
          { id: 'button_upgrade_premium', text: '💰 Premium - R$ 5/mês' },
          { id: 'button_upgrade_ultra', text: '🚀 Ultra - R$ 9,90/mês' },
        ],
      },
    },
  },
  {
    id: 'payment_flow',
    type: 'custom',
    position: { x: 520, y: 600 },
    data: { label: 'Fluxo Pagamento', type: 'action', description: 'Ver aba Pagamento →' },
  },
]

const stickerFlowEdges: Edge[] = [
  {
    id: 'e1',
    source: 'user_sends',
    target: 'check_new_user',
    animated: true,
    style: { stroke: '#10b981', strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#10b981' },
  },
  {
    id: 'e2',
    source: 'check_new_user',
    target: 'welcome_msg',
    label: 'Sim',
    labelBgStyle: { fill: '#10b981', fillOpacity: 0.8 },
    labelStyle: { fill: '#fff', fontWeight: 600, fontSize: 12 },
    style: { stroke: '#10b981', strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#10b981' },
  },
  {
    id: 'e3',
    source: 'check_new_user',
    target: 'check_limit',
    label: 'Não',
    labelBgStyle: { fill: '#64748b', fillOpacity: 0.8 },
    labelStyle: { fill: '#fff', fontWeight: 600, fontSize: 12 },
    style: { stroke: '#64748b', strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b' },
  },
  {
    id: 'e4',
    source: 'welcome_msg',
    target: 'check_limit',
    style: { stroke: '#8b5cf6', strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#8b5cf6' },
  },
  {
    id: 'e5',
    source: 'check_limit',
    target: 'process_sticker',
    label: 'Sim',
    labelBgStyle: { fill: '#10b981', fillOpacity: 0.8 },
    labelStyle: { fill: '#fff', fontWeight: 600, fontSize: 12 },
    style: { stroke: '#10b981', strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#10b981' },
  },
  {
    id: 'e6',
    source: 'check_limit',
    target: 'limit_menu',
    label: 'Não',
    labelBgStyle: { fill: '#ef4444', fillOpacity: 0.8 },
    labelStyle: { fill: '#fff', fontWeight: 600, fontSize: 12 },
    style: { stroke: '#ef4444', strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#ef4444' },
  },
  {
    id: 'e7',
    source: 'process_sticker',
    target: 'send_sticker',
    animated: true,
    style: { stroke: '#3b82f6', strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' },
  },
  {
    id: 'e8',
    source: 'limit_menu',
    target: 'payment_flow',
    style: { stroke: '#8b5cf6', strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#8b5cf6' },
  },
]

// Fluxo de Pagamento
const paymentFlowNodes: Node<FlowNodeData>[] = [
  {
    id: 'click_upgrade',
    type: 'custom',
    position: { x: 300, y: 0 },
    data: { label: 'Clica em Upgrade', type: 'trigger', description: 'Premium ou Ultra' },
  },
  {
    id: 'payment_methods',
    type: 'custom',
    position: { x: 300, y: 120 },
    data: {
      label: 'Métodos Pagamento',
      type: 'message',
      message: {
        content: `💰 *PAGAMENTO - PREMIUM*

Valor: R$ 5,00/mês

Escolha sua forma de pagamento:`,
        buttons: [
          { id: 'payment_card', text: '💳 Cartão de Crédito' },
          { id: 'payment_pix', text: '🔑 PIX' },
        ],
      },
    },
  },
  {
    id: 'choice_method',
    type: 'custom',
    position: { x: 300, y: 260 },
    data: { label: 'Qual método?', type: 'decision' },
  },
  {
    id: 'stripe_link',
    type: 'custom',
    position: { x: 50, y: 380 },
    data: {
      label: 'Link Stripe',
      type: 'message',
      message: {
        content: `🎉 *Ótima escolha!*

🔗 Clique para pagar:
https://buy.stripe.com/...

✅ Pagamento 100% seguro via Stripe`,
      },
    },
  },
  {
    id: 'pix_instructions',
    type: 'custom',
    position: { x: 520, y: 380 },
    data: {
      label: 'Instruções PIX',
      type: 'message',
      message: {
        content: `💰 *Pagamento via PIX*

📋 *Plano:* Premium
💵 *Valor:* R$ 5,00

1️⃣ Copie a chave PIX
2️⃣ Pague no seu banco
3️⃣ Clique em "Já Paguei"`,
      },
    },
  },
  {
    id: 'pix_key',
    type: 'custom',
    position: { x: 520, y: 500 },
    data: {
      label: 'Chave PIX',
      type: 'message',
      message: { content: `🔑 a1b2c3d4-e5f6-7890-abcd-ef1234567890` },
    },
  },
  {
    id: 'pix_confirm',
    type: 'custom',
    position: { x: 520, y: 620 },
    data: {
      label: 'Botão Confirmar',
      type: 'message',
      message: {
        content: `✅ *Pagou?*

Clique no botão abaixo:`,
        buttons: [{ id: 'button_confirm_pix', text: '✅ Já Paguei' }],
      },
    },
  },
  {
    id: 'wait_webhook',
    type: 'custom',
    position: { x: 50, y: 500 },
    data: { label: 'Aguarda Webhook', type: 'action', description: 'Stripe confirma' },
  },
  {
    id: 'activate_plan',
    type: 'custom',
    position: { x: 300, y: 740 },
    data: { label: 'Ativa Plano', type: 'action', description: 'Update no Supabase' },
  },
  {
    id: 'success_msg',
    type: 'custom',
    position: { x: 300, y: 860 },
    data: {
      label: 'Confirmação',
      type: 'message',
      message: {
        content: `🎉 *PAGAMENTO CONFIRMADO!*

Seu plano *Premium 💰* foi ativado!

✅ 20 figurinhas/dia
✅ 15 vídeos Twitter/dia

🚀 Já pode usar agora!`,
      },
    },
  },
  {
    id: 'plan_active',
    type: 'custom',
    position: { x: 300, y: 980 },
    data: { label: 'Plano Ativo', type: 'end' },
  },
]

const paymentFlowEdges: Edge[] = [
  {
    id: 'p1',
    source: 'click_upgrade',
    target: 'payment_methods',
    animated: true,
    style: { stroke: '#10b981', strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#10b981' },
  },
  {
    id: 'p2',
    source: 'payment_methods',
    target: 'choice_method',
    style: { stroke: '#8b5cf6', strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#8b5cf6' },
  },
  {
    id: 'p3',
    source: 'choice_method',
    target: 'stripe_link',
    label: 'Cartão',
    labelBgStyle: { fill: '#3b82f6', fillOpacity: 0.8 },
    labelStyle: { fill: '#fff', fontWeight: 600, fontSize: 12 },
    style: { stroke: '#3b82f6', strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' },
  },
  {
    id: 'p4',
    source: 'choice_method',
    target: 'pix_instructions',
    label: 'PIX',
    labelBgStyle: { fill: '#10b981', fillOpacity: 0.8 },
    labelStyle: { fill: '#fff', fontWeight: 600, fontSize: 12 },
    style: { stroke: '#10b981', strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#10b981' },
  },
  {
    id: 'p5',
    source: 'stripe_link',
    target: 'wait_webhook',
    style: { stroke: '#8b5cf6', strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#8b5cf6' },
  },
  {
    id: 'p6',
    source: 'pix_instructions',
    target: 'pix_key',
    animated: true,
    style: { stroke: '#8b5cf6', strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#8b5cf6' },
  },
  {
    id: 'p7',
    source: 'pix_key',
    target: 'pix_confirm',
    animated: true,
    style: { stroke: '#8b5cf6', strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#8b5cf6' },
  },
  {
    id: 'p8',
    source: 'pix_confirm',
    target: 'activate_plan',
    style: { stroke: '#8b5cf6', strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#8b5cf6' },
  },
  {
    id: 'p9',
    source: 'wait_webhook',
    target: 'activate_plan',
    style: { stroke: '#3b82f6', strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' },
  },
  {
    id: 'p10',
    source: 'activate_plan',
    target: 'success_msg',
    animated: true,
    style: { stroke: '#3b82f6', strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' },
  },
  {
    id: 'p11',
    source: 'success_msg',
    target: 'plan_active',
    style: { stroke: '#8b5cf6', strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#8b5cf6' },
  },
]

// Fluxo Twitter
const twitterFlowNodes: Node<FlowNodeData>[] = [
  {
    id: 'sticker_count',
    type: 'custom',
    position: { x: 300, y: 0 },
    data: { label: '3ª figurinha criada', type: 'trigger', description: 'Trigger do onboarding' },
  },
  {
    id: 'twitter_intro',
    type: 'custom',
    position: { x: 300, y: 120 },
    data: {
      label: 'Apresenta Twitter',
      type: 'message',
      message: {
        content: `🎉 *Você já criou 3 figurinhas!*

Parabéns! 👏

💡 Sabia que também posso *baixar vídeos do X (Twitter)*?`,
        buttons: [
          { id: 'button_twitter_learn', text: '🎬 Quero conhecer!' },
          { id: 'button_twitter_dismiss', text: '⏭️ Agora não' },
        ],
      },
    },
  },
  {
    id: 'user_choice',
    type: 'custom',
    position: { x: 300, y: 260 },
    data: { label: 'Usuário escolhe', type: 'decision' },
  },
  {
    id: 'twitter_tutorial',
    type: 'custom',
    position: { x: 50, y: 380 },
    data: {
      label: 'Tutorial',
      type: 'message',
      message: {
        content: `📱 *Perfeito!*

🎬 *Para BAIXAR:* Envie o link
🎨 *Para STICKER:* Escolha após baixar

📋 Exemplo:
https://x.com/user/status/123...`,
      },
    },
  },
  {
    id: 'twitter_dismiss',
    type: 'custom',
    position: { x: 520, y: 380 },
    data: {
      label: 'Dismiss',
      type: 'message',
      message: {
        content: `Tudo bem! 😊

Você pode conhecer depois digitando *twitter* ou *ajuda*.`,
      },
    },
  },
  {
    id: 'wait_link',
    type: 'custom',
    position: { x: 50, y: 500 },
    data: { label: 'Aguarda link', type: 'action' },
  },
  {
    id: 'download_video',
    type: 'custom',
    position: { x: 50, y: 620 },
    data: { label: 'Baixa vídeo', type: 'action', description: 'yt-dlp' },
  },
  {
    id: 'ask_convert',
    type: 'custom',
    position: { x: 50, y: 740 },
    data: {
      label: 'Converter?',
      type: 'message',
      message: {
        content: `🎨 *Quer transformar em figurinha?*`,
        buttons: [
          { id: 'button_convert_sticker', text: '✅ Sim, quero!' },
          { id: 'button_skip_convert', text: '⏭️ Só o vídeo' },
        ],
      },
    },
  },
  {
    id: 'convert_sticker',
    type: 'custom',
    position: { x: -150, y: 880 },
    data: { label: 'Converte', type: 'action', description: 'FFmpeg → WebP' },
  },
  {
    id: 'send_video',
    type: 'custom',
    position: { x: 200, y: 880 },
    data: { label: 'Envia vídeo', type: 'end' },
  },
  {
    id: 'send_sticker_tw',
    type: 'custom',
    position: { x: -150, y: 1000 },
    data: { label: 'Envia sticker', type: 'end' },
  },
  {
    id: 'back_normal',
    type: 'custom',
    position: { x: 520, y: 500 },
    data: { label: 'Uso normal', type: 'end' },
  },
]

const twitterFlowEdges: Edge[] = [
  {
    id: 't1',
    source: 'sticker_count',
    target: 'twitter_intro',
    animated: true,
    style: { stroke: '#10b981', strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#10b981' },
  },
  {
    id: 't2',
    source: 'twitter_intro',
    target: 'user_choice',
    style: { stroke: '#8b5cf6', strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#8b5cf6' },
  },
  {
    id: 't3',
    source: 'user_choice',
    target: 'twitter_tutorial',
    label: 'Quero!',
    labelBgStyle: { fill: '#10b981', fillOpacity: 0.8 },
    labelStyle: { fill: '#fff', fontWeight: 600, fontSize: 12 },
    style: { stroke: '#10b981', strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#10b981' },
  },
  {
    id: 't4',
    source: 'user_choice',
    target: 'twitter_dismiss',
    label: 'Não',
    labelBgStyle: { fill: '#64748b', fillOpacity: 0.8 },
    labelStyle: { fill: '#fff', fontWeight: 600, fontSize: 12 },
    style: { stroke: '#64748b', strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b' },
  },
  {
    id: 't5',
    source: 'twitter_tutorial',
    target: 'wait_link',
    style: { stroke: '#8b5cf6', strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#8b5cf6' },
  },
  {
    id: 't6',
    source: 'twitter_dismiss',
    target: 'back_normal',
    style: { stroke: '#8b5cf6', strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#8b5cf6' },
  },
  {
    id: 't7',
    source: 'wait_link',
    target: 'download_video',
    style: { stroke: '#3b82f6', strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' },
  },
  {
    id: 't8',
    source: 'download_video',
    target: 'ask_convert',
    animated: true,
    style: { stroke: '#3b82f6', strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' },
  },
  {
    id: 't9',
    source: 'ask_convert',
    target: 'convert_sticker',
    label: 'Sim',
    labelBgStyle: { fill: '#10b981', fillOpacity: 0.8 },
    labelStyle: { fill: '#fff', fontWeight: 600, fontSize: 12 },
    style: { stroke: '#10b981', strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#10b981' },
  },
  {
    id: 't10',
    source: 'ask_convert',
    target: 'send_video',
    label: 'Não',
    labelBgStyle: { fill: '#64748b', fillOpacity: 0.8 },
    labelStyle: { fill: '#fff', fontWeight: 600, fontSize: 12 },
    style: { stroke: '#64748b', strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b' },
  },
  {
    id: 't11',
    source: 'convert_sticker',
    target: 'send_sticker_tw',
    animated: true,
    style: { stroke: '#3b82f6', strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' },
  },
]

// ============================================
// COMPONENTE DE PREVIEW
// ============================================

function MessagePreview({
  message,
  nodeLabel,
  onClose,
}: {
  message: { content: string; buttons?: { id: string; text: string }[] }
  nodeLabel: string
  onClose: () => void
}) {
  const formatWhatsAppText = (text: string) => {
    return text.split(/(\*[^*]+\*)/).map((part, i) => {
      if (part.startsWith('*') && part.endsWith('*')) {
        return <strong key={i}>{part.slice(1, -1)}</strong>
      }
      return part
    })
  }

  return (
    <div className="absolute top-4 right-4 z-50 w-96 animate-in slide-in-from-right duration-200">
      <Card className="shadow-2xl border-2 border-violet-500/50 bg-background/95 backdrop-blur">
        <CardHeader className="pb-3 flex flex-row items-center justify-between border-b">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-violet-500" />
              {nodeLabel}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Preview da mensagem</p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="pt-4">
          {/* WhatsApp Preview */}
          <div className="bg-[#0b141a] rounded-xl p-4">
            <div className="bg-[#005c4b] rounded-lg rounded-tr-none p-3 text-white text-sm">
              <div className="whitespace-pre-wrap leading-relaxed">
                {formatWhatsAppText(message.content)}
              </div>
              <div className="text-right mt-2">
                <span className="text-[10px] text-white/60">18:42 ✓✓</span>
              </div>
            </div>

            {message.buttons && message.buttons.length > 0 && (
              <div className="mt-1 space-y-[2px]">
                {message.buttons.map((btn, idx) => (
                  <button
                    key={btn.id}
                    className={cn(
                      'w-full bg-[#1f2c34] text-[#00a884] text-sm py-3 text-center font-medium',
                      idx === 0 && 'rounded-t-lg',
                      idx === message.buttons!.length - 1 && 'rounded-b-lg'
                    )}
                  >
                    {btn.text}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Button IDs */}
          {message.buttons && message.buttons.length > 0 && (
            <div className="mt-4 p-3 bg-muted/50 rounded-lg">
              <div className="text-xs font-medium text-muted-foreground mb-2">IDs dos botões:</div>
              <div className="flex flex-wrap gap-1">
                {message.buttons.map((btn) => (
                  <code key={btn.id} className="text-xs bg-violet-500/20 text-violet-400 px-2 py-1 rounded">
                    {btn.id}
                  </code>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function BotFlowsPage() {
  const [selectedFlow, setSelectedFlow] = useState('sticker')
  const [selectedNode, setSelectedNode] = useState<{ label: string; message: FlowNodeData['message'] } | null>(null)

  const flows = {
    sticker: { nodes: stickerFlowNodes, edges: stickerFlowEdges },
    payment: { nodes: paymentFlowNodes, edges: paymentFlowEdges },
    twitter: { nodes: twitterFlowNodes, edges: twitterFlowEdges },
  }

  const [nodes, setNodes, onNodesChange] = useNodesState(flows.sticker.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(flows.sticker.edges)

  const handleFlowChange = (flow: string) => {
    setSelectedFlow(flow)
    setSelectedNode(null)
    const flowData = flows[flow as keyof typeof flows]
    setNodes(flowData.nodes)
    setEdges(flowData.edges)
  }

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    const data = node.data as FlowNodeData
    if (data.message) {
      setSelectedNode({ label: data.label, message: data.message })
    }
  }, [])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Visualizador de Fluxos</h1>
        <p className="text-muted-foreground">
          Explore os fluxos do bot interativamente. Clique nos nós <span className="text-violet-400 font-medium">roxos</span> para ver a mensagem.
        </p>
      </div>

      {/* Legend */}
      <Card>
        <CardContent className="py-3">
          <div className="flex flex-wrap gap-6">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded bg-emerald-500/20 border border-emerald-500">
                <Zap className="h-3 w-3 text-emerald-400" />
              </div>
              <span className="text-sm">Trigger</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded bg-blue-500/20 border border-blue-500">
                <Settings className="h-3 w-3 text-blue-400" />
              </div>
              <span className="text-sm">Ação</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded bg-violet-500/20 border border-violet-500">
                <MessageSquare className="h-3 w-3 text-violet-400" />
              </div>
              <span className="text-sm text-violet-400 font-medium">Mensagem (clicável)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded bg-amber-500/20 border border-amber-500">
                <HelpCircle className="h-3 w-3 text-amber-400" />
              </div>
              <span className="text-sm">Decisão</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded bg-slate-500/20 border border-slate-500">
                <CheckCircle className="h-3 w-3 text-slate-400" />
              </div>
              <span className="text-sm">Fim</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Flow Tabs */}
      <Tabs value={selectedFlow} onValueChange={handleFlowChange}>
        <TabsList className="grid grid-cols-3 w-full max-w-md">
          <TabsTrigger value="sticker" className="gap-2">
            <Image className="h-4 w-4" />
            Principal
          </TabsTrigger>
          <TabsTrigger value="payment" className="gap-2">
            <CreditCard className="h-4 w-4" />
            Pagamento
          </TabsTrigger>
          <TabsTrigger value="twitter" className="gap-2">
            <Twitter className="h-4 w-4" />
            Twitter
          </TabsTrigger>
        </TabsList>

        <TabsContent value={selectedFlow} className="mt-4">
          <Card className="overflow-hidden border-2">
            <div className="h-[700px] relative bg-[#0a0a0a]">
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={onNodeClick}
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{ padding: 0.2 }}
                minZoom={0.3}
                maxZoom={1.5}
                defaultEdgeOptions={{
                  type: 'smoothstep',
                }}
              >
                <Controls
                  className="!bg-background !border-border !rounded-lg !shadow-lg"
                  showInteractive={false}
                />
                <Background
                  variant={BackgroundVariant.Dots}
                  gap={20}
                  size={1}
                  color="#333"
                />
              </ReactFlow>

              {/* Message Preview */}
              {selectedNode?.message && (
                <MessagePreview
                  message={selectedNode.message}
                  nodeLabel={selectedNode.label}
                  onClose={() => setSelectedNode(null)}
                />
              )}
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Instructions */}
      <Card>
        <CardContent className="py-3">
          <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Badge variant="outline">Scroll</Badge>
              <span>Zoom in/out</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">Arrastar</Badge>
              <span>Mover o diagrama</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-violet-500 text-violet-400">Clique</Badge>
              <span>Ver mensagem nos nós roxos</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
