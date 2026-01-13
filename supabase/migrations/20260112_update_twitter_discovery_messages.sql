-- Update Twitter Discovery messages
-- Remove greetings/names, add video-to-sticker transformation info

UPDATE sequence_messages SET
  body = E'Sabia que você pode baixar vídeos do Twitter/X e transformar em figurinha? 🎬\n\nÉ só mandar o link do tweet aqui que a gente baixa o vídeo e transforma em sticker animado!\n\nQuer testar? Manda um link de tweet com vídeo 👇',
  title = NULL
WHERE message_key = 'twitter_d0';

UPDATE sequence_messages SET
  body = E'Lembrete rápido: dá pra baixar vídeos do Twitter/X e transformar em figurinha animada! 🎬\n\nManda o link de qualquer tweet com vídeo e a gente faz a mágica ✨',
  title = NULL
WHERE message_key = 'twitter_d7';

UPDATE sequence_messages SET
  body = E'Já experimentou baixar vídeos do Twitter/X? 📱\n\nAlém de baixar, a gente transforma o vídeo em figurinha animada pra você usar no WhatsApp!\n\nSó mandar o link do tweet aqui 👇',
  title = NULL
WHERE message_key = 'twitter_d15';

UPDATE sequence_messages SET
  body = E'Última dica: você pode baixar vídeos do Twitter/X e transformar em figurinha animada! 🎥\n\nManda qualquer link de tweet com vídeo e veja a mágica acontecer ✨',
  title = NULL
WHERE message_key = 'twitter_d30';
