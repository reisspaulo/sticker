# Sprint 16: Sistema de Treinamento de Celebridades

## PRD - Product Requirements Document

**Data:** 2026-01-12
**Status:** Concluído (Fases 1-6)
**Prioridade:** Alta

---

## 1. Visão Geral

### 1.1 Problema Atual

O processo de adicionar novas celebridades ao sistema de reconhecimento facial é **100% manual**:

```
Fluxo Atual (Manual):
1. Criar pasta local: celebridades/<nome>/
2. Baixar 3-5 fotos do Google
3. Executar: ./scripts/add-celebrity.sh <nome>
4. Script faz SSH para VPS
5. Upload das fotos
6. Gera embeddings faciais
7. Atualiza arquivo .pkl
```

**Problemas:**
- Requer acesso ao terminal e conhecimento técnico
- Não tem interface visual
- Não há histórico das fotos usadas
- Não é possível retreinar facilmente
- Difícil de escalar

### 1.2 Solução Proposta

Criar interface no Admin Panel para:
- Upload de fotos de referência
- Criação automática de celebridade + pack
- Treinamento automático via VPS
- Visualização do status de treinamento
- Reprocessamento de stickers existentes

---

## 2. User Stories

### US1: Admin faz upload de fotos
> Como admin, quero fazer upload de fotos de uma celebridade pelo navegador, para não precisar usar terminal.

### US2: Admin cria celebridade com fotos
> Como admin, quero criar uma nova celebridade e já subir as fotos de referência em um único fluxo.

### US3: Admin treina reconhecimento
> Como admin, quero clicar em "Treinar" e o sistema processar automaticamente as fotos para gerar embeddings.

### US4: Admin vê status do treinamento
> Como admin, quero ver se uma celebridade está treinada, pendente ou com erro.

### US5: Admin retreina celebridade
> Como admin, quero poder adicionar mais fotos e retreinar uma celebridade existente.

### US6: Sistema reprocessa stickers
> Como admin, quero que após treinar uma nova celebridade, os stickers existentes sejam reprocessados.

---

## 3. Arquitetura

### 3.1 Diagrama de Fluxo

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              ADMIN PANEL                                     │
│  /stickers/celebrities                                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │  CRIAR/EDITAR CELEBRIDADE                                            │  │
│   │                                                                       │  │
│   │  Nome: [____________________]                                         │  │
│   │  Slug: [____________________] (auto-gerado)                          │  │
│   │                                                                       │  │
│   │  Fotos de Referência (3-5 recomendado):                              │  │
│   │  ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐                  │  │
│   │  │  [+]  │ │ foto1 │ │ foto2 │ │ foto3 │ │ foto4 │                  │  │
│   │  │  Add  │ │  [x]  │ │  [x]  │ │  [x]  │ │  [x]  │                  │  │
│   │  └───────┘ └───────┘ └───────┘ └───────┘ └───────┘                  │  │
│   │                                                                       │  │
│   │  [ ] Criar pack automaticamente                                       │  │
│   │  [ ] Reprocessar stickers existentes após treinar                    │  │
│   │                                                                       │  │
│   │  [Cancelar]                    [Salvar e Treinar]                    │  │
│   └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │  LISTA DE CELEBRIDADES                                               │  │
│   │                                                                       │  │
│   │  Nome             │ Fotos │ Status      │ Stickers │ Ações           │  │
│   │  ─────────────────┼───────┼─────────────┼──────────┼───────────────  │  │
│   │  Gretchen         │ 8     │ ✅ Treinada │ 42       │ [Editar] [Ver]  │  │
│   │  Patixa           │ 7     │ ✅ Treinada │ 24       │ [Editar] [Ver]  │  │
│   │  Malévola Alves   │ 7     │ ✅ Treinada │ 26       │ [Editar] [Ver]  │  │
│   │  Larissa Manoela  │ 0     │ ⏳ Pendente │ 0        │ [Treinar]       │  │
│   │  Rafa Justus      │ 0     │ ⏳ Pendente │ 0        │ [Treinar]       │  │
│   └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Fluxo de Dados

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Admin     │     │   Admin     │     │  Supabase   │     │    VPS      │
│   Panel     │     │   API       │     │  Storage    │     │  Training   │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │                   │
       │ 1. Upload fotos   │                   │                   │
       ├──────────────────►│                   │                   │
       │                   │ 2. Salva fotos    │                   │
       │                   ├──────────────────►│                   │
       │                   │                   │                   │
       │                   │ 3. Cria celebrity │                   │
       │                   ├──────────────────►│                   │
       │                   │                   │                   │
       │ 4. Clica Treinar  │                   │                   │
       ├──────────────────►│                   │                   │
       │                   │ 5. Webhook train  │                   │
       │                   ├───────────────────┼──────────────────►│
       │                   │                   │                   │
       │                   │                   │ 6. Baixa fotos    │
       │                   │                   │◄──────────────────┤
       │                   │                   │                   │
       │                   │                   │ 7. Gera embeddings│
       │                   │                   │                   │
       │                   │ 8. Atualiza status│                   │
       │                   │◄──────────────────┼───────────────────┤
       │                   │                   │                   │
       │ 9. Mostra sucesso │                   │                   │
       │◄──────────────────┤                   │                   │
       │                   │                   │                   │
