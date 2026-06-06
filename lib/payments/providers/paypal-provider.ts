import { BasePaymentProvider } from "../base-provider";
import {
    PaymentProvider,
    ProcessPaymentRequest,
    PaymentResult,
    WebhookEvent,
    RefundRequest,
    PaymentStatus,
    PaymentError,
    PaymentErrorCode,
} from "../types";

/**
 * ============================================================================
 * PAYPAL PROVIDER (STUB)
 * ============================================================================
 *
 * Implementación basada en PayPal Orders API v2 (REST).
 * https://developer.paypal.com/docs/api/orders/v2/
 *
 * Para activarlo:
 *   1. Crear una app en https://developer.paypal.com/dashboard/applications
 *      y obtener Client ID + Client Secret.
 *   2. Configurar en `.env`:
 *        PAYPAL_CLIENT_ID
 *        PAYPAL_CLIENT_SECRET
 *        PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com  (sandbox)
 *          o https://api-m.paypal.com (producción)
 *        PAYPAL_WEBHOOK_ID  (para validar firmas de webhooks)
 *   3. Cambiar `NEXT_PUBLIC_PAYMENT_MODE=production` y reiniciar el server.
 *
 * Esta clase ya implementa: token OAuth, creación de orden, consulta y captura.
 * Falta integrar el redirect del aprobador (approve URL) en el cliente y
 * llamar a `captureOrder` cuando PayPal regrese al donante (return_url).
 */
type PaypalToken = {
    access_token: string;
    token_type: string;
    expires_in: number;
};

type PaypalOrder = {
    id: string;
    status:
        | "CREATED"
        | "SAVED"
        | "APPROVED"
        | "VOIDED"
        | "COMPLETED"
        | "PAYER_ACTION_REQUIRED";
    links?: Array<{ href: string; rel: string; method: string }>;
};

export class PaypalProvider extends BasePaymentProvider {
    private clientId = "";
    private clientSecret = "";
    private baseUrl = "https://api-m.sandbox.paypal.com";
    private cachedToken: { token: string; expiresAt: number } | null = null;

    constructor() {
        super(PaymentProvider.PAYPAL);
    }

    protected async onInitialize(): Promise<void> {
        this.clientId = this.config.apiKey || "";
        this.clientSecret = this.config.apiSecret || "";
        this.baseUrl =
            this.config.customConfig?.baseUrl ||
            (this.config.environment === "production"
                ? "https://api-m.paypal.com"
                : "https://api-m.sandbox.paypal.com");

        if (!this.clientId || !this.clientSecret) {
            throw new PaymentError(
                "Missing PayPal credentials (clientId, clientSecret)",
                PaymentErrorCode.INVALID_CONFIG,
                this.provider,
            );
        }
    }

    async createPayment(request: ProcessPaymentRequest): Promise<PaymentResult> {
        try {
            const token = await this.getAccessToken();

            const orderPayload = {
                intent: "CAPTURE",
                purchase_units: [
                    {
                        reference_id: request.metadata.donationId,
                        custom_id: request.metadata.donationId,
                        description: `Donación LaVaca - Campaña ${request.metadata.campaignId}`,
                        amount: {
                            currency_code: "USD",
                            value: Number(request.amount.usd).toFixed(2),
                        },
                    },
                ],
                payment_source: {
                    paypal: {
                        experience_context: {
                            brand_name: "LaVaca",
                            locale: "es-VE",
                            user_action: "PAY_NOW",
                            return_url: request.returnUrl,
                            cancel_url: request.cancelUrl,
                        },
                    },
                },
            };

            const response = await fetch(`${this.baseUrl}/v2/checkout/orders`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                    "PayPal-Request-Id": request.metadata.donationId,
                },
                body: JSON.stringify(orderPayload),
            });

            const raw = await response.text();
            const data = raw ? (JSON.parse(raw) as PaypalOrder) : ({} as PaypalOrder);

            if (!response.ok || !data.id) {
                throw new Error(
                    (data as any)?.message ||
                        (data as any)?.name ||
                        `PayPal order creation failed (${response.status})`,
                );
            }

            const approveLink = data.links?.find((link) => link.rel === "payer-action" || link.rel === "approve");

