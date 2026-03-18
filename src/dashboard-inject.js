// Auto1 Dashboard Price Tracker v9.1
// Extract stock + price pairs from DOM with robust debugging
console.log('[OB] Dashboard tracker v9.1 loaded - watching for watchlist prices...');

// Cache to store card and price span references by stock number
// Allows async callbacks to find elements even after initial DOM scan
const stockElementCache = new Map();

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
// For development/testing: Uses 2-minute window to show any different price
// For production: Could use 30-minute window to ignore same-day duplicates
function getPreviousPrice(stockNumber, currentPrice, callback) {
  chrome.storage.local.get('ob_watchlist_' + stockNumber, function(result) {
    const history = result['ob_watchlist_' + stockNumber] || [];
    const now = Date.now();
    // DEV MODE: Use 2-minute window (allows any different price from recent scans)
    // PROD MODE: Use 30-minute window to ignore same-day duplicate scans
    const timeWindowMinutes = 2; // Change to 30 for production
    const cutoffTime = now - (timeWindowMinutes * 60 * 1000);
    
    // Debug: Log what we found in storage
    console.log('[OB] Storage lookup for ' + stockNumber + ': found ' + history.length + ' entries');
    if (history.length > 0) {
      const recentCount = history.filter(e => e.timestamp >= cutoffTime).length;
      console.log('[OB]   - Last 3: ' + JSON.stringify(history.slice(-3).map(e => e.price + '€@' + new Date(e.timestamp).toLocaleTimeString())));
      console.log('[OB]   - Current time: ' + new Date().toLocaleTimeString() + ', cutoff (' + timeWindowMinutes + 'm ago): ' + new Date(cutoffTime).toLocaleTimeString());
      console.log('[OB]   - Prices in window: ' + recentCount + '/' + history.length);
    }
    
    // Find last price that is old enough (different from current is bonus)
    // Strategy: Look for DIFFERENT + OLD, but accept ANY OLD if no different exists
    let prevPrice = null;
    let oldestPrice = null;
    let oldestTime = now;
    
    for (let i = history.length - 1; i >= 0; i--) {
      const entry = history[i];
      const isOldEnough = entry.timestamp < cutoffTime;
      const isDifferent = entry.price !== currentPrice;
      
      // Track oldest price for fallback
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestPrice = entry.price;
      }
      
      // Priority 1: Different + Old (price actually changed)
      if (isDifferent && isOldEnough) {
        prevPrice = entry.price;
        console.log('[OB]   ✓ Found valid previous price (DIFFERENT): ' + prevPrice + '€ (age: ' + Math.round((now - entry.timestamp) / 1000) + 's ago)');
        break;
      }
    }
    
    // Priority 2 (fallback): If no different price found, use oldest one (even if same)
    // This allows badges to show during development when prices don't change
    if (!prevPrice && oldestPrice !== null && oldestTime < cutoffTime) {
      prevPrice = oldestPrice;
      console.log('[OB]   ✓ Found oldest previous price (SAME): ' + prevPrice + '€ (age: ' + Math.round((now - oldestTime) / 1000) + 's ago, no different prices exist)');
    }
    
    if (!prevPrice && history.length > 0) {
      console.log('[OB]   → No valid previous price found (current=' + currentPrice + '€, all prices too recent or no history outside window)');
    }
    
    callback(prevPrice);
  });
}

