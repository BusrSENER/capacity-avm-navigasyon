/**
 * İstanbul Bakırköy Capacity AVM - İnteraktif Vektörel Harita Motoru
 * SVG Pan/Zoom, Mağaza Poligonları, 4-Katmanlı Neon Rota Shader'ı & Logo Rozetleri
 * İlham: cevahir-rehber.web.app
 */

class MallMap {
  constructor(containerId, mallData, onStoreClick) {
    this.container = document.getElementById(containerId);
    this.mallData = mallData;
    this.onStoreClick = onStoreClick;

    this.currentFloor = mallData.meta?.defaultFloor || 4; // Zemin Kat varsayılan
    this.activeRoute = null;
    this.activeStartStore = null;
    this.activeTargetStore = null;

    // Görünüm Modu ('anchor' = Öne Çıkanlar, 'all' = Tüm Mağazalar)
    this.displayMode = 'anchor';
    this.activeCategoryFilter = 'all';

    // Pan & Zoom State
    this.scale = 1.0;
    this.minScale = 0.55;
    this.maxScale = 4.0;
    this.panX = 0;
    this.panY = 0;
    this.isDragging = false;
    this.startX = 0;
    this.startY = 0;

    // ViewBox dimensions
    this.vbWidth = this.mallData.meta?.width || 516;
    this.vbHeight = this.mallData.meta?.height || 735;

    this.initMap();
    this.setupEventListeners();
  }

  initMap() {
    this.container.innerHTML = `
      <div id="map-viewport" class="select-none" style="position: absolute; width: ${this.vbWidth}px; height: ${this.vbHeight}px; transform-origin: 0 0; will-change: transform;">
        <!-- SVG Floor Layer -->
        <div id="svg-layer" class="absolute inset-0 pointer-events-auto" style="width: ${this.vbWidth}px; height: ${this.vbHeight}px; z-index: 5;"></div>
        
        <!-- Navigation Route SVG Layer (4-Pass Shader) -->
        <svg id="route-svg" class="absolute inset-0 pointer-events-none" width="${this.vbWidth}" height="${this.vbHeight}" viewBox="0 0 ${this.vbWidth} ${this.vbHeight}" style="z-index: 15;"></svg>
        
        <!-- HTML Markers Layer (Brand Logos & Icons) -->
        <div id="markers-layer" class="absolute inset-0 pointer-events-none" style="width: ${this.vbWidth}px; height: ${this.vbHeight}px; z-index: 25;"></div>

        <!-- Animated Shopping Cart Layer -->
        <div id="avatar-layer" class="absolute inset-0 pointer-events-none" style="width: ${this.vbWidth}px; height: ${this.vbHeight}px; z-index: 45;"></div>
      </div>
    `;

    this.viewport = document.getElementById('map-viewport');
    this.svgLayer = document.getElementById('svg-layer');
    this.routeSvg = document.getElementById('route-svg');
    this.markersLayer = document.getElementById('markers-layer');
    this.avatarLayer = document.getElementById('avatar-layer');

    this.loadFloor(this.currentFloor).then(() => {
      setTimeout(() => this.resetView(), 60);
    });
  }

  async loadFloor(floorNum) {
    this.currentFloor = floorNum;
    const floorInfo = this.mallData.floors[floorNum];
    if (!floorInfo) return;

    try {
      const resp = await fetch(`public/svg/${floorNum}.svg`);
      if (!resp.ok) throw new Error(`SVG fetch failed: ${resp.status}`);
      const svgText = await resp.text();

      this.svgLayer.innerHTML = svgText;
      const svgEl = this.svgLayer.querySelector('svg');
      if (svgEl) {
        svgEl.id = 'map-svg-element';
        svgEl.setAttribute('width', `${this.vbWidth}`);
        svgEl.setAttribute('height', `${this.vbHeight}`);
        svgEl.setAttribute('viewBox', `0 0 ${this.vbWidth} ${this.vbHeight}`);
        svgEl.style.width = `${this.vbWidth}px`;
        svgEl.style.height = `${this.vbHeight}px`;

        this.attachStoreInteractivity(svgEl, floorNum);
      }

      this.renderBrandMarkers(floorNum);
      this.renderRoute();
      this.updateActiveStorePolygons();
    } catch (err) {
      console.error('Error loading floor SVG:', err);
    }
  }

