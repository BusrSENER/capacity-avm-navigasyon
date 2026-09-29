/**
 * İstanbul Bakırköy Capacity AVM - Ana Uygulama Kontrolcüsü (App State Manager)
 * 3 Sütunlu Mağaza Kartları, POI Detay Paneli, Hızlı İhtiyaçlar, Rota Planlama & Alışveriş Sepeti Simülasyonu
 * İlham & Mimari: cevahir-rehber.web.app
 */

let mallData = null;
let mallMap = null;
let navEngine = null;
let cartSimulator = null;

let selectedStartStore = null;
let selectedTargetStore = null;
let activeRouteMode = 'escalator'; // 'escalator' | 'elevator'
let currentFloor = 4; // Zemin Kat varsayılan başlangıç
let filterTab = 'this_floor'; // 'this_floor' | 'all_floors'
let activeCategory = 'all';
let searchQuery = '';

// Toast Notification Engine
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  const typeStyles = {
    info: 'border-cyan-500/40 bg-white/95 dark:bg-slate-900/90 text-cyan-700 dark:text-cyan-300',
    success: 'border-emerald-500/40 bg-white/95 dark:bg-slate-900/90 text-emerald-700 dark:text-emerald-300',
    warning: 'border-amber-500/40 bg-white/95 dark:bg-slate-900/90 text-amber-700 dark:text-amber-300',
    error: 'border-rose-500/40 bg-white/95 dark:bg-slate-900/90 text-rose-700 dark:text-rose-300'
  };

  toast.className = `flex items-center gap-2.5 px-4 py-3 rounded-2xl border shadow-xl backdrop-blur-md text-xs sm:text-sm font-semibold transition-all duration-300 transform translate-y-4 opacity-0 ${typeStyles[type] || typeStyles.info}`;
  toast.innerHTML = `
    <span class="shrink-0 text-base">ℹ️</span>
    <span class="flex-1">${message}</span>
  `;

  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-4', 'opacity-0');
  });

  setTimeout(() => {
    toast.classList.add('translate-y-4', 'opacity-0');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Uygulamayı Başlat
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const resp = await fetch('public/mall_data.json');
    if (!resp.ok) throw new Error('mall_data.json fetch failed: ' + resp.status);
    mallData = await resp.json();

    initApp();
  } catch (err) {
    console.error('Fatal initialization error:', err);
    showToast('Harita verileri yüklenemedi: ' + err.message, 'error');
  }
});

function initApp() {
  navEngine = new NavigationEngine(mallData);

  mallMap = new MallMap('map-canvas-container', mallData, (store) => {
    selectStore(store);
  });

  cartSimulator = new CartSimulator(
    mallMap,
    (progress, stepIndex) => {
      const progressBar = document.getElementById('sim-progress-bar');
      if (progressBar) {
        const pct = Math.min(100, Math.max(0, progress <= 1 ? progress * 100 : progress));
        progressBar.style.width = `${pct}%`;
      }
    },
    (newFloor) => {
      currentFloor = newFloor;
      updateFloorUI(newFloor);
    },
    () => {
      showToast('🎉 Hedefe ulaştınız! Keyifli alışverişler dileriz.', 'success');
      resetSimControls();
    }
  );

  setupTheme();
  setupUIEventListeners();
  setupSearchEngine();
  setupAmenityPills();
  setupTabs();

  updateFloorUI(currentFloor);
  renderSidebarStoreGrid();

  // Varsayılan Başlangıç Noktası (Fişekhane Caddesi Ana Girişi)
  if (!selectedStartStore && mallData.entrances && mallData.entrances.length > 0) {
    selectedStartStore = mallData.entrances.find(e => e.id === 'ent_fisekhane') || mallData.entrances[0];
    updateStartBadgeUI(selectedStartStore.name);
  }

  if (window.lucide) {
    lucide.createIcons();
  }
}

