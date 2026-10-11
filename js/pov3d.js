/**
 * İstanbul Bakırköy Capacity AVM - "X Kişisinin Gözü" 3B Birinci Şahıs (First-Person POV) Koridor Simülasyon Motoru
 * - Sesli komut (Web Speech API) ile yürüyüş hızı birebir senkronizedir (konuşma hızı ve adım temposu eşgüdümlü).
 * - Mağazaların yanından geçerken hem 3B vitrin camında hem de 3B ışıklı tabelada kurumsal marka logoları (BrandLogos) görünür.
 * - Tüm katlardaki Kiosk Haritalar, Asansörler, Yürüyen Merdivenler, Bebek Odaları, Acil Çıkışlar, WC ve Otopark noktaları
 *   3B koridor içinde ışıklı yönlendirme totemleri olarak yer alır; cam tavan (skylight), vitrin doğramaları, palmiye saksıları,
 *   oturma bankları ve Müzikli Gösteri Havuzu ile gerçekçi AVM atmosferi sunar.
 */

class Pov3DEngine {
  constructor(mallData) {
    this.mallData = mallData;
    this.isActive = false;
    this.isWalking = false;
    this.walkSpeed = 1.0; // 1x, 2x, 4x
    this.walkStepPhase = 0;

    // Kamera 3B Dünya Koordinatları (1400 x 850 SVG düzlemi ile birebir örtüşür)
    this.camX = 1000;
    this.camY = 535;
    this.camZ = 26; // İnsan göz hizası (~1.65m; tavan z=68)
    this.camYaw = Math.PI; // Radyan cinsinden bakış açısı
    this.targetYaw = Math.PI;
    this.userYawOffset = 0; // Kullanıcının fare/parmakla sağa-sola bakma açısı
    this.currentFloor = 4;

    // Rota ve Yürüyüş Durumu
    this.route = null;
    this.startStore = null;
    this.targetStore = null;
    this.segIndex = 0;
    this.segProgress = 0; // 0..1
    this.totalProgressPct = 0;
    this.remainingMeters = 0;
    this.currentlyPassingStore = null;
    this.currentlyPassingSide = 'Yanınızda';
    this.announcedPassingStores = new Set();
    this.floorTransitionState = null; // { fromFloor, toFloor, timer, duration, portalType }

    // Kurumsal Marka Logosu (SVG -> Image) Önbelleği
    this.logoImageCache = new Map();
    this.logosRenderedLastFrame = 0;

    // Google Street View Serbest Gezinti (Free-Roam) & Etkileşim Durumu
    this.glideState = null; // { startX, startY, targetX, targetY, timer, duration }
    this.selectedPopupStore = null;
    this.storeHitBoxes = [];   // [{ store, x, y, w, h, rx }]
    this.hotspotHitBoxes = []; // [{ x, y, worldX, worldY, r }]
    this.portalHitBoxes = [];  // [{ x, y, w, h, toFloor, portalType }]
    this.radarRect = null;     // { rx, ry, rW, rH }
    this.mouseScreenX = -1;
    this.mouseScreenY = -1;
    this.hoveredStoreId = null;
    this.hoveredHotspot = null;

    // DOM Referansları
    this.container = null;
    this.canvas = null;
    this.ctx = null;
    this.animFrameId = null;
    this.lastFrameTime = 0;

    // Drag / Look-around durumu
    this.isDragging = false;
    this.dragMoved = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.dragStartYawOffset = 0;

    this._initDOM();
    this._preloadAllStoreLogos();
  }

