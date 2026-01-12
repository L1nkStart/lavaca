/**
 * ============================================
 * [PROVIDER NAME] PROVIDER - Template
 * ============================================
 * Template para crear nuevos proveedores de pago
 * 
 * INSTRUCCIONES:
 * 1. Copia este archivo y renómbralo (ej: stripe-provider.ts)
 * 2. Reemplaza [PROVIDER_NAME] con el nombre del proveedor
 * 3. Implementa cada método según la API del proveedor
 * 4. Registra el proveedor en payment-factory.ts
 */

import { BasePaymentProvider } from '../base-provider';
import {
    PaymentProvider,
    ProcessPaymentRequest,
    PaymentResult,
    WebhookEvent,
    RefundRequest,
    PaymentStatus,
    PaymentError,
    PaymentErrorCode,
} from '../types';

export class [PROVIDER_NAME]Provider extends BasePaymentProvider {
    // Instancia del cliente SDK (si aplica)
    private client: any = null;

    constructor() {
        super(PaymentProvider.[PROVIDER_NAME]);
    }

    /**
     * Inicializa el proveedor
     * - Valida credenciales
     * - Crea instancia del cliente
     * - Configura opciones
     */
    protected async onInitialize(): Promise < void> {
        // Ejemplo: Inicializar SDK
        // this.client = new ProviderSDK({
        //     apiKey: this.config.apiKey,
        //     apiSecret: this.config.apiSecret,
        //     environment: this.config.environment,
        // });

        console.log(`[${this.provider}] Provider initialized`);
    }

    /**
     * Crea una nueva sesión de pago
     * 
     * CASOS COMUNES:
     * - Checkout Session (Stripe, PayPal)
     * - Payment Intent (Stripe)
     * - Order Creation (Binance, PayPal)
     * - Manual Payment Request (Zelle, PagoMóvil)
     */
    async createPayment(request: ProcessPaymentRequest): Promise < PaymentResult > {
        try {
            // PASO 1: Validar request
            if(!this.client) {
        throw new Error('Provider not initialized');
    }

    // PASO 2: Preparar datos del pago
    const paymentData = {
        amount: request.amount.usd,
        currency: 'USD',
        description: `Donation to campaign ${request.metadata.campaignId}`,
        metadata: {
            campaignId: request.metadata.campaignId,
            donationId: request.metadata.donationId,
            donorEmail: request.metadata.donorEmail,
        },
        // URLs de retorno
        returnUrl: request.returnUrl,
        cancelUrl: request.cancelUrl,
    };

    // PASO 3: Crear pago con la API del proveedor
    // const response = await this.client.createPayment(paymentData);

    // PASO 4: Log de la transacción
    // await this.logTransaction(
    //     response.id,
    //     PaymentStatus.PENDING,
    //     { externalId: response.externalId }
    // );

    // PASO 5: Retornar resultado
    // return this.createPendingResult(response.id, response.externalId);

    // Placeholder mientras implementas
    throw new Error(`${this.provider} provider not implemented yet`);

} catch (error: any) {
    console.error(`[${this.provider}] Payment creation error:`, error);
    return this.createErrorResult(error.message);
}
    }

    /**
     * Verifica el estado de un pago
     * 
     * IMPORTANTE:
     * - Consulta la API del proveedor
     * - Mapea su status a nuestros PaymentStatus
     */
    async getPaymentStatus(transactionId: string): Promise < PaymentResult > {
    try {
        // Ejemplo: Consultar status
        // const payment = await this.client.getPayment(transactionId);

        // Mapear status del proveedor a nuestro enum
        // const ourStatus = this.mapProviderStatus(payment.status);

        // return {
        //     success: ourStatus === PaymentStatus.COMPLETED,
        //     transactionId,
        //     externalId: payment.externalId,
        //     status: ourStatus,
        // };

        throw new Error(`${this.provider} status check not implemented yet`);

    } catch(error: any) {
        console.error(`[${this.provider}] Status check error:`, error);
        return this.createErrorResult(error.message, transactionId);
    }
}

