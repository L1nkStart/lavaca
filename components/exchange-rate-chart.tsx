'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts'
import { formatUsd } from '@/lib/format'

type RatePoint = {
    date: string
    rate: number
}

type ExchangeRateChartProps = {
    points: RatePoint[]
    /** Pérdida cambiaria acumulada del creador (para el subtítulo) */
    fxLossTotal?: number
}

export function ExchangeRateChart({ points, fxLossTotal = 0 }: ExchangeRateChartProps) {
    if (points.length < 2) return null

    const first = points[0]?.rate || 0
    const last = points[points.length - 1]?.rate || 0
    const variation = first > 0 ? ((last - first) / first) * 100 : 0

    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-base">Evolución de la tasa Bs/USD</CardTitle>
                <CardDescription>
                    {variation > 0.01
                        ? `La tasa subió ${variation.toFixed(1)}% en este período — mientras más rápido retires tus bolívares, menos valor pierdes.`
                        : 'La tasa se ha mantenido estable en este período.'}
                    {fxLossTotal > 0.005 && (
                        <> Tu pérdida cambiaria acumulada: <strong className="text-destructive">−{formatUsd(fxLossTotal)}</strong>.</>
                    )}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                            <XAxis
                                dataKey="date"
                                tick={{ fontSize: 11 }}
                                tickLine={false}
                                axisLine={false}
                                minTickGap={32}
                            />
                            <YAxis
                                tick={{ fontSize: 11 }}
                                tickLine={false}
                                axisLine={false}
                                width={56}
                                domain={['auto', 'auto']}
                                tickFormatter={(value: number) => `Bs ${Math.round(value)}`}
                            />
                            <Tooltip
                                formatter={(value) => [`Bs ${Number(value).toFixed(2)} por USD`, 'Tasa']}
                                labelFormatter={(label) => `Fecha: ${label}`}
                            />
                            <Line
                                type="monotone"
                                dataKey="rate"
                                stroke="var(--primary, #0c5b57)"
                                strokeWidth={2}
                                dot={false}
                                activeDot={{ r: 4 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    )
}
