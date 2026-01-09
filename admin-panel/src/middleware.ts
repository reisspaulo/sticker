import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: any) {
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  // CRITICAL: Refresh session to ensure cookies are set on response
  await supabase.auth.getUser()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  // Permitir acesso à página de login sempre
  if (request.nextUrl.pathname === '/login') {
    // Se já está autenticado, redirecionar para dashboard
    if (session) {
      return NextResponse.redirect(new URL('/', request.url))
    }
    return response
  }

  // Se não está autenticado, redirecionar para login
  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Verificar se o usuário é admin
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', session.user.id)
    .single()

  // Se não é admin, fazer logout e redirecionar
  if (profile?.role !== 'admin') {
    await supabase.auth.signOut()
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('error', 'not_admin')
    return NextResponse.redirect(loginUrl)
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
