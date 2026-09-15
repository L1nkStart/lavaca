'use client'

import Link from 'next/link'
import { Heart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { lavacaDonateHref } from '@/lib/lavaca-campaign'

interface SupportLavacaModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

/**
 * Invitación breve a apoyar a LaVaca justo después de donar a otra campaña.
 * LaVaca no cobra comisión en modo crisis: la plataforma vive de esto. Un
 * solo mensaje, dos botones, y "Ahora no" siempre a mano.
 */
export function SupportLavacaModal({ open, onOpenChange }: SupportLavacaModalProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader className="items-center text-center sm:text-center">
                    <span className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Heart className="h-6 w-6 fill-primary" />
                    </span>
                    <DialogTitle className="text-xl">¡Gracias por ayudar!</DialogTitle>
                    <DialogDescription className="text-pretty text-foreground/80">
                        LaVaca no cobra comisión: el 100% de tu aporte llegó a la causa. Los servidores,
                        la verificación manual de cada campaña y el soporte los pagamos con donaciones
                        voluntarias como esta. <strong className="text-foreground">Con $1 o $2 ya nos ayudas</strong> a
                        seguir en pie para la próxima persona que lo necesite.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter className="gap-2 sm:flex-col sm:space-x-0">
                    <Button asChild className="w-full min-h-[44px]" onClick={() => onOpenChange(false)}>
                        <Link href={lavacaDonateHref}>
                            <Heart className="h-4 w-4" />
                            Apoyar a LaVaca
                        </Link>
                    </Button>
                    <Button type="button" variant="ghost" className="w-full min-h-[44px]" onClick={() => onOpenChange(false)}>
                        Ahora no
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

/** Evita mostrar la invitación dos veces por la misma donación (recargas). */
export function shouldShowSupportModal(key: string): boolean {
    try {
        const storageKey = `lavaca:support-modal:${key}`
        if (sessionStorage.getItem(storageKey)) return false
        sessionStorage.setItem(storageKey, '1')
        return true
    } catch {
        return true
    }
}
