'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Search,
  MessageSquare,
  MousePointer,
  ArrowRight,
  Copy,
  Check,
  Zap,
  CreditCard,
  Gift,
  HelpCircle,
  AlertTriangle,
  Twitter,
  Sparkles
} from 'lucide-react'
import { Button } from '@/components/ui/button'

// Definição das mensagens do bot
interface BotMessage {
  id: string
  category: 'onboarding' | 'limite' | 'planos' | 'pagamento' | 'twitter' | 'erro' | 'sticker'
  trigger: string
  triggerType: 'auto' | 'comando' | 'botao' | 'evento'
  title: string
  content: string
  buttons?: { id: string; text: string }[]
  nextStep?: string
  notes?: string
  file?: string
  function?: string
}

const messages: BotMessage[] = [
  // ============ ONBOARDING ============
  {
    id: 'welcome_new',
    category: 'onboarding',
    trigger: 'Usuário novo envia qualquer mensagem',
    triggerType: 'auto',
    title: 'Boas-vindas (Novo Usuário)',
    content: `👋 Olá, {nome}! Eu sou o *StickerBot*!

📸 Me envie uma *imagem* ou *GIF* e eu transformo em figurinha instantaneamente!

🐦 Também baixo vídeos do *Twitter/X* - é só enviar o link!

🆓 Você tem *{limite} figurinhas grátis* por dia.

💡 Comandos: *planos* | *status* | *ajuda*`,
    nextStep: 'Aguarda mídia ou comando',
    file: 'menuService.ts',
    function: 'getWelcomeMessageForNewUser()',
  },
  {
    id: 'welcome_short',
    category: 'onboarding',
    trigger: 'Versão curta para Time to Value',
    triggerType: 'auto',
    title: 'Boas-vindas (Curta)',
    content: `🎉 Olá {nome}, bem-vindo ao *StickerBot*!

Envie uma imagem, vídeo ou GIF agora mesmo que eu transformo em figurinha! 🎨`,
    nextStep: 'Aguarda mídia',
    file: 'menuService.ts',
    function: 'getWelcomeMenu()',
  },

  // ============ LIMITE ATINGIDO ============
  {
    id: 'limit_reached',
    category: 'limite',
    trigger: 'Usuário tenta criar sticker mas atingiu limite',
    triggerType: 'auto',
    title: 'Limite Atingido',
    content: `⚠️ *Limite Atingido!* 🎨

Você já usou *{count}/{limit} figurinhas* hoje.

Seu limite será renovado às *00:00* (horário de Brasília).

💎 *FAÇA UPGRADE E TENHA MAIS!*

💰 *Premium (R$ 5/mês)*
• 20 figurinhas/dia
• 15 vídeos Twitter/dia

🚀 *Ultra (R$ 9,90/mês)*
• Figurinhas *ILIMITADAS*
• Vídeos Twitter *ILIMITADOS*
• Processamento prioritário`,
    buttons: [
      { id: 'button_upgrade_premium', text: '💰 Premium - R$ 5/mês' },
      { id: 'button_upgrade_ultra', text: '🚀 Ultra - R$ 9,90/mês' },
    ],
    nextStep: 'Fluxo de pagamento',
    notes: 'Botão dismiss foi removido para melhorar conversão',
    file: 'menuService.ts',
    function: 'sendLimitReachedMenu()',
  },
  {
    id: 'limit_twitter',
    category: 'limite',
    trigger: 'Usuário tenta baixar Twitter mas atingiu limite',
    triggerType: 'auto',
    title: 'Limite Twitter Atingido',
    content: `⚠️ *Limite Atingido!* 🐦

Você já usou *{count}/{limit} vídeos do Twitter* hoje.

Seu limite será renovado às *00:00* (horário de Brasília).`,
    buttons: [
      { id: 'button_upgrade_premium', text: '💰 Premium - R$ 5/mês' },
      { id: 'button_upgrade_ultra', text: '🚀 Ultra - R$ 9,90/mês' },
    ],
    nextStep: 'Fluxo de pagamento',
    file: 'menuService.ts',
    function: 'sendLimitReachedMenu()',
  },

  // ============ PLANOS ============
  {
    id: 'plans_list',
    category: 'planos',
    trigger: 'Usuário digita "planos" ou clica em upgrade',
    triggerType: 'comando',
    title: 'Lista de Planos',
    content: `💎 *ESCOLHA SEU PLANO*

Selecione o plano ideal para você:`,
    buttons: [
      { id: 'plan_free', text: '🆓 Gratuito - {limit} figurinhas/dia' },
      { id: 'plan_premium', text: '💰 Premium - R$ 5,00/mês - 20/dia' },
      { id: 'plan_ultra', text: '🚀 Ultra - R$ 9,90/mês - ILIMITADO' },
    ],
    nextStep: 'Detalhes do plano ou pagamento',
    notes: 'Lista interativa via Avisa API',
    file: 'menuService.ts',
    function: 'sendPlansListMenu()',
  },
  {
    id: 'plan_premium_details',
    category: 'planos',
    trigger: 'Usuário seleciona Premium',
    triggerType: 'botao',
    title: 'Detalhes Premium',
    content: `💰 *PLANO PREMIUM*
R$ 5,00/mês - Cancele quando quiser

✨ *BENEFÍCIOS:*
✅ 20 figurinhas por dia
✅ 15 vídeos do Twitter por dia
✅ Suporte prioritário
✅ 5x mais que o plano gratuito!

📊 *COMPARAÇÃO:*
Plano Gratuito: {limite} figurinhas/dia
Plano Premium: 20 figurinhas/dia (+400%!)

🎯 *PERFEITO PARA:*
• Quem usa figurinhas regularmente
• Grupos de amigos
• Criadores de conteúdo

Digite *CONFIRMAR* para assinar agora!
Digite *VOLTAR* para ver outros planos.`,
    nextStep: 'Escolha método de pagamento',
    file: 'menuService.ts',
    function: 'getPlanDetailsMenu("premium")',
  },
  {
    id: 'plan_ultra_details',
    category: 'planos',
    trigger: 'Usuário seleciona Ultra',
    triggerType: 'botao',
    title: 'Detalhes Ultra',
    content: `🚀 *PLANO ULTRA*
R$ 9,90/mês - Cancele quando quiser

🔥 *BENEFÍCIOS:*
✅ Figurinhas *ILIMITADAS*
✅ Vídeos Twitter *ILIMITADOS*
✅ Processamento prioritário
✅ Suporte VIP
✅ Nunca mais espere!

📊 *COMPARAÇÃO:*
Plano Gratuito: {limite} figurinhas/dia
Plano Premium: 20 figurinhas/dia
Plano Ultra: *ILIMITADO* 🔥

🎯 *PERFEITO PARA:*
• Uso intensivo
• Negócios e marketing
• Administradores de grupos
• Criadores profissionais

Digite *CONFIRMAR* para assinar agora!
Digite *VOLTAR* para ver outros planos.`,
    nextStep: 'Escolha método de pagamento',
    file: 'menuService.ts',
    function: 'getPlanDetailsMenu("ultra")',
  },

  // ============ PAGAMENTO ============
  {
    id: 'payment_methods',
    category: 'pagamento',
    trigger: 'Usuário confirma plano',
    triggerType: 'botao',
    title: 'Métodos de Pagamento',
    content: `💰 *PAGAMENTO - PLANO {PLANO}*

Valor: R$ {valor}/mês

Escolha sua forma de pagamento:`,
    buttons: [
      { id: 'payment_card', text: '💳 Cartão de Crédito' },
      { id: 'payment_boleto', text: '🧾 Boleto Bancário' },
      { id: 'payment_pix', text: '🔑 PIX' },
    ],
    nextStep: 'Link de pagamento ou PIX',
    notes: 'Lista interativa via Avisa API',
    file: 'menuService.ts',
    function: 'sendPaymentMethodList()',
  },
  {
    id: 'pix_instructions',
    category: 'pagamento',
    trigger: 'Usuário escolhe PIX',
    triggerType: 'botao',
    title: 'Instruções PIX (Msg 1/3)',
    content: `💰 *Pagamento via PIX*

📋 *Plano:* {plano}
💵 *Valor:* R$ {valor}

📝 *COMO PAGAR:*

1️⃣ Copie a chave PIX que vou enviar agora
2️⃣ Abra seu app de pagamento
3️⃣ Cole a chave e pague R$ {valor}
4️⃣ Após pagar, clique em "✅ Já Paguei"

⏱️ *Importante:*
• Você tem 30 minutos para pagar
• Ativação em até 5 minutos após confirmação

Enviando chave PIX... ⬇️`,
    nextStep: 'Envia chave PIX',
    file: 'menuService.ts',
    function: 'sendPixPaymentWithButton()',
  },
  {
    id: 'pix_key',
    category: 'pagamento',
    trigger: 'Sequência do fluxo PIX',
    triggerType: 'auto',
    title: 'Chave PIX (Msg 2/3)',
    content: `🔑 {chave-pix-uuid}

(Botão de copiar automático via Avisa API)`,
    nextStep: 'Botão de confirmação',
    notes: 'Enviada via sendPixButton() - fácil de copiar',
    file: 'avisaApi.ts',
    function: 'sendPixButton()',
  },
  {
    id: 'pix_confirm_button',
    category: 'pagamento',
    trigger: 'Sequência do fluxo PIX',
    triggerType: 'auto',
    title: 'Botão Já Paguei (Msg 3/3)',
    content: `✅ *Pagou?*

Clique no botão abaixo após fazer o PIX:`,
    buttons: [
      { id: 'button_confirm_pix', text: '✅ Já Paguei' },
    ],
    nextStep: 'Ativação do plano',
    file: 'menuService.ts',
    function: 'sendPixPaymentWithButton()',
  },
  {
    id: 'payment_success',
    category: 'pagamento',
    trigger: 'Usuário clica "Já Paguei" ou webhook Stripe',
    triggerType: 'botao',
    title: 'Pagamento Confirmado',
    content: `🎉 *PAGAMENTO CONFIRMADO!*

Seu plano *{plano}* foi ativado com sucesso!

✅ *Benefícios liberados:*
• Figurinhas: {limite_figurinhas}/dia
• Vídeos Twitter: {limite_twitter}/dia
• Processamento prioritário ⚡

🚀 *Já pode usar agora mesmo!*
Envie suas imagens e GIFs para criar figurinhas incríveis!

Dúvidas? Digite *ajuda*`,
    nextStep: 'Usuário pode usar normalmente',
    file: 'menuService.ts',
    function: 'getSubscriptionActivatedMessage()',
  },
  {
    id: 'payment_link',
    category: 'pagamento',
    trigger: 'Usuário escolhe Cartão ou Boleto',
    triggerType: 'botao',
    title: 'Link de Pagamento (Stripe)',
    content: `🎉 *Ótima escolha!*

Você selecionou o plano *{plano}* por R$ {valor}/mês.

🔗 *Clique no link abaixo para pagar:*

{link_stripe}

✅ *Pagamento 100% seguro* via Stripe
💳 Cartão, Pix ou boleto
🔄 Cancele quando quiser

⚡ *Ativação instantânea:*
Assim que o pagamento for confirmado, seu plano será ativado automaticamente!

Tem dúvidas? Digite *ajuda*.`,
    nextStep: 'Aguarda webhook Stripe',
    file: 'menuService.ts',
    function: 'getPaymentLinkMessage()',
  },

  // ============ TWITTER ============
  {
    id: 'twitter_feature_intro',
    category: 'twitter',
    trigger: 'Após 3ª figurinha (ou min(daily_limit, 3))',
    triggerType: 'auto',
    title: 'Apresentação Feature Twitter',
    content: `🎉 *Você já criou {count} figurinhas!*

Parabéns, {nome}! 👏

💡 Sabia que também posso *baixar vídeos do X (Twitter)*?

Escolha o que você quer fazer:`,
    buttons: [
      { id: 'button_twitter_learn', text: '🎬 Quero conhecer!' },
      { id: 'button_twitter_dismiss', text: '⏭️ Agora não' },
    ],
    nextStep: 'Tutorial ou dismiss',
    notes: 'Trigger dinâmico baseado no daily_limit do experimento',
    file: 'onboardingService.ts',
    function: 'sendTwitterFeaturePresentation()',
  },
  {
    id: 'twitter_tutorial',
    category: 'twitter',
    trigger: 'Usuário clica "Quero conhecer!"',
    triggerType: 'botao',
    title: 'Tutorial Twitter',
    content: `📱 *Perfeito, {nome}!*

Agora você pode me enviar links do X (Twitter) de 2 formas:

🎬 *Para BAIXAR o vídeo:*
Envie o link normalmente e eu baixo para você!

🎨 *Para fazer FIGURINHA do vídeo:*
Depois que eu baixar, você escolhe se quer converter para figurinha animada.

📋 *Exemplo de link:*
https://x.com/usuario/status/123456789

✨ *Seu plano gratuito:* {limite} vídeos/dia

Experimente agora! 🚀`,
    nextStep: 'Aguarda link do Twitter',
    file: 'onboardingService.ts',
    function: 'handleTwitterLearnMore()',
  },
  {
    id: 'twitter_dismiss',
    category: 'twitter',
    trigger: 'Usuário clica "Agora não"',
    triggerType: 'botao',
    title: 'Twitter Dispensado',
    content: `Tudo bem, {nome}! 😊

Você pode conhecer essa funcionalidade quando quiser digitando *twitter* ou *ajuda*.

Continue enviando suas mídias! 🎨`,
    nextStep: 'Volta ao uso normal',
    file: 'onboardingService.ts',
    function: 'handleTwitterDismiss()',
  },
  {
    id: 'twitter_video_convert',
    category: 'twitter',
    trigger: 'Após baixar vídeo do Twitter',
    triggerType: 'auto',
    title: 'Converter para Sticker?',
    content: `🎨 *Quer transformar em figurinha?*`,
    buttons: [
      { id: 'button_convert_sticker', text: '✅ Sim, quero sticker!' },
      { id: 'button_skip_convert', text: '⏭️ Só o vídeo' },
    ],
    nextStep: 'Converte ou finaliza',
    notes: 'Apenas para vídeos, GIFs já viram sticker automaticamente',
    file: 'worker.ts',
  },

  // ============ STICKER/EDIÇÃO ============
  {
    id: 'sticker_edit_buttons',
    category: 'sticker',
    trigger: 'Após enviar sticker (DESATIVADO)',
    triggerType: 'auto',
    title: 'Botões de Edição',
    content: `🎨 *Gostou da figurinha?*

Quer fazer alguma edição?`,
    buttons: [
      { id: 'button_remove_borders', text: '🧹 Remover Bordas' },
      { id: 'button_remove_background', text: '✨ Remover Fundo' },
      { id: 'button_sticker_perfect', text: '✅ Está perfeita!' },
    ],
    nextStep: 'Edição ou confirmação',
    notes: '⚠️ DESATIVADO em produção - infraestrutura existe mas não é chamada',
    file: 'menuService.ts',
    function: 'sendStickerEditButtons()',
  },

  // ============ AJUDA/ERRO ============
  {
    id: 'help',
    category: 'erro',
    trigger: 'Usuário digita "ajuda" ou "help"',
    triggerType: 'comando',
    title: 'Mensagem de Ajuda',
    content: `❓ *AJUDA - StickerBot*

🎨 *COMO USAR:*
1. Envie uma imagem ou GIF
2. Receba sua figurinha pronta!
3. Para vídeos do Twitter, envie o link

💎 *COMANDOS:*
• *planos* - Ver planos disponíveis
• *status* - Ver sua assinatura
• *ajuda* - Ver esta mensagem

💳 *PAGAMENTO:*
• Aceitamos cartão, Pix e boleto
• Processamento via Stripe (seguro)
• Cobrança mensal automática
• Cancele quando quiser, sem multa

🔒 *SEGURANÇA:*
Seus dados estão protegidos. Não armazenamos informações de cartão.

Mais dúvidas? Envie sua pergunta que respondo!`,
    nextStep: 'Aguarda ação do usuário',
    file: 'menuService.ts',
    function: 'getHelpMessage()',
  },
  {
    id: 'status',
    category: 'planos',
    trigger: 'Usuário digita "status"',
    triggerType: 'comando',
    title: 'Status da Assinatura',
    content: `✨ *Sua Assinatura*

📋 Plano: *{plano}*
📅 Renova em: {dias} dias
🔄 Status: Ativo

🎯 *Seus Limites:*
• Figurinhas: {limite_figurinhas}/dia
• Vídeos Twitter: {limite_twitter}/dia
• Processamento prioritário ⚡

Continue enviando suas imagens e GIFs! 🎨`,
    nextStep: 'Aguarda ação do usuário',
    file: 'menuService.ts',
    function: 'getSubscriptionActiveMessage()',
  },
  {
    id: 'error',
    category: 'erro',
    trigger: 'Erro no processamento',
    triggerType: 'auto',
    title: 'Mensagem de Erro',
    content: `😔 Ops! Algo deu errado.

Por favor, tente novamente em alguns instantes.

Se o problema persistir, digite *ajuda*.`,
    nextStep: 'Usuário tenta novamente',
    file: 'menuService.ts',
    function: 'getErrorMessage()',
  },
  {
    id: 'cancel',
    category: 'erro',
    trigger: 'Usuário cancela operação',
    triggerType: 'comando',
    title: 'Operação Cancelada',
    content: `✅ *Operação cancelada*

Você pode voltar a usar o bot normalmente.

Para ver os planos disponíveis, digite *planos*.`,
    nextStep: 'Volta ao uso normal',
    file: 'menuService.ts',
    function: 'getCancellationMessage()',
  },
]