// 1. Tema Yönetimi (Varsayılan Aydınlık Mimari Mod)
function setupTheme() {
  const btn = document.getElementById('theme-toggle-btn');
  const icon = document.getElementById('theme-icon');

  const savedTheme = localStorage.getItem('capacity_theme_v2');
  const isDark = savedTheme === 'dark'; // Varsayılan aydınlık mimari mod

  if (isDark) {
    document.documentElement.classList.add('dark');
    if (icon) icon.setAttribute('data-lucide', 'sun');
  } else {
    document.documentElement.classList.remove('dark');
    if (icon) icon.setAttribute('data-lucide', 'moon');
  }

  btn?.addEventListener('click', () => {
    const currentlyDark = document.documentElement.classList.contains('dark');
    if (currentlyDark) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('capacity_theme_v2', 'light');
      if (icon) icon.setAttribute('data-lucide', 'moon');
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('capacity_theme_v2', 'dark');
      if (icon) icon.setAttribute('data-lucide', 'sun');
    }
    if (window.lucide) lucide.createIcons();
  });
}

// 2. Kat Değişimi & UI Güncellemesi
function updateFloorUI(floorNum) {
  currentFloor = floorNum;
  const flInfo = mallData?.floors[floorNum];

  // Başlık Kartı
  const titleEl = document.getElementById('current-floor-title');
  const subEl = document.getElementById('current-floor-sub');
  if (titleEl && flInfo) titleEl.textContent = flInfo.label;
  if (subEl && flInfo) subEl.textContent = flInfo.subtitle;

  // Tab etiketindeki kat adı
  const thisFloorNumSpan = document.getElementById('this-floor-num');
  if (thisFloorNumSpan && flInfo) {
    thisFloorNumSpan.textContent = floorNum === 4 ? 'Zemin' : (flInfo.label.split(' ')[0] || floorNum);
  }

  // Dikey Kat Seçici Butonları
  document.querySelectorAll('.floor-pill').forEach(btn => {
    const f = parseInt(btn.getAttribute('data-floor'), 10);
    if (f === floorNum) {
      btn.classList.add('active', 'bg-slate-900', 'text-white', 'dark:bg-white', 'dark:text-slate-900', 'shadow-md');
      btn.classList.remove('text-slate-600', 'dark:text-slate-300');
    } else {
      btn.classList.remove('active', 'bg-slate-900', 'text-white', 'dark:bg-white', 'dark:text-slate-900', 'shadow-md');
      btn.classList.add('text-slate-600', 'dark:text-slate-300');
    }
  });

  if (filterTab === 'this_floor') {
    renderSidebarStoreGrid();
  }
}

