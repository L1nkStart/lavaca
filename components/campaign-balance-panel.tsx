'use client'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { RequestWithdrawalDialog } from '@/components/request-withdrawal-dialog'
import { Banknote, DollarSign, Download, Info, TrendingDown } from 'lucide-react'

type BalancesSnapshot = {
    saldo_bs: number
    saldo_usd: number
    pending_bs: number
    pending_usd: number
    has_pending_bs: boolean
    has_pending_usd: boolean
    bs_indexed_usd: number
    fx_loss_unrealized: number
    fx_loss_realized: number
    fx_loss_total: number
    current_rate: number
    last_bs_donation_at: string | null
    last_bs_withdrawal_at: string | null
}

type WithdrawalAccountOption = {
    id: string
    account_type: string
    account_holder_name: string
    is_primary: boolean
    verified: boolean
}

type CampaignBalancePanelProps = {
    campaignId: string
    campaignTitle: string
    balances: BalancesSnapshot
    accounts: WithdrawalAccountOption[]
    minimums: { minUsd: number; minBs: number }
    /** Umbral USD del saldo Bs a partir del cual se sugiere retirar */
    inflationAlertThresholdUsd?: number
    /** Días sin movimiento Bs a partir de los cuales se sugiere retirar */
    inflationAlertDays?: number
}

const formatBs = (value: number) =>
    `Bs ${new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0)}`

const formatUsd = (value: number) =>
    `$${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0)}`

function daysSinceLastBsMovement(balances: BalancesSnapshot): number | null {
    const reference = balances.last_bs_withdrawal_at || balances.last_bs_donation_at
    if (!reference) return null
    const elapsedMs = Date.now() - new Date(reference).getTime()
    if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return null
    return Math.floor(elapsedMs / (24 * 60 * 60 * 1000))
}

export function CampaignBalancePanel({
    campaignId,
    campaignTitle,
    balances,
    accounts,
    minimums,
    inflationAlertThresholdUsd = 50,
    inflationAlertDays = 7,
}: CampaignBalancePanelProps) {
    const hasFxLoss = balances.fx_loss_total > 0.005
    const idleDays = daysSinceLastBsMovement(balances)

    // P1 - Alerta anti-inflación: saldo Bs significativo o demasiados días parado
    const bsValueInUsd = balances.current_rate > 0 ? balances.saldo_bs / balances.current_rate : 0
    const showInflationAlert =
        balances.saldo_bs > 0 &&
        !balances.has_pending_bs &&
        (bsValueInUsd >= inflationAlertThresholdUsd || (idleDays !== null && idleDays >= inflationAlertDays))

    return (
        <div className="space-y-3">
            {showInflationAlert && (
                <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800">
                    <TrendingDown className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <AlertDescription className="text-amber-900 dark:text-amber-100 text-sm">
                        <strong>Protege tu recaudación:</strong> tienes {formatBs(balances.saldo_bs)} sin retirar
                        {idleDays !== null && idleDays >= inflationAlertDays ? ` desde hace ${idleDays} días` : ''}.
                        Te recomendamos retirarlos pronto para reducir la pérdida de valor por la variación de la tasa.
                    </AlertDescription>
                </Alert>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Saldo en Bolívares */}
                <div className="rounded-lg border p-4 space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Banknote className="h-4 w-4 text-primary" />
                        Saldo en Bolívares
                    </div>
                    <p className="text-2xl font-bold">{formatBs(balances.saldo_bs)}</p>

                    <div className="space-y-1 text-xs text-muted-foreground">
                        {balances.pending_bs > 0 && (
                            <p>Reservado en retiros: {formatBs(balances.pending_bs)}</p>
                        )}
                        {hasFxLoss && (
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <p className="flex items-center gap-1 cursor-help text-destructive">
                                            Pérdida cambiaria: −{formatUsd(balances.fx_loss_total)}
                                            <Info className="h-3 w-3" />
                                        </p>
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-xs text-xs leading-relaxed">
                                        <p className="font-semibold mb-1">¿Qué es la pérdida cambiaria?</p>
                                        <p>
                                            Tus bolívares valen menos dólares hoy que el día en que los recibiste,
                                            porque la tasa subió. Realizada (−{formatUsd(balances.fx_loss_realized)}):
                                            ya ocurrió en retiros pasados. No realizada (−{formatUsd(balances.fx_loss_unrealized)}):
                                            la del saldo que aún no retiras; puedes reducirla retirando pronto.
                                        </p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        )}
                        {balances.saldo_bs > 0 && balances.current_rate > 0 && (
                            <p>≈ {formatUsd(bsValueInUsd)} a la tasa de hoy</p>
                        )}
                    </div>

                    <RequestWithdrawalDialog
                        campaignId={campaignId}
                        campaignTitle={campaignTitle}
                        balances={balances}
                        accounts={accounts}
                        minimums={minimums}
                        initialCurrency="BS"
                        triggerLabel={balances.has_pending_bs ? 'Retiro Bs en revisión' : 'Retirar bolívares'}
                        triggerClassName="w-full"
                    />
                </div>

                {/* Saldo en Dólares */}
                <div className="rounded-lg border p-4 space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <DollarSign className="h-4 w-4 text-primary" />
                        Saldo en Dólares
                    </div>
                    <p className="text-2xl font-bold">{formatUsd(balances.saldo_usd)}</p>

                    <div className="space-y-1 text-xs text-muted-foreground">
                        {balances.pending_usd > 0 && (
                            <p>Reservado en retiros: {formatUsd(balances.pending_usd)}</p>
                        )}
                        <p>Zelle, tarjeta, PayPal y cripto</p>
                    </div>

                    <RequestWithdrawalDialog
                        campaignId={campaignId}
                        campaignTitle={campaignTitle}
                        balances={balances}
                        accounts={accounts}
                        minimums={minimums}
                        initialCurrency="USD"
                        triggerLabel={balances.has_pending_usd ? 'Retiro USD en revisión' : 'Retirar dólares'}
                        triggerClassName="w-full"
                    />
                </div>
            </div>

            {/* Exportación contable (CSV) */}
            <div className="flex flex-wrap gap-3 text-xs">
                <a
                    href={`/api/campaigns/${campaignId}/export?type=donations`}
                    className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                >
                    <Download className="h-3 w-3" />
                    Exportar donaciones (CSV)
                </a>
                <a
                    href={`/api/campaigns/${campaignId}/export?type=withdrawals`}
                    className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                >
                    <Download className="h-3 w-3" />
                    Exportar retiros (CSV)
                </a>
            </div>
        </div>
    )
}
