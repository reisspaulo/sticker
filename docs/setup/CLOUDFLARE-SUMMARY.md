# ☁️ Resumo: Cloudflare + DNS para Sticker Bot

**TLDR:** Como configurar DNS no Cloudflare para o Sticker Bot funcionar em **https://stickers.ytem.com.br**

---

## 🎯 O que preciso fazer?

### Passo 1: DNS no Cloudflare (5 minutos)

1. Acesse: https://dash.cloudflare.com
2. Login com suas credenciais
3. Selecione domínio: **ytem.com**
4. Menu lateral → **DNS** → **Records**
5. Clique em **Add record**
6. Preencha:

| Campo | Valor |
|-------|-------|
| Type | A |
| Name | stickers |
| IPv4 address | 157.230.50.63 |
| Proxy status | ☁️ **Proxied** (laranja - ATIVADO) |
| TTL | Auto |

7. Clique em **Save**

### Passo 2: SSL no Cloudflare (2 minutos)

1. Menu lateral → **SSL/TLS** → **Overview**
2. Selecione: **Full (strict)**
3. Pronto!

### Passo 3: Aguardar (1-5 minutos)

Aguarde o DNS propagar. Teste:

```bash
dig stickers.ytem.com.br
```

Deve retornar um IP (será do Cloudflare, não 157.230.50.63 diretamente).

### Passo 4: Deploy (10 minutos)

```bash
# No seu Mac
cd /Users/paulohenrique/sticker
./deploy/deploy-sticker.sh prd
```

O Traefik automaticamente:
- Detecta o novo domínio
- Obtém certificado SSL do Let's Encrypt
- Configura HTTPS

### Passo 5: Testar

```bash
curl https://stickers.ytem.com.br/health
```

Deve retornar:
```json
{
  "status": "healthy",
  "services": {
    "redis": "connected",
    "supabase": "connected"
  }
}
```

---

## 🔑 Segredos/Tokens do Cloudflare

O Traefik já está configurado para usar DNS Challenge com token da API Cloudflare.

**Token já existe no Doppler** (projeto brazyl):
- `CLOUDFLARE_API_TOKEN`: Usado pelo Traefik para obter certificados SSL
- `CLOUDFLARE_GLOBAL_API_KEY`: Backup/alternativa

**Você não precisa criar novo token!** ✅

---

## ❓ Por que Cloudflare?

1. **DDoS Protection** - Proteção automática contra ataques
2. **CDN Global** - Conteúdo servido de servidores próximos ao usuário
3. **SSL Grátis** - Certificados Let's Encrypt via DNS Challenge
4. **Proxy** - Esconde o IP real da VPS

---

## 🛡️ Por que "Full (strict)" SSL?

- **Full (strict)** = Comunicação criptografada ponta a ponta
- Cloudflare ←→ VPS usa certificado válido (Let's Encrypt)
- Mais seguro que "Flexible" (que só criptografa Cloudflare ←→ Usuário)

---

## 🔍 Como funciona o SSL automático?

```
1. Deploy do Sticker Bot na VPS
2. Traefik detecta label: traefik.http.routers.sticker-api.rule=Host(`stickers.ytem.com.br`)
3. Traefik vê que precisa de certificado SSL
4. Traefik usa DNS Challenge:
   a. Cria registro TXT no Cloudflare (_acme-challenge.stickers.ytem.com.br)
   b. Let's Encrypt valida o registro
   c. Let's Encrypt emite certificado válido
5. Traefik configura HTTPS automaticamente
6. Certificado renova a cada 60 dias (automático)
```

**Você não faz nada!** O Traefik cuida de tudo. 🎉

---

## 🐞 Troubleshooting Rápido

### DNS não resolve

```bash
# Limpar cache DNS
sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder

# Aguardar 5 minutos e tentar novamente
dig stickers.ytem.com.br
```

### Erro de certificado SSL

**Aguarde 1-2 minutos.** O Traefik pode estar obtendo o certificado.

Se persistir:
```bash
# Ver logs do Traefik
ssh root@157.230.50.63 'docker service logs traefik_traefik --tail 50' | grep certificate
```

### 502 Bad Gateway

Backend não está rodando:
```bash
ssh root@157.230.50.63 'docker service ls | grep sticker'
ssh root@157.230.50.63 'docker service logs sticker_backend --tail 100'
```

---

## 📚 Documentação Completa

- **Guia Completo DNS:** `deploy/CLOUDFLARE-DNS-SETUP.md`
- **Guia Deploy:** `deploy/DEPLOYMENT-GUIDE.md`
- **Doppler Setup:** `deploy/DOPPLER-SETUP.md`

---

## ✅ Checklist

- [ ] Registro A criado (`stickers` → `157.230.50.63`)
- [ ] Proxy ativado (☁️ laranja)
- [ ] SSL Mode: Full (strict)
- [ ] DNS resolvendo (`dig stickers.ytem.com.br`)
- [ ] Deploy executado (`./deploy/deploy-sticker.sh prd`)
- [ ] HTTPS funcionando (`curl https://stickers.ytem.com.br/health`)

---

**Tempo Total:** ~20 minutos
**Dificuldade:** Fácil
**Status:** ✅ Pronto para executar

---

*Última atualização: 26/12/2025*
