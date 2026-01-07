# ☁️ Cloudflare DNS Setup - stickers.ytem.com.br

Guia completo para configurar DNS no Cloudflare e habilitar SSL para o Sticker Bot.

---

## 📋 Pré-requisitos

- Acesso ao dashboard Cloudflare
- Domínio `ytem.com.br` gerenciado pelo Cloudflare
- VPS rodando em `69.62.100.250` (Contabo - srv1007351)
- Traefik configurado na VPS (já existe)

---

## 🎯 Objetivo

Configurar os subdomínios para apontar para a VPS e obter certificados SSL automáticos via Traefik + Let's Encrypt:
- **wa.ytem.com.br** → Evolution API ✅ (deployado)
- **wa-manager.ytem.com.br** → Evolution Manager ✅ (deployado)
- **stickers.ytem.com.br** → Sticker Bot (pendente)

---

## 🔧 Passo 1: Configurar DNS no Cloudflare

### 1.1 Acessar Cloudflare Dashboard

1. Acesse: https://dash.cloudflare.com
2. Faça login com suas credenciais
3. Selecione o domínio **ytem.com**
4. No menu lateral, clique em **DNS** → **Records**

### 1.2 Adicionar Registro DNS

Clique em **Add record** e configure:

**Para Sticker Bot:**

| Campo | Valor |
|-------|-------|
| **Type** | `A` |
| **Name** | `stickers` |
| **IPv4 address** | `69.62.100.250` |
| **Proxy status** | ☁️ **Proxied** (nuvem laranja) |
| **TTL** | Auto |

**Resultado:** `stickers.ytem.com.br` → `69.62.100.250`

**Para Evolution API (já configurado ✅):**

| Campo | Valor |
|-------|-------|
| **Name** | `wa` |
| **IPv4** | `69.62.100.250` |
| **Proxied** | ☁️ Sim |

| Campo | Valor |
|-------|-------|
| **Name** | `wa-manager` |
| **IPv4** | `69.62.100.250` |
| **Proxied** | ☁️ Sim |

### 1.3 Salvar

Clique em **Save**.

A propagação DNS geralmente leva **1-5 minutos**, mas pode levar até 24h em alguns casos.

---

## 🔐 Passo 2: Configurar SSL/TLS no Cloudflare

### 2.1 Modo SSL/TLS

1. No dashboard do Cloudflare, vá para **SSL/TLS** → **Overview**
2. Selecione o modo: **Full (strict)**

**Por quê Full (strict)?**
- Garante que a comunicação entre Cloudflare e VPS seja criptografada
- Valida o certificado do servidor (mais seguro)
- Traefik gerará certificados válidos via Let's Encrypt

### 2.2 Verificar Configurações Adicionais

1. **Always Use HTTPS**: ✅ Ativo (recomendado)
2. **Automatic HTTPS Rewrites**: ✅ Ativo (recomendado)
3. **Minimum TLS Version**: TLS 1.2 (ou superior)

---

## 🔑 Passo 3: Verificar Token Cloudflare (DNS Challenge)

O Traefik precisa de um token da API Cloudflare para obter certificados SSL via **DNS Challenge**.

### 3.1 Verificar Token Existente

O token já está configurado no Doppler (projeto brazyl):

```bash
doppler secrets get CLOUDFLARE_API_TOKEN --plain --project brazyl --config prd
```

**Token atual:** `7c26JCGl1NpcnAE7lvxFUZeUzLfUunme83AlmzPa`

### 3.2 Permissões do Token

O token deve ter as seguintes permissões:

- **Zone** → **Zone** → **Read**
- **Zone** → **DNS** → **Edit**

### 3.3 Criar Novo Token (se necessário)

Se precisar criar um novo token:

1. Cloudflare Dashboard → **My Profile** → **API Tokens**
2. Clique em **Create Token**
3. Use o template: **Edit zone DNS**
4. Configure:
   - **Permissions:**
     - Zone → DNS → Edit
     - Zone → Zone → Read
   - **Zone Resources:**
     - Include → Specific zone → `ytem.com`
5. Continue → **Create Token**
6. Copie o token e salve no Doppler

---

## 🐳 Passo 4: Configurar Traefik (DNS Challenge)

O Traefik na VPS já está configurado para usar DNS Challenge do Cloudflare.

### 4.1 Verificar Configuração do Traefik

SSH na VPS e verifique:

