// Background Service Worker - v3.0
// Odpowiada za pobieranie kursu EUR/PLN z API NBP oraz cen z Otomoto i Mobile.de

const CACHE_KEY = 'eur_pln_rate';
const CACHE_DURATION = 3600000; // 1 godzina
const STORAGE_KEY_ENABLED = 'ob_extension_enabled';

const OTOMOTO_CACHE_TTL = 5 * 60 * 1000; // 5 minut
const otomotoPriceCache = new Map(); // url -> { data, timestamp }

const MOBILE_CACHE_TTL = 5 * 60 * 1000; // 5 minut
const mobilePriceCache = new Map(); // url -> { data, timestamp }

async function isExtensionEnabled() {
  try {
    const stored = await chrome.storage.local.get([STORAGE_KEY_ENABLED]);
    return stored[STORAGE_KEY_ENABLED] !== false;
  } catch (_error) {
    return true;
  }
}

async function updateActionState() {
  const enabled = await isExtensionEnabled();

  await chrome.action.setBadgeBackgroundColor({
    color: enabled ? '#1c7c54' : '#9a3412'
  });
  await chrome.action.setBadgeText({
    text: enabled ? '' : 'OFF'
  });
  await chrome.action.setTitle({
    title: enabled ? 'Auction Blicker: włączone' : 'Auction Blicker: wyłączone'
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Background] Received message:', request.action);

  if (request.action === 'GET_EXTENSION_STATE') {
    isExtensionEnabled().then(enabled => sendResponse({ enabled }));
    return true;
  }
  
  if (request.action === 'GET_EUR_RATE') {
    isExtensionEnabled().then(enabled => {
      if (!enabled) {
        sendResponse(4.3);
        return;
      }

      getEurRate().then(rate => {
        console.log('[Background] Sending EUR rate:', rate);
        sendResponse(rate);
      });
    });
    return true;
  }
  
  if (request.action === 'FETCH_OTOMOTO_PRICES') {
    isExtensionEnabled().then(enabled => {
      if (!enabled) {
        sendResponse(null);
        return;
      }

      console.log('[Background] Fetching Otomoto prices for:', request.url);
      fetchOtomotoPrices(request.url).then(prices => {
        console.log('[Background] Sending prices:', prices);
        sendResponse(prices);
      }).catch(error => {
        console.error('[Background] Fetch error:', error);
        sendResponse(null);
      });
    });
    return true;
  }

  if (request.action === 'FETCH_MOBILE_PRICES') {
    isExtensionEnabled().then(enabled => {
      if (!enabled) {
        sendResponse({ error: true });
        return;
      }

      console.log('[Background] Fetching Mobile.de prices for:', request.url);
      fetchMobilePrices(request.url).then(prices => {
        console.log('[Background] Sending Mobile.de prices:', prices);
        sendResponse(prices);
      }).catch(error => {
        console.error('[Background] Mobile fetch error:', error);
        sendResponse({ error: true });
      });
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
  const now = Date.now();
  const cached = otomotoPriceCache.get(url);
  if (cached && (now - cached.timestamp < OTOMOTO_CACHE_TTL)) {
    console.log('[Background] Using cached Otomoto prices for:', url);
    return cached.data;
  }

  try {
    const response = await fetch(url, {
      headers: { 'Accept-Language': 'pl-PL,pl;q=0.9' }
    });
    if (!response.ok) {
      const errorResult = { error: true };
      otomotoPriceCache.set(url, { data: errorResult, timestamp: now });
      return errorResult;
    }

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

    let result;
    if (prices.length === 0) {
      result = null;
    } else {
      result = {
        min: Math.min(...prices),
        max: Math.max(...prices),
        avg: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
        count: prices.length
      };
    }
    otomotoPriceCache.set(url, { data: result, timestamp: now });
    return result;
  } catch (err) {
    console.error('[OB background] fetch failed:', err);
    const errorResult = { error: true };
    otomotoPriceCache.set(url, { data: errorResult, timestamp: now });
    return errorResult;
  }
}

// Fetch prices from Mobile.de (best effort)
async function fetchMobilePrices(url) {
  const now = Date.now();
  const cached = mobilePriceCache.get(url);
  if (cached && (now - cached.timestamp < MOBILE_CACHE_TTL)) {
    console.log('[Background] Using cached Mobile.de prices for:', url);
    return cached.data;
  }

  try {
    const response = await fetch(url, {
      headers: {
        'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8'
      }
    });

    if (!response.ok) {
      const errorResult = { error: true };
      mobilePriceCache.set(url, { data: errorResult, timestamp: now });
      return errorResult;
    }

    const html = await response.text();
    const jsonPrices = [];
    const textPrices = [];

    // Strategy 1: price JSON objects near "price" key
    // e.g. "price":{"amount":12199,"currency":"EUR"}
    const priceJsonRe = /"price"\s*:\s*\{[^}]*"amount"\s*:\s*(\d{3,8})[^}]*"currency"\s*:\s*"EUR"[^}]*\}/g;
    let match;
    while ((match = priceJsonRe.exec(html)) !== null) {
      const v = parseInt(match[1], 10);
      if (v >= 5000 && v <= 500000) jsonPrices.push(v);
    }

    // Strategy 2: HTML prices like "12.199 €" / "12 199 €"
    const eurTextRe = /(\d{1,3}(?:[.\s\u00a0]\d{3})+)\s*€/g;
    while ((match = eurTextRe.exec(html)) !== null) {
      const v = parseInt(match[1].replace(/[.\s\u00a0]/g, ''), 10);
      if (v >= 5000 && v <= 500000) textPrices.push(v);
    }

    // Prefer prices visible as "12.199 €" on listing cards
    const basePrices = (textPrices.length >= 10) ? textPrices : (textPrices.length > 0 ? textPrices : jsonPrices);
    const unique = Array.from(new Set(basePrices));

    let result;
    if (unique.length === 0) {
      // could be blocked or simply no results; caller will treat null as "no stats"
      result = null;
    } else {
      result = {
        min: Math.min(...unique),
        max: Math.max(...unique),
        avg: Math.round(unique.reduce((a, b) => a + b, 0) / unique.length),
        count: unique.length
      };
    }

    mobilePriceCache.set(url, { data: result, timestamp: now });
    return result;
  } catch (err) {
    console.error('[OB background] Mobile fetch failed:', err);
    const errorResult = { error: true };
    mobilePriceCache.set(url, { data: errorResult, timestamp: now });
    return errorResult;
  }
}

console.log('[OB Background] Service worker initialized');

// Test przy inicjalizacji
chrome.runtime.onInstalled.addListener(() => {
  console.log('[OB Background] Extension installed');
  updateActionState();
  isExtensionEnabled().then(enabled => {
    if (enabled) getEurRate();
  });
});

chrome.runtime.onStartup.addListener(() => {
  updateActionState();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local' || !changes[STORAGE_KEY_ENABLED]) {
    return;
  }

  updateActionState();
});
