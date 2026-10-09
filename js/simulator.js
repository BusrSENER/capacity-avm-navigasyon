/**
 * İstanbul Bakırköy Capacity AVM - Alışveriş Sepeti (Shopping Cart) Navigasyon Simülatörü
 * Fizik tabanlı kavis eğimi (tilt), yön değişimi (scaleX), dönen tekerlekler ve otomatik kat geçiş sekansı
 */

class CartSimulator {
  constructor(mallMap, onProgress, onFloorChange, onComplete) {
    this.map = mallMap;
    this.onProgress = onProgress;
    this.onFloorChange = onFloorChange;
    this.onComplete = onComplete;

    this.activeRoute = null;
    this.pathNodes = [];
    this.currentIndex = 0;
    this.subProgress = 0; // 0..1 between node i and i+1

    this.isPlaying = false;
    this.speed = 1.0; // 1x, 2x, 4x
    this.followCamera = true;
    this.autoFollow = true; // Serbest kamera etkileşiminde kullanıcı haritayı kaydırdığında false olur
    this.currentX = 0;
    this.currentY = 0;
    this.currentFloor = 0;
    this.animFrameId = null;
    this.lastTime = 0;
    this.facingX = 1; // 1: right, -1: left

    this.cartEl = null;
    this.smoothedAngle = 0;
    this.onProximityCheck = null;
    this.transitionTimer = null;
    this.transitionFadeTimeout = null;
    this.createCartAvatar();
  }

  createCartAvatar() {
    this.cartEl = document.createElement('div');
    this.cartEl.className = 'cart-avatar hidden';
    this.cartEl.innerHTML = `
      <div class="cart-beacon"></div>
      <div class="cart-marker" id="cart-mascot">
        <div id="cart-rotator" class="cart-rotator-wrapper">
          <svg viewBox="-20 -36 40 42" width="46" height="46" class="bag-svg-el" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="routeBagGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#ff6b4a"/>
                <stop offset="50%" stop-color="#ea5736"/>
                <stop offset="100%" stop-color="#c2410c"/>
              </linearGradient>
              <linearGradient id="routeHandleGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#475569"/>
                <stop offset="100%" stop-color="#0f172a"/>
              </linearGradient>
            </defs>
            <!-- Ground Shadow -->
            <ellipse class="bag__shadow" cx="0" cy="1.5" rx="13" ry="3" fill="rgba(0, 0, 0, 0.35)" />
            <!-- Back Handle -->
            <path d="M-5 -21 C -5 -32, 5 -32, 5 -21" fill="none" stroke="#1e293b" stroke-width="2.2" stroke-linecap="round" opacity="0.6"/>
            <!-- Bag Main Body (Luxury nrdsor Coral Tote) -->
            <path d="M-13 -20 L13 -20 L11 0 L-11 0 Z" fill="url(#routeBagGrad)" stroke="#c2410c" stroke-width="0.8" stroke-linejoin="round"/>
            <!-- Luxury Side Pleats / Creases -->
            <path d="M-11 0 L-7 -20" stroke="rgba(255, 255, 255, 0.35)" stroke-width="1.1" fill="none"/>
            <path d="M11 0 L7 -20" stroke="rgba(0, 0, 0, 0.22)" stroke-width="1.2" fill="none"/>
            <!-- Front Handle -->
            <path d="M-4.5 -19.5 C -4.5 -29.5, 4.5 -29.5, 4.5 -19.5" fill="none" stroke="url(#routeHandleGrad)" stroke-width="2.4" stroke-linecap="round"/>
            <!-- Top Turnover Fold Edge -->
            <path d="M-13 -20 L13 -20 L12.5 -17.5 L-12.5 -17.5 Z" fill="#d94726" opacity="0.9"/>
            <!-- Brand Navy Emblem Patch with nrdsor Coral Pin -->
            <g transform="translate(0, -9.5)">
              <rect x="-4.5" y="-4.5" width="9" height="9" rx="2.5" fill="#0f172a" stroke="rgba(255,255,255,0.2)" stroke-width="0.6"/>
              <circle cx="0" cy="-0.6" r="1.7" fill="#ea5736"/>
              <path d="M-1.4 -0.3 L0 2.5 L1.4 -0.3 Z" fill="#ea5736"/>
              <circle cx="0" cy="-0.6" r="0.6" fill="#ffffff"/>
            </g>
            <!-- Luxury Gloss Reflection / Highlights -->
            <path d="M-11.5 -19 L-4 -19 L-6.5 -1 L-10.5 -1 Z" fill="rgba(255, 255, 255, 0.22)"/>
          </svg>
        </div>
      </div>
    `;

    this.map.avatarLayer.appendChild(this.cartEl);
    this.cartMascotEl = this.cartEl.querySelector('#cart-mascot');
    this.rotatorEl = this.cartEl.querySelector('#cart-rotator');
  }