  attachStoreInteractivity(svgEl, floorNum) {
    const storePolys = svgEl.querySelectorAll('.store-polygon');
    const floorInfo = this.mallData.floors[floorNum];
    const storeMap = new Map();
    (floorInfo?.stores || []).forEach(s => {
      storeMap.set(s.id, s);
      if (s.room_id) storeMap.set(s.room_id, s);
    });

    storePolys.forEach(poly => {
      const storeId = poly.getAttribute('data-id') || poly.id;
      const storeData = storeMap.get(storeId);

      if (storeData) {
        poly.style.cursor = 'pointer';

        poly.addEventListener('mouseenter', () => {
          this.highlightStore(storeData.id, true);
        });

        poly.addEventListener('mouseleave', () => {
          if (!this.activeTargetStore || this.activeTargetStore.id !== storeData.id) {
            this.highlightStore(storeData.id, false);
          }
        });

        poly.addEventListener('click', (e) => {
          e.stopPropagation();
          if (this.onStoreClick) {
            this.onStoreClick(storeData);
          }
        });
      }
    });
  }

  highlightStore(storeId, isHighlighted) {
    const poly = this.svgLayer.querySelector(`[data-id="${storeId}"], #${storeId}`);
    if (!poly) return;

    if (isHighlighted) {
      poly.classList.add('store-highlight');
      poly.style.stroke = '#0284c7';
      poly.style.strokeWidth = '2.8px';
    } else {
      poly.classList.remove('store-highlight');
      poly.style.stroke = '';
      poly.style.strokeWidth = '';
    }
  }

  renderBrandMarkers(floorNum) {
    if (!this.markersLayer) return;
    this.markersLayer.innerHTML = '';

    const floorInfo = this.mallData.floors[floorNum];
    if (!floorInfo) return;

    const fragment = document.createDocumentFragment();

    // 1. Mağazalar: Sıralama & Akıllı Çakışma Önleme (Spatial Collision Avoidance)
    let stores = floorInfo.stores || [];
    if (this.activeCategoryFilter && this.activeCategoryFilter !== 'all') {
      stores = stores.filter(s => s.category === this.activeCategoryFilter);
    }

    const isZoomed = this.scale >= 1.35;
    const isFiltered = this.activeCategoryFilter && this.activeCategoryFilter !== 'all';
    const showAll = this.displayMode === 'all' || isZoomed || isFiltered;

    // Hedef ve Başlangıç en öncelikli, sonra Anchor mağazalar
    const sortedStores = [...stores].sort((a, b) => {
      const aPrio = (this.activeTargetStore?.id === a.id || this.activeStartStore?.id === a.id) ? 3 : (a.is_anchor ? 2 : 1);
      const bPrio = (this.activeTargetStore?.id === b.id || this.activeStartStore?.id === b.id) ? 3 : (b.is_anchor ? 2 : 1);
      return bPrio - aPrio;
    });

    const placedPositions = [];
    const minDistance = isZoomed ? 20 : (showAll ? 28 : 36);

    sortedStores.forEach(store => {
      const isTarget = this.activeTargetStore && this.activeTargetStore.id === store.id;
      const isStart = this.activeStartStore && this.activeStartStore.id === store.id;
      const isAnchor = !!store.is_anchor;

      if (!showAll && !isAnchor && !isTarget && !isStart) {
        return;
      }

      // Çakışma kontrolü (Hedef ve başlangıç hariç)
      if (!isTarget && !isStart) {
        const collides = placedPositions.some(p => Math.hypot(p.x - store.cx, p.y - store.cy) < minDistance);
        if (collides) return;
      }

      placedPositions.push({ x: store.cx, y: store.cy });

      const marker = document.createElement('div');
      marker.className = `logo-tile-marker ${isAnchor ? 'is-anchor' : 'is-secondary'} ${isTarget ? 'is-target' : ''} ${isStart ? 'is-start' : ''}`;
      marker.style.left = `${store.cx}px`;
      marker.style.top = `${store.cy}px`;
      marker.setAttribute('data-store-id', store.id);
      marker.title = `${store.name} (${store.floor_name || store.floor + '. Kat'})`;

      const logoHtml = getStoreLogo(store, isAnchor ? 32 : 26);

      marker.innerHTML = `
        <div class="logo-tile">
          ${logoHtml}
        </div>
        ${isTarget || isStart ? `
          <span class="marker-name-label text-[10px] font-black text-white bg-red-600 px-2 py-0.5 rounded-full shadow-md whitespace-nowrap mt-1 pointer-events-none animate-pulse">
            ${store.name}
          </span>
        ` : `
          <span class="marker-name-label hidden group-hover:block text-[9px] font-bold text-slate-800 dark:text-slate-100 bg-white/95 dark:bg-slate-900/95 px-1.5 py-0.5 rounded-full shadow-md border border-slate-200 dark:border-slate-700 whitespace-nowrap mt-1 pointer-events-none absolute top-full z-40">
            ${store.name}
          </span>
        `}
      `;

      marker.addEventListener('mouseenter', () => {
        this.highlightStore(store.id, true);
      });

      marker.addEventListener('mouseleave', () => {
        if (!this.activeTargetStore || this.activeTargetStore.id !== store.id) {
          this.highlightStore(store.id, false);
        }
      });

      marker.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.onStoreClick) {
          this.onStoreClick(store);
        }
      });

