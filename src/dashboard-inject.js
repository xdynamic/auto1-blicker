// Auto1 Dashboard Price Tracker v8.2
// Extract stock + price pairs from DOM
console.log('[OB] Dashboard tracker v8.2 loaded');

// Save prices to storage
function savePrice(stockNumber, priceEur) {
  if (!stockNumber || !priceEur) return;
  
  chrome.storage.local.get('ob_watchlist_' + stockNumber, function(result) {
    const prices = result['ob_watchlist_' + stockNumber] || [];
    const lastPrice = prices[prices.length - 1];
    
    if (lastPrice && lastPrice.price === priceEur) {
      return;
    }
    
    prices.push({ price: priceEur, timestamp: Date.now() });
    const data = {};
    data['ob_watchlist_' + stockNumber] = prices.slice(-50);
    chrome.storage.local.set(data);
    console.log('[OB] 💾 ' + stockNumber + ': ' + priceEur + '€');
  });
}

// Scan DOM and extract stock+price pairs from dashboard cards
function scanDOMPrices() {
  try {
    // Find all dashboard card divs by CLASS (more reliable than id)
    const cardDivs = document.querySelectorAll('div.dashboardCard');
    console.log('[OB] Found ' + cardDivs.length + ' dashboard cards');
    
    let foundCount = 0;
    
    cardDivs.forEach(function(cardDiv) {
      // Get stock number from id attribute of the main card container
      // Walk up to find parent with id matching stock format
      let stockNumber = null;
      let parent = cardDiv;
      
      while (parent && !stockNumber) {
        const id = parent.id;
        if (id && /^[A-Z]{2}\d{5}$/.test(id)) {
          stockNumber = id;
          break;
        }
        parent = parent.parentElement;
      }
      
      if (!stockNumber) {
        console.log('[OB] Could not find stock number in card parents');
        return;
      }
      
      console.log('[OB] Found stock in card: ' + stockNumber);
      
      // Find price element INSIDE this card
      // Structure: span[data-qa-id="bidValue"] > span.value-inner contains "1014 €"
      const priceSpan = cardDiv.querySelector('span[data-qa-id="bidValue"] .value-inner');
      if (!priceSpan) {
        console.log('[OB] No price span found for ' + stockNumber);
        return;
      }
      
      // Extract price: "1014 €" or "11 118 €" or "12 940 €" (with spaces)
      const priceText = priceSpan.textContent.trim();
      console.log('[OB] Price text for ' + stockNumber + ': "' + priceText + '"');
      
      // Match price with optional spaces between digit groups: 1014, 11 118, 12 940
      const priceMatch = priceText.match(/(\d+(?:\s\d+)*)\s*€/);
      
      if (priceMatch) {
        // Remove all spaces from captured price
        const priceStr = priceMatch[1].replace(/\s/g, '');
        const priceEur = parseInt(priceStr);
        
        // Sanity check: reasonable price range
        if (priceEur > 500 && priceEur < 500000) {
          savePrice(stockNumber, priceEur);
          foundCount++;
          console.log('[OB] 💾 ' + stockNumber + ': ' + priceEur + '€');
        }
      }
    });
    
    console.log('[OB] Scan complete: extracted ' + foundCount + ' prices');
    
    if (foundCount > 0) {
      console.log('[OB] ✅ Extracted ' + foundCount + ' stock/price pairs');
    }
  } catch (e) {
    console.log('[OB] Scan error:', e.message);
    console.log('[OB] Stack:', e.stack);
  }
}

// Try fetch interception (backup)
const OriginalFetch = window.fetch;
let fetchCount = 0;
if (OriginalFetch) {
  window.fetch = function() {
    fetchCount++;
    const fetchPromise = OriginalFetch.apply(this, arguments);
    
    return fetchPromise.then(function(response) {
      const cloneResponse = response.clone();
      
      cloneResponse.text().then(function(text) {
        try {
          const json = JSON.parse(text);
          
          if (json && json.entities && Array.isArray(json.entities) && json.entities.length > 0) {
            console.log('[OB] 🎉 Fetch #' + fetchCount + ': Found ' + json.entities.length + ' entities');
            
            json.entities.forEach(function(entity) {
              if (entity.stockNumber && entity.price && entity.price.price) {
                savePrice(entity.stockNumber, Math.round(entity.price.price / 100));
              }
            });
          }
        } catch (e) {
          // Not JSON
        }
      }).catch(function(e) {
        // Ignore
      });
      
      return response;
    });
  };
  console.log('[OB] Fetch interceptor installed');
}

// Wait for document to be ready
function setupObserver() {
  if (!document.body) {
    setTimeout(setupObserver, 100);
    return;
  }
  
  console.log('[OB] DOM ready, setting up observer');
  
  try {
    const observer = new MutationObserver(function(mutations) {
      if (window.__obScanTimeout) {
        clearTimeout(window.__obScanTimeout);
      }
      
      window.__obScanTimeout = setTimeout(function() {
        scanDOMPrices();
      }, 500); // Debounce at 500ms
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: false,
      attributes: false
    });
    
    console.log('[OB] ✅ MutationObserver installed');
  } catch (e) {
    console.log('[OB] Observer setup error:', e);
  }
  
  // Initial scan after delay (wait longer for React to load)
  setTimeout(function() {
    console.log('[OB] Running initial scan (React should be loaded)...');
    scanDOMPrices();
  }, 5000);
}

// Start setup
setupObserver();
