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

    // DOM Referansları
    this.container = null;
    this.canvas = null;
    this.ctx = null;
    this.animFrameId = null;
    this.lastFrameTime = 0;

    // Drag / Look-around durumu
    this.isDragging = false;
    this.dragStartX = 0;
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

    // Fare / Dokunmatik ile 360° Etrafa Bakınma (Look Around)
    this.canvas.addEventListener('pointerdown', (e) => {
      this.isDragging = true;
      this.dragStartX = e.clientX;
      this.dragStartYawOffset = this.userYawOffset;
      this.canvas.setPointerCapture?.(e.pointerId);
    });

    this.canvas.addEventListener('pointermove', (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.dragStartX;
      this.userYawOffset = this.dragStartYawOffset - dx * 0.0055;
    });

    const endDrag = () => {
      this.isDragging = false;
    };
    this.canvas.addEventListener('pointerup', endDrag);
    this.canvas.addEventListener('pointercancel', endDrag);

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
   * Kullanıcı yalnızca başlangıç noktasını ("📍 Buradayım") pinlediğinde onun gözüne geçer
   */
  enterAtStartLocation(storeOrEntrance, autoActivate = true) {
    if (!storeOrEntrance) return;
    this.startStore = storeOrEntrance;
    this.currentFloor = storeOrEntrance.floor || 4;

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
    this.segIndex = 0;
    this.segProgress = 0;
    this.totalProgressPct = 0;
    this.remainingMeters = routeData.totalDistance || 0;
    this.announcedPassingStores.clear();
    this.currentlyPassingStore = null;
    this.floorTransitionState = null;
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

    this.isWalking = !!autoWalk;
    this._syncPlayPauseButton();
    this._updateHUDTexts();

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

  toggleWalk() {
    if (!this.route || !this.route.pathNodes || this.route.pathNodes.length < 2) {
      if (window.showToast) {
        window.showToast('🎯 Yürüyüşü başlatmak için lütfen gitmek istediğiniz mağazayı seçin.', 'info');
      }
      return;
    }
    if (this.totalProgressPct >= 100) {
      this.restartWalk();
      return;
    }
    this.isWalking = !this.isWalking;
    this._syncPlayPauseButton();
  }

  restartWalk() {
    if (!this.route) return;
    this.segIndex = 0;
    this.segProgress = 0;
    this.totalProgressPct = 0;
    this.announcedPassingStores.clear();
    this.currentlyPassingStore = null;
    this.floorTransitionState = null;
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
    if (window.mallMap && window.mallMap.currentFloor !== n0.floor) {
      window.mallMap.loadFloor(n0.floor);
    }
  }

  _syncPlayPauseButton() {
    const btn = document.getElementById('btn-pov-play-pause');
    if (!btn) return;
    if (this.isWalking) {
      btn.innerHTML = '<span>⏸️</span><span>Duraklat</span>';
    } else if (this.totalProgressPct >= 100) {
      btn.innerHTML = '<span>🔄</span><span>Tekrar Yürü</span>';
    } else {
      btn.innerHTML = '<span>▶️</span><span>Yürüyüşe Devam Et</span>';
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

    if (!this.isWalking || !this.route || !this.route.pathNodes || this.route.pathNodes.length < 2) {
      this.camZ = 26;
      return;
    }

    // Kat geçişi animasyonu (Yürüyen Merdiven / Asansör)
    if (this.floorTransitionState) {
      this.floorTransitionState.timer += dt * this.walkSpeed;
      if (this.floorTransitionState.timer >= this.floorTransitionState.duration) {
        const nextFloor = this.floorTransitionState.toFloor;
        this.currentFloor = nextFloor;
        this.floorTransitionState = null;
        this.segIndex++;
        this.segProgress = 0;
        if (window.mallMap && window.mallMap.currentFloor !== nextFloor) {
          window.mallMap.loadFloor(nextFloor);
        }
      }
      return;
    }

    const nodes = this.route.pathNodes;
    if (this.segIndex >= nodes.length - 1) {
      // Hedefe varıldı!
      this.isWalking = false;
      this.totalProgressPct = 100;
      this.remainingMeters = 0;
      this.camZ = 26;
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
        duration: 1.4,
        portalType: isElev ? 'elevator' : 'escalator'
      };
      const flLabel = this.mallData.floors[v.floor]?.label || `${v.floor}. Kat`;
      if (window.speakNavigationText) {
        window.speakNavigationText(`${isElev ? 'Asansör' : 'Yürüyen merdiven'} ile ${flLabel} katına ${v.floor > u.floor ? 'çıkılıyor' : 'iniliyor'}.`);
      }
      return;
    }

    // SESLİ KOMUT İLE YÜRÜME HIZI SENKRONİZASYONU:
    // Doğal insan yürüyüş hızı (38 SVG birimi/sn ~ 1.4 m/sn) + sesli tarif konuşulurken (speechBusyUntil)
    // adımları %58 tempoya yumuşatarak sesli komutun mağaza geçişleriyle birebir eşzamanlı kalmasını sağlar.
    const nowPerf = performance.now();
    const isSpeechSpeaking = nowPerf < (window.speechBusyUntil || 0);
    const speechSyncFactor = isSpeechSpeaking ? 0.58 : 1.0;

    const segLen = Math.max(1, Math.hypot(v.x - u.x, v.y - u.y));
    const baseSpeedUnitsPerSec = 38 * this.walkSpeed * speechSyncFactor;
    this.segProgress += (baseSpeedUnitsPerSec * dt) / segLen;

    // Doğal insan yürüyüşü kafa salınımı (Head-Bob)
    this.walkStepPhase += dt * 7.2 * this.walkSpeed * speechSyncFactor;
    this.camZ = 26 + Math.sin(this.walkStepPhase) * 0.55;

    while (this.segProgress >= 1.0 && this.segIndex < nodes.length - 1) {
      this.segProgress -= 1.0;
      this.segIndex++;
      if (this.segIndex >= nodes.length - 1) {
        this.segProgress = 0;
        this.camX = nodes[nodes.length - 1].x;
        this.camY = nodes[nodes.length - 1].y;
        this.camZ = 26;
        // Hedef mağazanın içine/cephesine doğru dön
        if (this.targetStore && this.targetStore.cx !== undefined) {
          this.targetYaw = Math.atan2(this.targetStore.cy - this.camY, this.targetStore.cx - this.camX);
        }
        this.isWalking = false;
        this.totalProgressPct = 100;
        this.remainingMeters = 0;
        this._syncPlayPauseButton();
        this._updateHUDTexts();
        if (window.updateLiveNavHUD) window.updateLiveNavHUD(-1, 100);
        const qrModal = document.getElementById('route-qr-modal');
        const isQrOpen = qrModal && !qrModal.classList.contains('hidden');
        if (window.showToast && !isQrOpen) {
          window.showToast(`🎉 ${this.targetStore ? this.targetStore.name : 'Hedef'} mağazasına ulaştınız!`, 'success');
        }
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

    // İlerleme yüzdesi ve kalan mesafe
    const totalSegs = Math.max(1, nodes.length - 1);
    this.totalProgressPct = Math.min(99, Math.round(((this.segIndex + this.segProgress) / totalSegs) * 100));
    this.remainingMeters = Math.max(1, Math.round((this.route.totalDistance || 50) * (1 - this.totalProgressPct / 100)));

    // Şu an yanından geçilen mağazayı tespit et (En-Route Proximity + Sağ/Sol Yön Algısı)
    this._detectPassingStore();

    // Üst HUD ve Ana Harita HUD senkronu (Yalnızca düğüm değiştiğinde ve rota aktifken)
    this._updateHUDTexts();
    if (window.updateLiveNavHUD && document.body.classList.contains('has-active-route') && this._lastSyncedSegIndex !== this.segIndex) {
      this._lastSyncedSegIndex = this.segIndex;
      window.updateLiveNavHUD(this.segIndex, this.totalProgressPct);
    }
  }

  _detectPassingStore() {
    const floorStores = this.mallData?.floors[this.currentFloor]?.stores || [];
    let closest = null;
    let minD = 46;
    let closestSide = 'Yanınızda';

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
      if (d < minD) {
        // Kamera koordinatlarında mağazanın ileri/yan izdüşümü
        const forwardProj = dx * cosYaw + dy * sinYaw;
        const rightProj = -dx * sinYaw + dy * cosYaw;
        if (forwardProj > -14 && forwardProj < 36) {
          minD = d;
          closest = s;
          closestSide = rightProj < 0 ? 'Solunuzda' : 'Sağınızda';
        }
      }
    }

    if (closest && (!this.currentlyPassingStore || this.currentlyPassingStore.id !== closest.id)) {
      this.currentlyPassingStore = closest;
      this.currentlyPassingSide = closestSide;
      if (!this.announcedPassingStores.has(closest.id)) {
        this.announcedPassingStores.add(closest.id);
        // Sesli rehber açıksa, ana manevra cümlesini kesmeden (isStoreCue=true) tam mağazanın yanından geçerken söyle
        if (window.isVoiceEnabled && window.speakNavigationText && this.totalProgressPct > 6 && this.totalProgressPct < 92) {
          window.speakNavigationText(`${closestSide} ${closest.name}`, false, true);
        }
      }
    } else if (!closest) {
      this.currentlyPassingStore = null;
    }
  }

  _updateHUDTexts() {
    const titleEl = document.getElementById('pov-hud-title');
    const stepEl = document.getElementById('pov-hud-step');
    const passingBadge = document.getElementById('pov-hud-passing');
    const passingLogoEl = document.getElementById('pov-hud-passing-logo');
    const passingText = document.getElementById('pov-hud-passing-text');
    const distEl = document.getElementById('pov-hud-distance');
    const progressFill = document.getElementById('pov-hud-progress-fill');

    const floorLabel = this.mallData?.floors[this.currentFloor]?.label || 'Zemin Kat';

    if (this.route && this.targetStore) {
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
    } else if (this.startStore) {
      if (titleEl) {
        titleEl.textContent = `👁️ Şu An Buradasınız: ${this.startStore.name.replace(/^📍\s*/, '')} (${floorLabel})`;
      }
      if (stepEl) {
        stepEl.textContent = '🎯 Gitmek istediğiniz mağazayı seçin veya 🎙️ Sesli Komut verin; gözünüzden yürüyelim!';
      }
      if (distEl) distEl.textContent = floorLabel;
      if (progressFill) progressFill.style.width = '0%';
    }

    if (passingBadge && passingText) {
      if (this.currentlyPassingStore) {
        const s = this.currentlyPassingStore;
        if (passingLogoEl && typeof window.getStoreLogo === 'function') {
          passingLogoEl.innerHTML = window.getStoreLogo(s, 18);
          passingLogoEl.classList.remove('hidden');
        }
        const unitStr = s.unit ? ` (${s.unit})` : '';
        passingText.textContent = `👀 ${this.currentlyPassingSide || 'Yanınızda'}: ${s.name}${unitStr}`;
        passingBadge.classList.remove('hidden');
      } else if (this.route && this.route.enRouteStoreNames && this.route.enRouteStoreNames.length > 0) {
        // Rota üzerindeki ilk mağazanın logosunu da göster
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
    ctx.clearRect(0, 0, W, H);

    // 1. MİMARİ CAM TAVAN (SKYLIGHT ATRİUM), ALÜMİNYUM KİRİŞLER & Sıcak LED Cove Işıklar (0 .. horizonY)
    const ceilGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
    ceilGrad.addColorStop(0, '#0c192c');
    ceilGrad.addColorStop(0.38, '#172a45');
    ceilGrad.addColorStop(0.78, '#263c5c');
    ceilGrad.addColorStop(1, '#3b5275');
    ctx.fillStyle = ceilGrad;
    ctx.fillRect(0, 0, W, horizonY + 2);

    // Cam Tavan (Skylight) Merkez Işıltısı
    const skyGlow = ctx.createRadialGradient(cx, horizonY * 0.25, 10, cx, horizonY * 0.35, W * 0.55);
    skyGlow.addColorStop(0, 'rgba(186, 230, 253, 0.24)');
    skyGlow.addColorStop(0.5, 'rgba(254, 243, 199, 0.12)');
    skyGlow.addColorStop(1, 'rgba(15, 23, 42, 0)');
    ctx.fillStyle = skyGlow;
    ctx.fillRect(0, 0, W, horizonY);

    // 2. CILALI MERMER AVM KORİDOR ZEMİNİ (horizonY .. H)
    const floorGrad = ctx.createLinearGradient(0, horizonY, 0, H);
    floorGrad.addColorStop(0, '#cbd5e1');
    floorGrad.addColorStop(0.18, '#e2e8f0');
    floorGrad.addColorStop(0.55, '#f1f5f9');
    floorGrad.addColorStop(1, '#f8fafc');
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, horizonY, W, H - horizonY);

    // Mermer zemin üzerinde sıcak koridor tavan yansıması
    const floorReflect = ctx.createLinearGradient(cx - W * 0.25, horizonY, cx + W * 0.25, horizonY);
    floorReflect.addColorStop(0, 'rgba(254, 243, 199, 0)');
    floorReflect.addColorStop(0.5, 'rgba(254, 243, 199, 0.24)');
    floorReflect.addColorStop(1, 'rgba(254, 243, 199, 0)');
    ctx.fillStyle = floorReflect;
    ctx.fillRect(0, horizonY, W, H - horizonY);

    // 3. 3B PERSPEKTİF MERMER KARO IZGARASI, CAM TAVAN KİRİŞLERİ VE SICAK TAVAN SPOTLARI
    ctx.save();
    ctx.strokeStyle = 'rgba(100, 116, 139, 0.18)';
    ctx.lineWidth = Math.max(1, W / 900);
    const gridStep = 65;
    const minGX = Math.floor((this.camX - 420) / gridStep) * gridStep;
    const maxGX = Math.ceil((this.camX + 420) / gridStep) * gridStep;
    const minGY = Math.floor((this.camY - 420) / gridStep) * gridStep;
    const maxGY = Math.ceil((this.camY + 420) / gridStep) * gridStep;

    for (let gx = minGX; gx <= maxGX; gx += gridStep) {
      // Zemin mermer derzleri
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

      // Cam tavan çelik/alüminyum skylight kirişleri (wz = 68)
      const t1 = this._worldToCamera(gx, minGY, 68, cosYaw, sinYaw);
      const t2 = this._worldToCamera(gx, maxGY, 68, cosYaw, sinYaw);
      const clippedT = this._clipPolygonNear([t1, t2], 8);
      if (clippedT.length === 2) {
        const pt = this._projectCamVerts(clippedT, cx, horizonY, fovScale);
        ctx.save();
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
        ctx.lineWidth = Math.max(1, W / 850);
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

    // Tavan Sıcak Altın LED Spot Işıkları & Skylight Panelleri (wz = 68)
    for (let gx = minGX; gx <= maxGX; gx += gridStep) {
      for (let gy = minGY; gy <= maxGY; gy += gridStep) {
        const cSpot = this._worldToCamera(gx, gy, 68, cosYaw, sinYaw);
        if (cSpot.rx > 15 && cSpot.rx < 420 && Math.abs(cSpot.ry) < cSpot.rx * 1.1) {
          const sx = cx + (cSpot.ry / cSpot.rx) * fovScale;
          const sy = horizonY - (cSpot.rz / cSpot.rx) * fovScale;
          const rad = Math.max(1.8, (560 / cSpot.rx) * (W / 1150));
          // Dış sıcak hale
          ctx.fillStyle = 'rgba(253, 230, 138, 0.26)';
          ctx.beginPath();
          ctx.arc(sx, sy, rad * 2.1, 0, Math.PI * 2);
          ctx.fill();
          // İç spot çekirdeği
          ctx.fillStyle = 'rgba(255, 251, 235, 0.85)';
          ctx.beginPath();
          ctx.arc(sx, sy, rad, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.restore();

    // 4. YERDEKİ 3B PARLAYAN NAVİGASYON HALISI VE HAREKETLİ OKLAR (AR FLOOR PATH)
    if (this.route && this.route.pathNodes && this.route.pathNodes.length > 1) {
      this._render3DFloorRoute(ctx, cx, horizonY, fovScale, cosYaw, sinYaw, now, W);
    }

    // 5. ZEMİN KAT MÜZİKLİ GÖSTERİ HAVUZU (3B Animasyonlu Fıskiyeli Havuz)
    if (this.currentFloor === 4) {
      this._render3DFountainPool(ctx, cx, horizonY, fovScale, cosYaw, sinYaw, now, W);
    }

    // 6. 3B AVM İÇ MEKAN MOBİLYALARI (Palmiye Saksıları, Oturma Bankları) & SERVİS TOTEMLERİ (WC, Asansör, Bebek Odası, Acil Çıkış, Kiosk)
    this._render3DAmenitiesAndDecor(ctx, cx, horizonY, fovScale, cosYaw, sinYaw, now, W);

    // 7. 3B MAĞAZA CEPHELERİ, VİTRİN CAMLARI, KURUMSAL MARKA LOGOLARI VE IŞIKLI TABELALAR
    this._render3DStorefronts(ctx, cx, horizonY, fovScale, cosYaw, sinYaw, now, W, H);

    // 8. KAT GEÇİŞİ (YÜRÜYEN MERDİVEN / ASANSÖR) EFEKTİ
    if (this.floorTransitionState) {
      this._renderFloorTransitionOverlay(ctx, W, H);
    }

    // 9. SAĞ ALT KÖŞE CANLI 2B RADAR MİNİ-HARİTA (Kullanıcının Konumu, Servisler ve Bakış Hunisi)
    this._renderMiniRadar(ctx, W, H, effectiveYaw);
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
      const cCenter = this._worldToCamera(poolX, poolY, 28, cosYaw, sinYaw);
      if (cCenter.rx > 12 && cCenter.rx < 450 && Math.abs(cCenter.ry) < cCenter.rx * 0.95) {
        const pTop = this._projectCamVerts([cCenter], cx, horizonY, fovScale)[0];
        ctx.fillStyle = 'rgba(2, 132, 199, 0.92)';
        const fontSz = Math.max(10, Math.min(15, Math.round(1350 / cCenter.rx)));
        ctx.font = `800 ${fontSz}px "Plus Jakarta Sans", sans-serif`;
        const lbl = '🌊 MÜZİKLİ GÖSTERİ HAVUZU';
        const tw = ctx.measureText(lbl).width + 14;
        const th = fontSz + 8;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(pTop.x - tw / 2, pTop.y - th / 2, tw, th, 8);
        else ctx.rect(pTop.x - tw / 2, pTop.y - th / 2, tw, th);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(lbl, pTop.x, pTop.y);
      }
      ctx.restore();
    }
  }

  /**
   * Koridor İçindeki 3B Palmiye Saksıları, Ahşap Dinlenme Bankları ve Doğrulanmış 3B Hizmet Totemleri
   * (Asansör, Yürüyen Merdiven, Bebek Bakım Odası, Acil Çıkış, WC, Kiosk Harita, Otopark)
   */
  _render3DAmenitiesAndDecor(ctx, cx, horizonY, fovScale, cosYaw, sinYaw, now, W) {
    // 1. Koridor Peyzaj Saksıları & Oturma Bankları (AVM Atmosferi)
    const decorPoints = [
      { x: 460, y: 270 }, { x: 640, y: 270 }, { x: 860, y: 270 }, { x: 1040, y: 270 },
      { x: 460, y: 515 }, { x: 640, y: 515 }, { x: 860, y: 515 }, { x: 1040, y: 515 }
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

    // 2. Bu Kattaki Tüm Doğrulanmış Servis ve Güvenlik Noktaları (Amenities)
    const amenities = this.mallData?.floors[this.currentFloor]?.amenities || [];
    if (!amenities.length) return;

    const AMENITY_STYLE = {
      emergency: { icon: '🚨', label: 'ACİL ÇIKIŞ', bg: '#dc2626', border: '#fef08a' },
      elevator:  { icon: '🛗', label: 'ASANSÖR', bg: '#0284c7', border: '#bae6fd' },
      escalator: { icon: '🪜', label: 'YÜRÜYEN MERDİVEN', bg: '#4f46e5', border: '#c7d2fe' },
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
      const d = Math.hypot((am.cx || 700) - this.camX, (am.cy || 425) - this.camY);
      if (d <= 330) {
        visibleAm.push({ am, d });
      }
    }
    visibleAm.sort((a, b) => b.d - a.d);

    ctx.save();
    for (const { am } of visibleAm) {
      const kind = (am.kind || am.type || 'info').toLowerCase();
      const st = AMENITY_STYLE[kind] || AMENITY_STYLE.info;
      const cTotem = this._worldToCamera(am.cx || 700, am.cy || 425, 36, cosYaw, sinYaw);
      if (cTotem.rx < 12 || cTotem.rx > 320 || Math.abs(cTotem.ry) > cTotem.rx * 0.92) continue;

      const isTargetAm = this.targetStore && this.targetStore.id === am.id;
      if (!isTargetAm && cTotem.rx > 210 && kind !== 'emergency' && kind !== 'elevator' && kind !== 'kiosk') continue;

      const pT = this._projectCamVerts([cTotem], cx, horizonY, fovScale)[0];
      const sc = Math.max(0.55, Math.min(1.35, 95 / cTotem.rx)) * (W / 1150 + 0.32);
      const fSize = Math.round(Math.max(9, Math.min(15, 11 * sc)));
      ctx.font = `800 ${fSize}px "Plus Jakarta Sans", sans-serif`;

      const text = `${st.icon} ${st.label}`;
      const tw = ctx.measureText(text).width + 14 * sc;
      const th = fSize + 8 * sc;
      const bx = pT.x - tw / 2;
      const by = pT.y - th / 2;

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
      ctx.fillText(text, pT.x, pT.y);
    }
    ctx.restore();
  }

  _render3DStorefronts(ctx, cx, horizonY, fovScale, cosYaw, sinYaw, now, W, H) {
    const floorStores = this.mallData?.floors[this.currentFloor]?.stores || [];
    if (!floorStores.length) return;

    const enRouteSet = new Set(this.route?.enRouteStoreIds || []);
    const wallQuads = [];
    const storeSignAnchors = [];

    const wallHeight = 62;
    const fasciaBottom = 42;

    for (const s of floorStores) {
      const sx = s.x !== undefined ? s.x : (s.cx - (s.w || 70) / 2);
      const sy = s.y !== undefined ? s.y : (s.cy - (s.h || 90) / 2);
      const sw = s.w || 70;
      const sh = s.h || 90;

      const distToStore = Math.hypot((s.door_x ?? s.cx) - this.camX, (s.door_y ?? s.cy) - this.camY);
      const dyCorridor = Math.abs((s.door_y ?? s.cy) - this.camY);
      if (distToStore > 360 || dyCorridor > 175) continue;

      const isStart = this.startStore && this.startStore.id === s.id;
      const isTarget = this.targetStore && this.targetStore.id === s.id;
      const isEnRoute = enRouteSet.has(s.id);
      const isPassingNow = this.currentlyPassingStore && this.currentlyPassingStore.id === s.id;

      // Mağazanın 4 köşe noktası
      const corners = [
        { x: sx, y: sy },           // 0: Sol-Üst (NW) -> Kuzey Kenarı (0->1)
        { x: sx + sw, y: sy },      // 1: Sağ-Üst (NE) -> Doğu Kenarı (1->2)
        { x: sx + sw, y: sy + sh }, // 2: Sağ-Alt (SE) -> Güney Kenarı (2->3)
        { x: sx, y: sy + sh }       // 3: Sol-Alt (SW) -> Batı Kenarı (3->0)
      ];

      // Kameraya / Koridora paralel bakan ön vitrin cephesini seç
      const storeCenterY = sy + sh * 0.5;
      let frontEdgeIdx = storeCenterY >= this.camY ? 0 : 2;
      if (sx > 1190 && Math.abs(storeCenterY - this.camY) < 90) frontEdgeIdx = 3;
      else if (sx + sw < 210 && Math.abs(storeCenterY - this.camY) < 90) frontEdgeIdx = 1;

      const rawA = corners[frontEdgeIdx];
      const rawB = corners[(frontEdgeIdx + 1) % 4];
      const storeCenterX = sx + sw * 0.5;
      const rawMidX = (rawA.x + rawB.x) * 0.5;
      const rawMidY = (rawA.y + rawB.y) * 0.5;
      const inVecX = storeCenterX - rawMidX;
      const inVecY = storeCenterY - rawMidY;
      const inLen = Math.max(1, Math.hypot(inVecX, inVecY));
      const setback = 22;
      const shiftX = (inVecX / inLen) * setback;
      const shiftY = (inVecY / inLen) * setback;

      const cA = { x: rawA.x + shiftX, y: rawA.y + shiftY };
      const cB = { x: rawB.x + shiftX, y: rawB.y + shiftY };
      const midX = (cA.x + cB.x) * 0.5;
      const midY = (cA.y + cB.y) * 0.5;
      const wallDist = Math.hypot(midX - this.camX, midY - this.camY);

      if (wallDist <= 380) {
        wallQuads.push({
          store: s,
          cA,
          cB,
          midX,
          midY,
          wallDist,
          isFrontFacade: true,
          isStart,
          isTarget,
          isEnRoute,
          isPassingNow
        });

        storeSignAnchors.push({
          store: s,
          signX: midX,
          signY: midY,
          signZ: 51,
          dist: wallDist,
          isStart,
          isTarget,
          isEnRoute,
          isPassingNow
        });
      }
    }

    // Uzaktan yakına sırala (Painter's Algorithm)
    wallQuads.sort((a, b) => b.wallDist - a.wallDist);

    for (const wq of wallQuads) {
      const { store, cA, cB, midX, midY, isFrontFacade, isStart, isTarget, isEnRoute, isPassingNow, wallDist } = wq;
      const catStyle = this._getCategoryColors(store.category);

      // 1. Ana Vitrin Duvarı (z = 0 .. wallHeight)
      const camWall = [
        this._worldToCamera(cA.x, cA.y, 0, cosYaw, sinYaw),
        this._worldToCamera(cB.x, cB.y, 0, cosYaw, sinYaw),
        this._worldToCamera(cB.x, cB.y, wallHeight, cosYaw, sinYaw),
        this._worldToCamera(cA.x, cA.y, wallHeight, cosYaw, sinYaw)
      ];
      const clippedWall = this._clipPolygonNear(camWall, 6.5);
      if (clippedWall.length < 3) continue;

      const scrWall = this._projectCamVerts(clippedWall, cx, horizonY, fovScale);

      ctx.save();
      const fogAlpha = Math.max(0.32, Math.min(0.97, 1 - wallDist / 540));

      if (isTarget) {
        ctx.fillStyle = '#fee2e2';
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 3.2;
      } else if (isStart) {
        ctx.fillStyle = '#d1fae5';
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 3.0;
      } else if (isPassingNow || isEnRoute) {
        ctx.fillStyle = '#ecfdf5';
        ctx.strokeStyle = isPassingNow ? '#059669' : '#10b981';
        ctx.lineWidth = 2.6;
      } else {
        ctx.fillStyle = catStyle.wall;
        ctx.strokeStyle = catStyle.border;
        ctx.lineWidth = 1.6;
      }

      ctx.globalAlpha = fogAlpha;
      ctx.beginPath();
      ctx.moveTo(scrWall[0].x, scrWall[0].y);
      for (let k = 1; k < scrWall.length; k++) ctx.lineTo(scrWall[k].x, scrWall[k].y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // 1B. Sıcak Aydınlatmalı Cam Vitrin & Çift Kanatlı Cam Kapı Doğramaları (z = 2 .. fasciaBottom - 2)
      const glassA = { x: cA.x + (cB.x - cA.x) * 0.06, y: cA.y + (cB.y - cA.y) * 0.06 };
      const glassB = { x: cA.x + (cB.x - cA.x) * 0.94, y: cA.y + (cB.y - cA.y) * 0.94 };
      const camGlass = [
        this._worldToCamera(glassA.x, glassA.y, 1.5, cosYaw, sinYaw),
        this._worldToCamera(glassB.x, glassB.y, 1.5, cosYaw, sinYaw),
        this._worldToCamera(glassB.x, glassB.y, fasciaBottom - 2, cosYaw, sinYaw),
        this._worldToCamera(glassA.x, glassA.y, fasciaBottom - 2, cosYaw, sinYaw)
      ];
      const clippedGlass = this._clipPolygonNear(camGlass, 6.5);
      if (clippedGlass.length >= 3) {
        const scrGlass = this._projectCamVerts(clippedGlass, cx, horizonY, fovScale);
        ctx.fillStyle = isPassingNow ? 'rgba(254, 249, 195, 0.78)' : 'rgba(255, 251, 235, 0.65)';
        ctx.strokeStyle = 'rgba(100, 116, 139, 0.55)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(scrGlass[0].x, scrGlass[0].y);
        for (let k = 1; k < scrGlass.length; k++) ctx.lineTo(scrGlass[k].x, scrGlass[k].y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Mağaza vitrin camı dikey alüminyum kayıtları (mullions)
        for (const frac of [0.33, 0.67]) {
          const mx = cA.x + (cB.x - cA.x) * frac;
          const my = cA.y + (cB.y - cA.y) * frac;
          const mBot = this._worldToCamera(mx, my, 1.5, cosYaw, sinYaw);
          const mTop = this._worldToCamera(mx, my, fasciaBottom - 2, cosYaw, sinYaw);
          const mClip = this._clipPolygonNear([mBot, mTop], 6.5);
          if (mClip.length === 2) {
            const mProj = this._projectCamVerts(mClip, cx, horizonY, fovScale);
            ctx.strokeStyle = 'rgba(148, 163, 184, 0.48)';
            ctx.lineWidth = 1.1;
            ctx.beginPath();
            ctx.moveTo(mProj[0].x, mProj[0].y);
            ctx.lineTo(mProj[1].x, mProj[1].y);
            ctx.stroke();
          }
        }
      }

      // 1C. Vitrin Camı Üzerinde Büyük Kurumsal Marka Logosu Amblemi (z = 20)
      if (wallDist < 290) {
        const cWindowLogo = this._worldToCamera(midX, midY, 20, cosYaw, sinYaw);
        if (cWindowLogo.rx > 9 && Math.abs(cWindowLogo.ry) < cWindowLogo.rx * 1.05) {
          const pWinLogo = this._projectCamVerts([cWindowLogo], cx, horizonY, fovScale)[0];
          const logoImg = this._getStoreLogoImage(store);
          const winLogoSize = Math.max(30, Math.min(72, (2350 / cWindowLogo.rx) * (W / 1100)));
          if (logoImg && logoImg.complete && logoImg.naturalWidth > 0) {
            ctx.save();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
            ctx.strokeStyle = isPassingNow ? '#10b981' : (isTarget ? '#ef4444' : catStyle.fascia);
            ctx.lineWidth = isPassingNow || isTarget ? 2.8 : 1.8;
            const lx = pWinLogo.x - winLogoSize / 2;
            const ly = pWinLogo.y - winLogoSize / 2;
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(lx, ly, winLogoSize, winLogoSize, 10);
            else ctx.rect(lx, ly, winLogoSize, winLogoSize);
            ctx.fill();
            ctx.stroke();
            ctx.drawImage(logoImg, lx + 3, ly + 3, winLogoSize - 6, winLogoSize - 6);
            this.logosRenderedLastFrame++;
            ctx.restore();
          }
        }
      }

      // 2. Ön Cephe Üst Işıklı Mağaza Tabelası Şeridi (Fascia Header: z = fasciaBottom .. wallHeight)
      if (isFrontFacade) {
        const camFascia = [
          this._worldToCamera(cA.x, cA.y, fasciaBottom, cosYaw, sinYaw),
          this._worldToCamera(cB.x, cB.y, fasciaBottom, cosYaw, sinYaw),
          this._worldToCamera(cB.x, cB.y, wallHeight, cosYaw, sinYaw),
          this._worldToCamera(cA.x, cA.y, wallHeight, cosYaw, sinYaw)
        ];
        const clippedFascia = this._clipPolygonNear(camFascia, 6.5);
        if (clippedFascia.length >= 3) {
          const scrFascia = this._projectCamVerts(clippedFascia, cx, horizonY, fovScale);
          ctx.fillStyle = isTarget ? '#dc2626' : (isStart ? '#059669' : (isPassingNow ? '#047857' : catStyle.fascia));
          ctx.beginPath();
          ctx.moveTo(scrFascia[0].x, scrFascia[0].y);
          for (let k = 1; k < scrFascia.length; k++) ctx.lineTo(scrFascia[k].x, scrFascia[k].y);
          ctx.closePath();
          ctx.fill();
        }
      }
      ctx.restore();
    }

    // 3. Mağaza Işıklı Tabelaları: [KURUMSAL LOGO] + Kapı Numarası (Z-15..Z-18) + Mağaza Adı
    storeSignAnchors.sort((a, b) => b.dist - a.dist);

    for (const item of storeSignAnchors) {
      const { store, signX, signY, signZ, isStart, isTarget, isEnRoute, isPassingNow } = item;
      const cSign = this._worldToCamera(signX, signY, signZ, cosYaw, sinYaw);
      if (cSign.rx < 9 || cSign.rx > 360) continue;
      if (Math.abs(cSign.ry) > cSign.rx * 1.05) continue;

      const isImportant = isStart || isTarget || isEnRoute || isPassingNow || store.is_anchor;
      if (!isImportant && cSign.rx > 215) continue;

      const pSign = this._projectCamVerts([cSign], cx, horizonY, fovScale)[0];
      const scaleFactor = Math.max(0.55, Math.min(1.48, 112 / cSign.rx)) * (W / 1100 + 0.35);

      ctx.save();
      const unitStr = store.unit ? `${store.unit} • ` : '';
      const labelText = `${unitStr}${store.name}`;
      const fontSize = Math.round(Math.max(10, Math.min(19, 12.5 * scaleFactor)));
      ctx.font = `800 ${fontSize}px "Plus Jakarta Sans", sans-serif`;

      const logoImg = this._getStoreLogoImage(store);
      const hasReadyLogo = !!(logoImg && logoImg.complete && logoImg.naturalWidth > 0);
      const logoSize = hasReadyLogo ? Math.round(fontSize * 1.55) : 0;
      const logoGap = hasReadyLogo ? Math.round(6 * scaleFactor) : 0;

      const textMetrics = ctx.measureText(labelText);
      const padX = 9 * scaleFactor;
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
        ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.42)';
        ctx.lineWidth = 1.4;
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

  _renderFloorTransitionOverlay(ctx, W, H) {
    const st = this.floorTransitionState;
    if (!st) return;
    const toLabel = this.mallData?.floors[st.toFloor]?.label || `${st.toFloor}. Kat`;
    const icon = st.portalType === 'elevator' ? '🛗' : '🪜';
    const action = st.toFloor > st.fromFloor ? 'Çıkılıyor' : 'İniliyor';

    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#ffffff';
    ctx.font = `800 ${Math.max(18, Math.round(W * 0.024))}px "Plus Jakarta Sans", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(`${icon} ${toLabel} Katına ${action}...`, W / 2, H / 2);
    ctx.restore();
  }

  /**
   * Sağ Alt Köşede Canlı 2B Radar Mini-Harita (Kullanıcının Konumu, Rota İzi ve Bakış Açısı Hunisi)
   */
  _renderMiniRadar(ctx, W, H, effectiveYaw) {
    const isMobile = W < 650;
    const rW = isMobile ? Math.min(135, W * 0.34) : Math.min(210, W * 0.20);
    const rH = rW * (850 / 1400);
    const pad = isMobile ? 12 : 18;
    const bottomOffset = isMobile ? 76 : 78;
    const rx = W - rW - pad;
    const ry = H - rH - bottomOffset;

    ctx.save();
    // Radar Arka Plan Kartı
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
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
      } else if (enRouteSet.has(s.id)) {
        ctx.fillStyle = 'rgba(16, 185, 129, 0.55)';
      } else {
        ctx.fillStyle = 'rgba(148, 163, 184, 0.22)';
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
    ctx.fillStyle = 'rgba(56, 189, 248, 0.35)';
    ctx.beginPath();
    ctx.moveTo(ux, uy);
    ctx.arc(ux, uy, coneLen, effectiveYaw - 0.52, effectiveYaw + 0.52);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#10b981';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(ux, uy, 4.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Radar Başlığı
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '700 9px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('🗺️ 2B RADAR', rx + 7, ry + 12);
    ctx.restore();
  }
}

window.Pov3DEngine = Pov3DEngine;