// 3. UI Dinleyicileri
function setupUIEventListeners() {
  // Kat Seçici Butonları
  document.querySelectorAll('.floor-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      const fl = parseInt(btn.getAttribute('data-floor'), 10);
      mallMap.loadFloor(fl);
      updateFloorUI(fl);
    });
  });

  // Kategori Filtre Butonları
  const catPills = document.querySelectorAll('.cat-pill');
  catPills.forEach(pill => {
    pill.addEventListener('click', () => {
      catPills.forEach(p => {
        p.classList.remove('active', 'bg-slate-900', 'text-white', 'dark:bg-white', 'dark:text-slate-900');
        p.classList.add('bg-slate-100', 'text-slate-700', 'dark:bg-slate-800', 'dark:text-slate-300');
      });
      pill.classList.remove('bg-slate-100', 'text-slate-700', 'dark:bg-slate-800', 'dark:text-slate-300');
      pill.classList.add('active', 'bg-slate-900', 'text-white', 'dark:bg-white', 'dark:text-slate-900');

      activeCategory = pill.getAttribute('data-category');
      mallMap.setCategoryFilter(activeCategory);
      renderSidebarStoreGrid();
    });
  });

  // Zoom & Reset Butonları
  document.getElementById('zoom-in-btn')?.addEventListener('click', () => {
    mallMap.scale = Math.min(mallMap.maxScale, mallMap.scale * 1.25);
    mallMap.applyTransform();
  });

  document.getElementById('zoom-out-btn')?.addEventListener('click', () => {
    mallMap.scale = Math.max(mallMap.minScale, mallMap.scale * 0.8);
    mallMap.applyTransform();
  });

  document.getElementById('zoom-reset-btn')?.addEventListener('click', () => {
    mallMap.resetView();
  });

  // Rota Kontrolleri
  document.getElementById('route-swap-btn')?.addEventListener('click', () => {
    if (selectedStartStore && selectedTargetStore) {
      const temp = selectedStartStore;
      selectedStartStore = selectedTargetStore;
      selectedTargetStore = temp;
      calculateAndDisplayRoute();
    }
  });

  document.getElementById('clear-route-btn')?.addEventListener('click', () => {
    clearCurrentRoute();
  });

  // Merdiven / Asansör Mod Seçimi
  const btnEscalator = document.getElementById('mode-escalator');
  const btnElevator = document.getElementById('mode-elevator');

  btnEscalator?.addEventListener('click', () => {
    activeRouteMode = 'escalator';
    btnEscalator.className = 'flex-1 py-1.5 px-2.5 rounded-xl border border-red-500 bg-red-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm';
    btnElevator.className = 'flex-1 py-1.5 px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-all';
    if (selectedStartStore && selectedTargetStore) calculateAndDisplayRoute();
  });

  btnElevator?.addEventListener('click', () => {
    activeRouteMode = 'elevator';
    btnElevator.className = 'flex-1 py-1.5 px-2.5 rounded-xl border border-red-500 bg-red-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm';
    btnEscalator.className = 'flex-1 py-1.5 px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-all';
    if (selectedStartStore && selectedTargetStore) calculateAndDisplayRoute();
  });

  // Simülatör Olayları
  const simPlayBtn = document.getElementById('sim-play-btn');
  simPlayBtn?.addEventListener('click', () => {
    if (!cartSimulator.isPlaying) {
      cartSimulator.start();
      document.getElementById('sim-play-text').textContent = 'Duraklat';
      if (window.lucide) lucide.createIcons();
    } else {
      cartSimulator.pause();
      document.getElementById('sim-play-text').textContent = 'Devam Et';
    }
  });

  document.getElementById('sim-reset-btn')?.addEventListener('click', () => {
    cartSimulator.stop();
    resetSimControls();
    if (selectedStartStore) {
      mallMap.loadFloor(selectedStartStore.floor).then(() => {
        updateFloorUI(selectedStartStore.floor);
        mallMap.flyTo(selectedStartStore.cx, selectedStartStore.cy, 1.4);
      });
    }
  });

  // Hız Butonları
  ['1', '2', '4'].forEach(spd => {
    document.getElementById(`sim-speed-${spd}`)?.addEventListener('click', (e) => {
      document.querySelectorAll('#sim-controls-panel button[id^="sim-speed-"]').forEach(b => {
        b.className = 'px-2 py-1 rounded-lg text-slate-600 dark:text-slate-300 font-bold hover:text-slate-900 dark:hover:text-white';
      });
      e.target.className = 'px-2 py-1 rounded-lg bg-cyan-600 text-white font-bold';
      cartSimulator.setSpeed(parseFloat(spd));
    });
  });

  // Başlangıç Konumu Seçim Butonu
  const startLocBtn = document.getElementById('start-location-btn') || document.getElementById('gps-quick-btn');
  startLocBtn?.addEventListener('click', () => {
    openEntranceModal();
  });

  // 3 Hızlı Başlangıç Butonu (1-Tıkla Anında Seçim)
  const quickStartMap = {
    'btn-quick-fisekhane': 'ent_fisekhane',
    'btn-quick-carousel': 'ent_carousel',
    'btn-quick-danisma': 'ent_danisma'
  };

  Object.entries(quickStartMap).forEach(([btnId, entId]) => {
    document.getElementById(btnId)?.addEventListener('click', () => {
      const ent = mallData.entrances.find(e => e.id === entId);
      if (ent) {
        selectedStartStore = ent;
        updateStartBadgeUI(ent.name);

        mallMap.activeStartStore = selectedStartStore;
        mallMap.updateActiveStorePolygons();
        showToast(`📍 Başlangıç: ${ent.name}`, 'info');

        if (selectedTargetStore && selectedTargetStore.id !== selectedStartStore.id) {
          calculateAndDisplayRoute();
        } else {
          // Zemin kata ve noktaya odaklan
          if (mallMap.currentFloor !== ent.floor) {
            mallMap.loadFloor(ent.floor).then(() => {
              updateFloorUI(ent.floor);
              mallMap.flyTo(ent.cx, ent.cy, 1.35);
            });
          } else {
            mallMap.flyTo(ent.cx, ent.cy, 1.35);
          }
        }
      }
    });
  });

  // Rota kartı üzerindeki başlangıç etiketine tıklanırsa da başlangıç seçim modalını aç
  document.getElementById('route-start-label')?.addEventListener('click', () => {
    openEntranceModal();
  });

  document.getElementById('entrance-modal-close')?.addEventListener('click', () => {
    closeEntranceModal();
  });

  // POI Geri Butonu
  document.getElementById('poi-back-btn')?.addEventListener('click', () => {
    closePoiDetail();
  });

  // POI Aksiyon Butonları
  document.getElementById('poi-route-btn')?.addEventListener('click', () => {
    if (selectedTargetStore) {
      if (!selectedStartStore) {
        // Otomatik olarak Fişekhane Cad. Ana Girişini başlangıç yap
        const fisekhaneEnt = mallData.entrances.find(e => e.id === 'ent_fisekhane') || mallData.entrances[0];
        selectedStartStore = fisekhaneEnt;
        updateStartBadgeUI(selectedStartStore.name);
      }
      calculateAndDisplayRoute();
    }
  });

  document.getElementById('poi-start-btn')?.addEventListener('click', () => {
    if (selectedTargetStore) {
      selectedStartStore = selectedTargetStore;
      updateStartBadgeUI(selectedStartStore.name);
      mallMap.activeStartStore = selectedStartStore;
      mallMap.updateActiveStorePolygons();
      showToast(`📍 Başlangıç noktası "${selectedStartStore.name}" olarak ayarlandı.`, 'info');

      const startBtn = document.getElementById('poi-start-btn');
      if (startBtn) {
        startBtn.innerHTML = `
          <i data-lucide="check-circle" class="w-3.5 h-3.5 text-emerald-500"></i>
          <span class="text-emerald-600 dark:text-emerald-400 font-bold">Başlangıç Olarak Seçildi</span>
        `;
        if (window.lucide) lucide.createIcons();
      }

      if (selectedTargetStore && selectedStartStore.id !== selectedTargetStore.id) {
        calculateAndDisplayRoute();
      }
    }
  });

  document.getElementById('poi-copy-coupon-btn')?.addEventListener('click', () => {
    const code = document.getElementById('poi-coupon-code')?.textContent;
    if (code) {
      navigator.clipboard.writeText(code).then(() => {
        showToast(`🎉 "${code}" kupon kodu kopyalandı!`, 'success');
      });
    }
  });
}

