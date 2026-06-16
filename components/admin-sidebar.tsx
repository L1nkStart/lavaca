"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from 'next/navigation'
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader } from "@/components/ui/sheet"
import { LayoutDashboard, Users, FileText, CreditCard, Settings, Wallet, Menu, ImageIcon } from 'lucide-react'

interface BadgeCounts {
  verifications: number
  campaigns: number
  payments: number
  withdrawals: number
  mediaChanges: number
}

interface SidebarNavProps {
  badges: BadgeCounts
  pathname: string
  onNavigate?: () => void
}

function SidebarNav({ badges, pathname, onNavigate }: SidebarNavProps) {
  const MENU_ITEMS = [
    { label: "Panel principal", href: "/admin/dashboard", icon: LayoutDashboard },
    { label: "Verificaciones", href: "/admin/verifications", icon: Users, badge: badges.verifications },
    { label: "Campañas pendientes", href: "/admin/campaigns", icon: FileText, badge: badges.campaigns },
    { label: "Pagos manuales", href: "/admin/payments", icon: CreditCard, badge: badges.payments },
    { label: "Retiros", href: "/admin/withdrawals", icon: Wallet, badge: badges.withdrawals },
    { label: "Moderar imágenes", href: "/admin/media-changes", icon: ImageIcon, badge: badges.mediaChanges },
    { label: "Métodos de Pago", href: "/admin/payment-methods", icon: Wallet },
    { label: "Configuración", href: "/admin/settings", icon: Settings },
  ]

  return (
    <nav className="flex-1 p-4 sm:p-6 space-y-2 overflow-y-auto">
      {MENU_ITEMS.map((item) => {
        const Icon = item.icon
        const isActive = pathname === item.href
        const showBadge = item.badge !== undefined && item.badge > 0

        return (
          <Link key={item.href} href={item.href} onClick={onNavigate}>
            <div
              className={`flex items-center justify-between px-4 py-2 rounded-lg transition-colors ${isActive
                ? "bg-primary text-primary-foreground"
                : "text-foreground hover:bg-muted"
                }`}
            >
              <div className="flex items-center gap-3">
                <Icon className="w-5 h-5 shrink-0" />
                <span className="text-sm font-medium">{item.label}</span>
              </div>
              {showBadge && (
                <span
                  className={`text-xs font-bold px-2 py-1 rounded-full min-w-[24px] text-center ${isActive
                    ? "bg-primary-foreground text-primary"
                    : "bg-accent text-accent-foreground"
                    }`}
                >
                  {item.badge}
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
      })
    } catch (error) {
      console.error('Error fetching badge counts:', error)
    }
  }

  return (
    <>
      {/* Mobile top bar — visible only below md */}
      <div className="md:hidden sticky top-0 z-50 flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Abrir menú admin">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <SheetHeader className="p-4 border-b border-border">
              <SheetTitle className="text-base">Admin</SheetTitle>
            </SheetHeader>
            <div className="flex flex-col h-[calc(100vh-65px)]">
              <SidebarNav badges={badges} pathname={pathname} onNavigate={() => setMobileOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>
        <span className="text-sm font-semibold">Admin</span>
        <div className="w-9" aria-hidden />
      </div>

      {/* Desktop sidebar — visible md+ */}
      <aside className="hidden md:flex w-64 shrink-0 border-r border-border bg-card">
        <div className="flex flex-col h-screen w-full sticky top-0">
          <SidebarNav badges={badges} pathname={pathname} />
        </div>
      </aside>
    </>
  )
}
