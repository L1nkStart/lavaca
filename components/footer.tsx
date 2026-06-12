'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function Footer() {
    const [user, setUser] = useState<any>(null)
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    const pathname = usePathname()
    const supabase = createClient()

    useEffect(() => {
        checkUser()
    }, [])

    const checkUser = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        setUser(user)
    }

    const isActive = (path: string) => pathname === path

    return (
        <footer className="border-t border-border bg-card py-12 px-4">
            <div className="max-w-7xl mx-auto grid md:grid-cols-4 gap-8 mb-8">
                <div>
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white font-bold text-sm">
                            LV
                        </div>
                        <span className="font-bold">LaVaca</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Crowdfunding transparente para Venezuela.
                    </p>
                </div>

                <div>
                    <h4 className="font-semibold mb-4">Plataforma</h4>
                    <ul className="space-y-2 text-sm">
                        <li>
                            <Link
                                href="/campaigns"
                                className="text-muted-foreground hover:text-foreground"
                            >
                                Campañas
                            </Link>
                        </li>
                        <li>
                            <Link
                                href="/how-it-works"
                                className="text-muted-foreground hover:text-foreground"
                            >
                                Cómo funciona
                            </Link>
                        </li>
                        <li>
                            <Link
                                href="/faq"
                                className="text-muted-foreground hover:text-foreground"
                            >
                                Preguntas frecuentes
                            </Link>
                        </li>
                        <li>
                            <Link
                                href="/fees"
                                className="text-muted-foreground hover:text-foreground"
                            >
                                Comisiones y tarifas
                            </Link>
                        </li>
                    </ul>
                </div>

                <div>
                    <h4 className="font-semibold mb-4">Empresa</h4>
                    <ul className="space-y-2 text-sm">
                        <li>
                            <Link
                                href="/about"
                                className="text-muted-foreground hover:text-foreground"
                            >
                                Acerca de
                            </Link>
                        </li>
                        <li>
                            <Link
                                href="/blog"
                                className="text-muted-foreground hover:text-foreground"
                            >
                                Blog
                            </Link>
                        </li>
                        <li>
                            <Link
                                href="/contact"
                                className="text-muted-foreground hover:text-foreground"
                            >
                                Contacto
                            </Link>
                        </li>
                    </ul>
                </div>

                <div>
                    <h4 className="font-semibold mb-4">Legal</h4>
                    <ul className="space-y-2 text-sm">
                        <li>
                            <Link
                                href="/privacy"
                                className="text-muted-foreground hover:text-foreground"
                            >
                                Política de privacidad
                            </Link>
                        </li>
                        <li>
                            <Link
                                href="/terms"
                                className="text-muted-foreground hover:text-foreground"
                            >
                                Términos y condiciones
                            </Link>
                        </li>
                        <li>
                            <Link
                                href="/refund-policy"
                                className="text-muted-foreground hover:text-foreground"
                            >
                                Política de reembolso
                            </Link>
                        </li>
                        <li>
                            <Link
                                href="/acceptable-use-policy"
                                className="text-muted-foreground hover:text-foreground"
                            >
                                Actividades prohibidas
                            </Link>
                        </li>
                    </ul>
                </div>
            </div>

            <div className="border-t border-border pt-8 text-center text-sm text-muted-foreground">
                <p>
                    {new Date().getFullYear()} LaVaca. Todos los derechos reservados.
                </p>
            </div>
        </footer>
    )
}

