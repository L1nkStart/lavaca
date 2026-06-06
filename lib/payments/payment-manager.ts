/**
 * ============================================
 * PAYMENT MANAGER - LaVaca
 * ============================================
 * Gestor principal del sistema de pagos
 * Orquesta todos los proveedores y maneja la lógica de negocio
 */

import { createClient } from '@/lib/supabase/server';
import { PaymentFactory } from './payment-factory';
import { isTestMode } from './config';
import {
    PaymentProvider,
    ProcessPaymentRequest,
    PaymentResult,
    PaymentStatus,
    PaymentTransaction,
    WebhookEvent,
    RefundRequest,
    PaymentError,
    PaymentErrorCode,
} from './types';

export class PaymentManager {
    /**
     * Procesa un nuevo pago
     */
    static async processPayment(request: ProcessPaymentRequest): Promise<PaymentResult> {
        const supabase = await createClient();

        try {
            // 1. Validar el request
            this.validatePaymentRequest(request);

            // 2. Obtener el proveedor
            const provider = await PaymentFactory.getProvider(request.provider);

            // 3. Crear registro en la BD (solo si existe la tabla)
            let transaction: any = null;
            try {
                transaction = await this.createTransaction(request);
            } catch (error: any) {
                console.warn('⚠️ Payment transactions table not found, continuing without tracking');
            }

            // 4. Procesar el pago con el proveedor
            const result = await provider.createPayment(request);

            // 5. Actualizar el registro (solo si se creó)
            if (transaction) {
                try {
                    await this.updateTransaction(transaction.id, result);
                } catch (error) {
                    console.warn('Could not update transaction:', error);
                }
            }

            // 6. Si el pago se completó, actualizar la campaña
            if (result.status === PaymentStatus.COMPLETED) {
                try {
                    await this.updateCampaignAmount(request.metadata.campaignId, request.amount.usd);
                } catch (error: any) {
                    // En modo test, actualizar directamente
                    if (isTestMode()) {
                        console.log('💰 Test mode: Updating campaign amount directly');
                        await this.updateCampaignAmountDirect(request.metadata.campaignId, request.amount.usd);
                    } else {
                        throw error;
                    }
                }
            }

            return result;
        } catch (error) {
            console.error('Payment processing error:', error);

            if (error instanceof PaymentError) {
                throw error;
            }

            throw new PaymentError(
                'Failed to process payment',
                PaymentErrorCode.PROVIDER_ERROR,
                request.provider,
                { originalError: error }
            );
        }
    }

    /**
     * Verifica el estado de un pago
     */
    static async checkPaymentStatus(
        transactionId: string,
        provider: PaymentProvider
    ): Promise<PaymentResult> {
        try {
            const providerInstance = await PaymentFactory.getProvider(provider);
            const result = await providerInstance.getPaymentStatus(transactionId);

            // Actualizar en la BD
            await this.updateTransactionStatus(transactionId, result.status);

            return result;
        } catch (error) {
            console.error('Payment status check error:', error);
            throw error;
        }
    }

    /**
     * Procesa un webhook
     */
    static async handleWebhook(event: WebhookEvent): Promise<PaymentResult> {
        try {
            const provider = await PaymentFactory.getProvider(event.provider);
            const result = await provider.handleWebhook(event);

            // Actualizar transacción
            await this.updateTransactionStatus(event.transactionId, result.status);

            // Si se completó, actualizar la campaña
            if (result.status === PaymentStatus.COMPLETED && event.amount) {
                const transaction = await this.getTransaction(event.transactionId);
                if (transaction) {
                    await this.updateCampaignAmount(
                        transaction.donationId,
                        event.amount.usd
                    );
                }
            }

            return result;
        } catch (error) {
            console.error('Webhook handling error:', error);
            throw error;
        }
    }

    /**
     * Procesa un reembolso
     */
    static async refundPayment(request: RefundRequest): Promise<PaymentResult> {
        try {
            const transaction = await this.getTransaction(request.transactionId);
            if (!transaction) {
                throw new Error('Transaction not found');
            }

            const provider = await PaymentFactory.getProvider(transaction.provider);
            const result = await provider.refund(request);

            // Actualizar transacción
            await this.updateTransactionStatus(request.transactionId, PaymentStatus.REFUNDED);

            // Actualizar monto de la campaña
            if (result.success) {
                await this.updateCampaignAmount(
                    transaction.donationId,
                    -request.amount.usd // Restar el monto
                );
            }

            return result;
        } catch (error) {
            console.error('Refund error:', error);
            throw new PaymentError(
                'Failed to process refund',
                PaymentErrorCode.REFUND_FAILED,
                PaymentProvider.STRIPE, // Default, debería obtenerse de la transacción
                { originalError: error }
            );
        }
    }

