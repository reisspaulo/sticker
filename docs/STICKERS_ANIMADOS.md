# 🎬 Guia de Stickers Animados - Evolution API

> ✅ **Stickers animados funcionam perfeitamente na Evolution API v2.3.0+!**

## ⚡ Quick Start

```bash
# Enviar GIF animado como sticker
curl -X POST http://localhost:8080/message/sendSticker/meu-zap \
  -H "apikey: SUA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "number": "5511999999999",
    "sticker": "https://media.giphy.com/media/13UZisxBxkjPwI/giphy.gif"
  }'
```

**Resultado:** Figurinha animada enviada e funcionando! 🎉

---

## ✨ Requisitos

### Versão da Evolution API

| Versão | Status | Suporte a Animação |
|--------|--------|-------------------|
| **v2.3.0+** | ✅ Recomendado | Preserva animação automaticamente |
| v2.2.3 ou inferior | ❌ Desatualizado | Converte para estático |

**Como verificar sua versão:**
```bash
curl http://localhost:8080/ | jq -r '.version'
```

**Como atualizar (Docker):**
```yaml
# docker-compose.yml
evolution-api:
  image: evoapicloud/evolution-api:v2.3.1
```

---

## 📋 Índice

- [O que são Stickers Animados](#-o-que-são-stickers-animados)
- [Formatos Suportados](#-formatos-suportados)
- [Como Enviar](#-como-enviar)
- [Convertendo Vídeos/GIFs](#-convertendo-vídeosgifs)
- [Especificações Técnicas](#-especificações-técnicas)
- [Ferramentas Úteis](#-ferramentas-úteis)
- [Exemplos Práticos](#-exemplos-práticos)
- [Problemas Comuns](#-problemas-comuns)

---

## 🎨 O que são Stickers Animados?

Stickers animados são figurinhas que se movem, como GIFs. No WhatsApp, eles são automaticamente convertidos para **WebP animados**.

### Diferença para Stickers Estáticos

| Tipo | Formato | Tamanho | Uso |
|------|---------|---------|-----|
| **Estático** | PNG, JPG → WebP | ~20-100KB | Imagens fixas |
| **Animado** | GIF → WebP animado | ~100-500KB | GIFs, vídeos curtos |

---

## 🎯 Formatos Suportados

### ✅ Funcionam Perfeitamente (v2.3.0+)

| Formato Original | O WhatsApp Converte Para | Recomendação |
|------------------|--------------------------|--------------|
| **GIF via URL** | WebP animado | 🌟 Melhor opção |
| **WebP animado** | Mantém WebP | ✅ Ideal |
| **MP4 curto** | WebP animado | ✅ Funciona |

### Testado e Confirmado ✅

```bash
# GIF do Giphy (2.1MB)
https://media.giphy.com/media/13UZisxBxkjPwI/giphy.gif
→ Resultado: ✅ Animado

# GIF de digitação (315KB)
https://i.giphy.com/media/v1.Y2lkPTc5MGI3NjExbTdxdHp2OWJyaGRvZnNwNmFkdW1ub3p4cXg1cjc1OHl6dGg2MnJ2eSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/MDJ9IbxxvDUQM/giphy.gif
→ Resultado: ✅ Animado
```

### ❌ Limitações

- ⚠️ **Base64 de GIF**: Pode ser muito pesado (>5MB)
- ⚠️ **Upload direto de arquivo**: Não suportado, use URL
- ⚠️ **Vídeos longos**: Máximo ~10 segundos

---

## 🚀 Como Enviar

### Método 1: GIF via URL (Mais Fácil) 🌟

```bash
curl -X POST http://localhost:8080/message/sendSticker/INSTANCE_NAME \
  -H "apikey: SUA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "number": "5511999999999",
    "sticker": "https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif"
  }'
```

**Requisitos:**
- ✅ URL deve terminar em `.gif` ou `.webp`
- ✅ Deve ser acessível publicamente
- ✅ Tamanho recomendado: < 500KB
- ✅ Dimensões: 512x512px (ideal)

### Método 2: WebP Animado Hospedado

```bash
curl -X POST http://localhost:8080/message/sendSticker/INSTANCE_NAME \
  -H "apikey: SUA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "number": "5511999999999",
    "sticker": "https://seuservidor.com/sticker-animado.webp"
  }'
```

### Método 3: Via Script Python

```python
import requests

def enviar_sticker_animado(numero, url_gif):
    endpoint = "http://localhost:8080/message/sendSticker/INSTANCE_NAME"

    headers = {
        "apikey": "SUA_API_KEY",
        "Content-Type": "application/json"
    }

    payload = {
        "number": numero,
        "sticker": url_gif  # v2.3+ usa string direta
    }

    response = requests.post(endpoint, json=payload, headers=headers)
    return response.json()

# Usar
resultado = enviar_sticker_animado(
    "5511999999999",
    "https://media.giphy.com/media/13UZisxBxkjPwI/giphy.gif"
)
print(resultado)
```

---

## 🎬 Convertendo Vídeos/GIFs

### Opção 1: GIF → WebP Animado (Online)

**Ferramenta:** [ezgif.com/gif-to-webp](https://ezgif.com/gif-to-webp)

1. Upload do GIF
2. Ajustar qualidade (80-90%)
3. Redimensionar para 512x512
4. Download do WebP
5. Hospedar em servidor
6. Usar URL no endpoint

### Opção 2: Vídeo → GIF → WebP (FFmpeg)

```bash
# 1. Vídeo para GIF (10 segundos, 512x512)
ffmpeg -i video.mp4 -t 10 \
  -vf "fps=15,scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2" \
  -loop 0 output.gif

# 2. GIF para WebP animado (opcional, mais eficiente)
ffmpeg -i output.gif \
  -vcodec libwebp \
  -q:v 75 \
  -loop 0 \
  output.webp
```

**Parâmetros explicados:**
- `-t 10`: Duração de 10 segundos
- `-vf scale=512:512`: Redimensiona para 512x512
- `-r 15`: 15 frames por segundo
- `-q:v 75`: Qualidade 75% (ajuste entre 50-100)
- `-loop 0`: Loop infinito

### Opção 3: Python com Pillow

```python
from PIL import Image

# GIF → WebP
gif = Image.open("input.gif")
gif.save("output.webp", save_all=True, optimize=True, quality=85)
```

### Opção 4: ImageMagick

```bash
# GIF → WebP
convert input.gif -resize 512x512 -quality 85 output.webp

# Vídeo → GIF → WebP
ffmpeg -i video.mp4 -vf "scale=512:512" -t 10 temp.gif
convert temp.gif -quality 85 output.webp
rm temp.gif
```

---

## 📊 Especificações Técnicas

### Dimensões

| Parâmetro | Valor Recomendado |
|-----------|-------------------|
| **Largura/Altura** | 512x512 pixels |
| **Aspect Ratio** | 1:1 (quadrado) |
| **Mínimo** | 256x256 pixels |
| **Máximo** | 800x800 pixels |

### Tamanho do Arquivo

| Tipo | Tamanho Ideal | Máximo |
|------|---------------|--------|
| **GIF** | < 300KB | 500KB |
| **WebP Animado** | < 200KB | 500KB |
| **MP4 (para converter)** | < 1MB | 5MB |

### Duração

- **Recomendado:** 3-5 segundos
- **Máximo:** ~10 segundos
- **FPS:** 10-20 frames/segundo

### Formato de Saída (WhatsApp)

O WhatsApp sempre converte para:
- **Formato:** WebP animado
- **Codec:** VP8 ou VP9
- **Qualidade:** Otimizada automaticamente

---

## 🛠 Ferramentas Úteis

### Online (Grátis)

| Ferramenta | URL | Função |
|------------|-----|--------|
| **ezgif** | [ezgif.com](https://ezgif.com/) | Converter GIF ↔ WebP, otimizar |
| **CloudConvert** | [cloudconvert.com](https://cloudconvert.com/) | Converter vídeo → GIF/WebP |
| **GIPHY** | [giphy.com](https://giphy.com/) | Encontrar GIFs prontos |
| **Tenor** | [tenor.com](https://tenor.com/) | Biblioteca de GIFs |

### Desktop (Instalar)

| Software | Plataforma | Uso |
|----------|------------|-----|
| **FFmpeg** | Windows/Mac/Linux | Conversão vídeo → GIF → WebP |
| **ImageMagick** | Windows/Mac/Linux | Manipulação de imagens animadas |
| **XnConvert** | Windows/Mac/Linux | GUI para conversão em lote |

### Bibliotecas para Desenvolvedores

#### Python
```bash
pip install pillow imageio
```

```python
from PIL import Image
import imageio

# GIF → WebP
gif = Image.open("input.gif")
gif.save("output.webp", save_all=True, optimize=True, quality=85)
```

#### Node.js
```bash
npm install sharp
```

```javascript
const sharp = require('sharp');

// Converter e redimensionar
await sharp('input.gif', { animated: true })
  .resize(512, 512)
  .webp({ quality: 85 })
  .toFile('output.webp');
```

---

## 💡 Dicas e Boas Práticas

### 1. Otimização de Tamanho

```bash
# Reduzir frames (de 30fps para 15fps)
ffmpeg -i input.gif -r 15 output.gif

# Reduzir cores (256 → 128)
convert input.gif -colors 128 output.gif

# Comprimir WebP
ffmpeg -i input.gif -vcodec libwebp -q:v 60 output.webp
```

### 2. Cortar Duração

```bash
# Apenas os primeiros 5 segundos
ffmpeg -i input.mp4 -t 5 -vf "scale=512:512" output.gif
```

### 3. Loop Infinito

```bash
# Garantir loop no WebP
ffmpeg -i input.gif -loop 0 output.webp
```

### 4. Hospedar GIFs

**Opções gratuitas:**
- **GIPHY:** Já hospeda, use a URL direta do `.gif`
- **Imgur:** Upload e use a URL `.gif`
- **GitHub:** Repositório público (para poucos arquivos)
- **Cloudinary:** CDN gratuito com limite generoso
- **Seu próprio servidor:** Nginx, Apache, etc.

**Exemplo com GIPHY:**
1. Acesse [giphy.com](https://giphy.com)
2. Encontre um GIF
3. Clique com botão direito → "Copy link address"
4. Use a URL no formato: `https://media.giphy.com/media/ID/giphy.gif`

---

## 📝 Exemplos Práticos

### Exemplo 1: GIF do GIPHY

```bash
# 1. Encontre um GIF no GIPHY
# URL: https://giphy.com/gifs/cat-dance-3o7abKhOpu0NwenH3O

# 2. Pegue a URL direta do GIF
# https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif

# 3. Envie via API
curl -X POST http://localhost:8080/message/sendSticker/meu-zap \
  -H "apikey: I1hKpeX0MZhOzyd5xDbXFBqRslKMHzMWxDdYEIPssXc=" \
  -H "Content-Type: application/json" \
  -d '{
    "number": "5511999999999",
    "sticker": "https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif"
  }'
```

### Exemplo 2: Converter Vídeo Local

```bash
# Seu vídeo: video.mp4
# Objetivo: Sticker animado de 512x512, 5 segundos

# Passo 1: Converter para GIF otimizado
ffmpeg -i video.mp4 -t 5 \
  -vf "fps=15,scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2" \
  -loop 0 output.gif

# Passo 2: GIF → WebP (opcional, mais eficiente)
ffmpeg -i output.gif -vcodec libwebp \
  -q:v 75 -loop 0 output.webp

# Passo 3: Hospedar (exemplo com Python HTTP server)
python3 -m http.server 8000

# Passo 4: Enviar via API
curl -X POST http://localhost:8080/message/sendSticker/meu-zap \
  -H "apikey: I1hKpeX0MZhOzyd5xDbXFBqRslKMHzMWxDdYEIPssXc=" \
  -H "Content-Type: application/json" \
  -d '{
    "number": "5511999999999",
    "sticker": "http://SEU_IP:8000/output.webp"
  }'
```

### Exemplo 3: Script Python Completo

```python
#!/usr/bin/env python3
import requests
import subprocess
import os

def converter_video_para_sticker(video_path, output_path="sticker.webp"):
    """Converte vídeo para WebP animado otimizado"""
    cmd = [
        'ffmpeg', '-i', video_path,
        '-t', '5',  # 5 segundos
        '-vf', 'fps=15,scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2',
        '-vcodec', 'libwebp',
        '-q:v', '75',
        '-loop', '0',
        '-y',  # Sobrescrever
        output_path
    ]
    subprocess.run(cmd, check=True)
    return output_path

def enviar_sticker_animado_local(numero, video_path):
    """Converte vídeo e envia como sticker"""
    # 1. Converter
    webp_path = converter_video_para_sticker(video_path)

    # 2. Hospedar temporariamente (ou use servidor real)
    # Aqui você precisa hospedar o arquivo e obter a URL
    url_hospedada = "http://seuservidor.com/" + webp_path

    # 3. Enviar
    endpoint = "http://localhost:8080/message/sendSticker/meu-zap"
    headers = {
        "apikey": "I1hKpeX0MZhOzyd5xDbXFBqRslKMHzMWxDdYEIPssXc=",
        "Content-Type": "application/json"
    }
    payload = {
        "number": numero,
        "sticker": url_hospedada
    }

    response = requests.post(endpoint, json=payload, headers=headers)
    return response.json()

# Usar
resultado = enviar_sticker_animado_local("5511999999999", "meu_video.mp4")
print(resultado)
```

---

## ⚠️ Problemas Comuns

### Sticker não anima (v2.2.3 ou inferior)

**Causa:** Versão desatualizada da Evolution API

**Solução:**
```yaml
# docker-compose.yml - ATUALIZE para v2.3.0+
evolution-api:
  image: evoapicloud/evolution-api:v2.3.1
```

```bash
docker compose down
docker compose up -d
```

### Sticker muito pesado

**Causa:** Arquivo >500KB ou muitos frames

**Solução:**
```bash
# Reduzir FPS e qualidade
ffmpeg -i input.gif -r 12 -vcodec libwebp -q:v 65 output.webp
```

### Sticker distorcido

**Causa:** Aspect ratio incorreto

**Solução:**
```bash
# Forçar 1:1 com padding
ffmpeg -i input.gif \
  -vf "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2" \
  output.webp
```

### Erro "File too large"

**Solução:**
```bash
# Comprimir agressivamente
ffmpeg -i input.gif -vcodec libwebp -q:v 50 -r 10 output.webp

# Ou reduzir duração
ffmpeg -i input.gif -t 3 output.webp
```

### GIF chegou parado

**Checklist de debug:**
1. ✅ Versão da API é v2.3.0+? → `curl http://localhost:8080/ | jq -r '.version'`
2. ✅ URL do GIF é pública e acessível?
3. ✅ Arquivo < 500KB?
4. ✅ GIF tem menos de 10 segundos?

---

## 📚 Recursos e Referências

- 🌐 [GitHub Issue #1255 - Animated Stickers](https://github.com/EvolutionAPI/evolution-api/issues/1255)
- 📦 [Evolution API Releases](https://github.com/EvolutionAPI/evolution-api/releases)
- 🎨 [ezgif.com - GIF to WebP Converter](https://ezgif.com/gif-to-webp)
- 📖 [FFmpeg WebP Documentation](https://trac.ffmpeg.org/wiki/Encode/VP8)
- 🎬 [GIPHY API](https://developers.giphy.com/)
- 🛠️ [ImageMagick WebP Guide](https://imagemagick.org/script/webp.php)

---

## 🎯 Resumo Rápido

**Para enviar sticker animado:**

1. ✅ Atualize para Evolution API **v2.3.0+**
2. ✅ Tenha um GIF ou vídeo curto (≤10s)
3. ✅ Converta para 512x512, ≤500KB
4. ✅ Hospede em URL pública (ou use GIPHY)
5. ✅ Use endpoint `/message/sendSticker` com a URL
6. ✅ WhatsApp converte automaticamente para WebP animado

**Comando rápido (FFmpeg):**
```bash
ffmpeg -i input.mp4 -t 5 \
  -vf "fps=15,scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2" \
  -vcodec libwebp -q:v 75 -loop 0 output.webp
```

**Teste simples:**
```bash
curl -X POST http://localhost:8080/message/sendSticker/INSTANCE \
  -H "apikey: API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"number":"5511999999999","sticker":"https://media.giphy.com/media/13UZisxBxkjPwI/giphy.gif"}'
```

---

## 🏆 Testado e Aprovado

- ✅ Testado com Evolution API v2.3.1
- ✅ Confirmado funcionando em 26/12/2025
- ✅ GIFs do GIPHY funcionam perfeitamente
- ✅ Animação preservada no WhatsApp

---

**Última atualização:** 26/12/2025
**Versão testada:** Evolution API v2.3.1
**Status:** ✅ Totalmente funcional