// 4. Arama Motoru
function setupSearchEngine() {
  const searchInput = document.getElementById('search-input');
  const clearBtn = document.getElementById('search-clear-btn');

  let debounceTimer = null;

  searchInput?.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    searchQuery = e.target.value.trim();

    if (searchQuery.length > 0) {
      clearBtn?.classList.remove('hidden');
    } else {
      clearBtn?.classList.add('hidden');
    }

    debounceTimer = setTimeout(() => {
      closePoiDetail();
      renderSidebarStoreGrid();
    }, 180);
  });

  clearBtn?.addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    clearBtn.classList.add('hidden');
    renderSidebarStoreGrid();
  });
}

// 5. Hızlı İhtiyaç Çipleri (Amenities)
function setupAmenityPills() {
  document.querySelectorAll('.amenity-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const amenityKind = pill.getAttribute('data-amenity');
      const floorAmenities = mallData.floors[currentFloor]?.amenities || [];
      let found = floorAmenities.find(a => a.kind === amenityKind);

      if (!found) {
        // Başka katlarda ara
        for (let fl = 1; fl <= 6; fl++) {
          const ams = mallData.floors[fl]?.amenities || [];
          found = ams.find(a => a.kind === amenityKind);
          if (found) {
            mallMap.loadFloor(fl).then(() => {
              updateFloorUI(fl);
              selectStore(found);
            });
            return;
          }
        }
      }

      if (found) {
        selectStore(found);
      } else {
        showToast('Bu katta aranan servis noktası bulunamadı.', 'warning');
      }
    });
  });
}

