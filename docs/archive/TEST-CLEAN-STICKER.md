# 🧪 Teste Seguro - Remover Fundo + Bordas Brancas

Script de teste **isolado** que NÃO afeta o código de produção.

## ✅ O que faz:

1. Remove fundo da imagem com IA (rembg)
2. Remove bordas brancas/transparentes
3. Redimensiona para 512x512px (formato sticker WhatsApp)
4. Faz upload para Supabase Storage
5. Envia sticker via Evolution API

---

## 📋 Pré-requisitos

### 1. Python + rembg instalados

```bash
# Verificar se tem Python
python3 --version

# Instalar rembg (se não tiver)
pip3 install rembg[cli]
```

### 2. Variáveis de ambiente configuradas

Certifique-se que o `.env` tem:

```bash
SUPABASE_URL=https://ludlztjdvwsrwlsczoje.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUz...
EVOLUTION_API_URL=http://localhost:8080  # ou URL da VPS
EVOLUTION_API_KEY=I1hKpe...
EVOLUTION_INSTANCE=meu-zap
```

---

## 🚀 Como Usar

### Sintaxe:

```bash
npx tsx test-clean-sticker-safe.ts <caminho-imagem> <numero-whatsapp>
```

### Exemplos:

**1. Testar com imagem local:**
```bash
npx tsx test-clean-sticker-safe.ts /tmp/test-person.jpg 5511946304133
```

**2. Testar com sua foto:**
```bash
# Copie uma foto para /tmp/minha-foto.jpg
npx tsx test-clean-sticker-safe.ts /tmp/minha-foto.jpg 5511946304133
```

**3. Testar com imagem que tem borda branca:**
```bash
npx tsx test-clean-sticker-safe.ts /tmp/sticker-com-borda.png 5511946304133
```

---

## 📊 Saída Esperada

```
╔═══════════════════════════════════════════════════════════════╗
║          TESTE SEGURO - Remover Fundo + Bordas              ║
╚═══════════════════════════════════════════════════════════════╝

🔍 Verificando dependências...
   ✅ Python + rembg instalados

1️⃣ Processando imagem com rembg...
   🔄 Carregando modelo u2net...
   📥 Input: 17.4KB
   ✅ Fundo removido em 9.88s
   ✂️  Removendo bordas vazias...
   ✅ Bordas removidas em 1.31s
   📐 Original: 400x267px
   📐 Cropped: 282x251px
   📐 Final: 512x512px
   ⏱️  Tempo total: 11.19s
   💾 Arquivo criado: /tmp/sticker-processed.webp (10.4KB)

2️⃣ Fazendo upload para Supabase Storage...
   📤 Uploading 10.4KB...
   ✅ Upload completo!
   🔗 URL: https://ludlztjdvwsrwlsczoje.supabase.co/storage/v1/object/public/stickers/test/test_user/test_1736098234567.webp

3️⃣ Enviando sticker via Evolution API...
   📞 Destino: 5511946304133
   🌐 API: http://localhost:8080
   📡 Instância: meu-zap
   ✅ Sticker enviado!
   📨 Message ID: 3EB0ABC123...

╔═══════════════════════════════════════════════════════════════╗
║                    ✅ TESTE COMPLETO!                         ║
╚═══════════════════════════════════════════════════════════════╝

📊 Resumo:
   • Imagem processada: /tmp/sticker-processed.webp
   • URL no Supabase: https://...
   • Enviado para: 5511946304133

💡 Verifique seu WhatsApp!
```

---

## ⚠️ Troubleshooting

### ❌ "rembg não instalado"

```bash
pip3 install rembg[cli]
pip3 install onnxruntime
```

### ❌ "Evolution API não está acessível"

**Se testando localmente:**
- Evolution API precisa estar rodando em `localhost:8080`
- Ou altere `EVOLUTION_API_URL` no `.env`

**Se testando com VPS:**
- Evolution API só é acessível internamente na VPS
- Rode o script **na VPS** ou configure túnel SSH

### ❌ "Arquivo não encontrado"

Certifique-se que o caminho da imagem está correto:
```bash
ls -lh /tmp/test-person.jpg
```

### ❌ "Supabase upload falhou"

Verifique se `SUPABASE_URL` e `SUPABASE_SERVICE_KEY` estão corretos no `.env`

---

## 🔒 Segurança

Este script:
- ✅ **NÃO modifica código de produção**
- ✅ **NÃO afeta usuários reais**
- ✅ Cria arquivos apenas em `/tmp/`
- ✅ Upload vai para pasta `test/` no Supabase
- ✅ Pode ser deletado após teste sem problemas

---

## 🧹 Limpar Após Teste

```bash
# Remover arquivo processado local
rm /tmp/sticker-processed.webp

# Remover arquivos de teste do Supabase (opcional)
# Fazer via dashboard: https://supabase.com → Storage → stickers → test/
```

---

## 🎯 Próximos Passos

Se o teste funcionar:

1. ✅ Validar qualidade do sticker
2. ✅ Validar que bordas foram removidas
3. ✅ Validar que fundo está transparente
4. Integrar no código de produção (`stickerProcessor.ts`)
5. Adicionar comando `/limpar` no webhook

---

**Última atualização:** 05/01/2026
**Autor:** Claude + Paulo Henrique
