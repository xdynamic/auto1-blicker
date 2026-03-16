// Dashboard Price Tracker - v1.0
// Śledzenie zmian cen na Ulubionychach (watchlist)

(async function() {
  'use strict';

  console.log('[OB Dashboard] Price tracker loaded');

  // Przechwyć fetch requests do watchlist API
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    const [resource] = args;
    const url = typeof resource === 'string' ? resource : resource.url;

    return originalFetch.apply(this, args).then(response => {
      // Sprawdź czy to watchlist API
      if (url && url.includes('watchlist-tab')) {
        response
          .clone()
          .json()
          .then(data => {
            if (data.entities) {
              console.log('[OB Dashboard] Watchlist data received, entities:', data.entities.length);
              trackWatchlistPrices(data.entities);
            }
          })
          .catch(e => console.error('[OB Dashboard] Error parsing response:', e));
      }

      return response;
    });
  };

  // Zapisz ceny do storage
  async function trackWatchlistPrices(entities) {
    for (const entity of entities) {
      const { stockNumber, price } = entity;
      if (!stockNumber || !price || !price.price) continue;

      const priceEur = Math.round(price.price / 100); // Convert from minor units
      await savePriceSnapshot(stockNumber, priceEur);
      console.log(`[OB Dashboard] Saved price for ${stockNumber}: ${priceEur}€`);
    }

    // Teraz injectuj badge'i do DOM
    injectPriceBadges(entities);
  }

  async function savePriceSnapshot(stockNumber, priceEur) {
    try {
      const key = `ob_watchlist_${stockNumber}`;
      const stored = await chrome.storage.local.get([key]);
      const prices = stored[key] || [];

      prices.push({
        price: priceEur,
        timestamp: Date.now()
      });

      // Łrzeechowaj tylko ostatnie 100 snapshots
      const keepLast = prices.slice(-100);
      await chrome.storage.local.set({ [key]: keepLast });
    } catch (e) {
      console.error('[OB Dashboard] Error saving price:', e);
    }
  }

  async function getPriceChange(stockNumber) {
    try {
      const key = `ob_watchlist_${stockNumber}`;
      const stored = await chrome.storage.local.get([key]);
      const prices = stored[key] || [];

      if (prices.length < 2) return null;

      const current = prices[prices.length - 1].price;
      const previous = prices[prices.length - 2].price;
      const change = current - previous;
      const changePercent = ((change / previous) * 100).toFixed(1);

      return {
        change,
        changePercent,
        trend: change > 0 ? '↑' : change < 0 ? '↓' : '→',
        trendClass: change > 0 ? 'up' : change < 0 ? 'down' : 'stable'
      };
    } catch (e) {
      console.error('[OB Dashboard] Error calculating change:', e);
      return null;
    }
  }

  function injectPriceBadges(entities) {
    // Czekaj trochę żeby DOM się załadował
    setTimeout(async () => {
      for (const entity of entities) {
        const { stockNumber } = entity;
        const priceChange = await getPriceChange(stockNumber);

        if (!priceChange) continue;

        // Szukaj elementu ceny dla tego samochodu
        // Struktura: każdy element ma data-qa-id lub inne identyfikatory
        const priceElements = Array.from(
          document.querySelectorAll('[class*="price"], [data-qa*="price"]')
        ).filter(el => {
          const text = el.textContent;
          return text.includes('€') || text.includes('EUR');
        });

        // Injectuj badge obok każdej ceny (jeśli należy do tego stockNumber)
        // Heurystyka: szukaj stock number w najbliższym kontenere
        for (const priceEl of priceElements) {
          const container = priceEl.closest('[class*="card"], [class*="item"], [class*="row"]');
          if (container && container.textContent.includes(stockNumber)) {
            injectBadge(container, priceChange);
            break; // Tylko jeden badge per auto
          }
        }
      }
    }, 500);
  }

  function injectBadge(container, priceChange) {
    // Sprawdź czy już istnieje badge
    if (container.querySelector('[data-ob-badge]')) return;

    const badge = document.createElement('div');
    badge.setAttribute('data-ob-badge', 'true');
    badge.className = `ob-watchlist-badge ob-watchlist-${priceChange.trendClass}`;
    badge.textContent = `${priceChange.trend} ${Math.abs(priceChange.change)}€`;
    badge.title = `${priceChange.changePercent}%`;

    // Style inline dla szybkości
    badge.style.cssText = `
      display: inline-block;
      padding: 4px 8px;
      margin-left: 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
      background: rgba(0,0,0,0.05);
      border: 1px solid;
      cursor: default;
      white-space: nowrap;
    `;

    // Kolory w zależności od trendu
    if (priceChange.trendClass === 'up') {
      badge.style.color = '#ff6b6b';
      badge.style.borderColor = '#ff6b6b';
    } else if (priceChange.trendClass === 'down') {
      badge.style.color = '#51cf66';
      badge.style.borderColor = '#51cf66';
    } else {
      badge.style.color = '#74c0fc';
      badge.style.borderColor = '#74c0fc';
    }

    // Dodaj badge obok ceny
    const priceElement = container.querySelector('[class*="price"]');
    if (priceElement) {
      priceElement.parentElement.appendChild(badge);
      console.log('[OB Dashboard] Badge injected');
    }
  }
})();
