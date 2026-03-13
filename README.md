# 🚗 Otomoto Blicker

> **Profesjonalne rozszerzenie Chrome dla polskich dealerów licytujących na Auto1.com** — błyskawiczne porównanie cen aukcyjnych z polskim rynkiem na Otomoto.pl.

<div align="center">
  <img src="./docs/otomoto_blicker_v3.png" alt="Otomoto Blicker v3.0 Panel" width="800" />
</div>

---

## ✨ Co robi to rozszerzenie?

Gdy otworzysz dowolną ofertę samochodu na Auto1.com, rozszerzenie automatycznie wstrzykuje panel, który:

| Funkcja | Opis |
|---|---|
| 🎯 **Inteligentne Dopasowanie** | Mapuje auto z Auto1 na odpowiedni model na Otomoto.pl za pomocą silnika slug-mappingu |
| 💰 **Cena "na gotowo"** | Oblicza całkowity koszt (Cena + Opłaty Auto1 + VAT) w oparciu o oficjalny cennik 2026 |
| 📊 **Statystyki Rynku** | Pobiera na żywo ceny Min / Śred / Max z Otomoto.pl dla tego samego modelu |
| 🧮 **Kalkulator** | Wbudowany kalkulator wyrażeń — wpisujesz `40000/4.2-3000`, dostajesz natychmiastowy wynik |
| 🌍 **12 Krajów** | Obsługuje opłaty Auto1 dla: DE, PL, AT, BE, DK, ES, FI, FR, IT, NL, PT, SE |
| 💱 **Aktualny Kurs EUR** | Pobiera kursy walut z **API NBP** (odświeżane co godzinę) |

---

## 🏗️ Architektura Projektu

```
Otomoto-Blicker/
├── manifest.json               # Konfiguracja rozszerzenia (Manifest V3)
├── otomoto_mapping.json        # Mapowanie marek na slugi Otomoto (~700 modeli)
├── data/
│   └── auto1_fees_2026.json    # Oficjalne stawki opłat Auto1 2026
└── src/
    ├── content.js              # Główny skrypt — zarządza całym panelem
    ├── background.js           # Service worker: kursy walut + pobieranie cen z Otomoto
    ├── core/
    │   ├── scraper.js          # Wyciąga dane auta z DOM Auto1
    │   ├── matcher.js          # Dopasowuje model do slugów Otomoto (specjalne reguły dla BMW, MB, Audi, Volvo)
    │   ├── url-builder.js      # Buduje precyzyjne linki filtrowane na Otomoto
    │   └── fee-calculator.js   # Oblicza opłaty Auto1 i przelicza na PLN
    ├── utils/
    │   └── helpers.js          # Formatowanie, normalizacja krajów, helpery DOM
    └── ui/
        └── styles.css          # Premium Dark UI (font Inter, nowoczesny layout)
```

---

## 🚀 Instalacja

1. Pobierz lub sklonuj to repozytorium
2. Otwórz Chrome i wejdź na `chrome://extensions/`
3. Włącz **Tryb dewelopera** (prawy górny róg)
4. Kliknij **Załaduj rozpakowane** → wybierz folder projektu
5. Wejdź na dowolne auto na [auto1.com/\*/merchant/car/\*](https://www.auto1.com)
6. Panel pojawi się automatycznie w prawym górnym rogu ✅

---

## 🔍 Jak działa dopasowanie modeli?

Rozszerzenie używa dwufazowego algorytmu:

1. **Faza wariantów** — sprawdza typ nadwozia (np. Golf Variant → `golf-variant`, A4 Avant → `a4-avant`)
2. **Faza bazy** — punktacja specyficzna dla marek:
   - **BMW** — weryfikacja serii + obsługa modeli GT
   - **Mercedes** — priorytet dla klas literowych (`C-Klasse` → `c-klasa`)
   - **Audi** — priorytet dla kodów modeli (`Q5`, `A6`)
   - **Volvo** — dopasowanie przedrostków serii (`XC60`, `V90`)

---

## 💡 Co nowego w v3.0?

- ⚡ **Modułowa architektura** — całkowicie oddzielone moduły Scraper / Matcher / Calc / URL
- 🖥️ **Loading skeleton** — panel pojawia się natychmiast; statystyki doładowują się w tle
- 🗺️ **Obsługa 12 krajów** — pełna normalizacja (DE/PL/FR/IT/NL/ES/PT/SE/FI/DK/AT/BE)
- 🧮 **Czysty kalkulator** — pokazuje tylko sam wynik, bez zbędnych etykiet
- 🐛 **Lepsza walidacja** — parser cen Otomoto odfiltrowuje szumy (akceptuje zakres 5 000–5 000 000 PLN)
- 🔗 **Precyzyjne linki** — filtry rocznik ±1, przebieg +40k, moc ±10 KM dodawane automatycznie

---

## 🛡️ Prywatność

- Rozszerzenie działa **w 100% lokalnie** w Twojej przeglądarce
- Dane pobierane są tylko z: `otomoto.pl`, `auto1.com`, `api.nbp.pl`
- Brak zewnętrznej telemetrii — Twoje dane o licytacjach nie są nigdzie wysyłane

---

## ⚖️ Licencja

MIT © 2026 **Otomoto Blicker**

---

<details>
<summary>English Version (click to expand)</summary>

# 🚗 Otomoto Blicker

Professional Chrome extension for car dealers on Auto1.com — instant price comparison with Otomoto.pl.

- **Smart Matching**: Maps Auto1 models to Otomoto slugs.
- **All-In Price**: Calculates total cost including 2026 fees and VAT.
- **Market Stats**: Live Min/Avg/Max prices from Otomoto.
- **Calculator**: Built-in math expression evaluator.
- **12 Countries**: Full support for DE, PL, AT, BE, DK, ES, FI, FR, IT, NL, PT, SE.
- **NBP API**: Real-time EUR/PLN exchange rates.

Refer to the Polish section above for detailed architecture and features.
</details>
