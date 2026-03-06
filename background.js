// Background Service Worker — Otomoto Blicker v2.0
// Runs in the Chrome service worker context.
// Fetches Otomoto search results server-side (bypasses CORS)
// and extracts price statistics to send back to the content script.

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request.action === "GET_OTOMOTO_STATS") {
        fetchOtomotoStats(request.url).then(sendResponse);
        return true; // Keep message channel open for async response
    }
});

/**
 * Fetches raw HTML from an Otomoto search URL and extracts car prices.
 * Uses three strategies to be resilient against Otomoto DOM/HTML changes:
 *  1. JSON state embedded in the page (__INITIAL_STATE__ / "price":{"value":...})
 *  2. H3 elements that contain only numeric text (listing card prices)
 *  3. <span> elements whose class includes "price"
 *
 * @param {string} url - Full Otomoto search URL
 * @returns {{ min, max, avg, count } | null}
 */
async function fetchOtomotoStats(url) {
    try {
        const response = await fetch(url, {
            headers: { 'Accept-Language': 'pl-PL,pl;q=0.9' }
        });
        if (!response.ok) return null;

        const html = await response.text();
        const prices = new Set(); // Use Set to deduplicate
        let match;

        // ── Strategy 1: Embedded JSON state (most reliable) ─────────────────────
        const jsonPriceRe = /"price":\{"value":(\d+),/g;
        while ((match = jsonPriceRe.exec(html)) !== null) {
            const v = parseInt(match[1]);
            if (v > 500) prices.add(v);
        }

        // ── Strategy 2: H3 text that is purely numeric (listing card headers) ───
        const h3Re = /<h3[^>]*>([^<]+)<\/h3>/g;
        while ((match = h3Re.exec(html)) !== null) {
            const text = match[1].trim();
            if (/^[\d\s\u00a0]+$/.test(text)) {
                const v = parseInt(text.replace(/[\s\u00a0]/g, ''));
                if (v > 500) prices.add(v);
            }
        }

        // ── Strategy 3: <span class="...price..."> ───────────────────────────────
        const spanRe = /<span[^>]*class="[^"]*price[^"]*"[^>]*>([\d\s\u00a0&nbsp;]+)<\/span>/g;
        while ((match = spanRe.exec(html)) !== null) {
            const v = parseInt(match[1].replace(/[\s\u00a0]/g, '').replace(/&nbsp;/g, ''));
            if (v > 500) prices.add(v);
        }

        if (prices.size === 0) return null;

        const arr = [...prices];
        return {
            min: Math.min(...arr),
            max: Math.max(...arr),
            avg: Math.round(arr.reduce((a, b) => a + b, 0) / arr.length),
            count: arr.length
        };
    } catch (err) {
        console.error('[OB background] fetch failed:', err);
        return null;
    }
}