const categoryConfig = {
  onboarding: { label: 'Onboarding', icon: Sparkles, color: 'bg-green-500/10 text-green-500 border-green-500/20' },
  limite: { label: 'Limite', icon: AlertTriangle, color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' },
  planos: { label: 'Planos', icon: CreditCard, color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  pagamento: { label: 'Pagamento', icon: CreditCard, color: 'bg-purple-500/10 text-purple-500 border-purple-500/20' },
  twitter: { label: 'Twitter', icon: Twitter, color: 'bg-sky-500/10 text-sky-500 border-sky-500/20' },
  erro: { label: 'Ajuda/Erro', icon: HelpCircle, color: 'bg-red-500/10 text-red-500 border-red-500/20' },
  sticker: { label: 'Sticker', icon: Sparkles, color: 'bg-pink-500/10 text-pink-500 border-pink-500/20' },
}

const triggerTypeConfig = {
  auto: { label: 'Automático', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  comando: { label: 'Comando', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  botao: { label: 'Botão', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  evento: { label: 'Evento', color: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
}

function MessageCard({ message }: { message: BotMessage }) {
  const [copied, setCopied] = useState(false)
  const category = categoryConfig[message.category]
  const triggerType = triggerTypeConfig[message.triggerType]
  const CategoryIcon = category.icon

  const copyContent = () => {
    navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-md ${category.color}`}>
              <CategoryIcon className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base">{message.title}</CardTitle>
              <CardDescription className="text-xs mt-0.5">{message.function || message.file}</CardDescription>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={copyContent}>
            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Trigger */}
        <div className="flex items-start gap-2">
          <Badge variant="outline" className={`text-xs shrink-0 ${triggerType.color}`}>
            <Zap className="h-3 w-3 mr-1" />
            {triggerType.label}
          </Badge>
          <span className="text-sm text-muted-foreground">{message.trigger}</span>
        </div>

        {/* Message Content */}
        <div className="bg-muted/50 rounded-lg p-3 font-mono text-xs whitespace-pre-wrap border">
          {message.content}
        </div>

        {/* Buttons */}
        {message.buttons && message.buttons.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MousePointer className="h-3 w-3" />
              <span>Botões:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {message.buttons.map((btn) => (
                <Badge key={btn.id} variant="secondary" className="text-xs font-mono">
                  {btn.text}
                  <span className="text-muted-foreground ml-1">({btn.id})</span>
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Next Step */}
        {message.nextStep && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ArrowRight className="h-3 w-3" />
            <span>Próximo: {message.nextStep}</span>
          </div>
        )}

        {/* Notes */}
        {message.notes && (
          <div className="text-xs text-yellow-500 bg-yellow-500/10 rounded-md p-2 border border-yellow-500/20">
            ⚠️ {message.notes}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function BotMessagesPage() {
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  const filteredMessages = messages.filter((msg) => {
    const matchesSearch =
      msg.title.toLowerCase().includes(search.toLowerCase()) ||
      msg.content.toLowerCase().includes(search.toLowerCase()) ||
      msg.trigger.toLowerCase().includes(search.toLowerCase())

    const matchesCategory = selectedCategory === 'all' || msg.category === selectedCategory

    return matchesSearch && matchesCategory
  })

  const categories = ['all', ...Object.keys(categoryConfig)] as const

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Catálogo de Mensagens</h1>
        <p className="text-muted-foreground">
          Todas as mensagens enviadas pelo bot, organizadas por contexto e trigger.
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
              <MousePointer className="h-4 w-4 text-muted-foreground" />
              <span className="text-2xl font-bold">
                {messages.reduce((acc, msg) => acc + (msg.buttons?.length || 0), 0)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">Botões</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-muted-foreground" />
              <span className="text-2xl font-bold">
                {messages.filter(m => m.triggerType === 'auto').length}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">Automáticas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Gift className="h-4 w-4 text-muted-foreground" />
              <span className="text-2xl font-bold">{Object.keys(categoryConfig).length}</span>
            </div>
            <p className="text-xs text-muted-foreground">Categorias</p>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar mensagens..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Category Tabs */}
      <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
        <TabsList className="flex-wrap h-auto gap-1 bg-transparent p-0">
          <TabsTrigger
            value="all"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            Todas ({messages.length})
          </TabsTrigger>
          {Object.entries(categoryConfig).map(([key, config]) => {
            const count = messages.filter(m => m.category === key).length
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
          <div className="grid gap-4 md:grid-cols-2">
            {filteredMessages.map((message) => (
              <MessageCard key={message.id} message={message} />
            ))}
          </div>

          {filteredMessages.length === 0 && (
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
