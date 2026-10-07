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
    this.selectedStore = null; // Seçili mağaza (kalıcı seçim ve vurgu)

    // Görünüm Modu ('anchor' = Öne Çıkanlar, 'all' = Tüm Mağazalar)
    this.displayMode = 'anchor';
    this.activeCategoryFilter = 'all';

    // Pan, Zoom & Rotation State
    this.scale = 1.0;
    this.minScale = 0.25;
    this.maxScale = 8.0; // 8x Derin Yakınlaşma (Koridor, Kapı ve Düğüm Detay İnceleme)
    this.panX = 0;
    this.panY = 0;
    this.rotation = 0; // İki parmakla harita döndürme açısı (derece)
    this.isDragging = false;
    this.startX = 0;
    this.startY = 0;
    this.onUserPan = null; // Simülasyonda kullanıcı dokunduğunda serbest kamera tetikleyicisi
    this.onMapClick = null; // Haritanın boş zeminine tıklandığında tetiklenen geri çağırma

    // ViewBox dimensions (1400x850 Gerçek Chapman Taylor Mimari Düzlemi)
    this.vbWidth = this.mallData.meta?.width || 1400;
    this.vbHeight = this.mallData.meta?.height || 850;
    this.containerWidth = 1400;
    this.containerHeight = 850;

    this.updateDimensions();
    this.initMap();
    this.setupEventListeners();
  }

  /**
   * Mobil ve Masaüstü Konteyner Boyutlarını ve Dinamik minScale Değerini Günceller
   * Mobilde 1400x850 planının tamamının ekrana rahatça sığmasını sağlar.
   */
  updateDimensions() {
    if (!this.container) return;
    const rect = this.container.getBoundingClientRect();
    this.containerWidth = rect.width || window.innerWidth;
    this.containerHeight = rect.height || window.innerHeight;

    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
      // 1400x850'lik harita planının tamamı mobil ekrana rahatça sığabilecek şekilde dinamik hesapla:
      // minScale = Math.min(containerWidth / 1400, containerHeight / 850) * 0.85
      this.minScale = Math.min(this.containerWidth / this.vbWidth, this.containerHeight / this.vbHeight) * 0.85;
    } else {
      this.minScale = Math.min(0.55, Math.min(this.containerWidth / this.vbWidth, this.containerHeight / this.vbHeight) * 0.8);
    }
    // Emniyet alt sınırı
    this.minScale = Math.max(0.15, this.minScale);
  }

  /**
   * İki parmakla uzaklaştırma/yakınlaştırma (8x'e kadar) ve döndürme sırasında sınır denetimini yumuşatır.
   */
  clampToBounds() {
    if (!this.container) return;
    this.updateDimensions();
    const cWidth = this.containerWidth;
    const cHeight = this.containerHeight;
    if (!cWidth || !cHeight) return;

    const isLandscape = (window.innerWidth > window.innerHeight && window.innerHeight < 650) || (cHeight < 550 && cWidth >= cHeight);

    // Rotasyonlu ve 8x ölçekli efektif boyutlar
    const rad = Math.abs(this.rotation * Math.PI / 180);
    const cos = Math.abs(Math.cos(rad));
    const sin = Math.abs(Math.sin(rad));
    const mapWidth = (this.vbWidth * cos + this.vbHeight * sin) * this.scale;
    const mapHeight = (this.vbWidth * sin + this.vbHeight * cos) * this.scale;

    // Yumuşak sınır payı (soft margin buffer) - 8x yakınlaşmada ve döndürmede rahatça gezinebilmek için
    const marginX = Math.max(140, cWidth * 0.35);
    const marginY = isLandscape ? Math.max(380, cHeight * 1.2) : Math.max(140, cHeight * 0.35);

    if (mapWidth <= cWidth) {
      const centerX = (cWidth - mapWidth) / 2;
      this.panX = Math.max(centerX - marginX, Math.min(centerX + marginX, this.panX));
    } else {
      const minPanX = cWidth - mapWidth - marginX;
      const maxPanX = marginX;
      this.panX = Math.max(minPanX, Math.min(maxPanX, this.panX));
    }

    if (isLandscape) {
      // Ekran basıkken (landscape) binayı zorla ortaya sıkıştırma; kullanıcı yukarı/aşağı serbestçe kaysın
      const minPanY = Math.min(0, cHeight - mapHeight) - marginY;
      const maxPanY = Math.max(0, cHeight - mapHeight) + marginY;
      this.panY = Math.max(minPanY, Math.min(maxPanY, this.panY));
    } else if (mapHeight <= cHeight) {
      const centerY = (cHeight - mapHeight) / 2;
      this.panY = Math.max(centerY - marginY, Math.min(centerY + marginY, this.panY));
    } else {
      const minPanY = cHeight - mapHeight - marginY;
      const maxPanY = marginY;
      this.panY = Math.max(minPanY, Math.min(maxPanY, this.panY));
    }
  }

  /**
   * Dokunma veya sürükleme bırakıldığında haritayı yumuşakça doğal sınırlarına oturtur.
   */
  settleBounds(duration = 200) {
    if (!this.container) return;
    this.updateDimensions();
    const isLandscape = (window.innerWidth > window.innerHeight && window.innerHeight < 650) || (this.containerHeight < 550 && this.containerWidth >= this.containerHeight);
    const rad = Math.abs(this.rotation * Math.PI / 180);
    const cos = Math.abs(Math.cos(rad));
    const sin = Math.abs(Math.sin(rad));
    const mapWidth = (this.vbWidth * cos + this.vbHeight * sin) * this.scale;
    const mapHeight = (this.vbWidth * sin + this.vbHeight * cos) * this.scale;

    let targetX = this.panX;
    let targetY = this.panY;

    if (mapWidth <= this.containerWidth) {
      targetX = (this.containerWidth - mapWidth) / 2;
    } else {
      const minX = this.containerWidth - mapWidth;
      const maxX = 0;
      targetX = Math.max(minX, Math.min(maxX, targetX));
    }

    if (isLandscape) {
      // Yatay modda haritayı zorla ortaya sıkıştırma / sekme (bounce) yapma!
      // Kullanıcının dikey eksendeki kaydırmasını koru, sadece harita ekranın çok dışına taşmasın
      const vBuffer = Math.max(280, this.containerHeight * 0.85);
      const minAllowedY = Math.min(0, this.containerHeight - mapHeight) - vBuffer;
      const maxAllowedY = Math.max(0, this.containerHeight - mapHeight) + vBuffer;
      targetY = Math.max(minAllowedY, Math.min(maxAllowedY, this.panY));
    } else if (mapHeight <= this.containerHeight) {
      const isMobile = window.innerWidth <= 768;
      const mobileOffsetY = isMobile ? -30 : 0;
      targetY = ((this.containerHeight - mapHeight) / 2) + mobileOffsetY;
    } else {
      const minY = this.containerHeight - mapHeight;
      const maxY = 0;
      targetY = Math.max(minY, Math.min(maxY, targetY));
    }

    if (Math.abs(targetX - this.panX) > 1 || Math.abs(targetY - this.panY) > 1) {
      const startX = this.panX;
      const startY = this.panY;
      const startTime = performance.now();

      const animate = (now) => {
        const elapsed = now - startTime;
        const p = Math.min(1, elapsed / duration);
        const ease = 0.5 - Math.cos(p * Math.PI) / 2;

        this.panX = startX + (targetX - startX) * ease;
        this.panY = startY + (targetY - startY) * ease;
        this.applyTransform();

        if (p < 1) {
          requestAnimationFrame(animate);
        }
      };
      requestAnimationFrame(animate);
    }
  }

  zoomIn() {
    this.updateDimensions();
    const cx = this.containerWidth / 2;
    const cy = this.containerHeight / 2;
    const newScale = Math.min(this.maxScale, this.scale * 1.35);
    this.panX = cx - (cx - this.panX) * (newScale / this.scale);
    this.panY = cy - (cy - this.panY) * (newScale / this.scale);
    this.scale = newScale;
    this.clampToBounds();
    this.applyTransform();
  }

  zoomOut() {
    this.updateDimensions();
    const cx = this.containerWidth / 2;
    const cy = this.containerHeight / 2;
    const newScale = Math.max(this.minScale, this.scale * 0.75);
    this.panX = cx - (cx - this.panX) * (newScale / this.scale);
    this.panY = cy - (cy - this.panY) * (newScale / this.scale);
    this.scale = newScale;
    this.clampToBounds();
    this.applyTransform();
  }

  setRotation(deg) {
    this.rotation = 0; // Rotasyon kilitli (0° sabit)
    this.applyTransform();
  }

  /**
   * Rotasyon kesinlikle kilitlidir (0° sabit). Savrulma ve dönme devre dışı bırakılmıştır.
   */
  rotateAroundPoint(angleDiffDeg, screenX, screenY) {
    this.rotation = 0;
  }

  resetRotation(duration = 0) {
    this.rotation = 0;
    this.applyTransform();
  }

  initMap() {
    this.container.innerHTML = `
      <div id="map-viewport" class="select-none" style="position: absolute; width: ${this.vbWidth}px; height: ${this.vbHeight}px; transform-origin: 0 0; will-change: transform;">
        <!-- Rotation Container (Merkezden 700x425 İki Parmakla Döndürme & Billboard Kökü) -->
        <div id="map-rotator" style="position: absolute; width: ${this.vbWidth}px; height: ${this.vbHeight}px; transform-origin: ${this.vbWidth / 2}px ${this.vbHeight / 2}px; will-change: transform;">
          <!-- SVG Floor Layer -->
          <div id="svg-layer" class="absolute inset-0 pointer-events-auto" style="width: ${this.vbWidth}px; height: ${this.vbHeight}px; z-index: 5;"></div>
          
          <!-- HTML Markers Layer (Brand Logos & Icons - Zemin Poligonlarının Üstünde) -->
          <div id="markers-layer" class="absolute inset-0 pointer-events-none" style="width: ${this.vbWidth}px; height: ${this.vbHeight}px; z-index: 40;"></div>

          <!-- Navigation Route SVG Layer (Mağaza poligonlarının EN ÜSTÜNDE) -->
          <svg id="route-svg" class="absolute inset-0 pointer-events-none" width="${this.vbWidth}" height="${this.vbHeight}" viewBox="0 0 ${this.vbWidth} ${this.vbHeight}" style="z-index: 50; overflow: visible;"></svg>

          <!-- Animated Shopping Cart Layer -->
          <div id="avatar-layer" class="absolute inset-0 pointer-events-none" style="width: ${this.vbWidth}px; height: ${this.vbHeight}px; z-index: 60;"></div>
        </div>
      </div>
    `;

    this.viewport = document.getElementById('map-viewport');
    this.rotator = document.getElementById('map-rotator');
    this.svgLayer = document.getElementById('svg-layer');
    this.routeSvg = document.getElementById('route-svg');
    this.markersLayer = document.getElementById('markers-layer');
    this.avatarLayer = document.getElementById('avatar-layer');

    this.initialLoadPromise = this.loadFloor(this.currentFloor).then(() => {
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

        // Anchor mağazalar için SVG içi metinleri gizle (üzerlerinde bağımsız HTML rozet/logo bulunduğu için)
        const floorInfo = this.mallData && this.mallData.floors ? this.mallData.floors[floorNum] : null;
        if (floorInfo && floorInfo.stores) {
          floorInfo.stores.forEach(store => {
            if (store.is_anchor) {
              const poly = svgEl.querySelector(`[data-id="${store.id}"], #${store.room_id || store.id}`);
              if (poly) {
                poly.classList.add('is-anchor');
                poly.setAttribute('data-is-anchor', 'true');
                const txt = poly.querySelector('text');
                if (txt) {
                  txt.setAttribute('display', 'none');
                  txt.style.display = 'none';
                }
              }
            }
          });
        }

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
    // Haritanın boş zeminine (koridorlar, atrium vb.) tıklandığında seçimi temizle ve kartı kapat
    svgEl.addEventListener('click', (e) => {
      if (e.target.closest('.store-polygon') || e.target.closest('.logo-tile-marker') || e.target.closest('.amenity-marker')) return;
      if (this.onMapClick) this.onMapClick();
    });

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
          const isTarget = this.activeTargetStore && this.activeTargetStore.id === storeData.id;
          const isSelected = this.selectedStore && this.selectedStore.id === storeData.id;
          if (!isTarget && !isSelected) {
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

  /**
   * Mağaza ID veya verisine göre SVG poligon elemanını güvenle bulur
   */
  getStorePolygon(storeOrId) {
    if (!this.svgLayer || !storeOrId) return null;
    const id = typeof storeOrId === 'string' ? storeOrId : (storeOrId.id || storeOrId.room_id);
    const roomId = typeof storeOrId === 'object' ? storeOrId.room_id : null;
    const selectors = [`[data-id="${id}"]`, `#${id}`];
    if (roomId) selectors.push(`[data-id="${roomId}"]`, `#${roomId}`);
    return this.svgLayer.querySelector(selectors.join(', '));
  }

  /**
   * Aktif seçilen mağazayı (POI) ayarlar ve haritada kalıcı seçim vurgusu ekler
   */
  setSelectedStore(store) {
    // Önceki seçili poligonun vurgusunu temizle
    if (this.selectedStore && (!store || this.selectedStore.id !== store.id)) {
      const prevPoly = this.getStorePolygon(this.selectedStore);
      if (prevPoly) {
        prevPoly.classList.remove('store-selected');
        this.highlightStore(this.selectedStore.id, false);
      }
    }

    this.selectedStore = store;

    if (store && store.floor === this.currentFloor) {
      const poly = this.getStorePolygon(store);
      if (poly) {
        poly.classList.add('store-selected');
        this.highlightStore(store.id, true);
      }
    }
  }

  highlightStore(storeId, isHighlighted) {
    const poly = this.getStorePolygon(storeId);
    if (!poly) return;

    // Haritada içi boş mavi çerçeveli kutu kaldırıldı
    if (isHighlighted) {
      poly.classList.add('store-highlight');
    } else {
      poly.classList.remove('store-highlight');
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
      stores = stores.filter(s => s.category === this.activeCategoryFilter || s.id === this.activeTargetStore?.id || s.id === this.activeStartStore?.id);
    }

    const isZoomed = this.scale >= 1.35;
    const isFiltered = this.activeCategoryFilter && this.activeCategoryFilter !== 'all';
    const showAll = this.displayMode === 'all' || isZoomed || isFiltered;

    // Hedef ve Başlangıç en öncelikli, sonra Anchor ve logolu kurumsal mağazalar
    const sortedStores = [...stores].sort((a, b) => {
      const getPrio = (s) => {
        if (this.activeTargetStore?.id === s.id || this.activeStartStore?.id === s.id) return 4;
        if (s.is_anchor) return 3;
        if (typeof hasBrandLogo === 'function' && hasBrandLogo(s)) return 2;
        return 1;
      };
      return getPrio(b) - getPrio(a);
    });

    const placedPositions = [];
    const minDistance = isZoomed ? 18 : (showAll ? 24 : 26);

    sortedStores.forEach(store => {
      const isTarget = this.activeTargetStore && this.activeTargetStore.id === store.id;
      const isStart = this.activeStartStore && this.activeStartStore.id === store.id;
      const isAnchor = !!store.is_anchor;
      const hasLogo = (typeof hasBrandLogo === 'function' && hasBrandLogo(store));

      if (!showAll && !isAnchor && !isTarget && !isStart && !hasLogo) {
        return;
      }

      // Çakışma kontrolü (Hedef ve başlangıç hariç)
      if (!isTarget && !isStart) {
        const collides = placedPositions.some(p => Math.hypot(p.x - store.cx, p.y - store.cy) < minDistance);
        if (collides) return;
      }

      placedPositions.push({ x: store.cx, y: store.cy });

      // Uzun mağazalarda veya 2. Kat Food Court'ta logoyu SVG metninin üstüne orantılı yerleştir
      // Hedef veya Başlangıç noktalarında ofset ASLA uygulanmaz, doğrudan mağazanın matematiksel merkezine (cx, cy) ortalanır
      const isTargetOrStart = isTarget || isStart;
      const isTallShop = (store.cy > 520 && store.cy < 680 && store.cx > 350 && store.cx < 1050 && floorNum === 4);
      const isFoodCourtShop = (floorNum === 6);
      const offsetY = (!isAnchor && !isTargetOrStart && (isFoodCourtShop || isTallShop)) ? -22 : 0;

      const marker = document.createElement('div');
      marker.className = `logo-tile-marker ${isAnchor ? 'is-anchor' : (hasLogo ? 'is-brand-store' : 'is-secondary')} ${isTarget ? 'is-target' : ''} ${isStart ? 'is-start' : ''}`;
      marker.style.left = `${store.cx}px`;
      marker.style.top = `${store.cy + offsetY}px`;
      marker.setAttribute('data-store-id', store.id);
      marker.title = `${store.name} (${store.floor_name || store.floor + '. Kat'})`;

      const logoHtml = getStoreLogo(store, isAnchor ? 32 : 28);

      marker.innerHTML = `
        <div class="logo-tile">
          ${logoHtml}
        </div>
        ${isTarget || isStart ? `
          <span class="marker-name-label marker-name-pinned text-sm font-black text-white ${isStart ? 'bg-emerald-600 ring-2 ring-emerald-400' : 'bg-red-600 ring-2 ring-red-400'} px-2.5 py-0.5 rounded-full shadow-md whitespace-nowrap mt-1 cursor-pointer animate-pulse">
            ${isStart ? '📍 Başlangıç: ' : '🎯 Hedef: '}${store.name}
          </span>
        ` : `
          <span class="marker-name-label ${isAnchor ? 'marker-name-anchor' : 'marker-name-secondary'} text-sm font-bold text-slate-800 dark:text-slate-100 bg-white/95 dark:bg-slate-900/95 px-2 py-0.5 rounded-full shadow-md border border-slate-200 dark:border-slate-700 whitespace-nowrap mt-1 cursor-pointer absolute top-full z-40">
            ${store.name}
          </span>
        `}
      `;

      marker.addEventListener('mouseenter', () => {
        this.highlightStore(store.id, true);
      });

      marker.addEventListener('mouseleave', () => {
        const isTarget = this.activeTargetStore && this.activeTargetStore.id === store.id;
        const isSelected = this.selectedStore && this.selectedStore.id === store.id;
        if (!isTarget && !isSelected) {
          this.highlightStore(store.id, false);
        }
      });

      marker.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.onStoreClick) {
          this.onStoreClick(store);
        }
      });

      const label = marker.querySelector('.marker-name-label');
      if (label) {
        label.addEventListener('click', (e) => {
          e.stopPropagation();
          if (this.onStoreClick) {
            this.onStoreClick(store);
          }
        });
      }

      const tile = marker.querySelector('.logo-tile');
      if (tile) {
        tile.addEventListener('click', (e) => {
          e.stopPropagation();
          if (this.onStoreClick) {
            this.onStoreClick(store);
          }
        });
      }

      fragment.appendChild(marker);
    });

    // Eğer seçili başlangıç noktası bu kattaysa ve mağaza listesinde yoksa (Kapı, Danışma, Havuz vb.)
    if (this.activeStartStore && this.activeStartStore.floor === floorNum) {
      const alreadyHas = sortedStores.some(s => s.id === this.activeStartStore.id);
      if (!alreadyHas && this.activeStartStore.cx && this.activeStartStore.cy) {
        const startMarker = document.createElement('div');
        startMarker.className = 'logo-tile-marker is-start is-active';
        startMarker.style.left = `${this.activeStartStore.cx}px`;
        startMarker.style.top = `${this.activeStartStore.cy}px`;
        startMarker.title = `Başlangıç: ${this.activeStartStore.name}`;
        startMarker.innerHTML = `
          <div class="logo-tile">
            <span class="text-base font-bold text-emerald-600">📍</span>
          </div>
          <span class="marker-name-label text-sm font-black text-white bg-emerald-600 ring-2 ring-emerald-400 px-2.5 py-0.5 rounded-full shadow-md whitespace-nowrap mt-1 cursor-pointer animate-pulse">
            📍 Başlangıç: ${this.activeStartStore.name}
          </span>
        `;
        fragment.appendChild(startMarker);
      }
    }

    // Eğer seçili hedef noktası bu kattaysa ve mağaza listesinde yoksa
    if (this.activeTargetStore && this.activeTargetStore.floor === floorNum) {
      const alreadyHas = sortedStores.some(s => s.id === this.activeTargetStore.id);
      if (!alreadyHas && this.activeTargetStore.cx && this.activeTargetStore.cy) {
        const targetMarker = document.createElement('div');
        targetMarker.className = 'logo-tile-marker is-target is-active';
        targetMarker.style.left = `${this.activeTargetStore.cx}px`;
        targetMarker.style.top = `${this.activeTargetStore.cy}px`;
        targetMarker.title = `Hedef: ${this.activeTargetStore.name}`;
        targetMarker.innerHTML = `
          <div class="logo-tile">
            <span class="text-base font-bold text-rose-600">🎯</span>
          </div>
          <span class="marker-name-label text-sm font-black text-white bg-rose-600 ring-2 ring-rose-400 px-2.5 py-0.5 rounded-full shadow-md whitespace-nowrap mt-1 cursor-pointer animate-pulse">
            🎯 Hedef: ${this.activeTargetStore.name}
          </span>
        `;
        fragment.appendChild(targetMarker);
      }
    }

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
    if (!this.routeSvg) {
      this.routeSvg = document.getElementById('route-svg');
    }
    if (!this.routeSvg) return;
    this.routeSvg.innerHTML = '';

    if (!this.activeRoute) return;

    // 1. Mevcut kattaki segmentleri güvenli çıkar (segments, pathNodes veya segmentsByFloor)
    let currentSegments = [];
    if (this.activeRoute.segments && Array.isArray(this.activeRoute.segments)) {
      currentSegments = this.activeRoute.segments.filter(s => s.floor === this.currentFloor);
    } else if (this.activeRoute.pathNodes && Array.isArray(this.activeRoute.pathNodes)) {
      let cur = null;
      for (const n of this.activeRoute.pathNodes) {
        if (n.floor === this.currentFloor) {
          if (!cur) {
            cur = { floor: this.currentFloor, points: [] };
            currentSegments.push(cur);
          }
          cur.points.push({ x: n.x, y: n.y, id: n.id });
        } else {
          cur = null;
        }
      }
    } else if (this.activeRoute.segmentsByFloor && this.activeRoute.segmentsByFloor[this.currentFloor]) {
      currentSegments = [{ floor: this.currentFloor, points: this.activeRoute.segmentsByFloor[this.currentFloor] }];
    }

    if (!currentSegments.length) return;

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'route-group');

    currentSegments.forEach(seg => {
      if (!seg.points || seg.points.length < 2) return;

      let d = `M ${seg.points[0].x} ${seg.points[0].y}`;
      for (let i = 1; i < seg.points.length; i++) {
        d += ` L ${seg.points[i].x} ${seg.points[i].y}`;
      }

      // Katman 1: Ambient Glow (Dış Işıltı)
      const glowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      glowPath.setAttribute('d', d);
      glowPath.setAttribute('class', 'route__glow');
      glowPath.setAttribute('fill', 'none');
      glowPath.setAttribute('stroke', '#60a5fa');
      glowPath.setAttribute('stroke-width', '14');
      glowPath.setAttribute('stroke-linecap', 'round');
      glowPath.setAttribute('stroke-linejoin', 'round');
      glowPath.setAttribute('opacity', '0.35');
      glowPath.setAttribute('style', 'filter: blur(2.5px);');
      g.appendChild(glowPath);

      // Katman 2: White Casing (Net Kontrast Beyaz Çerçeve)
      const casePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      casePath.setAttribute('d', d);
      casePath.setAttribute('class', 'route__case');
      casePath.setAttribute('fill', 'none');
      casePath.setAttribute('stroke', '#ffffff');
      casePath.setAttribute('stroke-width', '7');
      casePath.setAttribute('stroke-linecap', 'round');
      casePath.setAttribute('stroke-linejoin', 'round');
      g.appendChild(casePath);

      // Katman 3: Main Line (Parlak Mavi #2563eb, 4px Kesikli Hat)
      const linePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      linePath.setAttribute('d', d);
      linePath.setAttribute('class', 'route__line');
      linePath.setAttribute('fill', 'none');
      linePath.setAttribute('stroke', '#2563eb');
      linePath.setAttribute('stroke-width', '4');
      linePath.setAttribute('stroke-dasharray', '8 6');
      linePath.setAttribute('stroke-linecap', 'round');
      linePath.setAttribute('stroke-linejoin', 'round');
      g.appendChild(linePath);

      // Katman 4: Flowing Dash (Canlı Akış Animasyonu)
      const flowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      flowPath.setAttribute('d', d);
      flowPath.setAttribute('class', 'route__flow');
      flowPath.setAttribute('fill', 'none');
      flowPath.setAttribute('stroke', '#ffffff');
      flowPath.setAttribute('stroke-width', '2');
      flowPath.setAttribute('stroke-dasharray', '4 10');
      flowPath.setAttribute('stroke-linecap', 'round');
      flowPath.setAttribute('stroke-linejoin', 'round');
      g.appendChild(flowPath);
    });

    // 2. Başlangıç ve Hedef Noktaları İçin Animasyonlu SVG İmleri (Tam Mağaza Merkezine Ortalanmış)
    const allPath = this.activeRoute.pathNodes || [];
    if (allPath.length > 0) {
      const firstNode = allPath[0];
      const lastNode = allPath[allPath.length - 1];

      // Eğer başlangıç noktası bu kattaysa: Yeşil Başlangıç İmi (Merkeze Ortala)
      if (firstNode.floor === this.currentFloor) {
        const startX = (this.activeStartStore && this.activeStartStore.floor === this.currentFloor && this.activeStartStore.cx) ? this.activeStartStore.cx : firstNode.x;
        const startY = (this.activeStartStore && this.activeStartStore.floor === this.currentFloor && this.activeStartStore.cy) ? this.activeStartStore.cy : firstNode.y;

        const startG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        startG.setAttribute('class', 'route-start-pin');
        startG.innerHTML = `
          <circle cx="${startX}" cy="${startY}" r="12" fill="#10b981" opacity="0.3">
            <animate attributeName="r" values="8;16;8" dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.45;0.1;0.45" dur="2s" repeatCount="indefinite" />
          </circle>
          <circle cx="${startX}" cy="${startY}" r="6.5" fill="#10b981" stroke="#ffffff" stroke-width="2.5" />
          <circle cx="${startX}" cy="${startY}" r="2" fill="#ffffff" />
        `;
        g.appendChild(startG);
      }

      // Eğer hedef nokta bu kattaysa: Kırmızı Hedef İmi (Mağazanın Dışına Taşmadan Tam Merkeze Ortala)
      if (lastNode.floor === this.currentFloor) {
        const targetX = (this.activeTargetStore && this.activeTargetStore.floor === this.currentFloor && this.activeTargetStore.cx) ? this.activeTargetStore.cx : lastNode.x;
        const targetY = (this.activeTargetStore && this.activeTargetStore.floor === this.currentFloor && this.activeTargetStore.cy) ? this.activeTargetStore.cy : lastNode.y;

        const endG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        endG.setAttribute('class', 'route-end-pin');
        endG.innerHTML = `
          <circle cx="${targetX}" cy="${targetY}" r="14" fill="#ef4444" opacity="0.35">
            <animate attributeName="r" values="9;18;9" dur="1.8s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.5;0.12;0.5" dur="1.8s" repeatCount="indefinite" />
          </circle>
          <circle cx="${targetX}" cy="${targetY}" r="7" fill="#ef4444" stroke="#ffffff" stroke-width="2.5" />
          <circle cx="${targetX}" cy="${targetY}" r="2.5" fill="#ffffff" />
        `;
        g.appendChild(endG);
      }
    }

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
      p.classList.remove('store-active', 'store-target', 'store-start', 'store-selected');
    });

    if (this.selectedStore && this.selectedStore.floor === this.currentFloor) {
      const p = this.getStorePolygon(this.selectedStore);
      if (p) {
        // İçi boş mavi kutu kaldırıldı
        p.classList.add('store-selected');
      }
    }

    if (this.activeStartStore && this.activeStartStore.floor === this.currentFloor) {
      const p = this.getStorePolygon(this.activeStartStore);
      if (p) p.classList.add('store-start');
    }

    if (this.activeTargetStore && this.activeTargetStore.floor === this.currentFloor) {
      const p = this.getStorePolygon(this.activeTargetStore);
      if (p) p.classList.add('store-target', 'store-active');
    }
  }

  flyTo(x, y, targetScale = 1.35, duration = 400, offsetY = 0) {
    const rect = this.container.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = (rect.height / 2) - offsetY;

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
   * Rotanın geçerli kattaki parçalarını ekranın görünür alanına ortalayarak kadrajlar.
   */
  fitRoute(routeData, duration = 420) {
    if (!routeData || !routeData.pathNodes || !routeData.pathNodes.length) return;
    const currentFloorNodes = routeData.pathNodes.filter(n => n.floor === this.currentFloor);
    if (!currentFloorNodes.length) return;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    currentFloorNodes.forEach(n => {
      if (n.x < minX) minX = n.x;
      if (n.x > maxX) maxX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.y > maxY) maxY = n.y;
    });

    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;
    const spanX = Math.max(160, maxX - minX);
    const spanY = Math.max(160, maxY - minY);

    const rect = this.container.getBoundingClientRect();
    const isLandscape = (window.innerWidth > window.innerHeight && window.innerHeight < 650) || (window.innerWidth <= 950 && window.innerWidth > window.innerHeight);
    const isMobile = window.innerWidth <= 768 && !isLandscape;
    const availWidth = rect.width * (isLandscape ? 0.82 : (isMobile ? 0.78 : 0.65));
    const availHeight = rect.height * (isLandscape ? 0.72 : (isMobile ? 0.44 : 0.62));

    const fitScale = Math.min(this.maxScale, Math.max(this.minScale, Math.min(availWidth / spanX, availHeight / spanY)));
    const targetScale = Math.min(fitScale, isMobile ? 1.25 : 1.4);

    // Mobilde dikey modda alt çekmece ve rota kartı nedeniyle merkezi yukarı kaydır; yatayda (landscape) offset yapma
    const offsetY = isLandscape ? 0 : (isMobile ? Math.min(110, rect.height * 0.16) : 0);
    this.flyTo(midX, midY, targetScale, duration, offsetY);
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

    const isLandscape = (window.innerWidth > window.innerHeight && window.innerHeight < 650) || (window.innerWidth <= 950 && window.innerWidth > window.innerHeight);
    const isMobile = window.innerWidth <= 768 && !isLandscape;
    const offsetY = isLandscape ? 0 : (isMobile ? Math.min(80, rect.height * 0.12) : 0);

    const targetPanX = (rect.width / 2) - (x * this.scale);
    const targetPanY = ((rect.height / 2) - offsetY) - (y * this.scale);

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

  handleResize() {
    this.resetView();
  }

  resetView() {
    this.updateDimensions();
    const rect = this.container.getBoundingClientRect();
    const cW = rect.width || this.containerWidth;
    const cH = rect.height || this.containerHeight;
    const isLandscape = (window.innerWidth > window.innerHeight && window.innerHeight < 650) || (window.innerWidth <= 950 && window.innerWidth > window.innerHeight);
    const isMobile = window.innerWidth <= 768 && !isLandscape;

    const scaleX = cW / this.vbWidth;
    const scaleY = cH / this.vbHeight;
    this.scale = Math.max(this.minScale, Math.min(scaleX, scaleY) * (isLandscape ? 0.92 : (isMobile ? 0.90 : 0.94)));
    this.panX = (cW - this.vbWidth * this.scale) / 2;
    const mobileOffset = isMobile ? -35 : 0;
    this.panY = ((cH - this.vbHeight * this.scale) / 2) + mobileOffset;
    this.applyTransform();
  }

  applyTransform() {
    if (!this.viewport) return;
    this.viewport.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.scale})`;

    // Harita Rotasyonu (SVG ve tüm katmanlar için merkezden 700x425 dönüş)
    if (this.rotator) {
      this.rotator.style.transform = `rotate(${this.rotation}deg)`;
    }

    // Billboard Etkisi: Tüm HTML marker ve ikonların dik kalmasını sağla
    if (this.container) {
      this.container.style.setProperty('--billboard-rot', `${-this.rotation}deg`);

      // Mobil ve Masaüstü Dinamik Logo Ölçekleme (Zoom'a göre dengeli boyut)
      const isMobile = window.innerWidth <= 768;
      const targetScreenSize = isMobile ? 26 : 30;
      const baseMarkerSize = 30;
      const rawScale = (targetScreenSize / baseMarkerSize) / this.scale;
      const clampedScale = Math.min(isMobile ? 3.4 : 2.2, Math.max(0.45, rawScale));
      this.container.style.setProperty('--marker-scale', clampedScale.toFixed(3));

      // LoD (Level of Detail) Sınıfları: scale >= 1.8x ise tüm mağaza isimleri görünür, altında yalnız anchor'lar
      if (this.scale >= 1.8) {
        this.container.classList.remove('lod-low');
        this.container.classList.add('lod-high');
      } else {
        this.container.classList.remove('lod-high');
        this.container.classList.add('lod-low');
      }
    }

    // Kuzey Pusulası İğnesi (Kuzey her zaman yukarıyı göstersin: -rotation açısı ile döner)
    const compassNeedle = document.getElementById('compass-needle');
    if (compassNeedle) {
      compassNeedle.style.transform = `rotate(${-this.rotation}deg)`;
    }
  }

  setupEventListeners() {
    this.container.style.touchAction = 'none';

    // Haritanın boş zeminine dokunulduğunu (tap/click) tespit etme
    let mapClickStart = { x: 0, y: 0 };
    let mapClickMoved = false;

    this.container.addEventListener('pointerdown', (e) => {
      mapClickStart = { x: e.clientX, y: e.clientY };
      mapClickMoved = false;
    });

    this.container.addEventListener('pointermove', (e) => {
      if (Math.hypot(e.clientX - mapClickStart.x, e.clientY - mapClickStart.y) > 8) {
        mapClickMoved = true;
      }
    });

    this.container.addEventListener('pointerup', (e) => {
      if (mapClickMoved) return; // Kullanıcı haritayı kaydırdı/zoomladı
      // Eğer tıklanan eleman mağaza, logo, servis ikonu veya bilgi kartıysa harita tıkı sayma
      if (e.target.closest('.store-polygon') || e.target.closest('.logo-tile-marker') || e.target.closest('.amenity-marker') || e.target.closest('#poi-peek-card')) {
        return;
      }
      if (this.onMapClick) {
        this.onMapClick();
      }
    });

    this.container.addEventListener('click', (e) => {
      if (mapClickMoved) return;
      if (e.target.closest('.store-polygon') || e.target.closest('.logo-tile-marker') || e.target.closest('.amenity-marker') || e.target.closest('#poi-peek-card')) {
        return;
      }
      if (this.onMapClick) {
        this.onMapClick();
      }
    });

    // Mouse Drag Pan
    this.container.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      if (this.onUserPan) this.onUserPan();
      this.updateDimensions();
      this.isDragging = true;
      this.startX = e.clientX - this.panX;
      this.startY = e.clientY - this.panY;
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      if (this.onUserPan) this.onUserPan();
      this.panX = e.clientX - this.startX;
      this.panY = e.clientY - this.startY;
      this.clampToBounds();
      this.applyTransform();
    });

    window.addEventListener('mouseup', () => {
      if (this.isDragging) {
        this.isDragging = false;
        this.settleBounds();
      }
    });

    // Dokunmatik Etkileşim: Akıcı Touch Pan, İki Parmakla Odaklı Döndürme & Odaklı Pinch-to-Zoom
    let lastTouchDist = 0;
    let lastMidX = 0;
    let lastMidY = 0;

    this.container.addEventListener('touchstart', (e) => {
      this.updateDimensions();
      if (this.onUserPan) this.onUserPan();
      if (e.touches.length === 1) {
        this.isDragging = true;
        this.startX = e.touches[0].clientX - this.panX;
        this.startY = e.touches[0].clientY - this.panY;
      } else if (e.touches.length === 2) {
        this.isDragging = false;
        const rect = this.container.getBoundingClientRect();
        lastTouchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        lastMidX = ((e.touches[0].clientX + e.touches[1].clientX) / 2) - rect.left;
        lastMidY = ((e.touches[0].clientY + e.touches[1].clientY) / 2) - rect.top;
      }
    }, { passive: false });

    window.addEventListener('touchmove', (e) => {
      if (this.isDragging && e.touches.length === 1) {
        if (this.onUserPan) this.onUserPan();
        this.panX = e.touches[0].clientX - this.startX;
        this.panY = e.touches[0].clientY - this.startY;
        this.clampToBounds();
        this.applyTransform();
      } else if (e.touches.length === 2 && lastTouchDist > 0) {
        if (this.onUserPan) this.onUserPan();
        const rect = this.container.getBoundingClientRect();
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const midX = ((e.touches[0].clientX + e.touches[1].clientX) / 2) - rect.left;
        const midY = ((e.touches[0].clientY + e.touches[1].clientY) / 2) - rect.top;

        // 1. İki parmakla kaydırma (Two-finger pan)
        const deltaMidX = midX - lastMidX;
        const deltaMidY = midY - lastMidY;
        this.panX += deltaMidX;
        this.panY += deltaMidY;

        // 2. Pinch-to-zoom (Dokunulan iki parmağın orta noktasına odaklı)
        if (dist > 0 && lastTouchDist > 0) {
          const factor = dist / lastTouchDist;
          this.updateDimensions();
          const newScale = Math.min(this.maxScale, Math.max(this.minScale, this.scale * factor));
          const zoomRatio = newScale / this.scale;

          this.panX = midX - (midX - this.panX) * zoomRatio;
          this.panY = midY - (midY - this.panY) * zoomRatio;
          this.scale = newScale;
        }

        // 3. Rotasyon KESİNLİKLE KİLİTLİ: Açı daima 0° kalır, bina hiçbir zaman dönmez
        this.rotation = 0;

        lastTouchDist = dist;
        lastMidX = midX;
        lastMidY = midY;
        this.clampToBounds();
        this.applyTransform();
      }
    }, { passive: false });

    window.addEventListener('touchend', (e) => {
      if (e.touches.length === 1) {
        // İki parmaktan tek parmağa geçildiğinde kesintisiz kaydırmaya devam et
        this.isDragging = true;
        this.startX = e.touches[0].clientX - this.panX;
        this.startY = e.touches[0].clientY - this.panY;
      } else if (e.touches.length === 0) {
        this.isDragging = false;
        lastTouchDist = 0;
        this.settleBounds();
      }
    });

    // Wheel Zoom
    this.container.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (this.onUserPan) this.onUserPan();
      this.updateDimensions();
      const rect = this.container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
      const newScale = Math.min(this.maxScale, Math.max(this.minScale, this.scale * zoomFactor));

      this.panX = mouseX - (mouseX - this.panX) * (newScale / this.scale);
      this.panY = mouseY - (mouseY - this.panY) * (newScale / this.scale);
      this.scale = newScale;
      this.clampToBounds();
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
