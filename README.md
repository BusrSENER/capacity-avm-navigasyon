# 🛍️ İstanbul Bakırköy Capacity AVM İnteraktif Harita & Mikro-Navigasyon Sistemi

İstanbul Bakırköy **Capacity Alışveriş ve Yaşam Merkezi (6 Kat, 173 Mağaza, 25+ Servis Noktası)** için geliştirilmiş; çok katlı iç mekan mikro-navigasyon, eliptik atrium uzamsal koordinat optimizasyonu, 4-pass neon rota shader'ı ve alışveriş sepeti simülasyon motoru.

---

## 🌟 Öne Çıkan Özellikler

- **Vektörel Eliptik Kat Planları (B3 - 2. Kat):**
  - Capacity AVM'nin ikonik bumerang/eliptik atrium mimarisi, merkez müzikli fıskiye/gösteri havuzu ve panoramik cam asansör kulesi.
  - 6 Katın tamamı için optimize edilmiş $516 \times 735$ piksel dik koordinatlı vektörel SVG'ler.
- **173 Doğrulanmış Mağaza & Servis:**
  - Resmi Capacity veritabanından çekilen 173 mağaza, telefon numaraları, kategori kodları ve küçük resimler.
  - Beymen Club, Vakko, Lacoste, Zara, Bershka, D&R, Paribu Cineverse, Burger King, Sephora, Mavi vb. için %100 çevrimdışı keskin SVG logolar.
- **Min-Priority Queue Dijkstra Graf Motoru:**
  - $\mathcal{O}((|E| + |V|) \log |V|)$ hızında çok katlı yol bulma.
  - `mode === 'escalator'` ve `mode === 'elevator'` kısıtlamaları.
  - İzole veya erişilemeyen kanatlarda otomatik hibrit (`both`) **dinamik fallback** koruması.
  - Türkçe doğal dil adım adım yönlendirme ("Yürüyen merdivenle 2. kata çıkın", "Sağa dönün", "18 m düz ilerleyin").
- **4-Katmanlı Neon Rota Render Pipeline'ı:**
  - Ambient Glow (22px cyan blur) + Route Casing + Neon Core + Sonsuz döngüde kayan Flowing Pearl Dash noktaları.
  - Kat atlama butonları ("Hop" butonu ile diğer kata animasyonlu geçiş).
- **Alışveriş Sepeti (CartSimulator) Simülasyonu:**
  - Hız ve zaman delta ($\Delta t$) interpolasyonu.
  - Viraj dönüşlerinde yatay yüz değişimi (`scaleX`) ve kavis eğimi (`tilt angle clamp [-25°, +25°]`).
  - Dönen tekerlek fiziği, radar beacon ve kat geçiş modal sekansı.
- **Günün Fırsatları & Kupon Motoru:**
  - Her mağazaya özel anlık indirim kodları (`CAPACITY-XXX`) ve tek tıkla kopyalama desteği.

---

## 📁 Proje Dizin Yapısı

```
capacity-avm-navigasyon/
├── index.html                   # Ana UI layout, sol panel, harita viewport, toast konteyneri
├── css/
│   └── app.css                  # Modern Noir renk paleti, 4-layer rota stilleri, cart animasyonları
├── js/
│   ├── app.js                   # State manager, event listeners, arama filtreleri, POI controller
│   ├── map.js                   # SVG viewport, pan/zoom, LOD, flyTo kamerası, route rendering
│   ├── navigation.js            # Dijkstra graf motoru, step talimat üreticisi, mod fallback
│   ├── simulator.js             # Cart maskot animasyonu, oryantasyon fiziği, kat geçiş modalı
│   └── logos.js                 # 173 mağaza için vektörel SVG logo kütüphanesi & monogram motoru
└── public/
    ├── mall_data.json           # Kat bilgileri, mağaza metadata'sı, graf düğümleri ve komşuluk listesi
    ├── favicon.svg              # Capacity AVM vektörel marka logosu
    └── svg/                     # Kat planı vektörel şablonları (1.svg - 6.svg)
```

---

## 🚀 Yerel Olarak Çalıştırma

Proje hiçbir harici paket bağımlılığı gerektirmeyen (Vanilla JS + Tailwind CDN) saf web mimarisindedir. Herhangi bir statik sunucuyla çalıştırılabilir:

### Seçenek 1: Python ile (Önerilen)
```bash
cd capacity-avm-navigasyon
python -m http.server 3000
```
Tarayıcınızda açın: `http://localhost:3000`

### Seçenek 2: Node.js (npx serve) ile
```bash
cd capacity-avm-navigasyon
npx serve .
```

---

## 📦 Git & GitHub Bağlantısı

```bash
cd capacity-avm-navigasyon
git init
git add .
git commit -m "feat: Capacity AVM interaktif harita ve navigasyon platformu"
git branch -M main
git remote add origin https://github.com/KULLANICI_ADINIZ/capacity-avm-navigasyon.git
git push -u origin main
```

---

## 🌐 Canlıya Alma (Firebase / Vercel / Netlify)

### Firebase Hosting ile:
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy --only hosting
```
