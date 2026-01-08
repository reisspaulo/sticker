# 🗺️ StickerBot - Fluxos Visuais

Diagramas interativos do funcionamento do bot.

---

## 1. Fluxo Principal do Usuário

```mermaid
flowchart TD
    START([Usuário envia mensagem]) --> TIPO{Tipo de<br/>mensagem?}

    TIPO -->|Imagem/GIF/Vídeo| CHECK_LIMIT{Limite<br/>disponível?}
    TIPO -->|Texto| CMD{Qual<br/>comando?}
    TIPO -->|Link Twitter| TW_LIMIT{Limite<br/>Twitter ok?}
    TIPO -->|Clique em botão| BTN{Qual<br/>botão?}

    %% Fluxo de Sticker
    CHECK_LIMIT -->|Sim| PROCESS[⚙️ Processa sticker]
    CHECK_LIMIT -->|Não| LIMIT_MSG[⚠️ Limite atingido<br/>+ botões upgrade]
    PROCESS --> SEND_STICKER[📤 Envia sticker<br/>silenciosamente]
    SEND_STICKER --> EDIT_BTNS[🎨 Botões de edição<br/>após 10s]
    EDIT_BTNS --> END_OK([✅ Fim])

    %% Fluxo de Comandos
    CMD -->|planos| PLANS_LIST[📋 Lista de planos]
    CMD -->|ajuda| HELP[❓ Mensagem ajuda]
    CMD -->|status| STATUS[📊 Status assinatura]
    CMD -->|outro| WELCOME[👋 Boas-vindas]
    PLANS_LIST --> END_OK
    HELP --> END_OK
    STATUS --> END_OK
    WELCOME --> END_OK

    %% Fluxo Twitter
    TW_LIMIT -->|Sim| TW_DOWNLOAD[📥 Baixa vídeo]
    TW_LIMIT -->|Não| TW_LIMIT_MSG[⚠️ Limite Twitter]
    TW_DOWNLOAD --> TW_SEND[📤 Envia vídeo]
    TW_SEND --> TW_BTNS[🔄 Converter em sticker?]
    TW_BTNS --> END_OK
    TW_LIMIT_MSG --> END_OK

    %% Fluxo de Botões - Upgrade
    BTN -->|upgrade_premium<br/>upgrade_ultra| PAY_METHOD[💳 Métodos pagamento]
    PAY_METHOD --> END_OK

    %% Fluxo de Botões - Pagamento
    BTN -->|payment_pix| PIX_FLOW[🔑 Fluxo PIX]
    BTN -->|payment_card<br/>payment_boleto| STRIPE[🔗 Link Stripe]
    PIX_FLOW --> END_OK
    STRIPE --> END_OK

    %% Fluxo de Botões - Confirmação
    BTN -->|confirm_pix| ACTIVATE[⏳ Ativa em 5min]
    ACTIVATE --> ACTIVATED[🎉 Plano ativado!]
    ACTIVATED --> END_OK

    %% Fluxo de Botões - Edição
    BTN -->|remove_borders| CLEANUP_B[🧹 Remove bordas]
    BTN -->|remove_background| CLEANUP_A[✨ Remove fundo IA]
    BTN -->|sticker_perfect| CONFIRM[👍 Confirmado]
    CLEANUP_B --> END_OK
    CLEANUP_A --> END_OK
    CONFIRM --> END_OK

    %% Fluxo de Botões - Twitter
    BTN -->|convert_sticker| CONVERT[🎨 Converte em sticker]
    CONVERT --> END_OK

    %% Fluxo de Botões - Bônus
    BTN -->|use_bonus| BONUS[🎁 +2 créditos]
    BONUS --> END_OK

    %% Limite
    LIMIT_MSG --> END_OK

    %% Estilos
    style START fill:#e1f5fe
    style END_OK fill:#c8e6c9
    style PROCESS fill:#fff3e0
    style SEND_STICKER fill:#c8e6c9
    style LIMIT_MSG fill:#ffcdd2
    style TW_LIMIT_MSG fill:#ffcdd2
    style ACTIVATED fill:#c8e6c9
```

---

## 2. Fluxo de Assinatura Completo

