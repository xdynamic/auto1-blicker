// Content Script for Otomoto Blicker - v2.5.0 (Dealer Calculator Edition)

(function() {
  const VERSION = "2.5.0";
  console.log(`%c OB v${VERSION} %c loaded `, "background:#00f2fe;color:#000;font-weight:bold;", "background:#1e293b;color:#fff;");

  let lastUrl = location.href;
  let injectionRetries = 0;
  const MAX_RETRIES = 20;
  let eurRate = 4.3; // Default fallback

  const getState = () => { try { return sessionStorage.getItem('ob-minimized') === 'true'; } catch(e) { return false; } };
  const setState = v => { try { sessionStorage.setItem('ob-minimized', v); } catch(e) {} };

  // Helper to get EUR rate from background
  async function updateEurRate() {
    return new Promise(resolve => {
      chrome.runtime.sendMessage({ action: "GET_EUR_RATE" }, rate => {
        if (rate && !isNaN(rate)) {
          console.log(`[OB] EUR rate updated from background: ${rate}`);
          eurRate = parseFloat(rate);
        } else {
          console.warn("[OB] Failed to get EUR rate from background, using fallback:", eurRate);
        }
        resolve(eurRate);
      });
    });
  }

  function scrapeAuto1() {
    const data = { make: "", model: "", year: "", fuel: "", capacity: 0, priceEur: 0, mileage: 0, images: [] };

    const titleEl = document.querySelector('[data-qa-id="car-title"]') || document.querySelector('h1');
    if (titleEl) {
      const parts = titleEl.innerText.trim().split(/\s+/);
      data.make = parts[0];
      data.model = parts.slice(1).join(' ');
    }

    document.querySelectorAll('tr').forEach(row => {
      const cells = row.querySelectorAll('td');
      if (cells.length < 2) return;
      const label = cells[0].innerText.toLowerCase();
      const value = cells[cells.length - 1].innerText.trim();
      if (label.includes('rok') || label.includes('year')) data.year = value.replace(/\D/g, '').slice(0, 4);
      if (label.includes('paliw') || label.includes('fuel')) data.fuel = value;
      if (label.includes('przebieg') || label.includes('mileage')) data.mileage = parseInt(value.replace(/\D/g, '')) || 0;
      if (label.includes('pojemn') || label.includes('capacity')) {
        const m = value.match(/(\d[\d\s]*)/);
        if (m) data.capacity = parseInt(m[1].replace(/\s/g, ''));
      }
    });

    const priceSelectors = [
      '.buy-now-block__price-value',
      '.bid-value.minimumBid',
      '.price-value',
      '[data-qa-id="original-a1-price"]'
    ];
    for (const sel of priceSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        const val = parseInt(el.innerText.replace(/[^\d]/g, ''));
        if (val > 100) { data.priceEur = val; break; }
      }
    }

    // Collect car images for PDF
    document.querySelectorAll('img').forEach(img => {
      if (img.src && img.src.includes('car_images') && !data.images.includes(img.src)) {
        data.images.push(img.src);
      }
    });

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
    const modelWords = (d.model || "").split(' ');
    const firstModelWord = (modelWords[0] || "").toLowerCase().replace(/[^a-z0-9-]/g, '');
    
    let base = `https://www.otomoto.pl/osobowe/${make}/${firstModelWord}/`;
    const p = new URLSearchParams();
    if (d.year) base += `od-${d.year}/`;
    
    if (d.mileage > 0) {
      p.append("search[filter_float_mileage:from]", Math.max(0, d.mileage - 50000));
      p.append("search[filter_float_mileage:to]", d.mileage + 50000);
    }

    const fl = (d.fuel || "").toLowerCase();
    if (fl.includes('diesel')) p.append("search[filter_enum_fuel_type]", "diesel");
    else if (fl.includes('benzyn') || fl.includes('petrol')) p.append("search[filter_enum_fuel_type]", "petrol");
    else if (fl.includes('hybryd') || fl.includes('hybrid')) p.append("search[filter_enum_fuel_type]", "hybrid");
    else if (fl.includes('elektr')) p.append("search[filter_enum_fuel_type]", "electric");

    p.append("search[order]", "filter_float_price:asc");
    return {
      otomoto: base + '?' + p.toString(),
      mobileDe: `https://suchen.mobile.de/fahrzeuge/search.html?dam=0&isSearchRequest=true&makeModelVariant1.modelDescription=${make}+${firstModelWord}&minFirstRegistrationDate=${d.year}&sortOption.sortBy=price&sortOption.sortOrder=ASCENDING`
    };
  }

  async function injectUI() {
    if (!location.pathname.includes('/car/')) return;
    if (document.getElementById('ob-root')) return;

    await updateEurRate();
    const d = scrapeAuto1();
    if (!d.make) {
      if (injectionRetries < MAX_RETRIES) { injectionRetries++; setTimeout(injectUI, 1000); }
      return;
    }

    const urls = getSearchUrls(d);
    
    // --- State for Calculator ---
    let salePricePln = 0; 
    let marginEur = 3000;
    let transportPln = 2500;
    let akcyzaType = (d.capacity > 2000) ? 'high' : 'standard';
    
    const fl = d.fuel.toLowerCase();
    if (fl.includes('hybryd') || fl.includes('hybrid')) akcyzaType = d.capacity > 2000 ? 'hybrid_high' : 'hybrid_low';
    if (fl.includes('elektr')) akcyzaType = 'electric';

    const getAkcyzaRate = (type) => {
      switch(type) {
        case 'high': return 0.186;
        case 'hybrid_low': return 0.0155;
        case 'hybrid_high': return 0.093;
        case 'electric': return 0;
        default: return 0.031;
      }
    };

    const container = document.createElement('div');
    container.id = 'ob-root';

    function calculateMaxBid() {
      const rate = getAkcyzaRate(akcyzaType);
      const saleEur = (salePricePln - transportPln) / eurRate;
      let currentFees = getAuto1Fees(d.priceEur || 15000);
      let maxBid = (saleEur - marginEur) / (1 + rate) - currentFees;
      return Math.max(0, Math.round(maxBid));
    }

    function renderPanel(mini) {
      if (mini) {
        container.classList.add('ob-min');
        container.setAttribute('style', 'position:fixed;top:20px;right:20px;z-index:2147483647;width:54px;height:54px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;background:#0f111a;border:2px solid #00f2fe;box-shadow:0 8px 32px rgba(0,0,0,0.6);transition:transform 0.2s;');
        container.innerHTML = '<span style="color:#00f2fe;font-weight:900;font-size:16px;letter-spacing:1px;">OB</span>';
      } else {
        container.classList.remove('ob-min');
        container.setAttribute('style', 'position:fixed;top:20px;right:20px;z-index:2147483647;width:380px;background:rgba(10,12,20,0.98);border:1px solid rgba(255,255,255,0.15);border-radius:24px;padding:26px;font-family:sans-serif;color:#fff;box-shadow:0 15px 60px rgba(0,0,0,0.8);backdrop-filter:blur(20px);max-height:92vh;overflow-y:auto;');

        const maxBid = calculateMaxBid();
        
        container.innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
            <div style="display:flex;flex-direction:column;">
              <span style="font-size:12px;opacity:0.6;font-weight:800;letter-spacing:1px;">OTOMOTO BLICKER</span>
              <span style="font-size:9px;opacity:0.4;">Release v${VERSION}</span>
            </div>
            <div style="display:flex;gap:12px;align-items:center;">
              <div style="text-align:right;">
                <div style="font-size:10px;color:#00f2fe;font-weight:bold;">1€ ≈ ${eurRate.toFixed(4)} PLN</div>
                <div style="font-size:10px;opacity:0.5;">NBP Live</div>
              </div>
              <span id="ob-close" style="cursor:pointer;font-size:28px;opacity:0.7;line-height:1;">−</span>
            </div>
          </div>

          <div id="ob-stats" style="font-size:11px;padding:8px 14px;background:rgba(0,242,254,0.12);color:#00f2fe;border-radius:10px;margin-bottom:22px;display:flex;align-items:center;justify-content:center;border:1px solid rgba(0,242,254,0.1);">Ładowanie trendu rynku...</div>

          <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:18px;padding:20px;margin-bottom:22px;">
            <div style="font-size:10px;opacity:0.4;text-transform:uppercase;margin-bottom:16px;letter-spacing:1.5px;font-weight:700;">Dealer Calculator</div>
            
            <div style="margin-bottom:18px;">
              <label style="font-size:11px;opacity:0.6;display:block;margin-bottom:8px;">Planowana Cena Sprzedaży (PLN)</label>
              <input type="number" id="ob-input-sale" value="${salePricePln}" style="width:100%;height:44px;background:rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.12);border-radius:10px;color:#fff;padding:0 14px;font-size:18px;font-weight:800;outline:none;text-align:center;" placeholder="np. 120 000">
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:18px;">
              <div>
                <label style="font-size:11px;opacity:0.6;display:block;margin-bottom:8px;">Marża (EUR)</label>
                <input type="number" id="ob-input-margin" value="${marginEur}" style="width:100%;height:44px;background:rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.12);border-radius:10px;color:#fff;padding:0 12px;font-size:15px;font-weight:700;outline:none;text-align:center;">
              </div>
              <div>
                <label style="font-size:11px;opacity:0.6;display:block;margin-bottom:8px;">Transport (PLN)</label>
                <input type="number" id="ob-input-trans" value="${transportPln}" style="width:100%;height:44px;background:rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.12);border-radius:10px;color:#fff;padding:0 12px;font-size:15px;font-weight:700;outline:none;text-align:center;">
              </div>
            </div>

            <div style="display:flex;gap:8px;margin-bottom:18px;">
              <button class="ob-q" data-v="1500" style="flex:1;font-size:10px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:6px;color:#fff;cursor:pointer;">1.5k</button>
              <button class="ob-q" data-v="2500" style="flex:1;font-size:10px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:6px;color:#fff;cursor:pointer;">2.5k</button>
              <button class="ob-q" data-v="3500" style="flex:1;font-size:10px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:6px;color:#fff;cursor:pointer;">3.5k</button>
            </div>

            <div style="margin-bottom:20px;">
              <label style="font-size:11px;opacity:0.6;display:block;margin-bottom:8px;">Stawka Akcyzy</label>
              <select id="ob-input-tax" style="width:100%;height:44px;background:rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.12);border-radius:10px;color:#fff;padding:0 12px;font-size:13px;outline:none;cursor:pointer;">
                <option value="standard" ${akcyzaType==='standard'?'selected':''}>Standard (3.1%)</option>
                <option value="high" ${akcyzaType==='high'?'selected':''}>Wysoka (18.6%)</option>
                <option value="hybrid_low" ${akcyzaType==='hybrid_low'?'selected':''}>Hybryda (1.55%)</option>
                <option value="hybrid_high" ${akcyzaType==='hybrid_high'?'selected':''}>Hybryda (9.3%)</option>
                <option value="electric" ${akcyzaType==='electric'?'selected':''}>Elektryk (0%)</option>
              </select>
            </div>

            <div style="border-top:1px solid rgba(255,255,255,0.1);padding-top:20px;text-align:center;">
              <div style="font-size:11px;opacity:0.6;margin-bottom:6px;letter-spacing:1px;">LICYTUJ MAX DO:</div>
              <div id="ob-max-bid" style="font-size:36px;font-weight:900;color:#00f2fe;text-shadow:0 0 20px rgba(0,242,254,0.4);">${maxBid.toLocaleString()} EUR</div>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
            <button id="ob-oto" style="background:#e2111a;color:#fff;border:none;padding:14px;border-radius:12px;cursor:pointer;font-weight:800;font-size:13px;transition:0.2s;">🔍 Otomoto</button>
            <button id="ob-pdf" style="background:linear-gradient(135deg, #00f2fe, #4facfe);color:#010e1a;border:none;padding:14px;border-radius:12px;cursor:pointer;font-weight:900;font-size:13px;transition:0.2s;">📄 Oferta PLN</button>
          </div>

          <div style="font-size:10px;opacity:0.3;text-align:center;border-top:1px solid rgba(255,255,255,0.07);padding-top:14px;">
            ${d.make} ${d.model} | ${d.mileage.toLocaleString()} km | ${d.year}
          </div>
        `;

        // Interactive logic
        const update = () => {
          salePricePln = parseInt(container.querySelector('#ob-input-sale').value) || 0;
          marginEur = parseInt(container.querySelector('#ob-input-margin').value) || 0;
          transportPln = parseInt(container.querySelector('#ob-input-trans').value) || 0;
          akcyzaType = container.querySelector('#ob-input-tax').value;
          container.querySelector('#ob-max-bid').textContent = calculateMaxBid().toLocaleString() + ' EUR';
        };

        ['ob-input-sale', 'ob-input-margin', 'ob-input-trans', 'ob-input-tax'].forEach(id => {
          container.querySelector('#' + id).addEventListener('input', update);
        });

        container.querySelectorAll('.ob-q').forEach(btn => {
          btn.addEventListener('click', () => {
            transportPln = parseInt(btn.dataset.v);
            container.querySelector('#ob-input-trans').value = transportPln;
            update();
          });
        });

        container.querySelector('#ob-pdf').addEventListener('click', generatePdf);
        fetchMarketData(urls.otomoto);
      }
    }

    async function generatePdf() {
      const btn = document.getElementById('ob-pdf');
      const originalText = btn.textContent;
      btn.textContent = '...';
      
      if (!window.jspdf) {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        await new Promise(r => { script.onload = r; document.head.appendChild(script); });
      }

      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      doc.setFont("helvetica", "bold");
      doc.text("OFERTA IMPORTU POJAZDU", 105, 20, { align: 'center' });
      doc.setFontSize(14);
      doc.text(`${d.make} ${d.model}`, 20, 40);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.text(`Produkcja: ${d.year} r.`, 20, 50);
      doc.text(`Przebieg: ${d.mileage.toLocaleString()} km`, 20, 55);
      doc.text(`Silnik: ${d.capacity} ccm (${d.fuel})`, 20, 60);
      
      doc.setDrawColor(0, 242, 254);
      doc.line(20, 70, 190, 70);
      
      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.text(`Cena całkowita: ${salePricePln.toLocaleString()} PLN`, 20, 90);
      
      doc.setFontSize(9);
      doc.setFont("helvetica", "italic");
      doc.text("* Cena zawiera transport, akcyzę, recycling i przygotowanie dokumentów do rejestracji.", 20, 105);
      
      doc.save(`Oferta_${d.make}_${d.model}.pdf`);
      btn.textContent = originalText;
    }

    function fetchMarketData(url) {
      chrome.runtime.sendMessage({ action: "GET_OTOMOTO_STATS", url }, stats => {
        const s = container.querySelector('#ob-stats');
        if (stats && stats.min) {
          s.innerHTML = `Rynek: <b style="margin-left:5px;">${stats.avg.toLocaleString()} PLN</b> <span style="opacity:0.5;margin-left:5px;">(${stats.count} aut)</span>`;
          if (!salePricePln) {
            salePricePln = stats.min;
            const input = container.querySelector('#ob-input-sale');
            if (input) { input.value = salePricePln; container.querySelector('#ob-max-bid').textContent = calculateMaxBid().toLocaleString() + ' EUR'; }
          }
        } else {
          s.textContent = 'Brak danych rynkowych';
        }
      });
    }

    renderPanel(getState());
    document.body.appendChild(container);

    container.addEventListener('click', e => {
      if (e.target.id === 'ob-close') { setState(true); renderPanel(true); }
      else if (container.classList.contains('ob-min')) { setState(false); renderPanel(false); }
      else if (e.target.id === 'ob-oto') window.open(urls.otomoto, '_blank');
    });
  }

  // SPA navigation
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
