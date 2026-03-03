/**
 * ============================================
 * BASE PAYMENT PROVIDER - LaVaca
 * ============================================
 * Clase abstracta base que todos los proveedores deben extender
 */

import {
    IPaymentProvider,
    PaymentProvider,
    ProviderConfig,
    ProcessPaymentRequest,
    PaymentResult,
    WebhookEvent,
    RefundRequest,
    PaymentStatus,
    PaymentError,
    PaymentErrorCode,
} from './types';

export abstract class BasePaymentProvider implements IPaymentProvider {
    public readonly provider: PaymentProvider;
    public config: ProviderConfig;

    constructor(provider: PaymentProvider) {
        this.provider = provider;
        this.config = {
            provider,
            enabled: false,
            environment: 'sandbox',
        };
    }

    /**
     * Inicializa el proveedor con su configuración
     */
    async initialize(config: ProviderConfig): Promise<void> {
        const previousConfig = this.config;
        this.config = config;

        if (!this.validateConfig()) {
            this.config = previousConfig;
            throw new PaymentError(
                `Invalid configuration for ${this.provider}`,
                PaymentErrorCode.INVALID_CONFIG,
                this.provider
            );
        }

        await this.onInitialize();
    }

    /**
     * Hook para inicialización específica del proveedor
     */
    protected abstract onInitialize(): Promise<void>;

    /**
     * Crea una nueva sesión de pago
     */
    abstract createPayment(request: ProcessPaymentRequest): Promise<PaymentResult>;

    /**
     * Verifica el estado de un pago
     */
    abstract getPaymentStatus(transactionId: string): Promise<PaymentResult>;

    /**
     * Procesa un webhook del proveedor
     */
    abstract handleWebhook(event: WebhookEvent): Promise<PaymentResult>;

    /**
     * Procesa un reembolso
     */
    abstract refund(request: RefundRequest): Promise<PaymentResult>;

    /**
     * Valida la configuración del proveedor
     */
    validateConfig(): boolean {
        return this.config.enabled && !!this.config.environment;
    }

    /**
     * Helpers comunes
     */
    protected createSuccessResult(transactionId: string, externalId?: string): PaymentResult {
        return {
            success: true,
            transactionId,
            externalId,
            status: PaymentStatus.COMPLETED,
        };
    }

    protected createPendingResult(transactionId: string, externalId?: string): PaymentResult {
        return {
            success: true,
            transactionId,
            externalId,
            status: PaymentStatus.PENDING,
        };
    }

    protected createErrorResult(error: string, transactionId?: string): PaymentResult {
        return {
            success: false,
            transactionId,
            status: PaymentStatus.FAILED,
            error,
        };
    }

    protected async logTransaction(
        transactionId: string,
        status: PaymentStatus,
        metadata?: Record<string, any>
    ): Promise<void> {
        // Implementación para guardar en la base de datos
        console.log(`[${this.provider}] Transaction ${transactionId}: ${status}`, metadata);
    }
}