    /**
     * Procesa webhooks del proveedor
     * 
     * IMPORTANTE:
     * - Verifica firma del webhook
     * - Valida autenticidad
     * - Extrae datos relevantes
     */
    async handleWebhook(event: WebhookEvent): Promise < PaymentResult > {
    try {
        // PASO 1: Verificar firma del webhook
        // const isValid = await this.verifyWebhookSignature(event);
        // if (!isValid) {
        //     throw new PaymentError(
        //         'Invalid webhook signature',
        //         PaymentErrorCode.WEBHOOK_VALIDATION_FAILED,
        //         this.provider
        //     );
        // }

        // PASO 2: Parsear evento
        // const webhookData = JSON.parse(event.rawData);

        // PASO 3: Procesar según tipo de evento
        // switch (event.eventType) {
        //     case 'payment.completed':
        //         return this.createSuccessResult(event.transactionId);
        //     case 'payment.failed':
        //         return this.createErrorResult('Payment failed', event.transactionId);
        //     default:
        //         return this.createPendingResult(event.transactionId);
        // }

        throw new Error(`${this.provider} webhook handling not implemented yet`);

    } catch(error: any) {
        console.error(`[${this.provider}] Webhook error:`, error);
        throw error;
    }
}

    /**
     * Procesa un reembolso
     * 
     * IMPORTANTE:
     * - Algunos proveedores tienen límites de tiempo
     * - Otros requieren aprobación manual
     * - Guardar referencia del refund
     */
    async refund(request: RefundRequest): Promise < PaymentResult > {
    try {
        // Ejemplo: Procesar refund
        // const refund = await this.client.createRefund({
        //     paymentId: request.transactionId,
        //     amount: request.amount.usd,
        //     reason: request.reason,
        // });

        // await this.logTransaction(
        //     refund.id,
        //     PaymentStatus.REFUNDED,
        //     { originalTransaction: request.transactionId }
        // );

        // return this.createSuccessResult(refund.id);

        throw new Error(`${this.provider} refund not implemented yet`);

    } catch(error: any) {
        console.error(`[${this.provider}] Refund error:`, error);
        throw new PaymentError(
            `Refund failed: ${error.message}`,
            PaymentErrorCode.REFUND_FAILED,
            this.provider
        );
    }
}

/**
 * Valida la configuración del proveedor
 * 
 * PERSONALIZAR según las credenciales requeridas
 */
validateConfig(): boolean {
    const baseValid = super.validateConfig();
    const hasApiKey = !!this.config.apiKey;
    // Agregar más validaciones según sea necesario
    // const hasSecret = !!this.config.apiSecret;

    return baseValid && hasApiKey;
}

    // ============================================
    // MÉTODOS AUXILIARES PRIVADOS
    // ============================================

    /**
     * Mapea el status del proveedor a nuestro enum
     */
    private mapProviderStatus(providerStatus: string): PaymentStatus {
    // Ejemplo para Stripe
    const statusMap: Record<string, PaymentStatus> = {
        'succeeded': PaymentStatus.COMPLETED,
        'processing': PaymentStatus.PROCESSING,
        'requires_action': PaymentStatus.PENDING,
        'canceled': PaymentStatus.CANCELLED,
        'failed': PaymentStatus.FAILED,
    };

    return statusMap[providerStatus] || PaymentStatus.PENDING;
}

    /**
     * Verifica la firma de un webhook (si aplica)
     */
    private async verifyWebhookSignature(event: WebhookEvent): Promise < boolean > {
    // Implementar según el proveedor
    // Ejemplo Stripe:
    // const signature = event.headers['stripe-signature'];
    // return stripe.webhooks.verifySignature(event.rawData, signature);

    return true; // Placeholder
}
}

/**
 * ============================================
 * CHECKLIST DE IMPLEMENTACIÓN
 * ============================================
 * 
 * [ ] 1. Instalar SDK del proveedor (npm install [provider-sdk])
 * [ ] 2. Obtener credenciales de prueba (sandbox)
 * [ ] 3. Configurar variables de entorno
 * [ ] 4. Implementar onInitialize()
 * [ ] 5. Implementar createPayment()
 * [ ] 6. Implementar getPaymentStatus()
 * [ ] 7. Implementar handleWebhook()
 * [ ] 8. Implementar refund()
 * [ ] 9. Configurar webhook URL en dashboard del proveedor
 * [ ] 10. Registrar en PaymentFactory
 * [ ] 11. Agregar tests
 * [ ] 12. Probar en sandbox
 * [ ] 13. Obtener credenciales de producción
 * [ ] 14. Deploy y monitoreo
 */
