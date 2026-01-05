const https = require('https');

const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE;

const message = `🎉 *PAGAMENTO CONFIRMADO!*

Seu plano *Premium 💰* foi ativado com sucesso!

✅ *Benefícios liberados:*
• Figurinhas: *ILIMITADAS*
• Vídeos Twitter: *20/dia*
• Marca d'água: *Não* ✅

🚀 *Já pode usar agora mesmo!*
Envie suas imagens e GIFs para criar figurinhas incríveis!

Dúvidas? Digite *ajuda*`;

const data = JSON.stringify({
  number: '5511946304133',
  text: message
});

const options = {
  hostname: 'stickers.ytem.com.br',
  port: 443,
  path: '/webhook',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

// Send via Evolution API directly
const evolutionOptions = {
  hostname: 'evolution-api.ytem.com.br',
  port: 443,
  path: `/message/sendText/${EVOLUTION_INSTANCE}`,
  method: 'POST',
  headers: {
    'apikey': EVOLUTION_API_KEY,
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = https.request(evolutionOptions, res => {
  let response = '';
  res.on('data', chunk => response += chunk);
  res.on('end', () => {
    console.log('Response:', response);
  });
});

req.on('error', error => {
  console.error('Error:', error);
});

req.write(data);
req.end();