```

### 3.3 Componentes

| Componente | Localização | Responsabilidade |
|------------|-------------|------------------|
| UI Upload | Admin Panel | Interface de upload de fotos |
| Supabase Storage | Cloud | Armazenar fotos de referência |
| Tabela `celebrity_photos` | Supabase | Metadados das fotos |
| Campo `training_status` | Supabase | Status do treinamento |
| Training API | VPS | Endpoint HTTP para treinar |
| Training Worker | VPS | Script Python que gera embeddings |

---

## 4. Schema do Banco de Dados

### 4.1 Nova Tabela: `celebrity_photos`

```sql
CREATE TABLE celebrity_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  celebrity_id UUID NOT NULL REFERENCES celebrities(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT unique_photo_per_celebrity UNIQUE (celebrity_id, storage_path)
);

-- Index para busca por celebridade
CREATE INDEX idx_celebrity_photos_celebrity ON celebrity_photos(celebrity_id);

-- RLS
ALTER TABLE celebrity_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON celebrity_photos
  FOR ALL TO service_role USING (true) WITH CHECK (true);
```

### 4.2 Alteração: `celebrities`

```sql
-- Adicionar campo de status de treinamento
ALTER TABLE celebrities
ADD COLUMN training_status TEXT DEFAULT 'pending'
CHECK (training_status IN ('pending', 'training', 'trained', 'failed'));

-- Adicionar campo de última tentativa de treinamento
ALTER TABLE celebrities
ADD COLUMN last_trained_at TIMESTAMPTZ;

-- Adicionar campo de erro (se falhou)
ALTER TABLE celebrities
ADD COLUMN training_error TEXT;
```

### 4.3 Novo Bucket: `celebrity-training`

```sql
-- Via Supabase Dashboard ou API
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'celebrity-training',
  'celebrity-training',
  false,  -- privado (só service role acessa)
  5242880,  -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
);
```

---

## 5. API Endpoints

### 5.1 Admin Panel (Next.js API Routes)

#### POST `/api/celebrities`
Criar nova celebridade
```typescript
Request:
{
  name: string
  slug?: string  // auto-gerado se não fornecido
  createPack?: boolean
}

Response:
{
  id: string
  name: string
  slug: string
  pack_id?: string
}
```

#### POST `/api/celebrities/[id]/photos`
Upload de foto de referência
```typescript
Request: FormData com arquivo

Response:
{
  id: string
  storage_path: string
  file_name: string
}
```

#### DELETE `/api/celebrities/[id]/photos/[photoId]`
Remover foto de referência

#### POST `/api/celebrities/[id]/train`
Iniciar treinamento
```typescript
Request: {}

