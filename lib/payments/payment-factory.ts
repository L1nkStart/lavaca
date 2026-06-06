/**
 * ============================================
 * PAYMENT FACTORY - LaVaca
 * ============================================
 * Factory pattern para crear instancias de proveedores de pago
 */

import { PaymentProvider, IPaymentProvider, ProviderConfig } from './types';
import { MockProvider } from './providers/mock-provider';
import { StripeProvider } from './providers/stripe-provider';
import { BinanceProvider } from './providers/binance-provider';
import { PaypalProvider } from './providers/paypal-provider';
import { ChinchinProvider } from './providers/chinchin-provider';
import { isTestMode } from './config';

/**
 * Marca los proveedores que aún no tienen integración automatizada real.
 * Si el proveedor está marcado como "manual", se trata como un flujo de
 * reporte (el donante paga por fuera y la plataforma confirma a mano).
 */
const MANUAL_ONLY_PROVIDERS = new Set<PaymentProvider>([
    PaymentProvider.ZELLE,
    PaymentProvider.PAGO_MOVIL,
    PaymentProvider.BANCO_VENEZUELA,
    PaymentProvider.BANCO_MERCANTIL,
    PaymentProvider.BANESCO,
    PaymentProvider.BDV,
]);

export class PaymentFactory {
    private static providers = new Map<PaymentProvider, IPaymentProvider>();
    private static configs = new Map<PaymentProvider, ProviderConfig>();

    static registerConfig(config: ProviderConfig): void {
        this.configs.set(config.provider, config);
    }

    static registerConfigs(configs: ProviderConfig[]): void {
        configs.forEach(config => this.registerConfig(config));
    }

    /**
     * Devuelve true si el proveedor sólo se usa para reportes manuales
     * (Zelle, PagoMóvil sin C2P, transferencias bancarias).
     */
    static isManualOnly(provider: PaymentProvider): boolean {
        return MANUAL_ONLY_PROVIDERS.has(provider);
    }

    /**
     * Crea una instancia de un proveedor de pago
     */
    static async createProvider(provider: PaymentProvider): Promise<IPaymentProvider> {
        if (this.providers.has(provider)) {
            return this.providers.get(provider)!;
        }

        const config = this.configs.get(provider);
        if (!config) {
            throw new Error(`No configuration found for provider: ${provider}`);
        }

        if (!config.enabled) {
            throw new Error(`Provider ${provider} is not enabled`);
        }

        let providerInstance: IPaymentProvider;

        if (isTestMode()) {
            console.log(`🧪 Using Mock Provider for ${provider} (TEST MODE)`);
            providerInstance = new MockProvider(provider);
        } else {
            // Producción: usar proveedores reales.
            switch (provider) {
                case PaymentProvider.STRIPE:
                    providerInstance = new StripeProvider();
                    break;

                case PaymentProvider.PAYPAL:
                    providerInstance = new PaypalProvider();
                    break;

                case PaymentProvider.BINANCE:
                    providerInstance = new BinanceProvider();
                    break;

                case PaymentProvider.CHINCHIN:
                    providerInstance = new ChinchinProvider();
                    break;

                case PaymentProvider.ZELLE:
                case PaymentProvider.PAGO_MOVIL:
                case PaymentProvider.BANCO_VENEZUELA:
                case PaymentProvider.BANCO_MERCANTIL:
                case PaymentProvider.BANESCO:
                case PaymentProvider.BDV:
                    // Estos métodos son manuales: el flujo se confirma desde
                    // el panel de admin, no por API del proveedor. Devolvemos
                    // un mock para que la transacción quede registrada como
                    // pendiente sin romper el checkout.
                    console.log(
                        `📝 Provider ${provider} es manual: se usa MockProvider y la confirmación se hace desde /admin/payments`,
                    );
                    providerInstance = new MockProvider(provider);
                    break;

                default:
                    throw new Error(`Unknown payment provider: ${provider}`);
            }
        }

        await providerInstance.initialize(config!);
        this.providers.set(provider, providerInstance);

        return providerInstance;
    }

    static async getProvider(provider: PaymentProvider): Promise<IPaymentProvider> {
        return this.createProvider(provider);
    }

    static getEnabledProviders(): PaymentProvider[] {
        return Array.from(this.configs.values())
            .filter(config => config.enabled)
            .map(config => config.provider);
    }

    static clearCache(): void {
        this.providers.clear();
    }

    static isProviderEnabled(provider: PaymentProvider): boolean {
        const config = this.configs.get(provider);
        return config?.enabled ?? false;
    }
}
