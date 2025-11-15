import { NextResponse } from "next/server";

// This would typically fetch from an external API or database
// For now, we'll return a hardcoded rate that should be updated periodically
export async function GET() {
  try {
    // In production, fetch from BCV or another source
    const rate = 41.25;
    const lastUpdated = new Date().toISOString();

    return NextResponse.json({
      currency: "VEF",
      rateUSD: rate,
      lastUpdated,
      source: "BCV",
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch exchange rate" },
      { status: 500 }
    );
  }
}
