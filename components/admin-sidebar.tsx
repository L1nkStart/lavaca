"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from 'next/navigation'
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader } from "@/components/ui/sheet"
import { LayoutDashboard, Users, FileText, CreditCard, Settings, Wallet, Menu, ImageIcon, Receipt, HandHeart, Landmark } from 'lucide-react'

interface BadgeCounts {
  verifications: number
  campaigns: number
  payments: number
  withdrawals: number
  mediaChanges: number
  directStale: number
}

type MenuItem = {
  label: string
  href: string
  icon: typeof LayoutDashboard
  badge?: number
  /** Texto accesible del badge (qué cuenta). */
  badgeLabel?: string
}

function menuItems(badges: BadgeCounts): MenuItem[] {
  return [
    { label: "Panel principal", href: "/admin/dashboard", icon: LayoutDashboard },
    { label: "Verificaciones", href: "/admin/verifications", icon: Users, badge: badges.verifications, badgeLabel: "pendientes" },
    { label: "Campañas pendientes", href: "/admin/campaigns", icon: FileText, badge: badges.campaigns, badgeLabel: "pendientes" },
    { label: "Pagos manuales", href: "/admin/payments", icon: CreditCard, badge: badges.payments, badgeLabel: "por aprobar" },
    { label: "Pagos directos (crisis)", href: "/admin/direct-payments", icon: HandHeart, badge: badges.directStale, badgeLabel: "sin respuesta del organizador" },
    { label: "Historial de donaciones", href: "/admin/donations", icon: Receipt },
    { label: "Retiros", href: "/admin/withdrawals", icon: Wallet, badge: badges.withdrawals, badgeLabel: "pendientes" },
    { label: "Moderar imágenes", href: "/admin/media-changes", icon: ImageIcon, badge: badges.mediaChanges, badgeLabel: "pendientes" },
    { label: "Métodos de pago", href: "/admin/payment-methods", icon: Landmark },
    { label: "Configuración", href: "/admin/settings", icon: Settings },
  ]
}

interface SidebarNavProps {
  badges: BadgeCounts
  pathname: string
  onNavigate?: () => void
}

function SidebarNav({ badges, pathname, onNavigate }: SidebarNavProps) {
  return (
    <nav className="flex-1 p-4 sm:p-6 space-y-1.5 overflow-y-auto" aria-label="Menú de administración">
      {menuItems(badges).map((item) => {
        const Icon = item.icon
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
        const showBadge = item.badge !== undefined && item.badge > 0

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={isActive ? "page" : undefined}
            className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div
              className={`flex min-h-11 items-center justify-between gap-2 px-4 py-2 rounded-lg transition-colors ${isActive
                ? "bg-primary text-primary-foreground"
                : "text-foreground hover:bg-muted"
                }`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <Icon className="w-5 h-5 shrink-0" />
                <span className="text-sm font-medium">{item.label}</span>
              </div>
              {showBadge && (
                <span
                  className={`shrink-0 text-xs font-bold px-2 py-1 rounded-full min-w-[24px] text-center ${isActive
                    ? "bg-primary-foreground text-primary"
                    : "bg-accent text-accent-foreground"
                    }`}
                >
                  {item.badge}
                  <span className="sr-only"> {item.badgeLabel}</span>
                </span>
              )}
            </div>
          </Link>
        )
      })}
    </nav>
  )
}

export function AdminSidebar() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [badges, setBadges] = useState<BadgeCounts>({
    verifications: 0,
    campaigns: 0,
    payments: 0,
    withdrawals: 0,
    mediaChanges: 0,
    directStale: 0,
  })

  useEffect(() => {
    fetchBadgeCounts()
    const interval = setInterval(fetchBadgeCounts, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchBadgeCounts = async () => {
    try {
      const response = await fetch('/api/admin/sidebar-badges', {
        method: 'GET',
        cache: 'no-store',
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result?.error || result?.details || 'No se pudieron cargar los badges')
      }

      setBadges({
        verifications: result?.verifications || 0,
        campaigns: result?.campaigns || 0,
        payments: result?.payments || 0,
        withdrawals: result?.withdrawals || 0,
        mediaChanges: result?.mediaChanges || 0,
        directStale: result?.directStale || 0,
      })
    } catch (error) {
      console.error('Error fetching badge counts:', error)
    }
  }

  const items = menuItems(badges)
  const current = items.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
  const pendingTotal = items.reduce((sum, item) => sum + (item.badge || 0), 0)

  return (
    <>
      {/* Barra superior móvil (bajo md). Va pegada justo debajo del Navbar del
          sitio (sticky top-0, h-16) para no taparlo ni quedar debajo de él. */}
      <div className="md:hidden sticky top-16 z-40 flex items-center gap-2 border-b border-border bg-card px-2 py-2">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" className="relative h-11 shrink-0 gap-2 px-3" aria-label="Abrir menú admin">
              <Menu className="h-5 w-5" />
              <span className="text-sm font-semibold">Admin</span>
              {pendingTotal > 0 && (
                <span className="absolute right-1 top-1.5 h-2 w-2 rounded-full bg-accent" aria-hidden />
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[85vw] max-w-xs p-0">
            <SheetHeader className="p-4 border-b border-border">
              <SheetTitle className="text-base">Admin</SheetTitle>
            </SheetHeader>
            <div className="flex flex-col h-[calc(100dvh-65px)]">
              <SidebarNav badges={badges} pathname={pathname} onNavigate={() => setMobileOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>
        {current && (
          <span className="min-w-0 truncate text-sm text-muted-foreground" aria-hidden>
            / {current.label}
          </span>
        )}
      </div>

      {/* Sidebar de escritorio (md+). Sticky bajo el Navbar del sitio. */}
      <aside className="hidden md:flex w-64 shrink-0 border-r border-border bg-card">
        <div className="flex flex-col h-[calc(100vh-4rem)] w-full sticky top-16">
          <SidebarNav badges={badges} pathname={pathname} />
        </div>
      </aside>
    </>
  )
}
