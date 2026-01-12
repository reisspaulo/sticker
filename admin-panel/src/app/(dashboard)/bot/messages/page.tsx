'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Search,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Zap,
  CreditCard,
  HelpCircle,
  AlertTriangle,
  Twitter,
  Sparkles,
  Info,
  Code,
  ArrowRight
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Tipos
type MessageType = 'text' | 'buttons' | 'list'
type Category = 'onboarding' | 'limite' | 'planos' | 'pagamento' | 'twitter' | 'erro' | 'sticker'

interface BotMessage {
  id: string
  category: Category
  trigger: string
  title: string
  type: MessageType
  content: string
  buttons?: { id: string; text: string }[]
  listItems?: { id: string; title: string; desc: string }[]
  nextStep?: string
  notes?: string
  file?: string
  sequence?: string // ID da sequência (ex: 'pix_flow')
  sequenceOrder?: number // Ordem na sequência
}

// Sequências de mensagens (para carousel)
const sequences: Record<string, { title: string; description: string }> = {
  pix_flow: {
    title: 'Fluxo PIX',
    description: '3 mensagens enviadas em sequência quando usuário escolhe PIX'
  }
}

const messages: BotMessage[] = [
  // ============ ONBOARDING ============
  {
    id: 'welcome_new',
    category: 'onboarding',
    trigger: 'Usuário novo envia qualquer mensagem',
    title: 'Boas-vindas',
    type: 'text',
    content: `👋 Olá, {nome}! Eu sou o *StickerBot*!

📸 Me envie uma *imagem* ou *GIF* e eu transformo em figurinha instantaneamente!

🐦 Também baixo vídeos do *Twitter/X* - é só enviar o link!

🆓 Você tem *{limite} figurinhas grátis* por dia.

💡 Comandos: *planos* | *status* | *ajuda*`,
    nextStep: 'Aguarda mídia ou comando',
    file: 'menuService.ts → getWelcomeMessageForNewUser()',
  },

  // ============ LIMITE ATINGIDO ============
  {
    id: 'limit_reached',
    category: 'limite',
    trigger: 'Usuário tenta criar sticker mas atingiu limite',
    title: 'Limite Atingido',
    type: 'buttons',
    content: `⚠️ *Limite Atingido!* 🎨

Você já usou *4/4 figurinhas* hoje.

Seu limite será renovado às *00:00*.

💎 *FAÇA UPGRADE E TENHA MAIS!*

💰 *Premium* • 20/dia • R$ 5/mês
🚀 *Ultra* • ILIMITADO • R$ 9,90/mês`,
    buttons: [
      { id: 'button_upgrade_premium', text: '💰 Premium - R$ 5/mês' },
      { id: 'button_upgrade_ultra', text: '🚀 Ultra - R$ 9,90/mês' },
    ],
    nextStep: 'Fluxo de pagamento',
    notes: 'Botão dismiss removido para melhorar conversão',
    file: 'menuService.ts → sendLimitReachedMenu()',
  },

  // ============ PLANOS ============
  {
    id: 'plans_list',
    category: 'planos',
    trigger: 'Comando "planos" ou clique em upgrade',
    title: 'Lista de Planos',
    type: 'list',
    content: `💎 *ESCOLHA SEU PLANO*

Selecione o plano ideal para você:`,
    listItems: [
      { id: 'plan_free', title: '🆓 Gratuito', desc: '4 figurinhas/dia • 4 vídeos Twitter/dia' },
      { id: 'plan_premium', title: '💰 Premium - R$ 5,00/mês', desc: '20 figurinhas/dia • 15 vídeos Twitter/dia' },
      { id: 'plan_ultra', title: '🚀 Ultra - R$ 9,90/mês', desc: 'ILIMITADO • Processamento prioritário' },
    ],
    nextStep: 'Detalhes do plano ou pagamento',
    file: 'menuService.ts → sendPlansListMenu()',
  },

  // ============ PAGAMENTO ============
  {
    id: 'payment_methods',
    category: 'pagamento',
    trigger: 'Usuário confirma plano Premium ou Ultra',
    title: 'Métodos de Pagamento',
    type: 'list',
    content: `💰 *PAGAMENTO - PLANO PREMIUM*

Valor: R$ 5,00/mês

Escolha sua forma de pagamento:`,
    listItems: [
      { id: 'payment_card', title: '💳 Cartão de Crédito', desc: 'Pagamento instantâneo via Stripe' },
      { id: 'payment_boleto', title: '🧾 Boleto Bancário', desc: 'Confirmação em até 3 dias úteis' },
      { id: 'payment_pix', title: '🔑 PIX', desc: 'Pagamento instantâneo • Ativação em 5 minutos' },
    ],
    nextStep: 'Link de pagamento ou fluxo PIX',
    file: 'menuService.ts → sendPaymentMethodList()',
  },
  {
    id: 'pix_instructions',
    category: 'pagamento',
    trigger: 'Usuário escolhe PIX',
    title: 'Instruções PIX',
    type: 'text',
    content: `💰 *Pagamento via PIX*

📋 *Plano:* Premium
💵 *Valor:* R$ 5,00

📝 *COMO PAGAR:*

1️⃣ Copie a chave PIX abaixo
2️⃣ Abra seu app de banco
3️⃣ Cole a chave e pague R$ 5,00
4️⃣ Clique em "✅ Já Paguei"

⏱️ Você tem 30 minutos para pagar`,
    nextStep: 'Chave PIX',
    sequence: 'pix_flow',
    sequenceOrder: 1,
    file: 'menuService.ts → sendPixPaymentWithButton()',
  },
  {
    id: 'pix_key',
    category: 'pagamento',
    trigger: 'Sequência automática',
    title: 'Chave PIX',
    type: 'text',
    content: `🔑 a1b2c3d4-e5f6-7890-abcd-ef1234567890`,
    nextStep: 'Botão de confirmação',
    notes: 'Enviada via Avisa API com botão de copiar',
    sequence: 'pix_flow',
    sequenceOrder: 2,
    file: 'avisaApi.ts → sendPixButton()',
  },
  {
    id: 'pix_confirm_button',
    category: 'pagamento',
    trigger: 'Sequência automática',
    title: 'Confirmar Pagamento',
    type: 'buttons',
    content: `✅ *Pagou?*

Clique no botão abaixo após fazer o PIX:`,
    buttons: [
      { id: 'button_confirm_pix', text: '✅ Já Paguei' },
    ],
    nextStep: 'Ativação do plano',
    sequence: 'pix_flow',
    sequenceOrder: 3,
    file: 'menuService.ts → sendPixPaymentWithButton()',
  },
  {
    id: 'payment_success',
    category: 'pagamento',
    trigger: 'Clique em "Já Paguei" ou webhook Stripe',
    title: 'Pagamento Confirmado',
    type: 'text',
    content: `🎉 *PAGAMENTO CONFIRMADO!*

Seu plano *Premium 💰* foi ativado!

✅ *Benefícios liberados:*
• 20 figurinhas/dia
• 15 vídeos Twitter/dia
• Suporte prioritário ⚡

🚀 Já pode usar agora mesmo!`,
    nextStep: 'Uso normal liberado',
    file: 'menuService.ts → getSubscriptionActivatedMessage()',
  },
  {
    id: 'payment_link',
    category: 'pagamento',
    trigger: 'Usuário escolhe Cartão ou Boleto',
    title: 'Link de Pagamento',
    type: 'text',
    content: `🎉 *Ótima escolha!*

Plano *Premium* por R$ 5,00/mês.

🔗 *Clique para pagar:*
https://buy.stripe.com/xxx...

✅ Pagamento 100% seguro via Stripe
⚡ Ativação instantânea após confirmação`,
    nextStep: 'Aguarda webhook Stripe',
    file: 'menuService.ts → getPaymentLinkMessage()',
  },

  // ============ TWITTER ============
  {
    id: 'twitter_feature_intro',
    category: 'twitter',
    trigger: 'Após 3ª figurinha criada',
    title: 'Apresentação Twitter',
    type: 'buttons',
    content: `🎉 *Você já criou 3 figurinhas!*

Parabéns! 👏

💡 Sabia que também posso *baixar vídeos do X (Twitter)*?`,
    buttons: [
      { id: 'button_twitter_learn', text: '🎬 Quero conhecer!' },
      { id: 'button_twitter_dismiss', text: '⏭️ Agora não' },
    ],
    nextStep: 'Tutorial ou dismiss',
    notes: 'Trigger baseado no daily_limit do experimento',
    file: 'onboardingService.ts → sendTwitterFeaturePresentation()',
  },
  {
    id: 'twitter_tutorial',
    category: 'twitter',
    trigger: 'Clique em "Quero conhecer!"',
    title: 'Tutorial Twitter',
    type: 'text',
    content: `📱 *Perfeito!*

🎬 *Para BAIXAR o vídeo:*
Envie o link e eu baixo!

🎨 *Para fazer FIGURINHA:*
Depois de baixar, você escolhe se quer converter.

📋 *Exemplo de link:*
https://x.com/usuario/status/123...

✨ Seu plano: 4 vídeos/dia

Experimente agora! 🚀`,
    nextStep: 'Aguarda link do Twitter',
    file: 'onboardingService.ts → handleTwitterLearnMore()',
  },
  {
    id: 'twitter_video_convert',
    category: 'twitter',
    trigger: 'Após baixar vídeo do Twitter',
    title: 'Converter para Sticker?',
    type: 'buttons',
    content: `🎨 *Quer transformar em figurinha?*`,
    buttons: [
      { id: 'button_convert_sticker', text: '✅ Sim, quero sticker!' },
      { id: 'button_skip_convert', text: '⏭️ Só o vídeo' },
    ],
    nextStep: 'Converte ou finaliza',
    notes: 'GIFs viram sticker automaticamente',
    file: 'worker.ts',
  },

  // ============ STICKER EDIÇÃO ============
  {
    id: 'sticker_edit_buttons',
    category: 'sticker',
    trigger: 'Após enviar sticker',
    title: 'Botões de Edição',
    type: 'buttons',
    content: `🎨 *Gostou da figurinha?*

Quer fazer alguma edição?`,
    buttons: [
      { id: 'button_remove_borders', text: '🧹 Remover Bordas' },
      { id: 'button_remove_background', text: '✨ Remover Fundo' },
      { id: 'button_sticker_perfect', text: '✅ Está perfeita!' },
    ],
    nextStep: 'Edição ou confirmação',
    notes: '⚠️ DESATIVADO em produção',
    file: 'menuService.ts → sendStickerEditButtons()',
  },

  // ============ AJUDA/ERRO ============
  {
    id: 'help',
    category: 'erro',
    trigger: 'Comando "ajuda" ou "help"',
    title: 'Mensagem de Ajuda',
    type: 'text',
    content: `❓ *AJUDA - StickerBot*

🎨 *COMO USAR:*
1. Envie uma imagem ou GIF
2. Receba sua figurinha!
3. Para Twitter, envie o link

💎 *COMANDOS:*
• *planos* - Ver planos
• *status* - Ver assinatura
• *ajuda* - Esta mensagem

💳 *PAGAMENTO:*
Cartão, Pix ou boleto via Stripe`,
    nextStep: 'Aguarda ação',
    file: 'menuService.ts → getHelpMessage()',
  },
  {
    id: 'status',
    category: 'planos',
    trigger: 'Comando "status"',
    title: 'Status da Assinatura',
    type: 'text',
    content: `✨ *Sua Assinatura*

📋 Plano: *Premium 💰*
📅 Renova em: 25 dias
🔄 Status: Ativo

🎯 *Seus Limites:*
• 20 figurinhas/dia
• 15 vídeos Twitter/dia`,
    nextStep: 'Aguarda ação',
    file: 'menuService.ts → getSubscriptionActiveMessage()',
  },
  {
    id: 'error',
    category: 'erro',
    trigger: 'Erro no processamento',
    title: 'Mensagem de Erro',
    type: 'text',
    content: `😔 Ops! Algo deu errado.

Por favor, tente novamente.

Se persistir, digite *ajuda*.`,
    nextStep: 'Tenta novamente',
    file: 'menuService.ts → getErrorMessage()',
  },
]

