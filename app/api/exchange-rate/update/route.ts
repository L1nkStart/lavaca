import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * API para actualizar la tasa de cambio desde Binance P2P
 * Se debe ejecutar cada 3 horas (manualmente o con cron job)
 */
export async function POST(request: NextRequest) {
    try {
        console.log('🔄 Iniciando actualización de tasa de cambio...');

        // Obtener tasa de Binance P2P
        const binanceRate = await fetchBinanceP2PRate();

        if (!binanceRate) {
            throw new Error('No se pudo obtener tasa de Binance');
        }

        console.log(`📊 Tasa de Binance P2P: ${binanceRate} VES/USD`);

        // Aplicar margen de seguridad (4.3%)
        const margin = 4.3;
        const finalRate = binanceRate * (1 + margin / 100);

        console.log(`💰 Tasa con margen ${margin}%: ${finalRate.toFixed(4)} VES/USD`);

        // Guardar en base de datos usando función SQL
        const supabase = await createClient();

        const { data, error } = await supabase.rpc('create_new_exchange_rate', {
            p_raw_rate: binanceRate,
            p_margin: margin,
            p_source: 'binance_p2p',
            p_metadata: {
                timestamp: new Date().toISOString(),
                api_source: 'binance',
                margin_applied: margin,
            }
        });

        if (error) {
            console.error('❌ Error guardando en BD:', error);
            throw error;
        }

        console.log('✅ Tasa actualizada correctamente en BD');

        return NextResponse.json({
            success: true,
            rawRate: binanceRate,
            margin,
            finalRate,
            rateId: data,
            timestamp: new Date().toISOString(),
        });

    } catch (error: any) {
        console.error('❌ Error actualizando tasa:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to update exchange rate',
                details: error.message,
            },
            { status: 500 }
        );
    }
}

/**
 * Obtiene la tasa promedio de Binance P2P
 * https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search
 */
async function fetchBinanceP2PRate(): Promise<number | null> {
    try {
        // Binance P2P API para obtener ofertas
        const buyOffersResponse = await fetch('https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                fiat: 'VES', // Bolívares venezolanos
                page: 1,
                rows: 10,
                tradeType: 'BUY', // Comprar USDT (queremos saber cuánto cuesta 1 USD)
                asset: 'USDT',
                countries: [],
                proMerchantAds: false,
                shieldMerchantAds: false,
                filterType: 'all',
                periods: [],
                additionalKycVerifyFilter: 0,
                publisherType: null,
                payTypes: [],
                classifies: ['mass', 'profession', 'fiat_trade'],
            }),
        });

        if (!buyOffersResponse.ok) {
            throw new Error(`Binance API error: ${buyOffersResponse.status}`);
        }

        const buyData = await buyOffersResponse.json();

        if (!buyData.data || !buyData.data.length) {
            console.warn('⚠️ No se encontraron ofertas en Binance P2P');
            return null;
        }

        // Obtener las primeras 10 ofertas y calcular promedio
        const rates = buyData.data
            .slice(0, 10)
            .map((offer: any) => parseFloat(offer.adv.price))
            .filter((price: number) => price > 0);

        if (rates.length === 0) {
            return null;
        }

        // Calcular promedio
        const average = rates.reduce((a: number, b: number) => a + b, 0) / rates.length;

        console.log(`📊 Ofertas consultadas: ${rates.length}`);
        console.log(`📊 Tasa mínima: ${Math.min(...rates).toFixed(2)}`);
        console.log(`📊 Tasa máxima: ${Math.max(...rates).toFixed(2)}`);
        console.log(`📊 Tasa promedio: ${average.toFixed(2)}`);

        return average;

    } catch (error) {
        console.error('Error fetching Binance P2P rate:', error);
        return null;
    }
}

/**
 * GET handler para mostrar información (opcional)
 */
export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();

        // Obtener tasa activa actual
        const { data: currentRate } = await supabase
            .rpc('get_active_exchange_rate');

        // Obtener última actualización
        const { data: lastUpdate } = await supabase
            .from('exchange_rates')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        return NextResponse.json({
            currentRate,
            lastUpdate,
            instructions: {
                update: 'POST /api/exchange-rate/update',
                message: 'Ejecuta POST para actualizar la tasa desde Binance P2P',
            },
        });

    } catch (error: any) {
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
}
