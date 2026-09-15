/**
 * Datos y validadores específicos de Venezuela compartidos por los
 * formularios de cuentas (recibir pagos directos, PagoMóvil, transferencias).
 * Una sola fuente de verdad para que el creador y el donante vean los mismos
 * nombres de banco y los mismos formatos.
 */

export interface VeBank {
    code: string
    name: string
}

/** Bancos venezolanos (código SUDEBAN - nombre corto). Orden por uso común. */
export const VE_BANKS: VeBank[] = [
    { code: '0102', name: 'Banco de Venezuela' },
    { code: '0134', name: 'Banesco' },
    { code: '0105', name: 'Mercantil' },
    { code: '0108', name: 'Provincial' },
    { code: '0191', name: 'BNC Banco Nacional de Crédito' },
    { code: '0114', name: 'Bancaribe' },
    { code: '0115', name: 'Banco Exterior' },
    { code: '0175', name: 'Banco Bicentenario' },
    { code: '0163', name: 'Banco del Tesoro' },
    { code: '0172', name: 'Bancamiga' },
    { code: '0174', name: 'Banplus' },
    { code: '0138', name: 'Banco Plaza' },
    { code: '0104', name: 'Venezolano de Crédito' },
    { code: '0128', name: 'Banco Caroní' },
    { code: '0137', name: 'Sofitasa' },
    { code: '0151', name: 'BFC Banco Fondo Común' },
    { code: '0156', name: '100% Banco' },
    { code: '0157', name: 'DelSur' },
    { code: '0168', name: 'Bancrecer' },
    { code: '0169', name: 'Mi Banco' },
    { code: '0171', name: 'Banco Activo' },
    { code: '0177', name: 'Banfanb' },
    { code: '0166', name: 'Banco Agrícola de Venezuela' },
]

export const bankNameByCode = (code: string | null | undefined) =>
    VE_BANKS.find((b) => b.code === code)?.name || null

/** "0102 - Banco de Venezuela" a partir del código; si no hay código devuelve el texto original. */
export const bankLabel = (code: string | null | undefined, fallbackName?: string | null) => {
    const name = bankNameByCode(code)
    if (name && code) return `${code} - ${name}`
    return fallbackName || code || ''
}

export const CEDULA_PREFIXES = ['V', 'E', 'J', 'G', 'P'] as const
export type CedulaPrefix = (typeof CEDULA_PREFIXES)[number]

/** Teléfono móvil venezolano: 04XX + 7 dígitos (11 dígitos). */
export const VE_PHONE_REGEX = /^04\d{9}$/
/** Cédula/RIF: solo dígitos, 6 a 9. */
export const CEDULA_DIGITS_REGEX = /^\d{6,9}$/
/** Número de cuenta bancaria venezolano: 20 dígitos. */
export const VE_ACCOUNT_REGEX = /^\d{20}$/
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Deja solo dígitos. Acepta "+58 412-1234567" → "04121234567". */
export function normalizeVePhone(raw: string): string {
    let digits = (raw || '').replace(/\D/g, '')
    if (digits.startsWith('58') && digits.length === 12) digits = `0${digits.slice(2)}`
    if (digits.length === 10 && digits.startsWith('4')) digits = `0${digits}`
    return digits
}

/** "v12345678" / "V-12.345.678" → { prefix: 'V', digits: '12345678' }. */
export function splitCedula(raw: string): { prefix: CedulaPrefix; digits: string } {
    const cleaned = (raw || '').trim().toUpperCase()
    const match = cleaned.match(/^([VEJGP])?[-.\s]*([\d.]*)$/)
    const prefix = (match?.[1] as CedulaPrefix) || 'V'
    const digits = (match?.[2] || cleaned).replace(/\D/g, '')
    return { prefix, digits }
}

export const formatCedula = (prefix: string, digits: string) => (digits ? `${prefix}-${digits}` : '')

/** Formato legible "0412-1234567" para mostrar (el valor guardado sigue siendo solo dígitos). */
export function prettyVePhone(phone: string | null | undefined): string {
    const d = normalizeVePhone(phone || '')
    if (d.length !== 11) return phone || ''
    return `${d.slice(0, 4)}-${d.slice(4)}`
}

/** Redes cripto más usadas en Venezuela para recibir USDT. */
export const CRYPTO_NETWORKS = [
    { value: 'USDT (TRC20)', label: 'USDT · Tron (TRC20)' },
    { value: 'USDT (BEP20)', label: 'USDT · BNB Smart Chain (BEP20)' },
    { value: 'Binance Pay', label: 'Binance Pay (ID o correo)' },
    { value: 'USDT (ERC20)', label: 'USDT · Ethereum (ERC20)' },
    { value: 'BTC', label: 'Bitcoin (BTC)' },
]

/* ------------------------------------------------------------------ */
/* Cuentas para recibir pagos directos (campaign_crisis_accounts)      */
/* ------------------------------------------------------------------ */

export type ReceivingAccountType = 'pagomovil' | 'zelle' | 'transfer' | 'crypto'

export const RECEIVING_ACCOUNT_TYPES: {
    value: ReceivingAccountType
    label: string
    hint: string
    emoji: string
}[] = [
    { value: 'pagomovil', label: 'PagoMóvil', hint: 'Bolívares · el más usado', emoji: '📱' },
    { value: 'zelle', label: 'Zelle', hint: 'Dólares desde EE. UU.', emoji: '💵' },
    { value: 'transfer', label: 'Transferencia', hint: 'Cuenta bancaria en Bs', emoji: '🏦' },
    { value: 'crypto', label: 'Cripto / Binance', hint: 'USDT y Binance Pay', emoji: '₿' },
]

