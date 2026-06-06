/**
 * ============================================
 * PAYMENT CONFIGURATION - LaVaca
 * ============================================
 * Configuración centralizada del sistema de pagos
 */

import { PaymentFactory } from './payment-factory';
import { PaymentProvider, ProviderConfig } from './types';

/**
 * Modo de pagos: 'test' o 'production'
 * En modo test, todos los pagos se auto-confirman sin APIs reales
 */
export const PAYMENT_MODE = (process.env.NEXT_PUBLIC_PAYMENT_MODE || 'test') as 'test' | 'production';

/**
 * Verifica si estamos en modo de pruebas
 */
export const isTestMode = () => PAYMENT_MODE === 'test';

/**
 * Indica si el proveedor tiene credenciales reales configuradas.
 * En modo test esto siempre es true (el MockProvider se hace cargo).
 */
function hasCredentials(...keys: Array<string | undefined>): boolean {
    return keys.every((value) => typeof value === 'string' && value.length > 0);
}

/**
 * Inicializa el sistema de pagos con todas las configuraciones
 */
export function initializePayments() {
    const configs: ProviderConfig[] = [];

    // ============================================
    // STRIPE
    // ============================================
    if (isTestMode() || hasCredentials(process.env.STRIPE_SECRET_KEY)) {
        configs.push({
            provider: PaymentProvider.STRIPE,
            enabled: true,
            apiKey: process.env.STRIPE_SECRET_KEY,
            publicKey: process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY,
            webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
            environment: isTestMode() ? 'sandbox' : 'production',
        });
    }

    // ============================================
    // PAYPAL
    // ============================================
    if (
        isTestMode() ||
        hasCredentials(process.env.PAYPAL_CLIENT_ID, process.env.PAYPAL_CLIENT_SECRET)
    ) {
        configs.push({
            provider: PaymentProvider.PAYPAL,
            enabled: true,
            apiKey: process.env.PAYPAL_CLIENT_ID,
            apiSecret: process.env.PAYPAL_CLIENT_SECRET,
            environment: isTestMode() ? 'sandbox' : 'production',
            customConfig: {
                baseUrl: process.env.PAYPAL_BASE_URL,
                webhookId: process.env.PAYPAL_WEBHOOK_ID,
            },
        });
    }

    // ============================================
    // BINANCE PAY
    // ============================================
    if (
        isTestMode() ||
        hasCredentials(
            process.env.BINANCE_API_KEY,
            process.env.BINANCE_API_SECRET,
            process.env.BINANCE_PAY_CERT_SN,
        )
    ) {
        configs.push({
            provider: PaymentProvider.BINANCE,
            enabled: true,
            apiKey: process.env.BINANCE_API_KEY,
            apiSecret: process.env.BINANCE_API_SECRET,
            environment: isTestMode() ? 'sandbox' : 'production',
            customConfig: {
                certificateSn: process.env.BINANCE_PAY_CERT_SN,
                baseUrl: process.env.BINANCE_PAY_BASE_URL || 'https://bpay.binanceapi.com',
            },
        });
    }

    // ============================================
    // CHINCHIN (Venezuela C2P)
    // ============================================
    if (
        isTestMode() ||
        hasCredentials(
            process.env.CHINCHIN_API_KEY,
            process.env.CHINCHIN_API_SECRET,
            process.env.CHINCHIN_MERCHANT_ID,
        )
    ) {
        configs.push({
            provider: PaymentProvider.CHINCHIN,
            enabled: true,
            apiKey: process.env.CHINCHIN_API_KEY,
            apiSecret: process.env.CHINCHIN_API_SECRET,
            webhookSecret: process.env.CHINCHIN_WEBHOOK_SECRET,
            environment: isTestMode() ? 'sandbox' : 'production',
            customConfig: {
                merchantId: process.env.CHINCHIN_MERCHANT_ID,
                baseUrl: process.env.CHINCHIN_BASE_URL || 'https://api.chinchin.app',
            },
        });
    }

    // ============================================
    // ZELLE (Manual - siempre habilitado)
    // ============================================
    configs.push({
        provider: PaymentProvider.ZELLE,
        enabled: true,
        environment: isTestMode() ? 'sandbox' : 'production',
        customConfig: {
            email: process.env.ZELLE_EMAIL || 'donations@lavaca.app',
            phone: process.env.ZELLE_PHONE || '+58424123456',
        },
    });

    // ============================================
    // PAGO MÓVIL (Manual por ahora)
    // ============================================
    configs.push({
        provider: PaymentProvider.PAGO_MOVIL,
        enabled: true,
        environment: isTestMode() ? 'sandbox' : 'production',
        customConfig: {
            bankCode: process.env.PAGOMOVIL_BANK_CODE || '0134',
            phone: process.env.PAGOMOVIL_PHONE || '04241234567',
            cedula: process.env.PAGOMOVIL_CEDULA || 'V12345678',
        },
    });

    // ============================================
    // BANCOS VENEZOLANOS (Manual)
    // ============================================
    const venezuelanBanks = [
        PaymentProvider.BANCO_VENEZUELA,
        PaymentProvider.BANCO_MERCANTIL,
        PaymentProvider.BANESCO,
        PaymentProvider.BDV,
    ];

    venezuelanBanks.forEach(bank => {
        configs.push({
            provider: bank,
            enabled: true,
            environment: isTestMode() ? 'sandbox' : 'production',
        });
    });

    // Registrar todas las configuraciones
    PaymentFactory.registerConfigs(configs);

    console.log(`💳 Payment system initialized in ${PAYMENT_MODE.toUpperCase()} mode`);
    console.log(`✅ ${configs.length} payment providers configured`);

    if (isTestMode()) {
        console.warn('⚠️ PAYMENT TEST MODE: All payments will be auto-confirmed without real APIs');
    }
}

/**
 * Obtiene la configuración de un proveedor específico
 */
export function getProviderConfig(_provider: PaymentProvider): ProviderConfig | null {
    return null;
}
