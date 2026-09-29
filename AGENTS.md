# AGENTS.md — Capacity AVM Akıllı Navigasyon & Kiosk Sistemi Teknik Protokolü 📜

Bu belge, **İstanbul Bakırköy Capacity AVM Akıllı İç Mekân Navigasyon & Kiosk Sistemi** projesinde çalışacak tüm yapay zekâ ajanları (AI Agents) ve geliştiriciler için bağlayıcı teknik anayasadır. Projede yapılacak her türlü kodlama, tasarım uyarlaması, algoritma revizyonu ve test süreci bu belgedeki kurallara harfiyen uymak zorundadır.

---

## 1. Proje Kimliği ve Vizyonu

* **Referans Tasarım & İlham:** [Cevahir AVM Akıllı Rehber](https://cevahir-rehber.web.app/)
* **Hedef Lokasyon:** Bakırköy Capacity AVM (Fişekhane Caddesi, Bakırköy / İstanbul)
* **Kullanıcı Deneyimi:** Gözü yormayan aydınlık mimari (Daylight Aesthetic), mobil ve kiosk dokunmatik ekranlara tam uyumlu responsive arayüz, sıfır etiket çakışması (zero text-collision), milisaniyeler içinde Dijkstra çok-katlı rota hesaplama ve 60 FPS canlı sepet simülasyonu.

---

## 2. Mimari & Koordinat Sistemi

### 2.1. Standart SVG ViewBox
* Tüm kat SVG planları (`public/svg/1.svg` - `6.svg`) ve rota katmanları (`#route-svg`) **kesinlikle `516 × 735`** koordinat düzleminde çalışır:
  ```html
  <svg viewBox="0 0 516 735" width="516" height="735">
  ```
* Koordinat referansları:
  * Merkez X: `258`
  * Merkez Y: `365`
  * Batı Koridoru X: `132 – 148`
  * Doğu Koridoru X: `368 – 384`
  * Kuzey-Güney koridor uzunluğu: `Y = 70` ile `Y = 665` arası

### 2.2. Kat Yapısı (6 Kat Mimarisi)
| Kat No | Kod / Label | Kat Adı & Teması | Önemli Noktalar |
| :---: | :---: | :--- | :--- |
| **6** | `2` | 2. Kat: Sinema & Çocuk Dünyası | Cinemaximum, Playland, Bowling |
| **5** | `1` | 1. Kat: Fast Food & Teras Restoranları | Food Court, Bay Döner, HD İskender, KFC, Popeyes |
| **4** | `Z` | **Zemin Kat (Ana Giriş & Lüks Moda)** | **Müzikli Gösteri Havuzu**, Beymen Club, Vakko, Cookshop, Atasay, Fişekhane & Carousel Girişleri |
| **3** | `B1` | 1. Bodrum Kat: Spor & Gençlik Modası | Nike, Adidas, Zara, Pull&Bear, Bershka, Stradivarius, Oysho |
| **2** | `B2` | 2. Bodrum Kat: Market & Teknoloji | Macrocenter, MediaMarkt, D&R, Vale & Kapalı Otopark Girişi |
| **1** | `B3` | 3. Bodrum Kat: Hizmet & Kapalı Otopark | Kuru Temizleme, Terzi, Oto Yıkama, Otopark Ödeme Noktaları |

### 2.3. Mimari Elemanlar & Koridorlar
1. **Atrium & Müzikli Havuz:**
   * Zemin katta (Kat 4): Merkezde eliptik **Müzikli Gösteri Havuzu** (`cx: 258, cy: 365, rx: 78, ry: 130`) ve su fıskiyeleri yer alır.
   * Üst katlarda (Kat 5 ve 6): Zemin kata bakan cam korkuluklu eliptik galeri boşluğu (`void-atrium`).
2. **Skybridge (Geçiş Köprüleri):**
   * Doğu ve batı kanatlarını birbirine bağlayan 3 ana köprü hattı:
     * Kuzey Köprüsü: `y ≈ 200`
     * Merkez Köprüsü: `y ≈ 365` (Zemin katta havuz etrafından dolaşır)
     * Güney Köprüsü: `y ≈ 530`
3. **Dijkstra Navigasyon Grafı:**
   * Koridor düğümleri (`c_{floor}_{dir}_{idx}`), mağaza kapı düğümleri (`n_{floor}_door_{idx}`), yürüyen merdivenler (`esc_{floor}_{dir}`) ve asansörler (`lift_{floor}_{idx}`) 100% bağlı bir ağ oluşturur.
   * Hiçbir mağaza veya servis kapısı izole/bağlantısız bırakılamaz.

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