            return {
                success: true,
                transactionId: request.metadata.donationId,
                externalId: data.id,
                status: this.mapStatus(data.status),
                metadata: {
                    provider: "paypal",
                    orderId: data.id,
                    checkoutUrl: approveLink?.href || null,
                },
            };
        } catch (error: any) {
            console.error("[paypal] createPayment error:", error);
            return {
                success: false,
                transactionId: request.metadata.donationId,
                status: PaymentStatus.FAILED,
                error: error?.message || "PayPal checkout error",
            };
        }
    }

    /**
     * Captura una orden aprobada por el donante. Llamar desde el return_url o
     * desde el webhook `CHECKOUT.ORDER.APPROVED`.
     */
    async captureOrder(orderId: string): Promise<PaymentResult> {
        try {
            const token = await this.getAccessToken();

            const response = await fetch(
                `${this.baseUrl}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                },
            );

            const raw = await response.text();
            const data = raw ? (JSON.parse(raw) as PaypalOrder) : ({} as PaypalOrder);

            if (!response.ok) {
                throw new Error(
                    (data as any)?.message || `PayPal capture failed (${response.status})`,
                );
            }

            return {
                success: data.status === "COMPLETED",
                transactionId: orderId,
                externalId: data.id,
                status: this.mapStatus(data.status),
            };
        } catch (error: any) {
            return {
                success: false,
                transactionId: orderId,
                status: PaymentStatus.FAILED,
                error: error?.message || "PayPal capture error",
            };
        }
    }

    async getPaymentStatus(transactionId: string): Promise<PaymentResult> {
        try {
            const token = await this.getAccessToken();

            const response = await fetch(
                `${this.baseUrl}/v2/checkout/orders/${encodeURIComponent(transactionId)}`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                },
            );

            const raw = await response.text();
            const data = raw ? (JSON.parse(raw) as PaypalOrder) : ({} as PaypalOrder);

            if (!response.ok) {
                return {
                    success: false,
                    transactionId,
                    status: PaymentStatus.FAILED,
                    error: (data as any)?.message || "PayPal status query failed",
                };
            }

            const status = this.mapStatus(data.status);

            return {
                success: status === PaymentStatus.COMPLETED,
                transactionId,
                externalId: data.id,
                status,
            };
        } catch (error: any) {
            return {
                success: false,
                transactionId,
                status: PaymentStatus.FAILED,
                error: error?.message || "PayPal status check failed",
            };
        }
    }

    async handleWebhook(event: WebhookEvent): Promise<PaymentResult> {
        try {
            const eventType = event.eventType || event.rawData?.event_type || "";
            const resource = event.rawData?.resource;

            let status: PaymentStatus = PaymentStatus.PENDING;

            if (eventType.includes("CHECKOUT.ORDER.COMPLETED") || eventType.includes("PAYMENT.CAPTURE.COMPLETED")) {
                status = PaymentStatus.COMPLETED;
            } else if (eventType.includes("PAYMENT.CAPTURE.DENIED") || eventType.includes("CHECKOUT.ORDER.VOIDED")) {
                status = PaymentStatus.FAILED;
            } else if (eventType.includes("PAYMENT.CAPTURE.REFUNDED")) {
                status = PaymentStatus.REFUNDED;
            } else if (resource?.status) {
                status = this.mapStatus(resource.status);
            }

            return {
                success: status === PaymentStatus.COMPLETED,
                transactionId: event.transactionId,
                status,
            };
        } catch (error: any) {
            return {
                success: false,
                transactionId: event.transactionId,
                status: PaymentStatus.FAILED,
                error: error?.message || "PayPal webhook handling failed",
            };
        }
    }

    async refund(request: RefundRequest): Promise<PaymentResult> {
        try {
            const token = await this.getAccessToken();

            const response = await fetch(
                `${this.baseUrl}/v2/payments/captures/${encodeURIComponent(request.transactionId)}/refund`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        amount: {
                            currency_code: "USD",
                            value: Number(request.amount.usd).toFixed(2),
                        },
                        note_to_payer: request.reason,
                    }),
                },
            );

            const raw = await response.text();
            const data = raw ? JSON.parse(raw) : {};

            if (!response.ok) {
                throw new Error(data?.message || "PayPal refund failed");
            }

            return {
                success: data?.status === "COMPLETED" || data?.status === "PENDING",
                transactionId: request.transactionId,
                externalId: data?.id,
                status:
                    data?.status === "COMPLETED"
                        ? PaymentStatus.REFUNDED
                        : PaymentStatus.PENDING,
            };
        } catch (error: any) {
            throw new PaymentError(
                `PayPal refund failed: ${error?.message || "Unknown error"}`,
                PaymentErrorCode.REFUND_FAILED,
                this.provider,
            );
        }
    }

    validateConfig(): boolean {
        return true;
    }

    private async getAccessToken(): Promise<string> {
        if (this.cachedToken && this.cachedToken.expiresAt > Date.now() + 30_000) {
            return this.cachedToken.token;
        }

        const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64");
        const response = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
            method: "POST",
            headers: {
                Authorization: `Basic ${credentials}`,
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: "grant_type=client_credentials",
        });

        const raw = await response.text();
        let data: PaypalToken | null = null;
        try {
            data = raw ? (JSON.parse(raw) as PaypalToken) : null;
        } catch {
            throw new Error(`Invalid PayPal token response: ${raw}`);
        }

        if (!response.ok || !data?.access_token) {
            throw new Error((data as any)?.error_description || "PayPal token request failed");
        }

        this.cachedToken = {
            token: data.access_token,
            expiresAt: Date.now() + data.expires_in * 1000,
        };

        return data.access_token;
    }

    private mapStatus(status?: string): PaymentStatus {
        switch ((status || "").toUpperCase()) {
            case "COMPLETED":
                return PaymentStatus.COMPLETED;
            case "APPROVED":
                return PaymentStatus.PROCESSING;
            case "CREATED":
            case "SAVED":
            case "PAYER_ACTION_REQUIRED":
                return PaymentStatus.PENDING;
            case "VOIDED":
                return PaymentStatus.CANCELLED;
            default:
                return PaymentStatus.PENDING;
        }
    }
}