  setRoute(routeData) {
    this.stop();
    this.smoothedAngle = 0;
    if (this.onRouteReset) this.onRouteReset();
    this.activeRoute = routeData;
    this.pathNodes = routeData?.pathNodes || [];
    this.currentIndex = 0;
    this.subProgress = 0;

    if (this.pathNodes.length > 0) {
      const startNode = this.pathNodes[0];
      this.currentFloor = startNode.floor;
      if (this.map.currentFloor !== startNode.floor) {
        this.map.loadFloor(startNode.floor);
      }
      this.updateCartPosition(startNode.x, startNode.y, 0, startNode.floor);
      this.show();
    } else {
      this.hide();
    }
  }

  start() {
    this.play();
  }

  resume() {
    this.play();
  }

  play() {
    if (!this.activeRoute || this.pathNodes.length < 2) return;
    if (this.currentIndex >= this.pathNodes.length - 1) {
      this.currentIndex = 0;
      this.subProgress = 0;
    }
    this.isPlaying = true;
    this.autoFollow = true;
    const btn = document.getElementById('btn-recenter-cart');
    if (btn) btn.classList.add('hidden');
    this.lastTime = performance.now();
    this.show();
    if (this.cartMascotEl) this.cartMascotEl.classList.add('rolling');
    this.tick = this.tick.bind(this);
    this.animFrameId = requestAnimationFrame(this.tick);
  }

