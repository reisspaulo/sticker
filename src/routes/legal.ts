import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

const LEGAL_STYLES = `
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,700&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet">
  <style>
    :root { --bg: #0a0a0a; --surface: #141414; --border: #2a2a2a; --text: #e8e8e8; --text-muted: #888; --accent: #f0c040; --green: #25D366; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'DM Sans', sans-serif; background: var(--bg); color: var(--text); -webkit-font-smoothing: antialiased; }
    nav { padding: 20px 40px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border); }
    nav .logo { font-family: 'Instrument Serif', serif; font-size: 1.4rem; letter-spacing: -0.02em; text-decoration: none; color: var(--text); }
    nav .logo span { color: var(--accent); }
    nav .back { color: var(--text-muted); text-decoration: none; font-size: 0.85rem; transition: color 0.2s; }
    nav .back:hover { color: var(--text); }
    .content { max-width: 720px; margin: 0 auto; padding: 60px 24px 100px; }
    h1 { font-family: 'Instrument Serif', serif; font-size: 2.4rem; font-weight: 400; letter-spacing: -0.02em; margin-bottom: 8px; }
    .updated { color: var(--text-muted); font-size: 0.82rem; margin-bottom: 48px; display: block; padding-bottom: 32px; border-bottom: 1px solid var(--border); }
    h2 { font-size: 1rem; font-weight: 600; margin-top: 40px; margin-bottom: 16px; letter-spacing: 0.01em; }
    p, li { font-size: 0.92rem; color: var(--text-muted); line-height: 1.8; }
    p { margin-bottom: 16px; }
    ul { margin-bottom: 16px; padding-left: 20px; }
    li { margin-bottom: 8px; }
    strong { color: var(--text); font-weight: 500; }
    .company-info { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 24px 28px; margin: 32px 0; font-size: 0.85rem; color: var(--text-muted); line-height: 2; }
    footer { border-top: 1px solid var(--border); padding: 32px 40px; text-align: center; font-size: 0.72rem; color: #555; }
    footer a { color: var(--text-muted); text-decoration: none; }
    footer a:hover { color: var(--text); }
    @media (max-width: 768px) { nav { padding: 16px 20px; } .content { padding: 40px 20px 80px; } h1 { font-size: 1.8rem; } }
  </style>`;

const PRIVACY_POLICY_HTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Politica de Privacidade — StickerBot</title>
  ${LEGAL_STYLES}
