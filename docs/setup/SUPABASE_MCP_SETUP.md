# 🔧 Supabase MCP - Setup Completo

**Status:** ✅ Configurado
**Data:** 26/12/2025
**Projeto:** YOUR_SUPABASE_PROJECT_ID

---

## ✅ O Que Já Foi Feito

1. ✅ Arquivo `.mcp.json` criado
2. ✅ URL do servidor MCP configurada
3. ✅ Features habilitadas:
   - `docs` - Documentação do Supabase
   - `account` - Gerenciamento de conta
   - `database` - Acesso ao PostgreSQL
   - `debugging` - Debug de queries
   - `development` - Ferramentas de dev
   - `functions` - Edge Functions
   - `branching` - Branching de banco
   - `storage` - **Supabase Storage** 🎯

---

## 🚀 Próximo Passo: AUTENTICAR

### **IMPORTANTE:** Você precisa autenticar para ativar o MCP

Execute no **terminal normal** (não na extensão do Claude Code):

```bash
claude /mcp
```

Depois:
1. Selecione **"supabase"** na lista
2. Selecione **"Authenticate"**
3. Siga o fluxo de autenticação no browser

---

## 🎯 O Que o MCP Permite (Depois de Autenticar)

Com o MCP configurado, o Claude Code poderá:

### 📦 Storage (Principal para o bot de stickers!)
```javascript
// Claude Code pode:
- ✅ Criar buckets automaticamente
- ✅ Fazer upload de arquivos
- ✅ Gerar URLs públicas
- ✅ Configurar políticas de acesso (RLS)
- ✅ Listar arquivos
- ✅ Deletar arquivos antigos
```

### 🗄️ Database
```sql
-- Claude Code pode:
- ✅ Criar tabelas
- ✅ Executar queries
- ✅ Ver schema
- ✅ Debugar performance
```

### ⚡ Functions
```javascript
// Claude Code pode:
- ✅ Criar Edge Functions
- ✅ Fazer deploy
- ✅ Ver logs
```

---

## 📁 Configuração Atual

```json
{
  "mcpServers": {
    "supabase": {
      "type": "http",
      "url": "https://mcp.supabase.com/mcp?project_ref=YOUR_SUPABASE_PROJECT_ID&features=docs%2Caccount%2Cdatabase%2Cdebugging%2Cdevelopment%2Cfunctions%2Cbranching%2Cstorage"
    }
  }
}
```

**Projeto:** `YOUR_SUPABASE_PROJECT_ID`
**Features:** Todas habilitadas ✅

---

## 🔐 Segurança

- ✅ `.mcp.json` adicionado ao `.gitignore`
- ✅ Credenciais NÃO serão commitadas
- ✅ Autenticação via OAuth (seguro)

---

## 🧪 Como Testar Se Funcionou

Depois de autenticar, peça ao Claude Code:

```
"Crie um bucket chamado 'test-stickers' no Supabase Storage"
```

Se funcionar, você verá o Claude Code:
1. Conectando ao MCP
2. Criando o bucket
3. Retornando sucesso ✅

---

## 📚 Exemplos de Uso

### Exemplo 1: Criar Estrutura de Buckets

```
Claude, crie a estrutura completa de buckets para o bot de stickers:
- stickers-estaticos (público)
- stickers-animados (público)
- temp (privado, auto-deletar após 24h)
```

### Exemplo 2: Upload de Arquivo

```
Claude, faça upload deste sticker para o Supabase Storage:
- Arquivo: /tmp/sticker.webp
- Bucket: stickers-estaticos
- Path: user_5511999999999/1735252800_abc.webp
- Retorne a URL pública
```

### Exemplo 3: Criar Tabela de Metadados

```
Claude, crie a tabela 'stickers' no Supabase com:
- id (UUID, PK)
- user_number (TEXT)
- file_path (TEXT)
- file_url (TEXT)
- file_size_bytes (INTEGER)
- tipo (TEXT, check: 'estatico' ou 'animado')
- created_at (TIMESTAMP)

E crie os índices necessários.
```

---

## 🆘 Troubleshooting

### Erro: "MCP server not authenticated"
**Solução:**
```bash
claude /mcp
# Selecione "supabase" → "Authenticate"
```

### Erro: "Project not found"
**Causa:** Project ref incorreto
**Solução:** Verificar se `YOUR_SUPABASE_PROJECT_ID` está correto no Supabase Dashboard

### Claude Code não consegue acessar Storage
**Solução:**
1. Verificar se feature `storage` está na URL do MCP ✅
2. Re-autenticar: `claude /mcp`
3. Verificar permissões no Supabase Dashboard

---

## 🎯 Status

- [x] MCP configurado
- [ ] MCP autenticado (você precisa fazer isso!)
- [ ] Testado (criar bucket de teste)

---

## 🔗 Links Úteis

- **Supabase Dashboard:** https://supabase.com/dashboard/project/YOUR_SUPABASE_PROJECT_ID
- **Storage:** https://supabase.com/dashboard/project/YOUR_SUPABASE_PROJECT_ID/storage/buckets
- **Database:** https://supabase.com/dashboard/project/YOUR_SUPABASE_PROJECT_ID/editor
- **Claude Code MCP Docs:** https://docs.claude.com/claude-code/mcp

---

**Próximo passo:** Autenticar o MCP rodando `claude /mcp` no terminal! 🚀
