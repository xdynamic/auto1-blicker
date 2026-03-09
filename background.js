// Background Service Worker — Otomoto Blicker v2.1
// Runs in the Chrome service worker context.

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request.action === "GET_OTOMOTO_STATS") {
        fetchMultiPageOtomotoStats(request.url).then(sendResponse);
        return true; 
    }
    if (request.action === "GET_EUR_RATE") {
        fetchEurRate().then(sendResponse);
        return true;
    }
});

async function fetchEurRate() {
    try {
        const response = await fetch('https://api.nbp.pl/api/exchangerates/rates/a/eur/?format=json');
        const data = await response.json();
        return data.rates[0].mid;
    } catch (err) {
        console.error('[OB background] EUR fetch failed:', err);
        return 4.3; // Fallback
    }
}

async function fetchMultiPageOtomotoStats(baseUrl) {
    const allPrices = new Set();
    let totalCount = 0;
    const MAX_PAGES = 5;

    for (let page = 1; page <= MAX_PAGES; page++) {
        const pageUrl = baseUrl.includes('?') 
            ? `${baseUrl}&page=${page}` 
            : `${baseUrl}?page=${page}`;
        
        const stats = await fetchOtomotoStats(pageUrl);
        if (!stats || stats.prices.length === 0) break;

        stats.prices.forEach(p => allPrices.add(p));
        totalCount += stats.count;

        // If we got fewer results than a full page (usually 32 on Otomoto), we're likely on the last page
        if (stats.prices.length < 20) break; 
    }

    if (allPrices.size === 0) return null;

    const arr = [...allPrices];
    return {
        min: Math.min(...arr),
        max: Math.max(...arr),
        avg: Math.round(arr.reduce((a, b) => a + b, 0) / arr.length),
        count: arr.length // Unique prices count across pages
    };
}

async function fetchOtomotoStats(url) {
    try {
        const response = await fetch(url, {
            headers: { 'Accept-Language': 'pl-PL,pl;q=0.9' }
        });
        if (!response.ok) return null;

        const html = await response.text();
        const pagePrices = [];
        let match;

        // ── Strategy 1: Embedded JSON state (most reliable) ─────────────────────
        const jsonPriceRe = /"price":\{"value":(\d+),/g;
        while ((match = jsonPriceRe.exec(html)) !== null) {
            const v = parseInt(match[1]);
            if (v > 500) pagePrices.push(v);
        }

        // ── Strategy 2: H3 text that is purely numeric (listing card headers) ───
        const h3Re = /<h3[^>]*>([^<]+)<\/h3>/g;
        while ((match = h3Re.exec(html)) !== null) {
            const text = match[1].trim();
            if (/^[\d\s\u00a0]+$/.test(text)) {
                const v = parseInt(text.replace(/[\s\u00a0]/g, ''));
                if (v > 500) pagePrices.push(v);
            }
        }

        return {
            prices: pagePrices,
            count: pagePrices.length
        };
    } catch (err) {
        console.error('[OB background] fetch failed:', err);
        return null;
    }
}