// 6. Segmented Tabs: Bu Katta vs Tüm Katlar
function setupTabs() {
  const tabThis = document.getElementById('tab-this-floor');
  const tabAll = document.getElementById('tab-all-floors');

  tabThis?.addEventListener('click', () => {
    filterTab = 'this_floor';
    tabThis.className = 'flex-1 py-1.5 text-xs font-bold rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm transition-all text-center';
    tabAll.className = 'flex-1 py-1.5 text-xs font-semibold rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all text-center';
    renderSidebarStoreGrid();
  });

  tabAll?.addEventListener('click', () => {
    filterTab = 'all_floors';
    tabAll.className = 'flex-1 py-1.5 text-xs font-bold rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm transition-all text-center';
    tabThis.className = 'flex-1 py-1.5 text-xs font-semibold rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all text-center';
    renderSidebarStoreGrid();
  });
}

// 7. Sol Panel 3-Sütunlu Mağaza Kartları Grid'i
function getAllStores() {
  const stores = [];
  if (!mallData) return stores;
  for (let fl = 1; fl <= 6; fl++) {
    (mallData.floors[fl]?.stores || []).forEach(s => stores.push(s));
  }
  return stores;
}

function renderSidebarStoreGrid() {
  const grid = document.getElementById('sidebar-store-grid');
  if (!grid) return;

  let list = [];
  if (filterTab === 'this_floor') {
    list = mallData.floors[currentFloor]?.stores || [];
  } else {
    list = getAllStores();
  }

  // Kategori Filtresi
  if (activeCategory && activeCategory !== 'all') {
    list = list.filter(s => s.category === activeCategory);
  }

  // Arama Filtresi
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    list = list.filter(s =>
      s.name.toLowerCase().includes(q) ||
      (s.category_name && s.category_name.toLowerCase().includes(q))
    );
  }

  // Alfabetik sırala
  list.sort((a, b) => a.name.localeCompare(b.name, 'tr'));

  if (list.length === 0) {
    grid.innerHTML = `
      <div class="col-span-3 py-12 text-center text-slate-400">
        <div class="text-3xl mb-2">🔍</div>
        <div class="text-xs font-semibold text-slate-700 dark:text-slate-300">Mağaza bulunamadı</div>
        <div class="text-[11px] text-slate-400 mt-1">Farklı bir arama veya kategori deneyebilirsiniz.</div>
      </div>
    `;
    return;
  }

  grid.innerHTML = list.map(store => {
    const logoHtml = getStoreLogo(store, 34);
    const isSelected = selectedTargetStore && selectedTargetStore.id === store.id;

    return `
      <div class="store-card ${isSelected ? 'is-active' : ''}" data-store-id="${store.id}" data-floor="${store.floor}">
        <div class="store-card__logo">
          ${logoHtml}
        </div>
        <div class="store-card__name">${store.name}</div>
        <div class="store-card__floor">${store.floor_name || store.floor + '. Kat'}</div>
      </div>
    `;
  }).join('');

  grid.querySelectorAll('.store-card').forEach(card => {
    card.addEventListener('click', () => {
      const sId = card.getAttribute('data-store-id');
      const store = getAllStores().find(s => s.id === sId);
      if (store) {
        selectStore(store);
      }
    });
  });
}

