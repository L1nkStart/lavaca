import Stripe from "stripe";
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

export class StripeProvider extends BasePaymentProvider {
  private client: Stripe | null = null;

  constructor() {
    super(PaymentProvider.STRIPE);
  }

  protected async onInitialize(): Promise<void> {
    const secretKey = this.config.apiKey;

    if (!secretKey) {
      throw new PaymentError(
        "Missing Stripe secret key",
        PaymentErrorCode.INVALID_CONFIG,
        this.provider,
      );
    }

    this.client = new Stripe(secretKey, {
      apiVersion: "2026-02-25.clover",
      typescript: true,
    });
  }

  async createPayment(request: ProcessPaymentRequest): Promise<PaymentResult> {
    try {
      if (!this.client) {
        throw new Error("Stripe provider not initialized");
      }

      const session = await this.client.checkout.sessions.create({
        mode: "payment",
        success_url: request.returnUrl,
        cancel_url: request.cancelUrl,
        customer_email: request.customerInfo?.email || request.metadata.donorEmail,
        metadata: {
          campaign_id: request.metadata.campaignId,
          donation_id: request.metadata.donationId,
          donor_email: request.metadata.donorEmail,
          donor_id: request.metadata.donorId || "",
          is_anonymous: String(request.metadata.isAnonymous),
        },
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: Math.round(request.amount.usd * 100),
              product_data: {
                name: "Donación LaVaca",
                description: `Campaña ${request.metadata.campaignId}`,
              },
            },
          },
        ],
        payment_method_types: ["card"],
        allow_promotion_codes: false,
      });

      return {
        success: true,
        transactionId: request.metadata.donationId,
        externalId: session.id,
        status: PaymentStatus.PENDING,
        metadata: {
          checkoutUrl: session.url,
          provider: "stripe",
        },
      };
    } catch (error: any) {
      console.error("[stripe] createPayment error:", error);
      return {
        success: false,
        transactionId: request.metadata.donationId,
        status: PaymentStatus.FAILED,
        error: error?.message || "Stripe checkout error",
      };
    }
  }

  async getPaymentStatus(transactionId: string): Promise<PaymentResult> {
    try {
      if (!this.client) {
        throw new Error("Stripe provider not initialized");
      }

      const session = await this.client.checkout.sessions.retrieve(transactionId);
      const status = this.mapCheckoutStatus(session.payment_status);

      return {
        success: status === PaymentStatus.COMPLETED,
        transactionId,
        externalId: session.id,
        status,
      };
    } catch (error: any) {
      return {
        success: false,
        transactionId,
        status: PaymentStatus.FAILED,
        error: error?.message || "Stripe status check failed",
      };
    }
  }

  async handleWebhook(event: WebhookEvent): Promise<PaymentResult> {
    try {
      const mappedStatus = this.mapWebhookStatus(event.eventType, event.status);

      return {
        success: mappedStatus === PaymentStatus.COMPLETED,
        transactionId: event.transactionId,
        status: mappedStatus,
      };
    } catch (error: any) {
      return {
        success: false,
        transactionId: event.transactionId,
        status: PaymentStatus.FAILED,
        error: error?.message || "Stripe webhook handling failed",
      };
    }
  }

  async refund(request: RefundRequest): Promise<PaymentResult> {
    try {
      if (!this.client) {
        throw new Error("Stripe provider not initialized");
      }

      const refund = await this.client.refunds.create({
        payment_intent: request.transactionId,
        amount: Math.round(request.amount.usd * 100),
        reason: "requested_by_customer",
      });

      return {
        success: refund.status === "succeeded" || refund.status === "pending",
        transactionId: request.transactionId,
        externalId: refund.id,
        status:
          refund.status === "succeeded"
            ? PaymentStatus.REFUNDED
            : PaymentStatus.PENDING,
      };
    } catch (error: any) {
      throw new PaymentError(
        `Stripe refund failed: ${error?.message || "Unknown error"}`,
        PaymentErrorCode.REFUND_FAILED,
        this.provider,
      );
    }
  }

  validateConfig(): boolean {
    return true;
  }

  private mapCheckoutStatus(status: Stripe.Checkout.Session.PaymentStatus | null): PaymentStatus {
    switch (status) {
      case "paid":
        return PaymentStatus.COMPLETED;
      case "unpaid":
        return PaymentStatus.PENDING;
      case "no_payment_required":
        return PaymentStatus.COMPLETED;
      default:
        return PaymentStatus.PENDING;
    }
  }

  private mapWebhookStatus(eventType: string, fallbackStatus: PaymentStatus): PaymentStatus {
    if (eventType === "checkout.session.completed") {
      return PaymentStatus.COMPLETED;
    }

    if (eventType === "checkout.session.expired") {
      return PaymentStatus.EXPIRED;
    }

    if (eventType.includes("payment_failed")) {
      return PaymentStatus.FAILED;
    }

    return fallbackStatus || PaymentStatus.PENDING;
  }
}
