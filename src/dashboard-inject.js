// Auto1 Dashboard Price Tracker v9.1
// Extract stock + price pairs from DOM with robust debugging
console.log('[OB] Dashboard tracker v9.1 loaded - watching for watchlist prices...');

// Save prices to storage
function savePrice(stockNumber, priceEur) {
  if (!stockNumber || !priceEur) return;
  
  chrome.storage.local.get('ob_watchlist_' + stockNumber, function(result) {
    const prices = result['ob_watchlist_' + stockNumber] || [];
    
    // Check if this exact price was saved within last 5 seconds (avoid duplicate scans)
    const lastPrice = prices[prices.length - 1];
    if (lastPrice && lastPrice.price === priceEur && (Date.now() - lastPrice.timestamp) < 5000) {
      return; // Skip duplicate from same scan
    }
    
    prices.push({ price: priceEur, timestamp: Date.now() });
    const data = {};
    data['ob_watchlist_' + stockNumber] = prices.slice(-50);
    chrome.storage.local.set(data, function() {
      console.log('[OB] ✅ Saved ' + stockNumber + ': ' + priceEur + '€');
    });
  });
}

// Get previous DIFFERENT price from history
// Ignores prices from last 30 minutes (same-day scans)
// Only compares with prices from "previous session" (different day/time)
function getPreviousPrice(stockNumber, currentPrice, callback) {
  chrome.storage.local.get('ob_watchlist_' + stockNumber, function(result) {
    const history = result['ob_watchlist_' + stockNumber] || [];
    const now = Date.now();
    const thirtyMinutesAgo = now - (30 * 60 * 1000);
    
    // Find last price that:
    // 1. Is different from current price
    // 2. Is older than 30 minutes (different scan session, not same-day duplicate)
    let prevPrice = null;
    for (let i = history.length - 1; i >= 0; i--) {
      const entry = history[i];
      if (entry.price !== currentPrice && entry.timestamp < thirtyMinutesAgo) {
        prevPrice = entry.price;
        break;
      }
    }
    
    callback(prevPrice);
  });
}

// Scan DOM and extract stock+price pairs from dashboard cards
function scanDOMPrices() {
  try {
    // FIRST: Try primary selector - div.dashboardCard
    let cardDivs = document.querySelectorAll('div.dashboardCard');
    
    if (cardDivs.length === 0) {
      console.log('[OB] No div.dashboardCard found, trying fallbacks...');
      
      // Fallback 1: Look for divs with dashboardCard in class
      cardDivs = document.querySelectorAll('[class*="dashboardCard"]');
      console.log('[OB] Fallback [class*="dashboardCard"]: ' + cardDivs.length);
      
      // Fallback 2: Look for divs that contain both stock ID and price
      if (cardDivs.length === 0) {
        const allDivs = document.querySelectorAll('div[id]');
        const filtered = [];
        allDivs.forEach(function(div) {
          const id = div.id;
          // Check if ID looks like stock number   
          if (/^[A-Z]{2}\d{5}$/.test(id) || /^\d{5,6}$/.test(id)) {
            filtered.push(div);
          }
        });
        cardDivs = filtered;
        console.log('[OB] Fallback div[id] matching stock pattern: ' + cardDivs.length);
      }
    } else {
      console.log('[OB] Found div.dashboardCard: ' + cardDivs.length);
    }
    
    let foundCount = 0;
    
    if (cardDivs.length === 0) {
      console.log('[OB] ⚠️ No cards found');
      return;
    }
    
    console.log('[OB] 🔍 Scanning ' + cardDivs.length + ' card(s)...');
    
    cardDivs.forEach(function(cardDiv, index) {
      let stockNumber = null;
      
      // Get stock number from parent ID (prioritize direct parent)
      let parent = cardDiv;
      let depth = 0;
      while (parent && !stockNumber && depth < 5) {
        const id = parent.id || '';
        if (id && (/^[A-Z]{2}\d{5}$/.test(id) || /^\d{5,6}$/.test(id))) {
          stockNumber = id;
          console.log('[OB] Found stock ' + stockNumber + ' at parent depth ' + depth);
          break;
        }
        parent = parent.parentElement;
        depth++;
      }
      
      if (!stockNumber) {
        console.log('[OB] Card ' + index + ': No stock number found');
        return;
      }
      
      // Find price - try multiple selectors
      let priceSpan = null;
      let priceText = '';
      
      // Try exact selector first
      priceSpan = cardDiv.querySelector('span[data-qa-id="bidValue"]');
      if (priceSpan) {
        const valueInner = priceSpan.querySelector('.value-inner');
        if (valueInner) {
          priceText = valueInner.textContent;
        } else {
          priceText = priceSpan.textContent;
        }
      }
      
      // Fallback: search for any element with € symbol
      if (!priceText || !priceText.includes('€')) {
        const allElements = cardDiv.querySelectorAll('*');
        for (let i = 0; i < allElements.length; i++) {
          const text = allElements[i].textContent;
          if (text.includes('€') && text.match(/\d+\s*€/)) {
            priceText = text;
            break;
          }
        }
      }
      
      priceText = priceText.trim();
      
      if (!priceText) {
        console.log('[OB] ' + stockNumber + ': No price text found');
        return;
      }
      
      // Extract just the number
      const priceMatch = priceText.match(/(\d+(?:\s\d+)*)\s*€/);
      
      if (!priceMatch) {
        console.log('[OB] ' + stockNumber + ': Could not parse price from "' + priceText + '"');
        return;
      }
      
      const priceStr = priceMatch[1].replace(/\s/g, '');
      const priceEur = parseInt(priceStr);
      
      if (priceEur < 500 || priceEur > 500000) {
        console.log('[OB] ' + stockNumber + ': Price ' + priceEur + '€ out of range');
        return;
      }
      
      foundCount++;
      console.log('[OB] ✅ ' + stockNumber + ': ' + priceEur + '€');
      
      // Get previous DIFFERENT price (ignores same-day duplicates) and save
      // Don't preserve DOM refs - they'll be stale after React re-render
      // Instead, use closure with just stockNumber for later re-finding
      (function(stock) {
        getPreviousPrice(stock, priceEur, function(prevPrice) {
          savePrice(stock, priceEur);
          addPriceBadge(stock, priceEur, prevPrice);
        });
      })(stockNumber);
    });
    
    if (foundCount > 0) {
      console.log('[OB] 📊 Processed ' + foundCount + ' prices');
    }
    
  } catch (e) {
    console.log('[OB] ❌ Error:', e.message);
  }
}

