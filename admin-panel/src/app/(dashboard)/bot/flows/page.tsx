'use client'

import { useCallback, useState } from 'react'
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Node,
  Edge,
  Handle,
  Position,
  BackgroundVariant,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { X, MessageSquare, Zap, CreditCard, Twitter } from 'lucide-react'
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
// COMPONENTE DE NÓ CUSTOMIZADO
// ============================================

function CustomNode({ data, selected }: { data: FlowNodeData; selected: boolean }) {
  const typeStyles = {
    trigger: 'bg-green-500/20 border-green-500 text-green-400',
    action: 'bg-blue-500/20 border-blue-500 text-blue-400',
    message: 'bg-purple-500/20 border-purple-500 text-purple-400',
    decision: 'bg-yellow-500/20 border-yellow-500 text-yellow-400',
    end: 'bg-gray-500/20 border-gray-500 text-gray-400',
  }

  const typeIcons = {
    trigger: '⚡',
    action: '⚙️',
    message: '💬',
    decision: '❓',
    end: '✅',
  }

  return (
    <div
      className={cn(
        'px-4 py-3 rounded-lg border-2 min-w-[160px] text-center transition-all',
        typeStyles[data.type],
        selected && 'ring-2 ring-primary ring-offset-2 ring-offset-background'
      )}
    >
      <Handle type="target" position={Position.Top} className="!bg-muted-foreground" />
      <div className="flex items-center justify-center gap-2">
        <span>{typeIcons[data.type]}</span>
        <span className="font-medium text-sm">{data.label}</span>
      </div>
      {data.description && (
        <div className="text-xs text-muted-foreground mt-1">{data.description}</div>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-muted-foreground" />
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
    position: { x: 250, y: 0 },
    data: { label: 'Usuário envia mídia', type: 'trigger', description: 'Imagem, GIF ou vídeo' },
  },
  {
    id: 'check_new_user',
    type: 'custom',
    position: { x: 250, y: 100 },
    data: { label: 'Usuário novo?', type: 'decision' },
  },
  {
    id: 'welcome_msg',
    type: 'custom',
    position: { x: 50, y: 200 },
    data: {
      label: 'Boas-vindas',
      type: 'message',
      message: {
        content: `👋 Olá, {nome}! Eu sou o *StickerBot*!

📸 Me envie uma *imagem* ou *GIF* e eu transformo em figurinha!

🆓 Você tem *4 figurinhas grátis* por dia.`,
      },
    },
  },
  {
    id: 'check_limit',
    type: 'custom',
    position: { x: 250, y: 300 },
    data: { label: 'Limite OK?', type: 'decision' },
  },
  {
    id: 'process_sticker',
    type: 'custom',
    position: { x: 50, y: 400 },
    data: { label: 'Processa sticker', type: 'action', description: 'Sharp + FFmpeg' },
  },
  {
    id: 'send_sticker',
    type: 'custom',
    position: { x: 50, y: 500 },
    data: { label: 'Envia figurinha', type: 'end', description: 'Via Evolution API' },
  },
  {
    id: 'limit_menu',
    type: 'custom',
    position: { x: 450, y: 400 },
    data: {
      label: 'Menu Upgrade',
      type: 'message',
      message: {
        content: `⚠️ *Limite Atingido!* 🎨

Você já usou *4/4 figurinhas* hoje.

💎 *FAÇA UPGRADE!*`,
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
    position: { x: 450, y: 520 },
    data: { label: 'Fluxo Pagamento', type: 'action', description: 'Ver aba Pagamento' },
  },
]

const stickerFlowEdges: Edge[] = [
  { id: 'e1', source: 'user_sends', target: 'check_new_user', animated: true },
  { id: 'e2', source: 'check_new_user', target: 'welcome_msg', label: 'Sim', labelStyle: { fill: '#22c55e' } },
  { id: 'e3', source: 'check_new_user', target: 'check_limit', label: 'Não' },
  { id: 'e4', source: 'welcome_msg', target: 'check_limit' },
  { id: 'e5', source: 'check_limit', target: 'process_sticker', label: 'Sim', labelStyle: { fill: '#22c55e' } },
  { id: 'e6', source: 'check_limit', target: 'limit_menu', label: 'Não', labelStyle: { fill: '#ef4444' } },
  { id: 'e7', source: 'process_sticker', target: 'send_sticker', animated: true },
  { id: 'e8', source: 'limit_menu', target: 'payment_flow' },
]

// Fluxo de Pagamento
const paymentFlowNodes: Node<FlowNodeData>[] = [
  {
    id: 'click_upgrade',
    type: 'custom',
    position: { x: 250, y: 0 },
    data: { label: 'Clica em Upgrade', type: 'trigger', description: 'Premium ou Ultra' },
  },
  {
    id: 'payment_methods',
    type: 'custom',
    position: { x: 250, y: 100 },
    data: {
      label: 'Métodos Pagamento',
      type: 'message',
      message: {
        content: `💰 *PAGAMENTO - PREMIUM*

Valor: R$ 5,00/mês

Escolha sua forma de pagamento:`,
        buttons: [
          { id: 'payment_card', text: '💳 Cartão' },
          { id: 'payment_pix', text: '🔑 PIX' },
        ],
      },
    },
  },
  {
    id: 'choice_method',
    type: 'custom',
    position: { x: 250, y: 220 },
    data: { label: 'Qual método?', type: 'decision' },
  },
  {
    id: 'stripe_link',
    type: 'custom',
    position: { x: 50, y: 320 },
    data: {
      label: 'Link Stripe',
      type: 'message',
      message: {
        content: `🎉 *Ótima escolha!*

🔗 Clique para pagar:
https://buy.stripe.com/...

✅ Pagamento 100% seguro`,
      },
    },
  },
  {
    id: 'pix_instructions',
    type: 'custom',
    position: { x: 450, y: 320 },
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
    position: { x: 450, y: 440 },
    data: {
      label: 'Chave PIX',
      type: 'message',
      message: { content: `🔑 a1b2c3d4-e5f6-7890-abcd-ef1234567890` },
    },
  },
  {
    id: 'pix_confirm',
    type: 'custom',
    position: { x: 450, y: 540 },
    data: {
      label: 'Botão Confirmar',
      type: 'message',
      message: {
        content: `✅ *Pagou?*`,
        buttons: [{ id: 'button_confirm_pix', text: '✅ Já Paguei' }],
      },
    },
  },
  {
    id: 'wait_webhook',
    type: 'custom',
    position: { x: 50, y: 440 },
    data: { label: 'Aguarda Webhook', type: 'action', description: 'Stripe confirma' },
  },
  {
    id: 'activate_plan',
    type: 'custom',
    position: { x: 250, y: 640 },
    data: { label: 'Ativa Plano', type: 'action', description: 'Update no Supabase' },
  },
  {
    id: 'success_msg',
    type: 'custom',
    position: { x: 250, y: 740 },
    data: {
      label: 'Confirmação',
      type: 'message',
      message: {
        content: `🎉 *PAGAMENTO CONFIRMADO!*

Seu plano *Premium 💰* foi ativado!

✅ 20 figurinhas/dia
✅ 15 vídeos Twitter/dia

🚀 Já pode usar!`,
      },
    },
  },
  {
    id: 'plan_active',
    type: 'custom',
    position: { x: 250, y: 840 },
    data: { label: 'Plano Ativo', type: 'end' },
  },
]

const paymentFlowEdges: Edge[] = [
  { id: 'p1', source: 'click_upgrade', target: 'payment_methods', animated: true },
  { id: 'p2', source: 'payment_methods', target: 'choice_method' },
  { id: 'p3', source: 'choice_method', target: 'stripe_link', label: 'Cartão' },
  { id: 'p4', source: 'choice_method', target: 'pix_instructions', label: 'PIX' },
  { id: 'p5', source: 'stripe_link', target: 'wait_webhook' },
  { id: 'p6', source: 'pix_instructions', target: 'pix_key', animated: true },
  { id: 'p7', source: 'pix_key', target: 'pix_confirm', animated: true },
  { id: 'p8', source: 'pix_confirm', target: 'activate_plan' },
  { id: 'p9', source: 'wait_webhook', target: 'activate_plan' },
  { id: 'p10', source: 'activate_plan', target: 'success_msg', animated: true },
  { id: 'p11', source: 'success_msg', target: 'plan_active' },
]

// Fluxo Twitter
const twitterFlowNodes: Node<FlowNodeData>[] = [
  {
    id: 'sticker_count',
    type: 'custom',
    position: { x: 250, y: 0 },
    data: { label: '3ª figurinha criada', type: 'trigger', description: 'Trigger do onboarding' },
  },
  {
    id: 'twitter_intro',
    type: 'custom',
    position: { x: 250, y: 100 },
    data: {
      label: 'Apresenta Twitter',
      type: 'message',
      message: {
        content: `🎉 *Você já criou 3 figurinhas!*

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
    position: { x: 250, y: 240 },
    data: { label: 'Usuário escolhe', type: 'decision' },
  },
  {
    id: 'twitter_tutorial',
    type: 'custom',
    position: { x: 50, y: 340 },
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
    position: { x: 450, y: 340 },
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
    position: { x: 50, y: 460 },
    data: { label: 'Aguarda link', type: 'action' },
  },
  {
    id: 'download_video',
    type: 'custom',
    position: { x: 50, y: 560 },
    data: { label: 'Baixa vídeo', type: 'action', description: 'yt-dlp' },
  },
  {
    id: 'ask_convert',
    type: 'custom',
    position: { x: 50, y: 660 },
    data: {
      label: 'Converter?',
      type: 'message',
      message: {
        content: `🎨 *Quer transformar em figurinha?*`,
        buttons: [
          { id: 'button_convert_sticker', text: '✅ Sim!' },
          { id: 'button_skip_convert', text: '⏭️ Só o vídeo' },
        ],
      },
    },
  },
  {
    id: 'convert_sticker',
    type: 'custom',
    position: { x: -100, y: 780 },
    data: { label: 'Converte', type: 'action', description: 'FFmpeg → WebP' },
  },
  {
    id: 'send_video',
    type: 'custom',
    position: { x: 200, y: 780 },
    data: { label: 'Envia vídeo', type: 'end' },
  },
  {
    id: 'send_sticker_tw',
    type: 'custom',
    position: { x: -100, y: 880 },
    data: { label: 'Envia sticker', type: 'end' },
  },
  {
    id: 'back_normal',
    type: 'custom',
    position: { x: 450, y: 460 },
    data: { label: 'Uso normal', type: 'end' },
  },
]

const twitterFlowEdges: Edge[] = [
  { id: 't1', source: 'sticker_count', target: 'twitter_intro', animated: true },
  { id: 't2', source: 'twitter_intro', target: 'user_choice' },
  { id: 't3', source: 'user_choice', target: 'twitter_tutorial', label: 'Quero!' },
  { id: 't4', source: 'user_choice', target: 'twitter_dismiss', label: 'Agora não' },
  { id: 't5', source: 'twitter_tutorial', target: 'wait_link' },
  { id: 't6', source: 'twitter_dismiss', target: 'back_normal' },
  { id: 't7', source: 'wait_link', target: 'download_video' },
  { id: 't8', source: 'download_video', target: 'ask_convert', animated: true },
  { id: 't9', source: 'ask_convert', target: 'convert_sticker', label: 'Sim' },
  { id: 't10', source: 'ask_convert', target: 'send_video', label: 'Não' },
  { id: 't11', source: 'convert_sticker', target: 'send_sticker_tw', animated: true },
]

// ============================================
// COMPONENTE DE PREVIEW
// ============================================

function MessagePreview({
  message,
  onClose,
}: {
  message: { content: string; buttons?: { id: string; text: string }[] }
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
    <div className="absolute top-4 right-4 z-50 w-80 animate-in slide-in-from-right">
      <Card className="shadow-xl border-2">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Preview da Mensagem
          </CardTitle>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          {/* WhatsApp Preview */}
          <div className="bg-[#0b141a] rounded-xl p-3">
            <div className="bg-[#005c4b] rounded-lg rounded-tr-none p-3 text-white text-sm">
              <div className="whitespace-pre-wrap leading-relaxed text-xs">
                {formatWhatsAppText(message.content)}
              </div>
              <div className="text-right mt-1">
                <span className="text-[10px] text-white/60">18:42</span>
              </div>
            </div>

            {message.buttons && message.buttons.length > 0 && (
              <div className="mt-1 space-y-[2px]">
                {message.buttons.map((btn, idx) => (
                  <button
                    key={btn.id}
                    className={cn(
                      'w-full bg-[#1f2c34] text-[#00a884] text-xs py-2 text-center',
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
          {message.buttons && (
            <div className="mt-3 space-y-1">
              <div className="text-xs text-muted-foreground">IDs dos botões:</div>
              <div className="flex flex-wrap gap-1">
                {message.buttons.map((btn) => (
                  <code key={btn.id} className="text-[10px] bg-muted px-1.5 py-0.5 rounded">
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
  const [selectedMessage, setSelectedMessage] = useState<{
    content: string
    buttons?: { id: string; text: string }[]
  } | null>(null)

  const flows = {
    sticker: { nodes: stickerFlowNodes, edges: stickerFlowEdges },
    payment: { nodes: paymentFlowNodes, edges: paymentFlowEdges },
    twitter: { nodes: twitterFlowNodes, edges: twitterFlowEdges },
  }

  const [nodes, setNodes, onNodesChange] = useNodesState(flows.sticker.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(flows.sticker.edges)

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  )

  const handleFlowChange = (flow: string) => {
    setSelectedFlow(flow)
    setSelectedMessage(null)
    const flowData = flows[flow as keyof typeof flows]
    setNodes(flowData.nodes)
    setEdges(flowData.edges)
  }

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    const data = node.data as FlowNodeData
    if (data.message) {
      setSelectedMessage(data.message)
    } else {
      setSelectedMessage(null)
    }
  }, [])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Visualizador de Fluxos</h1>
        <p className="text-muted-foreground">
          Explore os fluxos do bot de forma interativa. Clique nos nós 💬 para ver a mensagem.
        </p>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-green-500" />
          <span className="text-sm">⚡ Trigger</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-blue-500" />
          <span className="text-sm">⚙️ Ação</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-purple-500" />
          <span className="text-sm">💬 Mensagem (clicável)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-yellow-500" />
          <span className="text-sm">❓ Decisão</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-gray-500" />
          <span className="text-sm">✅ Fim</span>
        </div>
      </div>

      {/* Flow Tabs */}
      <Tabs value={selectedFlow} onValueChange={handleFlowChange}>
        <TabsList>
          <TabsTrigger value="sticker" className="gap-2">
            <Zap className="h-4 w-4" />
            Fluxo Principal
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
          <Card className="overflow-hidden">
            <div className="h-[600px] relative">
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={onNodeClick}
                nodeTypes={nodeTypes}
                fitView
                attributionPosition="bottom-left"
                defaultEdgeOptions={{
                  style: { stroke: 'hsl(var(--muted-foreground))', strokeWidth: 2 },
                  type: 'smoothstep',
                }}
              >
                <Controls className="!bg-background !border-border" />
                <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="hsl(var(--muted))" />
              </ReactFlow>

              {/* Message Preview */}
              {selectedMessage && (
                <MessagePreview
                  message={selectedMessage}
                  onClose={() => setSelectedMessage(null)}
                />
              )}
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Instructions */}
      <Card>
        <CardContent className="pt-4">
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
              <Badge variant="outline">Clique</Badge>
              <span>Ver mensagem (nós roxos)</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
