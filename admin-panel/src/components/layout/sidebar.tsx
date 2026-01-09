'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Users,
  Image,
  BarChart3,
  FileText,
  Settings,
  ChevronDown,
  Sparkles,
  UserCircle,
  GitBranch,
  AlertCircle,
  LogOut,
} from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { useAuth } from '@/lib/auth'

interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  children?: { title: string; href: string }[]
}

const navigation: NavItem[] = [
  {
    title: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
  },
  {
    title: 'Usuários',
    href: '/users',
    icon: Users,
    children: [
      { title: 'Lista', href: '/users' },
      { title: 'Fluxo', href: '/users/flow' },
    ],
  },
  {
    title: 'Stickers',
    href: '/stickers',
    icon: Image,
    children: [
      { title: 'Todos', href: '/stickers' },
      { title: 'Emoções', href: '/stickers/emotions' },
      { title: 'Celebridades', href: '/stickers/celebrities' },
    ],
  },
  {
    title: 'Analytics',
    href: '/analytics',
    icon: BarChart3,
    children: [
      { title: 'Métricas', href: '/analytics' },
      { title: 'Funil', href: '/analytics/funnel' },
    ],
  },
  {
    title: 'Logs',
    href: '/logs',
    icon: FileText,
    children: [
      { title: 'Sistema', href: '/logs' },
      { title: 'Erros', href: '/logs/errors' },
    ],
  },
  {
    title: 'Configurações',
    href: '/settings',
    icon: Settings,
  },
]

function NavItemComponent({ item }: { item: NavItem }) {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(
    item.children?.some(child => pathname === child.href) || pathname === item.href
  )

  const isActive = pathname === item.href ||
    item.children?.some(child => pathname === child.href)

  const Icon = item.icon

  if (item.children) {
    return (
      <div className="space-y-1">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            'flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors',
            isActive
              ? 'bg-accent text-accent-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
          )}
        >
          <span className="flex items-center gap-3">
            <Icon className="h-4 w-4" />
            {item.title}
          </span>
          <ChevronDown
            className={cn(
              'h-4 w-4 transition-transform',
              isOpen && 'rotate-180'
            )}
          />
        </button>
        {isOpen && (
          <div className="ml-4 space-y-1 border-l border-border pl-3">
            {item.children.map((child) => (
              <Link
                key={child.href}
                href={child.href}
                className={cn(
                  'block rounded-lg px-3 py-2 text-sm transition-colors',
                  pathname === child.href
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                {child.title}
              </Link>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <Link
      href={item.href}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
        isActive
          ? 'bg-accent text-accent-foreground'
          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
      )}
    >
      <Icon className="h-4 w-4" />
      {item.title}
    </Link>
  )
}

export function Sidebar() {
  const { user, signOut } = useAuth()

  return (
    <div className="flex h-full w-64 flex-col border-r border-border bg-card">
      {/* Logo */}
      <div className="flex h-14 items-center border-b border-border px-4">
        <Link href="/" className="flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          <span className="font-semibold">Sticker Admin</span>
        </Link>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-1">
          {navigation.map((item) => (
            <NavItemComponent key={item.href} item={item} />
          ))}
        </nav>
      </ScrollArea>

      {/* User */}
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
          <UserCircle className="h-8 w-8 text-muted-foreground" />
          <div className="flex-1 truncate">
            <p className="text-sm font-medium truncate">{user?.email}</p>
            <p className="text-xs text-muted-foreground">Admin</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={signOut}
            className="h-8 w-8"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
