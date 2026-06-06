import crypto from "crypto";
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
 * CHINCHIN PROVIDER (STUB)
 * ============================================================================
 *
 * Pasarela venezolana estilo C2P/P2C. Esta implementación es un esqueleto:
 * la estructura (request firmado HMAC + verificación de firma del webhook +
 * mapeo de estados) está completa y replica el patrón usado por
 * `BinanceProvider`, pero los endpoints exactos deben confirmarse con
 * ChinChin cuando se obtengan las credenciales y la documentación oficial.
 *
 * Para activarlo:
 *   1. Setear las variables de entorno en `.env`:
 *        CHINCHIN_API_KEY
 *        CHINCHIN_API_SECRET
 *        CHINCHIN_MERCHANT_ID
 *        CHINCHIN_BASE_URL  (default: https://api.chinchin.app)
 *        CHINCHIN_WEBHOOK_SECRET
 *   2. Cambiar `NEXT_PUBLIC_PAYMENT_MODE=production`.
 *   3. Ajustar las rutas (`/v1/payments`, `/v1/payments/{id}`) si la API real
 *      usa otras.
 *   4. Validar el algoritmo de firma exacto que use ChinChin (puede ser
 *      sha256/sha512, sobre body+timestamp+nonce o variantes).
 */
type ChinchinOrderResponse = {
    success: boolean;
    code?: string;
    message?: string;
    data?: {
        orderId?: string;
        checkoutUrl?: string;
        qrContent?: string;
        deeplink?: string;
        status?: string;
    };
};

type ChinchinQueryResponse = {
    success: boolean;
    code?: string;
    message?: string;
    data?: {
        orderId?: string;
        externalId?: string;
        status?: string;
    };
};

export class ChinchinProvider extends BasePaymentProvider {
    private apiKey = "";
    private apiSecret = "";
    private merchantId = "";
    private baseUrl = "https://api.chinchin.app";

    constructor() {
        super(PaymentProvider.CHINCHIN);
    }

    protected async onInitialize(): Promise<void> {
        this.apiKey = this.config.apiKey || "";
        this.apiSecret = this.config.apiSecret || "";
        this.merchantId = this.config.customConfig?.merchantId || "";
        this.baseUrl =
            this.config.customConfig?.baseUrl || "https://api.chinchin.app";

        if (!this.apiKey || !this.apiSecret || !this.merchantId) {
            throw new PaymentError(
                "Missing ChinChin credentials (apiKey, apiSecret, merchantId)",
                PaymentErrorCode.INVALID_CONFIG,
                this.provider,
            );
        }
    }

    async createPayment(request: ProcessPaymentRequest): Promise<PaymentResult> {
        try {
            const merchantTradeNo = request.metadata.donationId;
            const webhookUrl = `${process.env.NEXT_PUBLIC_URL}/api/payments/chinchin/webhook`;

            // ⚠️ STUB: el esquema exacto del payload debe confirmarse con la
            // documentación oficial de ChinChin. Esta forma es coherente con
            // pasarelas C2P genéricas (PagoMovil/Stripe/Binance Pay).
            const payload = {
                merchantId: this.merchantId,
                merchantTradeNo,
                orderAmount: Number(request.amount.usd || 0).toFixed(2),
                currency: "USD",
                amountBs: request.amount.bs
                    ? Number(request.amount.bs).toFixed(2)
                    : undefined,
                exchangeRate: request.amount.exchangeRate,
                customer: {
                    email: request.customerInfo?.email || request.metadata.donorEmail,
                    name: request.customerInfo?.name,
                    phone: request.customerInfo?.phone,
                    document: request.customerInfo?.document,
                },
                goods: {
                    referenceId: request.metadata.campaignId,
                    name: "Donación LaVaca",
                    description: `Campaña ${request.metadata.campaignId}`,
                },
                returnUrl: request.returnUrl,
                cancelUrl: request.cancelUrl,
                webhookUrl,
            };

            const response = await this.signedRequest<ChinchinOrderResponse>(
                "/v1/payments",
                payload,
            );

            if (!response.success || !response.data) {
                throw new Error(response.message || "ChinChin order creation failed");
            }

            const checkoutUrl =
                response.data.checkoutUrl ||
                response.data.deeplink ||
                null;

            return {
                success: true,
                transactionId: merchantTradeNo,
                externalId: response.data.orderId,
                status: this.mapOrderStatus(response.data.status),
                metadata: {
                    provider: "chinchin",
                    checkoutUrl,
                    qrContent: response.data.qrContent,
                    deeplink: response.data.deeplink,
                    orderId: response.data.orderId,
                },
            };
        } catch (error: any) {
            console.error("[chinchin] createPayment error:", error);
            return {
                success: false,
                transactionId: request.metadata.donationId,
                status: PaymentStatus.FAILED,
                error: error?.message || "ChinChin checkout error",
            };
        }
    }

    async getPaymentStatus(transactionId: string): Promise<PaymentResult> {
        try {
            const response = await this.signedRequest<ChinchinQueryResponse>(
                `/v1/payments/${encodeURIComponent(transactionId)}`,
                undefined,
                "GET",
            );

            if (!response.success) {
                return {
                    success: false,
                    transactionId,
                    status: PaymentStatus.FAILED,
                    error: response.message || "ChinChin status query failed",
                };
            }

            const status = this.mapOrderStatus(response.data?.status);

            return {
                success: status === PaymentStatus.COMPLETED,
                transactionId,
                externalId: response.data?.externalId || response.data?.orderId,
                status,
            };
        } catch (error: any) {
            return {
                success: false,
                transactionId,
                status: PaymentStatus.FAILED,
                error: error?.message || "ChinChin status check failed",
            };
        }
    }

    async handleWebhook(event: WebhookEvent): Promise<PaymentResult> {
        try {
            const status = this.mapOrderStatus(
                event.rawData?.status || event.rawData?.bizStatus,
            );
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
                error: error?.message || "ChinChin webhook handling failed",
            };
        }
    }

    async refund(_request: RefundRequest): Promise<PaymentResult> {
        throw new PaymentError(
            "ChinChin refund is not implemented in this version",
            PaymentErrorCode.REFUND_FAILED,
            this.provider,
        );
    }

    validateConfig(): boolean {
        return true;
    }

    /**
     * Verifica una firma HMAC SHA-256 del webhook. El secreto debe venir de
     * `CHINCHIN_WEBHOOK_SECRET`. Ajustar el algoritmo si ChinChin publica
     * una variante diferente.
     */
    static verifySignature(params: {
        timestamp: string;
        nonce: string;
        payload: string;
        signature: string;
        secret: string;
    }) {
        const { timestamp, nonce, payload, signature, secret } = params;
        const signedPayload = `${timestamp}\n${nonce}\n${payload}\n`;
        const computed = crypto
            .createHmac("sha256", secret)
            .update(signedPayload)
            .digest("hex");

        return crypto.timingSafeEqual(
            Buffer.from(computed),
            Buffer.from(signature.toLowerCase()),
        );
    }

    private async signedRequest<T>(
        path: string,
        payload?: Record<string, any>,
        method: "GET" | "POST" = "POST",
    ): Promise<T> {
        const body = payload ? JSON.stringify(payload) : "";
        const timestamp = Date.now().toString();
        const nonce = crypto.randomBytes(16).toString("hex");
        const signature = this.signPayload(timestamp, nonce, body);

        const response = await fetch(`${this.baseUrl}${path}`, {
            method,
            headers: {
                "Content-Type": "application/json",
                "X-Chinchin-Timestamp": timestamp,
                "X-Chinchin-Nonce": nonce,
                "X-Chinchin-Signature": signature,
                "X-Chinchin-Api-Key": this.apiKey,
                "X-Chinchin-Merchant-Id": this.merchantId,
            },
            body: method === "POST" ? body : undefined,
        });

        const raw = await response.text();
        let parsed: any;

        try {
            parsed = raw ? JSON.parse(raw) : {};
        } catch {
            throw new Error(`Invalid ChinChin response: ${raw}`);
        }

        if (!response.ok) {
            throw new Error(
                parsed?.message || parsed?.error || `ChinChin API HTTP ${response.status}`,
            );
        }

        return parsed as T;
    }

    private signPayload(timestamp: string, nonce: string, body: string) {
        const payload = `${timestamp}\n${nonce}\n${body}\n`;
        return crypto
            .createHmac("sha256", this.apiSecret)
            .update(payload)
            .digest("hex");
    }

    private mapOrderStatus(status?: string): PaymentStatus {
        switch ((status || "").toUpperCase()) {
            case "PAID":
            case "SUCCESS":
            case "COMPLETED":
                return PaymentStatus.COMPLETED;
            case "CANCELED":
            case "CANCELLED":
                return PaymentStatus.CANCELLED;
            case "EXPIRED":
                return PaymentStatus.EXPIRED;
            case "REFUNDED":
                return PaymentStatus.REFUNDED;
            case "ERROR":
            case "FAIL":
            case "FAILED":
                return PaymentStatus.FAILED;
            case "PROCESSING":
                return PaymentStatus.PROCESSING;
            default:
                return PaymentStatus.PENDING;
        }
    }
}