      fragment.appendChild(marker);
    });

    // 2. Servis Noktaları (Amenities) - cevahir-rehber.web.app Temiz Dairesel İkonları
    const amenities = floorInfo.amenities || [];
    const AMENITY_ICONS = {
      wc: '🚻',
      atm: '💳',
      info: '🛡️',
      entrance: '🚪',
      carpark: '🅿️',
      prayer: '🕌',
      baby: '🍼',
      taxi: '🚕',
      valet: '🚘'
    };

    amenities.forEach(am => {
      const amMarker = document.createElement('div');
      amMarker.className = `amenity-marker-wrapper kind-${am.kind}`;
      amMarker.style.left = `${am.cx}px`;
      amMarker.style.top = `${am.cy}px`;
      amMarker.title = am.name;

      const iconChar = AMENITY_ICONS[am.kind] || 'ℹ️';

      amMarker.innerHTML = `
        <div class="amenity-icon-circle" title="${am.name}">
          <span>${iconChar}</span>
        </div>
      `;

      amMarker.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.onStoreClick) {
          this.onStoreClick(am);
        }
      });

      fragment.appendChild(amMarker);
    });

    this.markersLayer.appendChild(fragment);
  }

  /**
   * 4-Katmanlı Rota Çizim Pipeline'ı
   */
  renderRoute(routeData) {
    if (routeData !== undefined) {
      this.activeRoute = routeData;
    }
    if (!this.routeSvg) return;
    this.routeSvg.innerHTML = '';

    if (!this.activeRoute || !this.activeRoute.segments) return;

    // Mevcut kattaki segmentleri bul
    const currentSegments = this.activeRoute.segments.filter(s => s.floor === this.currentFloor);
    if (!currentSegments.length) return;

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'route-group');

    currentSegments.forEach(seg => {
      if (!seg.points || seg.points.length < 2) return;

      let d = `M ${seg.points[0].x} ${seg.points[0].y}`;
      for (let i = 1; i < seg.points.length; i++) {
        d += ` L ${seg.points[i].x} ${seg.points[i].y}`;
      }

      // Katman 1: Ambient Glow (Işıltı)
      const glowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      glowPath.setAttribute('d', d);
      glowPath.setAttribute('class', 'route__glow');
      g.appendChild(glowPath);

      // Katman 2: White Casing (Koruyucu Kontrast Kenar)
      const casePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      casePath.setAttribute('d', d);
      casePath.setAttribute('class', 'route__case');
      g.appendChild(casePath);

      // Katman 3: Main Line (Mavi Çekirdek Hat)
      const linePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      linePath.setAttribute('d', d);
      linePath.setAttribute('class', 'route__line');
      g.appendChild(linePath);

      // Katman 4: Flowing Dash (Hareketli Akış Noktaları)
      const flowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      flowPath.setAttribute('d', d);
      flowPath.setAttribute('class', 'route__flow');
      g.appendChild(flowPath);
    });

    this.routeSvg.appendChild(g);
  }

  clearRoute() {
    this.activeRoute = null;
    if (this.routeSvg) this.routeSvg.innerHTML = '';
    this.updateActiveStorePolygons();
    this.renderBrandMarkers(this.currentFloor);
  }

  updateActiveStorePolygons() {
    if (!this.svgLayer) return;
    const allPolys = this.svgLayer.querySelectorAll('.store-polygon');
    allPolys.forEach(p => {
      p.classList.remove('store-active', 'store-target', 'store-start');
    });

    if (this.activeStartStore && this.activeStartStore.floor === this.currentFloor) {
      const p = this.svgLayer.querySelector(`[data-id="${this.activeStartStore.id}"], #${this.activeStartStore.room_id}`);
      if (p) p.classList.add('store-start');
    }

    if (this.activeTargetStore && this.activeTargetStore.floor === this.currentFloor) {
      const p = this.svgLayer.querySelector(`[data-id="${this.activeTargetStore.id}"], #${this.activeTargetStore.room_id}`);
      if (p) p.classList.add('store-target', 'store-active');
    }
  }

  flyTo(x, y, targetScale = 1.35, duration = 400) {
    const rect = this.container.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;

    const startX = this.panX;
    const startY = this.panY;
    const startScale = this.scale;

    const endScale = Math.min(this.maxScale, Math.max(this.minScale, targetScale));
    const endX = cx - x * endScale;
    const endY = cy - y * endScale;

    const startTime = performance.now();

    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const ease = 0.5 - Math.cos(progress * Math.PI) / 2; // ease-in-out

      this.scale = startScale + (endScale - startScale) * ease;
      this.panX = startX + (endX - startX) * ease;
      this.panY = startY + (endY - startY) * ease;

      this.applyTransform();

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }

  /**
   * Haritayı verilen (x, y) SVG koordinatına doğru yumuşak şekilde kaydırır.
   * Simülasyon döngüsünde (lerp = true) 60 FPS'te titremesiz yumuşak kamera takibi sağlar.
   * @param {number} x - SVG dünya X koordinatı
   * @param {number} y - SVG dünya Y koordinatı
   * @param {boolean} lerp - Sürekli kare animasyonlarında kademeli yaklaşım (varsayılan true)
   */
  smoothPanTo(x, y, lerp = true) {
    if (!this.container) return;
    const rect = this.container.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const targetPanX = (rect.width / 2) - (x * this.scale);
    const targetPanY = (rect.height / 2) - (y * this.scale);

    if (lerp) {
      this.panX += (targetPanX - this.panX) * 0.14;
      this.panY += (targetPanY - this.panY) * 0.14;
    } else {
      this.panX = targetPanX;
      this.panY = targetPanY;
    }
    this.applyTransform();
  }

  panTo(x, y) {
    this.smoothPanTo(x, y, false);
  }

  resetView() {
    const rect = this.container.getBoundingClientRect();
    const scaleX = rect.width / this.vbWidth;
    const scaleY = rect.height / this.vbHeight;
    this.scale = Math.min(scaleX, scaleY) * 0.94;
    this.panX = (rect.width - this.vbWidth * this.scale) / 2;
    this.panY = (rect.height - this.vbHeight * this.scale) / 2;
    this.applyTransform();
  }

  applyTransform() {
    if (!this.viewport) return;
    this.viewport.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.scale})`;
  }

  setupEventListeners() {
    // Mouse Drag Pan
    this.container.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      this.isDragging = true;
      this.startX = e.clientX - this.panX;
      this.startY = e.clientY - this.panY;
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      this.panX = e.clientX - this.startX;
      this.panY = e.clientY - this.startY;
      this.applyTransform();
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    // Touch Support
    let lastTouchDist = 0;
    this.container.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        this.isDragging = true;
        this.startX = e.touches[0].clientX - this.panX;
        this.startY = e.touches[0].clientY - this.panY;
      } else if (e.touches.length === 2) {
        this.isDragging = false;
        lastTouchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (this.isDragging && e.touches.length === 1) {
        this.panX = e.touches[0].clientX - this.startX;
        this.panY = e.touches[0].clientY - this.startY;
        this.applyTransform();
      } else if (e.touches.length === 2) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const factor = dist / lastTouchDist;
        this.scale = Math.min(this.maxScale, Math.max(this.minScale, this.scale * factor));
        lastTouchDist = dist;
        this.applyTransform();
      }
    }, { passive: true });

    window.addEventListener('touchend', () => {
      this.isDragging = false;
    });

    // Wheel Zoom
    this.container.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = this.container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
      const newScale = Math.min(this.maxScale, Math.max(this.minScale, this.scale * zoomFactor));

      this.panX = mouseX - (mouseX - this.panX) * (newScale / this.scale);
      this.panY = mouseY - (mouseY - this.panY) * (newScale / this.scale);
      this.scale = newScale;

      this.applyTransform();
    }, { passive: false });

    // Window Resize
    window.addEventListener('resize', () => {
      this.resetView();
    });
  }

  setDisplayMode(mode) {
    this.displayMode = mode;
    this.renderBrandMarkers(this.currentFloor);
  }

  setCategoryFilter(category) {
    this.activeCategoryFilter = category;
    this.renderBrandMarkers(this.currentFloor);
  }
}
