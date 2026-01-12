/**
 * ============================================
 * PAYMENT SYSTEM - LaVaca
 * ============================================
 * Punto de entrada principal del sistema de pagos
 */

// Exportar tipos
export * from './types';

// Exportar clases principales
export { BasePaymentProvider } from './base-provider';
export { PaymentFactory } from './payment-factory';
export { PaymentManager } from './payment-manager';

// Exportar proveedores (cuando estén implementados)
// export { StripeProvider } from './providers/stripe-provider';
// export { PayPalProvider } from './providers/paypal-provider';
// export { BinanceProvider } from './providers/binance-provider';
// export { ZelleProvider } from './providers/zelle-provider';
// export { PagoMovilProvider } from './providers/pagomovil-provider';
