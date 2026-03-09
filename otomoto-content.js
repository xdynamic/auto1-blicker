// Content Script for Otomoto Blicker - v2.8.0 (All-Incl UI)

(function () {
  const VERSION = "2.8.4";
  const VERSION_TAG = "ALL-INCL";
  console.log(`%c OB v${VERSION} %c loaded `, "background:#ff00ea;color:#fff;font-weight:bold;", "background:#1e293b;color:#fff;");

  let lastUrl = location.href;
  let injectionRetries = 0;
  const MAX_RETRIES = 20;
  let eurRate = 4.3; // Default fallback
  
  const isInvalidated = () => !chrome.runtime?.id;
  const getState = () => { try { return sessionStorage.getItem('ob-minimized') === 'true'; } catch (e) { return false; } };
  const setState = v => { try { sessionStorage.setItem('ob-minimized', v); } catch (e) { } };
  
  let otomotoMapping = null;
  async function loadMapping() {
      if (otomotoMapping) return otomotoMapping;
      try {
          const res = await fetch(chrome.runtime.getURL('otomoto_mapping.json'));
          otomotoMapping = await res.json();
          return otomotoMapping;
      } catch (e) {
          console.error("OB: Failed to load mapping", e);
          return null;
      }
  }

  async function updateEurRate() {
    return new Promise(resolve => {
      if (isInvalidated()) return resolve(eurRate);
      chrome.runtime.sendMessage({ action: "GET_EUR_RATE" }, rate => {
        if (chrome.runtime.lastError || isInvalidated()) return resolve(eurRate);
        if (rate && !isNaN(rate)) eurRate = parseFloat(rate);
        resolve(eurRate);
      });
    });
  }

  function detectBodyTypeFromTitle(tLower) {
    // Mercedes T-Modell
    if (/\w\s+\d+\s+t\b/.test(tLower) || tLower.includes('t-modell') || tLower.includes('t edition')) return 'combi';
    // BMW Touring
    if (tLower.includes('touring')) return 'combi';
    // Audi Avant / Allroad
    if ((tLower.includes('avant') && !tLower.includes('avantgarde')) || tLower.includes('allroad')) return 'combi';
    // VW / Skoda / Volvo Kombis
    if (tLower.includes('variant') || tLower.includes('sportsvan') || tLower.includes('allstar') || tLower.includes('alltrack') || tLower.includes('outdoor')) return 'combi';
    if (tLower.includes('volvo v') && /\bv\d+\b/.test(tLower)) return 'combi';
    // Generic indicators
    if (tLower.includes('kombi') || tLower.includes('combi') || tLower.includes('break') || tLower.includes('estate') || tLower.includes(' sw ') || tLower.endsWith(' sw') || tLower.includes('sportwagon') || tLower.includes('sportswagon') || tLower.includes('shooting brake')) return 'combi';
    // Basic types
    if (tLower.includes('sedan') || tLower.includes('limousine')) return 'sedan';
    if (tLower.includes('hatchback')) return 'hatchback';
    return '';
  }

  function scrapeAuto1() {
    const data = { 
        make: "", model: "", modelSlug: "", year: "", fuel: "", 
        capacity: 0, power: 0, mileage: 0, transmission: "", bodyType: "", priceEur: 0 
    };

    const titleEl = document.querySelector('[data-qa-id="car-title"]') || document.querySelector('.car-info-title h2') || document.querySelector('.car-title h1') || document.querySelector('h1');
    if (titleEl) {
      const title = titleEl.innerText.trim();
      const tLower = title.toLowerCase();
      data.make = title.split(/\s+/)[0];
      data.model = title.split(/\s+/).slice(1).join(' ');
      data.bodyType = detectBodyTypeFromTitle(tLower);

      const makeLow = data.make.toLowerCase();
      if (makeLow.includes('mercedes')) data.make = 'mercedes-benz';
      else if (makeLow === 'vw') data.make = 'volkswagen';
    }

    // ── Step 3: Parse spec table ──────────────────────────────────────────
    const parseSpecRow = (label, value) => {
      const l = label.toLowerCase();
      const v = value.trim();
      const vl = v.toLowerCase();
      if (!v) return;
      if (l.includes('rok') || l.includes('year') || l.includes('produkcj')) {
          const y = v.match(/\b(19|20)\d{2}\b/); if (y) data.year = y[0];
      }
      if (l.includes('paliw') || l.includes('fuel')) data.fuel = v;
      if (l.includes('przebieg') || l.includes('mileage')) data.mileage = parseInt(v.replace(/\D/g, '')) || data.mileage;
      if (l.includes('pojemn') || l.includes('capacity')) {
          const m = v.match(/(\d[\d\s]*)/); if (m) data.capacity = parseInt(m[1].replace(/\s/g, ''));
      }
      if (l.includes('moc') || l.includes('power') || l.includes('leistung')) {
          const m = v.match(/(\d+)\s*(KM|PS|HP|kW)/i);
          if (m) { let val = parseInt(m[1]); if (m[2].toLowerCase() === 'kw') val = Math.round(val * 1.36); data.power = val; }
      }
      if (l.includes('skrzynia') || l.includes('transmission')) {
          if (vl.includes('automa') || vl.includes('dwu') || vl.includes('pdk') || vl.includes('dsg') || vl.includes('steptr')) data.transmission = 'automatic';
          else if (vl.includes('manua') || vl.includes('manual')) data.transmission = 'manual';
      }
      if (l.includes('nadwoz') || l.includes('body') || l.includes('karoser')) {
          if (vl.includes('kombi') || vl.includes('avant') || vl.includes('touring') || vl.includes('variant') || vl.includes('combi') || vl.includes('estate') || vl.includes(' sw') || vl.includes('break') || vl.includes('sportwag') || vl.includes('shooting brake')) data.bodyType = 'combi';
          else if (vl.includes('sedan') || vl.includes('limousine')) { if (!data.bodyType) data.bodyType = 'sedan'; }
          else if (vl.includes('suv') || vl.includes('crossover') || vl.includes('off-road')) { if (!data.bodyType) data.bodyType = 'suv'; }
          else if (vl.includes('hatchback')) { if (!data.bodyType) data.bodyType = 'hatchback'; }
      }
    };
    
    document.querySelectorAll('tr').forEach(row => {
      const cells = row.querySelectorAll('td');
      if (cells.length >= 2) parseSpecRow(cells[0].innerText, cells[cells.length - 1].innerText);
    });
    document.querySelectorAll('.car-details-row, .car-info-row, [class*="detail-row"]').forEach(row => {
      const l = row.querySelector('[class*="label"], dt');
      const v = row.querySelector('[class*="value"], dd');
      if (l && v) parseSpecRow(l.innerText, v.innerText);
    });
    document.querySelectorAll('[data-qa-id*="body"], [data-qa-id*="fuel"], [data-qa-id*="mileage"]').forEach(el => {
      const qa = el.getAttribute('data-qa-id');
      parseSpecRow(qa, el.innerText);
    });

    // ── Step 4: Model Slug Mapping ────────────────────────────────────────
    if (otomotoMapping) {
      const makeKey = data.make.toLowerCase().replace(/\s+/g, '-');
      const makeEntry = otomotoMapping[makeKey];
      if (makeEntry && makeEntry.models) {
          const modelLower = data.model.toLowerCase();
          const bodyType = data.bodyType || "";
          let bestMatch = null, bestScore = -1;

          for (const [slug, label] of Object.entries(makeEntry.models)) {
              const labelLow = label.toLowerCase();
              let score = 0;

              if (labelLow.length >= 3 && modelLower.includes(labelLow)) score += 15;
              else if (labelLow.length >= 3 && labelLow.includes(modelLower)) score += 5;
              
              const modelNorm = modelLower.replace(/[\s-]/g, '');
              const labelNorm = labelLow.replace(/[\s-]/g, '');
              if (modelNorm.length >= 3 && (modelNorm.includes(labelNorm) || labelNorm.includes(modelNorm))) score += 10;

              if (modelLower.includes('allroad') && labelLow.includes('allroad')) score += 30;
              
              if (bodyType === 'combi') {
                  const ck = ['avant', 'touring', 'variant', 'kombi', 'sw', 't-modell', 'sportsvan', 'break', 'estate'];
                  if (ck.some(k => labelLow.includes(k) || slug.includes(k))) {
                      const baseModel = modelLower.split(' ')[0];
                      if (labelLow.includes(baseModel) || slug.includes(baseModel)) score += 20;
                  }
              }
              
              if (makeKey === 'bmw') {
                  // Extract series number (e.g. "5" from "5 GT" or "520d")
                  const mNumMatch = modelLower.match(/\b([1-8])(?:er|er|(?=\d{2}))\b/) || modelLower.match(/^([1-8])\d{2}/) || modelLower.match(/\b([1-8])\s*(?:series|seria)\b/i) || modelLower.match(/^([1-8])\s*gt\b/i);
                  const modelNum = mNumMatch ? mNumMatch[1] : null;

                  // Extract number from slug/label (e.g. "3" from "3gt" or "seria-3")
                  const sNumMatch = slug.match(/([1-8])/) || labelLow.match(/([1-8])/);
                  const slugNum = sNumMatch ? sNumMatch[1] : null;

                  // Strict numerical enforcement for series/GT
                  if (modelNum && slugNum && modelNum !== slugNum) {
                      score -= 100; // Strong penalty for mismatched numbers (e.g. 5 vs 3)
                  }

                  // Precision: GT / Gran Turismo
                  const isGT = modelLower.includes('gt') || modelLower.includes('gran turismo');
                  if (isGT) {
                      if (slug.endsWith('gt')) {
                          score += 60;
                          // Ensure numerical match for GT (e.g. "5 GT" must match slug containing "5")
                          if (modelNum && slug.includes(modelNum)) score += 40;
                      }
                      else if (slug.startsWith('seria-')) score -= 30;
                  } else {
                      if (slug.endsWith('gt')) score -= 60;
                  }

                  const xm = modelLower.match(/\b(x[1-7]|m[2-8])\b/i);
                  if (xm && (labelLow === xm[1].toLowerCase() || slug === xm[1].toLowerCase())) score += 80;
              }
              
              if (makeKey === 'mercedes-benz') {
                  const mm = modelLower.match(/\b(cla|cls|gla|glb|glc|gle|gls|glk|amg gt|eqb|eqc|eqe|eqs|slk|clk|sl|ml)\b/i);
                  const modelName = mm ? mm[mm.length-1].toLowerCase() : null;
                  
                  // Priority for literal SUV/Class matches with -klasa suffix
                  if (modelName && slug === `${modelName}-klasa`) {
                      score += 100;
                  } else if (modelName && slug === modelName) {
                      score += 40;
                  }

                  const cm = modelLower.match(/\b([abcesgv])\s*-?(?:class|klasa|klasse)\b/i) || modelLower.match(/\b([abcesgv])\s+\d/i);
                  const letter = cm ? (cm[1] || cm[0]).charAt(0).toLowerCase() : null;
                  
                  if (letter && slug === `${letter}-klasa`) {
                      score += 90;
                  } else if (letter && labelLow.includes('klasa ' + letter)) {
                      score += 40;
                  }
              }

              if (makeKey === 'volkswagen' && bodyType === 'combi') {
                  if (labelLow.includes('variant') && !modelLower.includes('sportsvan')) score += 10;
                  if (labelLow.includes('sportsvan') && modelLower.includes('sportsvan')) score += 10;
              }
              
              if (score > bestScore) { bestScore = score; bestMatch = slug; }
          }
          if (bestMatch && bestScore > 5) data.modelSlug = bestMatch;
      }
    }
    if (!data.modelSlug && data.model) {
      data.modelSlug = data.model.split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9-]/g, '');
    }
    
    // ── Step 5: Price extraction ──────────────────────────────────────────
    const isCrossedOut = (el) => {
        const s = window.getComputedStyle(el);
        if (s.textDecoration.includes('line-through') || s.textDecorationLine?.includes('line-through')) return true;
        // Check if any child has it (common in minified React apps)
        const children = el.querySelectorAll('*');
        for (const child of children) {
            const cs = window.getComputedStyle(child);
            if (cs.textDecoration.includes('line-through') || cs.textDecorationLine?.includes('line-through')) return true;
        }
        return false;
    };

    let priceCandidates = [];
    document.querySelectorAll('div, span, td, p, h1, h2, h3, dd').forEach(el => {
        const text = el.innerText.trim();
        if (!text || text.length > 30) return; // Too long for a price label+value
        
        const m = text.match(/(\d[\d\s.,']{0,8})\s*[€EUR]/i) || text.match(/[€EUR]\s*(\d[\d\s.,']{0,8})/i);
        if (m) {
            const val = parseInt((m[1] || m[0]).replace(/[^\d]/g, ''));
            if (val > 100 && val < 1000000) {
                let score = 0;
                const containerText = (el.parentElement?.innerText || "").toLowerCase();
                const nearbyText = (el.closest('div, tr, section')?.innerText || "").toLowerCase();

                // High priority keywords
                if (nearbyText.includes('minimalna') || nearbyText.includes('minimum') || nearbyText.includes('licytuj') || nearbyText.includes('twoja')) score += 100;
                if (containerText.includes('oferta') || containerText.includes('cena')) score += 30;
                
                // Penalty keywords
                if (nearbyText.includes('auto1') || nearbyText.includes('rynkowa') || nearbyText.includes('oszcz') || nearbyText.includes('original')) score -= 50;

                // Technical exclusions
                if (isCrossedOut(el)) score -= 1000;
                
                // Boost for smaller values in auctions (often the min offer vs buy now)
                // If we found a price already, slightly prefer the lower ones if they have labels
                priceCandidates.push({ val, score, el });
            }
        }
    });

    if (priceCandidates.length > 0) {
        priceCandidates.sort((a, b) => b.score - a.score);
        if (priceCandidates[0].score > -500) {
            data.priceEur = priceCandidates[0].val;
        }
    }

    // Secondary selector-based fallback if scoring failed
    if (!data.priceEur) {
        const priceSelectors = [
            '.bid-value.minimumBid', '.bid-value', '[data-qa-id="current-bid-price"]',
            '.buy-now-block__price-value', '[data-qa-id="listing-details-price"]',
            '.price__main-value', '.price-value', '.CarDetails__price', '[class*="price-value"]', '[class*="PriceBlock"]'
        ];
        for (const sel of priceSelectors) {
            const el = document.querySelector(sel);
            if (el && !isCrossedOut(el)) {
                const val = parseInt(el.innerText.replace(/[^\d]/g, ''));
                if (val > 100) { data.priceEur = val; break; }
            }
        }
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

  function getSearchUrls(d) {
    const make = (d.make || "").toLowerCase().trim();
    const modelSlug = d.modelSlug || "";
    let base = `https://www.otomoto.pl/osobowe/${make}/`;
    if (modelSlug) base += `${modelSlug}/`;

    const p = new URLSearchParams();
    if (d.year) {
      const yr = parseInt(d.year);
      p.append("search[filter_float_year:from]", yr - 2);
      p.append("search[filter_float_year:to]", yr + 2);
    }
    if (d.mileage > 0) {
      p.append("search[filter_float_mileage:from]", Math.max(0, d.mileage - 50000));
      p.append("search[filter_float_mileage:to]", d.mileage + 50000);
    }
    if (d.power > 0) {
      p.append("search[filter_float_engine_power:from]", Math.max(0, d.power - 10));
      p.append("search[filter_float_engine_power:to]", d.power + 10);
    }
    if (d.transmission) p.append("search[filter_enum_gearbox][0]", d.transmission);
    p.append("search[filter_enum_damaged]", "0");

    if (d.bodyType === 'combi') {
        const mk = (d.make || "").toLowerCase();
        // If BMW/Mercedes, seg-combi is part of path
        if (mk.includes('bmw') || mk.includes('mercedes')) {
             if (base.endsWith('/')) base += 'seg-combi/';
             else base += '/seg-combi/';
        } else {
             p.append("search[filter_enum_body_type][0]", "combi");
        }
    }

    const fl = (d.fuel || "").toLowerCase();
    if (fl.includes('diesel')) p.append("search[filter_enum_fuel_type][0]", "diesel");
    else if (fl.includes('benzyn') || fl.includes('petrol') || fl.includes('gasoli') || fl.includes('ottomotor')) p.append("search[filter_enum_fuel_type][0]", "petrol");
    else if (fl.includes('hybryd') || fl.includes('hybrid')) p.append("search[filter_enum_fuel_type][0]", "hybrid");
    else if (fl.includes('elektr') || fl.includes('electro')) p.append("search[filter_enum_fuel_type][0]", "electric");
    else if (fl.includes('lpg') || fl.includes('gaz') || fl.includes('autogas')) p.append("search[filter_enum_fuel_type][0]", "lpg");

    p.append("search[order]", "filter_float_price:asc");
    return { otomoto: base + '?' + p.toString() };
  }

  async function injectUI() {
    if (!location.pathname.includes('/car/')) return;
    if (document.getElementById('ob-root')) return;

    await updateEurRate();
    await loadMapping();
    const d = scrapeAuto1();

    if (!d.make && injectionRetries < MAX_RETRIES) {
      injectionRetries++;
      setTimeout(injectUI, 1000);
      return;
    }

    const urls = getSearchUrls(d);
    const fees = d.priceEur ? getAuto1Fees(d.priceEur) : null;
    const feesText = fees ? `+ ${fees.toLocaleString()} EUR` : "— EUR";

    const container = document.createElement('div');
    container.id = 'ob-root';
    container.setAttribute('style', 'position:fixed;top:20px;right:20px;z-index:2147483647;width:370px;background:rgba(10,12,20,0.98);border:1px solid rgba(255,255,255,0.15);border-radius:20px;padding:22px;font-family:sans-serif;color:#fff;box-shadow:0 20px 60px rgba(0,0,0,0.8);backdrop-filter:blur(15px);');

    function render(mini) {
      if (mini) {
        container.classList.add('ob-min');
        container.style.width = '50px'; container.style.height = '50px'; container.style.borderRadius = '50%'; container.style.padding = '0';
        container.innerHTML = '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#00f2fe;font-weight:900;font-size:14px;cursor:pointer;">OB</div>';
      } else {
        container.classList.remove('ob-min');
        container.style.width = '370px'; container.style.height = 'auto'; container.style.borderRadius = '20px'; container.style.padding = '22px';
        
        const allInclEur = d.priceEur + (fees || 0);
        const allInclPln = Math.round(allInclEur * eurRate);
        const allInclTextEur = allInclEur.toLocaleString('de-DE') + " EUR";
        const allInclTextPln = allInclPln.toLocaleString('pl-PL') + " PLN";

        container.innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
            <div style="display:flex;flex-direction:column;">
                <span style="font-size:10px;opacity:0.5;letter-spacing:1.5px;text-transform:uppercase;font-weight:600;">Otomoto Blicker v${VERSION}</span>
                <span style="font-size:10px;color:#00f2fe;font-weight:700;margin-top:2px;letter-spacing:0.5px;">1€ ≈ ${eurRate.toFixed(4)} PLN</span>
            </div>
            <span id="ob-close" style="cursor:pointer;font-size:24px;opacity:0.6;padding:0 6px;line-height:1;transition:0.2s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.6">−</span>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
            <div style="background:linear-gradient(135deg, rgba(0,242,254,0.12), rgba(0,242,254,0.05));border-left:4px solid #00f2fe;padding:12px 14px;border-radius:0 12px 12px 0;">
              <div style="font-size:9px;opacity:0.6;text-transform:uppercase;margin-bottom:4px;letter-spacing:0.5px;">Opłaty Auto1</div>
              <div style="font-size:18px;font-weight:900;color:#00f2fe;">+ ${fees ? fees.toLocaleString() : '—'} €</div>
            </div>
            <div style="background:linear-gradient(135deg, rgba(226,17,26,0.15), rgba(226,17,26,0.05));border-left:4px solid #e2111a;padding:12px 14px;border-radius:0 12px 12px 0;">
              <div style="font-size:9px;opacity:0.6;text-transform:uppercase;margin-bottom:4px;letter-spacing:0.5px;">Cena All Incl</div>
              <div style="font-size:18px;font-weight:900;color:#fff;">${allInclTextEur}</div>
              <div style="font-size:10px;opacity:0.5;margin-top:2px;">≈ ${allInclTextPln}</div>
            </div>
          </div>

          <div id="ob-stats" style="font-size:11px;padding:8px 14px;background:rgba(255,255,255,0.05);color:#fff;border-radius:12px;text-align:center;margin-bottom:16px;border:1px solid rgba(255,255,255,0.08);">Ładowanie rynku...</div>
          
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
            <div style="background:rgba(255,255,255,0.03);padding:14px;border-radius:14px;border:1px solid rgba(255,255,255,0.07);">
              <div style="font-size:9px;opacity:0.5;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px;">Min Otomoto</div>
              <div id="ob-min-pln" style="font-size:16px;font-weight:800;color:#00f5a0;">...</div>
              <div id="ob-min-eur" style="font-size:11px;opacity:0.4;margin-top:3px;">...</div>
            </div>
            <div style="background:rgba(255,255,255,0.03);padding:14px;border-radius:14px;border:1px solid rgba(255,255,255,0.07);">
              <div style="font-size:9px;opacity:0.5;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px;">Max Otomoto</div>
              <div id="ob-max-pln" style="font-size:16px;font-weight:800;">...</div>
              <div id="ob-max-eur" style="font-size:11px;opacity:0.4;margin-top:3px;">...</div>
            </div>
          </div>

          <button id="ob-oto" style="width:100%;background:#e2111a;color:#fff;border:none;padding:16px;border-radius:14px;cursor:pointer;font-weight:900;font-size:14px;margin-bottom:16px;transition:0.2s;box-shadow:0 4px 15px rgba(226,17,26,0.3);" onmouseover="this.style.transform='translateY(-1px)';this.style.boxShadow='0 6px 20px rgba(226,17,26,0.4)'" onmouseout="this.style.transform='none';this.style.boxShadow='0 4px 15px rgba(226,17,26,0.3)'">🔍 Sprawdź Market na Otomoto.pl</button>
          
          <div style="font-size:10px;opacity:0.4;text-align:center;border-top:1px solid rgba(255,255,255,0.08);padding-top:14px;line-height:1.5;">
            <b style="color:#fff;opacity:1;">${d.make.toUpperCase()} ${d.model}</b><br>
            ${d.year} | ${d.mileage.toLocaleString()} km | ${d.power ? d.power+' KM' : ''}<br>
            ${d.transmission === 'automatic' ? 'Automat' : 'Manual'} | ${d.bodyType || 'Nadwozie'}<br>
            <span style="color:#00f2fe;font-size:11px;margin-top:6px;display:block;font-weight:bold;letter-spacing:0.5px;">PATH: /${d.make.toLowerCase()}/${d.modelSlug}/</span>
          </div>`;
        fetchStats(urls.otomoto);
      }
    }

    function fetchStats(url) {
      if (isInvalidated()) return;
      chrome.runtime.sendMessage({ action: "GET_OTOMOTO_STATS", url }, stats => {
        if (chrome.runtime.lastError || isInvalidated()) return;
        const s = container.querySelector('#ob-stats');
        if (stats && stats.min) {
          if (s) { s.innerHTML = `Przeanalizowano <b>${stats.count} unikalnych cen</b>`; s.style.color = "#00f5a0"; }
          container.querySelector('#ob-min-pln').textContent = stats.min.toLocaleString('pl-PL') + ' PLN';
          container.querySelector('#ob-max-pln').textContent = stats.max.toLocaleString('pl-PL') + ' PLN';
          container.querySelector('#ob-min-eur').textContent = (stats.min / eurRate).toLocaleString('de-DE', {style:'currency', currency:'EUR'});
          container.querySelector('#ob-max-eur').textContent = (stats.max / eurRate).toLocaleString('de-DE', {style:'currency', currency:'EUR'});
        } else if (s) {
          s.textContent = 'Brak precyzyjnych wyników';
        }
      });
    }

    render(getState());
    document.body.appendChild(container);
    container.addEventListener('click', e => {
      if (container.classList.contains('ob-min')) { setState(false); render(false); }
      else if (e.target.closest('#ob-close')) { setState(true); render(true); }
      else if (e.target.closest('#ob-oto')) window.open(urls.otomoto, '_blank');
    });
  }

  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      const old = document.getElementById('ob-root');
      if (old) old.remove();
      injectionRetries = 0;
      setTimeout(injectUI, 2000);
    }
  }).observe(document.body, { childList: true, subtree: true });

  setTimeout(injectUI, 2000);
})();
