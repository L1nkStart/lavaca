import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/crisis-status
 * Estado público del interruptor maestro del modo crisis. Lo consumen el
 * formulario de creación (para mostrar el selector) y la página pública de
 * la campaña (para mostrar el pago directo). admin_config no es legible por
 * anon, por eso se lee con service-role exponiendo solo este booleano.
 */
export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        const adminSupabase = createAdminClient()
        const { data } = await adminSupabase
            .from('admin_config')
            .select('crisis_mode_enabled, crisis_mode_forced')
            .limit(1)
            .maybeSingle()

        return NextResponse.json({
            enabled: Boolean(data?.crisis_mode_enabled),
            forced: Boolean(data?.crisis_mode_forced),
        })
    } catch {
        return NextResponse.json({ enabled: false, forced: false })
    }
}
