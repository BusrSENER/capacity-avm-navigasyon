# 🛍️ İstanbul Bakırköy Capacity AVM İnteraktif Harita & Mikro-Navigasyon Sistemi

[![Canlı Demo](https://img.shields.io/badge/Canl%C4%B1%20Uygulama-GitHub%20Pages-brightgreen?style=for-the-badge&logo=github)](https://busrsener.github.io/capacity-avm-navigasyon/)
[![Lisans](https://img.shields.io/badge/Lisans-T%C3%BCm%20Haklar%C4%B1%20Sakl%C4%B1d%C4%B1r%20(Proprietary)-red?style=for-the-badge)](./LICENSE)

İstanbul Bakırköy **Capacity Alışveriş ve Yaşam Merkezi (6 Kat, 173 Mağaza, 25+ Servis Noktası)** için geliştirilmiş; çok katlı iç mekan mikro-navigasyon, eliptik atrium uzamsal koordinat optimizasyonu, 4-pass neon rota shader'ı, alışveriş sepeti simülasyon motoru ve çevrimdışı PWA mimarisi.

🔗 **Canlı Proje Linki:** [https://busrsener.github.io/capacity-avm-navigasyon/](https://busrsener.github.io/capacity-avm-navigasyon/)

---

> [!WARNING]
> ### ⚖️ FİKRİ MÜLKİYET & KATI TELİF HAKKI BİLDİRİMİ
> **Telif Hakkı © 2026 nrdsor (nrdsor.com). Tüm Hakları Saklıdır.**
> Bu yazılım, mimari SVG kat planları, iç mekan Dijkstra navigasyon grafı, koordinat matrisleri ve tüm kaynak kodları **nrdsor**'un münhasır mülkiyetindedir.
> **İŞBU PROJE AÇIK KAYNAK DEĞİLDİR.**
> Yazılı izin alınmaksızın; projenin tamamının veya herhangi bir parçasının kopyalanması, klonlanması, dağıtılması, başka bir depoya taşınması veya ticari/gayriticari amaçla kullanılması **5846 sayılı Fikir ve Sanat Eserleri Kanunu** ve uluslararası telif hakkı mevzuatı uyarınca kesinlikle yasaktır. Ayrıntılar için [`LICENSE`](./LICENSE) belgesini inceleyiniz.

---

## 🌟 Öne Çıkan Özellikler

- **Vektörel Eliptik Kat Planları (B3 - 2. Kat):**
  - Capacity AVM'nin ikonik bumerang/eliptik atrium mimarisi, merkez müzikli fıskiye/gösteri havuzu ve panoramik cam asansör kulesi.
  - 6 Katın tamamı için optimize edilmiş $1400 \times 850$ piksel dik mimari koordinat düzlemi.
- **173 Doğrulanmış Mağaza & Servis:**
  - Resmi Capacity veritabanından çekilen 173 mağaza, telefon numaraları, kategori kodları ve küçük resimler (%100 eşleşme).
  - Beymen Club, Vakko, Lacoste, Zara, Bershka, D&R, Paribu Cineverse, Burger King, Sephora, Mavi vb. için %100 çevrimdışı keskin SVG logolar ve monogram rozet motoru.
- **Min-Priority Queue Dijkstra Graf Motoru:**
  - $\mathcal{O}((|E| + |V|) \log |V|)$ hızında çok katlı yol bulma.
  - `mode === 'escalator'` ve `mode === 'elevator'` (Engelsiz / PMR / Bebek Arabası) güzergah kısıtlamaları.
  - Müzikli Havuz su poligonunun üzerinden transit geçişi engelleyen dinamik bypass koruması.
  - İzole veya erişilemeyen kanatlarda otomatik hibrit (`both`) **dinamik fallback** koruması.
  - Türkçe ve İngilizce doğal dil adım adım yönlendirme ("Yürüyen merdivenle 2. kata çıkın", "Sağa dönün; So Chic ve Cacharel'i geçerek 59 m düz ilerleyin").
  - Web Speech API için Türkçe fonetik telaffuz normalizasyonu (`W Collection` ➔ `Dabılyu Kolekşın`, `Pull&Bear` ➔ `Pul end Ber`).
- **4-Katmanlı Neon Rota Render Pipeline'ı:**
  - Ambient Glow (22px cyan blur) + Route Casing + Neon Core + Sonsuz döngüde kayan Flowing Pearl Dash noktaları.
  - Kat atlama butonları ve serbest kamera modunda anında "Çantaya Dön" desteği.
- **Alışveriş Sepeti (CartSimulator) Simülasyonu:**
  - Hız ve zaman delta ($\Delta t$) interpolasyonu.
  - Viraj dönüşlerinde yatay yüz değişimi (`scaleX`) ve kavis eğimi (`tilt angle clamp [-25°, +25°]`).
  - Dönen tekerlek fiziği, radar beacon ve kat geçiş modal sekansı.
- **Çevrimdışı PWA & Service Worker (`sw.js`):**
  - AVM'nin -1, -2 ve -3. bodrum katlarında hücresel veri kopsa bile harita ve navigasyonun kesintisiz çalışmasını sağlayan akıllı önbellek mimarisi.
- **Akıllı Otopark Doluluk & Park Yeri Kaydı (`parking-service.js`):**
  - Canlı Google Sheets API entegrasyonuyla P1, P2 ve P3 katlarındaki renkli bölgelerin anlık doluluk oranları.
  - Kullanıcının aracını park ettiği sütun kodunu hafızaya alıp dönüşte arabaya rota çizebilme.
- **Günün Fırsatları & Kupon Motoru:**
  - Her mağazaya özel anlık indirim kodları (`CAPACITY-XXX`) ve tek tıkla kopyalama desteği.

---

## 📁 Proje Dizin Yapısı

```
capacity-avm-navigasyon/
├── index.html                   # Ana UI layout, sol panel, harita viewport, toast konteyneri
├── sw.js                        # Çevrimdışı PWA Service Worker (B3 bodrum katı dahil kesintisiz harita)
├── LICENSE                      # Tüm Hakları Saklıdır (Proprietary) lisans metni
├── requirements.txt             # Playwright & Pytest otomatik test bağımlılıkları
├── css/
│   └── app.css                  # Modern Noir renk paleti, 4-layer rota stilleri, cart animasyonları
├── js/
│   ├── app.js                   # State manager, event listeners, arama filtreleri, POI controller
│   ├── map.js                   # SVG viewport, pan/zoom, LOD, flyTo kamerası, route rendering
│   ├── navigation.js            # Dijkstra graf motoru, step talimat üreticisi, mod fallback
│   ├── simulator.js             # Cart maskot animasyonu, oryantasyon fiziği, kat geçiş modalı
│   ├── logos.js                 # 173 mağaza için vektörel SVG logo kütüphanesi & monogram motoru
│   ├── parking-service.js       # Canlı otopark doluluk ve park hafızası servisi
│   └── qrcode.js                # Mobille QR kod paylaşım motoru
└── public/
    ├── mall_data.json           # Kat bilgileri, mağaza metadata'sı, graf düğümleri ve komşuluk listesi
    ├── favicon.svg              # Capacity AVM vektörel marka logosu
    └── svg/                     # Kat planı vektörel şablonları (1.svg - 6.svg)
```

---

## 🚀 Yerel Olarak Çalıştırma

Projeyi bilgisayarınızda yerel olarak başlatmak için:

### 1. Python ile (Önerilen)
```bash
python server.py
# veya
python -m http.server 3000
```
Tarayıcınızda açın: `http://localhost:3000`

### 2. Node.js ile
```bash
npx serve .
```

---

## 🔄 GitHub Eşzamanlama (Sync)

Yerelde yaptığınız değişiklikleri GitHub Pages'e tek komutla göndermek için:

```bash
git add .
git commit -m "feat: arayüz sadeleştirmesi ve pwa entegrasyonu"
git push origin main
```
Gönderildikten 1-2 dakika sonra [https://busrsener.github.io/capacity-avm-navigasyon/](https://busrsener.github.io/capacity-avm-navigasyon/) otomatik olarak güncellenir.

---

## 🧪 Otomatik E2E Testleri

Testleri çalıştırmak için:

```bash
pip install -r requirements.txt
playwright install chromium
python tests/test_minimal_app.py
```
