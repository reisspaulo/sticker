import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

const PRIVACY_POLICY_HTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Política de Privacidade - StickerBot</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; color: #333; line-height: 1.6; }
    h1 { color: #1a1a1a; border-bottom: 2px solid #25D366; padding-bottom: 10px; }
    h2 { color: #1a1a1a; margin-top: 30px; }
    p, li { font-size: 15px; }
    .updated { color: #666; font-size: 13px; }
  </style>
</head>
<body>
  <h1>Política de Privacidade</h1>
  <p class="updated">Última atualização: 12 de março de 2026</p>

  <h2>1. Introdução</h2>
  <p>O StickerBot ("nós", "nosso") é um serviço de criação de figurinhas para WhatsApp. Esta política descreve como coletamos, usamos e protegemos suas informações ao utilizar nosso serviço.</p>

  <h2>2. Dados que coletamos</h2>
  <ul>
    <li><strong>Número de telefone:</strong> usado para identificar sua conta e enviar as figurinhas criadas.</li>
    <li><strong>Nome do perfil do WhatsApp:</strong> usado para personalizar a comunicação.</li>
    <li><strong>Imagens e vídeos enviados:</strong> processados temporariamente para criar figurinhas. Não armazenamos o conteúdo das mídias após o processamento.</li>
    <li><strong>Dados de uso:</strong> contadores de figurinhas criadas e interações com o bot, para controle de limites e melhoria do serviço.</li>
  </ul>

  <h2>3. Como usamos seus dados</h2>
  <ul>
    <li>Criar e enviar figurinhas conforme solicitado.</li>
    <li>Gerenciar sua conta e limites de uso.</li>
    <li>Processar pagamentos de assinaturas (via Stripe).</li>
    <li>Melhorar o serviço e corrigir problemas técnicos.</li>
  </ul>

  <h2>4. Compartilhamento de dados</h2>
  <p>Não vendemos, alugamos ou compartilhamos seus dados pessoais com terceiros, exceto:</p>
  <ul>
    <li><strong>Meta/WhatsApp:</strong> para envio e recebimento de mensagens via WhatsApp Business Platform.</li>
    <li><strong>Stripe:</strong> para processamento de pagamentos (apenas dados de pagamento).</li>
    <li><strong>Obrigações legais:</strong> quando exigido por lei ou ordem judicial.</li>
  </ul>

  <h2>5. Armazenamento e segurança</h2>
  <p>Seus dados são armazenados em servidores seguros. Imagens e vídeos são processados temporariamente e deletados após a criação da figurinha. Utilizamos criptografia e práticas de segurança para proteger suas informações.</p>

  <h2>6. Seus direitos</h2>
  <p>Você pode a qualquer momento:</p>
  <ul>
    <li>Solicitar a exclusão de seus dados enviando "excluir meus dados" no chat.</li>
    <li>Parar de usar o serviço simplesmente deixando de enviar mensagens.</li>
  </ul>

  <h2>7. Alterações</h2>
  <p>Podemos atualizar esta política periodicamente. Alterações significativas serão comunicadas pelo próprio serviço.</p>

  <h2>8. Contato</h2>
  <p>Para dúvidas sobre privacidade, entre em contato pelo próprio WhatsApp do StickerBot.</p>
</body>
</html>`;

const TERMS_OF_SERVICE_HTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Termos de Serviço - StickerBot</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; color: #333; line-height: 1.6; }
    h1 { color: #1a1a1a; border-bottom: 2px solid #25D366; padding-bottom: 10px; }
    h2 { color: #1a1a1a; margin-top: 30px; }
    p, li { font-size: 15px; }
    .updated { color: #666; font-size: 13px; }
  </style>
</head>
<body>
  <h1>Termos de Serviço</h1>
  <p class="updated">Última atualização: 12 de março de 2026</p>

  <h2>1. Aceitação</h2>
  <p>Ao usar o StickerBot, você concorda com estes termos. Se não concordar, por favor não utilize o serviço.</p>

  <h2>2. Descrição do serviço</h2>
  <p>O StickerBot é um bot de WhatsApp que converte imagens e vídeos em figurinhas (stickers). O serviço oferece um plano gratuito com limite diário e planos pagos com recursos adicionais.</p>

  <h2>3. Uso aceitável</h2>
  <p>Você concorda em não usar o serviço para:</p>
  <ul>
    <li>Criar conteúdo ilegal, ofensivo ou que viole direitos de terceiros.</li>
    <li>Enviar spam ou usar o bot de forma automatizada.</li>
    <li>Tentar acessar sistemas ou dados não autorizados.</li>
  </ul>

  <h2>4. Assinaturas e pagamentos</h2>
  <ul>
    <li>Planos pagos são cobrados de forma recorrente via Stripe.</li>
    <li>Cancelamentos podem ser feitos a qualquer momento pelo chat.</li>
    <li>Não há reembolso para períodos parciais.</li>
  </ul>

  <h2>5. Limitação de responsabilidade</h2>
  <p>O serviço é fornecido "como está". Não garantimos disponibilidade ininterrupta. Não nos responsabilizamos por conteúdo criado pelos usuários.</p>

  <h2>6. Alterações</h2>
  <p>Podemos modificar estes termos a qualquer momento. O uso continuado do serviço constitui aceitação das alterações.</p>

  <h2>7. Contato</h2>
  <p>Para dúvidas, entre em contato pelo próprio WhatsApp do StickerBot.</p>
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
