"use client";

import Link from "next/link";
import { usePathname } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { LayoutDashboard, FileText, Settings, LogOut, Plus } from 'lucide-react';

const MENU_ITEMS = [
  {
    label: "Panel principal",
    href: "/creator/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Mis campañas",
    href: "/creator/campaigns",
    icon: FileText,
  },
  {
    label: "Perfil y verificación",
    href: "/creator/profile",
    icon: Settings,
  },
];

export function CreatorSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r border-border bg-card">
      <div className="flex flex-col h-screen">
        {/* Logo */}
        <div className="p-6 border-b border-border">
          <Link href="/creator/dashboard" className="flex items-center gap-2">
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
                  className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-muted"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-sm font-medium">{item.label}</span>
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Create Campaign Button */}
        <div className="p-6 border-t border-border space-y-3">
          <Button size="sm" className="w-full bg-primary" asChild>
            <Link href="/creator/campaigns/new">
              <Plus className="w-4 h-4 mr-2" />
              Nueva campaña
            </Link>
          </Button>

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
