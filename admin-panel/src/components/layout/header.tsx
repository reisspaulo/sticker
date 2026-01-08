'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Sidebar } from './sidebar'

const routeTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/users': 'Usuarios',
  '/users/flow': 'Fluxo de Usuarios',
  '/stickers': 'Stickers',
  '/stickers/emotions': 'Classificacao de Emocoes',
  '/stickers/celebrities': 'Por Celebridade',
  '/analytics': 'Analytics',
  '/analytics/funnel': 'Funil de Conversao',
  '/logs': 'Logs do Sistema',
  '/logs/errors': 'Erros',
  '/settings': 'Configuracoes',
}

function getBreadcrumbs(pathname: string) {
  const segments = pathname.split('/').filter(Boolean)
  const breadcrumbs: { title: string; href: string }[] = [
    { title: 'Dashboard', href: '/' },
  ]

  let currentPath = ''
  for (const segment of segments) {
    currentPath += `/${segment}`
    const title = routeTitles[currentPath] || segment.charAt(0).toUpperCase() + segment.slice(1)
    breadcrumbs.push({ title, href: currentPath })
  }

  return breadcrumbs
}

export function Header() {
  const pathname = usePathname()
  const breadcrumbs = getBreadcrumbs(pathname)
  const pageTitle = routeTitles[pathname] || 'Dashboard'

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 lg:px-6">
      {/* Mobile menu */}
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <Sidebar />
        </SheetContent>
      </Sheet>

      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1 text-sm">
        {breadcrumbs.map((crumb, index) => (
          <div key={crumb.href} className="flex items-center gap-1">
            {index > 0 && (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            {index === breadcrumbs.length - 1 ? (
              <span className="font-medium">{crumb.title}</span>
            ) : (
              <Link
                href={crumb.href}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {crumb.title}
              </Link>
            )}
          </div>
        ))}
      </nav>
    </header>
  )
}
