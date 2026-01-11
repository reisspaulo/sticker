# Correção da Arquitetura de Autenticação

**Data:** 2026-01-11
**Status:** ✅ Implementado e Testado

## Contexto

O admin panel estava enfrentando múltiplos problemas:

1. **Loop infinito (React Error #185)** - Componentes re-renderizando infinitamente
2. **Queries não executando** - Dados não aparecendo nas páginas
3. **Multiple GoTrueClient instances** - Warning do Supabase sobre múltiplas instâncias
4. **Redirect não funcionando** - Login não redirecionava corretamente

## Decisão

Implementar o mesmo padrão de autenticação do sistema de monitoring (brazyl/web), que usa `@supabase/ssr` com arquitetura baseada em Zustand.

## Implementação

### 1. Biblioteca Supabase: @supabase/ssr

**Antes:**
```typescript
// @supabase/supabase-js com singleton manual
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

let browserClient: ReturnType<typeof createSupabaseClient> | null = null

export function createClient() {
  if (browserClient) return browserClient
  browserClient = createSupabaseClient(...)
  return browserClient
}
```

**Depois:**
```typescript
// @supabase/ssr com singleton nativo
import { createBrowserClient } from '@supabase/ssr'

let client: SupabaseClient | undefined

export function createClient() {
  if (client) return client

  client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  return client
}
```

### 2. Gerenciamento de Estado: React Context → Zustand

**Antes:**
```typescript
// Context API com useEffect problemático
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    const supabase = createClient() // Nova instância a cada render!
    supabase.auth.onAuthStateChange(...)
  }, []) // Problemas com router nas dependencies

  return <AuthContext.Provider value={...}>{children}</AuthContext.Provider>
}
```

**Depois:**
```typescript
// Zustand com cliente global único
const supabase = createClient() // UMA ÚNICA instância no nível do módulo

export const useAuth = create<AuthState>((set) => ({
  user: null,
  loading: true,

  initialize: async () => {
    const { data: { session } } = await supabase.auth.getSession()

    if (session?.user) {
      set({ user: {...}, loading: false })
    }

    // OnAuthStateChange configurado UMA VEZ
    supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        set({ user: {...}, loading: false })
      } else {
        set({ user: null, loading: false })
      }
    })
  },

  signIn: async (email, password) => { ... },
  signOut: async () => { ... }
}))
```

### 3. Middleware Simplificado

**Implementação:**
```typescript
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers }
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()

  // Rotas protegidas
  const protectedPaths = ['/', '/stickers', '/celebrities', '/emotions']
  const isProtectedPath = protectedPaths.some(path =>
    request.nextUrl.pathname === path || request.nextUrl.pathname.startsWith(path + '/')
  )

  // Rotas de auth
  const authPaths = ['/login']
  const isAuthPath = authPaths.some(path =>
    request.nextUrl.pathname.startsWith(path)
  )

  // Redirect para login se sem sessão
  if (isProtectedPath && !session) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Redirect para home se já autenticado
  if (isAuthPath && session) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return response
}
```

### 4. Login Flow com Redirect Manual

**Implementação:**
```typescript
const handleLogin = async (e: React.FormEvent) => {
  e.preventDefault()
  setLoading(true)
  setError('')

  try {
    await signIn(email, password)

    // Mostrar tela de transição
    setIsRedirecting(true)
    setLoading(false)

    // Aguardar para garantir que cookie foi salvo, então forçar reload
    setTimeout(() => {
      window.location.href = '/'
    }, 500)
  } catch (err: any) {
    setError(err.message || 'Email ou senha incorretos')
    setLoading(false)
  }
}
```

### 5. AuthProvider para Inicialização

```typescript
'use client'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { initialize } = useAuth()

  useEffect(() => {
    initialize()
  }, [initialize])

  return <>{children}</>
}
```

## Estrutura de Arquivos

```
admin-panel/src/
├── lib/
│   └── supabase/
│       ├── client.ts       # Cliente browser (singleton)
│       └── server.ts       # Cliente server
├── hooks/
│   └── useAuth.ts          # Hook Zustand
├── components/
│   └── auth/
│       └── AuthProvider.tsx
├── app/
│   ├── providers.tsx       # Wrapper com AuthProvider
│   └── login/
│       └── page.tsx        # Página de login com redirect manual
└── middleware.ts           # Proteção de rotas
```

## Resultados dos Testes

### Teste de Login e Queries
```
🎯 TESTE - Login e verificar queries em /stickers

✅ API REQUEST #1-9 para /rest/v1/stickers
✅ API RESPONSE: 200 e 206 (partial content)

============================================================
📊 RESULTADO FINAL
============================================================
API Requests enviados: 9
Imagens de stickers na página: 30

🎉 SUCESSO! Queries funcionam e dados aparecem!
============================================================
```

## Principais Diferenças vs Implementação Anterior

| Aspecto | Antes | Depois |
|---------|-------|--------|
| **Biblioteca** | @supabase/supabase-js | @supabase/ssr |
| **Estado** | React Context | Zustand |
| **Cliente Supabase** | Múltiplas instâncias | Singleton global |
| **Cookies** | localStorage | Cookies (SSR-compatible) |
| **Middleware** | Tentativa complexa | Simples e funcional |
| **Redirect** | onAuthStateChange automático | window.location.href manual |

## Por que Funcionou?

### 1. Singleton Correto
- **Problema anterior:** Cada componente/hook criava nova instância do cliente
- **Solução:** Cliente criado UMA VEZ no nível do módulo

### 2. Cookies vs localStorage
- **Problema anterior:** localStorage não é acessível no middleware (SSR)
- **Solução:** @supabase/ssr salva sessão em cookies, acessíveis no middleware

### 3. Zustand vs Context
- **Problema anterior:** Context recriava listeners a cada render
- **Solução:** Zustand com cliente global, listeners configurados uma vez

### 4. Redirect com Reload
- **Problema anterior:** router.push() não forçava leitura dos cookies
- **Solução:** window.location.href força reload completo, middleware lê cookies

## Lições Aprendidas

1. **@supabase/ssr não era o problema** - A implementação anterior estava incorreta
2. **Singleton é crítico** - Múltiplas instâncias causam comportamento indefinido
3. **Cookies são necessários para SSR** - localStorage não funciona no servidor
4. **Seguir padrões que funcionam** - O monitoring system já tinha a solução correta

## Próximos Passos

1. ✅ Queries funcionando corretamente
2. ⏳ Remover arquivos antigos de teste
3. ⏳ Deploy para produção
4. ⏳ Monitorar logs de erro em produção

## Referências

- [Supabase SSR Documentation](https://supabase.com/docs/guides/auth/server-side-rendering)
- [Zustand Documentation](https://docs.pmnd.rs/zustand/getting-started/introduction)
- Código do monitoring system: `/Users/paulohenrique/brazyl/web`