```mermaid
sequenceDiagram
    autonumber
    participant U as 👤 Usuário
    participant W as 📱 WhatsApp
    participant B as ⚙️ Backend
    participant R as 🔴 Redis
    participant DB as 🗄️ Supabase

    Note over U,DB: 🎯 FLUXO: Usuário quer assinar Premium

    U->>W: Digite "planos"
    W->>B: Webhook (texto: planos)
    B->>W: 📋 Lista interativa
    Note right of W: 🆓 Gratuito<br/>💰 Premium R$5<br/>🚀 Ultra R$9,90

    U->>W: Clica "💰 Premium"
    W->>B: Webhook (plan_premium)
    B->>R: Salva: selected_plan = premium
    B->>W: 💳 Lista de pagamento
    Note right of W: 💳 Cartão<br/>🧾 Boleto<br/>🔑 PIX

    rect rgb(240, 248, 255)
        Note over U,DB: 🔑 OPÇÃO PIX
        U->>W: Clica "PIX"
        W->>B: Webhook (payment_pix)
        B->>DB: Cria pix_payment (pending)
        B->>W: 📝 Msg 1: Instruções
        B->>W: 🔑 Msg 2: Chave PIX + botão copiar
        B->>W: ✅ Msg 3: Botão "Já Paguei"

        Note over U: Usuário faz PIX no banco

        U->>W: Clica "✅ Já Paguei"
        W->>B: Webhook (confirm_pix)
        B->>R: Busca plano selecionado
        B->>W: ⏳ "Processando... aguarde 5min"
        B->>B: Cria job delayed (5 min)

        Note over B: ⏰ Após 5 minutos...

        B->>DB: Atualiza: plan = premium
        B->>W: 🎉 "Plano Premium ativado!"
    end

    rect rgb(255, 248, 240)
        Note over U,DB: 💳 OPÇÃO CARTÃO (alternativa)
        U->>W: Clica "Cartão"
        W->>B: Webhook (payment_card)
        B->>W: 🔗 Link Stripe + metadata

        Note over U: Usuário paga no Stripe

        B->>B: Recebe webhook Stripe
        B->>DB: Atualiza: plan = premium
        B->>W: 🎉 "Plano Premium ativado!"
    end
```

---

## 3. Fluxo de Criação de Sticker

```mermaid
sequenceDiagram
    autonumber
    participant U as 👤 Usuário
    participant W as 📱 WhatsApp
    participant B as ⚙️ Backend
    participant Q as 📋 BullMQ
    participant WK as 👷 Worker
    participant S as 🗄️ Storage

    Note over U,S: 🎨 FLUXO: Criar figurinha de imagem

    U->>W: 📷 Envia imagem
    W->>B: Webhook (imageMessage)

    B->>B: Verifica limite diário

    alt Limite OK
        B->>B: Incrementa daily_count (atômico)
        B->>Q: Adiciona job: process-sticker
        B->>W: (nada - silencioso)

        Q->>WK: Processa job
        WK->>W: 📥 Baixa imagem (Evolution API)
        WK->>WK: 🔄 Redimensiona 512x512
        WK->>WK: 🎨 Converte para WebP
        WK->>S: 📤 Upload sticker
        WK->>W: 📤 Envia sticker

        Note over WK: ⏰ Aguarda 10s (debounce)

        WK->>Q: Adiciona job: edit-buttons
        Q->>WK: Processa job
        WK->>W: 🎨 Botões de edição
        Note right of W: 🧹 Remover Bordas<br/>✨ Remover Fundo<br/>✅ Está perfeita!

    else Limite Atingido
        B->>Q: Adiciona job: process-sticker (status: pendente)
        B->>W: ⚠️ Limite + botões upgrade
        Note right of W: 🎁 Usar Bônus<br/>💰 Premium<br/>🚀 Ultra

        Note over WK: Sticker processado mas não enviado
        Note over WK: Será enviado às 8h do dia seguinte
    end
```

---

## 4. Fluxo de Download Twitter

