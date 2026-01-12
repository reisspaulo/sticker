'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Search,
  MousePointer,
  ArrowRight,
  Copy,
  Check,
  CreditCard,
  Twitter,
  Sparkles,
  MessageSquare,
  Zap,
  Gift,
  Settings
} from 'lucide-react'
import { Button } from '@/components/ui/button'

// Definição dos botões do bot
interface BotButton {
  id: string
  text: string
  category: 'upgrade' | 'pagamento' | 'twitter' | 'sticker' | 'plano' | 'confirmacao'
  context: string
  action: string
  nextMessage?: string
  file?: string
  notes?: string
}

const buttons: BotButton[] = [
  // ============ UPGRADE ============
  {
    id: 'button_upgrade_premium',
    text: '💰 Premium - R$ 5/mês',
    category: 'upgrade',
    context: 'Menu de limite atingido',
    action: 'Salva plano selecionado no Redis e envia lista de métodos de pagamento',
    nextMessage: 'Lista de métodos de pagamento (Cartão, Boleto, PIX)',
    file: 'webhook.ts',
  },
  {
    id: 'button_upgrade_ultra',
    text: '🚀 Ultra - R$ 9,90/mês',
    category: 'upgrade',
    context: 'Menu de limite atingido',
    action: 'Salva plano selecionado no Redis e envia lista de métodos de pagamento',
    nextMessage: 'Lista de métodos de pagamento (Cartão, Boleto, PIX)',
    file: 'webhook.ts',
  },
  {
    id: 'button_use_bonus',
    text: '🎁 Usar Bônus (+2)',
    category: 'upgrade',
    context: 'Menu de limite atingido (grupo bonus)',
    action: 'Incrementa bonus_credits_today e libera +2 stickers extras',
    nextMessage: 'Confirmação de bônus ativado',
    notes: '⚠️ DESATIVADO - Experimento bonus foi pausado',
    file: 'webhook.ts',
  },

  // ============ PLANO ============
  {
    id: 'plan_free',
    text: '🆓 Gratuito',
    category: 'plano',
    context: 'Lista de planos',
    action: 'Mostra informações do plano gratuito atual',
    nextMessage: 'Detalhes do plano gratuito',
    file: 'webhook.ts',
  },
  {
    id: 'plan_premium',
    text: '💰 Premium - R$ 5,00/mês',
    category: 'plano',
    context: 'Lista de planos',
    action: 'Salva plano selecionado e envia métodos de pagamento',
    nextMessage: 'Lista de métodos de pagamento',
    file: 'webhook.ts',
  },
  {
    id: 'plan_ultra',
    text: '🚀 Ultra - R$ 9,90/mês',
    category: 'plano',
    context: 'Lista de planos',
    action: 'Salva plano selecionado e envia métodos de pagamento',
    nextMessage: 'Lista de métodos de pagamento',
    file: 'webhook.ts',
  },

  // ============ PAGAMENTO ============
  {
    id: 'payment_card',
    text: '💳 Cartão de Crédito',
    category: 'pagamento',
    context: 'Lista de métodos de pagamento',
    action: 'Gera link Stripe com metadata do usuário e envia',
    nextMessage: 'Link de pagamento Stripe',
    file: 'webhook.ts',
  },
  {
    id: 'payment_boleto',
    text: '🧾 Boleto Bancário',
    category: 'pagamento',
    context: 'Lista de métodos de pagamento',
    action: 'Gera link Stripe para boleto',
    nextMessage: 'Link de pagamento Stripe (boleto)',
    file: 'webhook.ts',
  },
  {
    id: 'payment_pix',
    text: '🔑 PIX',
    category: 'pagamento',
    context: 'Lista de métodos de pagamento',
    action: 'Cria pix_payment no banco, gera chave PIX UUID e envia 3 mensagens sequenciais',
    nextMessage: 'Instruções + Chave PIX + Botão "Já Paguei"',
    file: 'webhook.ts',
  },
  {
    id: 'button_confirm_pix',
    text: '✅ Já Paguei',
    category: 'confirmacao',
    context: 'Após envio da chave PIX',
    action: 'Busca plano do Redis, ativa assinatura instantaneamente, atualiza daily_limit e reseta daily_count',
    nextMessage: 'Mensagem de pagamento confirmado + benefícios ativados',
    notes: 'Ativação instantânea (trust-based) - não verifica comprovante',
    file: 'webhook.ts',
  },

  // ============ TWITTER ============
  {
    id: 'button_twitter_learn',
    text: '🎬 Quero conhecer!',
    category: 'twitter',
    context: 'Apresentação da feature Twitter (após 3ª figurinha)',
    action: 'Envia tutorial completo de como usar a feature Twitter',
    nextMessage: 'Tutorial Twitter com exemplos',
    file: 'onboardingService.ts',
  },
  {
    id: 'button_twitter_dismiss',
    text: '⏭️ Agora não',
    category: 'twitter',
    context: 'Apresentação da feature Twitter',
    action: 'Registra dismiss e envia mensagem amigável',
    nextMessage: 'Mensagem de "tudo bem, pode conhecer depois"',
    file: 'onboardingService.ts',
  },
  {
    id: 'button_convert_sticker',
    text: '✅ Sim, quero sticker!',
    category: 'twitter',
    context: 'Após baixar vídeo do Twitter',
    action: 'Converte o vídeo baixado em figurinha animada WebP',
    nextMessage: 'Sticker animado enviado',
    file: 'worker.ts',
  },
  {
    id: 'button_skip_convert',
    text: '⏭️ Só o vídeo',
    category: 'twitter',
    context: 'Após baixar vídeo do Twitter',
    action: 'Apenas confirma que usuário só queria o vídeo (nenhuma ação adicional)',
    nextMessage: 'Nenhuma (silencioso)',
    file: 'worker.ts',
  },

  // ============ STICKER EDIÇÃO ============
  {
    id: 'button_remove_borders',
    text: '🧹 Remover Bordas',
    category: 'sticker',
    context: 'Botões de edição pós-sticker',
    action: 'Busca sticker do Storage, remove bordas brancas com Sharp, reenvia',
    nextMessage: 'Sticker sem bordas',
    notes: '⚠️ DESATIVADO - Botões de edição não são mais enviados',
    file: 'worker.ts',
  },
  {
    id: 'button_remove_background',
    text: '✨ Remover Fundo',
    category: 'sticker',
    context: 'Botões de edição pós-sticker',
    action: 'Busca imagem ORIGINAL via Evolution API, executa rembg (IA), converte para sticker',
    nextMessage: 'Sticker sem fundo',
    notes: '⚠️ DESATIVADO - Usa modelo U²-Net, leva 10-30s',
    file: 'worker.ts',
  },
  {
    id: 'button_sticker_perfect',
    text: '✅ Está perfeita!',
    category: 'sticker',
    context: 'Botões de edição pós-sticker',
    action: 'Apenas confirma satisfação (nenhuma ação adicional)',
    nextMessage: 'Nenhuma (silencioso)',
    notes: '⚠️ DESATIVADO',
    file: 'worker.ts',
  },

  // ============ CONFIRMAÇÃO/OUTROS ============
  {
    id: 'button_retry_pix_premium',
    text: '🔄 Gerar novo PIX (Premium)',
    category: 'confirmacao',
    context: 'PIX expirado ou erro',
    action: 'Gera nova chave PIX para plano Premium',
    nextMessage: 'Novo fluxo PIX (3 mensagens)',
    file: 'webhook.ts',
  },
  {
    id: 'button_retry_pix_ultra',
    text: '🔄 Gerar novo PIX (Ultra)',
    category: 'confirmacao',
    context: 'PIX expirado ou erro',
    action: 'Gera nova chave PIX para plano Ultra',
    nextMessage: 'Novo fluxo PIX (3 mensagens)',
    file: 'webhook.ts',
  },
  {
    id: 'button_contact_support',
    text: '💬 Falar com Suporte',
    category: 'confirmacao',
    context: 'Mensagens de erro ou dúvidas',
    action: 'Registra ticket de suporte no sistema',
    nextMessage: 'Mensagem de "aguarde contato"',
    file: 'webhook.ts',
  },
]

