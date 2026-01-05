# 🎨 Guia de Stickers - Evolution API

## Endpoint para Stickers

A Evolution API possui um endpoint dedicado para envio de stickers (figurinhas).

### Informações Básicas

- **Método:** `POST`
- **Endpoint:** `/message/sendSticker/{instanceName}`
- **URL Completa:** `http://localhost:8080/message/sendSticker/meu-zap`

## Formatos Suportados

| Formato | Tipo | Animado | Recomendado |
|---------|------|---------|-------------|
| PNG | Imagem | ❌ Não | ✅ Bom |
| JPEG | Imagem | ❌ Não | ⚠️ OK |
| WebP | Imagem | ✅ Sim | 🌟 Melhor |

## Especificações Técnicas

- **Dimensões ideais:** 512x512 pixels (quadrado)
- **Tamanho máximo:** 500KB
- **Formato de envio:** URL ou Base64

## Como Enviar Stickers

### ⚠️ IMPORTANTE - Evolution API v2.2.3+

Na versão 2.2.3+, o campo `sticker` deve ser uma **string direta** com a URL ou Base64, não um objeto!

### Método 1: Via URL

```bash
curl -X POST http://localhost:8080/message/sendSticker/meu-zap \
  -H 'apikey: I1hKpeX0MZhOzyd5xDbXFBqRslKMHzMWxDdYEIPssXc=' \
  -H 'Content-Type: application/json' \
  -d '{
    "number": "5511999999999",
    "sticker": "https://exemplo.com/meu-sticker.png"
  }'
```

### Método 2: Via Base64

```bash
curl -X POST http://localhost:8080/message/sendSticker/meu-zap \
  -H 'apikey: I1hKpeX0MZhOzyd5xDbXFBqRslKMHzMWxDdYEIPssXc=' \
  -H 'Content-Type: application/json' \
  -d '{
    "number": "5511999999999",
    "sticker": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgA..."
  }'
```

### Método 3: Via Script Python

Criamos um script Python para facilitar o envio:

```bash
# Via URL
python3 enviar-sticker.py 5511999999999 https://exemplo.com/sticker.png

# Via arquivo local
python3 enviar-sticker.py 5511999999999 ./minha-imagem.png
```

## Estrutura do JSON

**Formato v2.2.3+ (atual):**
```json
{
  "number": "5511999999999",
  "sticker": "URL_OU_BASE64_DA_IMAGEM"
}
```

**Formato v1.x (antigo - NÃO use):**
```json
{
  "number": "5511999999999",
  "sticker": {
    "image": "URL"
  }
}
```

### Parâmetros

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `number` | string | ✅ Sim | Número do destinatário (formato: 5511999999999) |
| `sticker` | string | ✅ Sim | URL da imagem ou Base64 (data URI) |

## Stickers Animados

Para enviar stickers animados, use o formato **WebP animado**:

```json
{
  "number": "5511999999999",
  "sticker": "https://exemplo.com/sticker-animado.webp"
}
```

## Dicas e Boas Práticas

1. **Dimensões:**
   - Sempre use imagens quadradas (512x512)
   - O WhatsApp redimensiona automaticamente se necessário

2. **Tamanho do Arquivo:**
   - Mantenha abaixo de 500KB para melhor performance
   - Comprima imagens quando possível

3. **Formato:**
   - WebP oferece melhor qualidade/tamanho
   - PNG funciona bem para stickers estáticos

4. **Background:**
   - Use fundo transparente (PNG com alpha channel)
   - Evite fundos brancos ou coloridos

## Convertendo Imagens para Stickers

### Usando ImageMagick

```bash
# Redimensionar para 512x512
convert imagem.jpg -resize 512x512 -background transparent -gravity center -extent 512x512 sticker.png

# Converter para WebP
convert sticker.png -quality 90 sticker.webp
```

### Usando Python (PIL/Pillow)

```python
from PIL import Image

# Abrir imagem
img = Image.open('imagem.jpg')

# Redimensionar mantendo aspecto e adicionando transparência
img.thumbnail((512, 512))
background = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
offset = ((512 - img.width) // 2, (512 - img.height) // 2)
background.paste(img, offset)

# Salvar como PNG
background.save('sticker.png', 'PNG')

# Ou salvar como WebP
background.save('sticker.webp', 'WebP')
```

## Exemplo Completo em Python

```python
import requests
import base64

API_URL = "http://localhost:8080"
API_KEY = "I1hKpeX0MZhOzyd5xDbXFBqRslKMHzMWxDdYEIPssXc="
INSTANCE = "meu-zap"

def enviar_sticker(numero, caminho_imagem):
    # Ler e converter imagem para base64
    with open(caminho_imagem, 'rb') as f:
        image_base64 = base64.b64encode(f.read()).decode('utf-8')

    # Criar data URI
    data_uri = f"data:image/png;base64,{image_base64}"

    # Enviar
    response = requests.post(
        f"{API_URL}/message/sendSticker/{INSTANCE}",
        headers={
            "apikey": API_KEY,
            "Content-Type": "application/json"
        },
        json={
            "number": numero,
            "sticker": {"image": data_uri}
        }
    )

    return response.json()

# Usar
resultado = enviar_sticker("5511999999999", "./meu-sticker.png")
print(resultado)
```

## Possíveis Erros

| Código | Erro | Solução |
|--------|------|---------|
| 400 | Bad Request | Verifique o formato do JSON e número |
| 401 | Unauthorized | Confirme a API Key |
| 404 | Instance Not Found | Verifique se a instância existe e está conectada |
| 413 | Payload Too Large | Reduza o tamanho da imagem (< 500KB) |

## Recursos Úteis

- 📚 [Documentação Oficial](https://doc.evolution-api.com/v1/api-reference/message-controller/send-sticker)
- 🐙 [GitHub - Issue sobre stickers animados](https://github.com/EvolutionAPI/evolution-api/issues/1255)
- 🔧 Scripts criados:
  - `enviar-sticker.py` - Script Python para envio
  - `exemplo-sticker.sh` - Exemplos em Bash

## Testando

Para testar rapidamente, use este sticker de exemplo:

```bash
curl -X POST http://localhost:8080/message/sendSticker/meu-zap \
  -H 'apikey: I1hKpeX0MZhOzyd5xDbXFBqRslKMHzMWxDdYEIPssXc=' \
  -H 'Content-Type: application/json' \
  -d '{
    "number": "SEU_NUMERO_AQUI",
    "sticker": {
      "image": "https://raw.githubusercontent.com/pedroslopez/whatsapp-web.js/main/example.png"
    }
  }'
```

---

💡 **Dica:** Você pode usar sites como [ezgif.com](https://ezgif.com/) para converter e otimizar imagens para stickers online!
