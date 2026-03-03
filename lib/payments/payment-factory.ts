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
import { isTestMode } from './config';

// Importar proveedores cuando estén implementados
// import { StripeProvider } from './providers/stripe-provider';
// import { PayPalProvider } from './providers/paypal-provider';
// import { ZelleProvider } from './providers/zelle-provider';
// import { PagoMovilProvider } from './providers/pagomovil-provider';

export class PaymentFactory {
    private static providers = new Map<PaymentProvider, IPaymentProvider>();
    private static configs = new Map<PaymentProvider, ProviderConfig>();

    /**
     * Registra la configuración de un proveedor
     */
    static registerConfig(config: ProviderConfig): void {
        this.configs.set(config.provider, config);
    }

    /**
     * Registra múltiples configuraciones
     */
    static registerConfigs(configs: ProviderConfig[]): void {
        configs.forEach(config => this.registerConfig(config));
    }

    /**
     * Crea una instancia de un proveedor de pago
     */
    static async createProvider(provider: PaymentProvider): Promise<IPaymentProvider> {
        // Verificar si ya existe una instancia
        if (this.providers.has(provider)) {
            return this.providers.get(provider)!;
        }

        // Obtener configuración
        const config = this.configs.get(provider);
        if (!config) {
            throw new Error(`No configuration found for provider: ${provider}`);
        }

        if (!config.enabled) {
            throw new Error(`Provider ${provider} is not enabled`);
        }

        // Si estamos en modo test, usar MockProvider
        let providerInstance: IPaymentProvider;

        if (isTestMode()) {
            console.log(`🧪 Using Mock Provider for ${provider} (TEST MODE)`);
            providerInstance = new MockProvider(provider);
        } else {
            // Modo producción - usar proveedores reales
            switch (provider) {
                case PaymentProvider.STRIPE:
                    providerInstance = new StripeProvider();
                    break;

                case PaymentProvider.PAYPAL:
                    // providerInstance = new PayPalProvider();
                    throw new Error('PayPal provider not implemented yet');

                case PaymentProvider.BINANCE:
                    providerInstance = new BinanceProvider();
                    break;

                case PaymentProvider.ZELLE:
                    // providerInstance = new ZelleProvider();
                    throw new Error('Zelle provider not implemented yet');

                case PaymentProvider.PAGO_MOVIL:
                    // providerInstance = new PagoMovilProvider();
                    throw new Error('PagoMóvil provider not implemented yet');

                case PaymentProvider.BANCO_VENEZUELA:
                case PaymentProvider.BANCO_MERCANTIL:
                case PaymentProvider.BANESCO:
                case PaymentProvider.BDV:
                    // providerInstance = new BankTransferProvider(provider);
                    throw new Error(`Bank provider ${provider} not implemented yet`);

                default:
                    throw new Error(`Unknown payment provider: ${provider}`);
            }
        }

        // Inicializar el proveedor (ya sabemos que config no es undefined por el check anterior)
        await providerInstance.initialize(config!);

        // Guardar en caché
        this.providers.set(provider, providerInstance);

        return providerInstance;
    }

    /**
     * Obtiene una instancia existente o crea una nueva
     */
    static async getProvider(provider: PaymentProvider): Promise<IPaymentProvider> {
        return this.createProvider(provider);
    }

    /**
     * Obtiene todos los proveedores habilitados
     */
    static getEnabledProviders(): PaymentProvider[] {
        return Array.from(this.configs.values())
            .filter(config => config.enabled)
            .map(config => config.provider);
    }

    /**
     * Limpia el caché de proveedores
     */
    static clearCache(): void {
        this.providers.clear();
    }

    /**
     * Verifica si un proveedor está habilitado
     */
    static isProviderEnabled(provider: PaymentProvider): boolean {
        const config = this.configs.get(provider);
        return config?.enabled ?? false;
    }
}