Response:
{
  status: 'training'
  message: 'Treinamento iniciado'
}
```

### 5.2 VPS Training API

#### POST `/train`
Endpoint na VPS para receber requisição de treinamento

```typescript
Request:
{
  celebrity_slug: string
  photos: [
    { url: string, filename: string }
  ]
  callback_url: string  // para notificar quando terminar
}

Response:
{
  status: 'started'
  job_id: string
}
```

#### POST `/callback` (Supabase Edge Function ou webhook)
Recebe resultado do treinamento
```typescript
Request:
{
  celebrity_slug: string
  status: 'success' | 'failed'
  embeddings_count: number
  error?: string
}
```

---

## 6. Fases de Implementação

### Fase 1: Infraestrutura (Banco + Storage)
**Duração estimada:** 30 min
**Prioridade:** P0

- [ ] Criar migration para `celebrity_photos`
- [ ] Adicionar campos em `celebrities` (training_status, last_trained_at, training_error)
- [ ] Criar bucket `celebrity-training` no Supabase Storage
- [ ] Configurar políticas de acesso

**Arquivos:**
- Migration SQL no Supabase

---

### Fase 2: UI de Upload no Admin Panel
**Duração estimada:** 2-3h
**Prioridade:** P0

- [ ] Refatorar página `/stickers/celebrities`
- [ ] Adicionar componente de upload de fotos (drag & drop)
- [ ] Preview das fotos antes do upload
- [ ] Mostrar fotos existentes da celebridade
- [ ] Permitir remover fotos
- [ ] Mostrar status de treinamento na lista

**Arquivos:**
```
admin-panel/src/app/(dashboard)/stickers/celebrities/page.tsx
admin-panel/src/components/celebrities/PhotoUpload.tsx
admin-panel/src/components/celebrities/CelebrityForm.tsx
admin-panel/src/components/celebrities/TrainingStatus.tsx
```

**Dependências:**
- Fase 1 concluída

---

### Fase 3: API de Upload (Admin Panel)
**Duração estimada:** 1h
**Prioridade:** P0

- [ ] Criar API route para upload de fotos
- [ ] Integrar com Supabase Storage
- [ ] Salvar metadados em `celebrity_photos`
- [ ] Criar API route para deletar fotos

**Arquivos:**
```
admin-panel/src/app/api/celebrities/[id]/photos/route.ts
```

**Dependências:**
- Fase 1 concluída

---

### Fase 4: API de Treinamento na VPS
**Duração estimada:** 2h
**Prioridade:** P1

- [ ] Criar servidor HTTP simples na VPS (Flask/FastAPI)
- [ ] Endpoint POST `/train` que recebe celebrity_slug
- [ ] Script para baixar fotos do Supabase Storage
- [ ] Integrar com `face_classifier.py` existente
- [ ] Callback para Supabase quando terminar

**Arquivos VPS:**
```
/opt/face-recognition/api/
├── server.py          # FastAPI server
├── train_celebrity.py # Script de treinamento
└── requirements.txt
```

**Arquivos Supabase:**
```
supabase/functions/training-callback/index.ts  # Edge Function
```

**Dependências:**
- Fase 1 concluída

---

### Fase 5: Integração Completa
**Duração estimada:** 1h
**Prioridade:** P1

- [ ] Botão "Treinar" no Admin Panel chama VPS
- [ ] Polling ou WebSocket para atualizar status
- [ ] Tratamento de erros e retry
- [ ] Notificação de sucesso/falha

**Arquivos:**
```
admin-panel/src/app/api/celebrities/[id]/train/route.ts
admin-panel/src/hooks/useTrainingStatus.ts
```

**Dependências:**
- Fases 2, 3 e 4 concluídas

---

### Fase 6: Reprocessamento Automático
**Duração estimada:** 1h
**Prioridade:** P2

- [ ] Opção para reprocessar stickers após treinar
- [ ] Reset de `face_detected=null` para stickers com `celebrity_id=null`
- [ ] Trigger no banco ou botão manual

**Arquivos:**
```
admin-panel/src/app/api/celebrities/[id]/reprocess/route.ts
```

**Dependências:**
- Fase 5 concluída

---

### Fase 7: Melhorias de UX
**Duração estimada:** 1-2h
**Prioridade:** P3

- [ ] Validação de qualidade de foto (rosto detectável)
- [ ] Crop automático no rosto
- [ ] Estimativa de tempo de treinamento
- [ ] Histórico de treinamentos
- [ ] Comparação antes/depois

**Dependências:**
- Todas as fases anteriores

---

## 7. Schema Final

### 7.1 Tabela `celebrities` (atualizada)

```sql
CREATE TABLE celebrities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  embeddings_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  pack_id UUID REFERENCES sticker_packs(id),

  -- Novos campos
  training_status TEXT DEFAULT 'pending'
    CHECK (training_status IN ('pending', 'training', 'trained', 'failed')),
  last_trained_at TIMESTAMPTZ,
  training_error TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 7.2 Tabela `celebrity_photos` (nova)

