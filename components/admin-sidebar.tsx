"use client";

import Link from "next/link";
import { usePathname } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Users, FileText, CreditCard, Settings, LogOut } from 'lucide-react';

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
    badge: 12,
  },
  {
    label: "Campañas pendientes",
    href: "/admin/campaigns",
    icon: FileText,
    badge: 5,
  },
  {
    label: "Pagos manuales",
    href: "/admin/payments",
    icon: CreditCard,
    badge: 8,
  },
  {
    label: "Configuración",
    href: "/admin/settings",
    icon: Settings,
  },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r border-border bg-card">
      <div className="flex flex-col h-screen">
        {/* Logo */}
        <div className="p-6 border-b border-border">
          <Link href="/admin/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white font-bold">
              LV
            </div>
            <span className="font-bold">LaVaca</span>
          </Link>
        </div>

        {/* Menu */}
        <nav className="flex-1 p-6 space-y-2">
          {MENU_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={`flex items-center justify-between px-4 py-2 rounded-lg transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-muted"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-5 h-5" />
                    <span className="text-sm font-medium">{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`text-xs font-bold px-2 py-1 rounded-full ${
                        isActive
                          ? "bg-primary-foreground text-primary"
                          : "bg-accent text-accent-foreground"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-6 border-t border-border">
          <Button size="sm" variant="outline" className="w-full" asChild>
            <Link href="/auth/logout">
              <LogOut className="w-4 h-4 mr-2" />
              Salir
            </Link>
          </Button>
        </div>
      </div>
    </aside>
  );
}
