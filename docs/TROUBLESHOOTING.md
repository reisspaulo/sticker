# 🔧 Troubleshooting - Solução de Problemas

> Guia completo de resolução de problemas comuns com Evolution API

## 📋 Índice

- [Problemas com QR Code](#problemas-com-qr-code)
- [Problemas de Conexão](#problemas-de-conexão)
- [Problemas com Docker](#problemas-com-docker)
- [Problemas de Porta](#problemas-de-porta)
- [Problemas com Mensagens](#problemas-com-mensagens)
- [Erros Comuns da API](#erros-comuns-da-api)

---

## ❌ Problemas com QR Code

### QR Code não está sendo gerado

**Sintomas:**
- Endpoint `/instance/connect` retorna `{"count": 0}`
- Nenhum QR Code aparece no Manager
- Modal do Manager fica vazio

**Causa Raiz:**
- Versão desatualizada da Evolution API (v2.1.1 tinha este bug)
- WebSocket não habilitado
- Versão do WhatsApp Web desatualizada no backend

**Solução:**

1. **Atualizar para v2.2.3 ou superior:**

Edite o `docker-compose.yml`:
```yaml
evolution-api:
  image: atendai/evolution-api:v2.2.3  # ou versão mais recente
```

2. **Habilitar WebSocket:**

Edite o arquivo `.env`:
```env
WEBSOCKET_ENABLED=true
WEBSOCKET_GLOBAL_EVENTS=true
```

3. **Reiniciar os serviços:**
```bash
docker compose down
docker compose up -d
```

4. **Deletar instâncias antigas e criar nova:**
```bash
# Listar instâncias
curl http://localhost:8080/instance/fetchInstances \
  -H 'apikey: I1hKpeX0MZhOzyd5xDbXFBqRslKMHzMWxDdYEIPssXc='

# Deletar instância antiga
curl -X DELETE http://localhost:8080/instance/delete/NOME_INSTANCIA \
  -H 'apikey: I1hKpeX0MZhOzyd5xDbXFBqRslKMHzMWxDdYEIPssXc='

# Criar nova instância
curl -X POST http://localhost:8080/instance/create \
  -H 'apikey: I1hKpeX0MZhOzyd5xDbXFBqRslKMHzMWxDdYEIPssXc=' \
  -H 'Content-Type: application/json' \
  -d '{"instanceName": "novo-nome", "integration": "WHATSAPP-BAILEYS"}'
```

**Referências:**
- [GitHub Issue #1768 - I CAN'T GET ANY QR CODE](https://github.com/EvolutionAPI/evolution-api/issues/1768)
- [GitHub Issue #1900 - QR Code not generated](https://github.com/EvolutionAPI/evolution-api/issues/1900)

---

### QR Code expira muito rápido

**Sintomas:**
- QR Code expira antes de conseguir escanear
- Precisa recarregar várias vezes

**Solução:**

Use o arquivo HTML que criamos (`qrcode.html`) que auto-atualiza o QR Code a cada 30 segundos:

```bash
open qrcode.html
```

Ou configure um intervalo menor no seu código:
```javascript
// Auto-refresh a cada 20 segundos
setInterval(getQRCode, 20000);
```

---

## 🔌 Problemas de Conexão

### Instância fica em loop "connecting"

**Sintomas:**
- Status da instância fica permanentemente em `connecting`
- Logs mostram tentativas repetidas de conexão

**Solução:**

1. **Verificar logs:**
```bash
docker compose logs evolution-api --tail 50
```

2. **Deletar e recriar a instância:**
```bash
# Deletar
curl -X DELETE http://localhost:8080/instance/delete/NOME_INSTANCIA \
  -H 'apikey: I1hKpeX0MZhOzyd5xDbXFBqRslKMHzMWxDdYEIPssXc='

# Recriar
curl -X POST http://localhost:8080/instance/create \
  -H 'apikey: I1hKpeX0MZhOzyd5xDbXFBqRslKMHzMWxDdYEIPssXc=' \
  -H 'Content-Type: application/json' \
  -d '{"instanceName": "nova-instancia", "integration": "WHATSAPP-BAILEYS"}'
```

3. **Limpar dados do Redis:**
```bash
docker compose exec redis redis-cli FLUSHALL
docker compose restart evolution-api
```

---

### Conexão cai constantemente

**Sintomas:**
- WhatsApp desconecta sozinho
- Precisa reconectar frequentemente

**Possíveis Causas e Soluções:**

1. **WhatsApp detectou uso de API:**
   - Use números que não sejam sua linha principal
   - Evite enviar muitas mensagens em pouco tempo
   - Adicione delays entre mensagens

2. **Versão do WhatsApp Web desatualizada:**
   - Aguarde atualização da Evolution API
   - Monitore o GitHub para atualizações

3. **Problemas de rede:**
   - Verifique sua conexão com a internet
   - Certifique-se que Docker tem acesso à rede

---

## 🐳 Problemas com Docker

### Containers não iniciam

**Sintomas:**
- `docker compose up -d` falha
- Containers aparecem como "Exited"

**Solução:**

1. **Verificar logs:**
```bash
docker compose logs
```

2. **Verificar se as portas estão disponíveis:**
```bash
# macOS/Linux
lsof -i :8080
lsof -i :5432
lsof -i :6379
lsof -i :3001

# Windows
netstat -ano | findstr :8080
```

3. **Remover containers e volumes antigos:**
```bash
docker compose down -v
docker compose up -d
```

4. **Verificar permissões:**
```bash
# Linux - dar permissões corretas
sudo chown -R $USER:$USER .
```

---

### Evolution API não conecta ao PostgreSQL

**Sintomas:**
- Logs mostram erro de conexão com banco
- API não inicializa completamente

**Solução:**

1. **Verificar se o PostgreSQL está rodando:**
```bash
docker compose ps postgres
```

2. **Verificar variáveis de ambiente:**

Confirme no `.env`:
```env
DATABASE_ENABLED=true
DATABASE_PROVIDER=postgresql
DATABASE_CONNECTION_URI=postgresql://evolution:evolution_password@postgres:5432/evolution
```

3. **Aguardar PostgreSQL inicializar:**

Adicione `depends_on` no `docker-compose.yml`:
```yaml
evolution-api:
  depends_on:
    postgres:
      condition: service_healthy
```

---

### Redis não conecta

**Sintomas:**
- Erro "Connection refused" nos logs
- Cache não funciona

**Solução:**

1. **Verificar se Redis está rodando:**
```bash
docker compose ps redis
```

2. **Testar conexão manualmente:**
```bash
docker compose exec redis redis-cli ping
# Deve retornar: PONG
```

3. **Verificar configuração no `.env`:**
```env
CACHE_REDIS_ENABLED=true
CACHE_REDIS_URI=redis://redis:6379
```

---

## 🔌 Problemas de Porta

### Porta já está em uso

**Sintomas:**
```
Error: bind: address already in use
```

**Solução para porta 8080:**

1. **Descobrir quem está usando:**
```bash
# macOS/Linux
lsof -i :8080

# Windows
netstat -ano | findstr :8080
```

2. **Matar o processo:**
```bash
# macOS/Linux
kill -9 <PID>

# Windows
taskkill /PID <PID> /F
```

3. **Ou mudar a porta no docker-compose.yml:**
```yaml
evolution-api:
  ports:
    - "8081:8080"  # Mude 8080 para 8081 ou outra porta
```

**Solução para porta 3001 (Manager):**

Edite o `docker-compose.yml`:
```yaml
evolution-manager:
  ports:
    - "3002:80"  # Mude 3001 para 3002
```

---

## 💬 Problemas com Mensagens

### Mensagens não são enviadas

**Sintomas:**
- API retorna 200 OK mas mensagem não chega
- Erro "Instance not connected"

**Solução:**

1. **Verificar se a instância está conectada:**
```bash
curl http://localhost:8080/instance/connectionState/NOME_INSTANCIA \
  -H 'apikey: I1hKpeX0MZhOzyd5xDbXFBqRslKMHzMWxDdYEIPssXc='
```

2. **Verificar formato do número:**

✅ Correto:
```json
{
  "number": "5511999999999"  // DDI + DDD + Número
}
```

❌ Incorreto:
```json
{
  "number": "+55 11 99999-9999"  // Com formatação
}
```

3. **Verificar se o número existe no WhatsApp:**

Teste enviando uma mensagem manual para o número antes.

---

### Stickers não são enviados

**Sintomas:**
- Erro 400 ou 500 ao enviar sticker
- Sticker não aparece como figurinha

**Solução:**

1. **Verificar formato da imagem:**
   - Use PNG ou WebP
   - Tamanho máximo: 500KB
   - Dimensões ideais: 512x512

2. **Verificar estrutura do JSON:**

✅ Correto:
```json
{
  "number": "5511999999999",
  "sticker": {
    "image": "https://exemplo.com/sticker.png"
  }
}
```

3. **Converter imagem para formato adequado:**
```bash
# Usando ImageMagick
convert imagem.jpg -resize 512x512 -background transparent sticker.png
```

Veja mais em: [docs/STICKERS.md](STICKERS.md)

---

## ⚠️ Erros Comuns da API

### 400 Bad Request

**Causa:** JSON malformado ou parâmetros inválidos

**Solução:**
- Verifique se o JSON está válido
- Confirme que todos os campos obrigatórios estão presentes
- Use `Content-Type: application/json` no header

---

### 401 Unauthorized

**Causa:** API Key inválida ou ausente

**Solução:**
```bash
# Certifique-se de usar o header correto
-H 'apikey: I1hKpeX0MZhOzyd5xDbXFBqRslKMHzMWxDdYEIPssXc='
```

---

### 404 Instance Not Found

**Causa:** Instância não existe ou nome incorreto

**Solução:**

1. **Listar instâncias disponíveis:**
```bash
curl http://localhost:8080/instance/fetchInstances \
  -H 'apikey: I1hKpeX0MZhOzyd5xDbXFBqRslKMHzMWxDdYEIPssXc='
```

2. **Criar nova instância se necessário:**
```bash
curl -X POST http://localhost:8080/instance/create \
  -H 'apikey: I1hKpeX0MZhOzyd5xDbXFBqRslKMHzMWxDdYEIPssXc=' \
  -H 'Content-Type: application/json' \
  -d '{"instanceName": "meu-whatsapp", "integration": "WHATSAPP-BAILEYS"}'
```

---

### 413 Payload Too Large

**Causa:** Arquivo muito grande (imagem, vídeo, etc)

**Solução:**
- Reduza o tamanho do arquivo
- Para imagens: comprima usando TinyPNG ou similar
- Para vídeos: reduza a resolução
- Limite: ~500KB para stickers, ~16MB para outros

---

### 500 Internal Server Error

**Causa:** Erro interno do servidor

**Solução:**

1. **Verificar logs da API:**
```bash
docker compose logs evolution-api --tail 100
```

2. **Reiniciar a API:**
```bash
docker compose restart evolution-api
```

3. **Reportar bug:**

Se o erro persistir, reporte em:
https://github.com/EvolutionAPI/evolution-api/issues

---

## 🔍 Comandos de Diagnóstico

### Verificar Status Geral

```bash
# Ver todos os containers
docker compose ps

# Ver uso de recursos
docker stats

# Ver logs de todos os serviços
docker compose logs --tail 50

# Ver apenas logs da API
docker compose logs evolution-api --tail 50
```

### Testar Conectividade

```bash
# Testar API
curl http://localhost:8080/

# Testar se instância existe
curl http://localhost:8080/instance/fetchInstances \
  -H 'apikey: I1hKpeX0MZhOzyd5xDbXFBqRslKMHzMWxDdYEIPssXc='

# Testar PostgreSQL
docker compose exec postgres psql -U evolution -d evolution -c "SELECT 1"

# Testar Redis
docker compose exec redis redis-cli ping
```

---

## 🆘 Resetar Tudo (Última Opção)

Se nada funcionar, reset completo:

```bash
# 1. Parar e remover tudo
docker compose down -v

# 2. Remover imagens antigas
docker rmi atendai/evolution-api:v2.1.1 2>/dev/null || true
docker rmi atendai/evolution-manager:latest 2>/dev/null || true

# 3. Limpar volumes órfãos
docker volume prune -f

# 4. Subir tudo novamente
docker compose pull
docker compose up -d

# 5. Aguardar inicialização (30 segundos)
sleep 30

# 6. Verificar status
docker compose ps
```

---

## 📚 Recursos de Suporte

- 📖 [Documentação Oficial](https://doc.evolution-api.com)
- 🐙 [GitHub Issues](https://github.com/EvolutionAPI/evolution-api/issues)
- 💬 [Discord Evolution API](https://evolution-api.com/discord)
- 📮 [Postman Collection](https://www.postman.com/agenciadgcode/evolution-api)

---

## 🔗 Links Úteis

- [Configuração Inicial](CONFIGURACAO.md)
- [Documentação de Endpoints](ENDPOINTS.md)
- [Guia de Stickers](STICKERS.md)
- [README Principal](../README.md)

---

**Última atualização:** 26/12/2025

**Problemas resolvidos neste projeto:**
- ✅ QR Code não gerava (atualização para v2.2.3)
- ✅ Porta 3000 em uso (mudança para porta 3001)
- ✅ WebSocket não habilitado (configuração no .env)
- ✅ Evolution Manager com erro de módulo (desabilitado temporariamente)
