// Formato de moneda compartido. Una sola fuente de verdad para que los montos
// se vean igual en toda la plataforma (separadores de miles incluidos), en
// lugar de mezclar `toFixed` (que da "$1234.5") con `Intl.NumberFormat`.

const usdFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const bsFormatter = new Intl.NumberFormat('es-VE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** Monto en dólares: `$1,234.50` */
export const formatUsd = (value: number | null | undefined) =>
  `$${usdFormatter.format(Number(value) || 0)}`

/** Monto en bolívares: `Bs 1.234,50` */
export const formatBs = (value: number | null | undefined) =>
  `Bs ${bsFormatter.format(Number(value) || 0)}`
