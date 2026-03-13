// Otomoto URL Builder - v3.0
// Buduje poprawne URL do Otomoto.pl

class OtomotoUrlBuilder {
  constructor() {
    this.baseUrl = 'https://www.otomoto.pl/osobowe';
  }

  build(make, matchResult, filters = {}) {
    if (!make || !matchResult || !matchResult.slug) {
      return null;
    }

    // Bazowy URL: /osobowe/{make}/{model-slug}
    let url = `${this.baseUrl}/${make}/${matchResult.slug}`;

    // Rok FROM dodajemy jako segment URL (np. /od-2016)
    if (filters.yearFrom) {
      url += `/od-${filters.yearFrom}`;
    }

    // Dodaj query params
    const params = this.buildQueryParams(filters);
    if (params) {
      url += `?${params}`;
    }

    return url;
  }

  buildQueryParams(filters) {
    const params = new URLSearchParams();

    // Rok - tylko TO (FROM jest w URL path jako /od-YYYY)
    if (filters.yearTo) {
      params.append('search[filter_float_year:to]', filters.yearTo);
    }

    // Paliwo
    if (filters.fuel) {
      const fuelMap = {
        'benzyna': 'petrol',
        'diesel': 'diesel',
        'hybryda': 'hybrid',
        'elektryczny': 'electric',
        'lpg': 'lpg',
        'etanol': 'ethanol'
      };
      const fuelType = fuelMap[filters.fuel.toLowerCase()] || 'petrol';
      params.append('search[filter_enum_fuel_type]', fuelType);
    }

    // Skrzynia biegów - 'automatic' lub 'manual' (bez -gear)
    if (filters.transmission) {
      const trans = filters.transmission === 'automatic' ? 'automatic' : 'manual';
      params.append('search[filter_enum_gearbox]', trans);
    }

    // Moc silnika (KM) - z tolerancją ±10 KM
    if (filters.power) {
      const powerFrom = Math.max(0, filters.power - 10);
      const powerTo = filters.power + 10;
      params.append('search[filter_float_engine_power:from]', powerFrom);
      params.append('search[filter_float_engine_power:to]', powerTo);
    }

    // Przebieg - tylko TO (nie FROM/TO)
    if (filters.mileageTo) {
      params.append('search[filter_float_mileage:to]', filters.mileageTo);
    }

    // Stan - tylko nieuszkodzone (0 = false)
    params.append('search[filter_enum_damaged]', '0');

    // Sortowanie - od najtańszych
    params.append('search[order]', 'filter_float_price:asc');

    const queryString = params.toString();
    return queryString || null;
  }

  // Budowanie URL z danymi auta
  buildWithRanges(make, matchResult, carData) {
    const filters = {
      yearFrom: carData.year ? parseInt(carData.year) - 1 : null,  // W URL jako /od-YYYY
      yearTo: carData.year ? parseInt(carData.year) + 1 : null,    // W query jako filter_float_year:to
      mileageTo: carData.mileage ? carData.mileage + 40000 : null, // Tylko TO, większa tolerancja
      fuel: carData.fuel,
      transmission: carData.transmission,
      power: carData.power  // Dodanie mocy silnika
    };

    return this.build(make, matchResult, filters);
  }
}

// Klasa jest dostępna globalnie w przeglądarce
