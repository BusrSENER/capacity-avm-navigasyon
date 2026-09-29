/**
 * İstanbul Bakırköy Capacity AVM - İnteraktif Vektörel Harita Motoru
 * SVG Pan/Zoom, Mağaza Poligonları, 4-Katmanlı Neon Rota Shader'ı & Marka Rozetleri
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
    this.minScale = 0.5;
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
        poly.addEventListener('click', (e) => {
          e.stopPropagation();
          if (this.onStoreClick) {
            this.onStoreClick(storeData);
          }
        });
      }
    });
  }

  renderBrandMarkers(floorNum) {
    if (!this.markersLayer) return;
    this.markersLayer.innerHTML = '';

    const floorInfo = this.mallData.floors[floorNum];
    if (!floorInfo) return;

    const fragment = document.createDocumentFragment();

    // 1. Mağazalar: Sıralama & Çakışma Önleme (Spatial Collision Avoidance)
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
    const minDistance = isZoomed ? 24 : (showAll ? 32 : 42);

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
      marker.className = `brand-marker-wrapper ${isAnchor ? 'is-anchor' : 'is-regular'} ${isTarget ? 'is-target' : ''} ${isStart ? 'is-start' : ''}`;
      marker.style.left = `${store.cx}px`;
      marker.style.top = `${store.cy}px`;
      marker.style.position = 'absolute';
      marker.style.pointerEvents = 'auto';
      marker.setAttribute('data-store-id', store.id);
      marker.title = `${store.name} (${store.floor_name || store.floor + '. Kat'})`;

      const badgeSize = isTarget || isStart ? 44 : (isAnchor ? 38 : 30);
      const logoHtml = getStoreLogo(store, badgeSize);

      marker.innerHTML = `
        <div class="brand-marker flex flex-col items-center cursor-pointer transition-transform hover:scale-115 group">
          <div class="marker-logo-box shadow-md rounded-2xl p-0.5">
            ${logoHtml}
          </div>
          ${isAnchor || isTarget || isStart ? `
            <span class="marker-name-label text-[9px] font-extrabold text-slate-800 dark:text-slate-200 bg-white/95 dark:bg-slate-900/90 px-1.5 py-0.5 rounded-full shadow-xs border border-slate-200 dark:border-slate-700 whitespace-nowrap mt-1 pointer-events-none group-hover:scale-105 transition-all">
              ${store.name}
            </span>
          ` : `
            <span class="marker-name-label hidden group-hover:block text-[9px] font-bold text-slate-800 dark:text-slate-200 bg-white/95 dark:bg-slate-900/95 px-1.5 py-0.5 rounded-full shadow-xs border border-slate-200 dark:border-slate-700 whitespace-nowrap mt-1 pointer-events-none absolute top-full z-40">
              ${store.name}
            </span>
          `}
        </div>
      `;

      marker.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.onStoreClick) {
          this.onStoreClick(store);
        }
      });

      fragment.appendChild(marker);
    });

    // 2. Servis Noktaları (Sade, dairesel, taşmayan rozetler)
    const amenities = (floorInfo.amenities || []).filter(a => a.kind !== 'fountain');
    amenities.forEach(am => {
      const amMarker = document.createElement('div');
      amMarker.className = `amenity-marker-wrapper kind-${am.kind}`;
      amMarker.style.left = `${am.cx}px`;
      amMarker.style.top = `${am.cy}px`;
      amMarker.style.position = 'absolute';
      amMarker.style.pointerEvents = 'auto';
      amMarker.title = am.name;

      let iconHtml = getStoreLogo(am, 28);
      amMarker.innerHTML = `
        <div class="amenity-marker flex flex-col items-center cursor-pointer transition-transform hover:scale-115 group">
          <div class="marker-amenity-box shadow-md rounded-full p-0.5 border border-cyan-500/40 bg-white dark:bg-slate-900/90">
            ${iconHtml}
          </div>
          <span class="hidden group-hover:block text-[8px] font-bold text-cyan-700 dark:text-cyan-300 bg-white/95 dark:bg-slate-950/95 px-1.5 py-0.5 rounded-full shadow-xs border border-cyan-500/30 whitespace-nowrap mt-1 pointer-events-none absolute top-full z-40">
            ${am.name}
          </span>
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
   * 4-Katmanlı Neon Rota Çizim Pipeline'ı
   */
  renderRoute(routeData) {
    if (routeData !== undefined) {
      this.activeRoute = routeData;
    }
    if (!this.routeSvg) return;

    this.routeSvg.innerHTML = '';
    if (!this.activeRoute || !this.activeRoute.segmentsByFloor) return;

    const currentSegments = this.activeRoute.segmentsByFloor[this.currentFloor] || [];
    if (currentSegments.length < 2) {
      this.renderFloorHopButtons();
      return;
    }

    const pointsStr = currentSegments.map(p => `${p.x},${p.y}`).join(' ');

    // 1. Ambient Glow (Geniş zemin aydınlatması)
    const glow = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    glow.setAttribute('points', pointsStr);
    glow.setAttribute('class', 'route__glow');
    this.routeSvg.appendChild(glow);

    // 2. Route Casing (Kontrast sınırı)
    const casing = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    casing.setAttribute('points', pointsStr);
    casing.setAttribute('class', 'route__case');
    this.routeSvg.appendChild(casing);

    // 3. Neon Core (Canlı neon hattı)
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    line.setAttribute('points', pointsStr);
    line.setAttribute('class', 'route__line');
    this.routeSvg.appendChild(line);

    // 4. Flowing Pearl Dash (Akan inci noktaları)
    const flow = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    flow.setAttribute('points', pointsStr);
    flow.setAttribute('class', 'route__flow');
    this.routeSvg.appendChild(flow);

    // Başlangıç ve Bitiş Pimleri
    const startPt = currentSegments[0];
    const endPt = currentSegments[currentSegments.length - 1];

    if (this.activeRoute.pathNodes[0].id === startPt.id) {
      this.drawRoutePin(startPt.x, startPt.y, '#10b981', 'Başlangıç');
    }
    if (this.activeRoute.pathNodes[this.activeRoute.pathNodes.length - 1].id === endPt.id) {
      this.drawRoutePin(endPt.x, endPt.y, '#ef4444', 'Hedef');
    }

    this.renderFloorHopButtons();
  }

  drawRoutePin(cx, cy, color, label) {
    const pinGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    pinGroup.setAttribute('transform', `translate(${cx}, ${cy})`);

    pinGroup.innerHTML = `
      <circle r="8" fill="${color}" opacity="0.3" class="animate-ping"/>
      <circle r="6" fill="${color}" stroke="#ffffff" stroke-width="2"/>
    `;
    this.routeSvg.appendChild(pinGroup);
  }

  /**
   * Rota diğer katlara geçiyorsa kullanıcı için kat atlama ("Hop") butonları basar
   */
  renderFloorHopButtons() {
    if (!this.activeRoute || !this.markersLayer) return;

    // Önceki hop butonlarını temizle
    const oldHops = this.markersLayer.querySelectorAll('.floor-hop-btn');
    oldHops.forEach(h => h.remove());

    const path = this.activeRoute.pathNodes || [];
    for (let i = 0; i < path.length - 1; i++) {
      const u = path[i];
      const v = path[i + 1];

      if (u.floor === this.currentFloor && v.floor !== this.currentFloor) {
        const hopEl = document.createElement('div');
        hopEl.className = 'floor-hop-btn absolute z-30 pointer-events-auto -translate-x-1/2 -translate-y-1/2';
        hopEl.style.left = `${u.x}px`;
        hopEl.style.top = `${u.y - 30}px`;

        const isElevator = v.edgeType === 'elevator';
        const targetLabel = this.mallData.floors[v.floor]?.label || `${v.floor}. Kat`;

        hopEl.innerHTML = `
          <button class="px-3 py-1.5 rounded-full bg-gradient-to-r from-red-600 to-amber-600 text-white font-bold text-xs shadow-xl flex items-center gap-1.5 hover:scale-105 transition-transform border border-white/30 animate-bounce">
            <span>${isElevator ? '🛗' : '⚡'}</span>
            <span>${targetLabel}'a Geç</span>
          </button>
        `;

        hopEl.querySelector('button').addEventListener('click', (e) => {
          e.stopPropagation();
          this.loadFloor(v.floor).then(() => {
            const floorBtn = document.querySelector(`.floor-btn[data-floor="${v.floor}"]`);
            if (floorBtn) floorBtn.click();
            this.flyTo(v.x, v.y, 1.3);
          });
        });

        this.markersLayer.appendChild(hopEl);
      }
    }
  }

  updateActiveStorePolygons() {
    if (!this.svgLayer) return;
    const storePolys = this.svgLayer.querySelectorAll('.store-polygon');
    storePolys.forEach(p => p.classList.remove('store-active', 'store-start', 'store-target'));

    if (this.activeStartStore) {
      const startEl = this.svgLayer.querySelector(`[data-id="${this.activeStartStore.id}"], #${this.activeStartStore.room_id}`);
      if (startEl) startEl.classList.add('store-start');
    }

    if (this.activeTargetStore) {
      const targetEl = this.svgLayer.querySelector(`[data-id="${this.activeTargetStore.id}"], #${this.activeTargetStore.room_id}`);
      if (targetEl) targetEl.classList.add('store-target', 'store-active');
    }
  }

  clearRoute() {
    this.activeRoute = null;
    this.renderRoute();
  }

  flyTo(x, y, targetScale = 1.3, duration = 650) {
    const containerW = this.container.clientWidth;
    const containerH = this.container.clientHeight;

    const startPanX = this.panX;
    const startPanY = this.panY;
    const startScale = this.scale;

    const endScale = Math.min(this.maxScale, Math.max(this.minScale, targetScale));
    const endPanX = containerW / 2 - x * endScale;
    const endPanY = containerH / 2 - y * endScale;

    const startTime = performance.now();

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = progress < 0.5 
        ? 4 * progress * progress * progress 
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      this.panX = startPanX + (endPanX - startPanX) * ease;
      this.panY = startPanY + (endPanY - startPanY) * ease;
      this.scale = startScale + (endScale - startScale) * ease;

      this.applyTransform();

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }

  smoothPanTo(x, y) {
    const containerW = this.container.clientWidth;
    const containerH = this.container.clientHeight;
    const targetPanX = containerW / 2 - x * this.scale;
    const targetPanY = containerH / 2 - y * this.scale;

    this.panX += (targetPanX - this.panX) * 0.15;
    this.panY += (targetPanY - this.panY) * 0.15;
    this.applyTransform();
  }

  resetView() {
    const containerW = this.container.clientWidth;
    const containerH = this.container.clientHeight;

    const scaleX = (containerW - 40) / this.vbWidth;
    const scaleY = (containerH - 40) / this.vbHeight;
    this.scale = Math.min(scaleX, scaleY, 1.15);

    this.panX = (containerW - this.vbWidth * this.scale) / 2;
    this.panY = (containerH - this.vbHeight * this.scale) / 2;

    this.applyTransform();
  }

  applyTransform() {
    if (this.viewport) {
      this.viewport.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.scale})`;
    }
  }

  setupEventListeners() {
    // Pan Dragging
    this.container.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      this.isDragging = true;
      this.startX = e.clientX - this.panX;
      this.startY = e.clientY - this.panY;
      this.container.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      this.panX = e.clientX - this.startX;
      this.panY = e.clientY - this.startY;
      this.applyTransform();
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
      this.container.style.cursor = 'grab';
    });

    // Mouse Wheel Zoom
    this.container.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = this.container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
      const newScale = Math.min(this.maxScale, Math.max(this.minScale, this.scale * zoomFactor));

      this.panX = mouseX - (mouseX - this.panX) * (newScale / this.scale);
      this.panY = mouseY - (mouseY - this.panY) * (newScale / this.scale);
      this.scale = newScale;

      this.applyTransform();
    }, { passive: false });

    // Window Resize
    window.addEventListener('resize', () => {
      this.applyTransform();
    });
  }

  setDisplayMode(mode) {
    this.displayMode = mode;
    this.renderBrandMarkers(this.currentFloor);
  }

  setCategoryFilter(cat) {
    this.activeCategoryFilter = cat;
    this.renderBrandMarkers(this.currentFloor);
  }
}
