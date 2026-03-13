// Background Service Worker - v3.0
// Odpowiada za pobieranie kursu EUR/PLN z API NBP

const CACHE_KEY = 'eur_pln_rate';
const CACHE_DURATION = 3600000; // 1 godzina

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Background] Received message:', request.action);
  
  if (request.action === 'GET_EUR_RATE') {
    getEurRate().then(rate => {
      console.log('[Background] Sending EUR rate:', rate);
      sendResponse(rate);
    });
    return true;
  }
  
  if (request.action === 'FETCH_OTOMOTO_PRICES') {
    console.log('[Background] Fetching Otomoto prices for:', request.url);
    fetchOtomotoPrices(request.url).then(prices => {
      console.log('[Background] Sending prices:', prices);
      sendResponse(prices);
    }).catch(error => {
      console.error('[Background] Fetch error:', error);
      sendResponse(null);
    });
    return true;
  }
});

// Pobierz kurs EUR/PLN z NBP API
async function getEurRate() {
  try {
    // Sprawdź cache
    const cached = await chrome.storage.local.get([CACHE_KEY, 'eur_timestamp']);
    const now = Date.now();
    
    if (cached[CACHE_KEY] && cached.eur_timestamp && (now - cached.eur_timestamp < CACHE_DURATION)) {
      console.log('[Background] Using cached EUR rate:', cached[CACHE_KEY]);
      return cached[CACHE_KEY];
    }

    // Pobierz z API NBP
    const response = await fetch('https://api.nbp.pl/api/exchangerates/rates/A/EUR/?format=json');
    const data = await response.json();
    const rate = data.rates[0].mid;

    // Zapisz do cache
    await chrome.storage.local.set({
      [CACHE_KEY]: rate,
      eur_timestamp: now
    });

    console.log('[Background] Fetched EUR rate:', rate);
    return rate;
  } catch (error) {
    console.error('[Background] Failed to fetch EUR rate:', error);
    return 4.3; // Fallback
  }
}

// Fetch prices from Otomoto (cross-origin allowed in background)
// Używa strategii ze starej wersji 2.8.5 - szuka JSON price i h3 z cenami
async function fetchOtomotoPrices(url) {
  try {
    const response = await fetch(url, {
      headers: { 'Accept-Language': 'pl-PL,pl;q=0.9' }
    });
    if (!response.ok) return null;

    const html = await response.text();
    const prices = [];
    let match;

    // ── Strategy 1: Embedded JSON state (most reliable) ─────────────────────
    const jsonPriceRe = /"price":\{"value":(\d+),/g;
    while ((match = jsonPriceRe.exec(html)) !== null) {
      const v = parseInt(match[1]);
      if (v >= 5000 && v <= 5000000) prices.push(v);
    }

    // ── Strategy 2: H3 text that is purely numeric (listing card headers) ───
    const h3Re = /<h3[^>]*>([^<]+)<\/h3>/g;
    while ((match = h3Re.exec(html)) !== null) {
      const text = match[1].trim();
      if (/^[\d\s\u00a0]+$/.test(text)) {
        const v = parseInt(text.replace(/[\s\u00a0]/g, ''));
        if (v >= 5000 && v <= 5000000) prices.push(v);
      }
    }

    if (prices.length === 0) return null;

    return {
      min: Math.min(...prices),
      max: Math.max(...prices),
      avg: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
      count: prices.length
    };
  } catch (err) {
    console.error('[OB background] fetch failed:', err);
    return null;
  }
}

console.log('[OB Background] Service worker initialized');

// Test przy inicjalizacji
chrome.runtime.onInstalled.addListener(() => {
  console.log('[OB Background] Extension installed');
  getEurRate();
});
