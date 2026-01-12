/**
 * ============================================
 * MOCK PROVIDER - LaVaca
 * ============================================
 * Proveedor simulado para pruebas sin APIs reales
 * Autoconfirma todos los pagos instantáneamente
 */

import { BasePaymentProvider } from '../base-provider';
import {
    PaymentProvider,
    ProcessPaymentRequest,
    PaymentResult,
    WebhookEvent,
    RefundRequest,
    PaymentStatus,
} from '../types';

export class MockProvider extends BasePaymentProvider {
    constructor(provider: PaymentProvider) {
        super(provider);
    }

    protected async onInitialize(): Promise<void> {
        console.log(`[${this.provider}] Mock Provider initialized - TEST MODE`);
    }

    async createPayment(request: ProcessPaymentRequest): Promise<PaymentResult> {
        console.log(`[${this.provider}] Mock payment created:`, {
            amount: request.amount,
            campaign: request.metadata.campaignId,
        });

        // Simular delay de procesamiento
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Generar ID simulado
        const mockId = `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Auto-completar el pago
        await this.logTransaction(mockId, PaymentStatus.COMPLETED, {
            provider: this.provider,
            testMode: true,
            autoCompleted: true,
        });

        return this.createSuccessResult(mockId, mockId);
    }

    async getPaymentStatus(transactionId: string): Promise<PaymentResult> {
        console.log(`[${this.provider}] Mock status check:`, transactionId);

        return this.createSuccessResult(transactionId, transactionId);
    }

    async handleWebhook(event: WebhookEvent): Promise<PaymentResult> {
        console.log(`[${this.provider}] Mock webhook received:`, event.eventType);

        return this.createSuccessResult(event.transactionId);
    }

    async refund(request: RefundRequest): Promise<PaymentResult> {
        console.log(`[${this.provider}] Mock refund:`, request.amount);

        await new Promise(resolve => setTimeout(resolve, 500));

        const refundId = `refund_${Date.now()}`;
        return this.createSuccessResult(refundId);
    }

    validateConfig(): boolean {
        return true; // Mock siempre es válido
    }
}