    /**
     * Obtiene los métodos de pago disponibles
     */
    static getAvailablePaymentMethods(): Array<{
        provider: PaymentProvider;
        name: string;
        icon: string;
    }> {
        const enabledProviders = PaymentFactory.getEnabledProviders();

        const methodsMap: Record<PaymentProvider, { name: string; icon: string }> = {
            [PaymentProvider.STRIPE]: { name: 'Tarjeta de Crédito/Débito', icon: '💳' },
            [PaymentProvider.PAYPAL]: { name: 'PayPal', icon: '🅿️' },
            [PaymentProvider.BINANCE]: { name: 'Criptomonedas (Binance)', icon: '₿' },
            [PaymentProvider.ZELLE]: { name: 'Zelle', icon: '💵' },
            [PaymentProvider.PAGO_MOVIL]: { name: 'Pago Móvil', icon: '📱' },
            [PaymentProvider.BANCO_VENEZUELA]: { name: 'Banco de Venezuela', icon: '🏦' },
            [PaymentProvider.BANCO_MERCANTIL]: { name: 'Banco Mercantil', icon: '🏦' },
            [PaymentProvider.BANESCO]: { name: 'Banesco', icon: '🏦' },
            [PaymentProvider.BDV]: { name: 'Banco de Venezuela', icon: '🏦' },
        };

        return enabledProviders.map(provider => ({
            provider,
            ...methodsMap[provider],
        }));
    }

    // ============================================
    // MÉTODOS PRIVADOS - DATABASE OPERATIONS
    // ============================================

    private static validatePaymentRequest(request: ProcessPaymentRequest): void {
        if (!request.amount || request.amount.usd <= 0) {
            throw new PaymentError(
                'Invalid payment amount',
                PaymentErrorCode.INVALID_AMOUNT,
                request.provider
            );
        }

        if (!request.metadata.campaignId || !request.metadata.donorEmail) {
            throw new PaymentError(
                'Invalid payment metadata',
                PaymentErrorCode.INVALID_CONFIG,
                request.provider
            );
        }
    }

    private static async createTransaction(
        request: ProcessPaymentRequest
    ): Promise<PaymentTransaction> {
        const supabase = await createClient();

        const { data, error } = await supabase
            .from('payment_transactions')
            .insert({
                donation_id: request.metadata.donationId,
                provider: request.provider,
                status: PaymentStatus.PENDING,
                amount_usd: request.amount.usd,
                amount_bs: request.amount.bs,
                provider_data: request.providerSpecificData,
            })
            .select()
            .single();

        if (error) throw error;
        return data as any;
    }

    private static async updateTransaction(
        transactionId: string,
        result: PaymentResult
    ): Promise<void> {
        const supabase = await createClient();

        await supabase
            .from('payment_transactions')
            .update({
                status: result.status,
                external_id: result.externalId,
                error: result.error,
                updated_at: new Date().toISOString(),
            })
            .eq('id', transactionId);
    }

    private static async updateTransactionStatus(
        transactionId: string,
        status: PaymentStatus
    ): Promise<void> {
        const supabase = await createClient();

        await supabase
            .from('payment_transactions')
            .update({
                status,
                updated_at: new Date().toISOString(),
                ...(status === PaymentStatus.COMPLETED && {
                    completed_at: new Date().toISOString(),
                }),
            })
            .eq('id', transactionId);
    }

    private static async getTransaction(transactionId: string): Promise<PaymentTransaction | null> {
        const supabase = await createClient();

        const { data } = await supabase
            .from('payment_transactions')
            .select('*')
            .eq('id', transactionId)
            .single();

        return data as any;
    }

    private static async updateCampaignAmount(
        campaignId: string,
        amount: number
    ): Promise<void> {
        const supabase = await createClient();

        // Usar una función SQL para actualizar atómicamente
        await supabase.rpc('increment_campaign_amount', {
            campaign_id: campaignId,
            amount_to_add: amount,
        });
    }

    /**
     * Actualiza el monto de la campaña directamente (fallback para test)
     */
    private static async updateCampaignAmountDirect(
        campaignId: string,
        amount: number
    ): Promise<void> {
        const supabase = await createClient();

        const { data: campaign } = await supabase
            .from('campaigns')
            .select('current_amount_usd')
            .eq('id', campaignId)
            .single();

        if (campaign) {
            await supabase
                .from('campaigns')
                .update({
                    current_amount_usd: campaign.current_amount_usd + amount,
                })
                .eq('id', campaignId);
        }
    }
}
