/**
 * İstanbul Bakırköy Capacity AVM - Google Sheets Canlı Otopark & Doluluk Servisi
 * Web App Endpoint: Google Apps Script (Canlı Doluluk & Park Yeri Kayıt/Çıkış)
 */

const PARKING_API_URL = 'https://script.google.com/macros/s/AKfycbyIG6moSh1AXVgKYbHk9868Uz1JQ4iY5LBKky3I_uQqxwDbiv2MbOs_-lRhAQ3O3v2N0Q/exec';
const DEFAULT_ZONE_CAPACITY = 60;

const FLOOR_META_MAP = {
  P1: { floor: 3, code: 'P1', name: 'P1 (1. Bodrum Kat)' },
  P2: { floor: 2, code: 'P2', name: 'P2 (2. Bodrum Kat)' },
  P3: { floor: 1, code: 'P3', name: 'P3 (3. Bodrum Kat)' },
  '3': { floor: 3, code: 'P1', name: 'P1 (1. Bodrum Kat)' },
  '2': { floor: 2, code: 'P2', name: 'P2 (2. Bodrum Kat)' },
  '1': { floor: 1, code: 'P3', name: 'P3 (3. Bodrum Kat)' }
};

const ZONE_COLOR_HEX_MAP = {
  Mavi: '#2563eb',
  Sarı: '#eab308',
  Turuncu: '#f97316',
  Kırmızı: '#ef4444'
};

const DEFAULT_FALLBACK_OCCUPANCY = {
  P1_Mavi: 24,
  P1_Sarı: 38,
  P1_Turuncu: 51,
  P1_Kırmızı: 49,
  P2_Mavi: 12,
  P2_Sarı: 19,
  P2_Turuncu: 34,
  P2_Kırmızı: 22,
  P3_Mavi: 9,
  P3_Sarı: 14,
  P3_Turuncu: 18,
  P3_Kırmızı: 11
};

class ParkingService {
  static get API_URL() {
    return PARKING_API_URL;
  }

  static get ZONE_CAPACITY() {
    return DEFAULT_ZONE_CAPACITY;
  }

  /**
   * localStorage üzerinden 'capacity_device_id' (tekil anonim id) oluşturur veya alır
   */
  static getDeviceId() {
    try {
      let devId = localStorage.getItem('capacity_device_id');
      if (!devId) {
        const randPart = typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
          : Math.random().toString(36).substring(2, 10) + Date.now().toString(36).slice(-4);
        devId = `cap_${randPart}`;
        localStorage.setItem('capacity_device_id', devId);
      }
      return devId;
    } catch (e) {
      return `cap_mem_${Date.now().toString(36)}`;
    }
  }

