'use client'

import { useEffect, useState } from 'react'
import { ShieldAlert } from 'lucide-react'

/**
 * Cinta debajo del header que se muestra en toda la plataforma cuando el modo
 * crisis está activo, aclarando que LaVaca no cobra comisión por las campañas
 * creadas en modo crisis.
 */
export function CrisisRibbon() {
    const [enabled, setEnabled] = useState(false)

    useEffect(() => {
        fetch('/api/crisis-status', { cache: 'no-store' })
            .then((r) => r.json())
            .then((d) => setEnabled(Boolean(d?.enabled)))
            .catch(() => setEnabled(false))
    }, [])

    if (!enabled) return null

    return (
        <div className="bg-orange-500 text-white">
            <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-center gap-2 text-center text-xs sm:text-sm font-medium">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <span>
                    Modo crisis activo: LaVaca <strong>no cobra ninguna comisión</strong> por las campañas
                    creadas. El 100% de tu aporte llega a quien lo necesita.
                </span>
            </div>
        </div>
    )
}
