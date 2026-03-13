# 🚗 Otomoto Blicker

> **Professional Chrome extension for Polish car dealers bidding on Auto1.com** — instantly compare auction prices with the Polish market on Otomoto.pl.

<div align="center">
  <img src="./docs/otomoto_blicker_v3.png" alt="Otomoto Blicker v3.0 Panel" width="800" />
</div>

---

## ✨ What it does

When you open any car listing on Auto1.com, the extension injects a floating panel that:

| Feature | Description |
|---|---|
| 🎯 **Smart Matching** | Maps the Auto1 car to the correct Otomoto.pl model using a deep slug-mapping engine |
| 💰 **All-In Price** | Calculates the total cost including Auto1 fees (Handling + Documents + VAT) based on the 2026 official price list |
| 📊 **Market Stats** | Fetches live Min / Avg / Max prices from Otomoto.pl for the same model |
| 🧮 **Calculator** | Built-in expression evaluator — type `40000/4.2-3000`, get an instant result |
| 🌍 **12 Countries** | Handles Auto1 fees for DE, PL, AT, BE, DK, ES, FI, FR, IT, NL, PT, SE |
| 💱 **Live EUR/PLN** | Fetches the current exchange rate from the **NBP API** (cached 1h) |

---

## 🏗️ Architecture

```
Otomoto-Blicker/
├── manifest.json               # Manifest V3
├── otomoto_mapping.json        # Brand → model slug mapping (~700 models)
├── data/
│   └── auto1_fees_2026.json    # Official Auto1 2026 fee table
└── src/
    ├── content.js              # Entry point — orchestrates everything
    ├── background.js           # Service worker: EUR rate + Otomoto fetcher
    ├── core/
    │   ├── scraper.js          # Extracts car data from Auto1 DOM
    │   ├── matcher.js          # Matches to Otomoto slug (BMW, Mercedes, Audi, Volvo special rules)
    │   ├── url-builder.js      # Builds filtered Otomoto URLs
    │   └── fee-calculator.js   # Auto1 fee calculation + PLN conversion
    ├── utils/
    │   └── helpers.js          # Formatting, country normalization, DOM helpers
    └── ui/
        └── styles.css          # Premium dark UI (Inter font, card layout)
```

---

## 🚀 Installation

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** → select the project folder
5. Navigate to any car on [auto1.com/\*/merchant/car/\*](https://www.auto1.com)
6. The panel appears automatically in the top-right corner ✅

---

## 🔍 How matching works

The extension uses a **two-pass matching algorithm**:

1. **Variant pass** — checks for body type variants (Golf Variant → `golf-variant`, A4 Avant → `a4-avant`)
2. **Base model pass** — brand-specific scoring rules:
   - **BMW** — series number enforcement + GT/non-GT penalty
   - **Mercedes** — letter class priority (`C-Klasse` → `c-klasa`)
   - **Audi** — model code priority (`Q5`, `A6`)
   - **Volvo** — prefix code matching (`XC60`, `V90`)

---

## 💡 What's new in v3.0

- ⚡ **Modular architecture** — fully decoupled Scraper / Matcher / FeeCalc / UrlBuilder (Manifest V3)
- 🖥️ **Loading skeleton** — panel shows immediately; stats fill in async
- 🗺️ **All 12 countries** — complete country normalization (DE/PL/FR/IT/NL/ES/PT/SE/FI/DK/AT/BE)
- 🧮 **Clean calculator** — shows plain numeric result, no cluttered labels
- 🐛 **Better price validation** — Otomoto price parser requires 5 000–5 000 000 PLN range
- 🔗 **Precise Otomoto URLs** — year ±1, mileage +40k, power ±10 KM filters baked in

---

## 🛡️ Privacy

- Runs **100% locally** in your browser
- Fetches data only from: `otomoto.pl`, `auto1.com`, `api.nbp.pl`
- Zero external telemetry — no data is sent anywhere

---

## ⚖️ License

MIT © 2026 **Otomoto Blicker**
