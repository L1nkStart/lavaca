'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { NotificationsDropdown } from '@/components/notifications-dropdown'
import { createClient } from '@/lib/supabase/client'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Heart, Menu, X, Search, User, Loader2, FolderKanban, LayoutDashboard } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Navbar() {
    const [user, setUser] = useState<any>(null)
    const [userRole, setUserRole] = useState<string | null>(null)
    const [userKycStatus, setUserKycStatus] = useState<string | null>(null)
    const [authLoading, setAuthLoading] = useState(true)
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    const pathname = usePathname()
    const router = useRouter()
    const supabase = createClient()

    useEffect(() => {
        let isMounted = true

        const loadUserRole = async (userId: string) => {
            const { data } = await supabase
                .from('users')
                .select('role, kyc_status')
                .eq('id', userId)
                .single()

            if (isMounted) {
                setUserRole(data?.role || null)
                setUserKycStatus(data?.kyc_status || null)
            }
        }

        const checkUser = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (isMounted) {
                setUser(user)

                if (user?.id) {
                    await loadUserRole(user.id)
                } else {
                    setUserRole(null)
                    setUserKycStatus(null)
                }

                setAuthLoading(false)
            }
        }

        checkUser()

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            const syncAuthState = async () => {
                if (isMounted) {
                    setUser(session?.user ?? null)

                    if (session?.user?.id) {
                        await loadUserRole(session.user.id)
                    } else {
                        setUserRole(null)
                        setUserKycStatus(null)
                    }

                    setAuthLoading(false)
                }
            }

            syncAuthState()
        })

        return () => {
            isMounted = false
            subscription.unsubscribe()
        }
    }, [])

    const isActive = (path: string) => pathname === path

    const creatorNavOptions = [
        { value: '/creator/dashboard', label: 'Panel principal' },
        { value: '/creator/campaigns', label: 'Mis campañas' },
    ]

    const creatorNavValue = creatorNavOptions.some((option) => option.value === pathname)
        ? pathname
        : undefined

    const canCreateCampaign = userKycStatus === 'verified'

    return (
        <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="max-w-7xl mx-auto px-4">
                <div className="flex h-16 items-center justify-between">
                    {/* Logo */}
                    <div className="flex items-center gap-8">
                        <Link href="/" className="flex items-center gap-2">
                            <Heart className="h-6 w-6 text-primary fill-primary" />
                            <span className="font-bold text-xl">LaVaca</span>
                        </Link>

                        {/* Desktop Navigation */}
                        <div className="hidden md:flex items-center gap-6">
                            <Link
                                href="/campaigns"
                                className={cn(
                                    "text-sm font-medium transition-colors hover:text-primary",
                                    isActive('/campaigns') ? 'text-primary' : 'text-muted-foreground'
                                )}
                            >
                                Descubrir
                            </Link>
                            <Link
                                href="/how-it-works"
                                className={cn(
                                    "text-sm font-medium transition-colors hover:text-primary",
                                    isActive('/how-it-works') ? 'text-primary' : 'text-muted-foreground'
                                )}
                            >
                                Cómo funciona
                            </Link>
                        </div>
                    </div>

                    {/* Right side */}
                    <div className="flex items-center gap-3">
                        {/* Search button */}
                        <Button
                            variant="ghost"
                            size="sm"
                            className="hidden md:flex"
                            asChild
                        >
                            <Link href="/campaigns">
                                <Search className="h-4 w-4" />
                            </Link>
                        </Button>

                        {authLoading ? (
                            <Button variant="ghost" size="sm" disabled>
                                <Loader2 className="h-4 w-4 animate-spin" />
                            </Button>
                        ) : user ? (
                            <>
                                {/* Notifications */}
                                <NotificationsDropdown />

                                {/* User Menu */}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="hidden md:flex"
                                    asChild
                                >
                                    <Link href="/profile">
                                        <User className="h-4 w-4 mr-2" />
                                        Mi perfil
                                    </Link>
                                </Button>

                                {userRole === 'creator' && (
                                    <>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="hidden md:flex"
                                            asChild
                                        >
                                            <Link href="/creator/dashboard">
                                                <LayoutDashboard className="h-4 w-4 mr-2" />
                                                Panel principal
                                            </Link>
                                        </Button>

                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="hidden md:flex"
                                            asChild
                                        >
                                            <Link href="/creator/campaigns">
                                                <FolderKanban className="h-4 w-4 mr-2" />
                                                Mis campañas
                                            </Link>
                                        </Button>
                                    </>
                                )}

                                {userRole === 'admin' && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="hidden md:flex"
                                        asChild
                                    >
                                        <Link href="/admin/dashboard">
                                            <LayoutDashboard className="h-4 w-4 mr-2" />
                                            Admin
                                        </Link>
                                    </Button>
                                )}

                                {/* Start Campaign Button */}
                                <Button
                                    size="sm"
                                    variant={canCreateCampaign ? 'default' : 'outline'}
                                    className={!canCreateCampaign ? 'text-muted-foreground border-muted-foreground/30' : undefined}
                                    asChild
                                >
                                    <Link href="/creator/campaigns/create">
                                        Crear campaña
                                    </Link>
                                </Button>
                            </>
                        ) : (
                            <>
                                <Button variant="ghost" size="sm" className="hidden md:flex" asChild>
                                    <Link href="/auth/login">Iniciar sesión</Link>
                                </Button>
                                <Button size="sm" asChild>
                                    <Link href="/creator/campaigns/create">
                                        Crear campaña
                                    </Link>
                                </Button>
                            </>
                        )}

                        {/* Mobile menu button */}
                        <Button
                            variant="ghost"
                            size="sm"
                            className="md:hidden"
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        >
                            {mobileMenuOpen ? (
                                <X className="h-5 w-5" />
                            ) : (
                                <Menu className="h-5 w-5" />
                            )}
                        </Button>
                    </div>
                </div>

                {/* Mobile Menu */}
                {mobileMenuOpen && (
                    <div className="md:hidden py-4 space-y-3 border-t border-border">
                        <Link
                            href="/campaigns"
                            className="block px-3 py-2 rounded-md text-sm font-medium hover:bg-muted"
                            onClick={() => setMobileMenuOpen(false)}
                        >
                            Descubrir
                        </Link>
                        <Link
                            href="/how-it-works"
                            className="block px-3 py-2 rounded-md text-sm font-medium hover:bg-muted"
                            onClick={() => setMobileMenuOpen(false)}
                        >
                            Cómo funciona
                        </Link>
                        {!authLoading && user && (
                            <Link
                                href="/profile"
                                className="block px-3 py-2 rounded-md text-sm font-medium hover:bg-muted"
                                onClick={() => setMobileMenuOpen(false)}
                            >
                                Mi perfil
                            </Link>
                        )}
                        {!authLoading && user && userRole === 'creator' && (
                            <div className="px-3 py-2">
                                <Select
                                    value={creatorNavValue}
                                    onValueChange={(value) => {
                                        setMobileMenuOpen(false)
                                        router.push(value)
                                    }}
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Navegación creador" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {creatorNavOptions.map((option) => (
                                            <SelectItem key={option.value} value={option.value}>
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                        {!authLoading && user && userRole === 'admin' && (
                            <Link
                                href="/admin/dashboard"
                                className="block px-3 py-2 rounded-md text-sm font-medium hover:bg-muted"
                                onClick={() => setMobileMenuOpen(false)}
                            >
                                Dashboard admin
                            </Link>
                        )}
                        {!authLoading && !user && (
                            <Link
                                href="/auth/login"
                                className="block rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
                                onClick={() => setMobileMenuOpen(false)}
                            >
                                Iniciar sesión
                            </Link>
                        )}
                    </div>
                )}
            </div>
        </nav>
    )
}