</head>
<body>
  <nav>
    <a href="/" class="logo">Sticker<span>Bot</span></a>
    <a href="/" class="back">Voltar ao inicio</a>
  </nav>
  <div class="content">
    <h1>Politica de Privacidade</h1>
    <span class="updated">Ultima atualizacao: 14 de marco de 2026</span>

    <h2>1. Quem somos</h2>
    <p>O StickerBot e um servico de criacao de figurinhas para WhatsApp operado por:</p>
    <div class="company-info">
      <strong>65.508.556 PAULO HENRIQUE REIS ALVES</strong><br>
      CNPJ: 65.508.556/0001-39<br>
      Rua Professor Irineu Chaluppe, 247 — Jardim Itapevi<br>
      Itapevi, SP — CEP 06653-180<br>
      Contato: via WhatsApp (+55 11 98870-9202)
    </div>
    <p>Esta politica descreve como coletamos, usamos e protegemos suas informacoes ao utilizar nosso servico por meio da WhatsApp Business Platform (Meta).</p>

    <h2>2. Dados que coletamos</h2>
    <ul>
      <li><strong>Numero de telefone:</strong> usado para identificar sua conta e enviar as figurinhas criadas.</li>
      <li><strong>Nome do perfil do WhatsApp:</strong> usado para personalizar a comunicacao.</li>
      <li><strong>Imagens, videos e GIFs enviados:</strong> processados temporariamente para criar figurinhas. O conteudo original nao e armazenado apos o processamento.</li>
      <li><strong>Dados de uso:</strong> contadores de figurinhas criadas, interacoes com o bot e historico de comandos, para controle de limites e melhoria do servico.</li>
    </ul>

    <h2>3. Como usamos seus dados</h2>
    <ul>
      <li>Criar e enviar figurinhas conforme solicitado por voce.</li>
      <li>Gerenciar sua conta, limites de uso e plano de assinatura.</li>
      <li>Processar pagamentos de assinaturas.</li>
      <li>Enviar notificacoes sobre figurinhas pendentes e atualizacoes do servico.</li>
      <li>Melhorar o servico e corrigir problemas tecnicos.</li>
    </ul>

    <h2>4. Compartilhamento de dados</h2>
    <p>Nao vendemos, alugamos ou compartilhamos seus dados pessoais com terceiros para fins de marketing. Compartilhamos dados apenas com:</p>
    <ul>
      <li><strong>Meta / WhatsApp Business Platform:</strong> para envio e recebimento de mensagens. A Meta processa os dados conforme sua propria politica de privacidade.</li>
      <li><strong>Stripe:</strong> para processamento de pagamentos de assinaturas. Apenas dados necessarios para a transacao sao compartilhados.</li>
      <li><strong>Supabase:</strong> para armazenamento seguro de dados da conta (numero, plano, contadores). Dados hospedados em servidores com criptografia.</li>
      <li><strong>Obrigacoes legais:</strong> quando exigido por lei ou ordem judicial brasileira.</li>
    </ul>

    <h2>5. Armazenamento e seguranca</h2>
    <p>Seus dados sao armazenados em servidores seguros com criptografia em transito e em repouso. Imagens e videos sao processados temporariamente e removidos apos a criacao da figurinha. As figurinhas criadas ficam armazenadas para possibilitar reenvio quando necessario.</p>

    <h2>6. Seus direitos</h2>
    <p>Conforme a Lei Geral de Protecao de Dados (LGPD), voce pode a qualquer momento:</p>
    <ul>
      <li>Solicitar acesso aos seus dados pessoais.</li>
      <li>Solicitar a exclusao dos seus dados enviando "excluir meus dados" na conversa do WhatsApp.</li>
      <li>Parar de usar o servico simplesmente deixando de enviar mensagens.</li>
    </ul>

    <h2>7. Retencao de dados</h2>
    <p>Mantemos seus dados de conta enquanto voce utilizar o servico. Apos 12 meses de inatividade, seus dados podem ser removidos automaticamente.</p>

    <h2>8. Alteracoes</h2>
    <p>Podemos atualizar esta politica periodicamente. Alteracoes significativas serao comunicadas pelo proprio servico via WhatsApp.</p>

    <h2>9. Contato</h2>
    <p>Para duvidas sobre privacidade ou exercer seus direitos, entre em contato pelo WhatsApp: +55 11 98870-9202.</p>
  </div>
  <footer>
    <a href="/">StickerBot</a> &middot; <a href="/terms">Termos de uso</a> &middot; 65.508.556 PAULO HENRIQUE REIS ALVES — CNPJ 65.508.556/0001-39
  </footer>
