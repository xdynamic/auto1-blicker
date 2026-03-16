// Auto1 Dashboard Price Tracker v5.0
// Inject as <script> tag to run BEFORE Auto1 patches fetch

// First, save original fetch BEFORE any patching
window.__originalFetch = window.fetch;

// Helper function to search for entities
function findEntitiesInObject(obj, depth = 0) {
  if (depth > 20 || !obj) return null;
  
  if (Array.isArray(obj)) {
    if (obj.length > 0 && obj[0]?.stockNumber) {
      return obj;
    }
    for (let item of obj) {
      const result = findEntitiesInObject(item, depth + 1);
      if (result) return result;
    }
  } else if (typeof obj === 'object') {
    for (let key in obj) {
      if (key === 'entities' && Array.isArray(obj[key]) && obj[key][0]?.stockNumber) {
        return obj[key];
      }
      const result = findEntitiesInObject(obj[key], depth + 1);
      if (result) return result;
    }
  }
  return null;
}

// Save prices to chrome storage
function savePriceToStorage(stockNumber, priceEur) {
  const key = `ob_watchlist_${stockNumber}`;
  chrome.storage.local.get([key], (result) => {
    const prices = result[key] || [];
    const lastPrice = prices[prices.length - 1];
    
    if (lastPrice && lastPrice.price === priceEur) return;
    
    prices.push({ price: priceEur, timestamp: Date.now() });
    chrome.storage.local.set({ [key]: prices.slice(-50) });
    console.error(`[OB] 💾 ${stockNumber}: ${priceEur}€`);
  });
}

// Patch XMLHttpRequest to intercept Auto1's requests
const originalOpen = XMLHttpRequest.prototype.open;
const originalSend = XMLHttpRequest.prototype.send;

XMLHttpRequest.prototype.open = function(method, url) {
  this._obUrl = url;
  return originalOpen.apply(this, arguments);
};

XMLHttpRequest.prototype.send = function(data) {
  const self = this;
  const originalOnReadyStateChange = this.onreadystatechange;
  
  this.onreadystatechange = function() {
    if (this.readyState === 4 && this.status === 200) {
      try {
        const text = this.responseText;
        const data = JSON.parse(text);
        
        // Check for entities
        if (data.entities && Array.isArray(data.entities) && data.entities.length > 0) {
          console.error('[OB] 🎉 XHR found', data.entities.length, 'entities');
          data.entities.forEach(entity => {
            if (entity.stockNumber && entity.price?.price) {
              const priceEur = Math.round(entity.price.price / 100);
              savePriceToStorage(entity.stockNumber, priceEur);
            }
          });
        }
        
        // Search nested
        const found = findEntitiesInObject(data);
        if (found && !data.entities) {
          console.error('[OB] 🎯 XHR found nested', found.length, 'entities');
          found.forEach(entity => {
            if (entity.stockNumber && entity.price?.price) {
              const priceEur = Math.round(entity.price.price / 100);
              savePriceToStorage(entity.stockNumber, priceEur);
            }
          });
        }
      } catch (e) {
        // Not JSON
      }
    }
    
    if (originalOnReadyStateChange) {
      originalOnReadyStateChange.call(this);
    }
  };
  
  return originalSend.apply(this, arguments);
};

console.error('[OB] ✅ XHR interceptor installed');
