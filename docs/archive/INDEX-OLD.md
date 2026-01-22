# 📑 Índice do Projeto - Evolution API

> Guia rápido para navegar na documentação e recursos

## 🚀 Comece Aqui

| Arquivo | Descrição |
|---------|-----------|
| **[QUICKSTART.md](QUICKSTART.md)** | ⚡ Guia de início rápido (5 minutos) |
| **[README.md](README.md)** | 📚 Documentação completa do projeto |

---

## 📖 Documentação

### Guias Principais

| Arquivo | O que você vai encontrar |
|---------|--------------------------|
| **[docs/CONFIGURACAO.md](docs/CONFIGURACAO.md)** | ⚙️ Setup detalhado do Docker, .env e serviços |
| **[docs/ENDPOINTS.md](docs/ENDPOINTS.md)** | 📡 Todos os endpoints da API com exemplos |
| **[docs/STICKERS.md](docs/STICKERS.md)** | 🎨 Como enviar figurinhas (stickers) |
| **[docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)** | 🔧 Solução de problemas comuns |

### O que cada guia contém

#### 📡 ENDPOINTS.md
- ✅ Criar e gerenciar instâncias
- ✅ Conectar WhatsApp (QR Code)
- ✅ Enviar mensagens de texto
- ✅ Enviar imagens, vídeos e áudios
- ✅ Enviar stickers
- ✅ Enviar localização e contatos
- ✅ Gerenciar grupos
- ✅ Configurar webhooks
- ✅ Exemplos práticos em cURL

#### 🎨 STICKERS.md
- ✅ Formatos suportados (PNG, WebP, JPEG)
- ✅ Especificações técnicas (tamanho, dimensões)
- ✅ Envio via URL e Base64
- ✅ Scripts Python prontos
- ✅ Como converter imagens
- ✅ Stickers animados

#### 🔧 TROUBLESHOOTING.md
- ✅ QR Code não gera (RESOLVIDO ✓)
- ✅ Problemas de conexão
- ✅ Erros do Docker
- ✅ Portas em uso
- ✅ Mensagens não enviadas
- ✅ Comandos de diagnóstico

---

## 🛠 Scripts e Ferramentas

### Scripts Python

| Script | Função |
|--------|--------|
| **[scripts/enviar-sticker.py](scripts/enviar-sticker.py)** | 🎨 Enviar stickers via URL ou arquivo local |
| **[exemplos/python/enviar_mensagem.py](exemplos/python/enviar_mensagem.py)** | 💬 Exemplo de envio de mensagem |

**Como usar:**
```bash
# Sticker via URL
python3 scripts/enviar-sticker.py 5511999999999 https://exemplo.com/sticker.png

# Sticker via arquivo
python3 scripts/enviar-sticker.py 5511999999999 ./minha-imagem.png

# Mensagem de texto
python3 exemplos/python/enviar_mensagem.py
```

### Scripts Bash

| Script | Função |
|--------|--------|
| **[scripts/test-api.sh](scripts/test-api.sh)** | 🧪 Testa endpoints principais da API |
| **[scripts/exemplo-sticker.sh](scripts/exemplo-sticker.sh)** | 📋 Mostra exemplos de uso de stickers |
| **[exemplos/curl/exemplos.sh](exemplos/curl/exemplos.sh)** | 💡 Exemplos completos em cURL |

**Como usar:**
```bash
# Testar API
./scripts/test-api.sh

# Ver exemplos de stickers
./scripts/exemplo-sticker.sh

# Ver todos os exemplos cURL
./exemplos/curl/exemplos.sh
```

---

## 🔧 Arquivos de Configuração

| Arquivo | Descrição |
|---------|-----------|
| **[docker-compose.yml](docker-compose.yml)** | 🐳 Orquestração dos containers |
| **[.env](.env)** | 🔐 Variáveis de ambiente (API Key, Database, etc) |
| **[.gitignore](.gitignore)** | 🚫 Arquivos ignorados pelo Git |

---

## 🌐 Interfaces Web

| URL | Descrição | Credenciais |
|-----|-----------|-------------|
| http://localhost:8080 | 🔌 Evolution API | API Key no .env |
| http://localhost:8080/manager | 📊 Swagger UI (Docs interativa) | API Key no .env |
| http://localhost:3001 | 🎨 Evolution Manager (UI Web) | API Key no .env |
| [qrcode.html](qrcode.html) | 📱 Visualizador de QR Code | Abrir no navegador |