```sql
CREATE TABLE celebrity_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  celebrity_id UUID NOT NULL REFERENCES celebrities(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 7.3 Storage Structure

```
celebrity-training/
├── gretchen/
│   ├── foto1.jpg
│   ├── foto2.jpg
│   └── foto3.png
├── patixa/
│   ├── foto1.jpg
│   └── foto2.jpg
└── larissa-manoela/
    ├── foto1.jpg
    ├── foto2.jpg
    └── foto3.jpg
```

---

## 8. Checklist de Entrega

### Fase 1 - Infraestrutura ✅
- [x] Migration executada
- [x] Bucket criado
- [x] RLS configurado

### Fase 2 - UI ✅
- [x] Upload funciona
- [x] Preview funciona
- [x] Delete funciona
- [x] Status aparece na lista

### Fase 3 - API Upload ✅
- [x] POST /photos funciona
- [x] DELETE /photos funciona
- [x] Arquivos salvos no Storage

### Fase 4 - VPS API ✅
- [x] Servidor rodando (FastAPI na porta 8765)
- [x] Endpoint /train funciona
- [x] Embeddings gerados corretamente
- [x] Status atualizado no banco de dados

### Fase 5 - Integração ✅
- [x] Fluxo completo funciona
- [x] Status atualiza em tempo real (polling)
- [x] Erros tratados

### Fase 6 - Reprocessamento ✅
- [x] API /reprocess funciona
- [x] Botão na UI para celebridades treinadas
- [x] Mostra contagem de stickers não reconhecidos

---

## 9. Riscos e Mitigações

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| VPS inacessível | Alto | Retry automático + alerta |
| Foto sem rosto detectável | Médio | Validação no upload |
| Treinamento demora muito | Médio | Timeout + notificação assíncrona |
| Storage cheio | Baixo | Limitar tamanho/quantidade de fotos |
| Embeddings corrompidos | Alto | Backup antes de atualizar .pkl |

---

## 10. Métricas de Sucesso

- **Tempo para adicionar celebridade:** < 2 minutos (antes: ~10 min manual)
- **Taxa de sucesso de treinamento:** > 95%
- **Celebridades treinadas via UI:** 100% (eliminar uso de terminal)

---

## 11. Referências

- Script atual: `/Users/paulohenrique/sticker/scripts/tools/add-celebrity.sh`
- Workers VPS: `/opt/face-recognition/scripts/`
- Embeddings: `/opt/face-recognition/embeddings/celebridades.pkl`
- Referências: `/opt/face-recognition/referencias/<slug>/`

---

## Changelog

| Data | Versão | Descrição |
|------|--------|-----------|
| 2026-01-12 | 1.0 | PRD inicial criado |
| 2026-01-12 | 2.0 | Fases 1-6 concluídas: infraestrutura, UI, APIs, VPS training, integração, reprocessamento |