const categoryConfig = {
  upgrade: { label: 'Upgrade', icon: Sparkles, color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' },
  plano: { label: 'Planos', icon: CreditCard, color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  pagamento: { label: 'Pagamento', icon: CreditCard, color: 'bg-purple-500/10 text-purple-500 border-purple-500/20' },
  twitter: { label: 'Twitter', icon: Twitter, color: 'bg-sky-500/10 text-sky-500 border-sky-500/20' },
  sticker: { label: 'Sticker', icon: Sparkles, color: 'bg-pink-500/10 text-pink-500 border-pink-500/20' },
  confirmacao: { label: 'Confirmação', icon: Check, color: 'bg-green-500/10 text-green-500 border-green-500/20' },
}

function ButtonCard({ button }: { button: BotButton }) {
  const [copied, setCopied] = useState(false)
  const category = categoryConfig[button.category]
  const CategoryIcon = category.icon

  const copyId = () => {
    navigator.clipboard.writeText(button.id)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card className={button.notes?.includes('DESATIVADO') ? 'opacity-60' : ''}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-md ${category.color}`}>
              <CategoryIcon className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base font-medium">{button.text}</CardTitle>
              <CardDescription className="text-xs mt-0.5 font-mono">{button.id}</CardDescription>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={copyId}>
            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Context */}
        <div className="flex items-start gap-2">
          <Badge variant="outline" className="text-xs shrink-0">
            <MessageSquare className="h-3 w-3 mr-1" />
            Contexto
          </Badge>
          <span className="text-sm text-muted-foreground">{button.context}</span>
        </div>

        {/* Action */}
        <div className="flex items-start gap-2">
          <Badge variant="outline" className="text-xs shrink-0 bg-blue-500/10 text-blue-400 border-blue-500/20">
            <Zap className="h-3 w-3 mr-1" />
            Ação
          </Badge>
          <span className="text-sm text-muted-foreground">{button.action}</span>
        </div>

        {/* Next Message */}
        {button.nextMessage && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ArrowRight className="h-3 w-3" />
            <span>Resposta: {button.nextMessage}</span>
          </div>
        )}

        {/* File */}
        {button.file && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Settings className="h-3 w-3" />
            <span className="font-mono">{button.file}</span>
          </div>
        )}

        {/* Notes */}
        {button.notes && (
          <div className="text-xs text-yellow-500 bg-yellow-500/10 rounded-md p-2 border border-yellow-500/20">
            {button.notes}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function BotButtonsPage() {
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  const filteredButtons = buttons.filter((btn) => {
    const matchesSearch =
      btn.id.toLowerCase().includes(search.toLowerCase()) ||
      btn.text.toLowerCase().includes(search.toLowerCase()) ||
      btn.action.toLowerCase().includes(search.toLowerCase()) ||
      btn.context.toLowerCase().includes(search.toLowerCase())

    const matchesCategory = selectedCategory === 'all' || btn.category === selectedCategory

    return matchesSearch && matchesCategory
  })

  const activeButtons = buttons.filter(b => !b.notes?.includes('DESATIVADO'))
  const disabledButtons = buttons.filter(b => b.notes?.includes('DESATIVADO'))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Catálogo de Botões</h1>
        <p className="text-muted-foreground">
          Todos os botões interativos do bot, suas ações e próximos passos.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <MousePointer className="h-4 w-4 text-muted-foreground" />
              <span className="text-2xl font-bold">{buttons.length}</span>
            </div>
            <p className="text-xs text-muted-foreground">Total de Botões</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-green-500" />
              <span className="text-2xl font-bold">{activeButtons.length}</span>
            </div>
            <p className="text-xs text-muted-foreground">Ativos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Gift className="h-4 w-4 text-muted-foreground" />
              <span className="text-2xl font-bold">{disabledButtons.length}</span>
            </div>
            <p className="text-xs text-muted-foreground">Desativados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <span className="text-2xl font-bold">{Object.keys(categoryConfig).length}</span>
            </div>
            <p className="text-xs text-muted-foreground">Categorias</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar botões por ID, texto ou ação..."
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
            Todos ({buttons.length})
          </TabsTrigger>
          {Object.entries(categoryConfig).map(([key, config]) => {
            const count = buttons.filter(b => b.category === key).length
            return (
              <TabsTrigger
                key={key}
                value={key}
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                {config.label} ({count})
              </TabsTrigger>
            )
          })}
        </TabsList>

        <TabsContent value={selectedCategory} className="mt-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredButtons.map((button) => (
              <ButtonCard key={button.id} button={button} />
            ))}
          </div>

          {filteredButtons.length === 0 && (
            <div className="text-center py-12">
              <MousePointer className="h-12 w-12 mx-auto text-muted-foreground/50" />
              <p className="mt-2 text-muted-foreground">Nenhum botão encontrado</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Legend */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Legenda</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-green-500" />
            <span>Ativo em produção</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-yellow-500" />
            <span>Com observações</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-muted" />
            <span>Desativado</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
