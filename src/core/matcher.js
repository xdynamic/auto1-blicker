// Otomoto Model Matcher - v3.0
// Dopasowuje model auta do Otomoto używając otomoto_mapping.json

class OtomotoMatcher {
  constructor(mapping) {
    this.mapping = mapping;
  }

  async match(make, title) {
    const makeData = this.mapping[make];
    
    if (!makeData || !makeData.models) {
      console.log(`[Matcher] No models found for make: ${make}`);
      return null;
    }

    const titleLower = title.toLowerCase();
    
    // KROK 1: Sprawdź czy istnieje dokładny wariant
    const variantMatch = this.findVariant(makeData.models, titleLower);
    if (variantMatch) {
      return {
        slug: variantMatch.slug,
        label: variantMatch.label,
        hasVariant: true,
        confidence: 'high'
      };
    }

    // KROK 2: Sprawdź podstawowy model
    const baseMatch = this.findBaseModel(makeData.models, titleLower, make);
    if (baseMatch) {
      return {
        slug: baseMatch.slug,
        label: baseMatch.label,
        hasVariant: false,
        confidence: baseMatch.score > 5 ? 'high' : 'medium'
      };
    }

    return null;
  }

  findVariant(models, titleLower) {
    // Warianty mają zwykle dodatkowy człon (np. "golf-variant", "a4-avant")
    const variantKeywords = [
      'variant', 'avant', 'allroad', 'touring', 'sportsvan', 
      'alltrack', 'outdoor', 'cabrio', 'coupe', 'gt'
    ];

    for (const [slug, label] of Object.entries(models)) {
      // Sprawdź czy slug zawiera wariant
      const hasVariantKeyword = variantKeywords.some(kw => slug.includes(kw));
      if (!hasVariantKeyword) continue;

      // Sprawdź czy tytuł zawiera ten wariant
      const slugParts = slug.split('-');
      const allPartsMatch = slugParts.every(part => {
        return titleLower.includes(part.replace(/\d+/g, ' $& ').trim());
      });

      if (allPartsMatch) {
        return { slug, label };
      }

      // Alternatywnie: sprawdź czy label pasuje
      const labelLower = label.toLowerCase();
      if (titleLower.includes(labelLower)) {
        return { slug, label };
      }
    }

    return null;
  }

  findBaseModel(models, titleLower, make) {
    let bestMatch = null;
    let bestScore = 0;
    const makeLower = (make || '').toLowerCase();

    // Sortuj modele po długości labela (najdłuższe pierwsze)
    const sortedModels = Object.entries(models).sort((a, b) => {
      return b[1].length - a[1].length;
    });

    for (const [slug, label] of sortedModels) {
      const labelLower = label.toLowerCase();
      
      // Dokładne dopasowanie labela (polska nazwa)
      if (titleLower.includes(labelLower)) {
        const score = labelLower.length * 10;
        if (score > bestScore) {
          bestScore = score;
          bestMatch = { slug, label, score };
        }
      }
      
      // Specjalne dopasowanie dla Mercedes: "Klasa C" ↔ "C-Klasse"
      // Sprawdź czy to model "X-Klasse"
      if (slug.includes('-klasa')) {
        const classCode = slug.split('-')[0]; // np. "c" z "c-klasa"
        // Szukaj wzorca: c-klasse, c-klasa, c klasse, c klasa
        const germanPattern = new RegExp(`\\b${classCode}[-\\s]?klasse\\b`, 'i');
        const polishPattern = new RegExp(`\\bklasa[-\\s]?${classCode}\\b`, 'i');
        
        if (germanPattern.test(titleLower) || polishPattern.test(titleLower)) {
          const score = 50; // Wysoki score dla dopasowania klasy Mercedes
          if (score > bestScore) {
            bestScore = score;
            bestMatch = { slug, label, score };
          }
        }
      }
      
      // Specjalne dopasowanie dla BMW: "Seria 5" ↔ "5er"
      // Sprawdź czy to model "Seria X"
      if (slug.startsWith('seria-')) {
        const seriesNum = slug.split('-')[1]; // np. "5" z "seria-5"
        // Szukaj wzorca: 5er, 3er, 1er (niemieckie nazwy serii)
        const germanSeriesPattern = new RegExp(`\\b${seriesNum}er\\b`, 'i');
        // Szukaj też samej cyfry po spacji: "bmw 5 "
        const numericPattern = new RegExp(`\\bbmw\\s+${seriesNum}\\b`, 'i');
        
        if (germanSeriesPattern.test(titleLower) || numericPattern.test(titleLower)) {
          const score = 50; // Wysoki score dla dopasowania serii BMW
          if (score > bestScore) {
            bestScore = score;
            bestMatch = { slug, label, score };
          }
        }
      }
      
      // Specjalne dopasowanie dla Audi - priorytet dla kodów modeli (Q5, A6, A4) nad cechami
      if (makeLower === 'audi') {
        // Kody modeli Audi: A1-A8, Q1-Q8, e-tron, R8, TT, RS, S
        const audiModelCodes = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 
                                'q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8',
                                'e-tron', 'r8', 'tt', 'rs', 's'];
        
        // Sprawdź czy slug to kod modelu (np. 'q5', 'a6')
        const isModelCode = audiModelCodes.some(code => 
          slug === code || slug.startsWith(code + '-') || slug.startsWith(code + '_')
        );
        
        if (isModelCode) {
          // Wyciągnij bazowy kod z labela (np. "Q5" z "Q5 Sportback")
          const baseCode = label.split(/[\s\-]/)[0].toLowerCase();
          // Szukaj kodu jako osobnego słowa w tytule
          const codePattern = new RegExp(`\\b${baseCode}\\b`, 'i');
          
          if (codePattern.test(titleLower)) {
            const score = 60; // Wyższy score dla kodu modelu Audi
            if (score > bestScore) {
              bestScore = score;
              bestMatch = { slug, label, score };
            }
          }
        }
      }
      
      // Specjalne dopasowanie dla Volvo - priorytet dla XC/S/V serii
      if (makeLower === 'volvo') {
        // Kody Volvo: XC60, XC90, S60, S90, V60, V90, etc.
        const volvoCodes = ['xc', 's', 'v', 'c', 'ex', 'ec', 'em'];
        
        const isVolvoModel = volvoCodes.some(code => slug.startsWith(code));
        
        if (isVolvoModel) {
          // Wyciągnij kod (np. "XC" z "XC60") i numer
          const match = label.match(/^([A-Z]+)\s*(\d+)/i);
          if (match) {
            const [, code, num] = match;
            // Szukaj wzorca: XC60, XC 60, xc60, xc-60
            const patterns = [
              new RegExp(`\\b${code}${num}\\b`, 'i'),
              new RegExp(`\\b${code}[-\\s]?${num}\\b`, 'i')
            ];
            
            if (patterns.some(p => p.test(titleLower))) {
              const score = 60;
              if (score > bestScore) {
                bestScore = score;
                bestMatch = { slug, label, score };
              }
            }
          }
        }
      }
    }

    return bestMatch;
  }

  // Pomocnicza funkcja do normalizacji marki
  static normalizeMake(make) {
    const normalized = make.toLowerCase().trim();
    
    const mappings = {
      'vw': 'volkswagen',
      'mercedes': 'mercedes-benz',
      'mb': 'mercedes-benz',
      'bmw': 'bmw',
      'audi': 'audi',
      'volvo': 'volvo',
      'skoda': 'skoda'
    };

    return mappings[normalized] || normalized;
  }
}

// Klasa jest dostępna globalnie w przeglądarce
