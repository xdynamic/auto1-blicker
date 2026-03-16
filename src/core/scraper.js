// Auto1 Scraper - v3.0
// Ekstrahuje dane z strony Auto1.com

class Auto1Scraper {
  constructor() {
    this.data = {
      make: "",
      model: "",
      year: "",
      fuel: "",
      capacity: 0,
      power: 0,
      mileage: 0,
      transmission: "",
      bodyType: "",
      priceEur: 0,
      auctionFeeEur: null,
      hasSecondWheelSet: false,
      stockNumber: "",
      location: "",
      title: ""
    };
  }

  scrape() {
    this.scrapeTitle();
    this.scrapeStockNumber();
    this.scrapeTechnicalData();
    this.scrapePrice();
    this.scrapeAuctionFee();
    this.detectSecondWheelSet();
    this.scrapeLocation();
    console.log('[OB Scraper] Extracted data:', this.data);
    return this.data;
  }

  scrapeTitle() {
    const selectors = [
      '.ctaBar__name span',
      '.car-info-title h2',
      'h2.no-score',
      '[data-qa-id="car-title"]'
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el && el.textContent.trim()) {
        this.data.title = el.textContent.trim();
        this.parseTitle(this.data.title);
        return;
      }
    }
  }

  parseTitle(title) {
    const parts = title.split(/\s+/);
    
    // Marka
    let make = parts[0].toLowerCase();
    if (make === 'vw') make = 'volkswagen';
    if (make.includes('mercedes')) make = 'mercedes-benz';
    this.data.make = make;

    // Model (reszta tytułu)
    this.data.model = parts.slice(1).join(' ');

    // Body type z tytułu
    this.data.bodyType = this.detectBodyType(title.toLowerCase());
  }

  detectBodyType(titleLower) {
    // Mercedes T-Modell
    if (/\w\s+\d+\s+t\b/.test(titleLower) || titleLower.includes('t-modell')) return 'combi';
    
    // BMW Touring
    if (titleLower.includes('touring')) return 'combi';
    
    // Audi Avant/Allroad
    if ((titleLower.includes('avant') && !titleLower.includes('avantgarde')) || titleLower.includes('allroad')) return 'combi';
    
    // VW/Skoda/Volvo kombis
    if (titleLower.includes('variant') || titleLower.includes('sportsvan') || 
        titleLower.includes('alltrack') || titleLower.includes('outdoor')) return 'combi';
    
    if (titleLower.includes('volvo v') && /\bv\d+\b/.test(titleLower)) return 'combi';
    
    // Generic
    if (titleLower.includes('kombi') || titleLower.includes('combi') || 
        titleLower.includes('break') || titleLower.includes('estate') || 
        titleLower.includes('shooting brake') || titleLower.includes('sportwagon')) return 'combi';
    
    if (titleLower.includes('sedan') || titleLower.includes('limousine')) return 'sedan';
    if (titleLower.includes('hatchback')) return 'hatchback';
    
    return '';
  }

  scrapeStockNumber() {
    const urlMatch = window.location.pathname.match(/\/car\/(DX\d+)/i);
    if (urlMatch) {
      this.data.stockNumber = urlMatch[1];
    }
  }

  scrapeTechnicalData() {
    // Auto1 używa tabel HTML: <tr><td>Label:</td><td>Value</td></tr>
    const rows = document.querySelectorAll('tr');
    
    rows.forEach(row => {
      const cells = row.querySelectorAll('td');
      if (cells.length >= 2) {
        const label = cells[0].textContent.trim().toLowerCase();
        const value = cells[1].textContent.trim();
        
        if (label && value) {
          this.parseSpecRow(label, value);
          // Spróbuj detectować body type z wartości w tabeli
          this.detectBodyTypeFromSpec(label, value);
        }
      }
    });
  }

  detectBodyTypeFromSpec(label, value) {
    // Tylko jeśli body type nie został jeszcze ustawiony z tytułu
    if (this.data.bodyType) return;
    
    const valueLower = value.toLowerCase();
    
    // Szukaj body type w labelach: "Body Type", "Typ pojazdu", "Rodzaj nadwozia", "Karosserie" itp.
    if (label.includes('body') || label.includes('typ') || label.includes('nadwozia') ||
        label.includes('karosserie') || label.includes('carrosserie') || 
        label.includes('tipo') || label.includes('tipo di')) {
      
      // Sprawdź wartość
      if (valueLower.includes('combi') || valueLower.includes('estate') || 
          valueLower.includes('wagon') || valueLower.includes('avant') ||
          valueLower.includes('break') || valueLower.includes('kombi')) {
        this.data.bodyType = 'combi';
        console.log(`[OB Scraper] Detected combi from "${label}": "${value}"`);
      } else if (valueLower.includes('sedan') || valueLower.includes('limousine')) {
        this.data.bodyType = 'sedan';
        console.log(`[OB Scraper] Detected sedan from "${label}": "${value}"`);
      } else if (valueLower.includes('hatchback') || valueLower.includes('htb')) {
        this.data.bodyType = 'hatchback';
        console.log(`[OB Scraper] Detected hatchback from "${label}": "${value}"`);
      }
    }
  }

  parseSpecRow(label, value) {
    if (!value) return;
    
    const valueLower = value.toLowerCase();
    
    // Rok produkcji
    if (label.includes('rok') || label.includes('year') || label.includes('produkcj')) {
      const yearMatch = value.match(/\b(19|20)\d{2}\b/);
      if (yearMatch) this.data.year = yearMatch[0];
    }
    
    // Paliwo
    if (label.includes('paliw') || label.includes('fuel')) {
      this.data.fuel = value;
    }
    
    // Przebieg
    if (label.includes('przebieg') || label.includes('mileage')) {
      this.data.mileage = parseInt(value.replace(/\D/g, '')) || 0;
    }
    
    // Pojemność
    if (label.includes('pojemn') || label.includes('capacity')) {
      const match = value.match(/(\d[\d\s]*)/);
      if (match) this.data.capacity = parseInt(match[1].replace(/\s/g, ''));
    }
    
    // Moc
    if (label.includes('moc') || label.includes('power') || label.includes('leistung')) {
      const match = value.match(/(\d+)\s*(KM|PS|HP|kW)/i);
      if (match) {
        let power = parseInt(match[1]);
        if (match[2].toLowerCase() === 'kw') {
          power = Math.round(power * 1.36);
        }
        this.data.power = power;
      }
    }
    
    // Skrzynia biegów
    if (label.includes('skrzynia') || label.includes('transmission') || label.includes('getriebe')) {
      if (valueLower.includes('automa') || valueLower.includes('dwu') || 
          valueLower.includes('pdk') || valueLower.includes('dsg')) {
        this.data.transmission = 'automatic';
      } else if (valueLower.includes('manua') || valueLower.includes('manual')) {
        this.data.transmission = 'manual';
      }
    }
  }

  scrapePrice() {
    // Auto1 ma cenę w różnych miejscach - sprawdź wszystkie
    const selectors = [
      '[data-qa-id="car-price"]',
      '.car-price',
      '.price-value',
      '.ctaBar__price',
      '[class*="price"]'
    ];

    // Najpierw szukaj w całym dokumencie
    const bodyText = document.body.textContent;
    const pricePatterns = [
      /Minimalna oferta[:\s]*(\d[\d\s]*)\s*€/i,
      /Cena Auto1[:\s]*(\d[\d\s]*)\s*€/i,
      /(\d{3,}[\s\d]*)\s*€/
    ];

    for (const pattern of pricePatterns) {
      const match = bodyText.match(pattern);
      if (match) {
        const price = match[1].replace(/\s/g, '');
        const priceNum = parseInt(price);
        if (priceNum > 1000) { // Sensowna cena (>1000 EUR)
          this.data.priceEur = priceNum;
          return;
        }
      }
    }

    // Fallback: szukaj w elementach
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) {
        const priceText = el.textContent;
        const priceMatch = priceText.match(/(\d[\d\s,\.]*)\s*€/);
        if (priceMatch) {
          const price = priceMatch[1].replace(/[\s,\.]/g, '');
          this.data.priceEur = parseInt(price) || 0;
          return;
        }
      }
    }
  }

  scrapeLocation() {
    const rows = document.querySelectorAll('.car-details-list .item, .simple-list .item');
    
    rows.forEach(row => {
      const titleEl = row.querySelector('.title');
      const descEl = row.querySelector('.description');
      
      if (!titleEl || !descEl) return;
      
      const label = titleEl.textContent.trim().toLowerCase();
      const value = descEl.textContent.trim();
      
      if (label.includes('lokalizacja') || label.includes('location') || label.includes('standort')) {
        this.data.location = value;
      }
    });
  }

  scrapeAuctionFee() {
    // Best-effort: znajdź kwotę "Auktionsgebühr" / "Auction fee" / "aukcyjna" w tekście strony
    const bodyText = document.body?.textContent || '';
    const patterns = [
      /Auktionsgebühr[:\s]*([\d.,]+)\s*€/i,
      /Auction\s*fee[:\s]*([\d.,]+)\s*€/i,
      /opłata\s*aukcyjna[:\s]*([\d.,]+)\s*€/i
    ];

    for (const re of patterns) {
      const m = bodyText.match(re);
      if (m && m[1]) {
        const raw = m[1].replace(/\s/g, '').replace(',', '.');
        const value = parseFloat(raw);
        if (Number.isFinite(value) && value >= 0 && value <= 1950) {
          this.data.auctionFeeEur = Math.round(value * 100) / 100;
          return;
        }
      }
    }
  }

  detectSecondWheelSet() {
    // Conservative: tylko jeśli strona wprost wspomina o 2. zestawie kół/radsatz
    const bodyText = (document.body?.textContent || '').toLowerCase();
    const has = /\b(2\.\s*radsatz|zweiter\s*radsatz|second\s*wheel\s*set|drugi\s*zestaw\s*k[óo][łl])\b/i.test(bodyText);
    this.data.hasSecondWheelSet = !!has;
  }
}

// Klasa jest dostępna globalnie w przeglądarce