// 8. Mağaza Seçimi & POI Detayı
function selectStore(store) {
  selectedTargetStore = store;

  // Kartlardaki aktif sınıfı
  document.querySelectorAll('.store-card').forEach(c => {
    if (c.getAttribute('data-store-id') === store.id) {
      c.classList.add('is-active');
    } else {
      c.classList.remove('is-active');
    }
  });

  // Farklı kattaysa kata geç
  if (mallMap.currentFloor !== store.floor) {
    mallMap.loadFloor(store.floor).then(() => {
      updateFloorUI(store.floor);
      mallMap.flyTo(store.cx, store.cy, 1.45);
      mallMap.highlightStore(store.id, true);
    });
  } else {
    mallMap.flyTo(store.cx, store.cy, 1.45);
    mallMap.highlightStore(store.id, true);
  }

  // POI Detay Paneli
  renderPoiDetail(store);
}

function renderPoiDetail(store) {
  const poiPanel = document.getElementById('sidebar-poi-detail');
  const storeGrid = document.getElementById('sidebar-store-grid');
  const tabsContainer = document.getElementById('sidebar-tabs-container');

  if (!poiPanel) return;

  // Görünürlük
  storeGrid?.classList.add('hidden');
  tabsContainer?.classList.add('hidden');
  poiPanel.classList.remove('hidden');

  // Bilgileri Doldur
  const logoEl = document.getElementById('poi-logo');
  if (logoEl) logoEl.innerHTML = getStoreLogo(store, 44);

  const nameEl = document.getElementById('poi-name');
  if (nameEl) nameEl.textContent = store.name;

  const catEl = document.getElementById('poi-category');
  if (catEl) catEl.textContent = store.category_name || store.category;

  const flBadge = document.getElementById('poi-floor-badge');
  if (flBadge) flBadge.textContent = store.floor_name || store.floor + '. Kat';

  const unitEl = document.getElementById('poi-unit-no');
  if (unitEl) unitEl.textContent = `Kapı No: ${store.unit || 'Z-12'}`;

  const phoneEl = document.getElementById('poi-phone');
  if (phoneEl) phoneEl.textContent = store.phone || '0212 559 0000';

  // Kampanya
  const camp = store.campaign || {
    title: 'Capacity Sezon İndirimi',
    discount: '%40 İndirim',
    code: 'CAPACITY40',
    badge: '🔥 Fırsat'
  };

  const campBadge = document.getElementById('poi-campaign-badge');
  if (campBadge) campBadge.textContent = camp.badge || '%40 İndirim';

  const campText = document.getElementById('poi-campaign-text');
  if (campText) campText.textContent = camp.title;

  const couponCode = document.getElementById('poi-coupon-code');
  if (couponCode) couponCode.textContent = camp.code;
}

function closePoiDetail() {
  const poiPanel = document.getElementById('sidebar-poi-detail');
  const storeGrid = document.getElementById('sidebar-store-grid');
  const tabsContainer = document.getElementById('sidebar-tabs-container');

  poiPanel?.classList.add('hidden');
  storeGrid?.classList.remove('hidden');
  tabsContainer?.classList.remove('hidden');
}

