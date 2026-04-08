// Content Script - v3.0
// Entry point dla Otomoto Blicker

(async function() {
  'use strict';

  const VERSION = '3.0.0';
  const AUTO1_FEES_PDF_URL = 'https://content.auto1.com/static/car_images/price_list_de_2026-01-01.pdf';
  const STORAGE_KEY_MARKET = 'ob_market_mode';
  console.log(`%c OB v${VERSION} %c loaded `, 
    'background:#1562d6;color:#fff;font-weight:bold;padding:2px 6px;border-radius:3px;', 
    'background:#0d1117;color:#fff;padding:2px 6px;');

  // Sprawdź czy jesteśmy na właściwej stronie
  if (!window.location.pathname.includes('/car/')) {
    return;
  }

  // Sprawdź czy klasy są załadowane
  if (typeof Auto1Scraper === 'undefined') {
    console.error('[OB] Auto1Scraper not loaded!');
    return;
  }

  const scraper = new Auto1Scraper();
  const urlBuilder = new OtomotoUrlBuilder();
  let matcher, feeCalculator;
  let eurRate = 4.3;
  let marketMode = 'PL';

  const strings = {
    PL: {
      matchTitle: '🎯 Dopasowanie',
      totalTitle: '💰 Cena całkowita',
      calcTitle: '🧮 Kalkulator',
      viewListing: 'Zobacz na Otomoto →',
      pricesTitle: (count) => `📊 Ceny na Otomoto (${count} ofert)`,
      pricesTitleNoCount: '📊 Ceny na Otomoto',
      pricesFetchError: 'Nie udało się pobrać cen z Otomoto',
      statMin: 'Min',
      statAvg: 'Śred',
      statMax: 'Max',
      carLabel: 'Auto',
      auto1FeesLabel: 'Opłaty Auto1',
      totalEurLabel: 'Razem EUR',
      totalPlnLabel: 'Razem PLN',
      feesPdf: 'Tabela opłat Auto1 (PDF)',
      rateLabel: (rate) => `1 EUR = ${rate.toFixed(2)} PLN`,
      priceNotRead: '— (nie odczytano)',
      feesNoTable: '— (brak cennika)',
      errLoadData: 'Nie udało się załadować danych (mapping lub cennik).',
      errScrape: 'Nie udało się odczytać danych auta ze strony.',
      errFatal: 'Nie udało się załadować danych. Sprawdź konsolę (F12).'
      ,
      confHigh: '✓ Trafne',
      confMedium: '~ Bliskie',
      confLow: '? Ogólne'
    },
    DE: {
      matchTitle: '🎯 Zuordnung',
      totalTitle: '💰 Gesamtpreis',
      calcTitle: '🧮 Rechner',
      viewListing: 'Auf Mobile.de ansehen →',
      pricesTitle: (count) => `📊 Preise auf Mobile.de (${count} Anzeigen)`,
      pricesTitleNoCount: '📊 Preise auf Mobile.de',
      pricesFetchError: 'Preise von Mobile.de konnten nicht geladen werden',
      statMin: 'Min',
      statAvg: 'Ø',
      statMax: 'Max',
      carLabel: 'Auto',
      auto1FeesLabel: 'AUTO1 Gebühren',
      totalEurLabel: 'Summe EUR',
      feesPdf: 'AUTO1 Gebühren (PDF)',
      priceNotRead: '— (nicht gelesen)',
      feesNoTable: '— (keine Tabelle)',
      errLoadData: 'Daten konnten nicht geladen werden (Mapping/Gebühren).',
      errScrape: 'Fahrzeugdaten konnten nicht gelesen werden.',
      errFatal: 'Laden fehlgeschlagen. Bitte Konsole öffnen (F12).'
      ,
      confHigh: '✓ Treffer',
      confMedium: '~ Ähnlich',
      confLow: '? Allgemein'
    }
  };

  function t() {
    return strings[marketMode] || strings.PL;
  }

  async function loadMarketMode() {
    try {
      const stored = await chrome.storage.local.get([STORAGE_KEY_MARKET]);
      const mode = stored[STORAGE_KEY_MARKET];
      marketMode = (mode === 'DE' || mode === 'PL') ? mode : 'PL';
    } catch (_e) {
      marketMode = 'PL';
    }
  }

  async function setMarketMode(mode) {
    marketMode = mode;
    await chrome.storage.local.set({ [STORAGE_KEY_MARKET]: mode });
  }

  // Załaduj dane
  async function loadData() {
    try {
      const [mappingRes, feesRes] = await Promise.all([
        fetch(chrome.runtime.getURL('otomoto_mapping.json')),
        fetch(chrome.runtime.getURL('data/auto1_fees_2026.json'))
      ]);
      const [mapping, fees] = await Promise.all([mappingRes.json(), feesRes.json()]);
      matcher = new OtomotoMatcher(mapping);
      feeCalculator = new Auto1FeeCalculator(fees);
      eurRate = await getEurRate();
      Helpers.log('Data loaded successfully');
      return true;
    } catch (error) {
      Helpers.error('Failed to load data:', error);
      return false;
    }
  }

  function getEurRate() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'GET_EUR_RATE' }, (rate) => {
        if (chrome.runtime.lastError) {
          resolve(4.3);
        } else {
          resolve(rate || 4.3);
        }
      });
    });
  }

  // Główna funkcja
  async function main() {
    Helpers.log('Starting analysis...');

    await loadMarketMode();

    const loaded = await loadData();
    if (!loaded) {
      renderErrorPanel(t().errLoadData);
      return;
    }

    // Renderuj panel natychmiast ze stanem ładowania
    renderLoadingPanel();

    await Helpers.waitForElement('.ctaBar__name, .car-info-title', 10000).catch(() => {});

    const carData = scraper.scrape();
    Helpers.log('Car data:', carData);

    if (!carData.make || !carData.title) {
      Helpers.error('Failed to scrape car data');
      renderErrorPanel(t().errScrape);
      return;
    }

    let matchResult = await matcher.match(carData.make, carData.title, carData);
    let otomotoUrl;

    if (!matchResult) {
      matchResult = { label: carData.make || 'Szukaj na Otomoto', slug: '', confidence: 'low' };
      otomotoUrl = `https://www.otomoto.pl/osobowe/${carData.make}`;
    } else {
      otomotoUrl = urlBuilder.buildWithRanges(carData.make, matchResult, carData);
    }

    const carLocation = Helpers.normalizeCountry(carData.location || 'DE');
    const buyerCountry = 'DE';
    let fees = feeCalculator.calculate(carLocation, buyerCountry, carData.priceEur, {
      includeTransport: false,
      hasSecondWheelSet: !!carData.hasSecondWheelSet,
      auctionFeeEur: carData.auctionFeeEur,
      includeVat: false
    });
    if (!fees) {
      fees = feeCalculator.calculate(carLocation, 'DE', carData.priceEur, {
        includeTransport: false,
        hasSecondWheelSet: !!carData.hasSecondWheelSet,
        auctionFeeEur: carData.auctionFeeEur,
        includeVat: false
      });
    }
    const feesUnavailable = !fees;
    if (!fees) {
      fees = {
        total: 0,
        breakdown: [],
        subtotal: 0,
        vat: 0
      };
    }

    const totalPrice = feeCalculator.calculateTotalPrice(carData.priceEur, fees);
    const totalPricePln = (marketMode === 'PL')
      ? feeCalculator.convertToPln(totalPrice.total, eurRate)
      : 0;

    const listing = marketMode === 'DE'
      ? { url: buildMobileUrl(carData, matchResult), market: 'mobile' }
      : { url: otomotoUrl, market: 'otomoto' };

    const priceStats = await (listing.market === 'mobile'
      ? Promise.resolve(null) // tryb DE: tylko link, bez statystyk
      : fetchPricesFromOtomoto(listing.url));

    // Renderuj pełny panel
    renderPanel({
      carData,
      matchResult,
      otomotoUrl,
      listingUrl: listing.url,
      marketMode,
      fees,
      totalPrice,
      totalPricePln,
      eurRate,
      feesUnavailable
    }, priceStats);
  }

  async function fetchPricesFromOtomoto(url) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'FETCH_OTOMOTO_PRICES', url }, (prices) => {
        if (chrome.runtime.lastError) resolve(null);
        else resolve(prices);
      });
    });
  }

  async function fetchPricesFromMobile(url) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'FETCH_MOBILE_PRICES', url }, (prices) => {
        if (chrome.runtime.lastError) resolve({ error: true });
        else resolve(prices);
      });
    });
  }

  function buildMobileUrl(carData, matchResult) {
    const base = 'https://suchen.mobile.de/fahrzeuge/search.html';
    const params = new URLSearchParams();
    params.set('isSearchRequest', 'true');
    params.set('vc', 'Car');
    params.set('dam', 'false');
    params.set('sfmr', 'false');
    params.set('cn', 'DE');
    params.set('s', 'Car');
    params.set('sb', 'p');   // sort by price
    params.set('od', 'up');  // ascending

    const year = carData.year ? parseInt(carData.year, 10) : null;
    if (year) {
      params.set('fr', `${year - 1}:${year + 1}`);
    }

    if (carData.mileage) {
      params.set('ml', `:${carData.mileage + 40000}`);
    }

    if (carData.fuel) {
      const fuel = carData.fuel.toLowerCase();
      const fuelMap = {
        benzyna: 'PETROL',
        diesel: 'DIESEL',
        hybryda: 'HYBRID',
        elektryczny: 'ELECTRICITY',
        lpg: 'LPG'
      };
      const mapped = fuelMap[fuel];
      if (mapped) params.set('ft', mapped);
    }

    if (carData.transmission) {
      const trans = carData.transmission === 'automatic' ? 'AUTOMATIC_GEAR' : 'MANUAL_GEAR';
      params.set('tr', trans);
    }

    if (carData.power) {
      // Auto1 scraper stores power in HP, convert back to kW for Mobile.de filters
      const powerKw = Math.max(0, Math.round(carData.power / 1.36));
      const from = Math.max(0, powerKw - 10);
      const to = powerKw + 10;
      params.set('pw', `${from}:${to}`);
    }

    return `${base}?${params.toString()}`;
  }

  // ── Loading skeleton panel ──────────────────────────────────────────
  function renderLoadingPanel() {
    const old = document.getElementById('ob-panel-v3');
    if (old) old.remove();

    const panel = document.createElement('div');
    panel.id = 'ob-panel-v3';
    panel.className = 'ob-panel';
    panel.innerHTML = `
      <div class="ob-header">
        <div class="ob-logo">
          <span>🚗</span>
          <span>Otomoto Blicker</span>
          <span class="ob-version">v${VERSION}</span>
        </div>
      </div>
      <div class="ob-content">
        <div class="ob-skeleton">
          <div class="ob-skeleton-line"></div>
          <div class="ob-skeleton-line"></div>
          <div class="ob-skeleton-line"></div>
        </div>
      </div>
    `;
    document.body.appendChild(panel);
    makePanelDraggable(panel);
  }

  // ── Full panel ─────────────────────────────────────────────────────
  function renderPanel(data, priceStats) {
    const old = document.getElementById('ob-panel-v3');
    if (old) old.remove();

    const panel = document.createElement('div');
    panel.id = 'ob-panel-v3';
    panel.className = 'ob-panel';

    const isDE = data.marketMode === 'DE';
    const statsHtml = isDE
      ? '' // tryb DE: tylko link, bez statystyk
      : priceStats && priceStats.error
        ? `<div class="ob-section"><div class="ob-section-title">${t().pricesTitleNoCount}</div><div class="ob-msg ob-msg-error">${t().pricesFetchError}</div></div>`
        : priceStats
          ? `
      <div class="ob-section">
        <div class="ob-section-title">${t().pricesTitle(priceStats.count)}</div>
        <div class="ob-stats-grid">
          <div class="ob-stat-card">
            <div class="ob-stat-card-label">${t().statMin}</div>
            <div class="ob-stat-card-value min">${fmtPln(priceStats.min)}</div>
            <div class="ob-stat-card-sub">${fmtEur(priceStats.min, data.eurRate)}</div>
          </div>
          <div class="ob-stat-card">
            <div class="ob-stat-card-label">${t().statAvg}</div>
            <div class="ob-stat-card-value avg">${fmtPln(priceStats.avg)}</div>
            <div class="ob-stat-card-sub">${fmtEur(priceStats.avg, data.eurRate)}</div>
          </div>
          <div class="ob-stat-card">
            <div class="ob-stat-card-label">${t().statMax}</div>
            <div class="ob-stat-card-value max">${fmtPln(priceStats.max)}</div>
            <div class="ob-stat-card-sub">${fmtEur(priceStats.max, data.eurRate)}</div>
          </div>
        </div>
      </div>
    `
          : '';

    panel.innerHTML = `
      <div class="ob-header">
        <div class="ob-logo">
          <span>🚗</span>
          <span>Otomoto Blicker</span>
          <span class="ob-version">v${VERSION}</span>
        </div>
        <div class="ob-controls">
          <div class="ob-market-toggle" role="group" aria-label="Market">
            <button class="ob-market-btn ${data.marketMode === 'PL' ? 'active' : ''}" id="ob-market-pl" type="button" title="PL">🇵🇱</button>
            <button class="ob-market-btn ${data.marketMode === 'DE' ? 'active' : ''}" id="ob-market-de" type="button" title="DE">🇩🇪</button>
          </div>
          <button class="ob-minimize" id="ob-minimize" title="Minimize">−</button>
        </div>
      </div>

      <div class="ob-content" id="ob-content">
        <div class="ob-section">
          <div class="ob-section-title">${t().matchTitle}</div>
          <div class="ob-match">
            <span class="ob-match-label">${data.matchResult.label}</span>
            <span class="ob-match-badge ${data.matchResult.confidence}">
              ${data.matchResult.confidence === 'high' ? t().confHigh : data.matchResult.confidence === 'medium' ? t().confMedium : t().confLow}
            </span>
          </div>
          <a href="${data.listingUrl}" target="_blank" class="ob-link">
            ${t().viewListing}
          </a>
        </div>

        <div class="ob-section">
          <div class="ob-section-title">${t().totalTitle}</div>
          <div class="ob-price-grid">
            <span class="ob-price-label">${t().carLabel}</span>
            <span class="ob-price-value">${data.carData.priceEur === 0 ? t().priceNotRead : Helpers.formatPrice(data.carData.priceEur, 'EUR')}</span>
            <span class="ob-price-label">${t().auto1FeesLabel}</span>
            <span class="ob-price-value">${data.feesUnavailable ? t().feesNoTable : '+ ' + Helpers.formatPrice(data.fees.total, 'EUR')}</span>
            <div class="ob-price-divider"></div>
            <span class="ob-price-label">${t().totalEurLabel}</span>
            <span class="ob-price-value total">${data.totalPrice.total === 0 ? '—' : Helpers.formatPrice(data.totalPrice.total, 'EUR')}</span>
            ${isDE ? '' : `
              <span class="ob-price-label">${t().totalPlnLabel}</span>
              <span class="ob-price-value pln">${data.totalPricePln === 0 ? '—' : Helpers.formatPrice(data.totalPricePln, 'PLN')}</span>
            `}
          </div>
        </div>

        ${statsHtml}

        <div class="ob-section">
          <div class="ob-section-title">${t().calcTitle}</div>
          <div class="ob-calc">
            <input id="ob-calc-input" class="ob-calc-input" type="text" placeholder="${data.marketMode === 'DE' ? 'z.B. 40000/4.2-3000' : 'np. 40000/4.2-3000'}" spellcheck="false" autocomplete="off" />
            <div id="ob-calc-result" class="ob-calc-result">—</div>
          </div>
        </div>

        <div class="ob-footer">
          <a href="${AUTO1_FEES_PDF_URL}" target="_blank" class="ob-footer-link">${t().feesPdf}</a>
          ${isDE ? '' : `<span>${t().rateLabel(data.eurRate)}</span>`}
        </div>
      </div>
    `;

    document.body.appendChild(panel);
    makePanelDraggable(panel);

    const plBtn = document.getElementById('ob-market-pl');
    const deBtn = document.getElementById('ob-market-de');
    plBtn?.addEventListener('click', async (e) => {
      e.preventDefault();
      await setMarketMode('PL');
      main();
    });
    deBtn?.addEventListener('click', async (e) => {
      e.preventDefault();
      await setMarketMode('DE');
      main();
    });

    document.getElementById('ob-minimize').addEventListener('click', () => {
      const content = document.getElementById('ob-content');
      const btn = document.getElementById('ob-minimize');
      const isHidden = content.style.display === 'none';
      content.style.display = isHidden ? 'block' : 'none';
      btn.textContent = isHidden ? '−' : '+';
    });

    setupCalculator(data.eurRate);

    Helpers.log('Panel rendered');
  }

  // ── Calculator ─────────────────────────────────────────────────────
  function setupCalculator(rate) {
    const calcInput = document.getElementById('ob-calc-input');
    const calcResult = document.getElementById('ob-calc-result');

    const evaluateExpression = (expression) => {
      const normalized = expression.replace(/,/g, '.').replace(/\s+/g, '');
      const tokens = normalized.match(/(\d+(?:\.\d+)?)|[()+\-*/]/g);
      if (!tokens || tokens.join('') !== normalized) throw new Error('Invalid expression');

      const precedence = { '+': 1, '-': 1, '*': 2, '/': 2 };
      const values = [];
      const operators = [];

      const applyOperator = () => {
        const operator = operators.pop();
        const right = values.pop();
        const left = values.pop();
        if (left === undefined || right === undefined) throw new Error('Invalid expression');
        if (operator === '+') values.push(left + right);
        if (operator === '-') values.push(left - right);
        if (operator === '*') values.push(left * right);
        if (operator === '/') values.push(left / right);
      };

      tokens.forEach((token, index) => {
        if (/^\d/.test(token)) { values.push(parseFloat(token)); return; }
        if (token === '(') { operators.push(token); return; }
        if (token === ')') {
          while (operators.length && operators[operators.length - 1] !== '(') applyOperator();
          if (operators.pop() !== '(') throw new Error('Invalid expression');
          return;
        }
        if ((token === '-' || token === '+') && (index === 0 || ['(', '+', '-', '*', '/'].includes(tokens[index - 1]))) values.push(0);
        while (operators.length && operators[operators.length - 1] !== '(' && precedence[operators[operators.length - 1]] >= precedence[token]) applyOperator();
        operators.push(token);
      });

      while (operators.length) {
        if (operators[operators.length - 1] === '(') throw new Error('Invalid expression');
        applyOperator();
      }
      if (values.length !== 1 || !Number.isFinite(values[0])) throw new Error('Invalid result');
      return values[0];
    };

    const update = () => {
      const expression = calcInput.value.trim();
      if (!expression) { calcResult.textContent = '—'; return; }
      if (!/^[\d\s.,+\-*/()]+$/.test(expression)) { calcResult.textContent = 'Błąd'; return; }
      try {
        const value = evaluateExpression(expression);
        calcResult.innerHTML = `
          <span class="ob-calc-result-main">${Helpers.formatPrice(Math.round(value))}</span>
        `;
      } catch (_e) {
        calcResult.textContent = 'Błąd';
      }
    };

    calcInput.addEventListener('input', update);
    calcInput.addEventListener('focus', () => calcInput.select());
    update();
  }

  // ── Helpers ────────────────────────────────────────────────────────
  function fmtPln(pln) {
    return Helpers.formatPrice(pln, 'PLN');
  }
  function fmtEurAmount(eur) {
    return Helpers.formatPrice(eur, 'EUR');
  }
  function fmtEur(pln, rate) {
    return Helpers.formatPrice(Math.round(pln / rate), 'EUR');
  }

  function renderErrorPanel(message) {
    const old = document.getElementById('ob-panel-v3');
    if (old) old.remove();
    const panel = document.createElement('div');
    panel.id = 'ob-panel-v3';
    panel.className = 'ob-panel';
    panel.innerHTML = `
      <div class="ob-header">
        <div class="ob-logo">
          <span>🚗</span>
          <span>Otomoto Blicker</span>
          <span class="ob-version">v${VERSION}</span>
        </div>
      </div>
      <div class="ob-content">
        <div class="ob-section">
          <div class="ob-msg ob-msg-error">${typeof message === 'string' ? message : 'Wystąpił błąd. Sprawdź konsolę.'}</div>
        </div>
      </div>
    `;
    document.body.appendChild(panel);
    makePanelDraggable(panel);
  }

  // ── Draggable panel ────────────────────────────────────────────────
  function makePanelDraggable(panel) {
    const header = panel.querySelector('.ob-header');
    if (!header) return;

    let isDragging = false;
    let offsetX = 0;
    let offsetY = 0;

    header.addEventListener('mousedown', (event) => {
      if (event.button !== 0) return;
      if (event.target && event.target.closest && event.target.closest('button,a,input,select,textarea')) return;
      isDragging = true;
      const rect = panel.getBoundingClientRect();
      offsetX = event.clientX - rect.left;
      offsetY = event.clientY - rect.top;
      panel.style.right = 'auto';
      panel.style.left = `${rect.left}px`;
      panel.style.top = `${rect.top}px`;
      event.preventDefault();
    });

    window.addEventListener('mousemove', (event) => {
      if (!isDragging) return;
      const x = event.clientX - offsetX;
      const y = event.clientY - offsetY;
      panel.style.left = `${Math.max(0, x)}px`;
      panel.style.top = `${Math.max(0, y)}px`;
    });

    window.addEventListener('mouseup', () => {
      if (!isDragging) return;
      isDragging = false;
    });
  }

  main().catch(error => {
    Helpers.error('Fatal error:', error);
    renderErrorPanel(t().errFatal);
  });

})();
