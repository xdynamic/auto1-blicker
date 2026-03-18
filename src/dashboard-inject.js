// Auto1 Dashboard Price Tracker v9.1
// Extract stock + price pairs from DOM with robust debugging
console.log('[OB] Dashboard tracker v9.1 loaded - watching for watchlist prices...');

// Save prices to storage
function savePrice(stockNumber, priceEur) {
  if (!stockNumber || !priceEur) return;
  
  chrome.storage.local.get('ob_watchlist_' + stockNumber, function(result) {
    const prices = result['ob_watchlist_' + stockNumber] || [];
    const lastPrice = prices[prices.length - 1];
    
    // Skip if same price within 1 second
    if (lastPrice && lastPrice.price === priceEur && (Date.now() - lastPrice.timestamp) < 1000) {
      return;
    }
    
    prices.push({ price: priceEur, timestamp: Date.now() });
    const data = {};
    data['ob_watchlist_' + stockNumber] = prices.slice(-50);
    chrome.storage.local.set(data, function() {
      console.log('[OB] ✅ Saved ' + stockNumber + ': ' + priceEur + '€');
    });
  });
}

// Scan DOM and extract stock+price pairs from dashboard cards
function scanDOMPrices() {
  try {
    // Try multiple selectors for watchlist items
    let cardDivs = document.querySelectorAll('div.dashboardCard');
    if (cardDivs.length === 0) {
      cardDivs = document.querySelectorAll('div.watchlist-item');
    }
    if (cardDivs.length === 0) {
      cardDivs = document.querySelectorAll('div[class*="card"]');
    }
    
    let foundCount = 0;
    let savedCount = 0;
    
    if (cardDivs.length === 0) {
      console.log('[OB] No cards found with any selector');
      return;
    }
    
    console.log('[OB] 🔍 Scanning ' + cardDivs.length + ' cards...');
    
    cardDivs.forEach(function(cardDiv, index) {
      let stockNumber = null;
      
      // Strategy 1: Look for stock number in parent element IDs
      let parent = cardDiv;
      let depth = 0;
      while (parent && !stockNumber && depth < 10) {
        const id = parent.id || '';
        if (id) {
          // Match pattern: DE86227, PL81234, etc
          if (/^[A-Z]{2}\d{5}$/.test(id)) {
            stockNumber = id;
            break;
          }
          // Also try just numeric IDs
          if (/^\d{4,6}$/.test(id)) {
            stockNumber = id;
            break;
          }
        }
        parent = parent.parentElement;
        depth++;
      }
      
      // Strategy 2: Try to extract from visible text on the card
      if (!stockNumber && cardDiv.textContent) {
        const allText = cardDiv.textContent;
        // Look for stock number pattern
        const stockMatch = allText.match(/([A-Z]{2}\d{5})/);
        if (stockMatch) {
          stockNumber = stockMatch[1];
        }
      }
      
      if (!stockNumber) {
        return; // Skip cards without stock number
      }
      
      // Try to find price in multiple ways
      let priceSpan = cardDiv.querySelector('span[data-qa-id="bidValue"] .value-inner');
      if (!priceSpan) {
        priceSpan = cardDiv.querySelector('span[data-qa-id="bidValue"]');
      }
      if (!priceSpan) {
        priceSpan = cardDiv.querySelector('[class*="bid"]');
      }
      
      if (!priceSpan) {
        return; // Skip if no price found
      }
      
      let priceText = priceSpan.textContent.trim() || priceSpan.innerText.trim();
      
      // Extract price number with flexible matching
      const priceMatch = priceText.match(/(\d+(?:\s\d+)*)\s*€/);
      
      if (priceMatch) {
        const priceStr = priceMatch[1].replace(/\s/g, '');
        const priceEur = parseInt(priceStr);
        
        if (priceEur > 500 && priceEur < 500000) {
          foundCount++;
          
          // Get previous price from storage and save new price
          chrome.storage.local.get('ob_watchlist_' + stockNumber, function(data) {
            const key = 'ob_watchlist_' + stockNumber;
            const history = data[key] || [];
            const lastPrice = history.length > 0 ? history[history.length - 1].price : null;
            
            // Save new price
            savePrice(stockNumber, priceEur);
            savedCount++;
            
            // Add badge with comparison
            addPriceBadge(cardDiv, stockNumber, priceEur, lastPrice);
          });
        }
      }
    });
    
    if (foundCount > 0) {
      console.log('[OB] 📊 Found ' + foundCount + ' prices, saving ' + savedCount);
    }
    
  } catch (e) {
    console.log('[OB] ❌ Error in scanDOMPrices:', e.message);
  }
}

// Add visual price badge to card
function addPriceBadge(cardDiv, stockNumber, currentPrice, lastPrice) {
  try {
    // Remove old badge if exists
    const oldBadge = cardDiv.querySelector('[data-ob-badge]');
    if (oldBadge) oldBadge.remove();
    
    if (!lastPrice) {
      return; // Only show badge if we have history
    }
    
    let indicator = '→';
    let change = 0;
    let bgColor = '#2196f3'; // Blue for no change
    
    if (currentPrice > lastPrice) {
      indicator = '↑';
      change = currentPrice - lastPrice;
      bgColor = '#4caf50'; // Green for price up
    } else if (currentPrice < lastPrice) {
      indicator = '↓';
      change = lastPrice - currentPrice;
      bgColor = '#f44336'; // Red for price down
    }
    
    // Find price value to insert badge next to it
    let priceValueSpan = cardDiv.querySelector('span[data-qa-id="bidValue"]');
    if (!priceValueSpan) {
      priceValueSpan = cardDiv.querySelector('[class*="bid"]');
    }
    
    if (!priceValueSpan) {
      return;
    }
    
    // Create badge element
    const badge = document.createElement('span');
    badge.setAttribute('data-ob-badge', 'true');
    badge.style.cssText = `
      display: inline-block;
      margin-left: 8px;
      padding: 3px 8px;
      background: ${bgColor};
      color: white;
      border-radius: 4px;
      font-size: 12px;
      font-weight: bold;
      white-space: nowrap;
      z-index: 1000;
    `;
    
    badge.textContent = indicator + ' ' + change + '€';
    priceValueSpan.appendChild(badge);
    
  } catch (e) {
    console.log('[OB] Error adding badge:', e.message);
  }
}

// Wait for document to be ready
function setupObserver() {
  if (!document.body) {
    console.log('[OB] Waiting for DOM...');
    setTimeout(setupObserver, 100);
    return;
  }
  
  console.log('[OB] DOM ready, setting up observer');
  
  try {
    // Debounced scan
    let scanTimeout;
    const observer = new MutationObserver(function() {
      clearTimeout(scanTimeout);
      scanTimeout = setTimeout(scanDOMPrices, 500);
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: false,
      attributes: false
    });
    
    console.log('[OB] ✅ MutationObserver installed');
  } catch (e) {
    console.log('[OB] Observer setup error:', e.message);
  }
  
  // Initial scan after React renders (wait 3-5 seconds)
  setTimeout(function() {
    console.log('[OB] Initial scan...');
    scanDOMPrices();
  }, 3000);
}

// Start watching
setupObserver();

// Expose manual trigger for debugging
window.obManualScan = function() {
  console.log('[OB] Manual scan triggered');
  scanDOMPrices();
};
console.log('[OB] 💡 Use window.obManualScan() in console to force scan');