  /**
   * js/logos.js içindeki kurumsal SVG marka logolarını 3B Canvas üzerinde çizilebilen saf SVG HTMLImageElement'e dönüştürür
   */
  _getStoreLogoImage(store) {
    if (!store || !store.id) return null;
    if (this.logoImageCache.has(store.id)) {
      return this.logoImageCache.get(store.id);
    }

    let rawHtml = '';
    if (typeof window.getStoreLogo === 'function') {
      rawHtml = window.getStoreLogo(store, 64) || '';
    }

    // Dıştaki <div class="store-badge-icon"> sarmalayıcısını soyup yalnızca saf <svg ...>...</svg> bloğunu çıkar
    const svgMatch = rawHtml.match(/<svg[\s\S]*?<\/svg>/i);
    let pureSvg = '';

    if (svgMatch) {
      pureSvg = svgMatch[0].trim();
      if (!pureSvg.includes('xmlns=')) {
        pureSvg = pureSvg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
      }
      if (!/\bwidth=["']\d+/.test(pureSvg)) {
        pureSvg = pureSvg.replace('<svg', '<svg width="100" height="100"');
      }
    } else {
      // Fallback kurumsal monogram SVG
      const initials = (store.name || 'CP')
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(w => w[0].toUpperCase())
        .join('');
      const catStyle = this._getCategoryColors(store.category);
      pureSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
        <rect width="100" height="100" rx="20" fill="${catStyle.fascia}"/>
        <text x="50" y="58" font-family="sans-serif" font-weight="900" font-size="34" fill="#ffffff" text-anchor="middle">${initials}</text>
      </svg>`;
    }

    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(pureSvg);
    this.logoImageCache.set(store.id, img);
    return img;
  }

  _preloadAllStoreLogos() {
    if (!this.mallData || !this.mallData.floors) return;
    for (let fl = 1; fl <= 6; fl++) {
      const stores = this.mallData.floors[fl]?.stores || [];
      for (const s of stores) {
        this._getStoreLogoImage(s);
      }
    }
  }

  setWalkSpeed(spd) {
    this.walkSpeed = spd;
    const spdBtn = document.getElementById('btn-pov-speed');
    if (spdBtn) spdBtn.textContent = `⚡ ${this.walkSpeed}x`;
  }

  _initDOM() {
    this.container = document.getElementById('pov-3d-container');
    this.canvas = document.getElementById('pov-3d-canvas');
    if (!this.canvas || !this.container) return;

    this.ctx = this.canvas.getContext('2d');

    // Boyutlandırma
    const resizeObserver = new ResizeObserver(() => {
      if (this.isActive) this._resizeCanvas();
    });
    resizeObserver.observe(this.container);
    window.addEventListener('resize', () => {
      if (this.isActive) this._resizeCanvas();
    });

    // Fare / Dokunmatik ile 360° Etrafa Bakınma + Google Street View Tıklama (Mağaza / Zemin Halkası / Radar)
    this.canvas.addEventListener('pointerdown', (e) => {
      this.isDragging = true;
      this.dragMoved = false;
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
      this.dragStartYawOffset = this.userYawOffset;
      this.canvas.setPointerCapture?.(e.pointerId);
    });

    this.canvas.addEventListener('pointermove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const dpr = this.canvas.width / Math.max(1, rect.width);
      this.mouseScreenX = (e.clientX - rect.left) * dpr;
      this.mouseScreenY = (e.clientY - rect.top) * dpr;

      if (!this.isDragging) {
        this._updateHoverCursor();
        return;
      }
      const dx = e.clientX - this.dragStartX;
      const dy = e.clientY - this.dragStartY;
      if (Math.hypot(dx, dy) > 6) {
        this.dragMoved = true;
      }
      this.userYawOffset = this.dragStartYawOffset - dx * 0.0055;
    });

    const endDrag = (e) => {
      if (this.isDragging && !this.dragMoved && e && e.type === 'pointerup') {
        const rect = this.canvas.getBoundingClientRect();
        const dpr = this.canvas.width / Math.max(1, rect.width);
        const cx = (e.clientX - rect.left) * dpr;
        const cy = (e.clientY - rect.top) * dpr;
        this._handleCanvasClick(cx, cy);
      }
      this.isDragging = false;
    };
    this.canvas.addEventListener('pointerup', endDrag);
    this.canvas.addEventListener('pointercancel', endDrag);

    // Klavye ile Google Street View Gezintisi (W/A/S/D ve Yön Tuşları)
    window.addEventListener('keydown', (e) => {
      if (!this.isActive) return;
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        this.stepAlongCorridor(1);
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        e.preventDefault();
        this.stepAlongCorridor(-1);
      } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        this.turnCamera(-Math.PI / 5);
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        this.turnCamera(Math.PI / 5);
      }
    });

    // Google Street View Adım & Bakış Butonları
    document.getElementById('btn-pov-turn-left')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.turnCamera(-Math.PI / 4);
    });
    document.getElementById('btn-pov-turn-right')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.turnCamera(Math.PI / 4);
    });
    document.getElementById('btn-pov-step-fwd')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.stepAlongCorridor(1);
    });
    document.getElementById('btn-pov-step-back')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.stepAlongCorridor(-1);
    });

    // 3B Mağaza Vitrin Popup Butonları
    document.getElementById('btn-pov-popup-close')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeStorePopup();
    });
    document.getElementById('btn-pov-popup-route')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const st = this.selectedPopupStore;
      this.closeStorePopup();
      if (st && typeof window.startRouteFromCurrentPovToStore === 'function') {
        window.startRouteFromCurrentPovToStore(st);
      }
    });
    document.getElementById('btn-pov-popup-start')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const st = this.selectedPopupStore;
      this.closeStorePopup();
      if (st) {
        if (typeof window.setStartLocation === 'function') {
          window.setStartLocation(st);
        }
        this.teleportInFrontOfStore(st, false);
      }
    });

    // POV HUD Kontrolleri
    document.getElementById('btn-pov-play-pause')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleWalk();
    });

    document.getElementById('btn-pov-restart')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.restartWalk();
    });

    document.getElementById('btn-pov-speed')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const steps = [1.0, 2.0, 4.0];
      const nextIdx = (steps.indexOf(this.walkSpeed) + 1) % steps.length;
      this.walkSpeed = steps[nextIdx];
      const spdBtn = document.getElementById('btn-pov-speed');
      if (spdBtn) spdBtn.textContent = `⚡ ${this.walkSpeed}x`;
      if (typeof window.setSimSpeed === 'function') {
        window.setSimSpeed(this.walkSpeed);
      } else if (window.cartSimulator) {
        window.cartSimulator.setSpeed(this.walkSpeed);
      }
    });

    document.getElementById('btn-pov-exit-2d')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (window.setMapViewMode) {
        window.setMapViewMode('2d');
      } else {
        this.deactivate();
      }
    });
  }

  _resizeCanvas() {
    if (!this.canvas || !this.container) return;
    const rect = this.container.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(300, rect.width || window.innerWidth);
    const h = Math.max(250, rect.height || window.innerHeight);
    if (this.canvas.width !== Math.floor(w * dpr) || this.canvas.height !== Math.floor(h * dpr)) {
      this.canvas.width = Math.floor(w * dpr);
      this.canvas.height = Math.floor(h * dpr);
    }
  }

  /**
   * Verilen (x, y) noktasını mağaza duvarlarının dışındaki en yakın yürünebilir koridor noktasına kenetler
   */
  _clampToWalkableCorridor(x, y, floor = this.currentFloor) {
    let cx = Math.max(195, Math.min(1195, x));
    let cy = Math.max(205, Math.min(640, y));

    // Önce bu kattaki koridor graf düğümlerine (nav_graph) yakın mı kontrol et; mağaza içine giriyorsa en yakın koridor aksına çek
    const floorStores = this.mallData?.floors[floor]?.stores || [];
    for (const s of floorStores) {
      const sx = s.x !== undefined ? s.x : (s.cx - (s.w || 70) / 2);
      const sy = s.y !== undefined ? s.y : (s.cy - (s.h || 90) / 2);
      const sw = s.w || 70;
      const sh = s.h || 90;
      const pad = 11;
      if (cx > sx - pad && cx < sx + sw + pad && cy > sy - pad && cy < sy + sh + pad) {
        // Mağaza sınırının dışındaki en yakın koridor kenarına it
        const dTop = Math.abs(cy - (sy - pad));
        const dBot = Math.abs((sy + sh + pad) - cy);
        const dLeft = Math.abs(cx - (sx - pad));
        const dRight = Math.abs((sx + sw + pad) - cx);
        const minD = Math.min(dTop, dBot, dLeft, dRight);
        if (minD === dTop) cy = sy - pad;
        else if (minD === dBot) cy = sy + sh + pad;
        else if (minD === dLeft) cx = sx - pad;
        else cx = sx + sw + pad;
      }
    }
    return { x: cx, y: cy };
  }

  /**
   * Aktif rota olmadan (veya her an) Google Street View tarzı 3B Serbest AVM Sokak Gezintisi başlatır
   */
  enterFreeRoam(floor = 4, focusStore = null) {
    this.currentFloor = floor || 4;
    this.isFreeRoam = true;
    this.isWalking = false;
    this.floorTransitionState = null;
    this.glideState = null;
    this.closeStorePopup();

    if (focusStore && focusStore.floor === this.currentFloor) {
      this.teleportInFrontOfStore(focusStore, false);
    } else {
      // Bu katın ana galeri koridorunda panoramik başlangıç noktası
      const startPt = this._clampToWalkableCorridor(880, 440, this.currentFloor);
      this.camX = startPt.x;
      this.camY = startPt.y;
      this.camZ = 26;
      this.camYaw = Math.PI; // Batıya (ana galeri ve atrium havuzuna doğru) bak
      this.targetYaw = Math.PI;
      this.userYawOffset = 0;
    }

    this._detectPassingStore(false);
    this._syncPlayPauseButton();
    this._updateHUDTexts();
    this.activate();
  }

  /**
   * 3B Sokak Görünümü içindeyken kat seçici (B3..2) tıklandığında katı canlı değiştirir
   */
  switchFloorInFreeRoam(newFloor) {
    if (!newFloor || newFloor === this.currentFloor) return;
    const oldFloor = this.currentFloor;
    this.closeStorePopup();
    this.floorTransitionState = {
      fromFloor: oldFloor,
      toFloor: newFloor,
      timer: 0,
      duration: 1.1,
      portalType: 'escalator'
    };
    this.currentFloor = newFloor;
    const clamped = this._clampToWalkableCorridor(this.camX, this.camY, newFloor);
    this.camX = clamped.x;
    this.camY = clamped.y;
    this._detectPassingStore(false);
    this._updateHUDTexts();
  }

  /**
   * Kamerayı seçilen mağazanın 3B vitrininin tam önündeki koridora ışınlar ve vitrine doğru döndürür
   */
  teleportInFrontOfStore(store, showPopup = true) {
    if (!store) return;
    if (store.floor && store.floor !== this.currentFloor) {
      this.currentFloor = store.floor;
      if (window.mallMap && window.mallMap.currentFloor !== store.floor) {
        window.mallMap.loadFloor(store.floor);
      }
      if (typeof window.updateFloorUI === 'function') {
        window.updateFloorUI(store.floor);
      }
    }

    const scx = store.cx || 700;
    const scy = store.cy || 425;
    // Mağaza kuzey bloğundaysa (cy < 380) koridor güneyindedir (y ~ 415); güney bloğundaysa koridor kuzeyindedir (y ~ 445)
    let targetCorridorX = scx;
    let targetCorridorY = scy < 410 ? Math.min(435, (store.y || scy) + (store.h || 80) + 28) : Math.max(415, (store.y || scy) - 28);
    if (store.nav_node && this.mallData?.graph?.nodes?.[store.nav_node]) {
      const nd = this.mallData.graph.nodes[store.nav_node];
      targetCorridorX = nd.x;
      targetCorridorY = nd.y;
    }
    const safePt = this._clampToWalkableCorridor(targetCorridorX, targetCorridorY, this.currentFloor);
    this.isWalking = false;
    this.glideState = null;
    this.camX = safePt.x;
    this.camY = safePt.y;
    this.camZ = 26;
    this.camYaw = Math.atan2(scy - this.camY, scx - this.camX);
    this.targetYaw = this.camYaw;
    this.userYawOffset = 0;
    this.currentlyPassingStore = store;
    this.currentlyPassingSide = 'Tam Karşınızda';

    this._syncPlayPauseButton();
    this._updateHUDTexts();
    if (showPopup) {
      this.openStorePopup(store);
    }
  }

  /**
   * Google Street View Adım Atma: Bakılan yöne doğru koridorda ileri (+1) veya geri (-1) yumuşakça süzülür
   */
  stepAlongCorridor(dir = 1) {
    if (this.isWalking) {
      this.isWalking = false;
      this._syncPlayPauseButton();
    }
    this.closeStorePopup();
    const effectiveYaw = this.camYaw + this.userYawOffset;
    // Kullanıcının bakış ofsetini ana bakış açısına birleştir
    this.camYaw = effectiveYaw;
    this.targetYaw = effectiveYaw;
    this.userYawOffset = 0;

    const stepDist = 56 * dir;
    const rawX = this.camX + Math.cos(effectiveYaw) * stepDist;
    const rawY = this.camY + Math.sin(effectiveYaw) * stepDist;

    // Yakında bir koridor graf düğümü varsa ona hizala ki koridor ortasından akıcı ilerlesin
    const snapped = this._findBestCorridorTarget(rawX, rawY, effectiveYaw, dir);
    this.glideToPoint(snapped.x, snapped.y);
  }

  _findBestCorridorTarget(rawX, rawY, yaw, dir) {
    const nodesObj = this.mallData?.graph?.nodes || {};
    let bestNode = null;
    let bestScore = Infinity;
    const cosY = Math.cos(yaw) * (dir >= 0 ? 1 : -1);
    const sinY = Math.sin(yaw) * (dir >= 0 ? 1 : -1);

    for (const [id, nd] of Object.entries(nodesObj)) {
      if (nd.floor !== this.currentFloor || !id.startsWith('c_')) continue;
      const dx = nd.x - this.camX;
      const dy = nd.y - this.camY;
      const dist = Math.hypot(dx, dy);
      if (dist < 18 || dist > 115) continue;
      const dot = (dx / dist) * cosY + (dy / dist) * sinY;
      if (dot > 0.55) {
        const score = Math.abs(dist - 55) + (1 - dot) * 45;
        if (score < bestScore) {
          bestScore = score;
          bestNode = nd;
        }
      }
    }
    if (bestNode) {
      return this._clampToWalkableCorridor(bestNode.x, bestNode.y, this.currentFloor);
    }
    return this._clampToWalkableCorridor(rawX, rawY, this.currentFloor);
  }

  /**
   * Kamerayı sağa veya sola yumuşakça döndürür
   */
  turnCamera(deltaAngle) {
    const currentEffective = this.camYaw + this.userYawOffset;
    this.camYaw = currentEffective;
    this.userYawOffset = 0;
    this.targetYaw = currentEffective + deltaAngle;
  }

  /**
   * Kamerayı mevcut konumdan (targetX, targetY) koridor noktasına Google Street View geçişiyle yumuşakça kaydırır
   */
  glideToPoint(targetX, targetY, lookAtYaw = null) {
    const safe = this._clampToWalkableCorridor(targetX, targetY, this.currentFloor);
    const dx = safe.x - this.camX;
    const dy = safe.y - this.camY;
    if (Math.hypot(dx, dy) > 4 && lookAtYaw === null) {
      this.camYaw = this.camYaw + this.userYawOffset;
      this.userYawOffset = 0;
      this.targetYaw = Math.atan2(dy, dx);
    } else if (lookAtYaw !== null) {
      this.camYaw = this.camYaw + this.userYawOffset;
      this.userYawOffset = 0;
      this.targetYaw = lookAtYaw;
    }

    this.glideState = {
      startX: this.camX,
      startY: this.camY,
      targetX: safe.x,
      targetY: safe.y,
      timer: 0,
      duration: 0.42
    };
  }

  openStorePopup(store) {
    if (!store) return;
    this.selectedPopupStore = store;
    const popup = document.getElementById('pov-store-popup');
    if (!popup) return;
    const logoEl = document.getElementById('pov-popup-logo');
    const unitEl = document.getElementById('pov-popup-unit');
    const catEl = document.getElementById('pov-popup-cat');
    const nameEl = document.getElementById('pov-popup-name');

    if (logoEl && typeof window.getStoreLogo === 'function') {
      logoEl.innerHTML = window.getStoreLogo(store, 36);
    }
    if (unitEl) unitEl.textContent = store.unit || 'Z-10';
    if (catEl) catEl.textContent = store.category_name || store.category || 'Mağaza';
    if (nameEl) nameEl.textContent = store.name;
    popup.classList.remove('hidden');
  }

  closeStorePopup() {
    this.selectedPopupStore = null;
    document.getElementById('pov-store-popup')?.classList.add('hidden');
  }

  _updateHoverCursor() {
    if (!this.canvas) return;
    const mx = this.mouseScreenX;
    const my = this.mouseScreenY;
    this.hoveredStoreId = null;
    this.hoveredHotspot = null;
    this.hoverFloorWorldPt = null;

    // 1. Mağaza tabelası üzerinde mi?
    for (let i = this.storeHitBoxes.length - 1; i >= 0; i--) {
      const hb = this.storeHitBoxes[i];
      if (mx >= hb.x1 && mx <= hb.x2 && my >= hb.y1 && my <= hb.y2) {
        this.hoveredStoreId = hb.store.id;
        this.canvas.style.cursor = 'pointer';
        return;
      }
    }

    // 2. Yürüyen merdiven / asansör portalı üzerinde mi?
    for (const pb of this.portalHitBoxes) {
      if (mx >= pb.x1 && mx <= pb.x2 && my >= pb.y1 && my <= pb.y2) {
        this.canvas.style.cursor = 'pointer';
        return;
      }
    }

    // 3. Street View zemin halkası üzerinde mi?
    for (const hs of this.hotspotHitBoxes) {
      if (Math.hypot(mx - hs.x, my - hs.y) <= hs.r * 1.35) {
        this.hoveredHotspot = hs;
        this.canvas.style.cursor = 'pointer';
        return;
      }
    }

    // 4. Mini-Radar üzerinde mi?
    if (this.radarRect && mx >= this.radarRect.x && mx <= this.radarRect.x + this.radarRect.w &&
        my >= this.radarRect.y && my <= this.radarRect.y + this.radarRect.h) {
      this.canvas.style.cursor = 'pointer';
      return;
    }

    // 5. Koridor zemininde mi? (Canlı 3B Street View Zemin İmleci)
    const W = this.canvas.width;
    const H = this.canvas.height;
    const horizonY = H * 0.49;
    const fovScale = W * 0.56;
    if (my > horizonY + 18 && my < H - 45) {
      const effectiveYaw = this.camYaw + this.userYawOffset;
      const cosYaw = Math.cos(effectiveYaw);
      const sinYaw = Math.sin(effectiveYaw);
      const rx = Math.min(180, Math.max(20, (this.camZ * fovScale) / (my - horizonY)));
      const ry = ((mx - W * 0.5) / fovScale) * rx;
      const rawWX = this.camX + rx * cosYaw - ry * sinYaw;
      const rawWY = this.camY + rx * sinYaw + ry * cosYaw;
      const clamped = this._clampToWalkableCorridor(rawWX, rawWY, this.currentFloor);
      this.hoverFloorWorldPt = { wx: clamped.x, wy: clamped.y };
      this.canvas.style.cursor = 'pointer';
      return;
    }

    this.canvas.style.cursor = 'grab';
  }

  _handleCanvasClick(cx, cy) {
    // 1. Sağ alt 2B Mini-Radar tıklandıysa: O noktaya anında ışınlan!
    if (this.radarRect && cx >= this.radarRect.x && cx <= this.radarRect.x + this.radarRect.w &&
        cy >= this.radarRect.y && cy <= this.radarRect.y + this.radarRect.h) {
      const normX = (cx - this.radarRect.x) / this.radarRect.w;
      const normY = (cy - this.radarRect.y) / this.radarRect.h;
      const worldX = normX * 1400;
      const worldY = normY * 850;
      this.isWalking = false;
      this._syncPlayPauseButton();
      this.glideToPoint(worldX, worldY);
      return;
    }

    // 2. 3B Mağaza Tabelası / Vitrini tıklandıysa: Mağaza kartını aç ve mağazaya doğru bak!
    for (let i = this.storeHitBoxes.length - 1; i >= 0; i--) {
      const hb = this.storeHitBoxes[i];
      if (cx >= hb.x1 && cx <= hb.x2 && cy >= hb.y1 && cy <= hb.y2) {
        const st = hb.store;
        const lookYaw = Math.atan2((st.cy || 425) - this.camY, (st.cx || 700) - this.camX);
        this.camYaw = this.camYaw + this.userYawOffset;
        this.userYawOffset = 0;
        this.targetYaw = lookYaw;
        this.currentlyPassingStore = st;
        this.currentlyPassingSide = 'Tam Karşınızda';
        this.openStorePopup(st);
        this._updateHUDTexts();
        return;
      }
    }

    // 3. 3B Yürüyen Merdiven / Asansör Portalı tıklandıysa: Üst/Alt kata geçiş sürüşünü başlat!
    for (const pb of this.portalHitBoxes) {
      if (cx >= pb.x1 && cx <= pb.x2 && cy >= pb.y1 && cy <= pb.y2) {
        const nextFl = pb.targetFloor || (this.currentFloor < 6 ? this.currentFloor + 1 : 4);
        this.switchFloorInFreeRoam(nextFl);
        if (window.mallMap) window.mallMap.loadFloor(nextFl);
        if (typeof window.updateFloorUI === 'function') window.updateFloorUI(nextFl);
        return;
      }
    }

    // 4. Street View Zemin Halkası (Floor Hotspot) tıklandıysa: O koridor noktasına süzül!
    for (const hs of this.hotspotHitBoxes) {
      if (Math.hypot(cx - hs.x, cy - hs.y) <= hs.r * 1.45) {
        this.isWalking = false;
        this.closeStorePopup();
        this._syncPlayPauseButton();
        this.glideToPoint(hs.wx, hs.wy);
        return;
      }
    }

    // 5. Koridor zeminine (ufuk çizgisinin altına) tıklandıysa: Tıklanan 3B zemin koordinatına süzül!
    const W = this.canvas.width;
    const H = this.canvas.height;
    const horizonY = H * 0.49;
    const fovScale = W * 0.56;
    if (cy > horizonY + 18 && cy < H - 40) {
      const effectiveYaw = this.camYaw + this.userYawOffset;
      const cosYaw = Math.cos(effectiveYaw);
      const sinYaw = Math.sin(effectiveYaw);
      const rx = Math.min(110, Math.max(22, (this.camZ * fovScale) / (cy - horizonY)));
      const ry = ((cx - W * 0.5) / fovScale) * rx;
      const worldX = this.camX + rx * cosYaw - ry * sinYaw;
      const worldY = this.camY + rx * sinYaw + ry * cosYaw;
      this.isWalking = false;
      this.closeStorePopup();
      this._syncPlayPauseButton();
      this.glideToPoint(worldX, worldY);
    }
  }

  /**
   * Kullanıcı yalnızca başlangıç noktasını ("📍 Buradayım") pinlediğinde onun gözüne geçer
   */
  enterAtStartLocation(storeOrEntrance, autoActivate = true) {
    if (!storeOrEntrance) return;
    this.startStore = storeOrEntrance;
    this.currentFloor = storeOrEntrance.floor || 4;
    this.isFreeRoam = !this.route;

    // Kamerayı mağaza kapısının hemen önündeki koridora yerleştir
    const doorX = storeOrEntrance.door_x !== undefined ? storeOrEntrance.door_x : (storeOrEntrance.cx || storeOrEntrance.x || 700);
    const doorY = storeOrEntrance.door_y !== undefined ? storeOrEntrance.door_y : (storeOrEntrance.cy || storeOrEntrance.y || 425);

    // Merkeze (700, 425) doğru veya koridor yönüne baksın
    const lookDx = 700 - doorX;
    const lookDy = 425 - doorY;
    this.camX = doorX + (Math.hypot(lookDx, lookDy) > 10 ? (lookDx / Math.hypot(lookDx, lookDy)) * 14 : 0);
    this.camY = doorY + (Math.hypot(lookDx, lookDy) > 10 ? (lookDy / Math.hypot(lookDx, lookDy)) * 14 : 0);
    this.camZ = 26;
    this.camYaw = Math.atan2(lookDy, lookDx);
    this.targetYaw = this.camYaw;
    this.userYawOffset = 0;
    this.isWalking = false;

    this._updateHUDTexts();
    if (autoActivate) {
      this.activate();
    }
  }

  /**
   * Başlangıç ve hedef seçilip rota oluşturulduğunda X kişisinin gözünden yürüyüşü başlatır
   */
  startRouteWalk(routeData, startStore, targetStore, autoActivate = true, autoWalk = true) {
    if (!routeData || !routeData.pathNodes || routeData.pathNodes.length < 2) return;
    this.route = routeData;
    this.startStore = startStore;
    this.targetStore = targetStore;
    this.isFreeRoam = false;
    this.segIndex = 0;
    this.segProgress = 0;
    this.totalProgressPct = 0;
    this.remainingMeters = routeData.totalDistance || 0;
    this.announcedPassingStores.clear();
    this.currentlyPassingStore = null;
    this.floorTransitionState = null;
    this.glideState = null;
    this.closeStorePopup();
    this.userYawOffset = 0;
    this.walkStepPhase = 0;

    const n0 = routeData.pathNodes[0];
    const n1 = routeData.pathNodes[1];
    this.currentFloor = n0.floor;
    this.camX = n0.x;
    this.camY = n0.y;
    this.camZ = 26;

    // İlk gerçek koridor segmentinin yönünü bul (kapı önü 3m adımı yerine ana koridor yönü)
    let lookTarget = n1;
    if (routeData.pathNodes.length > 2 && Math.hypot(n1.x - n0.x, n1.y - n0.y) < 25 && routeData.pathNodes[2].floor === n0.floor) {
      lookTarget = routeData.pathNodes[2];
    }
    this.camYaw = Math.atan2(lookTarget.y - n0.y, lookTarget.x - n0.x);
    this.targetYaw = this.camYaw;
    this._lastSyncedSegIndex = -1;

    this.isWalking = !!autoWalk;
    this._syncPlayPauseButton();
    this._updateHUDTexts();

    if (autoWalk && window.updateLiveNavHUD && document.body.classList.contains('has-active-route')) {
      this._lastSyncedSegIndex = 0;
      window.updateLiveNavHUD(0, 0);
    }

    if (autoActivate) {
      this.activate();
    }
  }

  activate() {
    if (!this.container) return;
    this.isActive = true;
    this.container.classList.remove('hidden');
    document.body.classList.add('has-pov-3d-active');
    this._resizeCanvas();
    this.lastFrameTime = performance.now();

    if (!this.animFrameId) {
      const loop = (now) => {
        if (!this.isActive) {
          this.animFrameId = null;
          return;
        }
        const dt = Math.min(0.08, Math.max(0.001, (now - this.lastFrameTime) / 1000));
        this.lastFrameTime = now;
        this._update(dt);
        this._render(now);
        this.animFrameId = requestAnimationFrame(loop);
      };
      this.animFrameId = requestAnimationFrame(loop);
    }
  }

  deactivate() {
    this.isActive = false;
    this.isWalking = false;
    this.closeStorePopup();
    if (this.container) {
      this.container.classList.add('hidden');
    }
    document.body.classList.remove('has-pov-3d-active');
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  exit() {
    this.deactivate();
  }

  /**
   * 2B Çanta (CartSimulator) ilerlerken 3B Gözümden (POV) kamerasını birebir aynı konum ve yönde senkronize tutar
   */
  syncFromCart(segIndex, segProgress, curX, curY, floor) {
    if (!this.route || !this.route.pathNodes || this.route.pathNodes.length < 2) return;
    const nodes = this.route.pathNodes;
    this.segIndex = Math.max(0, Math.min(nodes.length - 2, segIndex));
    this.segProgress = Math.max(0, Math.min(1, segProgress));
    this.camX = curX;
    this.camY = curY;
    this.currentFloor = floor;

    const curU = nodes[this.segIndex];
    const curV = nodes[Math.min(nodes.length - 1, this.segIndex + 1)];
    if (curU && curV && curU.floor === curV.floor) {
      let lookX = curV.x;
      let lookY = curV.y;
      if (this.segIndex + 2 < nodes.length && nodes[this.segIndex + 2].floor === this.currentFloor && this.segProgress > 0.65) {
        const nextV = nodes[this.segIndex + 2];
        const blend = (this.segProgress - 0.65) / 0.35;
        lookX = curV.x + (nextV.x - curV.x) * blend * 0.45;
        lookY = curV.y + (nextV.y - curV.y) * blend * 0.45;
      }
      if (Math.hypot(lookX - this.camX, lookY - this.camY) > 1.5) {
        this.targetYaw = Math.atan2(lookY - this.camY, lookX - this.camX);
        this.camYaw = this.targetYaw;
      }
    }

    const totalSegs = Math.max(1, nodes.length - 1);
    this.totalProgressPct = Math.min(99, Math.round(((this.segIndex + this.segProgress) / totalSegs) * 100));
    this.remainingMeters = Math.max(1, Math.round((this.route.totalDistance || 50) * (1 - this.totalProgressPct / 100)));
    this._detectPassingStore(false);
    this._updateHUDTexts();
  }

  toggleWalk() {
    // Eğer aktif bir rota yoksa, "▶️ Otomatik Gez" koridor boyunca serbest adım atar!
    if (!this.route || !this.route.pathNodes || this.route.pathNodes.length < 2) {
      this.stepAlongCorridor(1);
      return;
    }
    if (this.totalProgressPct >= 100) {
      if (typeof window.completeAndResetRouteTo2D === 'function') {
        window.completeAndResetRouteTo2D(this.targetStore);
      } else {
        this.restartWalk();
      }
      return;
    }
    this.isWalking = !this.isWalking;
    this._syncPlayPauseButton();
  }

  restartWalk() {
    if (!this.route) return;
    if (window.arrivalResetTimer) {
      clearTimeout(window.arrivalResetTimer);
      window.arrivalResetTimer = null;
    }
    this.segIndex = 0;
    this.segProgress = 0;
    this.totalProgressPct = 0;
    this._lastSyncedSegIndex = 0;
    this.announcedPassingStores.clear();
    this.currentlyPassingStore = null;
    this.floorTransitionState = null;
    this.glideState = null;
    this.userYawOffset = 0;
    this.walkStepPhase = 0;
    const n0 = this.route.pathNodes[0];
    const n1 = this.route.pathNodes[1] || n0;
    this.currentFloor = n0.floor;
    this.camX = n0.x;
    this.camY = n0.y;
    this.camZ = 26;
    this.camYaw = Math.atan2(n1.y - n0.y, n1.x - n0.x);
    this.targetYaw = this.camYaw;
    this.isWalking = true;
    this._syncPlayPauseButton();
    if (window.cartSimulator && typeof window.cartSimulator.syncFromPov === 'function') {
      window.cartSimulator.syncFromPov(0, 0, n0.x, n0.y, n0.floor);
    }
    if (window.mallMap && window.mallMap.currentFloor !== n0.floor) {
      window.mallMap.loadFloor(n0.floor);
    }
    if (window.updateLiveNavHUD && document.body.classList.contains('has-active-route')) {
      window.updateLiveNavHUD(0, 0);
    }
  }

  _syncPlayPauseButton() {
    const btn = document.getElementById('btn-pov-play-pause');
    const badge = document.getElementById('pov-hud-mode-badge');
    if (badge) {
      if (this.route && this.targetStore) {
        badge.innerHTML = '<span>👁️</span><span>Gözümden 3B • Canlı Rota</span>';
      } else {
        badge.innerHTML = '<span>🧭</span><span>3B Sokak Görünümü • Serbest Gezinti</span>';
      }
    }
    if (!btn) return;
    if (!this.route || !this.route.pathNodes || this.route.pathNodes.length < 2) {
      btn.innerHTML = '<span>🚶</span><span>Koridorda İlerle</span>';
      return;
    }
    if (this.isWalking) {
      btn.innerHTML = '<span>⏸️</span><span>Duraklat</span>';
    } else if (this.totalProgressPct >= 100) {
      btn.innerHTML = '<span>✅</span><span>Varış Tamamlandı • 2B\'ye Dön</span>';
    } else {
      btn.innerHTML = '<span>▶️</span><span>Rotada Yürü</span>';
    }
  }

  _lerpAngle(a, b, t) {
    let diff = b - a;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return a + diff * Math.min(1, t);
  }

  _update(dt) {
    // Yürüyüş esnasında kullanıcının el ile çevirdiği bakış açısını yumuşakça ileri yöne geri topla
    if (this.isWalking && !this.isDragging && Math.abs(this.userYawOffset) > 0.005) {
      this.userYawOffset *= Math.pow(0.15, dt);
    }

    // Serbest Gezintide (veya duraklatıldığında) hedef bakış açısına yumuşak dönüş
    if (!this.isWalking) {
      this.camYaw = this._lerpAngle(this.camYaw, this.targetYaw, dt * 8.0);
    }

    // Kat geçişi animasyonu (3B Yürüyen Merdiven / Panoramik Asansör)
    if (this.floorTransitionState) {
      this.floorTransitionState.timer += dt * this.walkSpeed;
      const tNorm = Math.min(1, this.floorTransitionState.timer / Math.max(0.1, this.floorTransitionState.duration));
      const goingUp = this.floorTransitionState.toFloor > this.floorTransitionState.fromFloor;
      this.camZ = goingUp ? (26 + tNorm * 36) : (52 - tNorm * 28);

      if (this.floorTransitionState.timer >= this.floorTransitionState.duration) {
        const nextFloor = this.floorTransitionState.toFloor;
        this.currentFloor = nextFloor;
        this.floorTransitionState = null;
        this.camZ = 26;
        if (this.isWalking && this.route && this.route.pathNodes) {
          this.segIndex++;
          this.segProgress = 0;
          const nodes = this.route.pathNodes;
          if (this.segIndex < nodes.length) {
            this.camX = nodes[this.segIndex].x;
            this.camY = nodes[this.segIndex].y;
            if (this.segIndex + 1 < nodes.length) {
              const nxt = nodes[this.segIndex + 1];
              if (Math.hypot(nxt.x - this.camX, nxt.y - this.camY) > 1.5) {
                this.targetYaw = Math.atan2(nxt.y - this.camY, nxt.x - this.camX);
                this.camYaw = this.targetYaw;
              }
            }
          }
        }
        if (window.mallMap && window.mallMap.currentFloor !== nextFloor) {
          window.mallMap.loadFloor(nextFloor);
        }
      }
      return;
    }

    // Google Street View Tıklama / Adım Süzülme Animasyonu (glideState)
    if (this.glideState) {
      this.glideState.timer += dt;
      const p = Math.min(1, this.glideState.timer / Math.max(0.1, this.glideState.duration));
      const ease = 1 - Math.pow(1 - p, 3);
      this.camX = this.glideState.startX + (this.glideState.targetX - this.glideState.startX) * ease;
      this.camY = this.glideState.startY + (this.glideState.targetY - this.glideState.startY) * ease;
      this.walkStepPhase += dt * 9.0;
      this.camZ = 26 + Math.sin(this.walkStepPhase) * 0.45;
      if (p >= 1) {
        this.glideState = null;
        this.camZ = 26;
        this._detectPassingStore(false);
        this._updateHUDTexts();
      }
      return;
    }

    if (!this.isWalking || !this.route || !this.route.pathNodes || this.route.pathNodes.length < 2) {
      this.camZ = 26;
      return;
    }

    const nodes = this.route.pathNodes;
    if (this.segIndex >= nodes.length - 1) {
      // Hedefe varıldı!
      this.isWalking = false;
      this.totalProgressPct = 100;
      this.remainingMeters = 0;
      this.camZ = 26;
      if (this.targetStore) {
        this.currentlyPassingStore = this.targetStore;
        this.currentlyPassingSide = 'Tam Karşınızda';
      }
      this._syncPlayPauseButton();
      this._updateHUDTexts();
      if (window.updateLiveNavHUD) window.updateLiveNavHUD(-1, 100);
      return;
    }

    const u = nodes[this.segIndex];
    const v = nodes[this.segIndex + 1];

    // Kat değişimi düğümü mü?
    if (u.floor !== v.floor) {
      const isElev = v.edgeType === 'elevator' || v.portalKind === 'elevator';
      this.floorTransitionState = {
        fromFloor: u.floor,
        toFloor: v.floor,
        timer: 0,
        duration: 1.8,
        portalType: isElev ? 'elevator' : 'escalator'
      };
      const flLabel = this.mallData.floors[v.floor]?.label || `${v.floor}. Kat`;
      if (window.speakNavigationText) {
        window.speakNavigationText(`${isElev ? 'Asansör' : 'Yürüyen merdiven'} ile ${flLabel} katına ${v.floor > u.floor ? 'çıkılıyor' : 'iniliyor'}.`);
      }
      return;
    }

    // SESLİ KOMUT VE 2B ÇANTA İLE BİREBİR AYNI YÜRÜME HIZI SENKRONİZASYONU:
    const nowPerf = performance.now();
    const isMainSpeechSpeaking = nowPerf < (window.speechMainBusyUntil || 0);
    const isStoreSpeechSpeaking = nowPerf < (window.speechBusyUntil || 0);
    const speechSyncFactor = isMainSpeechSpeaking ? 0.56 : (isStoreSpeechSpeaking ? 0.72 : 1.0);

    const segLen = Math.max(1, Math.hypot(v.x - u.x, v.y - u.y));
    const baseSpeedUnitsPerSec = 32 * this.walkSpeed * speechSyncFactor;
    this.segProgress += (baseSpeedUnitsPerSec * dt) / segLen;

    // Köşede yeni bir sesli dönüş talimatı varsa ve mevcut cümle henüz bitmediyse, cümlenin yarıda kesilmemesi için köşe başında (0.96) bekle
    const nextNodeHasInstruction = this.route.instructions && this.route.instructions.some(ins => ins.nodeIndex === this.segIndex + 1);
    if (this.segProgress >= 0.96 && nextNodeHasInstruction && isMainSpeechSpeaking) {
      this.segProgress = 0.96;
    }

    // Doğal insan yürüyüşü kafa salınımı (Head-Bob)
    this.walkStepPhase += dt * 6.5 * this.walkSpeed * speechSyncFactor;
    this.camZ = 26 + Math.sin(this.walkStepPhase) * 0.50;

    while (this.segProgress >= 1.0 && this.segIndex < nodes.length - 1) {
      this.segProgress -= 1.0;
      this.segIndex++;
      if (this.segIndex >= nodes.length - 1) {
        this.segProgress = 0;
        const lastNode = nodes[nodes.length - 1];
        this.camX = lastNode.x;
        this.camY = lastNode.y;
        this.camZ = 26;
        // Hedef mağazanın içine/cephesine doğru dön
        if (this.targetStore && this.targetStore.cx !== undefined) {
          this.targetYaw = Math.atan2(this.targetStore.cy - this.camY, this.targetStore.cx - this.camX);
        }
        if (this.targetStore) {
          this.currentlyPassingStore = this.targetStore;
          this.currentlyPassingSide = 'Tam Karşınızda';
        }
        this.isWalking = false;
        this.totalProgressPct = 100;
        this.remainingMeters = 0;
        if (window.cartSimulator && typeof window.cartSimulator.syncFromPov === 'function') {
          window.cartSimulator.syncFromPov(nodes.length - 1, 0, this.camX, this.camY, this.currentFloor);
        }
        const hudBar = document.getElementById('hud-progress-bar');
        const hudPct = document.getElementById('hud-progress-text');
        if (hudBar) hudBar.style.width = '100%';
        if (hudPct) hudPct.textContent = '100%';
        this._syncPlayPauseButton();
        this._updateHUDTexts();
        if (window.updateLiveNavHUD) window.updateLiveNavHUD(-1, 100);
        const qrModal = document.getElementById('route-qr-modal');
        const isQrOpen = qrModal && !qrModal.classList.contains('hidden');
        if (window.showToast && !isQrOpen) {
          window.showToast(`🎉 ${this.targetStore ? this.targetStore.name : 'Hedef'} mağazasına ulaştınız! Rota sıfırlanıyor ve 2B haritaya dönülüyor...`, 'success');
        }
        const reached = this.targetStore;
        if (window.arrivalResetTimer) clearTimeout(window.arrivalResetTimer);
        window.arrivalResetTimer = setTimeout(() => {
          if (typeof window.completeAndResetRouteTo2D === 'function') {
            window.completeAndResetRouteTo2D(reached);
          }
        }, 1600);
        return;
      }
      const nu = nodes[this.segIndex];
      const nv = nodes[this.segIndex + 1];
      if (nu.floor !== nv.floor) {
        this.segProgress = 0;
        break;
      }
    }

    const curU = nodes[this.segIndex];
    const curV = nodes[Math.min(nodes.length - 1, this.segIndex + 1)];
    if (curU && curV && curU.floor === curV.floor) {
      this.camX = curU.x + (curV.x - curU.x) * this.segProgress;
      this.camY = curU.y + (curV.y - curU.y) * this.segProgress;

      // Köşeye yaklaşırken bir sonraki segmente doğru bakış açısını önceden yumuşakça döndür (Doğal İnsan Bakışı)
      let lookX = curV.x;
      let lookY = curV.y;
      if (this.segIndex + 2 < nodes.length && nodes[this.segIndex + 2].floor === this.currentFloor && this.segProgress > 0.65) {
        const nextV = nodes[this.segIndex + 2];
        const blend = (this.segProgress - 0.65) / 0.35;
        lookX = curV.x + (nextV.x - curV.x) * blend * 0.45;
        lookY = curV.y + (nextV.y - curV.y) * blend * 0.45;
      }
      if (Math.hypot(lookX - this.camX, lookY - this.camY) > 1.5) {
        this.targetYaw = Math.atan2(lookY - this.camY, lookX - this.camX);
      }
    }

    this.camYaw = this._lerpAngle(this.camYaw, this.targetYaw, dt * 6.5);

    // 2B Çanta Simülatörünü arka planda birebir aynı koordinat ve segmentte tut
    if (window.cartSimulator && typeof window.cartSimulator.syncFromPov === 'function') {
      window.cartSimulator.syncFromPov(this.segIndex, this.segProgress, this.camX, this.camY, this.currentFloor);
    }

    // İlerleme yüzdesi ve kalan mesafe
    const totalSegs = Math.max(1, nodes.length - 1);
    this.totalProgressPct = Math.min(99, Math.round(((this.segIndex + this.segProgress) / totalSegs) * 100));
    this.remainingMeters = Math.max(1, Math.round((this.route.totalDistance || 50) * (1 - this.totalProgressPct / 100)));

    const hudBar = document.getElementById('hud-progress-bar');
    const hudPct = document.getElementById('hud-progress-text');
    if (hudBar) hudBar.style.width = `${this.totalProgressPct}%`;
    if (hudPct) hudPct.textContent = `${this.totalProgressPct}%`;

    // Şu an yanından geçilen mağazayı tespit et (Aktif rota yürüyüşünde ana sesli komutu bölmemek için allowSpeak=false)
    this._detectPassingStore(false);

    // Üst HUD ve Ana Harita HUD senkronu (Yalnızca düğüm değiştiğinde ve rota aktifken)
    this._updateHUDTexts();
    if (window.updateLiveNavHUD && document.body.classList.contains('has-active-route') && this._lastSyncedSegIndex !== this.segIndex) {
      this._lastSyncedSegIndex = this.segIndex;
      window.updateLiveNavHUD(this.segIndex, this.totalProgressPct);
    }
  }

  _detectPassingStore(allowSpeak = false) {
    // Hedefe ulaşıldığında veya son birkaç metrede doğrudan hedef mağazayı göster (komşu mağaza karışıklığını önle)
    if (this.targetStore && this.totalProgressPct >= 95) {
      this.currentlyPassingStore = this.targetStore;
      this.currentlyPassingSide = 'Tam Karşınızda';
      return;
    }

    const floorStores = this.mallData?.floors[this.currentFloor]?.stores || [];
    const enRouteIds = new Set(this.route?.enRouteStoreIds || []);
    let closest = null;
    let bestScore = 72;
    let closestSide = 'Yanınızda';
    let closestForwardProj = 0;

    const cosYaw = Math.cos(this.camYaw);
    const sinYaw = Math.sin(this.camYaw);

    for (const s of floorStores) {
      if (this.startStore && s.id === this.startStore.id) continue;
      if (this.targetStore && s.id === this.targetStore.id) continue;
      const sx = s.door_x ?? s.cx;
      const sy = s.door_y ?? s.cy;
      const dx = sx - this.camX;
      const dy = sy - this.camY;
      const d = Math.hypot(dx, dy);
      if (d < 76) {
        const forwardProj = dx * cosYaw + dy * sinYaw;
        const rightProj = -dx * sinYaw + dy * cosYaw;
        if (forwardProj > -14 && forwardProj < 68) {
          const area = (s.w || 60) * (s.h || 60);
          const isEnRoute = enRouteIds.has(s.id);
          // Rota listesindeki (enRouteStoreIds) mağazalara öncelik vererek sesli komut sırasıyla %100 uyum sağla
          const score = isEnRoute ? d * 0.42 : (area >= 4500 ? d * 0.65 : d * 1.25);
          if (score < bestScore) {
            bestScore = score;
            closest = s;
            closestSide = rightProj < 0 ? 'Solunuzda' : 'Sağınızda';
            closestForwardProj = forwardProj;
          }
        }
      }
    }

    if (closest) {
      this.currentlyPassingStore = closest;
      this.currentlyPassingSide = closestSide;
      const mainSpeaking = performance.now() < (window.speechMainBusyUntil || 0);
      if (allowSpeak && !this.route && !this.announcedPassingStores.has(closest.id) && Math.abs(closestForwardProj) <= 26 && !mainSpeaking) {
        this.announcedPassingStores.add(closest.id);
        if (window.isVoiceEnabled && window.speakNavigationText) {
          window.speakNavigationText(`${closestSide} ${closest.name}`, false, true);
        }
      }
    } else {
      this.currentlyPassingStore = null;
    }
  }

  _getCorridorZoneName(wx = this.camX, wy = this.camY) {
    if (wx < 460) return 'Batı Galeri Bulvarı';
    if (wx > 940) return 'Doğu Galeri Bulvarı';
    if (Math.abs(wx - 700) < 130 && Math.abs(wy - 425) < 75) return 'Merkez Atrium Meydanı';
    if (wy < 425) return 'Kuzey Koridor Aksı';
    return 'Güney Koridor Aksı';
  }

  _updateHUDTexts() {
    const titleEl = document.getElementById('pov-hud-title');
    const stepEl = document.getElementById('pov-hud-step');
    const modeBadgeEl = document.getElementById('pov-hud-mode-badge');
    const passingBadge = document.getElementById('pov-hud-passing');
    const passingLogoEl = document.getElementById('pov-hud-passing-logo');
    const passingText = document.getElementById('pov-hud-passing-text');
    const distEl = document.getElementById('pov-hud-distance');
    const progressFill = document.getElementById('pov-hud-progress-fill');

    const floorLabel = this.mallData?.floors[this.currentFloor]?.label || 'Zemin Kat';
    const zoneName = this._getCorridorZoneName(this.camX, this.camY);

    if (this.route && this.targetStore) {
      if (modeBadgeEl) {
        modeBadgeEl.textContent = '🧭 CANLI 3B ROTA REHBERİ';
      }
      if (titleEl) {
        titleEl.textContent = `👁️ ${this.startStore ? this.startStore.name.replace(/^📍\s*/, '') : 'Başlangıç'} ➔ ${this.targetStore.name} (${floorLabel})`;
      }
      if (distEl) {
        distEl.textContent = this.totalProgressPct >= 100 ? '🎉 Vardınız!' : `${this.remainingMeters} m kaldı`;
      }
      if (progressFill) {
        progressFill.style.width = `${this.totalProgressPct}%`;
      }

      // Mevcut manevra metni
      if (stepEl && this.route.instructions && this.route.instructions.length > 0) {
        if (this.totalProgressPct >= 100) {
          stepEl.textContent = `🎉 Hedefe Ulaştınız! ${this.targetStore.name} tam karşınızda.`;
        } else {
          let activeIns = this.route.instructions[0];
          for (const ins of this.route.instructions) {
            if (ins.nodeIndex !== undefined && this.segIndex >= ins.nodeIndex) {
              activeIns = ins;
            }
          }
          stepEl.textContent = `${activeIns.emoji || '⬆️'} ${activeIns.text}`;
        }
      }
    } else {
      if (modeBadgeEl) {
        modeBadgeEl.textContent = '🌐 360° SOKAK GÖRÜNÜMÜ • SERBEST GEZİNTİ';
      }
      if (titleEl) {
        if (this.startStore) {
          titleEl.textContent = `🌐 ${floorLabel} • ${this.startStore.name.replace(/^📍\s*/, '')} Önü`;
        } else {
          titleEl.textContent = `🌐 ${floorLabel} • ${zoneName}`;
        }
      }
      if (stepEl) {
        stepEl.textContent = '👆 Koridordaki mavi halkalara dokunarak ilerleyin, mağaza vitrinlerine tıklayarak inceleyin veya hedef seçin.';
      }
      if (distEl) distEl.textContent = `${floorLabel} • 360°`;
      if (progressFill) progressFill.style.width = '100%';
    }

    if (passingBadge && passingText) {
      if (this.route && this.totalProgressPct >= 95 && this.targetStore) {
        const s = this.targetStore;
        if (passingLogoEl && typeof window.getStoreLogo === 'function') {
          passingLogoEl.innerHTML = window.getStoreLogo(s, 18);
          passingLogoEl.classList.remove('hidden');
        }
        const unitStr = s.unit ? ` (${s.unit})` : '';
        passingText.textContent = `🎯 Hedefiniz Tam Karşınızda: ${s.name}${unitStr}`;
        passingBadge.classList.remove('hidden');
      } else if (this.currentlyPassingStore) {
        const s = this.currentlyPassingStore;
        if (passingLogoEl && typeof window.getStoreLogo === 'function') {
          passingLogoEl.innerHTML = window.getStoreLogo(s, 18);
          passingLogoEl.classList.remove('hidden');
        }
        const unitStr = s.unit ? ` (${s.unit})` : '';
        passingText.textContent = `👀 ${this.currentlyPassingSide || 'Yanınızda'}: ${s.name}${unitStr} (Vitrine tıkla ➔ Rota)`;
        passingBadge.classList.remove('hidden');
      } else if (this.route && this.route.enRouteStoreNames && this.route.enRouteStoreNames.length > 0) {
        const floorStores = this.mallData?.floors[this.currentFloor]?.stores || [];
        const firstEnRouteStore = floorStores.find(st => st.name === this.route.enRouteStoreNames[0]) || this.targetStore;
        if (passingLogoEl && firstEnRouteStore && typeof window.getStoreLogo === 'function') {
          passingLogoEl.innerHTML = window.getStoreLogo(firstEnRouteStore, 18);
          passingLogoEl.classList.remove('hidden');
        }
        passingText.textContent = `👀 Rota Üzerindeki Mağazalar: ${this.route.enRouteStoreNames.slice(0, 4).join(' ➔ ')}`;
        passingBadge.classList.remove('hidden');
      } else {
        passingBadge.classList.add('hidden');
      }
    }
  }

  /**
   * 3B Noktayı (wx, wy, wz) Kamera Koordinatlarına Dönüştürür
   * rx: İleri derinlik, ry: Sağ (+)/Sol (-), rz: Yukarı (+)/Aşağı (-)
   */
  _worldToCamera(wx, wy, wz, cosYaw, sinYaw) {
    const dx = wx - this.camX;
    const dy = wy - this.camY;
    const dz = wz - this.camZ;
    const rx = dx * cosYaw + dy * sinYaw;
    const ry = -dx * sinYaw + dy * cosYaw;
    const rz = dz;
    return { rx, ry, rz };
  }

  /**
   * 3B Çokgeni (Quad/Polygon) Kamera Yakın Düzlemine (rx >= nearPlane) Göre Kırpar
   */
  _clipPolygonNear(camVerts, nearPlane = 6.0) {
    const out = [];
    const n = camVerts.length;
    for (let i = 0; i < n; i++) {
      const cur = camVerts[i];
      const prev = camVerts[(i + n - 1) % n];
      const curInside = cur.rx >= nearPlane;
      const prevInside = prev.rx >= nearPlane;

      if (curInside !== prevInside) {
        const t = (nearPlane - prev.rx) / (cur.rx - prev.rx);
        out.push({
          rx: nearPlane,
          ry: prev.ry + t * (cur.ry - prev.ry),
          rz: prev.rz + t * (cur.rz - prev.rz)
        });
      }
      if (curInside) {
        out.push(cur);
      }
    }
    return out;
  }

  /**
   * Kırpılmış kamera koordinatlarını 2B Ekran piksellerine izdüşürür
   */
  _projectCamVerts(clippedVerts, cx, horizonY, fovScale) {
    return clippedVerts.map(v => ({
      x: cx + (v.ry / v.rx) * fovScale,
      y: horizonY - (v.rz / v.rx) * fovScale,
      rx: v.rx
    }));
  }

  _getCategoryColors(category) {
    const map = {
      fashion: { wall: '#fdf2f8', glass: 'rgba(253, 242, 248, 0.88)', fascia: '#be185d', border: '#f472b6', text: '#ffffff' },
      shoes: { wall: '#fffbeb', glass: 'rgba(255, 251, 235, 0.88)', fascia: '#b45309', border: '#fbbf24', text: '#ffffff' },
      sports: { wall: '#f0fdf4', glass: 'rgba(240, 253, 244, 0.88)', fascia: '#047857', border: '#34d399', text: '#ffffff' },
      tech: { wall: '#eef2ff', glass: 'rgba(238, 242, 255, 0.88)', fascia: '#3730a3', border: '#818cf8', text: '#ffffff' },
      cosmetics: { wall: '#fdf2f8', glass: 'rgba(253, 242, 248, 0.88)', fascia: '#9d174d', border: '#f472b6', text: '#ffffff' },
      food: { wall: '#fff7ed', glass: 'rgba(255, 247, 237, 0.88)', fascia: '#c2410c', border: '#fb923c', text: '#ffffff' },
      home: { wall: '#f5f3ff', glass: 'rgba(245, 243, 255, 0.88)', fascia: '#5b21b6', border: '#a78bfa', text: '#ffffff' },
      entertainment: { wall: '#faf5ff', glass: 'rgba(250, 245, 255, 0.88)', fascia: '#6b21a8', border: '#c084fc', text: '#ffffff' },
      service: { wall: '#f0fdfa', glass: 'rgba(240, 253, 250, 0.88)', fascia: '#0f766e', border: '#2dd4bf', text: '#ffffff' }
    };
    return map[category] || { wall: '#f8fafc', glass: 'rgba(248, 250, 252, 0.88)', fascia: '#1e293b', border: '#94a3b8', text: '#ffffff' };
  }

  _resolveAmenitySignY(bx, by, tw, th) {
    if (!this.placedAmenitySignRects) this.placedAmenitySignRects = [];
    let curY = by;
    for (let attempt = 0; attempt < 6; attempt++) {
      let overlapped = false;
      for (const r of this.placedAmenitySignRects) {
        const horizOverlap = !(bx + tw + 6 < r.x || bx - 6 > r.x + r.w);
        const vertOverlap = !(curY + th + 4 < r.y || curY - 4 > r.y + r.h);
        if (horizOverlap && vertOverlap) {
          curY = r.y - th - 5;
          overlapped = true;
          break;
        }
      }
      if (!overlapped) break;
    }
    curY = Math.max(58, curY);
    this.placedAmenitySignRects.push({ x: bx, y: curY, w: tw, h: th });
    return curY;
  }

  _render(now) {
    if (!this.ctx || !this.canvas) return;
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const cx = W * 0.5;
    const horizonY = H * 0.49;
    const fovScale = W * 0.56;

    const effectiveYaw = this.camYaw + this.userYawOffset;
    const cosYaw = Math.cos(effectiveYaw);
    const sinYaw = Math.sin(effectiveYaw);

    this.logosRenderedLastFrame = 0;
    this.storeHitBoxes = [];
    this.hotspotHitBoxes = [];
    this.portalHitBoxes = [];
    this.placedAmenitySignRects = [];
    ctx.clearRect(0, 0, W, H);

    // 1. GERÇEK CAPACITY AVM MİMARİ BEJ/KREM ALÇIPAN TAVAN & GÖMME ANTRASİT BAFFLE LED KANALLARI (0 .. horizonY)
    const ceilGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
    ceilGrad.addColorStop(0, '#f5efe4');
    ceilGrad.addColorStop(0.42, '#ede3d2');
    ceilGrad.addColorStop(0.78, '#e2d4be');
    ceilGrad.addColorStop(1, '#d2c0a5');
    ctx.fillStyle = ceilGrad;
    ctx.fillRect(0, 0, W, horizonY + 2);

    // Tavan sıcak günışığı / LED homojen aydınlatma ışıltısı
    const skyGlow = ctx.createRadialGradient(cx, horizonY * 0.30, 10, cx, horizonY * 0.40, W * 0.65);
    skyGlow.addColorStop(0, 'rgba(255, 251, 235, 0.55)');
    skyGlow.addColorStop(0.55, 'rgba(254, 243, 199, 0.25)');
    skyGlow.addColorStop(1, 'rgba(214, 196, 172, 0)');
    ctx.fillStyle = skyGlow;
    ctx.fillRect(0, 0, W, horizonY);

    // 2. GERÇEK CAPACITY AVM KREM & KARAMEL ŞERİTLİ CILALI TRAVERTEN MERMER ZEMİN (horizonY .. H)
    const floorGrad = ctx.createLinearGradient(0, horizonY, 0, H);
    floorGrad.addColorStop(0, '#cdb89d');
    floorGrad.addColorStop(0.20, '#dfd0ba');
    floorGrad.addColorStop(0.58, '#eee4d5');
    floorGrad.addColorStop(1, '#f7f2ea');
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, horizonY, W, H - horizonY);

    // Mermer zemin üzerinde sıcak mağaza & tavan LED yansıması
    const floorReflect = ctx.createLinearGradient(cx - W * 0.32, horizonY, cx + W * 0.32, horizonY);
    floorReflect.addColorStop(0, 'rgba(255, 251, 235, 0)');
    floorReflect.addColorStop(0.5, 'rgba(255, 251, 235, 0.38)');
    floorReflect.addColorStop(1, 'rgba(255, 251, 235, 0)');
    ctx.fillStyle = floorReflect;
    ctx.fillRect(0, horizonY, W, H - horizonY);

    // 3. 3B PERSPEKTİF TRAVERTEN MERMER KARO DERZLERİ, KARAMEL ZEMİN ŞERİTLERİ VE ANTRASİT GÖMME TAVAN BAFFLE LED PANELLERİ
    ctx.save();
    ctx.strokeStyle = 'rgba(140, 108, 76, 0.22)';
    ctx.lineWidth = Math.max(1, W / 900);
    const gridStep = 65;
    const minGX = Math.floor((this.camX - 650) / gridStep) * gridStep;
    const maxGX = Math.ceil((this.camX + 650) / gridStep) * gridStep;
    const minGY = Math.floor((this.camY - 650) / gridStep) * gridStep;
    const maxGY = Math.ceil((this.camY + 650) / gridStep) * gridStep;

    for (let gx = minGX; gx <= maxGX; gx += gridStep) {
      // Zemin traverten mermer derzleri
      const c1 = this._worldToCamera(gx, minGY, 0, cosYaw, sinYaw);
      const c2 = this._worldToCamera(gx, maxGY, 0, cosYaw, sinYaw);
      const clipped = this._clipPolygonNear([c1, c2], 6);
      if (clipped.length === 2) {
        const p = this._projectCamVerts(clipped, cx, horizonY, fovScale);
        ctx.beginPath();
        ctx.moveTo(p[0].x, p[0].y);
        ctx.lineTo(p[1].x, p[1].y);
        ctx.stroke();
      }

      // Alçıpan tavan akustik derz çizgileri (wz = 68)
      const t1 = this._worldToCamera(gx, minGY, 68, cosYaw, sinYaw);
      const t2 = this._worldToCamera(gx, maxGY, 68, cosYaw, sinYaw);
      const clippedT = this._clipPolygonNear([t1, t2], 8);
      if (clippedT.length === 2) {
        const pt = this._projectCamVerts(clippedT, cx, horizonY, fovScale);
        ctx.save();
        ctx.strokeStyle = 'rgba(180, 160, 135, 0.28)';
        ctx.lineWidth = Math.max(1, W / 900);
        ctx.beginPath();
        ctx.moveTo(pt[0].x, pt[0].y);
        ctx.lineTo(pt[1].x, pt[1].y);
        ctx.stroke();
        ctx.restore();
      }
    }

    for (let gy = minGY; gy <= maxGY; gy += gridStep) {
      const c1 = this._worldToCamera(minGX, gy, 0, cosYaw, sinYaw);
      const c2 = this._worldToCamera(maxGX, gy, 0, cosYaw, sinYaw);
      const clipped = this._clipPolygonNear([c1, c2], 6);
      if (clipped.length === 2) {
        const p = this._projectCamVerts(clipped, cx, horizonY, fovScale);
        ctx.beginPath();
        ctx.moveTo(p[0].x, p[0].y);
        ctx.lineTo(p[1].x, p[1].y);
        ctx.stroke();
      }
    }

    // Capacity AVM Gerçek Fotoğrafındaki (`media_1791722602735.jpg`) Gömme Koyu Antrasit Izgaralı Tavan Kanalı + Lineer Beyaz LED Bantları
    const corridorAxesY = [325, 388, 462, 526];
    for (const corrY of corridorAxesY) {
      // Zemin karamel-kahve mermer bordür şeridi
      const b1 = this._worldToCamera(140, corrY, 0.2, cosYaw, sinYaw);
      const b2 = this._worldToCamera(1260, corrY, 0.2, cosYaw, sinYaw);
      const bClip = this._clipPolygonNear([b1, b2], 6);
      if (bClip.length === 2) {
        const pb = this._projectCamVerts(bClip, cx, horizonY, fovScale);
        ctx.save();
        ctx.strokeStyle = 'rgba(154, 104, 62, 0.34)';
        ctx.lineWidth = Math.max(2.5, W / 420);
        ctx.beginPath();
        ctx.moveTo(pb[0].x, pb[0].y);
        ctx.lineTo(pb[1].x, pb[1].y);
        ctx.stroke();
        ctx.restore();
      }

      // Tavan gömme koyu antrasit baffle kanalı (wz = 67.5, genişlik 16 birim)
      const chA1 = this._worldToCamera(140, corrY - 8, 67.5, cosYaw, sinYaw);
      const chA2 = this._worldToCamera(1260, corrY - 8, 67.5, cosYaw, sinYaw);
      const chB2 = this._worldToCamera(1260, corrY + 8, 67.5, cosYaw, sinYaw);
      const chB1 = this._worldToCamera(140, corrY + 8, 67.5, cosYaw, sinYaw);
      const chClip = this._clipPolygonNear([chA1, chA2, chB2, chB1], 8);
      if (chClip.length >= 3) {
        const pch = this._projectCamVerts(chClip, cx, horizonY, fovScale);
        ctx.save();
        ctx.fillStyle = '#27272a';
        ctx.strokeStyle = '#a89984';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(pch[0].x, pch[0].y);
        for (let k = 1; k < pch.length; k++) ctx.lineTo(pch[k].x, pch[k].y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      // Gömme kanal içindeki parlak beyaz lineer LED armatür şeritleri (wz = 67.0)
      const l1 = this._worldToCamera(140, corrY, 67.0, cosYaw, sinYaw);
      const l2 = this._worldToCamera(1260, corrY, 67.0, cosYaw, sinYaw);
      const lClip = this._clipPolygonNear([l1, l2], 8);
      if (lClip.length === 2) {
        const pl = this._projectCamVerts(lClip, cx, horizonY, fovScale);
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
        ctx.lineWidth = Math.max(2.2, W / 480);
        ctx.beginPath();
        ctx.moveTo(pl[0].x, pl[0].y);
        ctx.lineTo(pl[1].x, pl[1].y);
        ctx.stroke();
        ctx.restore();
      }
    }

    // Dikey (Kuzey-Güney) yan koridorlar için gömme antrasit tavan kanalı & lineer LED (x = 420, 600, 800, 980)
    for (const corrX of [420, 600, 800, 980]) {
      const chA1 = this._worldToCamera(corrX - 7, 160, 67.5, cosYaw, sinYaw);
      const chA2 = this._worldToCamera(corrX - 7, 700, 67.5, cosYaw, sinYaw);
      const chB2 = this._worldToCamera(corrX + 7, 700, 67.5, cosYaw, sinYaw);
      const chB1 = this._worldToCamera(corrX + 7, 160, 67.5, cosYaw, sinYaw);
      const chClip = this._clipPolygonNear([chA1, chA2, chB2, chB1], 8);
      if (chClip.length >= 3) {
        const pch = this._projectCamVerts(chClip, cx, horizonY, fovScale);
        ctx.save();
        ctx.fillStyle = '#27272a';
        ctx.beginPath();
        ctx.moveTo(pch[0].x, pch[0].y);
        for (let k = 1; k < pch.length; k++) ctx.lineTo(pch[k].x, pch[k].y);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      const l1 = this._worldToCamera(corrX, 160, 67.0, cosYaw, sinYaw);
      const l2 = this._worldToCamera(corrX, 700, 67.0, cosYaw, sinYaw);
      const lClip = this._clipPolygonNear([l1, l2], 8);
      if (lClip.length === 2) {
        const pl = this._projectCamVerts(lClip, cx, horizonY, fovScale);
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.90)';
        ctx.lineWidth = Math.max(2.0, W / 520);
        ctx.beginPath();
        ctx.moveTo(pl[0].x, pl[0].y);
        ctx.lineTo(pl[1].x, pl[1].y);
        ctx.stroke();
        ctx.restore();
      }
    }

    // Alçıpan Tavan Gömme Kare Mimari Downlight Spotları (wz = 68)
    for (let gx = minGX; gx <= maxGX; gx += gridStep) {
      for (let gy = minGY; gy <= maxGY; gy += gridStep) {
        const cSpot = this._worldToCamera(gx, gy, 68, cosYaw, sinYaw);
        if (cSpot.rx > 15 && cSpot.rx < 520 && Math.abs(cSpot.ry) < cSpot.rx * 1.1) {
          const sx = cx + (cSpot.ry / cSpot.rx) * fovScale;
          const sy = horizonY - (cSpot.rz / cSpot.rx) * fovScale;
          const rad = Math.max(2.0, (540 / cSpot.rx) * (W / 1150));
          ctx.fillStyle = 'rgba(254, 243, 199, 0.45)';
          ctx.fillRect(sx - rad * 1.8, sy - rad * 1.1, rad * 3.6, rad * 2.2);
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = '#78716c';
          ctx.lineWidth = 0.8;
          ctx.fillRect(sx - rad * 1.1, sy - rad * 0.65, rad * 2.2, rad * 1.3);
          ctx.strokeRect(sx - rad * 1.1, sy - rad * 0.65, rad * 2.2, rad * 1.3);
        }
      }
    }
    ctx.restore();

    // 4A. YERDEKİ 3B PARLAYAN NAVİGASYON HALISI VE HAREKETLİ OKLAR (AR FLOOR PATH)
    if (this.route && this.route.pathNodes && this.route.pathNodes.length > 1) {
      this._render3DFloorRoute(ctx, cx, horizonY, fovScale, cosYaw, sinYaw, now, W);
    }

    // 4B. GOOGLE MAPS STREET VIEW 3B ZEMİN GEZİNTİ HALKALARI & CANLI ZEMİN İMLECİ (SERBEST GEZİNTİ & ADIM NOKTALARI)
    this._renderStreetViewHotspots(ctx, cx, horizonY, fovScale, cosYaw, sinYaw, now, W, H, effectiveYaw);

    // 5. ZEMİN KAT MÜZİKLİ GÖSTERİ HAVUZU (3B Animasyonlu Fıskiyeli Havuz)
    if (this.currentFloor === 4) {
      this._render3DFountainPool(ctx, cx, horizonY, fovScale, cosYaw, sinYaw, now, W);
    }

    // 6. 3B MAĞAZA CEPHELERİ, VİTRİN CAMLARI, KURUMSAL MARKA LOGOLARI VE IŞIKLI TABELALAR
    this._render3DStorefronts(ctx, cx, horizonY, fovScale, cosYaw, sinYaw, now, W, H);

    // 7. 3B YÜRÜYEN MERDİVENLER, PANORAMİK ASANSÖRLER, PEYZAJ SAKSILARI VE SERVİS TOTEMLERİ
    this._render3DAmenitiesAndDecor(ctx, cx, horizonY, fovScale, cosYaw, sinYaw, now, W);

    // 8. KAT GEÇİŞİ (3B YÜRÜYEN MERDİVEN / PANORAMİK ASANSÖR SÜRÜŞÜ) EFEKTİ
    if (this.floorTransitionState) {
      this._renderFloorTransitionOverlay(ctx, W, H, now);
    }

    // 9. SAĞ ALT KÖŞE CANLI 2B RADAR MİNİ-HARİTA (Kullanıcının Konumu, Servisler, Tıkla & Işınlan)
    this._renderMiniRadar(ctx, W, H, effectiveYaw);

    // 10. ÜST ORTA 360° DİJİTAL PUSULA & GALERİ SOKAK GÖRÜNÜMÜ BAŞLIĞI
    this._renderTopCompassBar(ctx, W, H, effectiveYaw);
  }

  _render3DFloorRoute(ctx, cx, horizonY, fovScale, cosYaw, sinYaw, now, W) {
    const nodes = this.route.pathNodes;
    const ribbonHalfWidth = 9.0;

    ctx.save();
    for (let i = 0; i < nodes.length - 1; i++) {
      const u = nodes[i];
      const v = nodes[i + 1];
      if (u.floor !== this.currentFloor || v.floor !== this.currentFloor) continue;

      const dx = v.x - u.x;
      const dy = v.y - u.y;
      const len = Math.hypot(dx, dy);
      if (len < 1) continue;

      // Normal vektörü (şerit genişliği)
      const nx = (-dy / len) * ribbonHalfWidth;
      const ny = (dx / len) * ribbonHalfWidth;

      const quadWorld = [
        { x: u.x + nx, y: u.y + ny, z: 0.6 },
        { x: u.x - nx, y: u.y - ny, z: 0.6 },
        { x: v.x - nx, y: v.y - ny, z: 0.6 },
        { x: v.x + nx, y: v.y + ny, z: 0.6 }
      ];

      const camVerts = quadWorld.map(p => this._worldToCamera(p.x, p.y, p.z, cosYaw, sinYaw));
      const clipped = this._clipPolygonNear(camVerts, 5.5);
      if (clipped.length >= 3) {
        const scr = this._projectCamVerts(clipped, cx, horizonY, fovScale);
        ctx.fillStyle = i < this.segIndex ? 'rgba(148, 163, 184, 0.35)' : 'rgba(37, 99, 235, 0.80)';
        ctx.strokeStyle = i < this.segIndex ? 'rgba(255, 255, 255, 0.3)' : 'rgba(103, 232, 249, 0.95)';
        ctx.lineWidth = Math.max(1.5, W / 650);
        ctx.beginPath();
        ctx.moveTo(scr[0].x, scr[0].y);
        for (let k = 1; k < scr.length; k++) ctx.lineTo(scr[k].x, scr[k].y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      // Şerit Üzerinde Akan 3B Beyaz/Camgöbeği Yön Okları (Chevrons)
      if (i >= this.segIndex) {
        const stepSpacing = 22;
        const animOffset = ((now * 0.045) % stepSpacing);
        for (let d = animOffset; d < len; d += stepSpacing) {
          const cxPos = u.x + (dx / len) * d;
          const cyPos = u.y + (dy / len) * d;
          const tipX = cxPos + (dx / len) * 7;
          const tipY = cyPos + (dy / len) * 7;
          const tailX = cxPos - (dx / len) * 4;
          const tailY = cyPos - (dy / len) * 4;

          const chevWorld = [
            { x: tailX + nx * 0.65, y: tailY + ny * 0.65, z: 0.9 },
            { x: tipX, y: tipY, z: 0.9 },
            { x: tailX - nx * 0.65, y: tailY - ny * 0.65, z: 0.9 }
          ];
          const cChev = chevWorld.map(p => this._worldToCamera(p.x, p.y, p.z, cosYaw, sinYaw));
          if (cChev.every(c => c.rx >= 6.5 && c.rx < 450)) {
            const pChev = this._projectCamVerts(cChev, cx, horizonY, fovScale);
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = Math.max(2, (320 / cChev[1].rx) * (W / 900));
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(pChev[0].x, pChev[0].y);
            ctx.lineTo(pChev[1].x, pChev[1].y);
            ctx.lineTo(pChev[2].x, pChev[2].y);
            ctx.stroke();
          }
        }
      }
    }
    ctx.restore();
  }

  /**
   * Google Maps Street View Tarzı 3B Perspektif Zemin Gezinti Halkaları (Hotspots) ve Canlı 3B Zemin İmleci
   */
  _renderStreetViewHotspots(ctx, cx, horizonY, fovScale, cosYaw, sinYaw, now, W, H, effectiveYaw) {
    if (this.floorTransitionState) return;

    // Otomatik yürüyüş aktifken yalnızca hafif zemin halkaları göster, serbest gezintide veya duraklatıldığında tam interaktif göster
    const isActivelyAutoWalking = this.isWalking && this.route;
    const candidatePts = [];

    // 1. Graf üzerindeki koridor düğümleri
    const graphNodes = this.mallData?.graph?.nodes || {};
    const nodeEntries = Array.isArray(graphNodes) ? graphNodes.map(n => [n.id, n]) : Object.entries(graphNodes);
    for (const [id, n] of nodeEntries) {
      if (n && n.floor === this.currentFloor && String(id || n.id).startsWith('c_')) {
        candidatePts.push({ x: n.x, y: n.y });
      }
    }

    // 2. Ana galeri bulvarı ve ara koridorlar boyunca düzenli Street View adım noktaları
    const galleryXs = [230, 295, 360, 425, 490, 555, 620, 700, 780, 845, 910, 975, 1040, 1105, 1170];
    for (const gx of galleryXs) {
      candidatePts.push({ x: gx, y: 425 });
    }
    for (const crossX of [425, 700, 975]) {
      for (const cy of [355, 495]) {
        candidatePts.push({ x: crossX, y: cy });
      }
    }

    // Birbirine çok yakın olanları birleştir ve mağaza/havuz sınırlarının dışına kelepçele
    const filtered = [];
    for (const rawPt of candidatePts) {
      const clamped = this._clampToWalkableCorridor(rawPt.x, rawPt.y, this.currentFloor);
      // Zemin kattaki gösteri havuzunun tam ortasına halka koyma
      if (this.currentFloor === 4 && Math.hypot(clamped.x - 700, clamped.y - 425) < 72) {
        continue;
      }
      const dCam = Math.hypot(clamped.x - this.camX, clamped.y - this.camY);
      if (dCam < 34 || dCam > 245) continue;
      if (filtered.some(existing => Math.hypot(existing.x - clamped.x, existing.y - clamped.y) < 44)) {
        continue;
      }
      filtered.push({ x: clamped.x, y: clamped.y, dCam });
    }

    // Uzaktan yakına sırala
    filtered.sort((a, b) => b.dCam - a.dCam);

    const pulse = 0.5 + 0.5 * Math.sin(now * 0.005);
    ctx.save();

    for (const pt of filtered) {
      const cCenter = this._worldToCamera(pt.x, pt.y, 0.8, cosYaw, sinYaw);
      if (cCenter.rx < 18 || cCenter.rx > 245 || Math.abs(cCenter.ry) > cCenter.rx * 0.92) continue;

      const pCenter = this._projectCamVerts([cCenter], cx, horizonY, fovScale)[0];
      const isHovered = Boolean(
        this.hoveredHotspot &&
        Math.hypot(this.hoveredHotspot.wx - pt.x, this.hoveredHotspot.wy - pt.y) < 12
      );

      const ringRadiusWorld = isHovered ? 13.5 : (10.5 + pulse * 1.2);
      const segs = 20;
      const ringCam = [];
      for (let i = 0; i < segs; i++) {
        const ang = (i / segs) * Math.PI * 2;
        ringCam.push(this._worldToCamera(
          pt.x + Math.cos(ang) * ringRadiusWorld,
          pt.y + Math.sin(ang) * ringRadiusWorld,
          0.85,
          cosYaw,
          sinYaw
        ));
      }
      const ringClip = this._clipPolygonNear(ringCam, 6.0);
      if (ringClip.length < 6) continue;
      const ringScr = this._projectCamVerts(ringClip, cx, horizonY, fovScale);

      // Perspektif zemin halkası dış dolgusu
      ctx.fillStyle = isHovered
        ? 'rgba(14, 165, 233, 0.52)'
        : (isActivelyAutoWalking ? 'rgba(56, 189, 248, 0.16)' : 'rgba(14, 165, 233, 0.28)');
      ctx.strokeStyle = isHovered
        ? '#facc15'
        : (isActivelyAutoWalking ? 'rgba(186, 230, 253, 0.55)' : 'rgba(255, 255, 255, 0.92)');
      ctx.lineWidth = isHovered ? 3.0 : 2.2;

      ctx.beginPath();
      ctx.moveTo(ringScr[0].x, ringScr[0].y);
      for (let k = 1; k < ringScr.length; k++) ctx.lineTo(ringScr[k].x, ringScr[k].y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // İç halka (Çift Çember Street View İkonu)
      const innerCam = [];
      const innerR = ringRadiusWorld * 0.52;
      for (let i = 0; i < 14; i++) {
        const ang = (i / 14) * Math.PI * 2;
        innerCam.push(this._worldToCamera(
          pt.x + Math.cos(ang) * innerR,
          pt.y + Math.sin(ang) * innerR,
          0.9,
          cosYaw,
          sinYaw
        ));
      }
      const innerClip = this._clipPolygonNear(innerCam, 6.0);
      if (innerClip.length >= 4) {
        const innerScr = this._projectCamVerts(innerClip, cx, horizonY, fovScale);
        ctx.strokeStyle = isHovered ? '#ffffff' : 'rgba(56, 189, 248, 0.9)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(innerScr[0].x, innerScr[0].y);
        for (let k = 1; k < innerScr.length; k++) ctx.lineTo(innerScr[k].x, innerScr[k].y);
        ctx.closePath();
        ctx.stroke();
      }

      // Halka içinde 3B İleri Yön Oku (Chevron ▲)
      const dirAngle = Math.atan2(pt.y - this.camY, pt.x - this.camX);
      const fwdX = Math.cos(dirAngle);
      const fwdY = Math.sin(dirAngle);
      const sideX = -fwdY;
      const sideY = fwdX;
      const chevWorld = [
        { x: pt.x - fwdX * 2.5 + sideX * 4.2, y: pt.y - fwdY * 2.5 + sideY * 4.2, z: 1.0 },
        { x: pt.x + fwdX * 4.2, y: pt.y + fwdY * 4.2, z: 1.0 },
        { x: pt.x - fwdX * 2.5 - sideX * 4.2, y: pt.y - fwdY * 2.5 - sideY * 4.2, z: 1.0 }
      ];
      const chevCam = chevWorld.map(p => this._worldToCamera(p.x, p.y, p.z, cosYaw, sinYaw));
      if (chevCam.every(c => c.rx > 7)) {
        const chevScr = this._projectCamVerts(chevCam, cx, horizonY, fovScale);
        ctx.strokeStyle = isHovered ? '#fef08a' : '#ffffff';
        ctx.lineWidth = Math.max(2, (250 / cCenter.rx) * (W / 1000));
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(chevScr[0].x, chevScr[0].y);
        ctx.lineTo(chevScr[1].x, chevScr[1].y);
        ctx.lineTo(chevScr[2].x, chevScr[2].y);
        ctx.stroke();
      }

      // Üzerine gelindiğinde "👆 Buraya Yürü" etiketi
      if (isHovered) {
        const distM = Math.max(1, Math.round(pt.dCam * 0.18));
        const lbl = `👆 Buraya İlerle (${distM}m)`;
        ctx.font = '800 11px "Plus Jakarta Sans", sans-serif';
        const tw = ctx.measureText(lbl).width + 16;
        const th = 22;
        const bx = pCenter.x - tw / 2;
        const by = pCenter.y - 30;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(bx, by, tw, th, 999);
        else ctx.rect(bx, by, tw, th);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#f8fafc';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(lbl, pCenter.x, by + th / 2);
      }

      // Tıklama algılama kutusu (Hitbox)
      const hitRadius = Math.max(20, Math.min(48, (ringRadiusWorld / cCenter.rx) * fovScale * 1.15));
      this.hotspotHitBoxes.push({
        x: pCenter.x,
        y: pCenter.y,
        r: hitRadius,
        wx: pt.x,
        wy: pt.y
      });
    }

    // 3. Canlı 3B Zemin İmleci (Google Street View Pancake Cursor)
    if (this.hoverFloorWorldPt && !this.hoveredStoreId && !this.hoveredHotspot && !isActivelyAutoWalking) {
      const { wx, wy } = this.hoverFloorWorldPt;
      const cCur = this._worldToCamera(wx, wy, 0.9, cosYaw, sinYaw);
      if (cCur.rx > 16 && cCur.rx < 260) {
        const curCam = [];
        const curR = 9.5;
        for (let i = 0; i < 18; i++) {
          const ang = (i / 18) * Math.PI * 2;
          curCam.push(this._worldToCamera(wx + Math.cos(ang) * curR, wy + Math.sin(ang) * curR, 0.9, cosYaw, sinYaw));
        }
        const curClip = this._clipPolygonNear(curCam, 6.0);
        if (curClip.length >= 5) {
          const curScr = this._projectCamVerts(curClip, cx, horizonY, fovScale);
          ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(curScr[0].x, curScr[0].y);
          for (let k = 1; k < curScr.length; k++) ctx.lineTo(curScr[k].x, curScr[k].y);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
      }
    }

    ctx.restore();
  }

  _render3DFountainPool(ctx, cx, horizonY, fovScale, cosYaw, sinYaw, now, W) {
    const poolX = 700;
    const poolY = 425;
    const rxPool = 75;
    const ryPool = 46;
    const pts = [];
    const segs = 24;
    for (let i = 0; i < segs; i++) {
      const ang = (i / segs) * Math.PI * 2;
      pts.push(this._worldToCamera(poolX + Math.cos(ang) * rxPool, poolY + Math.sin(ang) * ryPool, 1.0, cosYaw, sinYaw));
    }
    const clipped = this._clipPolygonNear(pts, 7);
    if (clipped.length >= 3) {
      const scr = this._projectCamVerts(clipped, cx, horizonY, fovScale);
      ctx.save();
      ctx.fillStyle = 'rgba(14, 165, 233, 0.62)';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(scr[0].x, scr[0].y);
      for (let k = 1; k < scr.length; k++) ctx.lineTo(scr[k].x, scr[k].y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Animasyonlu Fıskiye Su Sütunları (5 adet dans eden su jeti)
      const jets = [
        { dx: 0, dy: 0, phase: 0, maxH: 26 },
        { dx: -28, dy: 0, phase: 1.2, maxH: 19 },
        { dx: 28, dy: 0, phase: 2.4, maxH: 19 },
        { dx: 0, dy: -18, phase: 3.6, maxH: 17 },
        { dx: 0, dy: 18, phase: 4.8, maxH: 17 }
      ];
      for (const j of jets) {
        const jetH = 10 + Math.abs(Math.sin(now * 0.0045 + j.phase)) * j.maxH;
        const cBase = this._worldToCamera(poolX + j.dx, poolY + j.dy, 1.2, cosYaw, sinYaw);
        const cTop = this._worldToCamera(poolX + j.dx, poolY + j.dy, jetH, cosYaw, sinYaw);
        if (cBase.rx > 10 && cBase.rx < 420 && cTop.rx > 10) {
          const pB = this._projectCamVerts([cBase], cx, horizonY, fovScale)[0];
          const pT = this._projectCamVerts([cTop], cx, horizonY, fovScale)[0];
          ctx.strokeStyle = 'rgba(224, 242, 254, 0.85)';
          ctx.lineWidth = Math.max(2, (260 / cBase.rx) * (W / 1000));
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(pB.x, pB.y);
          ctx.lineTo(pT.x, pT.y);
          ctx.stroke();
        }
      }

      // Havuz Bilgi Etiketi
      const cCenter = this._worldToCamera(poolX, poolY, 26, cosYaw, sinYaw);
      if (cCenter.rx > 12 && cCenter.rx < 450 && Math.abs(cCenter.ry) < cCenter.rx * 0.95) {
        const pTop = this._projectCamVerts([cCenter], cx, horizonY, fovScale)[0];
        ctx.fillStyle = 'rgba(2, 132, 199, 0.92)';
        const fontSz = Math.max(10, Math.min(15, Math.round(1350 / cCenter.rx)));
        ctx.font = `800 ${fontSz}px "Plus Jakarta Sans", sans-serif`;
        const lbl = '🌊 MÜZİKLİ GÖSTERİ HAVUZU';
        const tw = ctx.measureText(lbl).width + 14;
        const th = fontSz + 8;
        const bx = pTop.x - tw / 2;
        const by = this._resolveAmenitySignY(bx, pTop.y - th / 2, tw, th);
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(bx, by, tw, th, 8);
        else ctx.rect(bx, by, tw, th);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(lbl, pTop.x, by + th / 2);
      }
      ctx.restore();
    }
  }

  /**
   * Koridor İçindeki 3B Yürüyen Merdivenler, Panoramik Asansörler, Palmiye Saksıları ve Hizmet Totemleri
   * (Yürüyen Merdiven, Asansör, Bebek Bakım Odası, Acil Çıkış, WC, Kiosk Harita, Otopark)
   */
  _render3DAmenitiesAndDecor(ctx, cx, horizonY, fovScale, cosYaw, sinYaw, now, W) {
    // 1. Koridor Peyzaj Saksıları & Oturma Bankları (Koridor ve Ara Yol Kavşaklarında, Mağaza Dışında)
    const decorPoints = [
      { x: 370, y: 398 }, { x: 565, y: 398 }, { x: 800, y: 398 }, { x: 1005, y: 398 },
      { x: 370, y: 482 }, { x: 565, y: 482 }, { x: 800, y: 482 }, { x: 1005, y: 482 }
    ];

    ctx.save();
    for (const dp of decorPoints) {
      const dist = Math.hypot(dp.x - this.camX, dp.y - this.camY);
      if (dist < 14 || dist > 260) continue;
      const cPot = this._worldToCamera(dp.x, dp.y, 0, cosYaw, sinYaw);
      const cCrown = this._worldToCamera(dp.x, dp.y, 17, cosYaw, sinYaw);
      if (cPot.rx < 12 || Math.abs(cPot.ry) > cPot.rx * 0.95) continue;

      const pPot = this._projectCamVerts([cPot], cx, horizonY, fovScale)[0];
      const pCrown = this._projectCamVerts([cCrown], cx, horizonY, fovScale)[0];
      const potW = Math.max(6, (340 / cPot.rx) * (W / 1100));
      const potH = Math.max(5, Math.abs(pPot.y - pCrown.y) * 0.42);

      // Ahşap/Antrasit Saksı Gövdesi
      ctx.fillStyle = '#475569';
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1;
      ctx.fillRect(pPot.x - potW * 0.5, pPot.y - potH, potW, potH);

      // Yeşil İç Mekan Bitkisi / Palmiye Tacı
      ctx.fillStyle = '#15803d';
      ctx.beginPath();
      ctx.arc(pCrown.x, pCrown.y, potW * 0.85, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.arc(pCrown.x - potW * 0.2, pCrown.y - potW * 0.2, potW * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 2. Bu Kattaki Tüm Doğrulanmış Servis, Yürüyen Merdiven ve Güvenlik Noktaları (Amenities)
    const rawAmenities = this.mallData?.floors[this.currentFloor]?.amenities || [];
    const amenities = [...rawAmenities];

    // Aktif rotada bu kattan başka bir kata geçiş (Yürüyen Merdiven / Asansör) düğümü varsa,
    // tam o düğüm koordinatında 3B Yürüyen Merdiven / Asansör yapısının kesin görünmesini sağla!
    const routePortalNodes = [];
    if (this.route && Array.isArray(this.route.pathNodes)) {
      const nodes = this.route.pathNodes;
      for (let i = 0; i < nodes.length - 1; i++) {
        const u = nodes[i];
        const v = nodes[i + 1];
        if (u.floor === this.currentFloor && v.floor !== this.currentFloor) {
          const isElev = v.edgeType === 'elevator' || v.portalKind === 'elevator';
          const portalKind = isElev ? 'elevator' : 'escalator';
          const goingUp = v.floor > u.floor;
          const destLabel = this.mallData?.floors[v.floor]?.label || `${v.floor}. Kat`;
          routePortalNodes.push({
            x: u.x,
            y: u.y,
            kind: portalKind,
            goingUp,
            destLabel
          });
          // Eğer bu noktanın 28 birim yakınında aynı tipte bir amenity yoksa listeye ekle
          const alreadyHas = amenities.some(a =>
            ((a.kind || a.type || '').toLowerCase() === portalKind) &&
            Math.hypot((a.cx || 700) - u.x, (a.cy || 425) - u.y) < 32
          );
          if (!alreadyHas) {
            amenities.push({
              id: `route_portal_${i}`,
              kind: portalKind,
              cx: u.x,
              cy: u.y,
              isRoutePortal: true,
              goingUp,
              destLabel
            });
          }
        }
      }
    }

    if (!amenities.length) return;

    const AMENITY_STYLE = {
      emergency: { icon: '🚨', label: 'ACİL ÇIKIŞ', bg: '#dc2626', border: '#fef08a' },
      elevator:  { icon: '🛗', label: 'PANORAMİK ASANSÖR', bg: '#0284c7', border: '#bae6fd' },
      escalator: { icon: '🪜', label: 'YÜRÜYEN MERDİVEN', bg: '#4f46e5', border: '#a5b4fc' },
      baby:      { icon: '🍼', label: 'BEBEK ODASI', bg: '#db2777', border: '#fbcfe8' },
      wc:        { icon: '🚻', label: 'WC / TUVALET', bg: '#0d9488', border: '#99f6e4' },
      kiosk:     { icon: '🖥️', label: 'KİOSK HARİTA', bg: '#ea580c', border: '#fed7aa' },
      carpark:   { icon: '🅿️', label: 'OTOPARK', bg: '#2563eb', border: '#bfdbfe' },
      atm:       { icon: '💳', label: 'ATM', bg: '#059669', border: '#a7f3d0' },
      prayer:    { icon: '🕌', label: 'MESCİT', bg: '#7c3aed', border: '#ddd6fe' },
      wheelchair:{ icon: '♿', label: 'ENGELSİZ ŞARJ', bg: '#0369a1', border: '#bae6fd' },
      info:      { icon: 'ℹ️', label: 'DANIŞMA', bg: '#0f172a', border: '#38bdf8' }
    };

    const visibleAm = [];
    for (const am of amenities) {
      const ax = am.cx || 700;
      const ay = am.cy || 425;
      const d = Math.hypot(ax - this.camX, ay - this.camY);
      const kind = (am.kind || am.type || 'info').toLowerCase();
      const maxDist = (kind === 'escalator' || kind === 'elevator') ? 400 : 330;
      if (d <= maxDist) {
        const matchedPortal = routePortalNodes.find(rp => Math.hypot(rp.x - ax, rp.y - ay) < 42);
        visibleAm.push({
          am,
          d,
          kind,
          isRoutePortal: Boolean(am.isRoutePortal || matchedPortal),
          goingUp: matchedPortal ? matchedPortal.goingUp : (am.goingUp !== undefined ? am.goingUp : true),
          destLabel: matchedPortal ? matchedPortal.destLabel : (am.destLabel || '')
        });
      }
    }
    visibleAm.sort((a, b) => b.d - a.d);

    ctx.save();
    for (const item of visibleAm) {
      const { am, kind, isRoutePortal, goingUp, destLabel } = item;
      const ax = am.cx || 700;
      const ay = am.cy || 425;

      // 2A. 3B YÜRÜYEN MERDİVEN MİMARİ MODELİ (Eğimli Çelik Gövde, Cam Korkuluklar, Hareketli Basamaklar & Sarı Güvenlik Şeritleri)
      if (kind === 'escalator') {
        this._draw3DEscalatorUnit(ctx, ax, ay, isRoutePortal, goingUp, destLabel, cx, horizonY, fovScale, cosYaw, sinYaw, now, W);
        continue;
      }

      // 2B. 3B PANORAMİK CAM ASANSÖR KULESİ MODELİ
      if (kind === 'elevator') {
        this._draw3DElevatorUnit(ctx, ax, ay, isRoutePortal, destLabel, cx, horizonY, fovScale, cosYaw, sinYaw, now, W);
        continue;
      }

      // 2C. Diğer Servis Totemleri (WC, Bebek Odası, Acil Çıkış, Kiosk, Danışma, Otopark)
      const st = AMENITY_STYLE[kind] || AMENITY_STYLE.info;
      const cTotem = this._worldToCamera(ax, ay, 36, cosYaw, sinYaw);
      if (cTotem.rx < 12 || cTotem.rx > 320 || Math.abs(cTotem.ry) > cTotem.rx * 0.92) continue;

      const isTargetAm = this.targetStore && this.targetStore.id === am.id;
      if (!isTargetAm && cTotem.rx > 210 && kind !== 'emergency' && kind !== 'kiosk') continue;

      const pT = this._projectCamVerts([cTotem], cx, horizonY, fovScale)[0];
      const sc = Math.max(0.55, Math.min(1.35, 95 / cTotem.rx)) * (W / 1150 + 0.32);
      const fSize = Math.round(Math.max(9, Math.min(15, 11 * sc)));
      ctx.font = `800 ${fSize}px "Plus Jakarta Sans", sans-serif`;

      const text = `${st.icon} ${st.label}`;
      const tw = ctx.measureText(text).width + 14 * sc;
      const th = fSize + 8 * sc;
      const bx = pT.x - tw / 2;
      const by = this._resolveAmenitySignY(bx, pT.y - th / 2, tw, th);

      ctx.fillStyle = st.bg;
      ctx.strokeStyle = isTargetAm ? '#ffffff' : st.border;
      ctx.lineWidth = isTargetAm ? 2.5 : 1.5;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(bx, by, tw, th, 7);
      else ctx.rect(bx, by, tw, th);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, pT.x, by + th / 2);
    }
    ctx.restore();
  }

  /**
   * 3B Yürüyen Merdiven (Escalator) Mimari Çizimi:
   * - Zemin giriş tarak plakası (Sarı/İndigo güvenlik alanı)
   * - Eğimli 3B çelik konstrüksiyon rampa (z: 0 ➔ 50)
   * - Sağ ve sol 3B temperli cam korkuluklar (LED aydınlatmalı) ve hareketli küpeşte bantları
   * - Animasyonlu yükselen/inen 3B merdiven basamakları (sarı güvenlik çizgili)
   * - Üstte parlak 3B Yürüyen Merdiven yönlendirme takı
   */
  _draw3DEscalatorUnit(ctx, ax, ay, isRoutePortal, goingUp, destLabel, cx, horizonY, fovScale, cosYaw, sinYaw, now, W) {
    const cCenter = this._worldToCamera(ax, ay, 24, cosYaw, sinYaw);
    if (cCenter.rx < 8 || cCenter.rx > 390 || Math.abs(cCenter.ry) > cCenter.rx * 1.15) return;

    // Yürüyen merdivenin rampa yönü: AVM atrium merkezine / doğu-batı aksına paralel uzanır
    const dirX = ax < 700 ? 1 : -1;
    const dirY = 0;
    const halfLen = 19; // Toplam uzunluk 38 birim
    const halfWid = 7.5; // Toplam genişlik 15 birim

    // Alt sahanlık (giriş) ve üst sahanlık (çıkış) dünya koordinatları
    const bx = ax - dirX * halfLen * 0.45;
    const by = ay - dirY * halfLen * 0.45;
    const tx = ax + dirX * halfLen * 0.95;
    const ty = ay + dirY * halfLen * 0.95;

    // Enine (sağ-sol korkuluk) normal vektörü
    const nx = -dirY * halfWid;
    const ny = dirX * halfWid;

    const zBot = 0.8;
    const zTop = 48.0;
    const railH = 10.5;

    ctx.save();

    // 1. Zemin Giriş Güvenlik Plakası (Sarı/Mavi Parlayan Sahanlık Halısı)
    const padVerts = [
      this._worldToCamera(bx - dirX * 9 + nx * 1.15, by - dirY * 9 + ny * 1.15, 0.7, cosYaw, sinYaw),
      this._worldToCamera(bx - dirX * 9 - nx * 1.15, by - dirY * 9 - ny * 1.15, 0.7, cosYaw, sinYaw),
      this._worldToCamera(bx + dirX * 3 - nx * 1.15, by + dirY * 3 - ny * 1.15, 0.7, cosYaw, sinYaw),
      this._worldToCamera(bx + dirX * 3 + nx * 1.15, by + dirY * 3 + ny * 1.15, 0.7, cosYaw, sinYaw)
    ];
    const padClip = this._clipPolygonNear(padVerts, 5.5);
    if (padClip.length >= 3) {
      const pPad = this._projectCamVerts(padClip, cx, horizonY, fovScale);
      ctx.fillStyle = isRoutePortal ? 'rgba(79, 70, 229, 0.85)' : 'rgba(51, 65, 85, 0.85)';
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = Math.max(1.5, (220 / cCenter.rx) * (W / 1000));
      ctx.beginPath();
      ctx.moveTo(pPad[0].x, pPad[0].y);
      for (let k = 1; k < pPad.length; k++) ctx.lineTo(pPad[k].x, pPad[k].y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // 2. Eğimli 3B Çelik Yürüyen Merdiven Yatağı (Rampa Gövdesi)
    const rampVerts = [
      this._worldToCamera(bx + nx, by + ny, zBot, cosYaw, sinYaw),
      this._worldToCamera(bx - nx, by - ny, zBot, cosYaw, sinYaw),
      this._worldToCamera(tx - nx, ty - ny, zTop, cosYaw, sinYaw),
      this._worldToCamera(tx + nx, ty + ny, zTop, cosYaw, sinYaw)
    ];
    const rampClip = this._clipPolygonNear(rampVerts, 5.5);
    if (rampClip.length >= 3) {
      const pRamp = this._projectCamVerts(rampClip, cx, horizonY, fovScale);
      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(pRamp[0].x, pRamp[0].y);
      for (let k = 1; k < pRamp.length; k++) ctx.lineTo(pRamp[k].x, pRamp[k].y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // 3. Animasyonlu 3B Yürüyen Merdiven Basamakları (Sarı Güvenlik Çizgili 9 Adet Hareketli Basamak)
    const numSteps = 9;
    const animShift = ((now * 0.0022 * (goingUp ? 1 : -1)) % 1 + 1) % 1;
    for (let s = 0; s < numSteps; s++) {
      const tStep = (s + animShift) / numSteps;
      const sx1 = bx + (tx - bx) * tStep;
      const sy1 = by + (ty - by) * tStep;
      const sz1 = zBot + (zTop - zBot) * tStep + 0.8;

      const cLeft = this._worldToCamera(sx1 + nx * 0.88, sy1 + ny * 0.88, sz1, cosYaw, sinYaw);
      const cRight = this._worldToCamera(sx1 - nx * 0.88, sy1 - ny * 0.88, sz1, cosYaw, sinYaw);
      const cLeftRiser = this._worldToCamera(sx1 + nx * 0.88, sy1 + ny * 0.88, sz1 + 3.2, cosYaw, sinYaw);
      const cRightRiser = this._worldToCamera(sx1 - nx * 0.88, sy1 - ny * 0.88, sz1 + 3.2, cosYaw, sinYaw);

      if (cLeft.rx > 6 && cRight.rx > 6) {
        const pStep = this._projectCamVerts([cLeft, cRight, cRightRiser, cLeftRiser], cx, horizonY, fovScale);
        // Metalik basamak yüzeyi
        ctx.fillStyle = s % 2 === 0 ? '#334155' : '#475569';
        ctx.beginPath();
        ctx.moveTo(pStep[0].x, pStep[0].y);
        ctx.lineTo(pStep[1].x, pStep[1].y);
        ctx.lineTo(pStep[2].x, pStep[2].y);
        ctx.lineTo(pStep[3].x, pStep[3].y);
        ctx.closePath();
        ctx.fill();

        // Sarı güvenlik basamak ucu çizgisi
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = Math.max(1.4, (210 / cLeft.rx) * (W / 1050));
        ctx.beginPath();
        ctx.moveTo(pStep[3].x, pStep[3].y);
        ctx.lineTo(pStep[2].x, pStep[2].y);
        ctx.stroke();
      }
    }

    // 4. Sağ ve Sol 3B Temperli Cam Korkuluklar (LED Aydınlatmalı) ve Küpeşte Bantları
    for (const sideSign of [-1, 1]) {
      const sxOff = nx * sideSign;
      const syOff = ny * sideSign;
      const glassQuad = [
        this._worldToCamera(bx + sxOff, by + syOff, zBot, cosYaw, sinYaw),
        this._worldToCamera(tx + sxOff, ty + syOff, zTop, cosYaw, sinYaw),
        this._worldToCamera(tx + sxOff, ty + syOff, zTop + railH, cosYaw, sinYaw),
        this._worldToCamera(bx + sxOff, by + syOff, zBot + railH, cosYaw, sinYaw)
      ];
      const glassClip = this._clipPolygonNear(glassQuad, 5.5);
      if (glassClip.length >= 3) {
        const pGlass = this._projectCamVerts(glassClip, cx, horizonY, fovScale);
        ctx.fillStyle = isRoutePortal ? 'rgba(56, 189, 248, 0.34)' : 'rgba(148, 163, 184, 0.28)';
        ctx.strokeStyle = isRoutePortal ? '#38bdf8' : '#cbd5e1';
        ctx.lineWidth = Math.max(1.5, (200 / cCenter.rx) * (W / 1000));
        ctx.beginPath();
        ctx.moveTo(pGlass[0].x, pGlass[0].y);
        for (let k = 1; k < pGlass.length; k++) ctx.lineTo(pGlass[k].x, pGlass[k].y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Üst Siyah/Kırmızı Küpeşte Bandı (Handrail)
        const cRailBot = this._worldToCamera(bx + sxOff, by + syOff, zBot + railH, cosYaw, sinYaw);
        const cRailTop = this._worldToCamera(tx + sxOff, ty + syOff, zTop + railH, cosYaw, sinYaw);
        if (cRailBot.rx > 6 && cRailTop.rx > 6) {
          const pRail = this._projectCamVerts([cRailBot, cRailTop], cx, horizonY, fovScale);
          ctx.strokeStyle = isRoutePortal ? '#4f46e5' : '#0f172a';
          ctx.lineWidth = Math.max(2.5, (320 / cCenter.rx) * (W / 1000));
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(pRail[0].x, pRail[0].y);
          ctx.lineTo(pRail[1].x, pRail[1].y);
          ctx.stroke();
        }
      }
    }

    // 5. Üstte 3B Işıklı Yürüyen Merdiven Portal Tabelası
    const cSign = this._worldToCamera(ax, ay, 48, cosYaw, sinYaw);
    if (cSign.rx > 10 && cSign.rx < 370 && Math.abs(cSign.ry) < cSign.rx * 0.96) {
      const pS = this._projectCamVerts([cSign], cx, horizonY, fovScale)[0];
      const sc = Math.max(0.65, Math.min(1.45, 110 / cSign.rx)) * (W / 1150 + 0.35);
      const fSize = Math.round(Math.max(10, Math.min(16, 12 * sc)));
      ctx.font = `800 ${fSize}px "Plus Jakarta Sans", sans-serif`;

      const arrow = goingUp ? '⬆️' : '⬇️';
      const titleText = isRoutePortal
        ? `🪜 YÜRÜYEN MERDİVEN ${arrow} ${destLabel || 'KAT GEÇİŞİ'}`
        : `🪜 YÜRÜYEN MERDİVEN ${arrow}`;
      const tw = ctx.measureText(titleText).width + 18 * sc;
      const th = fSize + 10 * sc;
      const bxSign = pS.x - tw / 2;
      const bySign = this._resolveAmenitySignY(bxSign, pS.y - th / 2, tw, th);

      ctx.fillStyle = isRoutePortal ? '#4f46e5' : 'rgba(30, 27, 75, 0.92)';
      ctx.strokeStyle = isRoutePortal ? '#facc15' : '#a5b4fc';
      ctx.lineWidth = isRoutePortal ? 2.5 : 1.8;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(bxSign, bySign, tw, th, 8);
      else ctx.rect(bxSign, bySign, tw, th);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(titleText, pS.x, bySign + th / 2);

      const nextFl = this.currentFloor < 6 ? this.currentFloor + 1 : Math.max(1, this.currentFloor - 1);
      this.portalHitBoxes.push({
        x1: bxSign - 12,
        y1: bySign - 8,
        x2: bxSign + tw + 12,
        y2: bySign + th + 65,
        kind: 'escalator',
        wx: ax,
        wy: ay,
        targetFloor: nextFl,
        dist: cSign.rx
      });
    }

    ctx.restore();
  }

  /**
   * 3B Panoramik Cam Asansör Kulesi Çizimi
   */
  _draw3DElevatorUnit(ctx, ax, ay, isRoutePortal, destLabel, cx, horizonY, fovScale, cosYaw, sinYaw, now, W) {
    const cCenter = this._worldToCamera(ax, ay, 30, cosYaw, sinYaw);
    if (cCenter.rx < 10 || cCenter.rx > 370 || Math.abs(cCenter.ry) > cCenter.rx * 1.1) return;

    const hw = 8.5;
    const zTop = 58;
    const frontQuad = [
      this._worldToCamera(ax - hw, ay - hw, 0, cosYaw, sinYaw),
      this._worldToCamera(ax + hw, ay - hw, 0, cosYaw, sinYaw),
      this._worldToCamera(ax + hw, ay - hw, zTop, cosYaw, sinYaw),
      this._worldToCamera(ax - hw, ay - hw, zTop, cosYaw, sinYaw)
    ];
    const clip = this._clipPolygonNear(frontQuad, 5.5);
    ctx.save();
    if (clip.length >= 3) {
      const pQ = this._projectCamVerts(clip, cx, horizonY, fovScale);
      ctx.fillStyle = 'rgba(14, 165, 233, 0.28)';
      ctx.strokeStyle = isRoutePortal ? '#38bdf8' : '#bae6fd';
      ctx.lineWidth = Math.max(1.8, (220 / cCenter.rx) * (W / 1000));
      ctx.beginPath();
      ctx.moveTo(pQ[0].x, pQ[0].y);
      for (let k = 1; k < pQ.length; k++) ctx.lineTo(pQ[k].x, pQ[k].y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    const cSign = this._worldToCamera(ax, ay, 56, cosYaw, sinYaw);
    if (cSign.rx > 10 && Math.abs(cSign.ry) < cSign.rx * 0.95) {
      const pS = this._projectCamVerts([cSign], cx, horizonY, fovScale)[0];
      const sc = Math.max(0.6, Math.min(1.35, 100 / cSign.rx)) * (W / 1150 + 0.32);
      const fSize = Math.round(Math.max(9, Math.min(15, 11 * sc)));
      ctx.font = `800 ${fSize}px "Plus Jakarta Sans", sans-serif`;
      const text = isRoutePortal && destLabel ? `🛗 ASANSÖR • ${destLabel}` : '🛗 PANORAMİK ASANSÖR';
      const tw = ctx.measureText(text).width + 16 * sc;
      const th = fSize + 9 * sc;
      const bxSign = pS.x - tw / 2;
      const bySign = this._resolveAmenitySignY(bxSign, pS.y - th / 2, tw, th);
      ctx.fillStyle = '#0284c7';
      ctx.strokeStyle = isRoutePortal ? '#facc15' : '#bae6fd';
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(bxSign, bySign, tw, th, 8);
      else ctx.rect(bxSign, bySign, tw, th);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, pS.x, bySign + th / 2);

      const nextFl = this.currentFloor < 6 ? this.currentFloor + 1 : Math.max(1, this.currentFloor - 1);
      this.portalHitBoxes.push({
        x1: bxSign - 10,
        y1: bySign - 6,
        x2: bxSign + tw + 10,
        y2: bySign + th + 60,
        kind: 'elevator',
        wx: ax,
        wy: ay,
        targetFloor: nextFl,
        dist: cSign.rx
      });
    }
    ctx.restore();
  }

  _render3DStorefronts(ctx, cx, horizonY, fovScale, cosYaw, sinYaw, now, W, H) {
    const floorStores = this.mallData?.floors[this.currentFloor]?.stores || [];
    if (!floorStores.length) return;

    const enRouteSet = new Set(this.route?.enRouteStoreIds || []);
    const wallQuads = [];
    const storeSignAnchors = [];

    const wallHeight = 66;
    const fasciaBottom = 44;

    // 0. MİMARİ AVM DIŞ ÇEVRE VE KORİDOR SONU TRAVERTEN KAPAMA DUVARLARI (Ufukta asla boşluk kalmaması için)
    const perimeterWalls = [
      { cA: { x: 115, y: 125 }, cB: { x: 1285, y: 125 } }, // Kuzey Ana Çevre Duvarı
      { cA: { x: 1285, y: 740 }, cB: { x: 115, y: 740 } }, // Güney Ana Çevre Duvarı
      { cA: { x: 115, y: 740 }, cB: { x: 115, y: 125 } },  // Batı Koridor Sonu Kapama Duvarı
      { cA: { x: 1285, y: 125 }, cB: { x: 1285, y: 740 } } // Doğu Koridor Sonu Kapama Duvarı
    ];
    ctx.save();
    for (const pw of perimeterWalls) {
      const camPW = [
        this._worldToCamera(pw.cA.x, pw.cA.y, 0, cosYaw, sinYaw),
        this._worldToCamera(pw.cB.x, pw.cB.y, 0, cosYaw, sinYaw),
        this._worldToCamera(pw.cB.x, pw.cB.y, 68, cosYaw, sinYaw),
        this._worldToCamera(pw.cA.x, pw.cA.y, 68, cosYaw, sinYaw)
      ];
      const clipPW = this._clipPolygonNear(camPW, 6.0);
      if (clipPW.length >= 3) {
        const scrPW = this._projectCamVerts(clipPW, cx, horizonY, fovScale);
        ctx.fillStyle = '#e7dac6';
        ctx.strokeStyle = '#c5b092';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(scrPW[0].x, scrPW[0].y);
        for (let k = 1; k < scrPW.length; k++) ctx.lineTo(scrPW[k].x, scrPW[k].y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      // Üst Galeri Koyu Antrasit Alınlık Bandı (z = 46 .. 68)
      const camBand = [
        this._worldToCamera(pw.cA.x, pw.cA.y, 46, cosYaw, sinYaw),
        this._worldToCamera(pw.cB.x, pw.cB.y, 46, cosYaw, sinYaw),
        this._worldToCamera(pw.cB.x, pw.cB.y, 68, cosYaw, sinYaw),
        this._worldToCamera(pw.cA.x, pw.cA.y, 68, cosYaw, sinYaw)
      ];
      const clipBand = this._clipPolygonNear(camBand, 6.0);
      if (clipBand.length >= 3) {
        const scrBand = this._projectCamVerts(clipBand, cx, horizonY, fovScale);
        ctx.fillStyle = '#292524';
        ctx.beginPath();
        ctx.moveTo(scrBand[0].x, scrBand[0].y);
        for (let k = 1; k < scrBand.length; k++) ctx.lineTo(scrBand[k].x, scrBand[k].y);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();

    for (const s of floorStores) {
      const sx = s.x !== undefined ? s.x : (s.cx - (s.w || 70) / 2);
      const sy = s.y !== undefined ? s.y : (s.cy - (s.h || 90) / 2);
      const sw = s.w || 70;
      const sh = s.h || 90;

      const doorX = s.door_x !== undefined ? s.door_x : s.cx;
      const doorY = s.door_y !== undefined ? s.door_y : s.cy;
      const distToStore = Math.hypot(doorX - this.camX, doorY - this.camY);
      if (distToStore > 950) continue;

      const isStart = this.startStore && this.startStore.id === s.id;
      const isTarget = this.targetStore && this.targetStore.id === s.id;
      const isEnRoute = enRouteSet.has(s.id);
      const isPassingNow = this.currentlyPassingStore && this.currentlyPassingStore.id === s.id;

      // Mağaza kutusunun 4 dış duvarı (Back-face culling ile yalnızca kameraya dönük dış yüzeyler çizilir;
      // böylece yatay koridorlar ve dikey "ara yollar" 3B olarak tamamen açık ve engelsiz görünür!)
      const candidateFaces = [];
      if (this.camY < sy - 0.5) {
        // Kuzey Cephesi (y = sy)
        candidateFaces.push({
          cA: { x: sx, y: sy },
          cB: { x: sx + sw, y: sy },
          isDoorFace: Math.abs(doorY - sy) < 4
        });
      } else if (this.camY > sy + sh + 0.5) {
        // Güney Cephesi (y = sy + sh)
        candidateFaces.push({
          cA: { x: sx + sw, y: sy + sh },
          cB: { x: sx, y: sy + sh },
          isDoorFace: Math.abs(doorY - (sy + sh)) < 4
        });
      }

      if (this.camX < sx - 0.5) {
        // Batı Cephesi ("Ara Yol" Yan Cephe, x = sx)
        candidateFaces.push({
          cA: { x: sx, y: sy + sh },
          cB: { x: sx, y: sy },
          isDoorFace: Math.abs(doorX - sx) < 4
        });
      } else if (this.camX > sx + sw + 0.5) {
        // Doğu Cephesi ("Ara Yol" Yan Cephe, x = sx + sw)
        candidateFaces.push({
          cA: { x: sx + sw, y: sy },
          cB: { x: sx + sw, y: sy + sh },
          isDoorFace: Math.abs(doorX - (sx + sw)) < 4
        });
      }

      let bestSignFace = null;
      const storeFaces = [];
      for (const face of candidateFaces) {
        let midX = (face.cA.x + face.cB.x) * 0.5;
        let midY = (face.cA.y + face.cB.y) * 0.5;
        if (face.isDoorFace) {
          const dxF = face.cB.x - face.cA.x;
          const dyF = face.cB.y - face.cA.y;
          const lenSq = dxF * dxF + dyF * dyF;
          if (lenSq > 1) {
            const tDoor = Math.max(0.12, Math.min(0.88, ((doorX - face.cA.x) * dxF + (doorY - face.cA.y) * dyF) / lenSq));
            midX = face.cA.x + dxF * tDoor;
            midY = face.cA.y + dyF * tDoor;
          }
        }
        const wallDist = Math.hypot(midX - this.camX, midY - this.camY);
        const faceLen = Math.hypot(face.cB.x - face.cA.x, face.cB.y - face.cA.y);
        if (wallDist > 920) continue;

        const wqItem = {
          store: s,
          cA: face.cA,
          cB: face.cB,
          midX,
          midY,
          wallDist,
          faceLen,
          isFrontFacade: face.isDoorFace || faceLen >= 38,
          isDoorFace: face.isDoorFace,
          isPrimaryFace: false,
          isStart,
          isTarget,
          isEnRoute,
          isPassingNow
        };
        storeFaces.push(wqItem);
        wallQuads.push(wqItem);

        if (!bestSignFace || (face.isDoorFace && !bestSignFace.isDoorFace) || (face.isDoorFace === bestSignFace.isDoorFace && wallDist < bestSignFace.dist)) {
          bestSignFace = { midX, midY, dist: wallDist, isDoorFace: face.isDoorFace, wqItem };
        }
      }

      if (bestSignFace && bestSignFace.wqItem) {
        bestSignFace.wqItem.isPrimaryFace = true;
      }

      if (bestSignFace && bestSignFace.dist <= 560) {
        storeSignAnchors.push({
          store: s,
          signX: bestSignFace.midX,
          signY: bestSignFace.midY,
          signZ: 52,
          dist: bestSignFace.dist,
          isStart,
          isTarget,
          isEnRoute,
          isPassingNow
        });
      }
    }

    // Uzaktan yakına sırala (Painter's Algorithm)
    wallQuads.sort((a, b) => b.wallDist - a.wallDist);

    // Her mağaza için koridora bakan ana vitrin cephesini (isDoorFace) önceliklendirerek TEK cephe belirle
    const bestFaceByStore = new Map();
    for (const wq of wallQuads) {
      if (wq.faceLen < 20 || wq.wallDist >= 820) continue;
      const cw = [
        this._worldToCamera(wq.cA.x, wq.cA.y, 0, cosYaw, sinYaw),
        this._worldToCamera(wq.cB.x, wq.cB.y, 0, cosYaw, sinYaw),
        this._worldToCamera(wq.cB.x, wq.cB.y, wallHeight, cosYaw, sinYaw),
        this._worldToCamera(wq.cA.x, wq.cA.y, wallHeight, cosYaw, sinYaw)
      ];
      const cl = this._clipPolygonNear(cw, 6.0);
      if (cl.length < 3) continue;
      const sw = this._projectCamVerts(cl, cx, horizonY, fovScale);
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const p of sw) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
      const visW = Math.min(W - 6, maxX) - Math.max(6, minX);
      const visH = maxY - minY;
      const minReqW = wq.isDoorFace ? 12 : 24;
      if (visW >= minReqW && visH >= 14) {
        const prev = bestFaceByStore.get(wq.store.id);
        if (!prev || (wq.isDoorFace && !prev.isDoorFace) || (wq.isDoorFace === prev.isDoorFace && visW > prev.visW)) {
          bestFaceByStore.set(wq.store.id, { wq, visW, isDoorFace: wq.isDoorFace });
        }
      }
    }

    for (const wq of wallQuads) {
      const { store, cA, cB, midX, midY, faceLen, isFrontFacade, isDoorFace, isPrimaryFace, isStart, isTarget, isEnRoute, isPassingNow, wallDist } = wq;
      const catStyle = this._getCategoryColors(store.category);

      // 1. Ana Vitrin Duvarı & Traverten Kolon Çerçevesi (z = 0 .. wallHeight)
      const camWall = [
        this._worldToCamera(cA.x, cA.y, 0, cosYaw, sinYaw),
        this._worldToCamera(cB.x, cB.y, 0, cosYaw, sinYaw),
        this._worldToCamera(cB.x, cB.y, wallHeight, cosYaw, sinYaw),
        this._worldToCamera(cA.x, cA.y, wallHeight, cosYaw, sinYaw)
      ];
      const clippedWall = this._clipPolygonNear(camWall, 6.0);
      if (clippedWall.length < 3) continue;

      const scrWall = this._projectCamVerts(clippedWall, cx, horizonY, fovScale);

      ctx.save();

      if (isTarget) {
        ctx.fillStyle = '#fee2e2';
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 3.2;
      } else if (isStart) {
        ctx.fillStyle = '#d1fae5';
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 3.0;
      } else if (isPassingNow || isEnRoute) {
        ctx.fillStyle = '#e7dac6';
        ctx.strokeStyle = isPassingNow ? '#059669' : '#10b981';
        ctx.lineWidth = 2.6;
      } else {
        // Capacity AVM gerçek bej traverten mermer kolon & duvar dokusu
        ctx.fillStyle = '#e5d5be';
        ctx.strokeStyle = '#bfa785';
        ctx.lineWidth = 1.6;
      }

      // Vitrin duvarları %100 opak çizilir; böylece arka koridordaki mağazalar ön duvarın içinden görünmez
      ctx.globalAlpha = 1.0;
      ctx.beginPath();
      ctx.moveTo(scrWall[0].x, scrWall[0].y);
      for (let k = 1; k < scrWall.length; k++) ctx.lineTo(scrWall[k].x, scrWall[k].y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      if (faceLen >= 20) {
        // 1B. Sıcak Aydınlatmalı Cam Vitrin & Çift Kanatlı Cam Kapı Doğramaları (Tüm Koridor ve Ara Yol Cephelerinde)
        const glassA = { x: cA.x + (cB.x - cA.x) * 0.07, y: cA.y + (cB.y - cA.y) * 0.07 };
        const glassB = { x: cA.x + (cB.x - cA.x) * 0.93, y: cA.y + (cB.y - cA.y) * 0.93 };
        const camGlass = [
          this._worldToCamera(glassA.x, glassA.y, 1.2, cosYaw, sinYaw),
          this._worldToCamera(glassB.x, glassB.y, 1.2, cosYaw, sinYaw),
          this._worldToCamera(glassB.x, glassB.y, fasciaBottom - 1.5, cosYaw, sinYaw),
          this._worldToCamera(glassA.x, glassA.y, fasciaBottom - 1.5, cosYaw, sinYaw)
        ];
        const clippedGlass = this._clipPolygonNear(camGlass, 6.0);
        if (clippedGlass.length >= 3) {
          const scrGlass = this._projectCamVerts(clippedGlass, cx, horizonY, fovScale);
          ctx.fillStyle = isPassingNow ? 'rgba(254, 249, 195, 0.96)' : 'rgba(255, 250, 235, 0.94)';
          ctx.strokeStyle = '#292524';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(scrGlass[0].x, scrGlass[0].y);
          for (let k = 1; k < scrGlass.length; k++) ctx.lineTo(scrGlass[k].x, scrGlass[k].y);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Mağaza vitrin camı dikey antrasit alüminyum kayıtları (mullions)
          for (const frac of [0.33, 0.67]) {
            const mx = cA.x + (cB.x - cA.x) * frac;
            const my = cA.y + (cB.y - cA.y) * frac;
            const mBot = this._worldToCamera(mx, my, 1.2, cosYaw, sinYaw);
            const mTop = this._worldToCamera(mx, my, fasciaBottom - 1.5, cosYaw, sinYaw);
            const mClip = this._clipPolygonNear([mBot, mTop], 6.0);
            if (mClip.length === 2) {
              const mProj = this._projectCamVerts(mClip, cx, horizonY, fovScale);
              ctx.strokeStyle = 'rgba(41, 37, 36, 0.62)';
              ctx.lineWidth = 1.2;
              ctx.beginPath();
              ctx.moveTo(mProj[0].x, mProj[0].y);
              ctx.lineTo(mProj[1].x, mProj[1].y);
              ctx.stroke();
            }
          }
        }

        // 2. Üst Işıklı Mağaza Tabelası Şeridi (Capacity AVM Koyu Antrasit / Bronz Kurumsal Alınlık: z = fasciaBottom .. wallHeight)
        const fA = { x: cA.x + (cB.x - cA.x) * 0.05, y: cA.y + (cB.y - cA.y) * 0.05 };
        const fB = { x: cA.x + (cB.x - cA.x) * 0.95, y: cA.y + (cB.y - cA.y) * 0.95 };
        const camFascia = [
          this._worldToCamera(fA.x, fA.y, fasciaBottom, cosYaw, sinYaw),
          this._worldToCamera(fB.x, fB.y, fasciaBottom, cosYaw, sinYaw),
          this._worldToCamera(fB.x, fB.y, wallHeight - 2, cosYaw, sinYaw),
          this._worldToCamera(fA.x, fA.y, wallHeight - 2, cosYaw, sinYaw)
        ];
        const clippedFascia = this._clipPolygonNear(camFascia, 6.0);
        if (clippedFascia.length >= 3) {
          const scrFascia = this._projectCamVerts(clippedFascia, cx, horizonY, fovScale);
          ctx.fillStyle = isTarget ? '#dc2626' : (isStart ? '#059669' : (isPassingNow ? '#047857' : '#1c1917'));
          ctx.strokeStyle = isTarget ? '#fca5a5' : (isPassingNow ? '#34d399' : '#78716c');
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(scrFascia[0].x, scrFascia[0].y);
          for (let k = 1; k < scrFascia.length; k++) ctx.lineTo(scrFascia[k].x, scrFascia[k].y);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Mimari Fascia Altı Sıcak LED Aydınlatma Şeridi (z = fasciaBottom)
          ctx.strokeStyle = 'rgba(254, 240, 138, 0.88)';
          ctx.lineWidth = Math.max(1.6, W / 680);
          ctx.beginPath();
          ctx.moveTo(scrFascia[0].x, scrFascia[0].y);
          ctx.lineTo(scrFascia[1].x, scrFascia[1].y);
          ctx.stroke();
        }

        // 1C. Her Mağazanın Koridora Bakan Ana Vitrin Cephesinde + Köşe Mağazaların Ön Plan Yan Vitrinlerinde Büyük Işıklı Kurumsal Marka Logosu
        const isBestCorridorFace = bestFaceByStore.get(store.id)?.wq === wq;
        const isForegroundCornerWindow = !wq.isDoorFace && wallDist < 220;
        if (isBestCorridorFace || isForegroundCornerWindow) {
          let minWallX = Infinity, maxWallX = -Infinity;
          let minWallY = Infinity, maxWallY = -Infinity;
          for (const sp of scrWall) {
            if (sp.x < minWallX) minWallX = sp.x;
            if (sp.x > maxWallX) maxWallX = sp.x;
            if (sp.y < minWallY) minWallY = sp.y;
            if (sp.y > maxWallY) maxWallY = sp.y;
          }
          const clampedMinX = Math.max(6, minWallX);
          const clampedMaxX = Math.min(W - 6, maxWallX);
          const visWallW = clampedMaxX - clampedMinX;
          const visWallH = maxWallY - minWallY;

          let avgRx = 0;
          for (const cv of clippedWall) avgRx += cv.rx;
          avgRx /= clippedWall.length;

          const minPlaqueW = isBestCorridorFace ? 14 : 64;
          if (visWallW >= minPlaqueW && visWallH >= 18 && avgRx > 6) {
            let plaqueCx = (clampedMinX + clampedMaxX) * 0.5;
            if (isDoorFace) {
              const doorCam = this._worldToCamera(midX, midY, wallHeight * 0.45, cosYaw, sinYaw);
              if (doorCam.rx > 6) {
                const doorScr = this._projectCamVerts([doorCam], cx, horizonY, fovScale)[0];
                if (doorScr && doorScr.x >= clampedMinX + 10 && doorScr.x <= clampedMaxX - 10) {
                  plaqueCx = doorScr.x;
                }
              }
            }
            const plaqueCy = minWallY + visWallH * 0.54;
            const logoImg = this._getStoreLogoImage(store);
            const winLogoSize = Math.max(22, Math.min(82, Math.min(visWallW * 0.78, (2800 / avgRx) * (W / 1050))));

            if (logoImg && logoImg.complete && logoImg.naturalWidth > 0) {
              ctx.save();
              const isHoveredStore = (this.hoveredStoreId === store.id) || (this.selectedPopupStore && this.selectedPopupStore.id === store.id);
              const nameFontSz = Math.max(8, Math.min(13, Math.round(winLogoSize * 0.22)));
              ctx.font = `800 ${nameFontSz}px "Plus Jakarta Sans", sans-serif`;
              const shortName = (store.name || '').length > 15 ? (store.name.slice(0, 14) + '…') : (store.name || '');
              const nameW = Math.min(visWallW - 4, Math.max(winLogoSize + 8, ctx.measureText(shortName).width + 12));
              const totalPlaqueH = winLogoSize + nameFontSz + 10;
              const px = plaqueCx - nameW / 2;
              const py = plaqueCy - totalPlaqueH / 2;

              // Dış ışıklı vitrin panosu
              ctx.fillStyle = isHoveredStore ? '#ffffff' : 'rgba(255, 255, 255, 0.97)';
              ctx.strokeStyle = isHoveredStore
                ? '#38bdf8'
                : (isPassingNow ? '#10b981' : (isTarget ? '#ef4444' : catStyle.fascia));
              ctx.lineWidth = isHoveredStore ? 3.8 : (isPassingNow || isTarget ? 3.2 : 2.2);
              ctx.beginPath();
              if (ctx.roundRect) ctx.roundRect(px, py, nameW, totalPlaqueH, 10);
              else ctx.rect(px, py, nameW, totalPlaqueH);
              ctx.fill();
              ctx.stroke();

              // Büyük Kurumsal Marka Logosu
              const lx = plaqueCx - (winLogoSize - 4) / 2;
              const ly = py + 3;
              ctx.drawImage(logoImg, lx, ly, winLogoSize - 4, winLogoSize - 4);
              this.logosRenderedLastFrame++;

              // Alt Şerit: Mağaza İsmi Bandı
              const bannerH = nameFontSz + 5;
              const bannerY = py + totalPlaqueH - bannerH;
              ctx.fillStyle = isHoveredStore
                ? '#0284c7'
                : (isTarget ? '#dc2626' : (isPassingNow ? '#059669' : '#0f172a'));
              ctx.beginPath();
              if (ctx.roundRect) ctx.roundRect(px + 1.5, bannerY - 1, nameW - 3, bannerH, 5);
              else ctx.rect(px + 1.5, bannerY - 1, nameW - 3, bannerH);
              ctx.fill();

              ctx.fillStyle = '#ffffff';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(shortName, plaqueCx, bannerY + bannerH / 2 - 0.5);

              // Üzerine gelindiğinde "👆 Tıkla: İncele / Rota" rozeti
              if (isHoveredStore) {
                const hLbl = '👆 Tıkla: İncele / Rota';
                ctx.font = '800 10px "Plus Jakarta Sans", sans-serif';
                const hW = ctx.measureText(hLbl).width + 14;
                const hH = 19;
                const hx = plaqueCx - hW / 2;
                const hy = Math.max(8, py - hH - 5);
                ctx.fillStyle = '#0284c7';
                ctx.strokeStyle = '#fef08a';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                if (ctx.roundRect) ctx.roundRect(hx, hy, hW, hH, 999);
                else ctx.rect(hx, hy, hW, hH);
                ctx.fill();
                ctx.stroke();
                ctx.fillStyle = '#ffffff';
                ctx.fillText(hLbl, plaqueCx, hy + hH / 2);
              }

              // Tıklanabilir 3B Mağaza Hitbox Kaydı (Street View Etkileşimi)
              this.storeHitBoxes.push({
                x1: px - 6,
                y1: py - 6,
                x2: px + nameW + 6,
                y2: py + totalPlaqueH + 6,
                store,
                dist: avgRx
              });

              ctx.restore();
            }
          }
        }
      }
      ctx.restore();
    }

    // 3. Yalnızca Hedef/Başlangıç Noktası veya Vitrin Panosu Henüz Çizilmemiş Çok Uzak Anchor Mağazalar İçin Üst Tabela
    // (Böylece koridorun ortasında üst üste binen siyah kutular oluşmaz; tüm mağaza logoları doğrudan kendi vitrin duvarında parlar!)
    storeSignAnchors.sort((a, b) => b.dist - a.dist);

    for (const item of storeSignAnchors) {
      const { store, signX, signY, signZ, isStart, isTarget, isEnRoute, isPassingNow } = item;
      if (!isTarget && !isStart) continue;
      const cSign = this._worldToCamera(signX, signY, signZ, cosYaw, sinYaw);
      if (cSign.rx < 9 || cSign.rx > 360) continue;
      if (Math.abs(cSign.ry) > cSign.rx * 1.05) continue;

      const isImportant = isStart || isTarget || isEnRoute || isPassingNow || store.is_anchor;
      if (!isImportant && cSign.rx > 240) continue;

      const pSign = this._projectCamVerts([cSign], cx, horizonY, fovScale)[0];
      const scaleFactor = Math.max(0.62, Math.min(1.56, 122 / cSign.rx)) * (W / 1100 + 0.38);

      ctx.save();
      const unitStr = store.unit ? `${store.unit} • ` : '';
      const labelText = `${unitStr}${store.name}`;
      const fontSize = Math.round(Math.max(10.5, Math.min(19.5, 13 * scaleFactor)));
      ctx.font = `800 ${fontSize}px "Plus Jakarta Sans", sans-serif`;

      const logoImg = this._getStoreLogoImage(store);
      const hasReadyLogo = !!(logoImg && logoImg.complete && logoImg.naturalWidth > 0);
      const logoSize = hasReadyLogo ? Math.round(fontSize * 1.85) : 0;
      const logoGap = hasReadyLogo ? Math.round(6.5 * scaleFactor) : 0;

      const textMetrics = ctx.measureText(labelText);
      const padX = 9.5 * scaleFactor;
      const boxW = logoSize + logoGap + textMetrics.width + padX * 2;
      const boxH = Math.max(logoSize + 6, fontSize + 10 * scaleFactor);

      // Sol üstteki #floor-header-card bilgi kartının altına girmemesi için güvenli Y sınırı
      const headerSafeY = (pSign.x < W * 0.60) ? Math.min(H * 0.34, 228) : 34;
      const signCenterY = Math.max(pSign.y, headerSafeY + boxH / 2);
      const boxX = Math.max(8, Math.min(W - boxW - 8, pSign.x - boxW / 2));
      const boxY = signCenterY - boxH / 2;

      // Tabela Arka Plan Hapı
      if (isTarget) {
        ctx.fillStyle = '#dc2626';
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 2.5;
      } else if (isStart) {
        ctx.fillStyle = '#059669';
        ctx.strokeStyle = '#a7f3d0';
        ctx.lineWidth = 2.2;
      } else if (isPassingNow || isEnRoute) {
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 2.4;
      } else {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.48)';
        ctx.lineWidth = 1.5;
      }

      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(boxX, boxY, boxW, boxH, 9);
      } else {
        ctx.rect(boxX, boxY, boxW, boxH);
      }
      ctx.fill();
      ctx.stroke();

      // Tabela Solunda Kurumsal Marka Logosu Rozeti
      if (hasReadyLogo) {
        const iconX = boxX + padX * 0.75;
        const iconY = signCenterY - logoSize / 2;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(iconX, iconY, logoSize, logoSize, 5);
        else ctx.rect(iconX, iconY, logoSize, logoSize);
        ctx.fill();
        ctx.drawImage(logoImg, iconX + 1.5, iconY + 1.5, logoSize - 3, logoSize - 3);
        this.logosRenderedLastFrame++;
      }

      // Mağaza Adı + Kapı No
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const textStartX = boxX + padX + (hasReadyLogo ? logoSize + logoGap : 0);
      ctx.fillText(labelText, textStartX, signCenterY);

      this.storeHitBoxes.push({
        x1: boxX,
        y1: boxY,
        x2: boxX + boxW,
        y2: boxY + boxH,
        store,
        dist: cSign.rx
      });

      // Üst Durum Rozeti (Hedef / Başlangıç / Yanından Geçilen Mağaza / İndirim)
      let topBadgeText = null;
      let topBadgeBg = '#10b981';
      if (isTarget) {
        const distM = Math.max(1, Math.round(cSign.rx * 0.22));
        topBadgeText = `🎯 HEDEFİNİZ (${distM}m)`;
        topBadgeBg = '#ef4444';
      } else if (isStart) {
        topBadgeText = '📍 BAŞLANGIÇ NOKTANIZ';
        topBadgeBg = '#059669';
      } else if (isPassingNow) {
        topBadgeText = `👀 ${this.currentlyPassingSide ? this.currentlyPassingSide.toUpperCase() : 'YANINIZDA'} GEÇİYORSUNUZ`;
        topBadgeBg = '#0d9488';
      } else if (isEnRoute) {
        topBadgeText = '👀 ROTA ÜSTÜ MAĞAZA';
        topBadgeBg = '#059669';
      } else if (store.campaign && store.campaign.discount) {
        topBadgeText = `🔥 ${store.campaign.discount}`;
        topBadgeBg = '#d97706';
      }

      if (topBadgeText) {
        const subFont = Math.max(9, Math.round(fontSize * 0.76));
        ctx.font = `800 ${subFont}px "Plus Jakarta Sans", sans-serif`;
        const subW = ctx.measureText(topBadgeText).width + 12;
        const subH = subFont + 6;
        const subX = boxX + boxW / 2 - subW / 2;
        const subY = boxY - subH - 4;

        ctx.fillStyle = topBadgeBg;
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(subX, subY, subW, subH, 6);
        } else {
          ctx.rect(subX, subY, subW, subH);
        }
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(topBadgeText, boxX + boxW / 2, subY + subH / 2);
      }

      ctx.restore();
    }
  }

  /**
   * Kat Değişimi Sırasında Birinci Şahıs (First-Person) 3B Yürüyen Merdiven / Panoramik Asansör Sürüş Deneyimi
   */
  _renderFloorTransitionOverlay(ctx, W, H, now = performance.now()) {
    const st = this.floorTransitionState;
    if (!st) return;
    const fromLabel = this.mallData?.floors[st.fromFloor]?.label || `${st.fromFloor}. Kat`;
    const toLabel = this.mallData?.floors[st.toFloor]?.label || `${st.toFloor}. Kat`;
    const isElev = st.portalType === 'elevator';
    const goingUp = st.toFloor > st.fromFloor;
    const prog = Math.min(1, Math.max(0, st.timer / Math.max(0.1, st.duration)));

    ctx.save();

    // 1. Arka plandaki 3B AVM atriumunu kapatmayan hafif cam atmosfer filtresi
    ctx.fillStyle = 'rgba(15, 23, 42, 0.34)';
    ctx.fillRect(0, 0, W, H);

    const cx = W * 0.5;
    const vanishY = goingUp ? (H * 0.36 - prog * 18) : (H * 0.52 + prog * 18);

    if (!isElev) {
      // === 3B BİRİNCİ ŞAHIS YÜRÜYEN MERDİVEN SÜRÜŞÜ (SOL/SAĞ CAM KORKULUKLAR & AKAN BASAMAKLAR) ===
      const nearHalfW = Math.min(W * 0.44, 380);
      const farHalfW = Math.min(W * 0.13, 115);
      const botY = H;
      const topY = vanishY;

      // Sol ve Sağ 3B Temperli Cam Korkuluk Panelleri (Balustrades)
      const railDropNear = H * 0.25;
      const railDropFar = H * 0.08;

      // Sol Cam Korkuluk
      ctx.fillStyle = 'rgba(56, 189, 248, 0.28)';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(cx - nearHalfW, botY);
      ctx.lineTo(cx - farHalfW, topY + railDropFar);
      ctx.lineTo(cx - farHalfW, topY);
      ctx.lineTo(cx - nearHalfW, botY - railDropNear);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Sağ Cam Korkuluk
      ctx.beginPath();
      ctx.moveTo(cx + nearHalfW, botY);
      ctx.lineTo(cx + farHalfW, topY + railDropFar);
      ctx.lineTo(cx + farHalfW, topY);
      ctx.lineTo(cx + nearHalfW, botY - railDropNear);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Yürüyen Merdiven Çelik Basamak Yatağı
      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.beginPath();
      ctx.moveTo(cx - nearHalfW, botY);
      ctx.lineTo(cx + nearHalfW, botY);
      ctx.lineTo(cx + farHalfW, topY + railDropFar);
      ctx.lineTo(cx - farHalfW, topY + railDropFar);
      ctx.closePath();
      ctx.fill();

      // Perspektifte Akan 3B Yürüyen Merdiven Basamakları + Sarı Güvenlik Çizgileri
      const stepCount = 10;
      const phase = ((now * 0.0032 * (goingUp ? -1 : 1)) % 1 + 1) % 1;
      for (let i = 0; i < stepCount; i++) {
        // Perspektif derinlik dağılımı (kuadratik)
        const linearT = (i + phase) / stepCount;
        const pT = linearT * linearT;
        const nextLinearT = Math.min(1, (i + phase + 0.55) / stepCount);
        const nextPT = nextLinearT * nextLinearT;

        const y1 = (topY + railDropFar) + (botY - (topY + railDropFar)) * pT;
        const y2 = (topY + railDropFar) + (botY - (topY + railDropFar)) * nextPT;
        const hw1 = farHalfW + (nearHalfW - farHalfW) * pT;
        const hw2 = farHalfW + (nearHalfW - farHalfW) * nextPT;
        const riserH = Math.max(4, 22 * pT);

        // Basamak Üst Yüzeyi (Tread)
        ctx.fillStyle = i % 2 === 0 ? '#334155' : '#475569';
        ctx.beginPath();
        ctx.moveTo(cx - hw1, y1);
        ctx.lineTo(cx + hw1, y1);
        ctx.lineTo(cx + hw2, y2);
        ctx.lineTo(cx - hw2, y2);
        ctx.closePath();
        ctx.fill();

        // Basamak Aynası (Riser) & Sarı Güvenlik Çizgisi
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(cx - hw1, y1 - riserH * 0.45, hw1 * 2, riserH * 0.45);

        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = Math.max(1.5, 4.2 * pT);
        ctx.beginPath();
        ctx.moveTo(cx - hw1 * 0.96, y1);
        ctx.lineTo(cx + hw1 * 0.96, y1);
        ctx.stroke();
      }

      // Sol ve Sağ Hareketli Küpeşte Bantları (Handrails)
      ctx.strokeStyle = '#4f46e5';
      ctx.lineWidth = Math.max(8, W * 0.012);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - nearHalfW, botY - railDropNear);
      ctx.lineTo(cx - farHalfW, topY);
      ctx.moveTo(cx + nearHalfW, botY - railDropNear);
      ctx.lineTo(cx + farHalfW, topY);
      ctx.stroke();
    } else {
      // === 3B PANORAMİK CAM ASANSÖR KABİN ÇERÇEVESİ ===
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.75)';
      ctx.lineWidth = 6;
      ctx.strokeRect(W * 0.12, H * 0.10, W * 0.76, H * 0.80);
    }

    // 2. Üst Orta Bilgi Kartı (Kat Geçiş Durumu + Canlı İlerleme Çubuğu)
    const cardW = Math.min(W - 32, 430);
    const cardH = 86;
    const cardX = cx - cardW / 2;
    const cardY = Math.max(96, H * 0.16);

    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.strokeStyle = isElev ? '#38bdf8' : '#818cf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(cardX, cardY, cardW, cardH, 16);
    else ctx.rect(cardX, cardY, cardW, cardH);
    ctx.fill();
    ctx.stroke();

    const icon = isElev ? '🛗' : '🪜';
    const modeTitle = isElev ? 'PANORAMİK ASANSÖR' : '3B YÜRÜYEN MERDİVEN';
    const dirText = goingUp ? '⬆️ Üst Kata Çıkılıyor' : '⬇️ Alt Kata İniliyor';

    ctx.fillStyle = '#a5b4fc';
    ctx.font = `800 11px "Plus Jakarta Sans", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(`${icon} ${modeTitle} • ${dirText.toUpperCase()}`, cx, cardY + 24);

    ctx.fillStyle = '#ffffff';
    ctx.font = `800 ${Math.max(15, Math.min(19, Math.round(W * 0.022)))}px "Plus Jakarta Sans", sans-serif`;
    ctx.fillText(`${fromLabel} ➔ ${toLabel}`, cx, cardY + 48);

    // İlerleme çubuğu
    const barW = cardW - 48;
    const barH = 7;
    const barX = cx - barW / 2;
    const barY = cardY + 66;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(barX, barY, barW, barH, 4);
    else ctx.rect(barX, barY, barW, barH);
    ctx.fill();

    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(barX, barY, Math.max(10, barW * prog), barH, 4);
    else ctx.rect(barX, barY, Math.max(10, barW * prog), barH);
    ctx.fill();

    ctx.restore();
  }

  /**
   * Sağ Alt Köşede Canlı 2B Radar Mini-Harita (Kullanıcının Konumu, Rota İzi ve Tıkla & Işınlan)
   */
  _renderMiniRadar(ctx, W, H, effectiveYaw) {
    const isMobile = W < 650;
    const rW = isMobile ? Math.min(130, W * 0.32) : Math.min(210, W * 0.20);
    const rH = rW * (850 / 1400);
    const pad = isMobile ? 12 : 18;
    const bottomOffset = isMobile ? 212 : 78;
    const rx = W - rW - pad;
    const ry = H - rH - bottomOffset;

    this.radarRect = { x: rx, y: ry, w: rW, h: rH };

    ctx.save();
    // Radar Arka Plan Kartı
    ctx.fillStyle = 'rgba(15, 23, 42, 0.90)';
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.65)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(rx, ry, rW, rH, 12);
    } else {
      ctx.rect(rx, ry, rW, rH);
    }
    ctx.fill();
    ctx.stroke();

    const scaleX = rW / 1400;
    const scaleY = rH / 850;

    // Yürünebilir koridor izi
    ctx.fillStyle = 'rgba(56, 189, 248, 0.10)';
    ctx.fillRect(rx + 180 * scaleX, ry + 390 * scaleY, 1040 * scaleX, 75 * scaleY);

    // Bu kattaki mağaza kutucukları
    const floorStores = this.mallData?.floors[this.currentFloor]?.stores || [];
    const enRouteSet = new Set(this.route?.enRouteStoreIds || []);
    for (const s of floorStores) {
      const sx = rx + (s.x ?? (s.cx - 30)) * scaleX;
      const sy = ry + (s.y ?? (s.cy - 30)) * scaleY;
      const sw = Math.max(2, (s.w || 60) * scaleX);
      const sh = Math.max(2, (s.h || 60) * scaleY);
      if (this.targetStore && s.id === this.targetStore.id) {
        ctx.fillStyle = '#ef4444';
      } else if (this.startStore && s.id === this.startStore.id) {
        ctx.fillStyle = '#10b981';
      } else if (this.selectedPopupStore && s.id === this.selectedPopupStore.id) {
        ctx.fillStyle = '#38bdf8';
      } else if (enRouteSet.has(s.id)) {
        ctx.fillStyle = 'rgba(16, 185, 129, 0.55)';
      } else {
        ctx.fillStyle = 'rgba(148, 163, 184, 0.24)';
      }
      ctx.fillRect(sx, sy, sw, sh);
    }

    // Aktif rota çizgisi
    if (this.route && this.route.pathNodes && this.route.pathNodes.length > 1) {
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      let started = false;
      for (const n of this.route.pathNodes) {
        if (n.floor !== this.currentFloor) {
          started = false;
          continue;
        }
        const nx = rx + n.x * scaleX;
        const ny = ry + n.y * scaleY;
        if (!started) {
          ctx.moveTo(nx, ny);
          started = true;
        } else {
          ctx.lineTo(nx, ny);
        }
      }
      ctx.stroke();
    }

    // X Kişisinin Canlı Konumu + 60° Görüş Hunisi (FOV Cone)
    const ux = rx + this.camX * scaleX;
    const uy = ry + this.camY * scaleY;
    const coneLen = 22;
    ctx.fillStyle = 'rgba(56, 189, 248, 0.38)';
    ctx.beginPath();
    ctx.moveTo(ux, uy);
    ctx.arc(ux, uy, coneLen, effectiveYaw - 0.52, effectiveYaw + 0.52);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#10b981';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(ux, uy, 4.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Radar Başlığı
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '800 8.5px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(isMobile ? '🗺️ 2B RADAR' : '🗺️ 2B RADAR (Tıkla & Git)', rx + 6, ry + 11);
    ctx.restore();
  }

