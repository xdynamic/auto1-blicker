# 🚗 Otomoto Blicker

> Rozszerzenie Chrome dla dealerów aut importujących pojazdy z **[Auto1.com](https://www.auto1.com)** do Polski.

Automatycznie wyświetla panel porównania cen z **Otomoto.pl** oraz kalkuluje opłaty Auto1 (2026) na każdej stronie pojazdu.

---

## 📸 Podgląd

![Otomoto Blicker UI](./docs/screenshot.png)

---

## ✨ Funkcje

| Funkcja | Opis |
|---|---|
| 💶 **Opłaty Auto1 (2026)** | Automatyczna kalkulacja: Handling (289€) + Docs (159€) + Aukcja (progresywna wg ceny) |
| 🔍 **Porównanie Otomoto.pl** | Pobiera min/max ceny z Otomoto dla tego samego modelu i rocznika |
| 🔗 **Szybkie linki** | Jeden klik → Otomoto (sortowanie od najtańszej) lub Mobile.de |
| 📍 **Dane akcyzy** | Wyświetla stawkę Akcyzy (3.1% / 18.6% / hybryda / elektryk) |
| 🪄 **Minimizacja** | Panel zwijany do ikonki "OB" — stan zapamiętywany między stronami |
| ⚡ **SPA-safe** | Działa bez odświeżania strony przy nawigacji po Auto1 |

---

## 💶 Tabela opłat Auto1 (2026)

| Cena auta | Opłata aukcyjna | Handling | Docs | **SUMA** |
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

> ℹ️ Tabela opłat nie zawiera transportu, rejestracji ani akcyzy.

---

## 📦 Instalacja

1. Pobierz lub sklonuj repozytorium:
   ```bash
   git clone https://github.com/twoj-nick/otomoto-blicker.git
   ```

2. Otwórz Chrome i wejdź na `chrome://extensions`

3. Włącz **Tryb deweloperski** (górny prawy róg)

4. Kliknij **Załaduj rozpakowane** → wybierz folder `otomoto-blicker`

5. Gotowe! Wejdź na dowolną stronę auta na `auto1.com`

---

## 🗂️ Struktura projektu

```
otomoto-blicker/
├── manifest.json          # Konfiguracja rozszerzenia (MV3)
├── otomoto-content.js     # Główny skrypt wstrzykiwany na auto1.com
├── background.js          # Service worker: pobiera dane z Otomoto (CORS bypass)
├── content.css            # Style panelu (izolacja od strony hosta)
└── popup.html             # Popup przy kliknięciu ikony rozszerzenia
```

### Jak to działa?

```
auto1.com (strona auta)
       │
       ▼
otomoto-content.js          ← wstrzykiwany przez Chrome
   │  scrapeAuto1()          → parsuje tytuł, tabelę spec, cenę
   │  getAuto1Fees()         → kalkuluje opłaty wg tabeli 2026
   │  getSearchUrls()        → buduje URL Otomoto + Mobile.de
   │  injectUI()             → tworzy panel i dołącza do <body>
   │
   └─→ sendMessage(GET_OTOMOTO_STATS)
             │
             ▼
       background.js         ← service worker (dostęp do sieci)
          fetchOtomotoStats() → fetchuje HTML Otomoto, wyciąga ceny
             │
             └─→ { min, max, avg, count } → content script aktualizuje panel
```

---

## 🔒 Uprawnienia

| Uprawnienie | Cel |
|---|---|
| `host: auto1.com` | Wstrzykiwanie skryptu na stronach aut |
| `host: otomoto.pl` | Pobieranie cen przez service worker |

> Rozszerzenie **nie zbiera żadnych danych** i nie komunikuje się z żadnymi serwerami poza auto1.com i otomoto.pl.

---

## 🛠️ Technologie

- **Manifest V3** (Chrome Extensions API)
- Vanilla JS (zero dependencies)
- Glassmorphism UI (inline styles, izolowane od hosta)
- Background Service Worker z regex scraperem HTML

---

## 📝 Changelog

### v2.0.1
- Naprawiono generowanie URL Otomoto (tylko pierwsza część modelu, np. `v60`, nie pełny tytuł)
- Dodano obsługę hybryd i elektryków w filtrach Otomoto
- Naprawiono wstrzykiwanie przy nawigacji SPA
- Usunięto nieużywane uprawnienia (`storage`, `cookies`)
- Nowy CSS dopasowany do aktualnego UI

### v2.0.0
- Całkowity przepis scraperów: 5 strategii dla ceny (DOM → JSON → text scan)
- UI pojawia się nawet bez ceny (pokazuje "— EUR")
- Przemianowano plik na `otomoto-content.js` (fix cache)

### v1.x
- Pierwsza iteracja: minimizable UI, opłaty 2026, Otomoto stats

---

## 📄 Licencja

MIT © 2026
