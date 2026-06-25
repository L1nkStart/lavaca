import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function assertAdmin() {
    const supabase = await createClient();
    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
        return { ok: false as const, status: 401, error: "No autorizado" };
    }

    const { data: actorProfile } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single();

    if (actorProfile?.role !== "admin") {
        return { ok: false as const, status: 403, error: "Permisos insuficientes" };
    }

    return { ok: true as const, userId: user.id };
}

async function ensureConfigRow() {
    const adminSupabase = createAdminClient();

    const { data: existing } = await adminSupabase
        .from("admin_config")
        .select("id")
        .limit(1)
        .maybeSingle();

    if (existing?.id) {
        return existing.id as string;
    }

    const { data: created, error: insertError } = await adminSupabase
        .from("admin_config")
        .insert({})
        .select("id")
        .single();

    if (insertError) throw insertError;
    return created.id as string;
}

export async function GET() {
    try {
        const adminCheck = await assertAdmin();
        if (!adminCheck.ok) {
            return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
        }

        const adminSupabase = createAdminClient();
        await ensureConfigRow();

        const { data: config, error } = await adminSupabase
            .from("admin_config")
            .select(
                "id, platform_commission_percentage, bcv_exchange_rate, bcv_last_updated, auto_update_exchange_rate, min_withdrawal_usd, min_withdrawal_bs, crisis_mode_enabled, crisis_mode_forced, updated_at"
            )
            .limit(1)
            .single();

        if (error) throw error;

        return NextResponse.json({ config });
    } catch (error: any) {
        console.error("Error reading admin settings:", error);
        return NextResponse.json(
            { error: "Error interno", details: error?.message || "Unknown error" },
            { status: 500 }
        );
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const adminCheck = await assertAdmin();
        if (!adminCheck.ok) {
            return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
        }

        const body = await request.json();
        const updates: Record<string, unknown> = {};

        if (body.platform_commission_percentage !== undefined) {
            const commission = Number(body.platform_commission_percentage);
            if (!Number.isFinite(commission) || commission < 0 || commission > 100) {
                return NextResponse.json(
                    { error: "Comisión inválida (0-100)" },
                    { status: 400 }
                );
            }
            updates.platform_commission_percentage = commission;
        }

        if (body.bcv_exchange_rate !== undefined) {
            const rate = Number(body.bcv_exchange_rate);
            if (!Number.isFinite(rate) || rate <= 0) {
                return NextResponse.json(
                    { error: "Tasa inválida" },
                    { status: 400 }
                );
            }
            updates.bcv_exchange_rate = rate;
            updates.bcv_last_updated = new Date().toISOString();
        }

        if (body.auto_update_exchange_rate !== undefined) {
            updates.auto_update_exchange_rate = Boolean(body.auto_update_exchange_rate);
        }

        if (body.crisis_mode_enabled !== undefined) {
            const enabled = Boolean(body.crisis_mode_enabled);
            updates.crisis_mode_enabled = enabled;
            // Apagar el maestro también desactiva el forzado (no se puede forzar
            // crisis si el modo crisis está apagado).
            if (!enabled) updates.crisis_mode_forced = false;
        }

        if (body.crisis_mode_forced !== undefined) {
            const forced = Boolean(body.crisis_mode_forced);
            updates.crisis_mode_forced = forced;
            // Forzar implica el modo crisis maestro encendido.
            if (forced) updates.crisis_mode_enabled = true;
        }

        if (body.min_withdrawal_usd !== undefined) {
            const minUsd = Number(body.min_withdrawal_usd);
            if (!Number.isFinite(minUsd) || minUsd < 0) {
                return NextResponse.json({ error: "Mínimo de retiro USD inválido" }, { status: 400 });
            }
            updates.min_withdrawal_usd = minUsd;
        }

        if (body.min_withdrawal_bs !== undefined) {
            const minBs = Number(body.min_withdrawal_bs);
            if (!Number.isFinite(minBs) || minBs < 0) {
                return NextResponse.json({ error: "Mínimo de retiro Bs inválido" }, { status: 400 });
            }
            updates.min_withdrawal_bs = minBs;
        }

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: "Sin cambios" }, { status: 400 });
        }

        updates.updated_at = new Date().toISOString();

        const configId = await ensureConfigRow();
        const adminSupabase = createAdminClient();

        const { data: updated, error } = await adminSupabase
            .from("admin_config")
            .update(updates)
            .eq("id", configId)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ config: updated });
    } catch (error: any) {
        console.error("Error updating admin settings:", error);
        return NextResponse.json(
            { error: "Error interno", details: error?.message || "Unknown error" },
            { status: 500 }
        );
    }
}