```bash
# Usar vps-ssh (Doppler + sshpass)
vps-ssh "docker service inspect traefik_traefik --format '{{json .Spec.TaskTemplate.ContainerSpec.Env}}' | jq"

# Ou SSH direto
ssh root@69.62.100.250
```

Deve conter:
- `CF_API_EMAIL=<email>`
- `CF_DNS_API_TOKEN=<token>` ou `CF_API_KEY=<key>`

### 4.2 Certificados Automáticos

Com DNS Challenge configurado, o Traefik automaticamente:
1. Detecta novo domínio via labels no stack
2. Cria registro TXT no Cloudflare (_acme-challenge.stickers.ytem.com.br)
3. Valida com Let's Encrypt
4. Obtém certificado SSL válido
5. Renova automaticamente a cada 60 dias

**Nenhuma ação manual necessária!** 🎉

---

## ✅ Passo 5: Verificar DNS

### 5.1 Teste Local

```bash
# Verificar resolução DNS
dig stickers.ytem.com.br
dig wa.ytem.com.br
dig wa-manager.ytem.com.br

# Deve retornar:
# *.ytem.com.br. 300 IN A <IP_CLOUDFLARE>
```

**Nota:** O IP retornado será um IP do Cloudflare (proxy), **não** 69.62.100.250 diretamente.

### 5.2 Teste com nslookup

```bash
nslookup stickers.ytem.com.br

# Deve retornar IPs do Cloudflare (proxy ativo)
```

### 5.3 Teste HTTP (sem SSL ainda)

```bash
# Testar Evolution API (já funcionando)
curl -I https://wa.ytem.com.br

# Testar Sticker Bot (quando deployado)
curl -I http://stickers.ytem.com.br

# Ou forçar resolução direta
curl -I --resolve stickers.ytem.com.br:80:69.62.100.250 http://stickers.ytem.com.br
```

---

## 🚀 Passo 6: Deploy da Aplicação

Após configurar o DNS, faça o deploy do Sticker Bot:

```bash
# No seu computador local
cd /Users/paulohenrique/sticker

# Build e push imagem
npm run build
docker build -t ghcr.io/reisspaulo/sticker-bot-backend:latest .
docker push ghcr.io/reisspaulo/sticker-bot-backend:latest

# Deploy para VPS (com Doppler secrets)
./deploy/deploy-sticker.sh prd
```

O Traefik automaticamente:
1. Detectará o novo serviço via labels
2. Configurará roteamento para `stickers.ytem.com.br`
3. Obterá certificado SSL via DNS Challenge
4. Ativará HTTPS

---

## 🔍 Passo 7: Validar Deploy

### 7.1 Verificar Certificado SSL

```bash
# Verificar certificado SSL Evolution API (já funcionando)
curl -I https://wa.ytem.com.br

# Verificar Sticker Bot (quando deployado)
curl -I https://stickers.ytem.com.br/health
```

Deve retornar **HTTP/2 200** (ou 404 se o endpoint não existir ainda).

**URLs em produção:**
- ✅ https://wa.ytem.com.br (Evolution API)
- ✅ https://wa-manager.ytem.com.br (Evolution Manager)
- ⏳ https://stickers.ytem.com.br (Sticker Bot - pendente)

### 7.2 Verificar no Navegador

1. Abra: https://stickers.ytem.com.br/health
2. Verifique o cadeado (🔒) na barra de endereços
3. Clique no cadeado → **Certificate**
4. Emissor deve ser: **Let's Encrypt** ou **R3**

### 7.3 Health Check

```bash
curl https://stickers.ytem.com.br/health

# Resposta esperada:
{
  "status": "healthy",
  "timestamp": "2025-12-26T...",
  "services": {
    "redis": "connected",
    "supabase": "connected"
  }
}
```

---

## 🐞 Troubleshooting

### Problema: DNS não resolve

**Sintoma:** `dig stickers.ytem.com.br` retorna `NXDOMAIN`

**Soluções:**
1. Aguarde 5-10 minutos para propagação DNS
2. Verifique se o registro A foi criado corretamente no Cloudflare
3. Limpe cache DNS local:
   ```bash
   # macOS
   sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder

   # Linux
   sudo systemd-resolve --flush-caches
   ```

### Problema: SSL Error (ERR_CERT_AUTHORITY_INVALID)

**Sintoma:** Navegador mostra erro de certificado inválido

**Causas Possíveis:**
1. Traefik ainda está obtendo o certificado (aguarde 1-2 minutos)
2. DNS Challenge falhou (verificar token Cloudflare)
3. SSL Mode não está em "Full (strict)"

