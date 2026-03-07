// Content Script for Otomoto Blicker - v2.3.0
// Changes v2.3.0:
//  - Fix Year: Year from is [Auto1 - 2], no Year to.
//  - Fix Model: Added smart mapping for Audi (A4 Avant/Limousine), BMW (Seria 3/5), Mercedes (Klasa C/E), VW.
//  - Fix Mileage: Only "DO" limit.
//  - Fix Gearbox: Detect "Dwusprzęgłowa" (automatic) correctly.

(function () {
  const VERSION = "2.3.0";
  console.log(`%c OB v${VERSION} %c loaded `, "background:#00f2fe;color:#000;font-weight:bold;", "background:#1e293b;color:#fff;");

  let lastUrl = location.href;
  let injectionRetries = 0;
  const MAX_RETRIES = 20;

  const getState = () => { try { return sessionStorage.getItem('ob-minimized') === 'true'; } catch (e) { return false; } };
  const setState = v => { try { sessionStorage.setItem('ob-minimized', v); } catch (e) { } };

  function scrapeAuto1() {
    const data = {
      make: "", model: "", modelSlug: "", year: "", fuel: "",
      capacity: 0, priceEur: 0,
      mileage: 0,
      powerKm: 0,
      gearbox: "",    // "automatic" | "manual"
      bodyType: "",   // "combi" | "sedan" | etc
      drive4x4: false
    };

    // ── 1. Title & Base Info ──────────────────────────────────────────────────
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
      
      const t = title.toLowerCase();
      if (t.includes('quattro') || t.includes('4x4') || t.includes('xdrive') || t.includes('4matic') || t.includes('allroad')) {
        data.drive4x4 = true;
      }
    }

    // ── 2. Table rows for technical specs ─────────────────────────────────────
    document.querySelectorAll('tr').forEach(row => {
      const cells = row.querySelectorAll('td');
      if (cells.length < 2) return;
      const label = cells[0].innerText.toLowerCase().trim();
      const value = cells[cells.length - 1].innerText.trim();
      if (!value) return;

      if (label.includes('rok') || label.includes('year')) {
        data.year = value.replace(/\D/g, '').slice(0, 4);
      }
      if (label.includes('paliw') || label.includes('fuel')) {
        data.fuel = value;
      }
      if (label.includes('pojemn') || label.includes('capacity')) {
        const m = value.match(/(\d[\d\s]*)/);
        if (m) data.capacity = parseInt(m[1].replace(/\s/g, ''));
      }
      if (label.includes('przebieg') || label.includes('odczyt') || label.includes('mileage')) {
        const km = parseInt(value.replace(/[\s\u00a0]/g, '').replace(/km/i, ''));
        if (!isNaN(km)) data.mileage = km;
      }
      if (label === 'moc:' || label === 'moc' || label.includes('power')) {
        const kmMatch = value.match(/(\d+)\s*KM/i);
        if (kmMatch) data.powerKm = parseInt(kmMatch[1]);
        else {
          const kwMatch = value.match(/(\d+)\s*kW/i);
          if (kwMatch) data.powerKm = Math.round(parseInt(kwMatch[1]) * 1.36);
        }
      }
      if (label.includes('skrzynia') || label.includes('gearbox')) {
        const v = value.toLowerCase();
        const autoKeywords = ['automat', 'dwusprzegl', 'dwusprzęgł', 'dsg', 's-tronic', 'stronic', 'tiptronic', 'multitronic', 'pdk', 'steptronic', 'cvt'];
        if (autoKeywords.some(k => v.includes(k))) {
          data.gearbox = 'automatic';
        } else if (v.includes('manual')) {
          data.gearbox = 'manual';
        }
      }
      if (label.includes('nadwozia') || label.includes('body')) {
        const v = value.toLowerCase();
        if (v.includes('kombi') || v.includes('avant') || v.includes('touring') || v.includes('variant') || v.includes('station')) {
          data.bodyType = 'combi';
        } else if (v.includes('limuzyna') || v.includes('sedan')) {
          data.bodyType = 'sedan';
        }
      }
      if (label.includes('napęd') || label.includes('naped') || label.includes('drive')) {
        const v = value.toLowerCase();
        if (v.includes('wszystkie') || v.includes('4x4') || v.includes('awd') || v.includes('quattro') || v.includes('4wd')) {
          data.drive4x4 = true;
        }
      }
    });

    const priceSelectors = ['[data-qa-id="original-a1-price"]', '[data-qa-id="listing-details-price"]', '.price__main-value', '.price-value', '.car-price-value'];
    for (const sel of priceSelectors) {
      const el = document.querySelector(sel);
      if (el && el.innerText.trim()) {
        const val = parseInt(el.innerText.replace(/[^\d]/g, ''));
        if (val > 100) { data.priceEur = val; break; }
      }
    }
    if (!data.priceEur) {
      const patterns = [/"price":\s*\{[^}]*"value"\s*:\s*(\d+)/, /"currentBid"\s*:\s*(\d+)/];
      document.querySelectorAll('script:not([src])').forEach(s => {
        patterns.forEach(p => {
          const m = s.textContent.match(p);
          if (m) { const val = parseInt(m[1]); if (val > 100) data.priceEur = val; }
        });
      });
    }

    return data;
  }

  function getAuto1Fees(priceEur) {
    const base = 289 + 159;
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

  function getModelSlug(make, model, bodyType) {
    make = make.toLowerCase();
    model = model.toLowerCase();
    
    if (make.includes('audi')) {
      if (model.includes('a4')) {
        if (bodyType === 'combi' || model.includes('avant')) return 'a4-avant';
        if (bodyType === 'sedan' || model.includes('limousine')) return 'a4-limousine';
        if (model.includes('allroad')) return 'a4-allroad';
      }
      if (model.includes('a6')) {
        if (bodyType === 'combi' || model.includes('avant')) return 'a6-avant';
        if (bodyType === 'sedan' || model.includes('limousine')) return 'a6-limousine';
      }
      if (model.includes('a3')) {
        if (bodyType === 'combi' || model.includes('sportback')) return 'a3-sportback';
        if (bodyType === 'sedan' || model.includes('sedan')) return 'a3-sedan';
      }
    }
    if (make.includes('bmw')) {
      if (model.includes('seria 3') || model.startsWith('3')) return 'seria-3';
      if (model.includes('seria 5') || model.startsWith('5')) return 'seria-5';
      if (model.includes('seria 1') || model.startsWith('1')) return 'seria-1';
    }
    if (make.includes('volkswagen') || make.includes('vw')) {
      if (model.includes('golf')) return 'golf';
      if (model.includes('passat')) return 'passat';
    }
    if (make.includes('mercedes')) {
      if (model.includes('klasa c') || model.includes(' c ')) return 'klasa-c';
      if (model.includes('klasa e') || model.includes(' e ')) return 'klasa-e';
    }
    
    // Default fallback
    return model.split(' ')[0].replace(/[^a-z0-9-]/g, '');
  }

  function getSearchUrls(d) {
    let make = (d.make || "").toLowerCase().trim();
    if (make === 'mercedes' || make.includes('benz')) make = 'mercedes-benz';
    if (make === 'vw') make = 'volkswagen';

    const modelSlug = getModelSlug(make, d.model, d.bodyType);
    let base = `https://www.otomoto.pl/osobowe/${make}/${modelSlug}/`;

    const p = new URLSearchParams();
    
    // Year: From (Auto1 - 2), No TO
    if (d.year) {
      const yearFrom = parseInt(d.year) - 2;
      base += `od-${yearFrom}/`;
    }

    // Fuel
    const fl = (d.fuel || "").toLowerCase();
    if (fl.includes('diesel')) p.append("search[filter_enum_fuel_type]", "diesel");
    else if (fl.includes('benzyn') || fl.includes('petrol')) p.append("search[filter_enum_fuel_type]", "petrol");
    else if (fl.includes('hybryd') || fl.includes('hybrid')) p.append("search[filter_enum_fuel_type]", "hybrid");

    // Mileage: Only DO
    if (d.mileage > 0) {
      p.append("search[filter_float_mileage:to]", String(d.mileage + 50000));
    }

    // Gearbox
    if (d.gearbox === 'automatic') p.append("search[filter_enum_gearbox]", "automatic");
    else if (d.gearbox === 'manual') p.append("search[filter_enum_gearbox]", "manual");

    // Drive 4x4
    if (d.drive4x4) {
      p.append("search[filter_enum_transmission][0]", "all-wheel-auto");
      p.append("search[filter_enum_transmission][1]", "all-wheel-permanent");
    }

    // Power range ±10
    if (d.powerKm > 0) {
      p.append("search[filter_float_engine_power:from]", String(Math.max(0, d.powerKm - 10)));
      p.append("search[filter_float_engine_power:to]", String(d.powerKm + 10));
    }

    p.append("search[filter_enum_damaged]", "0");
    p.append("search[order]", "filter_float_price:asc");

    return {
      otomoto: base + '?' + p.toString(),
      mobileDe: `https://suchen.mobile.de/fahrzeuge/search.html?dam=0&isSearchRequest=true&makeModelVariant1.modelDescription=${make}+${modelSlug}&minFirstRegistrationDate=${parseInt(d.year)-2}&sortOption.sortBy=price&sortOption.sortOrder=ASCENDING`
    };
  }

  function injectUI() {
    if (!location.pathname.includes('/car/')) return;
    if (document.getElementById('ob-root')) return;

    const d = scrapeAuto1();
    if (!d.make) {
      if (injectionRetries < MAX_RETRIES) { injectionRetries++; setTimeout(injectUI, 1000); }
      return;
    }

    const urls = getSearchUrls(d);
    const fees = d.priceEur ? getAuto1Fees(d.priceEur) : null;
    const feesText = fees ? `+ ${fees.toLocaleString()} EUR` : "— EUR";

    const container = document.createElement('div');
    container.id = 'ob-root';
    container.addEventListener('click', e => {
      if (container.classList.contains('ob-min')) { setState(false); render(false); return; }
      if (e.target.closest('#ob-close')) { setState(true); render(true); return; }
      if (e.target.closest('#ob-oto')) { window.open(urls.otomoto, '_blank'); return; }
      if (e.target.closest('#ob-mob')) { window.open(urls.mobileDe, '_blank'); return; }
    });

    function render(mini) {
      if (mini) {
        container.classList.add('ob-min');
        container.setAttribute('style', 'position:fixed;top:20px;right:20px;z-index:2147483647;width:50px;height:50px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;background:#0f111a;border:2px solid #00f2fe;box-shadow:0 4px 20px rgba(0,0,0,0.6)');
        container.innerHTML = '<span style="color:#00f2fe;font-weight:900;font-size:14px;">OB</span>';
      } else {
        container.classList.remove('ob-min');
        container.setAttribute('style', 'position:fixed;top:20px;right:20px;z-index:2147483647;width:360px;background:rgba(10,12,20,0.97);border:1px solid rgba(255,255,255,0.12);border-radius:16px;padding:20px;font-family:sans-serif;color:#fff;box-shadow:0 10px 50px rgba(0,0,0,0.7);backdrop-filter:blur(10px)');

        const yearFrom = parseInt(d.year) - 2;
        const filterDesc = `od ${yearFrom} · do ${d.mileage+50000}km · ${d.drive4x4 ? '4x4' : ''}`.replace(/\s·\s·/g, ' · ').trim();

        container.innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
            <span style="font-size:11px;opacity:0.5;letter-spacing:1px;">OTOMOTO BLICKER v${VERSION}</span>
            <span id="ob-close" style="cursor:pointer;font-size:22px;opacity:0.7;padding:0 4px;line-height:1;">−</span>
          </div>
          <div id="ob-stats" style="font-size:11px;padding:4px 10px;background:rgba(0,242,254,0.1);color:#00f2fe;border-radius:6px;display:inline-block;margin-bottom:10px;">Ładowanie Otomoto...</div>
          <div style="font-size:10px;opacity:0.55;margin-bottom:14px;">🔍 <span style="color:#00f2fe;">${filterDesc}</span></div>
          <div style="border-left:4px solid #00f2fe;padding:12px 16px;background:rgba(0,242,254,0.05);border-radius:0 10px 10px 0;margin-bottom:14px;">
            <div style="font-size:9px;opacity:0.6;text-transform:uppercase;margin-bottom:4px;">Opłaty Auto1</div>
            <div style="font-size:26px;font-weight:900;color:#00f2fe;">${feesText}</div>
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
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <button id="ob-oto" style="background:#e2111a;color:#fff;border:none;padding:11px;border-radius:8px;cursor:pointer;font-weight:700;font-size:12px;">🔍 Otomoto.pl</button>
            <button id="ob-mob" style="background:#f5be00;color:#000;border:none;padding:11px;border-radius:8px;cursor:pointer;font-weight:700;font-size:12px;">🚗 Mobile.de</button>
          </div>`;

        fetchStats(urls.otomoto);
      }
    }

    function fetchStats(url) {
      chrome.runtime.sendMessage({ action: "GET_OTOMOTO_STATS_ADVANCED", url }, stats => {
        const s = container.querySelector('#ob-stats');
        const mn = container.querySelector('#ob-min');
        const mx = container.querySelector('#ob-max');
        if (stats && stats.min) {
          if (s) { s.textContent = `${stats.count} ofert`; s.style.color = "#00f5a0"; s.style.background = "rgba(0,245,160,0.1)"; }
          if (mn) mn.textContent = stats.min.toLocaleString('pl-PL') + ' PLN';
          if (mx) mx.textContent = stats.max.toLocaleString('pl-PL') + ' PLN';
        } else {
          if (s) s.textContent = 'Brak danych';
        }
      });
    }

    render(getState());
    document.body.appendChild(container);
    injectionRetries = 0;
  }

  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      injectionRetries = 0;
      const old = document.getElementById('ob-root');
      if (old) old.remove();
      setTimeout(injectUI, 1500);
    }
  }).observe(document.body, { childList: true, subtree: true });

  setTimeout(injectUI, 1500);
})();
