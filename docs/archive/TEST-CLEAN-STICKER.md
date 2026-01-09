# Teste Seguro - Remover Fundo + Bordas Brancas

Script de teste **isolado** que NAO afeta o codigo de producao.

## O que faz:

1. Remove fundo da imagem com IA (rembg)
2. Remove bordas brancas/transparentes
3. Redimensiona para 512x512px (formato sticker WhatsApp)
4. Faz upload para Supabase Storage
5. Envia sticker via Evolution API

---

## Pre-requisitos

### 1. Python + rembg instalados

```bash
# Verificar se tem Python
python3 --version

# Instalar rembg (se nao tiver)
pip3 install rembg[cli]
```

### 2. Variaveis de ambiente via Doppler

```bash
# NUNCA crie arquivos .env com secrets reais
# Use sempre Doppler:
doppler run npx tsx test-clean-sticker-safe.ts <imagem> <numero>
```

---

## Como Usar

### Sintaxe:

```bash
doppler run npx tsx test-clean-sticker-safe.ts <caminho-imagem> <numero-whatsapp>
```

### Exemplos:

**1. Testar com imagem local:**
```bash
doppler run npx tsx test-clean-sticker-safe.ts /tmp/test-person.jpg 5511999999999
```

**2. Testar com sua foto:**
```bash
doppler run npx tsx test-clean-sticker-safe.ts /tmp/minha-foto.jpg 5511999999999
```

---

## Saida Esperada

```
1. Processando imagem com rembg...
   Fundo removido em 9.88s
   Bordas removidas em 1.31s
   Final: 512x512px

2. Fazendo upload para Supabase Storage...
   Upload completo!

3. Enviando sticker via Evolution API...
   Sticker enviado!

TESTE COMPLETO!
```

---

## Troubleshooting

### "rembg nao instalado"

```bash
pip3 install rembg[cli]
pip3 install onnxruntime
```

### "Evolution API nao esta acessivel"

- Evolution API precisa estar rodando
- Verifique a URL no Doppler config

### "Supabase upload falhou"

- Verifique se SUPABASE_URL e SUPABASE_SERVICE_KEY estao no Doppler

---

## Seguranca

Este script:
- NAO modifica codigo de producao
- NAO afeta usuarios reais
- Cria arquivos apenas em `/tmp/`
- Upload vai para pasta `test/` no Supabase

---

## Limpar Apos Teste

```bash
# Remover arquivo processado local
rm /tmp/sticker-processed.webp

# Remover arquivos de teste do Supabase (opcional)
# Fazer via dashboard: https://supabase.com -> Storage -> stickers -> test/
```

---

**Ultima atualizacao:** 05/01/2026