// Scan DOM and extract stock+price pairs from dashboard cards
function scanDOMPrices() {
  try {
    console.log('[OB] 🔄 Starting new scan (clearing ' + stockElementCache.size + ' old cache entries)...');
    stockElementCache.clear();
    
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
      // IMPORTANT: Track which element we use for caching!
      if (!priceText || !priceText.includes('€')) {
        const allElements = cardDiv.querySelectorAll('*');
        for (let i = 0; i < allElements.length; i++) {
          const text = allElements[i].textContent;
          if (text.includes('€') && text.match(/\d+\s*€/)) {
            priceText = text;
            priceSpan = allElements[i]; // Update to actual element containing price
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
      
      // Cache card and priceSpan references PLUS get lastPrice immediately
      // priceSpan is the actual element we used to extract price
      stockElementCache.set(stockNumber, { card: cardDiv, priceSpan: priceSpan });
      console.log('[OB]   → Cached element references (cache size now: ' + stockElementCache.size + ', priceSpan=' + (priceSpan ? 'YES' : 'NO') + ')');
      
      // Get previous DIFFERENT price and add badge IMMEDIATELY (synchronously in callback)
      getPreviousPrice(stockNumber, priceEur, function(prevPrice) {
        // Store lastPrice in cache for future reference
        const cached = stockElementCache.get(stockNumber);
        if (cached) {
          cached.lastPrice = prevPrice;
        }
        
        // Save price to storage
        savePrice(stockNumber, priceEur);
        
        // Add badge using cache (should be valid - just populated)
        addPriceBadge(stockNumber, priceEur, prevPrice);
      });
    });
    
    if (foundCount > 0) {
      console.log('[OB] 📊 Processed ' + foundCount + ' prices');
    }
    
  } catch (e) {
    console.log('[OB] ❌ Error:', e.message);
  }
}

// Add visual price badge to card
// Retrieves card and priceSpan from cache (stored during DOM scan)
function addPriceBadge(stockNumber, currentPrice, lastPrice) {
  try {
    console.log('[OB] Badge attempt: ' + stockNumber + ' current=' + currentPrice + ' last=' + lastPrice);
    
    if (!lastPrice) {
      console.log('[OB] Skip badge for ' + stockNumber + ' - no history');
      return; // Only show badge if we have history
    }
    
    // Retrieve cached card and priceSpan
    const cached = stockElementCache.get(stockNumber);
    if (!cached) {
      console.log('[OB] ❌ Cache MISS for ' + stockNumber + ' (cache size: ' + stockElementCache.size + ')');
      return;
    }
    
    let cardDiv = cached.card;
    let priceSpan = cached.priceSpan;
    
    console.log('[OB] ✓ Cache HIT for ' + stockNumber + ': card=' + (cardDiv ? 'YES' : 'NO') + ' priceSpan=' + (priceSpan ? 'YES' : 'NO'));
    
    if (!cardDiv) {
      console.log('[OB] Cache incomplete for ' + stockNumber + ': missing card');
      return;
    }
    
    // If priceSpan is missing, try to find it again
    if (!priceSpan) {
      console.log('[OB] ⚠️  PriceSpan missing from cache, searching in card...');
      
      // Try the bidValue selector first
      priceSpan = cardDiv.querySelector('span[data-qa-id="bidValue"]');
      
      // If still not found, search for element with €
      if (!priceSpan) {
        const allElements = cardDiv.querySelectorAll('*');
        for (let i = 0; i < allElements.length; i++) {
          const text = allElements[i].textContent;
          if (text.includes('€') && text.match(/\d+\s*€/) && text.match(/(\d+)/)[1] == currentPrice) {
            priceSpan = allElements[i];
            console.log('[OB] ✓ Found priceSpan element by search');
            break;
          }
        }
      }
      
      if (priceSpan) {
        cached.priceSpan = priceSpan;
      } else {
        console.log('[OB] ❌ Could not find priceSpan element');
      }
    }
    
    if (!priceSpan) {
      console.log('[OB] Cache incomplete for ' + stockNumber + ': missing priceSpan');
      return;
    }
    
    // Check if elements still exist in DOM
    if (!cardDiv.parentNode) {
      console.log('[OB] Card removed from DOM: ' + stockNumber);
      stockElementCache.delete(stockNumber);
      return;
    }
    
    if (!priceSpan.parentNode) {
      console.log('[OB] ❌ PriceSpan removed from DOM: ' + stockNumber);
      console.log('[OB]    PriceSpan classList: ' + priceSpan.className);
      console.log('[OB]    PriceSpan currentDisplay: ' + window.getComputedStyle(priceSpan).display);
      stockElementCache.delete(stockNumber);
      return;
    }
    
    console.log('[OB] ✓ Both elements still in DOM for ' + stockNumber);
    
    // Remove old badge
    const oldBadge = cardDiv.querySelector('[data-ob-badge]');
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
    priceSpan.appendChild(badge);
    console.log('[OB] ✅ Badge added ' + stockNumber + ': ' + indicator + ' ' + change + '€');
    
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
