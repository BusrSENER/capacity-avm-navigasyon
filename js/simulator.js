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
    this.createCartAvatar();
  }

  createCartAvatar() {
    this.cartEl = document.createElement('div');
    this.cartEl.className = 'cart-avatar hidden';
    this.cartEl.innerHTML = `
      <div class="cart-beacon"></div>
      <div class="cart-marker" id="cart-mascot">
        <div id="cart-rotator" class="cart-rotator-wrapper">
          <svg viewBox="-20 -35 45 42" width="48" height="48" class="cart-svg-el">
            <!-- Ground Shadow -->
            <ellipse class="cart__shadow" cx="0" cy="1.5" rx="14" ry="3.2" />
            
            <!-- Cart Body -->
            <g class="cart__body">
              <!-- Handle -->
              <path d="M-15.5 -25.5 h4.2 l2.3 6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" />
              
              <!-- Basket Wireframe Body (Capacity Ruby Red & Gold styling) -->
              <path d="M-10 -20 h24.5 a1.5 1.5 0 0 1 1.45 1.9 l-2.7 9.7 a2.6 2.6 0 0 1-2.5 1.9 H-4.6 a2.6 2.6 0 0 1-2.5 -1.9 Z" fill="rgba(185, 28, 28, 0.25)" stroke="#b91c1c" stroke-width="2.2" stroke-linejoin="round" />
              
              <!-- Basket Grid Wires -->
              <path d="M-3.5 -19.5 l1.5 12 M3.5 -19.5 v12 M10 -19.5 l-1.3 12 M-8.5 -14 h23" stroke="#eab308" stroke-width="1.2" opacity="0.75" fill="none" />
              
              <!-- Shopping bags inside basket (Capacity Colors: Ruby & Gold) -->
              <rect x="-4" y="-27" width="6.5" height="8" rx="1.2" fill="#b91c1c" stroke="#991b1b" stroke-width="0.8" />
              <rect x="3.5" y="-25" width="7" height="6" rx="1.2" fill="#eab308" stroke="#ca8a04" stroke-width="0.8" />
              <path d="M-1 -27 v-2.5 a1 1 0 0 1 2 0 v2.5" stroke="#ffffff" stroke-width="0.9" fill="none" />
              
              <!-- Chassis -->
              <path d="M-7 -6.5 l-1.5 3.5 h20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
            </g>

            <!-- Wheels (Spin during movement) -->
            <g class="cart__wheel" transform="translate(-6, -2.6)">
              <g class="cart__wheel-hub">
                <circle r="3.2" fill="currentColor" />
                <circle r="1.8" fill="#ffffff" />
                <path d="M-2 0 h4 M0 -2 v4" stroke="currentColor" stroke-width="0.8" stroke-linecap="round" />
              </g>
            </g>
            <g class="cart__wheel" transform="translate(9.5, -2.6)">
              <g class="cart__wheel-hub">
                <circle r="3.2" fill="currentColor" />
                <circle r="1.8" fill="#ffffff" />
                <path d="M-2 0 h4 M0 -2 v4" stroke="currentColor" stroke-width="0.8" stroke-linecap="round" />
              </g>
            </g>
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
    this.currentIndex = 0;
    this.subProgress = 0;
    this.autoFollow = true;
    const btn = document.getElementById('btn-recenter-cart');
    if (btn) btn.classList.add('hidden');
    this.hide();
  }

  resetToStart() {
    this.pause();
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

      if (Math.abs(dx) > 0.05) {
        this.facingX = dx > 0 ? 1 : -1;
      }

      this.updateCartPosition(curX, curY, angle, curFrom.floor);

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

    const isElevator = toNode.edgeType === 'elevator' || toNode.portalKind === 'elevator';
    const msg = isElevator 
      ? `⚡ Panoramik Asansör ile ${this.map.mallData.floors[toNode.floor]?.label || toNode.floor + '. Kat'}a geçiliyor...`
      : `⚡ Yürüyen Merdiven ile ${this.map.mallData.floors[toNode.floor]?.label || toNode.floor + '. Kat'}a geçiliyor...`;

    this.showFloorTransitionBanner(msg);

    setTimeout(() => {
      this.currentIndex++;
      this.subProgress = 0;

      this.map.loadFloor(toNode.floor).then(() => {
        this.updateCartPosition(toNode.x, toNode.y, 0, toNode.floor);
        this.map.flyTo(toNode.x, toNode.y, 1.35);

        if (this.onFloorChange) {
          this.onFloorChange(toNode.floor);
        }

        setTimeout(() => {
          this.hideFloorTransitionBanner();
          this.play();
        }, 600);
      });
    }, 900);
  }

  updateCartPosition(x, y, angle, floor) {
    if (!this.cartEl) return;

    this.cartEl.style.transform = `translate(${x}px, ${y}px)`;

    if (this.rotatorEl) {
      let clampedAngle = Math.max(-25, Math.min(25, angle));
      if (this.facingX === -1) {
        clampedAngle = -clampedAngle;
      }
      this.rotatorEl.style.transform = `scaleX(${this.facingX}) rotate(${clampedAngle}deg)`;
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

  showFloorTransitionBanner(text) {
    let banner = document.getElementById('floor-transition-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'floor-transition-banner';
      banner.className = 'fixed top-6 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-full bg-slate-900/90 text-white font-bold text-xs sm:text-sm border border-cyan-400/40 shadow-2xl backdrop-blur-md flex items-center gap-2.5 transition-all';
      document.body.appendChild(banner);
    }
    banner.innerHTML = `<span class="animate-spin text-cyan-400">⚡</span> ${text}`;
    banner.style.display = 'flex';
  }

  hideFloorTransitionBanner() {
    const banner = document.getElementById('floor-transition-banner');
    if (banner) banner.style.display = 'none';
  }
}