```mermaid
sequenceDiagram
    autonumber
    participant U as 👤 Usuário
    participant W as 📱 WhatsApp
    participant B as ⚙️ Backend
    participant WK as 👷 Worker
    participant TW as 🐦 VxTwitter API
    participant S as 🗄️ Storage

    Note over U,S: 🐦 FLUXO: Baixar vídeo do Twitter

    U->>W: 🔗 Envia link twitter.com/...
    W->>B: Webhook (texto com URL)

    B->>B: Detecta URL Twitter
    B->>B: Verifica limite Twitter

    alt Limite OK
        B->>B: Incrementa twitter_count
        B->>W: (processando silenciosamente)

        WK->>TW: 📥 Busca metadados
        TW-->>WK: Retorna info do vídeo

        alt É um GIF
            WK->>WK: 🎨 Converte direto para sticker
            WK->>W: 📤 Envia sticker animado
        else É vídeo normal
            WK->>TW: 📥 Baixa vídeo
            WK->>S: 📤 Upload para Storage
            WK->>W: 📤 Envia vídeo
            WK->>W: 🔄 Botões conversão
            Note right of W: ✅ Sim, quero sticker!<br/>⏭️ Só o vídeo

            alt Usuário quer sticker
                U->>W: Clica "✅ Sim, quero!"
                W->>B: Webhook (convert_sticker)
                B->>B: Verifica limite sticker
                WK->>WK: 🎨 Converte vídeo → sticker
                WK->>W: 📤 Envia sticker animado
            end
        end

    else Limite Atingido
        B->>W: ⚠️ Limite Twitter atingido
    end
```

---

## 5. Fluxo de Edição de Sticker

```mermaid
sequenceDiagram
    autonumber
    participant U as 👤 Usuário
    participant W as 📱 WhatsApp
    participant B as ⚙️ Backend
    participant R as 🔴 Redis
    participant WK as 👷 Worker

    Note over U,WK: ✨ FLUXO: Editar sticker (remover fundo)

    Note over W: Usuário recebeu sticker + botões

    U->>W: Clica "✨ Remover Fundo"
    W->>B: Webhook (button_remove_background)

    B->>R: Busca contexto (sticker_url, message_key)
    R-->>B: Retorna dados salvos

    alt Contexto válido (< 10 min)
        B->>W: ✨ "Removendo fundo..."
        B->>WK: Job: cleanup-sticker (PATH A)

        WK->>W: 📥 Baixa imagem ORIGINAL
        WK->>WK: 🤖 Executa rembg (IA)
        Note right of WK: Modelo U²-Net<br/>~10-30 segundos
        WK->>WK: 🎨 Converte para WebP
        WK->>W: 📤 Envia sticker sem fundo

        Note over U: ✅ Não conta no limite!

    else Contexto expirado
        B->>W: ❌ "Contexto expirado"
        B->>W: "Envie nova imagem"
    end
```

---

## 6. Estados do Usuário

```mermaid
stateDiagram-v2
    [*] --> Novo: Primeira mensagem

    Novo --> Ativo: Qualquer interação

    state Ativo {
        [*] --> Livre

        Livre --> Processando: Envia mídia
        Processando --> Livre: Sticker enviado

        Livre --> BaixandoTwitter: Link Twitter
        BaixandoTwitter --> Livre: Vídeo enviado
    }

    state "Limite Atingido" as Limite
    Ativo --> Limite: daily_count >= limit

    Limite --> Ativo: 🎁 Usa bônus (+2)
    Limite --> Upgrade: Clica upgrade
    Limite --> Ativo: ⏰ Meia-noite (reset)

    state Upgrade {
        [*] --> EscolhePlano
        EscolhePlano --> EscolhePagamento
        EscolhePagamento --> AguardaPIX
        EscolhePagamento --> AguardaStripe
        AguardaPIX --> Confirmado
        AguardaStripe --> Confirmado
    }

    Upgrade --> Premium: 💰 Pagou Premium
    Upgrade --> Ultra: 🚀 Pagou Ultra

    state "Plano Premium" as Premium
    state "Plano Ultra" as Ultra

    Premium --> Ativo
    Ultra --> Ativo
```

---

## 7. Mapa de Mensagens

