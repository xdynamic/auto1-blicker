// Content Script for Otomoto Blicker - v2.0.1 (Fixed URL & Reliable Injection)

(function () {
  const VERSION = "2.0.1";
  console.log(`%c OB v${VERSION} %c loaded `, "background:#00f2fe;color:#000;font-weight:bold;", "background:#1e293b;color:#fff;");

  let lastUrl = location.href;
  let injectionRetries = 0;
  const MAX_RETRIES = 20;

  const getState = () => { try { return sessionStorage.getItem('ob-minimized') === 'true'; } catch (e) { return false; } };
  const setState = v => { try { sessionStorage.setItem('ob-minimized', v); } catch (e) { } };

  function scrapeAuto1() {
    const data = { make: "", model: "", modelSlug: "", year: "", fuel: "", capacity: 0, priceEur: 0 };

    // ── 1. Title ──────────────────────────────────────────────────────────────
    const titleEl =
      document.querySelector('[data-qa-id="car-title"]') ||
      document.querySelector('.car-info-title h2') ||
      document.querySelector('.car-title h1') ||
      document.querySelector('h1');

    if (titleEl) {
      const title = titleEl.innerText.trim();
      const parts = title.split(/\s+/);
      data.make = parts[0];
      data.model = parts.slice(1).join(' ');
      // modelSlug = only first word of model (e.g. "V60" from "V60 2.0 T8 Recharge...")
      data.modelSlug = (parts[1] || "").toLowerCase().replace(/[^a-z0-9-]/g, '');
      console.log(`[OB] Title: "${title}", modelSlug="${data.modelSlug}"`);
    }

    // ── 2. Table rows for spec data ───────────────────────────────────────────
    document.querySelectorAll('tr').forEach(row => {
      const cells = row.querySelectorAll('td');
      if (cells.length < 2) return;
      const label = cells[0].innerText.toLowerCase();
      const value = cells[cells.length - 1].innerText.trim();
      if (!value) return;
      if (label.includes('rok') || label.includes('year')) data.year = value.replace(/\D/g, '').slice(0, 4);
      if (label.includes('paliw') || label.includes('fuel')) data.fuel = value;
      if (label.includes('pojemn') || label.includes('capacity')) {
        const m = value.match(/(\d[\d\s]*)/);
        if (m) data.capacity = parseInt(m[1].replace(/\s/g, ''));
      }
    });

    // ── 3. Price: DOM selectors ───────────────────────────────────────────────
    const priceSelectors = [
      '[data-qa-id="original-a1-price"]',
      '[data-qa-id="listing-details-price"]',
      '[data-testid="price"]',
      '.price__main-value',
      '.price-value--main',
      '.priceContainer__value',
      '.savingsBlock__row--value',
      '.price-value',
      '.car-price-value',
    ];

    for (const sel of priceSelectors) {
      const el = document.querySelector(sel);
      if (el && el.innerText.trim()) {
        const val = parseInt(el.innerText.replace(/[^\d]/g, ''));
        if (val > 100) { data.priceEur = val; console.log(`[OB] Price via "${sel}": ${val}`); break; }
      }
    }

    // ── 4. Price: embedded JSON state ─────────────────────────────────────────
    if (!data.priceEur) {
      const patterns = [
        /"price":\s*\{[^}]*"value"\s*:\s*(\d+)/,
        /"currentBid"\s*:\s*(\d+)/,
        /"a1Price"\s*:\s*(\d+)/,
        /"buyNowPrice"\s*:\s*(\d+)/,
        /"valuation"\s*:\s*(\d+)/,
        /"price"\s*:\s*(\d+)/,
      ];
      for (const script of document.querySelectorAll('script:not([src])')) {
        for (const pattern of patterns) {
          const m = script.textContent.match(pattern);
          if (m) {
            const val = parseInt(m[1]);
            if (val > 100 && val < 200000) { data.priceEur = val; console.log(`[OB] Price from JSON: ${val}`); break; }
          }
        }
        if (data.priceEur) break;
      }
    }

    // ── 5. Price: text scan for "NNN €" ───────────────────────────────────────
    if (!data.priceEur) {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        const m = node.textContent.match(/(\d[\d\s.,]{2,})\s*€/);
        if (m && !['SCRIPT', 'STYLE'].includes(node.parentElement?.tagName)) {
          const val = parseInt(m[1].replace(/[\s.,]/g, ''));
          if (val > 200 && val < 200000) { data.priceEur = val; console.log(`[OB] Price from text: ${val}`); break; }
        }
      }
    }

    console.log("[OB] Scraped:", JSON.stringify(data));
    return data;
  }

  function getAuto1Fees(priceEur) {
    const base = 289 + 159; // handling + docs
    let auction = 849;
    if (priceEur <= 500) auction = 99;
    else if (priceEur <= 1000) auction = 149;
    else if (priceEur <= 2500) auction = 249;
    else if (priceEur <= 5000) auction = 349;
    else if (priceEur <= 10000) auction = 449;
    else if (priceEur <= 15000) auction = 549;
    else if (priceEur <= 20000) auction = 649;
    else if (priceEur <= 30000) auction = 749;
    return base + auction;
  }

  function getSearchUrls(d) {
    const make = (d.make || "").toLowerCase().trim();
    // Use ONLY first word of model in URL (Otomoto can't parse long model strings)
    const modelSlug = d.modelSlug || "";

    // Build clean path: /osobowe/volvo/v60/od-2019/
    let base = `https://www.otomoto.pl/osobowe/${make}/`;
    if (modelSlug) base += `${modelSlug}/`;

    const p = new URLSearchParams();
    if (d.year) {
      base += `od-${d.year}/`;
      // Only lower bound — show this year and newer
    }

    const fl = (d.fuel || "").toLowerCase();
    if (fl.includes('diesel')) p.append("search[filter_enum_fuel_type]", "diesel");
    else if (fl.includes('benzyn') || fl.includes('petrol')) p.append("search[filter_enum_fuel_type]", "petrol");
    else if (fl.includes('hybryd') || fl.includes('hybrid')) p.append("search[filter_enum_fuel_type]", "hybrid");
    else if (fl.includes('elektr')) p.append("search[filter_enum_fuel_type]", "electric");

    p.append("search[order]", "filter_float_price:asc");

    return {
      otomoto: base + '?' + p.toString(),
      mobileDe: `https://suchen.mobile.de/fahrzeuge/search.html?dam=0&isSearchRequest=true&makeModelVariant1.modelDescription=${make}+${modelSlug}&minFirstRegistrationDate=${d.year}&maxFirstRegistrationDate=${d.year}&sortOption.sortBy=price&sortOption.sortOrder=ASCENDING`
    };
  }

  function injectUI() {
    if (!location.pathname.includes('/car/')) return;
    if (document.getElementById('ob-root')) return;

    const d = scrapeAuto1();

    // Wait for make to be available; inject anyway after all retries
    if (!d.make) {
      if (injectionRetries < MAX_RETRIES) {
        injectionRetries++;
        setTimeout(injectUI, 1000);
      }
      return;
    }

    const urls = getSearchUrls(d);
    const fees = d.priceEur ? getAuto1Fees(d.priceEur) : null;
    const feesText = fees ? `+ ${fees.toLocaleString()} EUR` : "— EUR";

    let akcyzaRate = d.capacity > 2000 ? 18.6 : 3.1;
    if (d.fuel.toLowerCase().includes('hybryd') || d.fuel.toLowerCase().includes('hybrid')) {
      akcyzaRate = d.capacity > 2000 ? 9.3 : 1.55;
    }
    if (d.fuel.toLowerCase().includes('elektr')) akcyzaRate = 0;

    const container = document.createElement('div');
    container.id = 'ob-root';

    container.addEventListener('click', e => {
      if (container.classList.contains('ob-min')) {
        setState(false); render(false); return;
      }
      if (e.target.closest('#ob-close')) { setState(true); render(true); return; }
      if (e.target.closest('#ob-oto')) { window.open(urls.otomoto, '_blank'); return; }
      if (e.target.closest('#ob-mob')) { window.open(urls.mobileDe, '_blank'); return; }
    });

    function render(mini) {
      if (mini) {
        container.classList.add('ob-min');
        container.setAttribute('style', [
          'position:fixed', 'top:20px', 'right:20px', 'z-index:2147483647',
          'width:50px', 'height:50px', 'border-radius:50%', 'cursor:pointer',
          'display:flex', 'align-items:center', 'justify-content:center',
          'background:#0f111a', 'border:2px solid #00f2fe', 'font-family:sans-serif',
          'box-shadow:0 4px 20px rgba(0,0,0,0.6)'
        ].join(';'));
        container.innerHTML = '<span style="color:#00f2fe;font-weight:900;font-size:14px;">OB</span>';
      } else {
        container.classList.remove('ob-min');
        container.setAttribute('style', [
          'position:fixed', 'top:20px', 'right:20px', 'z-index:2147483647',
          'width:360px', 'background:rgba(10,12,20,0.97)',
          'border:1px solid rgba(255,255,255,0.12)', 'border-radius:16px',
          'padding:20px', 'font-family:sans-serif', 'color:#fff',
          'box-shadow:0 10px 50px rgba(0,0,0,0.7)', 'backdrop-filter:blur(10px)'
        ].join(';'));

        container.innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
            <span style="font-size:11px;opacity:0.5;letter-spacing:1px;">OTOMOTO BLICKER v${VERSION}</span>
            <span id="ob-close" style="cursor:pointer;font-size:22px;opacity:0.7;padding:0 4px;line-height:1;">−</span>
          </div>
          <div id="ob-stats" style="font-size:11px;padding:4px 10px;background:rgba(0,242,254,0.1);color:#00f2fe;border-radius:6px;display:inline-block;margin-bottom:14px;">Ładowanie danych Otomoto...</div>
          <div style="border-left:4px solid #00f2fe;padding:12px 16px;background:rgba(0,242,254,0.05);border-radius:0 10px 10px 0;margin-bottom:14px;">
            <div style="font-size:9px;opacity:0.6;text-transform:uppercase;margin-bottom:4px;">Opłaty Auto1 (2026)</div>
            <div style="font-size:26px;font-weight:900;color:#00f2fe;">${feesText}</div>
            <div style="font-size:10px;opacity:0.5;margin-top:4px;">Handling 289€ + Docs 159€ + Aukcja</div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">
            <div style="background:rgba(255,255,255,0.05);padding:10px;border-radius:8px;">
              <div style="font-size:9px;opacity:0.5;margin-bottom:2px;">MIN OTOMOTO</div>
              <div id="ob-min" style="font-size:14px;font-weight:700;">...</div>
            </div>
            <div style="background:rgba(255,255,255,0.05);padding:10px;border-radius:8px;">
              <div style="font-size:9px;opacity:0.5;margin-bottom:2px;">MAX OTOMOTO</div>
              <div id="ob-max" style="font-size:14px;font-weight:700;">...</div>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">
            <button id="ob-oto" style="background:#e2111a;color:#fff;border:none;padding:11px;border-radius:8px;cursor:pointer;font-weight:700;font-size:12px;">🔍 Otomoto.pl</button>
            <button id="ob-mob" style="background:#f5be00;color:#000;border:none;padding:11px;border-radius:8px;cursor:pointer;font-weight:700;font-size:12px;">🚗 Mobile.de</button>
          </div>
          <div style="font-size:9px;opacity:0.4;text-align:center;border-top:1px solid rgba(255,255,255,0.07);padding-top:10px;">
            ${d.make} ${d.model} · ${d.year} · ${d.fuel} · Akcyza ${akcyzaRate}%
          </div>`;

        fetchStats(urls.otomoto);
      }
    }

    function fetchStats(url) {
      chrome.runtime.sendMessage({ action: "GET_OTOMOTO_STATS", url }, stats => {
        const s = container.querySelector('#ob-stats');
        const mn = container.querySelector('#ob-min');
        const mx = container.querySelector('#ob-max');
        if (stats && stats.min) {
          if (s) { s.textContent = `${stats.count} ofert znaleziono`; s.style.color = "#00f5a0"; s.style.background = "rgba(0,245,160,0.1)"; }
          if (mn) mn.textContent = stats.min.toLocaleString('pl-PL') + ' PLN';
          if (mx) mx.textContent = stats.max.toLocaleString('pl-PL') + ' PLN';
        } else {
          if (s) s.textContent = 'Brak danych Otomoto';
        }
      });
    }

    render(getState());
    document.body.appendChild(container);
    injectionRetries = 0;
    console.log(`[OB] UI v${VERSION} injected. URL: ${urls.otomoto}`);
  }

  // Re-inject on SPA navigation
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      injectionRetries = 0;
      // Remove old UI so it re-injects fresh
      const old = document.getElementById('ob-root');
      if (old) old.remove();
      setTimeout(injectUI, 1500);
    }
  }).observe(document.body, { childList: true, subtree: true });

  setTimeout(injectUI, 1500);
})();
