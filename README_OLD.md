
# 🚗 Otomoto Blicker / Auto1-Blicker

<div align="center">
	<img src="docs/otomoto_blicker_v3.png" alt="Otomoto Blicker Panel" width="600" />
</div>

---

## 🇵🇱 Polski — Instrukcja

### Co to jest?
🔎 **Otomoto Blicker** to rozszerzenie Chrome, które automatycznie porównuje ceny aut z Auto1.com z polskim rynkiem Otomoto.pl. Powstało, bo ręczne porównywanie i liczenie marży zajmowało mnóstwo czasu.

### Funkcje
| ✨ Funkcja | Opis |
|---|---|
| 🎯 Inteligentne dopasowanie | Automatyczne mapowanie modelu z Auto1 na Otomoto (slug-mapping) |
| 💰 Cena „na gotowo” | Oblicza całkowity koszt (Auto1 + opłaty + VAT) wg oficjalnego cennika |
| 📊 Statystyki rynku | Pobiera na żywo ceny min/śred/max z Otomoto dla danego modelu |
| 🧮 Kalkulator | Wbudowany kalkulator wyrażeń (np. `40000/4.2-3000`) |
| 🌍 12 krajów | Obsługuje opłaty Auto1 dla: DE, PL, AT, BE, DK, ES, FI, FR, IT, NL, PT, SE |
| 💱 Kurs EUR | Pobiera kursy walut z API NBP (odświeżane co godzinę) |

### Instalacja
1. Sklonuj repo: `git clone git@github.com:xdynamic/auto1-blicker.git`
2. Otwórz Chrome → `chrome://extensions/`
3. Włącz **Tryb dewelopera** (prawy górny róg)
4. Kliknij **Załaduj rozpakowane** → wskaż folder projektu
5. Otwórz ofertę na [auto1.com/*/merchant/car/*](https://www.auto1.com) — panel pojawi się automatycznie

### Ostrzeżenia / Uwaga
- W trybie niemieckim (DE) na mobile.de trzeba ręcznie wybrać markę/model — reszta działa automatycznie
- Zawsze sprawdź, czy filtry i dopasowanie są poprawne (algorytm jest heurystyczny)
- Opłaty Auto1 mogą się zmieniać — link do aktualnych opłat: [Cennik Auto1 PDF](https://content.auto1.com/static/car_images/price_list_de_2026-01-01.pdf)
- Rozszerzenie jest w trakcie rozwoju — nie ufaj 100% automatyce!

---

## 🇩🇪 Deutsch — Anleitung

### Was ist das?
🔎 **Auto1-Blicker** ist eine Chrome-Erweiterung, die automatisch Preise von Auto1.com mit dem polnischen Markt (Otomoto.pl) vergleicht. Entstanden, weil manuelles Vergleichen und Kalkulieren viel Zeit gekostet hat.

### Funktionen
| ✨ Funktion | Beschreibung |
|---|---|
| 🎯 Intelligente Zuordnung | Automatische Zuordnung des Modells von Auto1 zu Otomoto (Slug-Mapping) |
| 💰 „All-In“-Preis | Berechnet Gesamtkosten (Auto1 + Gebühren + MwSt) laut offiziellem Tarif |
| 📊 Marktstatistik | Holt live Min/Ø/Max-Preise von Otomoto für das Modell |
| 🧮 Rechner | Eingebauter Ausdruck-Rechner (z.B. `40000/4.2-3000`) |
| 🌍 12 Länder | Gebühren für DE, PL, AT, BE, DK, ES, FI, FR, IT, NL, PT, SE |
| 💱 EUR-Kurs | Holt Wechselkurs von NBP API (stündlich aktualisiert) |

### Installation
1. Klone das Repo: `git clone git@github.com:xdynamic/auto1-blicker.git`
2. Öffne Chrome → `chrome://extensions/`
3. Aktiviere **Entwicklermodus** (oben rechts)
4. Klicke **Entpackt laden** → wähle den Projektordner
5. Öffne ein Angebot auf [auto1.com/*/merchant/car/*](https://www.auto1.com) — das Panel erscheint automatisch

### Warnungen / Hinweise
- Im deutschen Modus (DE) auf mobile.de muss Marke/Modell manuell gewählt werden — Rest funktioniert automatisch
- Prüfe immer Filter und Zuordnung (Algorithmus ist heuristisch)
- Auto1-Gebühren können sich ändern — aktueller Tarif: [Auto1 Gebühren PDF](https://content.auto1.com/static/car_images/price_list_de_2026-01-01.pdf)
- Die Erweiterung ist in Entwicklung — vertraue nicht 100% der Automatik!

---

## 🛡️ Privacy / Sicherheit
- Erweiterung läuft **100% lokal** im Browser
- Daten werden nur von: `otomoto.pl`, `auto1.com`, `api.nbp.pl` geladen
- Keine externe Telemetrie — deine Daten bleiben privat

---

## 📝 Status & Lizenz
- Projekt in Entwicklung — feedback & PRs willkommen!
- MIT License © 2026

---

<div align="center">
	<img src="docs/otomoto_blicker_v3.png" alt="Otomoto Blicker Panel" width="600" />
</div>

