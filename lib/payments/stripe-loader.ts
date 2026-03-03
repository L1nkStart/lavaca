let stripeScriptPromise: Promise<void> | null = null;

function hasStripeLoaded() {
    return typeof window !== "undefined" && typeof (window as any).Stripe === "function";
}

function createStripeScriptPromise(timeoutMs = 8000) {
    return new Promise<void>((resolve, reject) => {
        if (typeof window === "undefined") {
            reject(new Error("Stripe solo puede cargarse en el navegador"));
            return;
        }

        if (hasStripeLoaded()) {
            resolve();
            return;
        }

        const existing = document.querySelector<HTMLScriptElement>('script[src="https://js.stripe.com/v3/"]');

        if (existing) {
            existing.addEventListener("load", () => resolve(), { once: true });
            existing.addEventListener("error", () => reject(new Error("No se pudo cargar Stripe")), { once: true });
            return;
        }

        const script = document.createElement("script");
        script.src = "https://js.stripe.com/v3/";
        script.async = true;
        script.defer = true;

        const timer = window.setTimeout(() => {
            reject(new Error("Tiempo de espera agotado al cargar Stripe"));
        }, timeoutMs);

        script.onload = () => {
            clearTimeout(timer);
            resolve();
        };

        script.onerror = () => {
            clearTimeout(timer);
            reject(new Error("No se pudo cargar Stripe"));
        };

        document.head.appendChild(script);
    });
}

export async function loadStripeSdkConditionally() {
    if (hasStripeLoaded()) return;

    if (!stripeScriptPromise) {
        stripeScriptPromise = createStripeScriptPromise().catch((error) => {
            stripeScriptPromise = null;
            throw error;
        });
    }

    await stripeScriptPromise;
}

export function isLikelyRestrictedRegion() {
    if (typeof window === "undefined") return false;

    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    const locale = navigator.language || "";

    return timeZone.includes("Caracas") || locale.toLowerCase().includes("ve");
}