  /**
   * Üst Orta 360° Dijital Pusula Şeridi ve AVM Galeri Sokak Görünümü Başlığı
   */
  _renderTopCompassBar(ctx, W, H, effectiveYaw) {
    const isMobile = W < 680;
    const barW = isMobile ? Math.min(250, W * 0.68) : 320;
    const barH = isMobile ? 34 : 38;
    const bx = isMobile ? (W * 0.5 - barW * 0.5) : Math.max(W * 0.52, W - barW - 68);
    const by = isMobile ? 74 : 16;

    // Radyan açısını 0..360 dereceye dönüştür (0=Doğu, 90=Güney, 180=Batı, 270=Kuzey)
    let deg = Math.round(((effectiveYaw * 180) / Math.PI) % 360);
    if (deg < 0) deg += 360;

    const dirs = [
      { angle: 0, label: 'DOĞU', short: 'D' },
      { angle: 45, label: 'G.DOĞU', short: 'GD' },
      { angle: 90, label: 'GÜNEY', short: 'G' },
      { angle: 135, label: 'G.BATI', short: 'GB' },
      { angle: 180, label: 'BATI', short: 'B' },
      { angle: 225, label: 'K.BATI', short: 'KB' },
      { angle: 270, label: 'KUZEY', short: 'K' },
      { angle: 315, label: 'K.DOĞU', short: 'KD' }
    ];

    let activeDir = dirs[0];
    let minDiff = 999;
    for (const d of dirs) {
      let diff = Math.abs(deg - d.angle);
      if (diff > 180) diff = 360 - diff;
      if (diff < minDiff) {
        minDiff = diff;
        activeDir = d;
      }
    }

    const floorLabel = this.mallData?.floors[this.currentFloor]?.label || 'Zemin Kat';
    const zoneName = this._getCorridorZoneName(this.camX, this.camY);

    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.84)';
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(bx, by, barW, barH, 999);
    else ctx.rect(bx, by, barW, barH);
    ctx.fill();
    ctx.stroke();

    // Sol rozet: Pusula yönü & derece
    ctx.fillStyle = '#38bdf8';
    ctx.font = `800 ${isMobile ? 10 : 11}px "Plus Jakarta Sans", sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`🧭 ${activeDir.short} ${deg}°`, bx + 14, by + barH * 0.5);

    // Orta ayırıcı
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.32)';
    ctx.beginPath();
    ctx.moveTo(bx + (isMobile ? 74 : 84), by + 8);
    ctx.lineTo(bx + (isMobile ? 74 : 84), by + barH - 8);
    ctx.stroke();

    // Sağ kısım: Aktif Kat & Galeri Sokağı Adı
    ctx.fillStyle = '#f8fafc';
    ctx.font = `700 ${isMobile ? 10 : 11}px "Plus Jakarta Sans", sans-serif`;
    const streetTitle = isMobile ? `${floorLabel} • ${zoneName.split(' ')[0]} Galeri` : `${floorLabel} • ${zoneName}`;
    ctx.fillText(streetTitle, bx + (isMobile ? 82 : 94), by + barH * 0.5);

    ctx.restore();
  }
}

window.Pov3DEngine = Pov3DEngine;

