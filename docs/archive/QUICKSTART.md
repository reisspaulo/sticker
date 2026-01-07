# ⚡ Quick Start - Evolution API

> Comece a usar em 5 minutos!

## 🎯 Passos Rápidos

### 1. Iniciar os Serviços

```bash
cd /Users/paulohenrique/sticker
docker compose up -d
```

Aguarde ~30 segundos para tudo inicializar.

### 2. Verificar se está Rodando

```bash
docker compose ps
```

Todos os containers devem estar "Up".

### 3. Acessar o Manager

Abra no navegador: http://localhost:3001

Configure:
- **Server URL:** `http://localhost:8080`
- **API Key:** `I1hKpeX0MZhOzyd5xDbXFBqRslKMHzMWxDdYEIPssXc=`

### 4. Criar Instância e Conectar WhatsApp

No Manager:
1. Clique em "Create Instance"
2. Nome: `meu-whatsapp`
3. Integration: `WHATSAPP-BAILEYS`
4. Clique em "Get QR Code"
5. Escaneie com seu WhatsApp

### 5. Enviar sua Primeira Mensagem!

```bash
curl -X POST http://localhost:8080/message/sendText/meu-whatsapp \
  -H 'apikey: I1hKpeX0MZhOzyd5xDbXFBqRslKMHzMWxDdYEIPssXc=' \
  -H 'Content-Type: application/json' \
  -d '{
    "number": "5511999999999",
    "text": "Olá! Minha primeira mensagem via API 🚀"
  }'
```

✅ **Pronto!** Você já está usando a Evolution API!

---

## 🔗 Links Úteis

- 📖 [Documentação Completa](README.md)
- 📡 [Endpoints Disponíveis](docs/ENDPOINTS.md)
- 🎨 [Como Enviar Stickers](docs/STICKERS.md)
- 🔧 [Solução de Problemas](docs/TROUBLESHOOTING.md)

## 🛠 Comandos Essenciais

```bash
# Ver logs em tempo real
docker compose logs -f evolution-api

# Parar tudo
docker compose down

# Reiniciar apenas a API
docker compose restart evolution-api

# Ver status
docker compose ps
```

## 💡 Próximos Passos

1. ✅ Explore os [exemplos práticos](exemplos/)
2. ✅ Configure [webhooks](docs/ENDPOINTS.md#webhook) para receber eventos
3. ✅ Experimente enviar [stickers](docs/STICKERS.md)
4. ✅ Integre com seu sistema!

---

**Dúvidas?** Consulte a [documentação completa](README.md) ou o [troubleshooting](docs/TROUBLESHOOTING.md)