// 9. Rota Hesaplama ve Görüntüleme
function calculateAndDisplayRoute() {
  if (!selectedStartStore || !selectedTargetStore) return;

  const result = navEngine.findRoute(
    selectedStartStore.nav_node,
    selectedTargetStore.nav_node,
    activeRouteMode
  );

  if (!result || !result.pathNodes || !result.pathNodes.length) {
    showToast('Bu iki nokta arasında uygun yol bulunamadı.', 'error');
    return;
  }
  result.path = result.pathNodes;

  // Rota Kartını Göster
  const routeCard = document.getElementById('route-info-card');
  routeCard?.classList.remove('hidden');

  document.getElementById('route-start-label').textContent = selectedStartStore.name;
  document.getElementById('route-target-label').textContent = selectedTargetStore.name;
  document.getElementById('route-floors').textContent = `${selectedStartStore.floor_name || selectedStartStore.floor + '. Kat'} → ${selectedTargetStore.floor_name || selectedTargetStore.floor + '. Kat'}`;

  document.getElementById('route-distance').textContent = `${result.totalDistance} m`;
  document.getElementById('route-time').textContent = `~${result.estimatedMinutes} dk`;

  // Adım Adım Talimatlar
  const stepsContainer = document.getElementById('route-steps-container');
  if (stepsContainer && result.instructions) {
    stepsContainer.innerHTML = result.instructions.map(ins => `
      <div class="flex items-start gap-2 p-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
        <span class="w-5 h-5 rounded-full bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center font-bold text-[9px] shrink-0 mt-0.5">${ins.step}</span>
        <div>
          <div class="font-bold text-slate-800 dark:text-slate-200">${ins.text}</div>
          <div class="text-[10px] text-slate-400">${mallData.floors[ins.floor]?.label || ins.floor + '. Kat'}</div>
        </div>
      </div>
    `).join('');
  }

  // Haritada Rota Çiz
  mallMap.activeStartStore = selectedStartStore;
  mallMap.activeTargetStore = selectedTargetStore;
  mallMap.renderRoute(result);
  mallMap.updateActiveStorePolygons();

  // Simülatöre Rota Ver
  cartSimulator.setRoute(result);

  // Başlangıç Katına Odaklan
  if (mallMap.currentFloor !== selectedStartStore.floor) {
    mallMap.loadFloor(selectedStartStore.floor).then(() => {
      updateFloorUI(selectedStartStore.floor);
      mallMap.flyTo(selectedStartStore.cx, selectedStartStore.cy, 1.4);
    });
  } else {
    mallMap.flyTo(selectedStartStore.cx, selectedStartStore.cy, 1.4);
  }

  showToast(`✅ Rota oluşturuldu (${result.totalDistance} m, ~${result.estimatedMinutes} dk)`, 'success');
}

function clearCurrentRoute() {
  selectedStartStore = null;
  selectedTargetStore = null;
  mallMap.clearRoute();
  cartSimulator.stop();

  document.getElementById('route-info-card')?.classList.add('hidden');
  resetSimControls();
}

function resetSimControls() {
  const progressBar = document.getElementById('sim-progress-bar');
  if (progressBar) progressBar.style.width = '0%';
  const playText = document.getElementById('sim-play-text');
  if (playText) playText.textContent = 'Sepeti Başlat';
}

// 10. Başlangıç Konumu Rozetini ve Hızlı Butonları Güncelle
function updateStartBadgeUI(name) {
  const badge = document.getElementById('start-badge-text');
  if (badge && name) {
    let shortName = name
      .replace(' (Cadde)', '')
      .replace(' (Meydan)', '')
      .replace(' (Kuzey)', '')
      .replace(' (Info Desk)', '')
      .replace(' Caddesi Ana Giriş', ' Girişi')
      .replace(' Tarafı Batı Giriş', ' Girişi')
      .replace(' Ana Giriş', '');
    badge.textContent = shortName;
    badge.parentElement?.setAttribute('title', `Başlangıç Konumu: ${name}`);

    // 3 Hızlı Başlangıç Çipini Senkronize Et
    document.querySelectorAll('.quick-start-chip').forEach(b => {
      const isMatch = (b.id === 'btn-quick-fisekhane' && name.includes('Fişekhane')) ||
                      (b.id === 'btn-quick-carousel' && name.includes('Carousel')) ||
                      (b.id === 'btn-quick-danisma' && name.includes('Danışma'));
      if (isMatch) {
        b.className = 'quick-start-chip active px-2.5 py-1 rounded-xl bg-emerald-600 text-white text-[11px] font-bold flex items-center gap-1 shrink-0 transition-all shadow-sm';
      } else {
        b.className = 'quick-start-chip px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-semibold flex items-center gap-1 shrink-0 transition-all border border-slate-200 dark:border-slate-700';
      }
    });
  }
}

