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

type BinanceOrderResponse = {
    status: "SUCCESS" | "FAIL";
    code: string;
    errorMessage?: string;
    data?: {
        prepayId?: string;
        checkoutUrl?: string;
        qrcodeLink?: string;
        qrContent?: string;
        universalUrl?: string;
    };
};

type BinanceQueryResponse = {
    status: "SUCCESS" | "FAIL";
    code: string;
    errorMessage?: string;
    data?: {
        merchantTradeNo?: string;
        prepayId?: string;
        status?: string;
    };
};

export class BinanceProvider extends BasePaymentProvider {
    private apiKey = "";
    private apiSecret = "";
    private certificateSn = "";
    private baseUrl = "https://bpay.binanceapi.com";

    constructor() {
        super(PaymentProvider.BINANCE);
    }

    protected async onInitialize(): Promise<void> {
        this.apiKey = this.config.apiKey || "";
        this.apiSecret = this.config.apiSecret || "";
        this.certificateSn = this.config.customConfig?.certificateSn || "";
        this.baseUrl = this.config.customConfig?.baseUrl || "https://bpay.binanceapi.com";

        if (!this.apiKey || !this.apiSecret || !this.certificateSn) {
            throw new PaymentError(
                "Missing Binance Pay credentials (apiKey, apiSecret, certificateSn)",
                PaymentErrorCode.INVALID_CONFIG,
                this.provider,
            );
        }
    }

    async createPayment(request: ProcessPaymentRequest): Promise<PaymentResult> {
        try {
            const merchantTradeNo = request.metadata.donationId;
            const orderAmount = Number(request.amount.usd || 0).toFixed(2);
            const webhookUrl = `${process.env.NEXT_PUBLIC_URL}/api/payments/binance/webhook`;

            const payload = {
                env: {
                    terminalType: "WEB",
                },
                merchantTradeNo,
                orderAmount,
                currency: "USDT",
                goods: {
                    goodsType: "01",
                    goodsCategory: "D000",
                    referenceGoodsId: request.metadata.campaignId,
                    goodsName: "Donación LaVaca",
                    goodsDetail: `Campaña ${request.metadata.campaignId}`,
                },
                returnUrl: request.returnUrl,
                cancelUrl: request.cancelUrl,
                webhookUrl,
            };

            const response = await this.signedRequest<BinanceOrderResponse>(
                "/binancepay/openapi/v2/order",
                payload,
            );

            if (response.status !== "SUCCESS" || !response.data) {
                throw new Error(response.errorMessage || "Binance order creation failed");
            }

            const checkoutUrl =
                response.data.checkoutUrl ||
                response.data.qrcodeLink ||
                response.data.universalUrl ||
                null;

            return {
                success: true,
                transactionId: merchantTradeNo,
                externalId: response.data.prepayId,
                status: PaymentStatus.PENDING,
                metadata: {
                    provider: "binance",
                    checkoutUrl,
                    qrContent: response.data.qrContent,
                    prepayId: response.data.prepayId,
                },
            };
        } catch (error: any) {
            console.error("[binance] createPayment error:", error);
            return {
                success: false,
                transactionId: request.metadata.donationId,
                status: PaymentStatus.FAILED,
                error: error?.message || "Binance checkout error",
            };
        }
    }

    async getPaymentStatus(transactionId: string): Promise<PaymentResult> {
        try {
            const payload = {
                merchantTradeNo: transactionId,
            };

            const response = await this.signedRequest<BinanceQueryResponse>(
                "/binancepay/openapi/v2/order/query",
                payload,
            );

            if (response.status !== "SUCCESS") {
                return {
                    success: false,
                    transactionId,
                    status: PaymentStatus.FAILED,
                    error: response.errorMessage || "Binance status query failed",
                };
            }

            const status = this.mapOrderStatus(response.data?.status);

            return {
                success: status === PaymentStatus.COMPLETED,
                transactionId,
                externalId: response.data?.prepayId,
                status,
            };
        } catch (error: any) {
            return {
                success: false,
                transactionId,
                status: PaymentStatus.FAILED,
                error: error?.message || "Binance status check failed",
            };
        }
    }

    async handleWebhook(event: WebhookEvent): Promise<PaymentResult> {
        try {
            const status = this.mapOrderStatus(event.rawData?.bizStatus || event.rawData?.status);
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
                error: error?.message || "Binance webhook handling failed",
            };
        }
    }

    async refund(_request: RefundRequest): Promise<PaymentResult> {
        throw new PaymentError(
            "Binance refund is not implemented in this version",
            PaymentErrorCode.REFUND_FAILED,
            this.provider,
        );
    }

    validateConfig(): boolean {
        return true;
    }

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
            .createHmac("sha512", secret)
            .update(signedPayload)
            .digest("hex")
            .toUpperCase();

        return computed === signature.toUpperCase();
    }

    private async signedRequest<T>(path: string, payload: Record<string, any>): Promise<T> {
        const body = JSON.stringify(payload);
        const timestamp = Date.now().toString();
        const nonce = crypto.randomBytes(16).toString("hex");
        const signature = this.signPayload(timestamp, nonce, body);

        const response = await fetch(`${this.baseUrl}${path}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "BinancePay-Timestamp": timestamp,
                "BinancePay-Nonce": nonce,
                "BinancePay-Certificate-SN": this.certificateSn,
                "BinancePay-Signature": signature,
                "BinancePay-Api-Key": this.apiKey,
            },
            body,
        });

        const raw = await response.text();
        let parsed: any;

        try {
            parsed = raw ? JSON.parse(raw) : {};
        } catch {
            throw new Error(`Invalid Binance response: ${raw}`);
        }

        if (!response.ok) {
            throw new Error(parsed?.errorMessage || parsed?.message || `Binance API HTTP ${response.status}`);
        }

        return parsed as T;
    }

    private signPayload(timestamp: string, nonce: string, body: string) {
        const payload = `${timestamp}\n${nonce}\n${body}\n`;
        return crypto
            .createHmac("sha512", this.apiSecret)
            .update(payload)
            .digest("hex")
            .toUpperCase();
    }

    private mapOrderStatus(status?: string): PaymentStatus {
        switch ((status || "").toUpperCase()) {
            case "PAID":
            case "SUCCESS":
                return PaymentStatus.COMPLETED;
            case "CANCELED":
            case "CANCELLED":
                return PaymentStatus.CANCELLED;
            case "EXPIRED":
                return PaymentStatus.EXPIRED;
            case "ERROR":
            case "FAIL":
                return PaymentStatus.FAILED;
            default:
                return PaymentStatus.PENDING;
        }
    }
}
