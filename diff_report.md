# Capacity AVM Mağaza Verisi Karşılaştırma ve Senkronizasyon Raporu (diff_report.md)

- **Kaynak Web Adresi:** https://www.capacity.com.tr/magazalar
- **Web Sitesindeki Toplam Mağaza Sayısı:** 173
- **Harita Sistemindeki (mall_data.json) Toplam Mağaza Sayısı:** 173
- **Birebir Eşleşen Mağaza Sayısı:** 173
- **Sitede Olup Haritada Bulunmayanlar:** 0
- **Haritada Olup Sitede Bulunmayanlar:** 0
- **Kat Bilgisi Çelişen Mağazalar:** 0

---

## 1. Sitede Olup Haritada Bulunmayan Mağazalar

> [!NOTE]
> Web sitesinde listelenen tüm 173 mağaza harita verisi (`mall_data.json`) ile %100 eşleşmiştir. Bulunamayan mağaza yoktur.

---

## 2. Haritada Olup Sitede Bulunmayan Mağazalar

> [!NOTE]
> Haritadaki tüm 173 mağaza web sitesindeki liste ile eşleşmiştir. Haritada harici/yetim mağaza bulunmamaktadır.

---

## 3. Kat Bilgisi Çelişen Mağazalar

> [!NOTE]
> Harita kat bilgileri ile web sitesi kat bilgileri arasında hiçbir çelişki bulunmamaktadır. Tüm katlar birebir uyumludur.

---

## 4. Güvenli Veri Entegrasyonu Özeti

- `cx`, `cy`, `nav_node`, `door_x`, `door_y` ve tüm mimari koordinatlar **%100 korunmuş**, hiçbir değişiklik yapılmamıştır.
- Dijkstra yönlendirme grafı (`graph.nodes` ve `graph.adj`) **dokunulmamış**, tam bütünlük doğrulanmıştır.
- Eşleşen mağazalara web üzerinden çekilen doğrulanmış `phone`, `category_web` ve `logo_url` alanları eklenmiştir.
