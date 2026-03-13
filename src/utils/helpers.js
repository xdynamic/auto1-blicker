// Helper Functions - v3.0

const Helpers = {
  // Formatowanie liczby (bez lub z walutą)
  formatPrice(price, currency = null) {
    const formatted = new Intl.NumberFormat('pl-PL', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price);
    return currency ? `${formatted} ${currency}` : formatted;
  },

  // Formatowanie przebiegu
  formatMileage(km) {
    return new Intl.NumberFormat('pl-PL').format(km) + ' km';
  },

  // Debounce
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => { clearTimeout(timeout); func(...args); };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  // Sprawdź czy jesteśmy na Auto1
  isAuto1Page() {
    return window.location.hostname.includes('auto1.com') &&
           window.location.pathname.includes('/car/');
  },

  // Pobierz stock number z URL
  getStockNumberFromUrl() {
    const match = window.location.pathname.match(/\/car\/(DX\d+)/i);
    return match ? match[1] : null;
  },

  // Normalizacja kraju
  normalizeCountry(location) {
    const countryMap = {
      // Niemcy
      'niemcy': 'DE', 'deutschland': 'DE', 'germany': 'DE',
      // Polska
      'polska': 'PL', 'polen': 'PL', 'poland': 'PL',
      // Austria
      'austria': 'AT', 'österreich': 'AT',
      // Belgia
      'belgia': 'BE', 'belgien': 'BE', 'belgium': 'BE', 'belgique': 'BE',
      // Holandia
      'holandia': 'NL', 'niederlande': 'NL', 'netherlands': 'NL', 'nederland': 'NL',
      // Francja
      'francja': 'FR', 'frankreich': 'FR', 'france': 'FR',
      // Włochy
      'włochy': 'IT', 'italien': 'IT', 'italy': 'IT', 'italia': 'IT',
      // Hiszpania
      'hiszpania': 'ES', 'spanien': 'ES', 'spain': 'ES', 'españa': 'ES',
      // Portugalia
      'portugalia': 'PT', 'portugal': 'PT',
      // Szwecja
      'szwecja': 'SE', 'schweden': 'SE', 'sweden': 'SE',
      // Dania
      'dania': 'DK', 'dänemark': 'DK', 'denmark': 'DK',
      // Finlandia
      'finlandia': 'FI', 'finnland': 'FI', 'finland': 'FI'
    };

    const locationLower = location.toLowerCase();

    for (const [key, code] of Object.entries(countryMap)) {
      if (locationLower.includes(key)) return code;
    }

    // Sprawdź czy to już kod kraju (2 wielkie litery)
    const codeMatch = location.match(/\b([A-Z]{2})\b/);
    if (codeMatch) return codeMatch[1];

    return 'DE'; // Domyślnie Niemcy
  },

  // Wait for element
  waitForElement(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const element = document.querySelector(selector);
      if (element) return resolve(element);

      const observer = new MutationObserver(() => {
        const el = document.querySelector(selector);
        if (el) { observer.disconnect(); resolve(el); }
      });

      observer.observe(document.body, { childList: true, subtree: true });

      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Element ${selector} not found within ${timeout}ms`));
      }, timeout);
    });
  },

  // Logowanie
  log(...args) {
    console.log('%c[OB]', 'background:#1562d6;color:#fff;font-weight:bold;padding:2px 4px;border-radius:3px;', ...args);
  },

  error(...args) {
    console.error('%c[OB]', 'background:#ef4444;color:#fff;font-weight:bold;padding:2px 4px;border-radius:3px;', ...args);
  }
};
