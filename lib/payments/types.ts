/**
 * ============================================
 * PAYMENT SYSTEM TYPES - LaVaca
 * ============================================
 * Arquitectura robusta para múltiples proveedores de pago
 */

// ============================================
// ENUMS
// ============================================

export enum PaymentProvider {
    STRIPE = 'stripe',
    PAYPAL = 'paypal',
    BINANCE = 'binance',
    ZELLE = 'zelle',
    BANCO_VENEZUELA = 'banco_venezuela',
    BANCO_MERCANTIL = 'banco_mercantil',
    BANESCO = 'banesco',
    BDV = 'bdv',
    PAGO_MOVIL = 'pago_movil',
}

export enum PaymentStatus {
    PENDING = 'pending',
    PROCESSING = 'processing',
    COMPLETED = 'completed',
    FAILED = 'failed',
    CANCELLED = 'cancelled',
    REFUNDED = 'refunded',
    EXPIRED = 'expired',
}

export enum PaymentType {
    CARD = 'card',
    BANK_TRANSFER = 'bank_transfer',
    CRYPTO = 'crypto',
    MOBILE_PAYMENT = 'mobile_payment',
    CASH = 'cash',
}

// ============================================
// BASE INTERFACES
// ============================================

export interface PaymentAmount {
    usd: number;
    bs?: number;
    crypto?: number;
    exchangeRate?: number;
}

export interface PaymentMetadata {
    campaignId: string;
    donationId: string;
    donorId?: string;
    donorEmail: string;
    isAnonymous: boolean;
    [key: string]: any;
}

export interface PaymentResult {
    success: boolean;
    transactionId?: string;
    externalId?: string;
    status: PaymentStatus;
    error?: string;
    metadata?: Record<string, any>;
}

export interface RefundRequest {
    transactionId: string;
    amount: PaymentAmount;
    reason: string;
}

// ============================================
// PROVIDER CONFIGURATION
// ============================================

export interface ProviderConfig {
    provider: PaymentProvider;
    enabled: boolean;
    apiKey?: string;
    apiSecret?: string;
    publicKey?: string;
    webhookSecret?: string;
    environment: 'sandbox' | 'production';
    customConfig?: Record<string, any>;
}

// ============================================
// PAYMENT REQUEST
// ============================================

export interface CreatePaymentRequest {
    amount: PaymentAmount;
    provider: PaymentProvider;
    metadata: PaymentMetadata;
    paymentType: PaymentType;
    customerInfo?: {
        name?: string;
        email: string;
        phone?: string;
        document?: string;
    };
    providerSpecificData?: Record<string, any>;
}

export interface ProcessPaymentRequest extends CreatePaymentRequest {
    returnUrl: string;
    cancelUrl: string;
}

// ============================================
// WEBHOOK INTERFACES
// ============================================

export interface WebhookEvent {
    provider: PaymentProvider;
    eventType: string;
    transactionId: string;
    status: PaymentStatus;
    amount?: PaymentAmount;
    timestamp: Date;
    rawData: any;
}

// ============================================
// PAYMENT PROVIDER INTERFACE
// ============================================

/**
 * Interface que todos los proveedores de pago deben implementar
 */
export interface IPaymentProvider {
    readonly provider: PaymentProvider;
    readonly config: ProviderConfig;

    /**
     * Inicializa el proveedor con su configuración
     */
    initialize(config: ProviderConfig): Promise<void>;

    /**
     * Crea una nueva sesión de pago
     */
    createPayment(request: ProcessPaymentRequest): Promise<PaymentResult>;

    /**
     * Verifica el estado de un pago
     */
    getPaymentStatus(transactionId: string): Promise<PaymentResult>;

    /**
     * Procesa un webhook del proveedor
     */
    handleWebhook(event: WebhookEvent): Promise<PaymentResult>;

    /**
     * Procesa un reembolso
     */
    refund(request: RefundRequest): Promise<PaymentResult>;

    /**
     * Valida la configuración del proveedor
     */
    validateConfig(): boolean;
}

// ============================================
// PROVIDER-SPECIFIC TYPES
// ============================================

// Stripe
export interface StripePaymentData {
    sessionId?: string;
    paymentIntentId?: string;
    customerId?: string;
}

// PayPal
export interface PayPalPaymentData {
    orderId?: string;
    payerId?: string;
    captureId?: string;
}

// Binance
export interface BinancePaymentData {
    orderId?: string;
    prepayId?: string;
    currency: 'USDT' | 'BUSD' | 'BTC' | 'ETH';
    network?: string;
    walletAddress?: string;
}

// Zelle
export interface ZellePaymentData {
    email?: string;
    phone?: string;
    confirmationNumber?: string;
}

// PagoMóvil (Venezuela)
export interface PagoMovilData {
    bankCode: string;
    phoneNumber: string;
    documentNumber: string;
    referenceNumber?: string;
}

// Transferencia Bancaria
export interface BankTransferData {
    bankCode: string;
    accountNumber?: string;
    referenceNumber: string;
    transactionDate?: Date;
}

// ============================================
// TRANSACTION LOG
// ============================================

export interface PaymentTransaction {
    id: string;
    donationId: string;
    provider: PaymentProvider;
    status: PaymentStatus;
    amount: PaymentAmount;
    transactionId?: string;
    externalId?: string;
    providerData?: Record<string, any>;
    error?: string;
    createdAt: Date;
    updatedAt: Date;
    completedAt?: Date;
}

// ============================================
// ERROR TYPES
// ============================================

export class PaymentError extends Error {
    constructor(
        message: string,
        public code: string,
        public provider: PaymentProvider,
        public metadata?: Record<string, any>
    ) {
        super(message);
        this.name = 'PaymentError';
    }
}

export enum PaymentErrorCode {
    INVALID_AMOUNT = 'INVALID_AMOUNT',
    INVALID_CONFIG = 'INVALID_CONFIG',
    PROVIDER_ERROR = 'PROVIDER_ERROR',
    NETWORK_ERROR = 'NETWORK_ERROR',
    WEBHOOK_VALIDATION_FAILED = 'WEBHOOK_VALIDATION_FAILED',
    REFUND_FAILED = 'REFUND_FAILED',
    TRANSACTION_NOT_FOUND = 'TRANSACTION_NOT_FOUND',
}
