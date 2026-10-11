/**
 * İstanbul Bakırköy Capacity AVM - "X Kişisinin Gözü" 3B Birinci Şahıs (First-Person POV) Koridor Simülasyon Motoru
 * Kullanıcı başlangıç noktasını pinlediğinde veya rota oluşturduğunda doğrudan kullanıcının göz hizasına (1.65m) iner,
 * AVM koridorlarında mağaza vitrinlerinin (Pierre Cardin, W Collection, Madame Coco, Paşabahçe vb.) yanından geçerek
 * hedefe kadar adım adım yürür ve canlı sesli/görsel AR rehberlik sunar.
 */

class Pov3DEngine {
  constructor(mallData) {
    this.mallData = mallData;
    this.isActive = false;
    this.isWalking = false;
    this.walkSpeed = 1.0; // 1x, 2x, 4x

    // Kamera 3B Dünya Koordinatları (1400 x 850 SVG düzlemi ile birebir örtüşür)
    this.camX = 1000;
    this.camY = 535;
    this.camZ = 26; // İnsan göz hizası (~1.65m; tavan z=68)
    this.camYaw = Math.PI; // Radyan cinsinden bakış açısı (0: Doğu +X, PI: Batı -X, -PI/2: Kuzey -Y, PI/2: Güney +Y)
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
    this.announcedPassingStores = new Set();
    this.floorTransitionState = null; // { fromFloor, toFloor, timer, duration, portalType }

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
      if (spdBtn) spdBtn.textContent = `${this.walkSpeed}x`;
      if (window.cartSimulator) window.cartSimulator.setSpeed(this.walkSpeed);
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

    const n0 = routeData.pathNodes[0];
    const n1 = routeData.pathNodes[1];
    this.currentFloor = n0.floor;
    this.camX = n0.x;
    this.camY = n0.y;

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
    this.floorTransitionState = null;
    this.userYawOffset = 0;
    const n0 = this.route.pathNodes[0];
    const n1 = this.route.pathNodes[1] || n0;
    this.currentFloor = n0.floor;
    this.camX = n0.x;
    this.camY = n0.y;
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
      }
      return;
    }

    const nodes = this.route.pathNodes;
    if (this.segIndex >= nodes.length - 1) {
      // Hedefe varıldı!
      this.isWalking = false;
      this.totalProgressPct = 100;
      this.remainingMeters = 0;
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

    const segLen = Math.max(1, Math.hypot(v.x - u.x, v.y - u.y));
    const baseSpeedUnitsPerSec = 68 * this.walkSpeed; // Akıcı insan yürüyüş hızı
    this.segProgress += (baseSpeedUnitsPerSec * dt) / segLen;

    while (this.segProgress >= 1.0 && this.segIndex < nodes.length - 1) {
      this.segProgress -= 1.0;
      this.segIndex++;
      if (this.segIndex >= nodes.length - 1) {
        this.segProgress = 0;
        this.camX = nodes[nodes.length - 1].x;
        this.camY = nodes[nodes.length - 1].y;
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

    // Şu an yanından geçilen mağazayı tespit et (En-Route Proximity)
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
    let minD = 52;

    for (const s of floorStores) {
      if (this.startStore && s.id === this.startStore.id) continue;
      if (this.targetStore && s.id === this.targetStore.id) continue;
      const dx = (s.door_x ?? s.cx) - this.camX;
      const dy = (s.door_y ?? s.cy) - this.camY;
      const d = Math.hypot(dx, dy);
      if (d < minD) {
        minD = d;
        closest = s;
      }
    }

    if (closest && (!this.currentlyPassingStore || this.currentlyPassingStore.id !== closest.id)) {
      this.currentlyPassingStore = closest;
      if (!this.announcedPassingStores.has(closest.id)) {
        this.announcedPassingStores.add(closest.id);
        // Sesli rehber açıksa ve yürüyüşteysek yanından geçilen mağazayı bildir
        if (window.isVoiceEnabled && window.speakNavigationText && this.totalProgressPct > 8 && this.totalProgressPct < 90) {
          window.speakNavigationText(`${closest.name} mağazasının yanından geçiyorsunuz.`);
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
        passingText.textContent = `👀 Şu An Yanınızdan Geçiyor: ${this.currentlyPassingStore.name} (${this.currentlyPassingStore.unit || ''})`;
        passingBadge.classList.remove('hidden');
      } else if (this.route && this.route.enRouteStoreNames && this.route.enRouteStoreNames.length > 0) {
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
   * 3B Çokgeni (Quad/Polygon) Kamera Yakın Düzlemine (rx >= nearPlane) Göre Kırpar (Sutherland-Hodgman 3D Near-Plane Clipping)
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
      fashion: { wall: '#fdf2f8', fascia: '#be185d', border: '#f472b6', text: '#ffffff' },
      shoes: { wall: '#fffbeb', fascia: '#b45309', border: '#fbbf24', text: '#ffffff' },
      sports: { wall: '#f0fdf4', fascia: '#047857', border: '#34d399', text: '#ffffff' },
      tech: { wall: '#eef2ff', fascia: '#3730a3', border: '#818cf8', text: '#ffffff' },
      cosmetics: { wall: '#fdf2f8', fascia: '#9d174d', border: '#f472b6', text: '#ffffff' },
      food: { wall: '#fff7ed', fascia: '#c2410c', border: '#fb923c', text: '#ffffff' },
      home: { wall: '#f5f3ff', fascia: '#5b21b6', border: '#a78bfa', text: '#ffffff' },
      entertainment: { wall: '#faf5ff', fascia: '#6b21a8', border: '#c084fc', text: '#ffffff' },
      service: { wall: '#f0fdfa', fascia: '#0f766e', border: '#2dd4bf', text: '#ffffff' }
    };
    return map[category] || { wall: '#f8fafc', fascia: '#1e293b', border: '#94a3b8', text: '#ffffff' };
  }

  _render(now) {
    if (!this.ctx || !this.canvas) return;
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const cx = W * 0.5;
    const horizonY = H * 0.46;
    const fovScale = W * 0.68;

    const effectiveYaw = this.camYaw + this.userYawOffset;
    const cosYaw = Math.cos(effectiveYaw);
    const sinYaw = Math.sin(effectiveYaw);

    ctx.clearRect(0, 0, W, H);

    // 1. MİMARİ TAVAN & ATRİUM GÖKYÜZÜ KUBBESİ (0 .. horizonY)
    const ceilGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
    ceilGrad.addColorStop(0, '#0f172a');
    ceilGrad.addColorStop(0.55, '#1e293b');
    ceilGrad.addColorStop(1, '#334155');
    ctx.fillStyle = ceilGrad;
    ctx.fillRect(0, 0, W, horizonY + 2);

    // 2. MERMER AVM KORİDOR ZEMİNİ (horizonY .. H)
    const floorGrad = ctx.createLinearGradient(0, horizonY, 0, H);
    floorGrad.addColorStop(0, '#cbd5e1');
    floorGrad.addColorStop(0.25, '#e2e8f0');
    floorGrad.addColorStop(0.7, '#f1f5f9');
    floorGrad.addColorStop(1, '#f8fafc');
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, horizonY, W, H - horizonY);

    // 3. 3B PERSPEKTİF MERMER KARO IZGARASI VE TAVAN SPOT IŞIKLARI
    ctx.save();
    ctx.strokeStyle = 'rgba(100, 116, 139, 0.20)';
    ctx.lineWidth = Math.max(1, W / 900);
    const gridStep = 70;
    const minGX = Math.floor((this.camX - 420) / gridStep) * gridStep;
    const maxGX = Math.ceil((this.camX + 420) / gridStep) * gridStep;
    const minGY = Math.floor((this.camY - 420) / gridStep) * gridStep;
    const maxGY = Math.ceil((this.camY + 420) / gridStep) * gridStep;

    for (let gx = minGX; gx <= maxGX; gx += gridStep) {
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

    // Tavan LED Spot Işıkları (wz = 68)
    for (let gx = minGX; gx <= maxGX; gx += gridStep) {
      for (let gy = minGY; gy <= maxGY; gy += gridStep) {
        const cSpot = this._worldToCamera(gx, gy, 68, cosYaw, sinYaw);
        if (cSpot.rx > 15 && cSpot.rx < 420 && Math.abs(cSpot.ry) < cSpot.rx * 1.1) {
          const sx = cx + (cSpot.ry / cSpot.rx) * fovScale;
          const sy = horizonY - (cSpot.rz / cSpot.rx) * fovScale;
          const rad = Math.max(1.5, (520 / cSpot.rx) * (W / 1200));
          ctx.fillStyle = 'rgba(254, 243, 199, 0.65)';
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

    // 5. ZEMİN KAT MÜZİKLİ GÖSTERİ HAVUZU (3B Fıskiyeli Havuz)
    if (this.currentFloor === 4) {
      this._render3DFountainPool(ctx, cx, horizonY, fovScale, cosYaw, sinYaw, now, W);
    }

    // 6. 3B MAĞAZA CEPHELERİ, VİTRİNLER VE IŞIKLI TABELALAR (Painter's Algorithm ile Uzaktan Yakına)
    this._render3DStorefronts(ctx, cx, horizonY, fovScale, cosYaw, sinYaw, now, W, H);

    // 7. KAT GEÇİŞİ (YÜRÜYEN MERDİVEN / ASANSÖR) EFEKTİ
    if (this.floorTransitionState) {
      this._renderFloorTransitionOverlay(ctx, W, H);
    }

    // 8. SAĞ ALT KÖŞE CANLI 2B RADAR MİNİ-HARİTA (Kullanıcının Konumu ve Bakış Hunisi)
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
        ctx.fillStyle = i < this.segIndex ? 'rgba(148, 163, 184, 0.35)' : 'rgba(37, 99, 235, 0.78)';
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
    const segs = 20;
    for (let i = 0; i < segs; i++) {
      const ang = (i / segs) * Math.PI * 2;
      pts.push(this._worldToCamera(poolX + Math.cos(ang) * rxPool, poolY + Math.sin(ang) * ryPool, 1.0, cosYaw, sinYaw));
    }
    const clipped = this._clipPolygonNear(pts, 7);
    if (clipped.length >= 3) {
      const scr = this._projectCamVerts(clipped, cx, horizonY, fovScale);
      ctx.save();
      ctx.fillStyle = 'rgba(14, 165, 233, 0.55)';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(scr[0].x, scr[0].y);
      for (let k = 1; k < scr.length; k++) ctx.lineTo(scr[k].x, scr[k].y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Fıskiye su sütunları
      const cCenter = this._worldToCamera(poolX, poolY, 18 + Math.sin(now * 0.006) * 5, cosYaw, sinYaw);
      if (cCenter.rx > 12 && cCenter.rx < 450) {
        const pTop = this._projectCamVerts([cCenter], cx, horizonY, fovScale)[0];
        ctx.fillStyle = '#0284c7';
        ctx.font = `800 ${Math.max(10, Math.min(16, Math.round(1400 / cCenter.rx)))}px "Plus Jakarta Sans", sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('🌊 MÜZİKLİ GÖSTERİ HAVUZU', pTop.x, pTop.y);
      }
      ctx.restore();
    }
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
      if (distToStore > 360 || dyCorridor > 175) continue; // Yalnızca yürünmekte olan koridorun sol/sağ vitrinlerini çiz

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

      // Kameraya / Koridora paralel bakan ön vitrin cephesini seç (Asla koridoru dik kesmesin)
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
      const { store, cA, cB, isFrontFacade, isStart, isTarget, isEnRoute, isPassingNow, wallDist } = wq;
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
      // Mesafe sisi / derinlik karartması
      const fogAlpha = Math.max(0.28, Math.min(0.96, 1 - wallDist / 540));

      if (isTarget) {
        ctx.fillStyle = isFrontFacade ? '#fee2e2' : '#fecaca';
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = isFrontFacade ? 3.2 : 1.8;
      } else if (isStart) {
        ctx.fillStyle = isFrontFacade ? '#d1fae5' : '#a7f3d0';
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = isFrontFacade ? 3.0 : 1.8;
      } else if (isPassingNow || isEnRoute) {
        ctx.fillStyle = isFrontFacade ? '#ecfdf5' : '#f0fdf4';
        ctx.strokeStyle = isPassingNow ? '#059669' : '#10b981';
        ctx.lineWidth = isFrontFacade ? 2.6 : 1.5;
      } else {
        ctx.fillStyle = isFrontFacade ? catStyle.wall : '#e2e8f0';
        ctx.strokeStyle = isFrontFacade ? catStyle.border : '#cbd5e1';
        ctx.lineWidth = isFrontFacade ? 1.6 : 1.0;
      }

      ctx.globalAlpha = fogAlpha;
      ctx.beginPath();
      ctx.moveTo(scrWall[0].x, scrWall[0].y);
      for (let k = 1; k < scrWall.length; k++) ctx.lineTo(scrWall[k].x, scrWall[k].y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // 2. Ön Cephe ise Üst Işıklı Mağaza Tabelası Şeridi (Fascia Header: z = fasciaBottom .. wallHeight)
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

    // 3. Mağaza Tabela İsimleri, Kapı Numaraları (Z-15..Z-18) ve Yüzen 3B AR Etiketleri
    storeSignAnchors.sort((a, b) => b.dist - a.dist);

    for (const item of storeSignAnchors) {
      const { store, signX, signY, signZ, isStart, isTarget, isEnRoute, isPassingNow } = item;
      const cSign = this._worldToCamera(signX, signY, signZ, cosYaw, sinYaw);
      if (cSign.rx < 10 || cSign.rx > 360) continue;
      if (Math.abs(cSign.ry) > cSign.rx * 0.95) continue;

      // Önemli mağazalar (Hedef, Başlangıç, Rota Üstü ve Anchor) her mesafeden, diğerleri yakından (< 210) okunur
      const isImportant = isStart || isTarget || isEnRoute || isPassingNow || store.is_anchor;
      if (!isImportant && cSign.rx > 195) continue;

      const pSign = this._projectCamVerts([cSign], cx, horizonY, fovScale)[0];
      const scaleFactor = Math.max(0.52, Math.min(1.55, 115 / cSign.rx)) * (W / 1100 + 0.35);

      ctx.save();
      const unitStr = store.unit ? `${store.unit} • ` : '';
      const labelText = `${unitStr}${store.name}`;
      const fontSize = Math.round(Math.max(10, Math.min(20, 13 * scaleFactor)));
      ctx.font = `800 ${fontSize}px "Plus Jakarta Sans", sans-serif`;

      const textMetrics = ctx.measureText(labelText);
      const padX = 9 * scaleFactor;
      const boxW = textMetrics.width + padX * 2;
      const boxH = fontSize + 10 * scaleFactor;
      const boxX = pSign.x - boxW / 2;
      const boxY = pSign.y - boxH / 2;

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
        ctx.lineWidth = 2.2;
      } else {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.86)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = 1.2;
      }

      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(boxX, boxY, boxW, boxH, 8);
      } else {
        ctx.rect(boxX, boxY, boxW, boxH);
      }
      ctx.fill();
      ctx.stroke();

      // Mağaza Adı + Kapı No
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(labelText, pSign.x, pSign.y);

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
        topBadgeText = '👀 ŞU AN YANINDAN GEÇİYORSUNUZ';
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
        const subX = pSign.x - subW / 2;
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
        ctx.fillText(topBadgeText, pSign.x, subY + subH / 2);
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
