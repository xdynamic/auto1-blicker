// Auto1 Fee Calculator - v3.0
// Oblicza opłaty Auto1 zgodnie z cennikiem 2026

class Auto1FeeCalculator {
  constructor(feeData) {
    this.fees = feeData;
  }

  calculate(carLocation, buyerCountry, priceEur, options = {}) {
    const countryFees = this.fees.countries[buyerCountry];
    if (!countryFees) {
      return null;
    }

    const result = {
      handling: 0,
      documents: 0,
      transport: 0,
      secondWheelSet: 0,
      auctionFee: 0,
      subtotal: 0,
      vat: 0,
      total: 0,
      breakdown: []
    };

    // 1. Handling pojazdu (domestic vs cross-border)
    const isDomestic = (carLocation === buyerCountry);
    result.handling = isDomestic ? 
      countryFees.handling_domestic : 
      countryFees.handling_cross_border;
    
    result.breakdown.push({
      name: isDomestic ? 'Handling pojazdu (krajowy)' : 'Handling pojazdu (międzynarodowy)',
      amount: result.handling,
      currency: 'EUR'
    });

    // 2. Dokumenten-Handling
    result.documents = countryFees.documents;
    result.breakdown.push({
      name: 'Dokumenten-Handling',
      amount: result.documents,
      currency: 'EUR'
    });

    // 3. Transport (opcjonalny)
    if (options.includeTransport && countryFees.transport) {
      result.transport = countryFees.transport.logistics_partner || 0;
      result.breakdown.push({
        name: 'Transport (partner logistyczny)',
        amount: result.transport,
        currency: 'EUR'
      });
    }

    // 4. Drugi zestaw kół (opcjonalny)
    if (options.hasSecondWheelSet) {
      result.secondWheelSet = countryFees.second_wheel_set;
      result.breakdown.push({
        name: 'Handling 2. Radsatz',
        amount: result.secondWheelSet,
        currency: 'EUR'
      });
    }

    // 5. Auktionsgebühr (0-1950€)
    // UWAGA: Ta opłata jest zawarta w cenie/ofercie na Auto1
    // Tutaj ustawiamy na 0, bo nie znamy dokładnej wartości
    result.auctionFee = 0;
    result.breakdown.push({
      name: 'Auktionsgebühr (zawarta w cenie)',
      amount: result.auctionFee,
      currency: 'EUR',
      note: `Zakres: ${countryFees.auction_fee_range[0]}-${countryFees.auction_fee_range[1]} €`
    });

    // Podsumowanie
    result.subtotal = result.handling + result.documents + result.transport + 
                      result.secondWheelSet + result.auctionFee;

    // VAT (23% dla PL, różnie dla innych krajów)
    const vatRate = this.getVatRate(buyerCountry);
    result.vat = Math.round(result.subtotal * vatRate) / 100;
    result.total = result.subtotal + result.vat;

    return result;
  }

  getVatRate(country) {
    const vatRates = {
      'PL': 23,
      'DE': 19,
      'AT': 20,
      'BE': 21,
      'DK': 25,
      'ES': 21,
      'FI': 24,
      'FR': 20,
      'IT': 22,
      'NL': 21,
      'PT': 23,
      'SE': 25
    };

    return vatRates[country] || 20;
  }

  // Oblicz całkowitą cenę (cena auta + opłaty)
  calculateTotalPrice(carPriceEur, fees) {
    return {
      carPrice: carPriceEur,
      fees: fees.total,
      total: carPriceEur + fees.total,
      currency: 'EUR'
    };
  }

  // Konwersja EUR → PLN
  convertToPln(amountEur, eurRate) {
    return Math.round(amountEur * eurRate * 100) / 100;
  }
}

// Klasa jest dostępna globalnie w przeglądarce