// 11. Başlangıç Noktası Seçim Modalı
function openEntranceModal() {
  const modal = document.getElementById('entrance-modal');
  if (!modal) return;

  const listContainer = document.getElementById('entrance-list');
  if (!listContainer) return;

  const startingLocations = [
    // 1. Giriş Kapıları
    ...(mallData.entrances || []).map(ent => ({
      id: ent.id,
      name: ent.name,
      floor: ent.floor,
      floor_name: ent.floor_name || (ent.floor === 4 ? 'Zemin Kat' : ent.floor + '. Kat'),
      nav_node: ent.nav_node,
      cx: ent.cx,
      cy: ent.cy,
      iconEmoji: '🚪',
      badge: 'Ana Kapı',
      badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
    })),
    // 2. Danışma
    {
      id: 'start_danisma',
      name: 'Ana Danışma & Misafir Hizmetleri',
      floor: 4,
      floor_name: 'Zemin Kat (Atrium)',
      nav_node: 'n_info_4',
      cx: 258,
      cy: 185,
      iconEmoji: 'ℹ️',
      badge: 'Danışma',
      badgeClass: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300'
    },
    // 3. Müzikli Gösteri Havuzu
    {
      id: 'start_havuz',
      name: 'Müzikli Gösteri Havuzu (Etkinlik Alanı)',
      floor: 4,
      floor_name: 'Zemin Kat (Merkez)',
      nav_node: 'bridge_4_m',
      cx: 258,
      cy: 365,
      iconEmoji: '🌊',
      badge: 'Buluşma Noktası',
      badgeClass: 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
    }
  ];

  listContainer.innerHTML = startingLocations.map(loc => {
    const isSelected = selectedStartStore && (selectedStartStore.id === loc.id || selectedStartStore.name === loc.name);
    return `
      <div 
        class="flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer ${
          isSelected 
            ? 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-500 shadow-sm' 
            : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200/80 dark:border-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-700/80'
        }" 
        data-loc-id="${loc.id}"
      >
        <div class="flex items-center gap-3 min-w-0 flex-1">
          <span class="text-xl shrink-0">${loc.iconEmoji}</span>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5 flex-wrap">
              <h4 class="text-xs font-bold text-slate-900 dark:text-white truncate">${loc.name}</h4>
              <span class="text-[9px] px-1.5 py-0.5 rounded-md font-bold ${loc.badgeClass}">${loc.badge}</span>
            </div>
            <p class="text-[11px] text-slate-400 mt-0.5">${loc.floor_name}</p>
          </div>
        </div>
        <button class="ml-2 px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all ${
          isSelected 
            ? 'bg-emerald-600 text-white' 
            : 'bg-slate-200 dark:bg-slate-700 hover:bg-emerald-600 hover:text-white text-slate-700 dark:text-slate-200'
        }">
          ${isSelected ? '✓ Seçili' : 'Başla'}
        </button>
      </div>
    `;
  }).join('');

  listContainer.querySelectorAll('[data-loc-id]').forEach(el => {
    el.addEventListener('click', () => {
      const locId = el.getAttribute('data-loc-id');
      const chosen = startingLocations.find(l => l.id === locId);
      if (chosen) {
        selectedStartStore = chosen;
        updateStartBadgeUI(chosen.name);
        mallMap.activeStartStore = selectedStartStore;
        mallMap.updateActiveStorePolygons();
        closeEntranceModal();
        showToast(`📍 Başlangıç noktası "${chosen.name}" olarak ayarlandı.`, 'info');

        if (selectedTargetStore && selectedTargetStore.id !== selectedStartStore.id) {
          calculateAndDisplayRoute();
        } else {
          // Başlangıç katına odaklan
          if (mallMap.currentFloor !== chosen.floor) {
            mallMap.loadFloor(chosen.floor).then(() => {
              updateFloorUI(chosen.floor);
              mallMap.flyTo(chosen.cx, chosen.cy, 1.4);
            });
          } else {
            mallMap.flyTo(chosen.cx, chosen.cy, 1.4);
          }
        }
      }
    });
  });

  modal.classList.remove('hidden');
}

function closeEntranceModal() {
  document.getElementById('entrance-modal')?.classList.add('hidden');
}