  /**
   * Kayıtlı park konumunu LocalStorage'dan ('capacity_parking_spot') okur
   */
  static getSavedSpot() {
    try {
      const raw = localStorage.getItem('capacity_parking_spot');
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  /**
   * 1. Konumu LocalStorage'a ('capacity_parking_spot') yazar.
   * 2. Google Apps Script endpoint'ine POST isteği gönderir
   *    (action: 'save', mall_id: 'capacity', floor_id, zone_color, pillar_code, device_id)
   */
  static async saveSpot(floorId, zoneColor, pillarCode = '') {
    const floorKey = String(floorId || 'P2').toUpperCase();
    const floorMeta = FLOOR_META_MAP[floorKey] || FLOOR_META_MAP.P2;
    const cleanZone = zoneColor || 'Mavi';
    const cleanPillar = String(pillarCode || '').trim();
    const deviceId = ParkingService.getDeviceId();

    const spotData = {
      mall_id: 'capacity',
      floor: floorMeta.floor,
      code: floorMeta.code,
      floor_id: floorMeta.code,
      name: floorMeta.name,
      zone: cleanZone,
      zone_color: cleanZone,
      zoneColor: ZONE_COLOR_HEX_MAP[cleanZone] || '#2563eb',
      pillar: cleanPillar,
      pillar_code: cleanPillar,
      device_id: deviceId,
      time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
      timestamp: Date.now()
    };

    try {
      localStorage.setItem('capacity_parking_spot', JSON.stringify(spotData));
    } catch (e) {}

    // Yerel önbellekteki doluluk sayısını da anında güncelle
    try {
      const occKey = `${spotData.floor_id}_${spotData.zone_color}`;
      if (!window._cachedParkingOccupancy) {
        window._cachedParkingOccupancy = { ...DEFAULT_FALLBACK_OCCUPANCY };
      }
      window._cachedParkingOccupancy[occKey] = Math.min(
        DEFAULT_ZONE_CAPACITY,
        (Number(window._cachedParkingOccupancy[occKey]) || 0) + 1
      );
    } catch (e) {}

    const payload = {
      action: 'save',
      mall_id: 'capacity',
      floor_id: spotData.floor_id,
      zone_color: spotData.zone_color,
      pillar_code: spotData.pillar_code,
      device_id: deviceId
    };

    try {
      await fetch(PARKING_API_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      // Apps Script CORS / ağ kesintisinde yerel kayıt korunur
    }

    return spotData;
  }

  /**
   * 1. LocalStorage'daki 'capacity_parking_spot' kaydını siler.
   * 2. Google Apps Script endpoint'ine POST isteği gönderir (action: 'release', device_id).
   */
  static async releaseSpot() {
    const prevSpot = ParkingService.getSavedSpot();
    const deviceId = ParkingService.getDeviceId();

    try {
      localStorage.removeItem('capacity_parking_spot');
    } catch (e) {}

    if (prevSpot && window._cachedParkingOccupancy) {
      const occKey = `${prevSpot.floor_id || prevSpot.code}_${prevSpot.zone_color || prevSpot.zone}`;
      if (window._cachedParkingOccupancy[occKey] > 0) {
        window._cachedParkingOccupancy[occKey] -= 1;
      }
    }

    const payload = {
      action: 'release',
      mall_id: 'capacity',
      device_id: deviceId
    };

    try {
      await fetch(PARKING_API_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      // Apps Script CORS / ağ kesintisinde yerel silme işlemi tamamlanmıştır
    }

    return { released: true, device_id: deviceId };
  }

  /**
   * Google Apps Script endpoint'ine GET isteği atarak bugünün aktif doluluk sayılarını
   * ({ "P1_Mavi": 12, "P2_Sarı": 5 }) çeker.
   */
  static async getOccupancy() {
    const baseOccupancy = {
      ...(window._cachedParkingOccupancy || DEFAULT_FALLBACK_OCCUPANCY)
    };

    try {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timeoutId = controller ? setTimeout(() => controller.abort(), 4500) : null;

      const response = await fetch(`${PARKING_API_URL}?action=occupancy&mall_id=capacity`, {
        method: 'GET',
        redirect: 'follow',
        headers: {
          Accept: 'application/json, text/plain, */*'
        },
        signal: controller ? controller.signal : undefined
      });

      if (timeoutId) clearTimeout(timeoutId);

      if (response && response.ok) {
        const text = await response.text();
        if (text) {
          const parsed = JSON.parse(text);
          const mapCandidate = (parsed && typeof parsed === 'object')
            ? (parsed.occupancy || parsed.data || parsed.counts || parsed)
            : null;
          if (mapCandidate && typeof mapCandidate === 'object') {
            const merged = { ... DEFAULT_FALLBACK_OCCUPANCY };
            for (const [k, v] of Object.entries(mapCandidate)) {
              const num = Number(v);
              if (!Number.isNaN(num) && num >= 0) {
                merged[k] = num;
              }
            }
            window._cachedParkingOccupancy = merged;
            return merged;
          }
        }
      }
    } catch (err) {
      // Çevrimdışı veya Apps Script yönlendirme kısıtlamasında önbellek/varsayılan veriyi dön
    }

    window._cachedParkingOccupancy = baseOccupancy;
    return baseOccupancy;
  }

  /**
   * Bölge kapasitesine (60 araç) göre doluluk yüzdesi ve renk/etiket bilgilerini hesaplar:
   * - <50%: Yeşil (%X Dolu - Rahat Park)
   * - 50-79%: Turuncu (%X Dolu - Yoğun)
   * - >=80%: Kırmızı (%X Dolu - Doluya Yakın)
   */
  static getZoneHeatbarInfo(activeCount, capacity = DEFAULT_ZONE_CAPACITY) {
    const count = Math.max(0, Number(activeCount) || 0);
    const cap = Math.max(1, Number(capacity) || DEFAULT_ZONE_CAPACITY);
    const pct = Math.min(100, Math.max(0, Math.round((count / cap) * 100)));

    if (pct < 50) {
      return {
        count,
        activeCount: count,
        capacity: cap,
        percent: pct,
        pct,
        level: 'green',
        barColor: '#10b981',
        colorHex: '#10b981',
        badgeClass: 'text-emerald-600 dark:text-emerald-400',
        barClass: 'bg-emerald-500',
        trackClass: 'bg-emerald-100 dark:bg-emerald-950/60',
        statusLabel: 'Rahat Park',
        statusText: `%${pct} Dolu - Rahat Park`,
        label: `%${pct} Dolu - Rahat Park`,
        shortLabel: `%${pct} Dolu • Rahat Park`
      };
    }
    if (pct < 80) {
      return {
        count,
        activeCount: count,
        capacity: cap,
        percent: pct,
        pct,
        level: 'orange',
        barColor: '#f59e0b',
        colorHex: '#f59e0b',
        badgeClass: 'text-amber-600 dark:text-amber-400',
        barClass: 'bg-amber-500',
        trackClass: 'bg-amber-100 dark:bg-amber-950/60',
        statusLabel: 'Yoğun',
        statusText: `%${pct} Dolu - Yoğun`,
        label: `%${pct} Dolu - Yoğun`,
        shortLabel: `%${pct} Dolu • Yoğun`
      };
    }
    return {
      count,
      activeCount: count,
      capacity: cap,
      percent: pct,
      pct,
      level: 'red',
      barColor: '#ef4444',
      colorHex: '#ef4444',
      badgeClass: 'text-rose-600 dark:text-rose-400',
      barClass: 'bg-rose-600',
      trackClass: 'bg-rose-100 dark:bg-rose-950/60',
      statusLabel: 'Doluya Yakın',
      statusText: `%${pct} Dolu - Doluya Yakın`,
      label: `%${pct} Dolu - Doluya Yakın`,
      shortLabel: `%${pct} Dolu • Doluya Yakın`
    };
  }

  // Instance method delegasyonları (hem ParkingService.saveSpot hem de new ParkingService().saveSpot desteklenir)
  getDeviceId() {
    return ParkingService.getDeviceId();
  }

  saveSpot(floorId, zoneColor, pillarCode) {
    return ParkingService.saveSpot(floorId, zoneColor, pillarCode);
  }

  releaseSpot() {
    return ParkingService.releaseSpot();
  }

  getOccupancy() {
    return ParkingService.getOccupancy();
  }
}

if (typeof window !== 'undefined') {
  window.PARKING_API_URL = PARKING_API_URL;
  window.ParkingService = ParkingService;
  window.parkingService = new ParkingService();
}
