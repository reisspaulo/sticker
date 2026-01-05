# 📱 Projeto Evolution API - WhatsApp Integration

> Sistema completo de integração com WhatsApp usando Evolution API

---

## 🎯 Projetos neste Repositório

Este repositório contém **dois projetos**:

1. **Evolution API** (este README) - Setup e integração do WhatsApp
2. **Sticker Bot** - Bot de conversão de imagens em stickers
   - 📖 **Documentação:** [/docs/INDEX.md](docs/INDEX.md)
   - 🚀 **Setup:** [/docs/README.md](docs/README.md)

Se você está procurando a **documentação do Sticker Bot**, acesse: [/docs/INDEX.md](docs/INDEX.md)

---

## 📋 Índice

- [Sobre o Projeto](#sobre-o-projeto)
- [Tecnologias Utilizadas](#tecnologias-utilizadas)
- [Requisitos](#requisitos)
- [Instalação e Configuração](#instalação-e-configuração)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Como Usar](#como-usar)
- [Documentação](#documentação)
- [Scripts Disponíveis](#scripts-disponíveis)
- [Troubleshooting](#troubleshooting)
- [Recursos Úteis](#recursos-úteis)

---

## 🎯 Sobre o Projeto

Este projeto implementa uma integração completa com WhatsApp usando a **Evolution API v2.2.3**, permitindo:

- ✅ Envio e recebimento de mensagens
- ✅ Envio de stickers (figurinhas)
- ✅ Envio de mídias (imagens, vídeos, áudios)
- ✅ Gerenciamento de múltiplas instâncias
- ✅ Webhooks para eventos em tempo real
- ✅ Interface web de gerenciamento

## 🛠 Tecnologias Utilizadas

| Tecnologia | Versão | Descrição |
|------------|--------|-----------|
| **Evolution API** | v2.2.3 | API REST para WhatsApp |
| **PostgreSQL** | 15 | Banco de dados relacional |
| **Redis** | latest | Cache e performance |
| **Docker** | 28.4.0+ | Containerização |
| **Docker Compose** | v2.39.2+ | Orquestração de containers |
| **Evolution Manager** | latest | Interface web (opcional) |

## 📦 Requisitos

- Docker Desktop instalado
- Docker Compose instalado
- Portas disponíveis: `8080`, `3001`, `5432`, `6379`
- Navegador web moderno
- Python 3.x (para scripts Python)

## ⚙️ Instalação e Configuração

### 1️⃣ Configuração Inicial

Todos os serviços já estão configurados e prontos para uso!

**Credenciais de Acesso:**

```env
API_KEY=I1hKpeX0MZhOzyd5xDbXFBqRslKMHzMWxDdYEIPssXc=
API_URL=http://localhost:8080
```

### 2️⃣ Iniciar os Serviços

```bash
# Iniciar todos os containers
docker compose up -d

# Verificar status
docker compose ps

# Ver logs em tempo real
docker compose logs -f evolution-api
```

### 3️⃣ Acessar os Serviços

| Serviço | URL | Credenciais |
|---------|-----|-------------|
| **Evolution API** | http://localhost:8080 | API Key (veja acima) |
| **Documentação Interativa** | http://localhost:8080/manager | API Key (veja acima) |
| **Evolution Manager** | http://localhost:3001 | API Key (veja acima) |

### 4️⃣ Conectar WhatsApp

1. Acesse http://localhost:3001
2. Configure:
   - **Server URL:** `http://localhost:8080`
   - **API Key Global:** `I1hKpeX0MZhOzyd5xDbXFBqRslKMHzMWxDdYEIPssXc=`
3. Crie uma instância
4. Escaneie o QR Code com seu WhatsApp

**Ou use o arquivo HTML gerado:**
```bash
open qrcode.html
```

## 📁 Estrutura do Projeto

```
sticker/
├── README.md                      # Este arquivo
├── docker-compose.yml             # Orquestração dos serviços
├── .env                           # Variáveis de ambiente
│
├── docs/                          # 📚 Documentação
│   ├── CONFIGURACAO.md           # Guia de configuração
│   ├── ENDPOINTS.md              # Documentação de endpoints
│   ├── STICKERS.md               # Guia de stickers
│   └── TROUBLESHOOTING.md        # Solução de problemas
│
├── scripts/                       # 🔧 Scripts úteis
│   ├── enviar-sticker.py         # Enviar stickers via Python
│   ├── exemplo-sticker.sh        # Exemplos de stickers
│   └── test-api.sh               # Testar a API
│
├── exemplos/                      # 💡 Exemplos de código
│   ├── python/                   # Exemplos em Python
│   ├── javascript/               # Exemplos em JavaScript
│   └── curl/                     # Exemplos em cURL
│
└── qrcode.html                   # Visualizador de QR Code
```

## 🚀 Como Usar

### Criar uma Instância

```bash
curl -X POST http://localhost:8080/instance/create \
  -H 'apikey: I1hKpeX0MZhOzyd5xDbXFBqRslKMHzMWxDdYEIPssXc=' \
  -H 'Content-Type: application/json' \
  -d '{
    "instanceName": "meu-whatsapp",
    "integration": "WHATSAPP-BAILEYS"
  }'
```

### Obter QR Code

```bash
curl http://localhost:8080/instance/connect/meu-whatsapp \
  -H 'apikey: I1hKpeX0MZhOzyd5xDbXFBqRslKMHzMWxDdYEIPssXc='
```

### Enviar Mensagem de Texto

```bash
curl -X POST http://localhost:8080/message/sendText/meu-whatsapp \
  -H 'apikey: I1hKpeX0MZhOzyd5xDbXFBqRslKMHzMWxDdYEIPssXc=' \
  -H 'Content-Type: application/json' \
  -d '{
    "number": "5511999999999",
    "text": "Olá! Mensagem via Evolution API"
  }'
```

### Enviar Sticker

```bash
curl -X POST http://localhost:8080/message/sendSticker/meu-whatsapp \
  -H 'apikey: I1hKpeX0MZhOzyd5xDbXFBqRslKMHzMWxDdYEIPssXc=' \
  -H 'Content-Type: application/json' \
  -d '{
    "number": "5511999999999",
    "sticker": {
      "image": "https://exemplo.com/sticker.png"
    }
  }'
```

**Ou use o script Python:**

```bash
python3 scripts/enviar-sticker.py 5511999999999 ./meu-sticker.png
```

## 📚 Documentação

### Documentação Oficial

- 🌐 **Evolution API v2:** https://doc.evolution-api.com/v2/pt
- 🌐 **Evolution API v1:** https://doc.evolution-api.com/v1/pt
- 🐙 **GitHub Oficial:** https://github.com/EvolutionAPI/evolution-api
- 📮 **Postman Collection:** https://www.postman.com/agenciadgcode/evolution-api

### Documentação do Projeto

- 📖 [Guia de Configuração](docs/CONFIGURACAO.md) - Setup detalhado
- 📖 [Documentação de Endpoints](docs/ENDPOINTS.md) - Todos os endpoints disponíveis
- 📖 [Guia de Stickers](docs/STICKERS.md) - Como trabalhar com stickers
- 📖 [Troubleshooting](docs/TROUBLESHOOTING.md) - Solução de problemas comuns

### Endpoints Principais

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `POST` | `/instance/create` | Criar nova instância |
| `GET` | `/instance/connect/{instance}` | Obter QR Code |
| `GET` | `/instance/connectionState/{instance}` | Verificar status |
| `POST` | `/message/sendText/{instance}` | Enviar texto |
| `POST` | `/message/sendMedia/{instance}` | Enviar mídia |
| `POST` | `/message/sendSticker/{instance}` | Enviar sticker |
| `GET` | `/instance/fetchInstances` | Listar instâncias |
| `DELETE` | `/instance/delete/{instance}` | Deletar instância |

**Documentação Interativa (Swagger):**
- http://localhost:8080/manager

## 🔧 Scripts Disponíveis

### `test-api.sh`
Testa todos os endpoints principais da API

```bash
./scripts/test-api.sh
```

### `enviar-sticker.py`
Envia stickers via Python

```bash
# Via URL
python3 scripts/enviar-sticker.py 5511999999999 https://exemplo.com/sticker.png

# Via arquivo local
python3 scripts/enviar-sticker.py 5511999999999 ./imagem.png
```

### `exemplo-sticker.sh`
Mostra exemplos de uso de stickers

```bash
./scripts/exemplo-sticker.sh
```

## 🛑 Comandos Docker Úteis

```bash
# Parar todos os serviços
docker compose down

# Parar e remover volumes (ATENÇÃO: apaga dados)
docker compose down -v

# Reiniciar apenas a API
docker compose restart evolution-api

# Ver logs de um serviço específico
docker compose logs -f evolution-api

# Ver status dos containers
docker compose ps

# Atualizar imagens
docker compose pull
docker compose up -d
```

## ❓ Troubleshooting

### QR Code não aparece

✅ **Solução:** Atualizado para v2.2.3 com WebSocket habilitado

### Porta 3000 ou 8080 em uso

```bash
# Editar docker-compose.yml e mudar a porta
ports:
  - "8081:8080"  # Mude 8080 para outra porta
```

### Containers não iniciam

```bash
# Ver logs detalhados
docker compose logs

# Resetar tudo
docker compose down -v
docker compose up -d
```

### Mais soluções

Consulte [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)

## 📊 Status do Projeto

### ✅ Implementado

- [x] Setup completo com Docker Compose
- [x] PostgreSQL configurado
- [x] Redis configurado
- [x] Evolution API v2.2.3
- [x] WebSocket habilitado
- [x] Evolution Manager funcionando
- [x] QR Code gerando corretamente
- [x] Documentação completa
- [x] Scripts Python para stickers
- [x] Exemplos de uso

### 🚧 Próximos Passos

- [ ] Implementar webhooks
- [ ] Adicionar exemplos em JavaScript/Node.js
- [ ] Criar sistema de envio em massa
- [ ] Adicionar testes automatizados
- [ ] Implementar autenticação adicional

## 🔐 Segurança

⚠️ **IMPORTANTE:**

1. **Nunca** compartilhe sua `AUTHENTICATION_API_KEY`
2. **Nunca** commite o arquivo `.env` no Git
3. Use HTTPS em produção (configure um proxy reverso como Nginx)
4. Considere limitar as origens CORS
5. Mantenha as imagens Docker atualizadas

## 🤝 Contribuindo

Este é um projeto pessoal, mas sugestões são bem-vindas!

## 📝 Licença

Este projeto usa a Evolution API que é open-source. Verifique a licença oficial em:
https://github.com/EvolutionAPI/evolution-api

## 🆘 Suporte

- 📚 Documentação oficial: https://doc.evolution-api.com
- 🐙 GitHub Issues: https://github.com/EvolutionAPI/evolution-api/issues
- 💬 Discord Evolution: https://evolution-api.com/discord

---

**Desenvolvido com Evolution API** 🚀

Última atualização: 26/12/2025