**Soluções:**
1. Verificar logs do Traefik:
   ```bash
   vps-ssh "docker service logs traefik_traefik --tail 50" | grep -i certificate
   ```
2. Verificar SSL Mode no Cloudflare (deve ser Full strict)
3. Redeployar stack:
   ```bash
   vps-ssh "docker stack deploy -c /tmp/stack-sticker.yml sticker"
   ```

### Problema: 502 Bad Gateway

**Sintoma:** Cloudflare retorna erro 502

**Causas Possíveis:**
1. Backend não está rodando
2. Porta incorreta no stack file
3. Network incorreta

**Soluções:**
1. Verificar se serviço está rodando:
   ```bash
   vps-ssh "docker service ls | grep sticker"
   ```
2. Verificar logs:
   ```bash
   vps-ssh "docker service logs sticker_backend --tail 100"
   ```
3. Verificar se está na rede correta:
   ```bash
   vps-ssh "docker service inspect sticker_backend --format '{{json .Spec.TaskTemplate.Networks}}'"
   ```

### Problema: Certificado não renova

**Sintoma:** Certificado expira e não renova automaticamente

**Soluções:**
1. Verificar se DNS Challenge está funcionando
2. Verificar token Cloudflare (pode ter expirado)
3. Verificar logs do Traefik:
   ```bash
   vps-ssh "docker service logs traefik_traefik" | grep -i renew
   ```

---

## 📊 Checklist de Validação

**Evolution API (Concluído ✅)**
- [x] Registro A criado (`wa` → `69.62.100.250`)
- [x] Registro A criado (`wa-manager` → `69.62.100.250`)
- [x] Proxy Status ativado
- [x] SSL/TLS Mode: Full (strict)
- [x] DNS resolvendo
- [x] HTTPS funcionando
- [x] Certificado SSL válido

**Sticker Bot (Pendente)**
- [ ] Registro A criado (`stickers` → `69.62.100.250`)
- [ ] Proxy Status ativado (☁️ laranja)
- [ ] SSL/TLS Mode: **Full (strict)**
- [ ] Token Cloudflare configurado (para DNS Challenge)
- [ ] DNS resolvendo corretamente (`dig stickers.ytem.com.br`)
- [ ] Aplicação deployada na VPS
- [ ] HTTPS funcionando (`https://stickers.ytem.com.br/health`)
- [ ] Certificado SSL válido (Let's Encrypt)
- [ ] Health check retornando status 200

---

## 🔗 Arquitetura Final

```
Usuário
  ↓
Cloudflare (*.ytem.com.br) - Proxied + DDoS Protection
  ↓ HTTPS
VPS (69.62.100.250 - srv1007351)
  ↓
Traefik (Reverse Proxy + SSL via DNS Challenge)
  ├→ wa.ytem.com.br → Evolution API v2.3.7 → PostgreSQL 15
  ├→ wa-manager.ytem.com.br → Evolution Manager
  └→ stickers.ytem.com.br → sticker_backend (Fastify - Port 3000)
                                ├→ Evolution API (webhooks)
                                └→ Supabase (storage)
      ↓
  sticker_worker (BullMQ - background processing)
```

---

## 📚 Referências

- **Cloudflare DNS Dashboard:** https://dash.cloudflare.com
- **Traefik Let's Encrypt Docs:** https://doc.traefik.io/traefik/https/acme/
- **DNS Challenge Docs:** https://doc.traefik.io/traefik/https/acme/#dnschallenge
- **Deployment Guide:** `deploy/DEPLOYMENT-GUIDE.md`
- **Doppler Setup:** `deploy/DOPPLER-SETUP.md`

---

## 🎯 Comandos Rápidos

```bash
# Verificar DNS
dig wa.ytem.com.br
dig stickers.ytem.com.br

# Testar HTTPS (Evolution API - funcionando)
curl -I https://wa.ytem.com.br

# Testar HTTPS (Sticker Bot - quando deployado)
curl -I https://stickers.ytem.com.br/health

# Ver logs do Traefik
vps-ssh "docker service logs traefik_traefik -f"

# Ver status de todos os serviços
vps-ssh "docker service ls"

# Verificar certificado SSL
echo | openssl s_client -servername wa.ytem.com.br -connect wa.ytem.com.br:443 2>/dev/null | openssl x509 -noout -dates
```

---

**Status:** 🟢 Evolution API DNS configurado ✅ | Sticker Bot DNS pendente
**Tempo Estimado:** 5-10 minutos (por DNS)
**Última Atualização:** 27/12/2025
