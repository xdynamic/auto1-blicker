# 🚗 Otomoto Blicker (v2.8.5)

> **Otomoto Blicker** to profesjonalne rozszerzenie Chrome stworzone z myślą o polskich dealerach samochodowych licytujących na platformie **Auto1.com**. 

### 💡 Po co to zrobiliśmy?
Import aut z zagranicy wymaga szybkiej decyzji i precyzyjnych obliczeń. Nasze narzędzie eliminuje potrzebę ręcznego sprawdzania cen na Otomoto oraz wertowania tabel opłat. Wszystko, czego potrzebujesz do trafnej licytacji, widzisz bezpośrednio na stronie pojazdu.

---

## 📸 Podgląd

![Otomoto Blicker Premium UI](./docs/screenshot_v285_premium.png)
*Panel automatycznie wstrzyknięty na stronę Auto1 (Lokalizacja DE, Mercedes GLA).*

---

## ✨ Co robi to rozszerzenie?

1.  **Cena "All-Inclusive" (EUR & PLN)**:
    - Automatycznie sumuje cenę licytacji oraz wszystkie koszty dodatkowe (Handling + Dokumenty).
    - **Ważne**: Rozszerzenie wie, że *Auktionsgebühr* (opłata aukcyjna) jest już zawarta w Twoim zakładanym budżecie/ofercie na stronie, więc dolicza jedynie brakujące koszty stałe.
2.  **Inteligentny Cennik 2026**:
    - Rozpoznaje kraj pochodzenia auta (np. Niemcy, Holandia, Hiszpania).
    - Stosuje stawki z oficjalnego cennika **Auto1 2026** dla 12 krajów Europy.
3.  **Błyskawiczny Research Rynkowy**:
    - Pobiera statystyki z **Otomoto.pl** dla identycznego modelu i rocznika.
    - Pokazuje Min/Max cenę rynkową w PLN, co pozwala natychmiast ocenić potencjalny zysk.
4.  **Profesjonalne Linki**:
    - Generuje precyzyjne ścieżki (np. `/seg-combi/`), które prowadzą prosto do filtrowanych wyników na Otomoto bez gubienia parametrów.

---

## 🛠️ Jak to działa?

- **Instalacja**: Załaduj folder jako "rozpakowane rozszerzenie" w Chrome.
- **Działanie**: Gdy otworzysz stronę dowolnego auta na Auto1, w prawym górnym rogu pojawi się dyskretny panel. 
- **Waluty**: Rozszerzenie pobiera aktualne kursy, aby przeliczenia na PLN były zawsze bliskie rzeczywistości.

---

## ⚖️ Licencja & Bezpieczeństwo

Rozszerzenie działa lokalnie w Twojej przeglądarce. Nie przesyła danych o Twoich licytacjach na zewnętrzne serwery. 

MIT © 2026 **Otomoto Blicker Team**