export const RECEIVING_ACCOUNT_LABEL: Record<ReceivingAccountType, string> = {
    pagomovil: 'PagoMóvil',
    zelle: 'Zelle',
    transfer: 'Transferencia bancaria',
    crypto: 'Cripto / Binance',
}

/** Payload que acepta POST /api/campaigns/[id]/crisis-accounts. */
export interface ReceivingAccountInput {
    account_type: ReceivingAccountType
    account_holder_name: string
    phone_number?: string | null
    ci_number?: string | null
    bank_name?: string | null
    bank_code?: string | null
    email?: string | null
    account_number?: string | null
    crypto_wallet_address?: string | null
    crypto_network?: string | null
    instructions?: string | null
}

/** Valida un payload de cuenta. Devuelve un mapa campo → mensaje (vacío si es válida). */
export function validateReceivingAccount(a: ReceivingAccountInput): Record<string, string> {
    const errs: Record<string, string> = {}
    if (!a.account_holder_name || a.account_holder_name.trim().length < 2) {
        errs.account_holder_name = 'Escribe el nombre del titular tal como aparece en el banco'
    }
    switch (a.account_type) {
        case 'pagomovil': {
            if (!a.bank_code && !a.bank_name) errs.bank_code = 'Selecciona el banco'
            if (!VE_PHONE_REGEX.test(normalizeVePhone(a.phone_number || ''))) {
                errs.phone_number = 'Teléfono de 11 dígitos, ej: 04121234567'
            }
            const { digits } = splitCedula(a.ci_number || '')
            if (!CEDULA_DIGITS_REGEX.test(digits)) errs.ci_number = 'Cédula de 6 a 9 dígitos'
            break
        }
        case 'zelle': {
            // Zelle se registra con correo o con teléfono (de EE. UU. casi siempre).
            const v = (a.email || '').trim()
            const digits = v.replace(/\D/g, '')
            const looksLikePhone = digits.length >= 10 && digits.length <= 12 && /^[\d\s()+.-]+$/.test(v)
            if (!EMAIL_REGEX.test(v) && !looksLikePhone) {
                errs.email = 'Correo o teléfono registrado en Zelle'
            }
            break
        }
        case 'transfer': {
            if (!a.bank_code && !a.bank_name) errs.bank_code = 'Selecciona el banco'
            const acct = (a.account_number || '').replace(/\D/g, '')
            if (!VE_ACCOUNT_REGEX.test(acct)) errs.account_number = 'La cuenta tiene 20 dígitos'
            const { digits } = splitCedula(a.ci_number || '')
            if (a.ci_number && !CEDULA_DIGITS_REGEX.test(digits)) errs.ci_number = 'Cédula de 6 a 9 dígitos'
            break
        }
        case 'crypto': {
            if (!a.crypto_network) errs.crypto_network = 'Selecciona la red'
            if (!a.crypto_wallet_address || a.crypto_wallet_address.trim().length < 6) {
                errs.crypto_wallet_address = 'Pega la dirección de la wallet o tu ID de Binance Pay'
            }
            break
        }
    }
    return errs
}

/**
 * Líneas "etiqueta: valor" para mostrar una cuenta (al creador en su lista y
 * al donante al pagar). Solo incluye los campos con valor.
 */
export function receivingAccountLines(a: ReceivingAccountInput): { label: string; value: string }[] {
    const holder = { label: 'Titular', value: a.account_holder_name }
    switch (a.account_type) {
        case 'pagomovil':
            return [
                { label: 'Banco', value: bankLabel(a.bank_code, a.bank_name) },
                { label: 'Teléfono', value: prettyVePhone(a.phone_number) },
                { label: 'Cédula', value: a.ci_number || '' },
                holder,
            ].filter((l) => l.value)
        case 'zelle':
            return [{ label: 'Zelle', value: a.email || '' }, holder].filter((l) => l.value)
        case 'transfer':
            return [
                { label: 'Banco', value: bankLabel(a.bank_code, a.bank_name) },
                { label: 'Cuenta', value: a.account_number || '' },
                { label: 'Cédula / RIF', value: a.ci_number || '' },
                holder,
            ].filter((l) => l.value)
        case 'crypto':
            return [
                { label: 'Red', value: a.crypto_network || '' },
                { label: 'Wallet', value: a.crypto_wallet_address || '' },
                holder,
            ].filter((l) => l.value)
    }
}

/** Resumen en una línea: "Banesco · 0412-1234567 · V-12345678". */
export const receivingAccountSummary = (a: ReceivingAccountInput) =>
    receivingAccountLines(a)
        .filter((l) => l.label !== 'Titular')
        .map((l) => l.value)
        .join(' · ')

/** Texto listo para pegar en WhatsApp con todos los datos de la cuenta. */
export function receivingAccountClipboardText(a: ReceivingAccountInput): string {
    const head = RECEIVING_ACCOUNT_LABEL[a.account_type]
    const body = receivingAccountLines(a).map((l) => `${l.label}: ${l.value}`).join('\n')
    return `${head}\n${body}`
}