const categoryConfig = {
  onboarding: { label: 'Onboarding', icon: Sparkles, color: 'text-green-500' },
  limite: { label: 'Limite', icon: AlertTriangle, color: 'text-yellow-500' },
  planos: { label: 'Planos', icon: CreditCard, color: 'text-blue-500' },
  pagamento: { label: 'Pagamento', icon: CreditCard, color: 'text-purple-500' },
  twitter: { label: 'Twitter', icon: Twitter, color: 'text-sky-500' },
  erro: { label: 'Ajuda/Erro', icon: HelpCircle, color: 'text-red-500' },
  sticker: { label: 'Sticker', icon: Sparkles, color: 'text-pink-500' },
}

// Componente de preview estilo WhatsApp
function WhatsAppPreview({ message }: { message: BotMessage }) {
  // Formata o texto com negrito do WhatsApp (*texto*)
  const formatWhatsAppText = (text: string) => {
    return text.split(/(\*[^*]+\*)/).map((part, i) => {
      if (part.startsWith('*') && part.endsWith('*')) {
        return <strong key={i}>{part.slice(1, -1)}</strong>
      }
      return part
    })
  }

  return (
    <div className="bg-[#0b141a] rounded-xl p-4 max-w-sm">
      {/* Mensagem */}
      <div className="bg-[#005c4b] rounded-lg rounded-tr-none p-3 text-white text-sm">
        <div className="whitespace-pre-wrap leading-relaxed">
          {formatWhatsAppText(message.content)}
        </div>
        <div className="text-right mt-1">
          <span className="text-[10px] text-white/60">18:42</span>
        </div>
      </div>

      {/* Botões (estilo WhatsApp) */}
      {message.buttons && message.buttons.length > 0 && (
        <div className="mt-1 space-y-[2px]">
          {message.buttons.map((btn, idx) => (
            <button
              key={btn.id}
              className={cn(
                "w-full bg-[#1f2c34] text-[#00a884] text-sm py-3 text-center",
                idx === 0 && "rounded-t-lg",
                idx === message.buttons!.length - 1 && "rounded-b-lg"
              )}
            >
              {btn.text}
            </button>
          ))}
        </div>
      )}

      {/* Lista (estilo WhatsApp) */}
      {message.listItems && message.listItems.length > 0 && (
        <div className="mt-1">
          <button className="w-full bg-[#1f2c34] text-[#00a884] text-sm py-3 rounded-lg flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M3 4h18v2H3V4zm0 7h18v2H3v-2zm0 7h18v2H3v-2z"/>
            </svg>
            Ver opções
          </button>
          <div className="mt-2 space-y-1">
            {message.listItems.map((item) => (
              <div key={item.id} className="bg-[#1f2c34] rounded-lg p-2">
                <div className="text-white text-sm font-medium">{item.title}</div>
                <div className="text-white/60 text-xs">{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Componente de carousel para sequências
function MessageSequenceCarousel({ sequenceId, sequenceMessages }: { sequenceId: string; sequenceMessages: BotMessage[] }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const sequence = sequences[sequenceId]
  const sortedMessages = [...sequenceMessages].sort((a, b) => (a.sequenceOrder || 0) - (b.sequenceOrder || 0))
  const currentMessage = sortedMessages[currentIndex]

  return (
    <Card className="overflow-hidden">
      <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 p-4 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">{sequence.title}</h3>
            <p className="text-sm text-muted-foreground">{sequence.description}</p>
          </div>
          <Badge variant="secondary">{sortedMessages.length} mensagens</Badge>
        </div>
      </div>

      <CardContent className="p-6">
        <div className="flex items-center gap-4">
          {/* Navegação esquerda */}
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
            disabled={currentIndex === 0}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          {/* Preview */}
          <div className="flex-1 flex flex-col items-center">
            <div className="text-sm text-muted-foreground mb-3">
              Mensagem {currentIndex + 1} de {sortedMessages.length}
            </div>
            <WhatsAppPreview message={currentMessage} />
            <div className="mt-4 text-center">
              <h4 className="font-medium">{currentMessage.title}</h4>
              <p className="text-sm text-muted-foreground">{currentMessage.trigger}</p>
            </div>
          </div>

          {/* Navegação direita */}
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentIndex(Math.min(sortedMessages.length - 1, currentIndex + 1))}
            disabled={currentIndex === sortedMessages.length - 1}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Indicadores */}
        <div className="flex justify-center gap-2 mt-4">
          {sortedMessages.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={cn(
                "w-2 h-2 rounded-full transition-colors",
                idx === currentIndex ? "bg-primary" : "bg-muted"
              )}
            />
          ))}
        </div>

        {/* Info técnica */}
        {currentMessage.file && (
          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Code className="h-3 w-3" />
            <span>{currentMessage.file}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Componente de card de mensagem individual
function MessageCard({ message }: { message: BotMessage }) {
  const category = categoryConfig[message.category]
  const CategoryIcon = category.icon
  const isDisabled = message.notes?.includes('DESATIVADO')

  return (
    <Card className={cn("overflow-hidden", isDisabled && "opacity-60")}>
      <CardContent className="p-0">
        <div className="flex flex-col lg:flex-row">
          {/* Preview WhatsApp */}
          <div className="bg-muted/30 p-6 flex items-center justify-center lg:w-80 shrink-0">
            <WhatsAppPreview message={message} />
          </div>

          {/* Info */}
          <div className="p-6 flex-1 space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <CategoryIcon className={cn("h-4 w-4", category.color)} />
                  <h3 className="font-semibold">{message.title}</h3>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{message.trigger}</p>
              </div>
              <Badge variant="outline" className="shrink-0">
                {message.type === 'buttons' ? 'Botões' : message.type === 'list' ? 'Lista' : 'Texto'}
              </Badge>
            </div>

            {/* Botões IDs */}
            {message.buttons && (
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">IDs dos botões:</div>
                <div className="flex flex-wrap gap-1">
                  {message.buttons.map((btn) => (
                    <code key={btn.id} className="text-xs bg-muted px-2 py-1 rounded">
                      {btn.id}
                    </code>
                  ))}
                </div>
              </div>
            )}

            {/* Lista IDs */}
            {message.listItems && (
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">IDs das opções:</div>
                <div className="flex flex-wrap gap-1">
                  {message.listItems.map((item) => (
                    <code key={item.id} className="text-xs bg-muted px-2 py-1 rounded">
                      {item.id}
                    </code>
                  ))}
                </div>
              </div>
            )}

            {/* Próximo passo */}
            {message.nextStep && (
              <div className="flex items-center gap-2 text-sm">
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Próximo:</span>
                <span>{message.nextStep}</span>
              </div>
            )}

            {/* Arquivo */}
            {message.file && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Code className="h-3 w-3" />
                <span>{message.file}</span>
              </div>
            )}

            {/* Notas */}
            {message.notes && (
              <div className={cn(
                "flex items-start gap-2 text-xs p-2 rounded",
                isDisabled ? "bg-red-500/10 text-red-400" : "bg-yellow-500/10 text-yellow-500"
              )}>
                <Info className="h-3 w-3 mt-0.5 shrink-0" />
                <span>{message.notes}</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function BotMessagesPage() {
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  // Agrupa mensagens por sequência
  const sequenceGroups = messages.reduce((acc, msg) => {
    if (msg.sequence) {
      if (!acc[msg.sequence]) acc[msg.sequence] = []
      acc[msg.sequence].push(msg)
    }
    return acc
  }, {} as Record<string, BotMessage[]>)

  // Mensagens sem sequência
  const standaloneMessages = messages.filter(msg => !msg.sequence)

  // Filtra
  const filteredStandalone = standaloneMessages.filter((msg) => {
    const matchesSearch =
      msg.title.toLowerCase().includes(search.toLowerCase()) ||
      msg.content.toLowerCase().includes(search.toLowerCase()) ||
      msg.trigger.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = selectedCategory === 'all' || msg.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  // Filtra sequências
  const filteredSequences = Object.entries(sequenceGroups).filter(([_, msgs]) => {
    if (selectedCategory !== 'all' && !msgs.some(m => m.category === selectedCategory)) return false
    if (search) {
      return msgs.some(m =>
        m.title.toLowerCase().includes(search.toLowerCase()) ||
        m.content.toLowerCase().includes(search.toLowerCase())
      )
    }
    return true
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Catálogo de Mensagens</h1>
        <p className="text-muted-foreground">
          Visualize todas as mensagens do bot como elas aparecem no WhatsApp.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <span className="text-2xl font-bold">{messages.length}</span>
            </div>
            <p className="text-xs text-muted-foreground">Mensagens</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-muted-foreground" />
              <span className="text-2xl font-bold">{Object.keys(sequenceGroups).length}</span>
            </div>
            <p className="text-xs text-muted-foreground">Sequências</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">
                {messages.filter(m => m.type === 'buttons').length}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">Com Botões</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">
                {messages.filter(m => m.type === 'list').length}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">Com Lista</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar mensagens..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Category Tabs */}
      <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
        <TabsList className="flex-wrap h-auto gap-1 bg-transparent p-0">
          <TabsTrigger
            value="all"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            Todas
          </TabsTrigger>
          {Object.entries(categoryConfig).map(([key, config]) => (
            <TabsTrigger
              key={key}
              value={key}
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              {config.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={selectedCategory} className="mt-6 space-y-6">
          {/* Sequências primeiro */}
          {filteredSequences.map(([seqId, seqMessages]) => (
            <MessageSequenceCarousel key={seqId} sequenceId={seqId} sequenceMessages={seqMessages} />
          ))}

          {/* Mensagens individuais */}
          {filteredStandalone.map((message) => (
            <MessageCard key={message.id} message={message} />
          ))}

          {filteredStandalone.length === 0 && filteredSequences.length === 0 && (
            <div className="text-center py-12">
              <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/50" />
              <p className="mt-2 text-muted-foreground">Nenhuma mensagem encontrada</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
