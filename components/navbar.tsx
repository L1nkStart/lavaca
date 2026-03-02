'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { NotificationsDropdown } from '@/components/notifications-dropdown'
import { createClient } from '@/lib/supabase/client'
import { Heart, Menu, X, Search, User, Loader2, FolderKanban } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Navbar() {
    const [user, setUser] = useState<any>(null)
    const [userRole, setUserRole] = useState<string | null>(null)
    const [authLoading, setAuthLoading] = useState(true)
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    const pathname = usePathname()
    const supabase = createClient()

    useEffect(() => {
        let isMounted = true

        const loadUserRole = async (userId: string) => {
            const { data } = await supabase
                .from('users')
                .select('role')
                .eq('id', userId)
                .single()

            if (isMounted) {
                setUserRole(data?.role || null)
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
                                )}

                                {/* Start Campaign Button */}
                                <Button size="sm" asChild>
                                    <Link href="/creator/campaigns/create">
                                        Crear campaña
                                    </Link>
                                </Button>
                            </>
                        ) : (
                            <>
                                <Button variant="ghost" size="sm" asChild>
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
                            <Link
                                href="/creator/campaigns"
                                className="block px-3 py-2 rounded-md text-sm font-medium hover:bg-muted"
                                onClick={() => setMobileMenuOpen(false)}
                            >
                                Mis campañas
                            </Link>
                        )}
                    </div>
                )}
            </div>
        </nav>
    )
}