// Add visual price badge to card
// Re-finds card and priceSpan on demand (called after getPreviousPrice callback)
// This avoids stale DOM reference issues from React re-renders
function addPriceBadge(stockNumber, currentPrice, lastPrice) {
  try {
    console.log('[OB] Badge: ' + stockNumber + ' current=' + currentPrice + ' last=' + lastPrice);
    
    if (!lastPrice) {
      console.log('[OB] No lastPrice history yet for ' + stockNumber);
      return; // Only show badge if we have history
    }
    
    // Re-find card and price span in current live DOM
    const allCards = document.querySelectorAll('div.dashboardCard, [class*="dashboardCard"]');
    let foundCard = null;
    let foundPriceSpan = null;
    
    for (let i = 0; i < allCards.length; i++) {
      const card = allCards[i];
      const parentId = card.id || '';
      
      // Try to match stock number in card ID or surrounding elements
      if (parentId.includes(stockNumber)) {
        foundCard = card;
        break;
      }
    }
    
    if (!foundCard) {
      console.log('[OB] Could not find card for ' + stockNumber);
      return;
    }
    
    // Find price span in this card
    foundPriceSpan = foundCard.querySelector('span[data-qa-id="bidValue"]');
    if (!foundPriceSpan) {
      foundPriceSpan = foundCard.querySelector('[class*="bid"]');
    }
    
    if (!foundPriceSpan) {
      console.log('[OB] Could not find price span for ' + stockNumber);
      return;
    }
    
    // Remove old badge
    const oldBadge = foundCard.querySelector('[data-ob-badge]');
    if (oldBadge) oldBadge.remove();
    
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
    foundPriceSpan.appendChild(badge);
    console.log('[OB] 🎨 Badge added ' + stockNumber + ': ' + indicator + ' ' + change + '€');
    
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
    // IMPORTANT: Add debounce flag to prevent infinite loops
    let isScanning = false;
    let scanTimeout;
    
    const observer = new MutationObserver(function() {
      // Skip if already scanning
      if (isScanning) return;
      
      clearTimeout(scanTimeout);
      scanTimeout = setTimeout(function() {
        isScanning = true;
        scanDOMPrices();
        isScanning = false;
      }, 1000);  // Debounce at 1 second
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: false,
      attributes: false
    });
    
    console.log('[OB] ✅ MutationObserver installed (with debounce protection)');
  } catch (e) {
    console.log('[OB] Observer setup error:', e.message);
  }
  
  // Initial scan - wait longer for React first render
  setTimeout(function() {
    console.log('[OB] First scan (3s delay)...');
    scanDOMPrices();
  }, 3000);
  
  // Second scan after React fully loads
  setTimeout(function() {
    console.log('[OB] Second scan (6s delay)...');
    scanDOMPrices();
  }, 6000);
}

// Start watching
setupObserver();

// Expose manual trigger for debugging - register DIRECTLY
if (!window.obManualScan) {
  window.obManualScan = scanDOMPrices;
}
console.log('[OB] 💡 Manual scan: window.obManualScan()');
console.log('[OB] ✅ Dashboard tracker ready!');
