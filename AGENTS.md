# AGENTS.md — Capacity AVM Akıllı Navigasyon & Kiosk Sistemi Teknik Protokolü 📜

Bu belge, **İstanbul Bakırköy Capacity AVM Akıllı İç Mekân Navigasyon & Kiosk Sistemi** projesinde çalışacak tüm yapay zekâ ajanları (AI Agents) ve geliştiriciler için bağlayıcı teknik anayasadır. Projede yapılacak her türlü kodlama, tasarım uyarlaması, algoritma revizyonu ve test süreci bu belgedeki kurallara harfiyen uymak zorundadır.

---

## 1. Proje Kimliği ve Vizyonu

* **Referans Tasarım & İlham:** [Cevahir AVM Akıllı Rehber](https://cevahir-rehber.web.app/)
* **Hedef Lokasyon:** Bakırköy Capacity AVM (Fişekhane Caddesi, Bakırköy / İstanbul)
* **Kullanıcı Deneyimi:** Gözü yormayan aydınlık mimari (Daylight Aesthetic), mobil ve kiosk dokunmatik ekranlara tam uyumlu responsive arayüz, sıfır etiket çakışması (zero text-collision), milisaniyeler içinde Dijkstra çok-katlı rota hesaplama ve 60 FPS canlı sepet simülasyonu.

---

## 2. Mimari & Koordinat Sistemi

### 2.1. Standart SVG ViewBox & Mimari Koordinat Düzlemi
* Tüm kat SVG planları (`public/svg/1.svg` - `6.svg`) ve rota katmanları (`#route-svg`) **kesinlikle `1400 × 850`** Chapman Taylor & Muammer Bakır mimari koordinat düzleminde çalışır:
  ```html
  <svg viewBox="0 0 1400 850" width="1400" height="850">
  ```
* Temel Mimari Referans Koordinatları:
  * Merkez Atrium & Müzikli Havuz: `CX: 700, CY: 440` (`RX: 60, RY: 40`)
  * **Fişekhane Caddesi Ana Giriş (Cadde):** `X: 1245, Y: 410` (Zemin Kat)
  * **Carousel Geçiş Kapısı (Kuzey Portali):** `X: 680, Y: 50` (Zemin Kat)
  * **Zemin Kat Danışma (Info Desk):** `X: 1085, Y: 425` (Zemin Kat)
  * Panoramik Cam Asansörler: `X: 565, Y: 420`
  * Batı Yürüyen Merdivenler: `X: 265, Y: 420`
  * Doğu Yürüyen Merdivenler: `X: 1010, Y: 420`
  * Cookshop Kuzey Terası: `X: 1090, Y: 140, W: 160, H: 170`
  * Midpoint Güney Terası: `X: 1090, Y: 560, W: 160, H: 170`
  * VAKKO Amiral Mağaza: `X: 100, Y: 140, W: 140, H: 160`

### 2.2. Kat Yapısı (6 Kat Mimarisi - 173 Gerçek Mağaza)
| Kat No | Kod / Label | Kat Adı & Teması | Mağaza Sayısı | Önemli Noktalar |
| :---: | :---: | :--- | :---: | :--- |
| **6** | `2` | 2. Kat: Food Court & Sinema | 24 | Paribu Cineverse (9 Salon), Playland, D&R, Starbucks, Burger King, HD İskender |
| **5** | `1` | 1. Kat: Küresel Moda & Kozmetik | 45 | Zara, Bershka, Pull&Bear, Stradivarius, Oysho, Sephora, Mango, Mavi |
| **4** | `Z` | **Zemin Kat (Ana Giriş & Lüks Moda)** | **44** | **Müzikli Gösteri Havuzu**, Vakko, Beymen Club, Cookshop, Midpoint, Fişekhane & Carousel |
| **3** | `B1` | 1. Bodrum Kat: Spor & Hipermarket | 51 | Migros MMM, Decathlon, LC Waikiki, Adidas, Nike, Puma, Under Armour |
| **2** | `B2` | 2. Bodrum Kat: Market & Vale | 1 | Hibatech Oto Yıkama & Detailing, Kapalı Otopark & Vale Girişi |
| **1** | `B3` | 3. Bodrum Kat: Hizmet & Lostra | 8 | Dry Clean Express, Altın İğne Terzi, Başak Lostra, Nail Up, Otopark |

### 2.3. Rota Katmanı ve Görünürlük Kuralı
* Rota SVG katmanı (`#route-svg`) mağaza poligonlarının ve marka rozetlerinin **kesinlikle en üstünde (`z-index: 50`)** yer alır.
* Navigasyon çizgisi parlak mavi (`#2563eb`), 4px kalınlığında, animasyonlu kesikli çizgi (`stroke-dasharray: 8 6`, `animation: routeDashFlow 1s linear infinite`) olarak render edilir. Altında 7px saf beyaz kontrast kenar bulunur.
* Alışveriş sepeti maskotu (`#avatar-layer`, `z-index: 60`) bu çizgi üzerinde 60 FPS akışla hareket eder.

### 2.4. Mobil Katman Mimarisi & Bottom Sheet Standardı (@media <= 768px)
* **Tam Ekran Arka Plan Haritası:** Harita alanı (`#main-map-area`) mobilde sabit tam ekran (`width: 100vw; height: 100vh; position: fixed; top: 0; left: 0; z-index: 10`) çalışır.
* **Alt Çekmece (Bottom Sheet):** Sol panel (`#sidebar-panel`), mobilde alttan açılan bir alt çekmeceye dönüştürülür:
  * **Peek Modu (Varsayılan):** Görünür yükseklik ~130px'dir (`transform: translateY(calc(75vh - 130px))`). Yalnızca tutamaç, arama çubuğu ve 3 hızlı giriş kapısı (Fişekhane, Carousel, Danışma) görünür; harita arka planda tam aktiftir.
  * **Genişletilmiş Mod (Expanded):** Ekranın en fazla %75'ini kaplar (`max-height: 75vh; transform: translateY(0)`). Haritayı tamamen örtmez.
  * **Tutamaç (Drag Handle Pill):** Yukarı ve aşağı çekme jestlerini (swipe up/down) ve tıklamayla tek tıkla açılıp kapanmayı destekler.
* **Yüzen Eylem Butonu (Floating View Toggle):** Sağ altta `#floating-view-toggle` butonu yer alır. Çekmece kapalıyken `📋 Liste`, açıkken `🗺️ Harita` göstererek tek dokunuşla görünüm geçişi sağlar.
* **Otomatik Küçülme:** Rota hesaplandığında çekmece otomatik olarak peek moduna iner ve rota kartı (`#route-panel`) çekmecenin üzerinde belirerek rotayı net odaklar.
* **Dokunmatik Etkileşim:** Harita üzerinde iki parmakla dokunulan merkez noktasına odaklı akıcı yakınlaşma (pinch-to-zoom) ve tek parmakla serbest kaydırma (touch pan) `touch-action: none` ile işletim sistemi jestleriyle çakışmadan çalışır.

---

## 3. Tasarım Sistemi (Daylight Aesthetic)

### 3.1. Renk Paleti
* **Canvas / Tuval Arka Planı:** `#eef2f6` (Göz yormayan ferah açık gri-mavi tonu)
* **Kat Gövdesi (Floor Slab):** `#ffffff` (Saf beyaz, `stroke: #cbd5e1`, kalınlık `1.5px`)
* **Yürüme Yolları (Corridors):** `#f8fafc`
* **Orta Havuz / Su Efekti:** Dış çember `#0284c7`, su alanı `#e0f2fe`, fıskiye noktaları `#0369a1`
* **Vurgu & Aksiyon Rengi:** Capacity Kırmızı (`#dc2626` / `#b91c1c`) ve Turkuaz (`#06b6d4`)

### 3.2. Kategori Pastel Tonları
Mağaza poligonları gözü yormayan soft pastel dolgular ve kontrastlı ince konturlarla renklendirilir:
* **Moda & Tekstil:** Dolgu `#ffe4e6`, Kontur `#fda4af`
* **Kafe & Restoran:** Dolgu `#ffedd5`, Kontur `#fdba74`
* **Kuyum & Saat:** Dolgu `#fef3c7`, Kontur `#fcd34d`
* **Kozmetik & Bakım:** Dolgu `#fce7f3`, Kontur `#f9a8d4`
* **Ayakkabı & Çanta:** Dolgu `#fae8ff`, Kontur `#f0abfc`
* **Spor & Outdoor:** Dolgu `#dcfce7`, Kontur `#86efac`
* **Teknoloji:** Dolgu `#e0f2fe`, Kontur `#7dd3fc`
* **Ev & Yaşam:** Dolgu `#f3e8ff`, Kontur `#d8b4fe`
* **Süpermarket:** Dolgu `#ecfdf5`, Kontur `#6ee7b7`
* **Eğlence & Çocuk:** Dolgu `#fef9c3`, Kontur `#fde047`
* **Hizmet & ATM:** Dolgu `#ccfbf1`, Kontur `#5eead4`

### 3.3. Sıfır Etiket Çakışması (Zero Text-Collision) Kuralı
* Harita üzerine rastgele ham `<text>` etiketleri saçılması **kesinlikle yasaktır**.
* Mağazalar haritada 30–36px yuvarlatılmış kare marka logoları (`.logo-tile`) ile temsil edilir.
* Mağaza isimleri sadece fare ile üzerine gelindiğinde (tooltip) ya da mağaza tıklandığında/hedef seçildiğinde görünür.
* Servisler (WC, Asansör, Yürüyen Merdiven, Danışma, Çıkış) 28px dairesel `.amenity-icon-circle` rozetleriyle gösterilir.

---

## 4. Kod Standartları & API Sözleşmeleri

### 4.1. Nesne Arayüzü Doğrulama Kuralı (Defensive Inter-Module Contracts)
Farklı modüller (örneğin `CartSimulator`, `MallMap`, `NavigationEngine`, `app.js`) birbirlerinin metodlarını çağırırken mutlaka varlık kontrolü yapmalıdır:
```javascript
// Kural Örneği:
if (this.map && typeof this.map.smoothPanTo === 'function') {
  this.map.smoothPanTo(curX, curY);
} else if (this.map && typeof this.map.panTo === 'function') {
  this.map.panTo(curX, curY);
}
```

### 4.2. MallMap Metod Standartları
* `smoothPanTo(x, y, lerp = true)`: Animasyon karelerinde (60 FPS) harita merkezini verilen X, Y koordinatına yumuşak yaklaşımla (linear interpolation) kaydırır.
* `panTo(x, y)`: Verilen koordinatı anında merkeze alır.
* `flyTo(x, y, targetScale, duration)`: Kademeli kamera geçişi (ease-in-out).
* `loadFloor(floorNum)`: Asenkron kat yükleme ve rozetleri temizleyip yeniden konumlandırma.
* `renderRoute(routeData)`: 4 katmanlı neon polyline rota çizimi.
* `clearRoute()`: Haritadaki rotayı ve sepet ikonunu temizleme.

### 4.3. NavigationEngine Standartları
* `findRoute(startNodeId, targetNodeId, mode)` çıktısı şu sözleşmeye tam uymalıdır:
  ```typescript
  interface RouteResult {
    totalDistance: number;       // Metre cinsinden
    totalUnits: number;          // SVG birimi
    estimatedMinutes: number;    // Dakika
    pathNodes: Array<Node>;      // Düğümler dizisi
    path?: Array<Node>;          // Geriye dönük uyumluluk için pathNodes referansı
    segmentsByFloor: Record<number, Array<Node>>;
    instructions: Array<TurnInstruction>;
    mode: 'escalator' | 'elevator' | 'both';
  }
  ```

---

## 5. Test, Doğrulama & Self-Healing Protokolü

Her ajan, kod ürettikten veya bir hata düzelttikten sonra aşağıdaki test zincirini tamamlamadan görevi bitmiş sayamaz:

1. **Headless Tarayıcı ile Konsol Taraması:**
   * Playwright / Puppeteer kullanılarak `http://localhost:3000` (veya test ortamı) açılmalı.
   * `page.on('pageerror')` ve `page.on('console', msg => msg.type() === 'error')` dinleyicileriyle F12 konsolunda 0 hata olduğu teyit edilmeli.
2. **Kritik Fonksiyon Testleri:**
   * Mağaza kartı tıklama -> Detay paneli açılışı.
   * "Yol Tarifi Al" butonu -> Dijkstra rotası çizimi.
   * "Sepeti Başlat" butonu -> `CartSimulator` hareketi, `smoothPanTo` kamera takibi ve ilerleme çubuğu akışı.
3. **Ekran Görüntüsü ile Görsel İnceleme:**
   * Sayfanın tam ekran görüntüsü alınıp temanın daylight modunda olduğu ve etiket çakışması bulunmadığı görsel olarak denetlenmelidir.

---

## 6. Git & Dağıtım Protokolü

* Yapılan tüm düzeltmeler anlamlı commit mesajları (`fix:`, `feat:`, `refactor:`, `docs:`) ile commit edilmelidir.
* `main` dalı daima canlıya (`GitHub Pages`) dağıtılabilir kararlılıkta tutulmalıdır.
* Her push sonrası uzaktaki repoya (`origin main`) kodun eksiksiz aktarıldığı doğrulanmalıdır.
