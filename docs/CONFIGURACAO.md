# Evolution API - Guia de Instalação e Uso

## O que foi configurado?

Este setup inclui:
- **Evolution API** - API REST para WhatsApp
- **PostgreSQL** - Banco de dados para persistência
- **Redis** - Cache para melhor performance
- **Evolution Manager** - Interface web de gerenciamento (opcional)

## Requisitos

- Docker instalado
- Docker Compose instalado
- Portas disponíveis: 8080, 3000, 5432, 6379

## Passo a Passo para Iniciar

### 1. IMPORTANTE: Alterar a Chave de API

Abra o arquivo `.env` e mude a linha:
```
AUTHENTICATION_API_KEY=mude-me-para-uma-senha-forte
```

Coloque uma senha forte de sua escolha. Esta senha será usada para autenticar requisições à API.

### 2. Iniciar os Serviços

No terminal, dentro da pasta `/Users/paulohenrique/sticker`, execute:

```bash
docker compose up -d
```

Isso vai:
- Baixar as imagens Docker necessárias
- Criar e iniciar todos os containers
- Configurar a rede entre os serviços

### 3. Verificar se está rodando

Aguarde cerca de 30 segundos e acesse:

- **API**: http://localhost:8080
- **Manager (Interface Web)**: http://localhost:3001

### 4. Testar a API

Você pode testar se a API está funcionando com:

```bash
curl http://localhost:8080/
```

## Como Usar a Evolution API

### Criar uma Instância do WhatsApp

```bash
curl -X POST http://localhost:8080/instance/create \
  -H "apikey: SUA_SENHA_DO_ENV" \
  -H "Content-Type: application/json" \
  -d '{
    "instanceName": "meu-whatsapp",
    "token": "token-opcional",
    "qrcode": true
  }'
```

### Conectar ao WhatsApp (Obter QR Code)

```bash
curl http://localhost:8080/instance/connect/meu-whatsapp \
  -H "apikey: SUA_SENHA_DO_ENV"
```

A resposta incluirá um QR Code em base64 que você deve escanear com o WhatsApp.

### Usando o Evolution Manager (Interface Web)

1. Acesse http://localhost:3001
2. Configure a URL da API: http://localhost:8080
3. Informe sua API Key
4. Use a interface para gerenciar instâncias, enviar mensagens, etc.

## Comandos Úteis

### Ver logs em tempo real
```bash
docker compose logs -f evolution-api
```

### Parar os serviços
```bash
docker compose down
```

### Parar e remover todos os dados
```bash
docker compose down -v
```

### Reiniciar apenas a API
```bash
docker compose restart evolution-api
```

### Ver status dos containers
```bash
docker compose ps
```

## Endpoints Principais da API

- **POST** `/instance/create` - Criar nova instância
- **GET** `/instance/connect/{instanceName}` - Obter QR Code
- **GET** `/instance/connectionState/{instanceName}` - Verificar status
- **POST** `/message/sendText/{instanceName}` - Enviar mensagem texto
- **POST** `/message/sendMedia/{instanceName}` - Enviar mídia
- **GET** `/instance/fetchInstances` - Listar todas as instâncias
- **DELETE** `/instance/delete/{instanceName}` - Deletar instância

## Documentação Completa

- Documentação Oficial: https://doc.evolution-api.com/v2/pt
- GitHub: https://github.com/EvolutionAPI/evolution-api
- Postman Collection: Disponível no repositório oficial

## Estrutura de Dados

Todos os dados são persistidos em:
- **Banco de dados**: PostgreSQL (conversas, contatos, mensagens)
- **Cache**: Redis (sessões ativas)
- **Arquivos**: Volume Docker `evolution_instances` (dados das instâncias)

## Solução de Problemas

### Porta já em uso
Se alguma porta estiver ocupada, edite o `docker-compose.yml` e mude a porta externa:
```yaml
ports:
  - "8081:8080"  # Mude 8080 para outra porta
```

### Containers não iniciam
```bash
docker compose logs
```

### Resetar tudo
```bash
docker compose down -v
docker compose up -d
```

## Segurança

- **Nunca** compartilhe sua `AUTHENTICATION_API_KEY`
- Use HTTPS em produção (configure um proxy reverso como Nginx)
- Considere limitar as origens CORS no arquivo `.env`
- Mantenha as imagens Docker atualizadas

## Próximos Passos

1. Explore a documentação oficial
2. Teste enviar mensagens via API
3. Configure webhooks se precisar receber eventos
4. Integre com seu sistema/aplicação

---

Pronto para usar! Se tiver dúvidas, consulte a documentação oficial.