```mermaid
flowchart TB
    subgraph welcome["🎉 BOAS-VINDAS"]
        W1["🎉 Olá {nome}!<br/><br/>Envie uma imagem, vídeo ou GIF<br/>que eu transformo em figurinha! 🎨"]
    end

    subgraph sticker["🎨 STICKER CRIADO"]
        S1["(sticker enviado silenciosamente)"]
        S2["🎨 Gostou da figurinha?<br/><br/>🧹 Remover Bordas<br/>✨ Remover Fundo<br/>✅ Está perfeita!"]
    end

    subgraph limit["⚠️ LIMITE ATINGIDO"]
        L1["⚠️ Limite Atingido!<br/><br/>Você usou 4/4 figurinhas hoje.<br/>Renova às 00:00<br/><br/>🎁 Usar Bônus (+2)<br/>💰 Premium R$5<br/>🚀 Ultra R$9,90"]
    end

    subgraph plans["💎 PLANOS"]
        P1["💎 ESCOLHA SEU PLANO<br/><br/>🆓 Gratuito - 4/dia<br/>💰 Premium R$5 - 20/dia<br/>🚀 Ultra R$9,90 - ∞"]
        P2["💰 PAGAMENTO PREMIUM<br/><br/>💳 Cartão de Crédito<br/>🧾 Boleto Bancário<br/>🔑 PIX"]
    end

    subgraph pix["🔑 PIX"]
        PX1["💰 Pagamento via PIX<br/><br/>Plano: Premium<br/>Valor: R$ 5,00<br/><br/>1️⃣ Copie a chave<br/>2️⃣ Abra seu banco<br/>3️⃣ Pague R$ 5,00<br/>4️⃣ Clique 'Já Paguei'"]
        PX2["🔑 a1b2c3d4-e5f6-...<br/>(botão copiar)"]
        PX3["✅ Pagou?<br/><br/>✅ Já Paguei"]
        PX4["⏳ Processando...<br/>Aguarde 5 minutos"]
        PX5["🎉 PAGAMENTO CONFIRMADO!<br/><br/>Plano Premium ativado!<br/><br/>✅ 20 figurinhas/dia<br/>✅ 15 vídeos Twitter/dia"]
    end

    subgraph twitter["🐦 TWITTER"]
        T1["(vídeo enviado silenciosamente)"]
        T2["🎨 Quer transformar em figurinha?<br/><br/>✅ Sim, quero!<br/>⏭️ Só o vídeo"]
    end

    welcome --> sticker
    sticker --> limit
    limit --> plans
    plans --> pix
    welcome --> twitter
```

---

## 8. Arquitetura de Filas

```mermaid
flowchart LR
    subgraph entrada["📥 ENTRADA"]
        WH[Webhook<br/>Evolution API]
    end

    subgraph filas["📋 FILAS BULLMQ"]
        Q1[process-sticker<br/>concurrency: 5]
        Q2[download-twitter-video<br/>concurrency: 3]
        Q3[convert-twitter-sticker<br/>concurrency: 2]
        Q4[cleanup-sticker<br/>concurrency: 2]
        Q5[edit-buttons<br/>concurrency: 5<br/>debounce: 10s]
        Q6[activate-pix-subscription<br/>concurrency: 2<br/>delay: 5min]
        Q7[scheduled-jobs<br/>concurrency: 1]
    end

    subgraph saida["📤 SAÍDA"]
        EV[Evolution API<br/>sendSticker/sendVideo/sendText]
        AV[Avisa API<br/>sendList/sendButtons/sendPix]
    end

    WH --> Q1
    WH --> Q2
    WH --> Q6

    Q1 --> Q5
    Q2 --> Q3
    Q5 --> Q4

    Q1 --> EV
    Q2 --> EV
    Q3 --> EV
    Q4 --> EV
    Q5 --> AV
    Q6 --> EV
    Q7 --> EV

    style Q1 fill:#e3f2fd
    style Q2 fill:#fff3e0
    style Q3 fill:#fff3e0
    style Q4 fill:#f3e5f5
    style Q5 fill:#e8f5e9
    style Q6 fill:#fce4ec
    style Q7 fill:#efebe9
```

---

**Última atualização:** 08/01/2026