</body>
</html>`;

const TERMS_OF_SERVICE_HTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Termos de Uso — StickerBot</title>
  ${LEGAL_STYLES}
</head>
<body>
  <nav>
    <a href="/" class="logo">Sticker<span>Bot</span></a>
    <a href="/" class="back">Voltar ao inicio</a>
  </nav>
  <div class="content">
    <h1>Termos de Uso</h1>
    <span class="updated">Ultima atualizacao: 14 de marco de 2026</span>

    <h2>1. Aceitacao</h2>
    <p>Ao utilizar o StickerBot, voce concorda com estes termos. Se nao concordar, por favor nao utilize o servico.</p>

    <h2>2. O servico</h2>
    <p>O StickerBot e um bot de WhatsApp que converte imagens, GIFs e videos em figurinhas (stickers). O servico funciona inteiramente dentro da conversa do WhatsApp, sem necessidade de instalar aplicativos adicionais. Operamos por meio da WhatsApp Business Platform (Meta).</p>

    <h2>3. Planos e precos</h2>
    <p>O servico oferece tres planos:</p>
    <ul>
      <li><strong>Gratuito (R$ 0):</strong> 4 figurinhas por dia e 4 downloads de video do Twitter/X por dia.</li>
      <li><strong>Premium (R$ 5,00/mes):</strong> 20 figurinhas por dia, 15 downloads de video do Twitter/X por dia e suporte prioritario.</li>
      <li><strong>Ultra (R$ 9,90/mes):</strong> figurinhas e downloads ilimitados, processamento prioritario e suporte VIP.</li>
    </ul>
    <p>Os limites diarios sao renovados a meia-noite (horario de Brasilia). Os precos podem ser alterados com aviso previo de 30 dias.</p>

    <h2>4. Assinaturas e pagamentos</h2>
    <ul>
      <li>Planos pagos sao cobrados de forma recorrente mensal via Stripe.</li>
      <li>O pagamento pode ser feito por cartao de credito, boleto bancario ou PIX.</li>
      <li>Cancelamentos podem ser feitos a qualquer momento enviando "cancelar" na conversa do WhatsApp.</li>
      <li>O plano permanece ativo ate o fim do periodo pago.</li>
      <li>Nao ha reembolso para periodos parciais.</li>
    </ul>

    <h2>5. Uso aceitavel</h2>
    <p>Voce concorda em nao usar o servico para:</p>
    <ul>
      <li>Criar conteudo ilegal, ofensivo ou que viole direitos autorais de terceiros.</li>
      <li>Enviar spam ou usar o bot de forma automatizada (scripts, bots).</li>
      <li>Tentar acessar sistemas, dados ou funcionalidades nao autorizadas.</li>
      <li>Revender ou redistribuir o servico sem autorizacao.</li>
    </ul>
    <p>Reservamo-nos o direito de suspender ou encerrar contas que violem estes termos.</p>

    <h2>6. Propriedade intelectual</h2>
    <p>O conteudo das figurinhas criadas pertence ao usuario que as enviou. O StickerBot nao reivindica propriedade sobre as midias enviadas ou figurinhas geradas. Voce e responsavel por garantir que possui direitos sobre as imagens enviadas.</p>

    <h2>7. Figurinhas pendentes</h2>
    <p>Figurinhas criadas apos o limite diario sao salvas e enviadas no dia seguinte as 8h da manha (horario de Brasilia). Fora da janela de conversa de 24 horas da Meta, voce recebera uma notificacao com botao para receber as figurinhas pendentes.</p>

    <h2>8. Limitacao de responsabilidade</h2>
    <p>O servico e fornecido "como esta", sem garantias de disponibilidade ininterrupta. Nao nos responsabilizamos por:</p>
    <ul>
      <li>Conteudo criado pelos usuarios.</li>
      <li>Indisponibilidade temporaria do servico por manutencao ou problemas tecnicos.</li>
      <li>Alteracoes na WhatsApp Business Platform que afetem o funcionamento do servico.</li>
    </ul>

    <h2>9. Alteracoes</h2>
    <p>Podemos modificar estes termos a qualquer momento. Alteracoes significativas serao comunicadas pelo WhatsApp. O uso continuado do servico apos as alteracoes constitui aceitacao dos novos termos.</p>

    <h2>10. Legislacao aplicavel</h2>
    <p>Estes termos sao regidos pelas leis da Republica Federativa do Brasil. Fica eleito o foro da comarca de Itapevi, SP, para dirimir quaisquer controversias.</p>

    <h2>11. Dados da empresa</h2>
    <div class="company-info">
      <strong>65.508.556 PAULO HENRIQUE REIS ALVES</strong><br>
      CNPJ: 65.508.556/0001-39<br>
      Rua Professor Irineu Chaluppe, 247 — Jardim Itapevi<br>
      Itapevi, SP — CEP 06653-180<br>
      Contato: via WhatsApp (+55 11 98870-9202)
    </div>
  </div>
  <footer>
    <a href="/">StickerBot</a> &middot; <a href="/privacy">Privacidade</a> &middot; 65.508.556 PAULO HENRIQUE REIS ALVES — CNPJ 65.508.556/0001-39
  </footer>
</body>
</html>`;

export default async function legalRoutes(fastify: FastifyInstance) {
  fastify.get('/privacy', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply
      .status(200)
      .header('Content-Type', 'text/html; charset=utf-8')
      .send(PRIVACY_POLICY_HTML);
  });

  fastify.get('/terms', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply
      .status(200)
      .header('Content-Type', 'text/html; charset=utf-8')
      .send(TERMS_OF_SERVICE_HTML);
  });
}