---

## 📁 Estrutura Completa do Projeto

```
sticker/
│
├── 📄 README.md                    # Documentação principal
├── ⚡ QUICKSTART.md               # Guia de início rápido
├── 📑 INDEX.md                     # Este arquivo (índice)
│
├── 🐳 docker-compose.yml           # Configuração Docker
├── 🔐 .env                         # Variáveis de ambiente
├── 🚫 .gitignore                   # Arquivos ignorados
├── 📱 qrcode.html                  # Visualizador de QR Code
│
├── 📚 docs/                        # Documentação detalhada
│   ├── CONFIGURACAO.md            # Setup e configuração
│   ├── ENDPOINTS.md               # Referência de endpoints
│   ├── STICKERS.md                # Guia de stickers
│   └── TROUBLESHOOTING.md         # Solução de problemas
│
├── 🔧 scripts/                     # Scripts utilitários
│   ├── enviar-sticker.py          # Enviar stickers (Python)
│   ├── exemplo-sticker.sh         # Exemplos de stickers (Bash)
│   └── test-api.sh                # Testar API (Bash)
│
└── 💡 exemplos/                    # Exemplos de código
    ├── python/
    │   └── enviar_mensagem.py     # Exemplo Python
    ├── javascript/                # (Futuro)
    └── curl/
        └── exemplos.sh            # Exemplos cURL
```

---

## 🎯 Fluxo de Trabalho Recomendado

### Para Iniciantes

1. 📖 Leia o [QUICKSTART.md](QUICKSTART.md)
2. 🚀 Inicie os serviços com `docker compose up -d`
3. 🌐 Acesse http://localhost:3001
4. 📱 Conecte seu WhatsApp
5. 💬 Envie sua primeira mensagem!

### Para Desenvolvedores

1. 📚 Leia o [README.md](README.md) completo
2. 📡 Estude os [ENDPOINTS.md](docs/ENDPOINTS.md)
3. 💻 Veja os exemplos em [exemplos/](exemplos/)
4. 🎨 Teste envio de stickers com [docs/STICKERS.md](docs/STICKERS.md)
5. 🔧 Se houver problemas, consulte [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)

---

## 🔑 Credenciais de Acesso

Todas as credenciais estão no arquivo `.env`:

```env
API_KEY=YOUR_EVOLUTION_API_KEY
API_URL=http://localhost:8080
```

⚠️ **IMPORTANTE:** Nunca commite o arquivo `.env` no Git!

---

## 🆘 Precisa de Ajuda?

| Problema | Solução |
|----------|---------|
| 🔴 QR Code não gera | [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md#problemas-com-qr-code) |
| 🔴 Porta em uso | [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md#problemas-de-porta) |
| 🔴 Mensagem não envia | [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md#problemas-com-mensagens) |
| 🔴 Container não inicia | [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md#problemas-com-docker) |
| ❓ Dúvida geral | [README.md](README.md) ou [Docs Oficiais](https://doc.evolution-api.com) |

---

## 📚 Recursos Externos

- 🌐 **Documentação Oficial:** https://doc.evolution-api.com/v2/pt
- 🐙 **GitHub:** https://github.com/EvolutionAPI/evolution-api
- 📮 **Postman Collection:** https://www.postman.com/agenciadgcode/evolution-api
- 💬 **Discord:** https://evolution-api.com/discord

---

## ✅ Checklist de Setup

- [ ] Docker instalado e rodando
- [ ] Portas 8080, 3001, 5432, 6379 disponíveis
- [ ] Arquivo `.env` configurado
- [ ] `docker compose up -d` executado
- [ ] Todos os containers "Up" (verificar com `docker compose ps`)
- [ ] API respondendo em http://localhost:8080
- [ ] Manager acessível em http://localhost:3001
- [ ] Instância criada e WhatsApp conectado
- [ ] Primeira mensagem enviada com sucesso! 🎉

---

**Versão do Projeto:** 1.0.0
**Última Atualização:** 26/12/2025
**Evolution API:** v2.2.3