  pause() {
    this.isPlaying = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.cartMascotEl) this.cartMascotEl.classList.remove('rolling');
  }

  stop() {
    this.pause();
    if (this.transitionTimer) {
      clearTimeout(this.transitionTimer);
      this.transitionTimer = null;
    }
    this.hideFloorTransitionCard(true);
    this.currentIndex = 0;
    this.subProgress = 0;
    this.autoFollow = true;
    const btn = document.getElementById('btn-recenter-cart');
    if (btn) btn.classList.add('hidden');
    this.hide();
  }

  resetToStart() {
    this.pause();
    this.smoothedAngle = 0;
    if (this.onRouteReset) this.onRouteReset();
    this.currentIndex = 0;
    this.subProgress = 0;
    this.autoFollow = true;
    const btn = document.getElementById('btn-recenter-cart');
    if (btn) btn.classList.add('hidden');
    if (this.pathNodes && this.pathNodes.length > 0) {
      const startNode = this.pathNodes[0];
      this.currentFloor = startNode.floor;
      if (this.map && this.map.currentFloor !== startNode.floor) {
        this.map.loadFloor(startNode.floor);
      }
      this.updateCartPosition(startNode.x, startNode.y, 0, startNode.floor);
      this.show();
    }
  }

  setSpeed(val) {
    this.speed = parseFloat(val) || 1.0;
  }

  tick(currentTime) {
    if (!this.isPlaying) return;

    const dt = Math.min((currentTime - this.lastTime) / 1000, 0.1);
    this.lastTime = currentTime;

    const fromNode = this.pathNodes[this.currentIndex];
    const toNode = this.pathNodes[this.currentIndex + 1];

    if (!toNode) {
      this.finish();
      return;
    }

    // Kat Geçişi
    if (fromNode.floor !== toNode.floor) {
      this.handleFloorTransition(fromNode, toNode);
      return;
    }

    const segDist = Math.hypot(toNode.x - fromNode.x, toNode.y - fromNode.y);
    const baseSpeed = 75; // px / sn
    const currentSpeed = baseSpeed * this.speed;

    if (segDist > 0) {
      this.subProgress += (currentSpeed * dt) / segDist;
    } else {
      this.subProgress = 1;
    }

    if (this.subProgress >= 1) {
      this.subProgress = 0;
      this.currentIndex++;

      if (this.currentIndex >= this.pathNodes.length - 1) {
        this.finish();
        return;
      }
    }

    // Pozisyon interpolasyonu
    const curFrom = this.pathNodes[this.currentIndex];
    const curTo = this.pathNodes[this.currentIndex + 1];

    if (curTo && curFrom.floor === curTo.floor) {
      const curX = curFrom.x + (curTo.x - curFrom.x) * this.subProgress;
      const curY = curFrom.y + (curTo.y - curFrom.y) * this.subProgress;

      this.currentX = curX;
      this.currentY = curY;
      this.currentFloor = curFrom.floor;

      const dx = curTo.x - curFrom.x;
      const dy = curTo.y - curFrom.y;
      let angle = Math.atan2(dy, dx) * (180 / Math.PI);

      // Deadband: küçük dx değerlerinde yönün sürekli tersyüz olmasını ve titremeyi engelle
      if (Math.abs(dx) > 1.5) {
        this.facingX = dx > 0 ? 1 : -1;
      }

      this.updateCartPosition(curX, curY, angle, curFrom.floor);

      // Yol Üstü Mağaza Kampanya Sensörü (Proximity Sensor)
      if (this.onProximityCheck) {
        this.onProximityCheck(curX, curY, curFrom.floor);
      }

      if (this.autoFollow && this.followCamera && this.map && this.map.currentFloor === curFrom.floor) {
        if (typeof this.map.smoothPanTo === 'function') {
          this.map.smoothPanTo(curX, curY);
        } else if (typeof this.map.panTo === 'function') {
          this.map.panTo(curX, curY);
        }
      }
    }

    // İlerleme yüzdesi
    const totalNodes = this.pathNodes.length - 1;
    const progressPct = ((this.currentIndex + this.subProgress) / totalNodes) * 100;
    if (this.onProgress) {
      this.onProgress(progressPct, this.pathNodes[this.currentIndex]);
    }

    this.animFrameId = requestAnimationFrame(this.tick);
  }

  handleFloorTransition(fromNode, toNode) {
    this.pause();

    // 1. Ekranın merkezinde yarı şeffaf cam (glassmorphism) kat geçiş kartını göster
    this.showFloorTransitionCard(fromNode, toNode);

    // 2. Bildirim süresi (600ms), ardından yeni kata geç
    this.transitionTimer = setTimeout(() => {
      this.currentIndex++;
      this.subProgress = 0;

      // 3. Yeni katın haritası (SVG) yüklenir
      this.map.loadFloor(toNode.floor).then(() => {
        // Sepet yeni kattaki karşılık gelen kapı/aktarma noktasına yerleşir
        this.updateCartPosition(toNode.x, toNode.y, 0, toNode.floor);

        // Kat seçici butonları (Floor Selector) ve UI otomatik olarak yeni kata kaysın
        if (this.onFloorChange) {
          this.onFloorChange(toNode.floor);
        }

        // Harita sert sıfırlanmaz, tüm binaya zoom-out yapmaz;
        // Doğrudan sepetin çıktığı kapı/aktarma koordinatına TEK ve akıcı bir flyTo hareketiyle odaklanır
        const targetScale = Math.max(this.map.scale, 1.35);
        const flyDuration = 400;
        this.map.flyTo(toNode.x, toNode.y, targetScale, flyDuration);

        // Sepet yerleştikten ve flyTo animasyonu tamamen bittikten sonra simülasyon devam eder (kamera titremesini önler)
        this.transitionTimer = setTimeout(() => {
          this.hideFloorTransitionCard();
          this.play();
        }, flyDuration + 50);
      });
    }, 600);
  }

  updateCartPosition(x, y, angle, floor) {
    if (!this.cartEl) return;

    // GPU-accelerated subpixel positioning for 60fps jitter-free movement
    this.cartEl.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;

    if (this.rotatorEl) {
      let targetAngle = Math.max(-20, Math.min(20, angle));
      if (this.facingX === -1) {
        targetAngle = -targetAngle;
      }
      if (this.smoothedAngle === undefined) {
        this.smoothedAngle = targetAngle;
      } else {
        this.smoothedAngle += (targetAngle - this.smoothedAngle) * 0.18;
      }
      this.rotatorEl.style.transform = `scaleX(${this.facingX}) rotate(${this.smoothedAngle.toFixed(2)}deg)`;
    }

    this.checkVisibility(floor);
  }

  checkVisibility(floor) {
    const isVisible = (floor === undefined || floor === this.map.currentFloor) && this.activeRoute;
    if (isVisible) {
      this.cartEl.classList.remove('hidden');
    } else {
      this.cartEl.classList.add('hidden');
    }
  }

  finish() {
    this.pause();
    this.currentIndex = this.pathNodes.length - 1;
    this.subProgress = 0;
    this.autoFollow = true;
    const btn = document.getElementById('btn-recenter-cart');
    if (btn) btn.classList.add('hidden');
    if (this.onProgress) this.onProgress(100, this.pathNodes[this.currentIndex]);
    if (this.onComplete) this.onComplete();
  }

  recenter() {
    this.autoFollow = true;
    const btn = document.getElementById('btn-recenter-cart');
    if (btn) btn.classList.add('hidden');
    if (this.map && this.currentX !== undefined && this.currentY !== undefined) {
      if (this.currentFloor !== undefined && this.map.currentFloor !== this.currentFloor) {
        this.map.loadFloor(this.currentFloor).then(() => {
          this.map.flyTo(this.currentX, this.currentY, 1.45, 350);
        });
      } else {
        this.map.flyTo(this.currentX, this.currentY, 1.45, 350);
      }
    }
  }

  show() {
    this.checkVisibility(this.pathNodes[this.currentIndex]?.floor);
  }

  hide() {
    if (this.cartEl) this.cartEl.classList.add('hidden');
  }

  showFloorTransitionCard(fromNode, toNode) {
    let overlay = document.getElementById('floor-transition-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'floor-transition-overlay';
      overlay.className = 'fixed inset-0 z-50 flex items-center justify-center pointer-events-none transition-all duration-300 opacity-0 scale-95 hidden';
      overlay.setAttribute('aria-live', 'polite');
      overlay.innerHTML = `
        <div id="floor-transition-card" class="backdrop-blur-xl bg-slate-900/85 dark:bg-slate-950/90 text-white border border-white/20 dark:border-white/10 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] rounded-3xl p-6 sm:p-7 flex flex-col items-center gap-3.5 max-w-[320px] sm:max-w-xs mx-4 text-center ring-1 ring-white/10 transition-all duration-300">
          <div class="relative flex items-center justify-center">
            <div class="absolute -inset-2 bg-gradient-to-r from-cyan-500 to-indigo-500 rounded-full blur-md opacity-60 animate-pulse"></div>
            <div class="relative w-16 h-16 rounded-2xl bg-white/15 dark:bg-white/10 border border-white/25 flex items-center justify-center text-3xl shadow-inner backdrop-blur-md">
              <span id="floor-transition-icon">🪜</span>
            </div>
          </div>
          <div class="flex flex-col gap-1.5 items-center">
            <span id="floor-transition-badge" class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-400/30">
              Yürüyen Merdiven
            </span>
            <h3 id="floor-transition-title" class="text-base sm:text-lg font-black tracking-tight text-white leading-snug">
              Zemin Kata İniyorsunuz...
            </h3>
          </div>
          <div class="flex items-center gap-1.5 pt-1">
            <div class="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style="animation-delay: 0ms;"></div>
            <div class="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style="animation-delay: 150ms;"></div>
            <div class="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style="animation-delay: 300ms;"></div>
            <span class="text-[11px] font-medium text-slate-300 ml-1.5" id="floor-transition-sub">Harita yükleniyor</span>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
    }

    const isElevator = toNode && (toNode.edgeType === 'elevator' || toNode.portalKind === 'elevator' || (fromNode && (fromNode.edgeType === 'elevator' || fromNode.portalKind === 'elevator')));
    const isDown = fromNode && toNode ? toNode.floor < fromNode.floor : false;
    const icon = isElevator ? '🛗' : '🪜';
    const badgeText = isElevator ? 'Panoramik Asansör' : 'Yürüyen Merdiven';
    const directionWord = isDown ? 'İniyorsunuz...' : 'Çıkılıyor...';

    const toFloor = toNode ? toNode.floor : 4;
    let targetLabel = '';
    if (toFloor === 4) {
      targetLabel = 'Zemin Kata';
    } else if (toFloor === 5) {
      targetLabel = '1. Kata';
    } else if (toFloor === 6) {
      targetLabel = '2. Kata';
    } else if (toFloor === 3) {
      targetLabel = '1. Bodrum Kata';
    } else if (toFloor === 2) {
      targetLabel = '2. Bodrum Kata';
    } else if (toFloor === 1) {
      targetLabel = '3. Bodrum Kata';
    } else {
      targetLabel = `${toFloor}. Kata`;
    }

    const titleText = `${icon} ${targetLabel} ${directionWord}`;

    const iconEl = document.getElementById('floor-transition-icon');
    const badgeEl = document.getElementById('floor-transition-badge');
    const titleEl = document.getElementById('floor-transition-title');

    if (iconEl) iconEl.textContent = icon;
    if (badgeEl) badgeEl.textContent = badgeText;
    if (titleEl) titleEl.textContent = titleText;

    if (this.transitionFadeTimeout) {
      clearTimeout(this.transitionFadeTimeout);
      this.transitionFadeTimeout = null;
    }

    overlay.classList.remove('hidden', 'is-fading-out', 'opacity-0', 'scale-95');
    overlay.classList.add('is-active', 'opacity-100', 'scale-100');
  }

  hideFloorTransitionCard(immediate = false) {
    const overlay = document.getElementById('floor-transition-overlay');
    if (!overlay) return;

    if (this.transitionFadeTimeout) {
      clearTimeout(this.transitionFadeTimeout);
      this.transitionFadeTimeout = null;
    }

    if (immediate) {
      overlay.classList.remove('is-active', 'is-fading-out', 'opacity-100', 'scale-100');
      overlay.classList.add('hidden', 'opacity-0', 'scale-95');
      return;
    }

    overlay.classList.remove('is-active', 'opacity-100', 'scale-100');
    overlay.classList.add('is-fading-out', 'opacity-0', 'scale-95');

    this.transitionFadeTimeout = setTimeout(() => {
      overlay.classList.remove('is-fading-out');
      overlay.classList.add('hidden');
      this.transitionFadeTimeout = null;
    }, 350);
  }

  showFloorTransitionBanner(text) {
    this.showFloorTransitionCard(null, { floor: this.currentFloor });
  }

  hideFloorTransitionBanner() {
    this.hideFloorTransitionCard();
  }
}
