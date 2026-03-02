"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from 'next/navigation'
import { Button } from "@/components/ui/button"
import { LayoutDashboard, Users, FileText, CreditCard, Settings, LogOut } from 'lucide-react'
import { createClient } from "@/lib/supabase/client"

interface BadgeCounts {
  verifications: number
  campaigns: number
  payments: number
}

export function AdminSidebar() {
  const pathname = usePathname()
  const [badges, setBadges] = useState<BadgeCounts>({
    verifications: 0,
    campaigns: 0,
    payments: 0
  })

  const supabase = createClient()

  useEffect(() => {
    fetchBadgeCounts()

    // Refresh counts every 30 seconds
    const interval = setInterval(fetchBadgeCounts, 30000)

    return () => clearInterval(interval)
  }, [])

  const fetchBadgeCounts = async () => {
    try {
      const [
        verificationsResult,
        campaignsResult,
        paymentsResult
      ] = await Promise.all([
        // Pending verifications
        supabase
          .from('verification_requests')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending'),

        // Pending campaigns (under review or draft)
        supabase
          .from('campaigns')
          .select('id', { count: 'exact', head: true })
          .in('status', ['under_review', 'draft']),

        // Pending payments
        supabase
          .from('donations')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending')
      ])

      setBadges({
        verifications: verificationsResult.count || 0,
        campaigns: campaignsResult.count || 0,
        payments: paymentsResult.count || 0
      })
    } catch (error) {
      console.error('Error fetching badge counts:', error)
    }
  }

  const MENU_ITEMS = [
    {
      label: "Panel principal",
      href: "/admin/dashboard",
      icon: LayoutDashboard,
    },
    {
      label: "Verificaciones",
      href: "/admin/verifications",
      icon: Users,
      badge: badges.verifications,
    },
    {
      label: "Campañas pendientes",
      href: "/admin/campaigns",
      icon: FileText,
      badge: badges.campaigns,
    },
    {
      label: "Pagos manuales",
      href: "/admin/payments",
      icon: CreditCard,
      badge: badges.payments,
    },
    {
      label: "Configuración",
      href: "/admin/settings",
      icon: Settings,
    },
  ]

  return (
    <aside className="w-64 border-r border-border bg-card">
      <div className="flex flex-col h-screen">
        {/* Menu */}
        <nav className="flex-1 p-6 space-y-2">
          {MENU_ITEMS.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            const showBadge = item.badge !== undefined && item.badge > 0

            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={`flex items-center justify-between px-4 py-2 rounded-lg transition-colors ${isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-muted"
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-5 h-5" />
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

        {/* Logout */}
        {/* <div className="p-6 border-t border-border">
          <Button size="sm" variant="outline" className="w-full" asChild>
            <Link href="/auth/logout">
              <LogOut className="w-4 h-4 mr-2" />
              Salir
            </Link>
          </Button>
        </div> */}
      </div>
    </aside>
  )
}
