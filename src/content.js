// Content Script - v3.0
// Entry point dla Otomoto Blicker

(async function() {
  'use strict';

  const VERSION = '3.0.0';
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

    const loaded = await loadData();
    if (!loaded) return;

    // Renderuj panel natychmiast ze stanem ładowania
    renderLoadingPanel();

    await Helpers.waitForElement('.ctaBar__name, .car-info-title', 10000).catch(() => {});

    const carData = scraper.scrape();
    Helpers.log('Car data:', carData);

    if (!carData.make || !carData.title) {
      Helpers.error('Failed to scrape car data');
      return;
    }

    let matchResult = await matcher.match(carData.make, carData.title);
    let otomotoUrl;

    if (!matchResult) {
      matchResult = { label: carData.make || 'Szukaj na Otomoto', slug: '', confidence: 'low' };
      otomotoUrl = `https://www.otomoto.pl/osobowe/${carData.make}`;
    } else {
      otomotoUrl = urlBuilder.buildWithRanges(carData.make, matchResult, carData);
    }

    const carLocation = Helpers.normalizeCountry(carData.location || 'DE');
    const fees = feeCalculator.calculate(carLocation, 'DE', carData.priceEur, {
      includeTransport: true,
      hasSecondWheelSet: false
    });

    const totalPrice = feeCalculator.calculateTotalPrice(carData.priceEur, fees);
    const totalPricePln = feeCalculator.convertToPln(totalPrice.total, eurRate);

    // Fetch cen z Otomoto
    const priceStats = await fetchPricesFromOtomoto(otomotoUrl);

    // Renderuj pełny panel
    renderPanel({ carData, matchResult, otomotoUrl, fees, totalPrice, totalPricePln, eurRate }, priceStats);
  }

  async function fetchPricesFromOtomoto(url) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'FETCH_OTOMOTO_PRICES', url }, (prices) => {
        if (chrome.runtime.lastError) resolve(null);
        else resolve(prices);
      });
    });
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
  }

  // ── Full panel ─────────────────────────────────────────────────────
  function renderPanel(data, priceStats) {
    const old = document.getElementById('ob-panel-v3');
    if (old) old.remove();

    const panel = document.createElement('div');
    panel.id = 'ob-panel-v3';
    panel.className = 'ob-panel';

    const statsHtml = priceStats ? `
      <div class="ob-section">
        <div class="ob-section-title">📊 Ceny na Otomoto (${priceStats.count} ofert)</div>
        <div class="ob-stats-grid">
          <div class="ob-stat-card">
            <div class="ob-stat-card-label">Min</div>
            <div class="ob-stat-card-value min">${fmtPln(priceStats.min)}</div>
            <div class="ob-stat-card-sub">${fmtEur(priceStats.min, data.eurRate)}</div>
          </div>
          <div class="ob-stat-card">
            <div class="ob-stat-card-label">Śred</div>
            <div class="ob-stat-card-value avg">${fmtPln(priceStats.avg)}</div>
            <div class="ob-stat-card-sub">${fmtEur(priceStats.avg, data.eurRate)}</div>
          </div>
          <div class="ob-stat-card">
            <div class="ob-stat-card-label">Max</div>
            <div class="ob-stat-card-value max">${fmtPln(priceStats.max)}</div>
            <div class="ob-stat-card-sub">${fmtEur(priceStats.max, data.eurRate)}</div>
          </div>
        </div>
      </div>
    ` : '';

    panel.innerHTML = `
      <div class="ob-header">
        <div class="ob-logo">
          <span>🚗</span>
          <span>Otomoto Blicker</span>
          <span class="ob-version">v${VERSION}</span>
        </div>
        <button class="ob-minimize" id="ob-minimize" title="Zwiń panel">−</button>
      </div>

      <div class="ob-content" id="ob-content">
        <div class="ob-section">
          <div class="ob-section-title">🎯 Dopasowanie</div>
          <div class="ob-match">
            <span class="ob-match-label">${data.matchResult.label}</span>
            <span class="ob-match-badge ${data.matchResult.confidence}">
              ${data.matchResult.confidence === 'high' ? '✓ Trafne' : data.matchResult.confidence === 'medium' ? '~ Bliskie' : '? Ogólne'}
            </span>
          </div>
          <a href="${data.otomotoUrl}" target="_blank" class="ob-link">
            Zobacz na Otomoto →
          </a>
        </div>

        <div class="ob-section">
          <div class="ob-section-title">💰 Cena całkowita</div>
          <div class="ob-price-grid">
            <span class="ob-price-label">Auto</span>
            <span class="ob-price-value">${Helpers.formatPrice(data.carData.priceEur, 'EUR')}</span>
            <span class="ob-price-label">Opłaty Auto1</span>
            <span class="ob-price-value">+ ${Helpers.formatPrice(data.fees.total, 'EUR')}</span>
            <div class="ob-price-divider"></div>
            <span class="ob-price-label">Razem EUR</span>
            <span class="ob-price-value total">${Helpers.formatPrice(data.totalPrice.total, 'EUR')}</span>
            <span class="ob-price-label">Razem PLN</span>
            <span class="ob-price-value pln">${Helpers.formatPrice(data.totalPricePln, 'PLN')}</span>
          </div>
        </div>

        ${statsHtml}

        <div class="ob-section">
          <div class="ob-section-title">🧮 Kalkulator</div>
          <div class="ob-calc">
            <input id="ob-calc-input" class="ob-calc-input" type="text" placeholder="np. 40000/4.2-3000" spellcheck="false" autocomplete="off" />
            <div id="ob-calc-result" class="ob-calc-result">—</div>
          </div>
        </div>

        <div class="ob-footer">
          1 EUR = ${data.eurRate.toFixed(2)} PLN
        </div>
      </div>
    `;

    document.body.appendChild(panel);

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
  function fmtEur(pln, rate) {
    return Helpers.formatPrice(Math.round(pln / rate), 'EUR');
  }

  main().catch(error => Helpers.error('Fatal error:', error));

})();
