# 🚗 Otomoto Blicker

> Profesjonalne rozszerzenie Chrome dla dealerów samochodowych, optymalizujące import pojazdów z **[Auto1.com](https://www.auto1.com)** do Polski.

Automatycznie wstrzykuje premium panel (Glassmorphism UI), który porównuje ceny na **Otomoto.pl**, kalkuluje pełne koszty Auto1 (All-Inclusive) w EUR i PLN oraz precyzyjnie generuje profesjonalne ścieżki filtrów.

---

## 📸 Podgląd (v2.8+)

![Otomoto Blicker UI](./docs/screenshot.png)
*Nowoczesny panel z dynamicznym przeliczaniem walut i kosztów całkowitych.*

---

## ✨ Kluczowe Funkcje

| Funkcja | Opis |
|---|---|
| 💎 **UI All-Inclusive** | Wyświetla cenę zakupu + wszystkie opłaty Auto1 w EUR oraz przeliczenie na PLN (live kurs). |
| 💶 **Opłaty Auto1 (2026)** | Automatyczna kalkulacja: Handling (289€) + Docs (159€) + Aukcyjna (progresywna). |
| 🎯 **Precision Mapping** | 100% dokładności dla BMW (GT/Series) i Mercedes-Benz (klasy SUV) dzięki zaawansowanym algorytmom scoringowym. |
| 🔗 **Professional URLs** | Generuje ścieżki zgodne ze standardem Otomoto (np. `/seg-combi/`), co zapobiega gubieniu filtrów. |
| 📈 **Market Insights** | Agreguje min/max ceny z Otomoto na podstawie unikalnych ogłoszeń dla konkretnego modelu i specyfikacji. |
| 🪄 **Minimizacja** | Inteligentne zwijanie panelu do ikonki "OB" — stan zapamiętywany między sesjami. |

---

## 💶 Tabela opłat Auto1 (2026)

Rozszerzenie automatycznie stosuje poniższą taryfę:

| Cena auta | Opłata aukcyjna | Handling | Docs | **SUMA OPŁAT** |
|---|---|---|---|---|
| ≤ 500 € | 99 € | 289 € | 159 € | **547 €** |
| 501–1 000 € | 149 € | 289 € | 159 € | **597 €** |
| 1 001–2 500 € | 249 € | 289 € | 159 € | **697 €** |
| 2 501–5 000 € | 349 € | 289 € | 159 € | **797 €** |
| 5 001–10 000 € | 449 € | 289 € | 159 € | **897 €** |
| 10 001–15 000 € | 549 € | 289 € | 159 € | **997 €** |
| 15 001–20 000 € | 649 € | 289 € | 159 € | **1 097 €** |
| 20 001–30 000 € | 749 € | 289 € | 159 € | **1 197 €** |
| > 30 000 € | 849 € | 289 € | 159 € | **1 297 €** |

---

## 🛠️ Instalacja

1. Pobierz lub sklonuj repozytorium:
   ```bash
   git clone https://github.com/twoj-nick/otomoto-blicker.git
   ```
2. Otwórz Chrome i wejdź na `chrome://extensions`
3. Włącz **Tryb deweloperski** (górny prawy róg)
4. Kliknij **Załaduj rozpakowane** → wybierz folder `otomoto-blicker`
5. Wejdź na dowolną ofertę na `auto1.com` — panel pojawi się automatycznie.

---

## 📝 Changelog

### v2.8.4
- **Numerical Precision**: BMW 5 GT nie jest już mylone z 3 GT (ścisłe dopasowanie numeru serii).
- **Mercedes GLX Slugs**: Poprawione filtrowanie dla GLA, GLB, GLC, GLE, GLS (użycie profesjonalnego suffixu `-klasa`).
- **Standardyzacja**: Uaktualnienie `otomoto_mapping.json` dla SUV-ów Mercedes-Benz.

### v2.8.3
- **Shooting Brake**: Nowa logika wykrywania nadwozia kombi dla modeli Mercedes-Benz.
- **URL Pathing**: Wprowadzenie `/seg-combi/` bezpośrednio w ścieżce URL dla BMW/Mercedes (zgodnie z SEO Otomoto).

### v2.8.0
- **All-Incl UI**: Pierwsza wersja z pełnym wyliczeniem ceny końcowej w EUR i PLN.
- **Glassmorphism**: Nowy, przezroczysty design panelu z efektami backdrop-blur.

### v2.7.x
- Naprawa filtrów paliwa (Diesel/Benzyna).
- Nowy system scoringu dla modeli Audi (Allroad) i Volvo (XC series).

---

## 📄 Licencja

MIT © 2026
