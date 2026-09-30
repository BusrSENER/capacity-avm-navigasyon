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
let activePoiStore = null;
let activeRouteMode = 'escalator'; // 'escalator' | 'elevator'
window.activeRouteMode = activeRouteMode;
let currentFloor = 4; // Zemin Kat varsayılan başlangıç
let filterTab = 'this_floor'; // 'this_floor' | 'all_floors'
let activeCategory = 'all';
let searchQuery = '';

// Simülasyon Hız Kontrolü (1x ➔ 2x ➔ 4x)
let currentSimSpeed = 1.0;
const simSpeedSteps = [1.0, 2.0, 4.0];

function cycleSimSpeed() {
  const currentIndex = simSpeedSteps.indexOf(currentSimSpeed);
  const nextIndex = (currentIndex + 1) % simSpeedSteps.length;
  currentSimSpeed = simSpeedSteps[nextIndex];

  if (cartSimulator) {
    cartSimulator.setSpeed(currentSimSpeed);
  }

  const hudSpeedText = document.getElementById('hud-speed-text');
  if (hudSpeedText) {
    hudSpeedText.textContent = `${currentSimSpeed}x`;
  }

  // Desktop kontrol panelindeki hız butonlarını da senkronize et
  document.querySelectorAll('#sim-controls-panel button[id^="sim-speed-"]').forEach(b => {
    b.className = 'px-2 py-1 rounded-lg text-slate-600 dark:text-slate-300 font-bold hover:text-slate-900 dark:hover:text-white';
  });
  const deskSpeedBtn = document.getElementById(`sim-speed-${currentSimSpeed}`);
  if (deskSpeedBtn) {
    deskSpeedBtn.className = 'px-2 py-1 rounded-lg bg-cyan-600 text-white font-bold';
  }

  showToast(`⚡ Simülasyon hızı: ${currentSimSpeed}x`, 'info');
}

// Mobil Bottom Sheet (Alt Çekmece) Durum Yöneticisi
let isBottomSheetExpanded = false;

function toggleBottomSheet() {
  if (isBottomSheetExpanded) {
    collapseBottomSheet();
  } else {
    expandBottomSheet();
  }
}

function expandBottomSheet() {
  const panel = document.getElementById('sidebar-panel');
  const toggleIcon = document.getElementById('floating-toggle-icon');
  const toggleText = document.getElementById('floating-toggle-text');
  const sheetToggleIcon = document.getElementById('sheet-toggle-icon');
  const sheetHint = document.getElementById('bottom-sheet-hint');

  if (!panel) return;
  panel.classList.add('is-expanded');
  isBottomSheetExpanded = true;

  if (toggleIcon) toggleIcon.textContent = '🗺️';
  if (toggleText) toggleText.textContent = 'Harita';
  if (sheetToggleIcon) sheetToggleIcon.style.transform = 'rotate(180deg)';
  if (sheetHint) sheetHint.textContent = 'Haritaya Dön';
}

function collapseBottomSheet() {
  const panel = document.getElementById('sidebar-panel');
  const toggleIcon = document.getElementById('floating-toggle-icon');
  const toggleText = document.getElementById('floating-toggle-text');
  const sheetToggleIcon = document.getElementById('sheet-toggle-icon');
  const sheetHint = document.getElementById('bottom-sheet-hint');

  if (!panel) return;
  panel.classList.remove('is-expanded');
  isBottomSheetExpanded = false;

  if (toggleIcon) toggleIcon.textContent = '📋';
  if (toggleText) toggleText.textContent = 'Liste';
  if (sheetToggleIcon) sheetToggleIcon.style.transform = 'rotate(0deg)';
  if (sheetHint) sheetHint.textContent = 'Mağazalar & Rota';
}

// Toast Notification Engine (Tekil Kuyruk & Yığılma Önleyici)
let activeToastTimeout = null;

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  // Mevcut zamanlayıcıyı ve DOM'daki eski bildirimleri derhal temizle
  if (activeToastTimeout) {
    clearTimeout(activeToastTimeout);
    activeToastTimeout = null;
  }
  container.innerHTML = '';

  const toast = document.createElement('div');
  const typeStyles = {
    info: 'border-cyan-500/40 bg-white/95 dark:bg-slate-900/90 text-cyan-700 dark:text-cyan-300',
    success: 'border-emerald-500/40 bg-white/95 dark:bg-slate-900/90 text-emerald-700 dark:text-emerald-300',
    warning: 'border-amber-500/40 bg-white/95 dark:bg-slate-900/90 text-amber-700 dark:text-amber-300',
    error: 'border-rose-500/40 bg-white/95 dark:bg-slate-900/90 text-rose-700 dark:text-rose-300'
  };

  const icons = {
    info: 'ℹ️',
    success: '✅',
    warning: '⚠️',
    error: '🚨'
  };

  toast.className = `flex items-center gap-2.5 px-4 py-3 rounded-2xl border shadow-xl backdrop-blur-md text-xs sm:text-sm font-semibold transition-all duration-300 transform translate-y-4 opacity-0 ${typeStyles[type] || typeStyles.info}`;
  toast.innerHTML = `
    <span class="shrink-0 text-base">${icons[type] || 'ℹ️'}</span>
    <span class="flex-1">${message}</span>
  `;

  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-4', 'opacity-0');
  });

  activeToastTimeout = setTimeout(() => {
    toast.classList.add('translate-y-4', 'opacity-0');
    setTimeout(() => {
      toast.remove();
      if (activeToastTimeout) activeToastTimeout = null;
    }, 300);
  }, 3200);
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
  window.mallMap = mallMap;
  window.navEngine = navEngine;

  // Kullanıcı haritayı kaydırdığında simülasyon serbest kameraya geçer
  mallMap.onUserPan = () => {
    if (cartSimulator && cartSimulator.isPlaying && cartSimulator.autoFollow) {
      cartSimulator.autoFollow = false;
      const recenterBtn = document.getElementById('btn-recenter-cart');
      if (recenterBtn) recenterBtn.classList.remove('hidden');
    }
  };

  cartSimulator = new CartSimulator(
    mallMap,
    (progress, stepIndex) => {
      const progressBar = document.getElementById('sim-progress-bar');
      const pct = Math.min(100, Math.max(0, progress <= 1 ? progress * 100 : progress));
      if (progressBar) {
        progressBar.style.width = `${pct}%`;
      }
      const hudPct = document.getElementById('hud-progress-pct');
      if (hudPct) {
        hudPct.textContent = `(%${Math.round(pct)})`;
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
  window.cartSimulator = cartSimulator;

  setupTheme();
  setupUIEventListeners();
  setupSearchEngine();
  setupAmenityPills();
  setupTabs();

  // Dikey geçiş tercihini varsayılan olarak 'escalator' (yürüyen merdiven) olarak sabitle
  setRoutePreference('escalator');

  updateFloorUI(currentFloor);
  renderSidebarStoreGrid();

  // Başlangıç ve hedef noktaları varsayılan olarak boştur (Google Maps standardı)
  selectedStartStore = null;
  selectedTargetStore = null;

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
    mallMap.zoomIn();
  });

  document.getElementById('zoom-out-btn')?.addEventListener('click', () => {
    mallMap.zoomOut();
  });

  document.getElementById('zoom-reset-btn')?.addEventListener('click', () => {
    mallMap.resetView();
  });

  // Kuzey Pusulası (Compass): Tıklandığında harita rotasyonunu yumuşakça 0 dereceye (Kuzey yukarı) sıfırlar
  document.getElementById('btn-compass')?.addEventListener('click', () => {
    mallMap.resetRotation();
  });

  // Simülasyonda Sepete Yeniden Odaklan (Recenter Cart)
  document.getElementById('btn-recenter-cart')?.addEventListener('click', () => {
    if (cartSimulator) {
      cartSimulator.recenter();
    }
  });

  // Rota Kontrolleri & Değiştirme (Swap) Butonları
  document.getElementById('btn-swap-locations')?.addEventListener('click', () => {
    swapLocations();
  });

  document.getElementById('route-swap-btn')?.addEventListener('click', () => {
    swapLocations();
  });

  document.getElementById('clear-route-btn')?.addEventListener('click', () => {
    clearCurrentRoute();
  });

  document.getElementById('btn-hud-finish')?.addEventListener('click', () => {
    clearCurrentRoute();
  });

  // Merdiven / Asansör Rota Tercih Sekmeleri
  document.getElementById('tab-pref-escalator')?.addEventListener('click', () => {
    setRoutePreference('escalator');
  });

  document.getElementById('tab-pref-elevator')?.addEventListener('click', () => {
    setRoutePreference('elevator');
  });

  document.getElementById('mode-escalator')?.addEventListener('click', () => {
    setRoutePreference('escalator');
  });

  document.getElementById('mode-elevator')?.addEventListener('click', () => {
    setRoutePreference('elevator');
  });

  // Minimal 64px HUD Adım Adım Detay Çekmecesi Kontrolleri
  document.getElementById('btn-hud-steps-toggle')?.addEventListener('click', () => {
    const drawer = document.getElementById('hud-steps-drawer');
    drawer?.classList.toggle('hidden');
  });

  document.getElementById('btn-hud-steps-close')?.addEventListener('click', () => {
    const drawer = document.getElementById('hud-steps-drawer');
    drawer?.classList.add('hidden');
    // Rota haritadan ASLA silinmez; yalnızca detay çekmecesi kapanır!
  });

  // Simülatör Olayları (Hem büyük panel hem de 64px HUD için senkron)
  document.getElementById('sim-play-btn')?.addEventListener('click', () => {
    toggleCartSimulation();
  });

  document.getElementById('btn-hud-sim-play')?.addEventListener('click', () => {
    toggleCartSimulation();
  });

  // Minimal HUD Simülasyon Hız Kontrolü (1x ➔ 2x ➔ 4x ➔ 1x)
  document.getElementById('btn-hud-speed')?.addEventListener('click', (e) => {
    e.stopPropagation();
    cycleSimSpeed();
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

  // Başlangıç Konumu Seçim Butonları
  document.getElementById('input-start-loc')?.addEventListener('click', () => {
    openEntranceModal();
  });

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
        setStartLocation(ent);
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

  // Dinamik POI Aksiyon Butonları (Delegasyon ile her render'da kesintisiz çalışır)
  const poiActionContainer = document.getElementById('poi-action-buttons');
  poiActionContainer?.addEventListener('click', (e) => {
    const startBtn = e.target.closest('#poi-start-btn, [data-action="start"]');
    const targetBtn = e.target.closest('#poi-route-btn, [data-action="target"]');
    const clearStartBtn = e.target.closest('[data-action="clear-start"]');

    if (startBtn && activePoiStore) {
      setStartLocation(activePoiStore);
    } else if (targetBtn && activePoiStore) {
      setTargetLocation(activePoiStore);
    } else if (clearStartBtn && activePoiStore) {
      selectedStartStore = null;
      updateStartBadgeUI('');
      mallMap.activeStartStore = null;
      mallMap.updateActiveStorePolygons();
      mallMap.renderBrandMarkers(mallMap.currentFloor);
      if (mallMap.activeRoute) clearCurrentRoute();
      renderPoiActionButtons(activePoiStore);
      showToast('Başlangıç noktası kaldırıldı.', 'info');
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

  // Mobil Bottom Sheet & Yüzen Buton (Floating View Toggle) Etkileşimleri
  const handleBar = document.getElementById('bottom-sheet-handle-bar');
  const btnSheetToggle = document.getElementById('btn-sheet-toggle');
  const floatingToggle = document.getElementById('floating-view-toggle');

  handleBar?.addEventListener('click', (e) => {
    if (e.target.closest('#btn-sheet-toggle')) return;
    toggleBottomSheet();
  });

  btnSheetToggle?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleBottomSheet();
  });

  floatingToggle?.addEventListener('click', () => {
    toggleBottomSheet();
  });

  // Tutamaç üzerinde dokunmatik yukarı/aşağı çekme (drag gesture)
  let sheetTouchStartY = 0;
  handleBar?.addEventListener('touchstart', (e) => {
    sheetTouchStartY = e.touches[0].clientY;
  }, { passive: true });

  handleBar?.addEventListener('touchend', (e) => {
    const sheetTouchEndY = e.changedTouches[0].clientY;
    const diff = sheetTouchEndY - sheetTouchStartY;
    if (diff < -28) {
      expandBottomSheet();
    } else if (diff > 28) {
      collapseBottomSheet();
    }
  }, { passive: true });

  // Haritaya tıklandığında açık olan alt çekmeceyi küçült
  const mapCanvas = document.getElementById('map-canvas-container');
  mapCanvas?.addEventListener('click', () => {
    if (window.innerWidth <= 768 && isBottomSheetExpanded) {
      collapseBottomSheet();
    }
  });
}

// 4. Çift Girdi Arama & Rota Motoru (Google Maps Standardı)
function setupSearchEngine() {
  const startInput = document.getElementById('input-start-loc');
  const clearStartBtn = document.getElementById('btn-clear-start');
  const targetInput = document.getElementById('input-target-loc');
  const clearTargetBtn = document.getElementById('btn-clear-target');

  let debounceTimer = null;

  // 1. [ 📍 Nereden? ] Girdisi
  startInput?.addEventListener('click', () => {
    openEntranceModal();
  });

  clearStartBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    selectedStartStore = null;
    if (startInput) startInput.value = '';
    clearStartBtn.classList.add('hidden');
    updateStartBadgeUI('');
    mallMap.activeStartStore = null;
    mallMap.updateActiveStorePolygons();
    if (mallMap.activeRoute) {
      clearCurrentRoute();
    }
  });

  // 2. [ 🎯 Nereye? ] Girdisi
  targetInput?.addEventListener('focus', () => {
    if (window.innerWidth <= 768 && !isBottomSheetExpanded) {
      expandBottomSheet();
    }
  });

  targetInput?.addEventListener('input', (e) => {
    if (window.innerWidth <= 768 && !isBottomSheetExpanded) {
      expandBottomSheet();
    }
    clearTimeout(debounceTimer);
    searchQuery = e.target.value.trim();

    if (searchQuery.length > 0) {
      clearTargetBtn?.classList.remove('hidden');
    } else {
      clearTargetBtn?.classList.add('hidden');
    }

    debounceTimer = setTimeout(() => {
      closePoiDetail();
      renderSidebarStoreGrid();
    }, 180);
  });

  clearTargetBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (targetInput) targetInput.value = '';
    searchQuery = '';
    clearTargetBtn.classList.add('hidden');
    selectedTargetStore = null;
    mallMap.activeTargetStore = null;
    mallMap.updateActiveStorePolygons();
    if (mallMap.activeRoute) {
      clearCurrentRoute();
    }
    closePoiDetail();
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
  // Arama yapılıyorsa kullanıcının aradığı mağaza tüm AVM genelinde bulunur
  if (searchQuery.trim().length > 0) {
    list = getAllStores();
  } else if (filterTab === 'this_floor') {
    list = mallData.floors[currentFloor]?.stores || [];
  } else {
    list = getAllStores();
  }

  // Kategori Filtresi
  if (activeCategory && activeCategory !== 'all') {
    list = list.filter(s => s.category === activeCategory);
  }

  // Arama Filtresi (Türkçe karakter duyarsız)
  if (searchQuery.trim()) {
    const q = normalizeTr(searchQuery);
    list = list.filter(s =>
      normalizeTr(s.name).includes(q) ||
      normalizeTr(s.category_name || '').includes(q) ||
      normalizeTr(s.floor_name || '').includes(q) ||
      normalizeTr(s.unit || '').includes(q)
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

// 8. Mağaza Seçimi & Konum Yönetimi (Google Maps Çift Girdi Mimarisi)
function setStartLocation(loc) {
  if (!loc) return;
  selectedStartStore = loc;

  updateStartBadgeUI(loc.name);
  mallMap.activeStartStore = selectedStartStore;

  // Eğer hedef daha önce aynı mağaza olarak seçilmişse hedefi sıfırla ki kullanıcı yeni hedef seçebilsin
  if (selectedTargetStore && selectedTargetStore.id === selectedStartStore.id) {
    selectedTargetStore = null;
    const targetInput = document.getElementById('input-target-loc');
    if (targetInput) targetInput.value = '';
    document.getElementById('btn-clear-target')?.classList.add('hidden');
    mallMap.activeTargetStore = null;
    if (mallMap.activeRoute) {
      clearCurrentRoute();
      selectedStartStore = loc;
      updateStartBadgeUI(loc.name);
      mallMap.activeStartStore = selectedStartStore;
    }
  }

  mallMap.updateActiveStorePolygons();
  mallMap.renderBrandMarkers(mallMap.currentFloor);

  // KESİN KURAL: Hedef zaten seçiliyse rota otomatik hesaplansın; değilse hedef seçimi beklensin
  if (selectedTargetStore && selectedTargetStore.id !== selectedStartStore.id) {
    calculateAndDisplayRoute();
  } else {
    showToast(`📍 Başlangıç: "${loc.name}". Lütfen hedef mağazanızı seçin.`, 'info');
    // Başlangıç katına ve koordinatına odaklan
    if (mallMap.currentFloor !== loc.floor) {
      mallMap.loadFloor(loc.floor).then(() => {
        updateFloorUI(loc.floor);
        mallMap.flyTo(loc.cx, loc.cy, 1.35);
      });
    } else {
      mallMap.flyTo(loc.cx, loc.cy, 1.35);
    }
  }

  if (activePoiStore) {
    renderPoiActionButtons(activePoiStore);
  }
}

function setTargetLocation(store) {
  if (!store) return;
  selectedTargetStore = store;

  const targetInput = document.getElementById('input-target-loc');
  if (targetInput) targetInput.value = store.name;
  const clearTargetBtn = document.getElementById('btn-clear-target');
  if (clearTargetBtn) clearTargetBtn.classList.remove('hidden');

  // Eğer başlangıç daha önce aynı mağaza olarak seçilmişse başlangıcı temizle
  if (selectedStartStore && selectedStartStore.id === selectedTargetStore.id) {
    selectedStartStore = null;
    updateStartBadgeUI('');
    mallMap.activeStartStore = null;
  }

  // Kartlardaki aktif sınıfı
  document.querySelectorAll('.store-card').forEach(c => {
    if (c.getAttribute('data-store-id') === store.id) {
      c.classList.add('is-active');
    } else {
      c.classList.remove('is-active');
    }
  });

  mallMap.activeTargetStore = selectedTargetStore;
  mallMap.updateActiveStorePolygons();
  mallMap.renderBrandMarkers(mallMap.currentFloor);

  // Farklı kattaysa kata geç ve mağazayı vurgula
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

  // KESİN KURAL: İki alan da seçilmeden ASLA otomatik rota çizilmez
  if (selectedStartStore && selectedStartStore.id !== selectedTargetStore.id) {
    calculateAndDisplayRoute();
  } else if (!selectedStartStore) {
    showToast(`🎯 Hedef: ${store.name}. Lütfen başlangıç noktanızı seçin (Giriş veya Mağaza).`, 'info');
  }

  if (activePoiStore) {
    renderPoiActionButtons(activePoiStore);
  }
}

function selectStore(store) {
  if (!store) return;

  // Farklı kattaysa kata geç ve mağazayı haritada vurgula
  mallMap.highlightStore(store.id, true);
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

  // POI Detay Panelini Aç ve Dinamik Butonları Göster
  renderPoiDetail(store);

  // Mobilde alt çekmeceyi açarak butonları görünür kıl
  if (window.innerWidth <= 768) {
    expandBottomSheet();
  }
}

function swapLocations() {
  const temp = selectedStartStore;
  selectedStartStore = selectedTargetStore;
  selectedTargetStore = temp;

  const startInput = document.getElementById('input-start-loc');
  const targetInput = document.getElementById('input-target-loc');
  const clearStartBtn = document.getElementById('btn-clear-start');
  const clearTargetBtn = document.getElementById('btn-clear-target');

  if (startInput) startInput.value = selectedStartStore ? selectedStartStore.name : '';
  if (targetInput) targetInput.value = selectedTargetStore ? selectedTargetStore.name : '';

  if (clearStartBtn) {
    if (selectedStartStore) clearStartBtn.classList.remove('hidden');
    else clearStartBtn.classList.add('hidden');
  }
  if (clearTargetBtn) {
    if (selectedTargetStore) clearTargetBtn.classList.remove('hidden');
    else clearTargetBtn.classList.add('hidden');
  }

  if (selectedStartStore) updateStartBadgeUI(selectedStartStore.name);
  else updateStartBadgeUI('');

  mallMap.activeStartStore = selectedStartStore;
  mallMap.activeTargetStore = selectedTargetStore;
  mallMap.updateActiveStorePolygons();

  if (selectedStartStore && selectedTargetStore && selectedStartStore.id !== selectedTargetStore.id) {
    calculateAndDisplayRoute();
  } else if (mallMap.activeRoute) {
    clearCurrentRoute();
  }
}

function setRoutePreference(mode) {
  activeRouteMode = mode;
  window.activeRouteMode = mode;
  const tabEscalator = document.getElementById('tab-pref-escalator');
  const tabElevator = document.getElementById('tab-pref-elevator');

  const activeStyle = 'flex-1 py-1.5 px-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all border border-red-600 bg-red-600 text-white shadow-xs';
  const inactiveStyle = 'flex-1 py-1.5 px-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700';

  if (mode === 'escalator') {
    if (tabEscalator) tabEscalator.className = activeStyle;
    if (tabElevator) tabElevator.className = inactiveStyle;
  } else {
    if (tabElevator) tabElevator.className = activeStyle;
    if (tabEscalator) tabEscalator.className = inactiveStyle;
  }

  const btnEsc = document.getElementById('mode-escalator');
  const btnEle = document.getElementById('mode-elevator');
  if (btnEsc && btnEle) {
    if (mode === 'escalator') {
      btnEsc.className = 'flex-1 py-1.5 px-2.5 rounded-xl border border-red-500 bg-red-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm';
      btnEle.className = 'flex-1 py-1.5 px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-all';
    } else {
      btnEle.className = 'flex-1 py-1.5 px-2.5 rounded-xl border border-red-500 bg-red-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm';
      btnEsc.className = 'flex-1 py-1.5 px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-all';
    }
  }

  if (selectedStartStore && selectedTargetStore && selectedStartStore.id !== selectedTargetStore.id) {
    calculateAndDisplayRoute();
  }
}

function toggleCartSimulation() {
  if (!cartSimulator.isPlaying) {
    cartSimulator.start();
    const playText = document.getElementById('sim-play-text');
    if (playText) playText.textContent = 'Duraklat';
    const hudSimText = document.getElementById('hud-sim-text');
    if (hudSimText) hudSimText.textContent = 'Duraklat';
    const hudSimIcon = document.getElementById('hud-sim-icon');
    if (hudSimIcon) hudSimIcon.setAttribute('data-lucide', 'pause');
  } else {
    cartSimulator.pause();
    const playText = document.getElementById('sim-play-text');
    if (playText) playText.textContent = 'Devam Et';
    const hudSimText = document.getElementById('hud-sim-text');
    if (hudSimText) hudSimText.textContent = 'Devam Et';
    const hudSimIcon = document.getElementById('hud-sim-icon');
    if (hudSimIcon) hudSimIcon.setAttribute('data-lucide', 'play');
  }
  if (window.lucide) lucide.createIcons();
}

function renderPoiDetail(store) {
  activePoiStore = store;
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

  // Dinamik Butonları Durum Yönetimine Göre Render Et
  renderPoiActionButtons(store);
}

function renderPoiActionButtons(store) {
  const container = document.getElementById('poi-action-buttons');
  if (!container || !store) return;

  const isStart = selectedStartStore && selectedStartStore.id === store.id;
  const isTarget = selectedTargetStore && selectedTargetStore.id === store.id;

  if (isStart) {
    container.innerHTML = `
      <div class="w-full py-2.5 px-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs">
        <i data-lucide="map-pin" class="w-4 h-4 text-emerald-500"></i>
        <span>Mevcut Başlangıç Noktanız</span>
      </div>
      <button data-action="clear-start" class="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 hover:text-red-500 text-slate-600 dark:text-slate-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-95">
        <i data-lucide="x" class="w-3.5 h-3.5"></i>
        <span>Başlangıcı Kaldır</span>
      </button>
    `;
  } else if (isTarget) {
    container.innerHTML = `
      <div class="w-full py-2.5 px-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-500/40 text-red-700 dark:text-red-300 text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs">
        <i data-lucide="navigation" class="w-4 h-4 text-red-500"></i>
        <span>Mevcut Hedef Mağazanız</span>
      </div>
      <button id="poi-start-btn" data-action="start" class="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-95">
        <i data-lucide="map-pin" class="w-3.5 h-3.5 text-emerald-500"></i>
        <span>📍 Burayı Başlangıç Yap</span>
      </button>
    `;
  } else if (!selectedStartStore) {
    // 1. Durum: [📍 Nereden?] boşsa ➔ [📍 Buradan Başla] (öncelikli) ve [🎯 Hedef Yap]
    container.innerHTML = `
      <button id="poi-start-btn" data-action="start" class="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-md shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all active:scale-95">
        <i data-lucide="map-pin" class="w-4 h-4"></i>
        <span>📍 Buradan Başla</span>
      </button>
      <button id="poi-route-btn" data-action="target" class="w-full py-2 px-4 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-95">
        <i data-lucide="navigation" class="w-3.5 h-3.5 text-red-500"></i>
        <span>🎯 Hedef Yap</span>
      </button>
    `;
  } else {
    // 2. Durum: [📍 Nereden?] doluysa ➔ [🎯 Hedef Yap] (öncelikli) ve [📍 Başlangıcı Değiştir]
    container.innerHTML = `
      <button id="poi-route-btn" data-action="target" class="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white text-xs font-bold shadow-md shadow-red-600/30 flex items-center justify-center gap-2 transition-all active:scale-95">
        <i data-lucide="navigation" class="w-4 h-4"></i>
        <span>🎯 Hedef Yap</span>
      </button>
      <button id="poi-start-btn" data-action="start" class="w-full py-2 px-4 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-95">
        <i data-lucide="map-pin" class="w-3.5 h-3.5 text-emerald-500"></i>
        <span>📍 Başlangıcı Değiştir</span>
      </button>
    `;
  }

  if (window.lucide) lucide.createIcons();
}

function closePoiDetail() {
  activePoiStore = null;
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
  if (selectedStartStore.id === selectedTargetStore.id) {
    showToast('Başlangıç ve hedef noktaları aynı olamaz.', 'warning');
    return;
  }

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

  // 1. Rota Kartını Doldur
  const routeCard = document.getElementById('route-info-card');
  routeCard?.classList.remove('hidden');

  const startLbl = document.getElementById('route-start-label');
  const targetLbl = document.getElementById('route-target-label');
  const routeFloors = document.getElementById('route-floors');
  const routeDistance = document.getElementById('route-distance');
  const routeTime = document.getElementById('route-time');

  if (startLbl) startLbl.textContent = selectedStartStore.name;
  if (targetLbl) targetLbl.textContent = selectedTargetStore.name;
  if (routeFloors) routeFloors.textContent = `${selectedStartStore.floor_name || selectedStartStore.floor + '. Kat'} → ${selectedTargetStore.floor_name || selectedTargetStore.floor + '. Kat'}`;
  if (routeDistance) routeDistance.textContent = `${result.totalDistance} m`;
  if (routeTime) routeTime.textContent = `~${result.estimatedMinutes} dk`;

  // 2. Minimal 64px HUD Navigasyon Çubuğunu Doldur ve Göster
  const hudBar = document.getElementById('nav-hud-bar');
  if (hudBar) {
    hudBar.classList.add('is-active');
    hudBar.classList.remove('translate-y-full', 'opacity-0', 'pointer-events-none');
  }

  const hudDist = document.getElementById('hud-distance');
  const hudTm = document.getElementById('hud-time');
  const hudRouteName = document.getElementById('hud-route-name');
  const hudSimText = document.getElementById('hud-sim-text');
  const hudSimIcon = document.getElementById('hud-sim-icon');

  if (hudDist) hudDist.textContent = `${result.totalDistance} m`;
  if (hudTm) hudTm.textContent = `~${result.estimatedMinutes} dk`;
  if (hudRouteName) hudRouteName.textContent = `${selectedStartStore.name} → ${selectedTargetStore.name}`;
  if (hudSimText) hudSimText.textContent = 'Simülasyonu Başlat';
  if (hudSimIcon) hudSimIcon.setAttribute('data-lucide', 'play');

  // Adım Adım Detay Listesi (Çekmece)
  const hudStepsList = document.getElementById('hud-steps-list');
  const hudStepsCount = document.getElementById('hud-steps-count');
  if (hudStepsCount) hudStepsCount.textContent = `${result.instructions?.length || 0} Adım`;
  if (hudStepsList && result.instructions) {
    hudStepsList.innerHTML = result.instructions.map(ins => `
      <div class="flex items-start gap-2 p-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
        <span class="w-5 h-5 rounded-full bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center font-bold text-[9px] shrink-0 mt-0.5">${ins.step}</span>
        <div>
          <div class="font-bold text-slate-800 dark:text-slate-200">${ins.text}</div>
          <div class="text-[10px] text-slate-400">${mallData.floors[ins.floor]?.label || ins.floor + '. Kat'}</div>
        </div>
      </div>
    `).join('');
  }

  // Adım Adım Talimatlar (Mevcut Rota Kartı İçin)
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

  // Mobilde Alt Çekmeceyi Otomatik Küçült ve Rota Modunu Aktif Et
  if (window.innerWidth <= 768) {
    collapseBottomSheet();
  }
  document.body.classList.add('has-active-route');

  // ROTA ÖNİZLEME (MANUEL BAŞLATMA):
  // Sepet başlangıç noktasına yerleştirilir ve durdurulur; ASLA otomatik başlatılmaz!
  cartSimulator.setRoute(result);
  cartSimulator.stop();
  resetSimControls();

  // Başlangıç Katına Odaklan ve Rotayı Kadrajla
  if (mallMap.currentFloor !== selectedStartStore.floor) {
    mallMap.loadFloor(selectedStartStore.floor).then(() => {
      updateFloorUI(selectedStartStore.floor);
      mallMap.fitRoute(result);
    });
  } else {
    mallMap.fitRoute(result);
  }

  if (window.lucide) lucide.createIcons();
  showToast(`Rota hazır (${result.totalDistance} m, ~${result.estimatedMinutes} dk). Başlat'a basarak simülasyonu başlatabilirsiniz.`, 'success');
}

function clearCurrentRoute() {
  selectedStartStore = null;
  selectedTargetStore = null;
  mallMap.clearRoute();
  cartSimulator.stop();
  document.body.classList.remove('has-active-route');

  // Minimal 64px HUD'ı Gizle
  const hudBar = document.getElementById('nav-hud-bar');
  if (hudBar) {
    hudBar.classList.remove('is-active');
    hudBar.classList.add('translate-y-full', 'opacity-0', 'pointer-events-none');
  }

  // Adım Adım Detay Çekmecesini Gizle
  const hudStepsDrawer = document.getElementById('hud-steps-drawer');
  if (hudStepsDrawer) {
    hudStepsDrawer.classList.add('hidden');
  }

  // Inputları ve temizleme butonlarını sıfırla
  const startInput = document.getElementById('input-start-loc');
  const targetInput = document.getElementById('input-target-loc');
  if (startInput) startInput.value = '';
  if (targetInput) targetInput.value = '';

  document.getElementById('btn-clear-start')?.classList.add('hidden');
  document.getElementById('btn-clear-target')?.classList.add('hidden');
  document.getElementById('route-info-card')?.classList.add('hidden');

  // Hızlı Başlangıç Çiplerini Sıfırla
  document.querySelectorAll('.quick-start-chip').forEach(b => {
    b.className = 'quick-start-chip px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-semibold flex items-center gap-1 shrink-0 transition-all border border-slate-200 dark:border-slate-700';
  });

  // Mağaza kartlarındaki aktif sınıfını kaldır
  document.querySelectorAll('.store-card').forEach(c => c.classList.remove('is-active'));

  document.getElementById('btn-recenter-cart')?.classList.add('hidden');
  if (cartSimulator) cartSimulator.autoFollow = true;

  currentSimSpeed = 1.0;
  if (cartSimulator) cartSimulator.setSpeed(1.0);
  const hudSpeedText = document.getElementById('hud-speed-text');
  if (hudSpeedText) hudSpeedText.textContent = '1x';
  if (activePoiStore) renderPoiActionButtons(activePoiStore);

  resetSimControls();
}

function resetSimControls() {
  document.getElementById('btn-recenter-cart')?.classList.add('hidden');
  if (cartSimulator) cartSimulator.autoFollow = true;
  const progressBar = document.getElementById('sim-progress-bar');
  if (progressBar) progressBar.style.width = '0%';
  const playText = document.getElementById('sim-play-text');
  if (playText) playText.textContent = 'Simülasyonu Başlat';
  const hudSimText = document.getElementById('hud-sim-text');
  if (hudSimText) hudSimText.textContent = 'Simülasyonu Başlat';
  const hudSimIcon = document.getElementById('hud-sim-icon');
  if (hudSimIcon) hudSimIcon.setAttribute('data-lucide', 'play');
  const hudPct = document.getElementById('hud-progress-pct');
  if (hudPct) hudPct.textContent = '(%0)';
  if (window.lucide) lucide.createIcons();
}

// 10. Başlangıç Konumu Rozetini ve Hızlı Butonları Güncelle
function updateStartBadgeUI(name) {
  const startInput = document.getElementById('input-start-loc');
  const clearStartBtn = document.getElementById('btn-clear-start');
  const badge = document.getElementById('start-badge-text');

  if (name) {
    if (startInput) startInput.value = name;
    if (clearStartBtn) clearStartBtn.classList.remove('hidden');
    if (badge) badge.textContent = name;

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
  } else {
    if (startInput) startInput.value = '';
    if (clearStartBtn) clearStartBtn.classList.add('hidden');
    if (badge) badge.textContent = '';
    document.querySelectorAll('.quick-start-chip').forEach(b => {
      b.className = 'quick-start-chip px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-semibold flex items-center gap-1 shrink-0 transition-all border border-slate-200 dark:border-slate-700';
    });
  }
}

// 11. Başlangıç Noktası Seçim Modalı (Tüm Girişler + Danışma + Havuz + 173 Mağaza)
function normalizeTr(str) {
  if (!str) return '';
  return str
    .replace(/İ/g, 'i')
    .replace(/I/g, 'ı')
    .replace(/Ğ/g, 'ğ')
    .replace(/Ü/g, 'ü')
    .replace(/Ş/g, 'ş')
    .replace(/Ö/g, 'ö')
    .replace(/Ç/g, 'ç')
    .toLowerCase()
    .trim();
}

function openEntranceModal() {
  const modal = document.getElementById('entrance-modal');
  if (!modal) return;

  const listContainer = document.getElementById('entrance-list');
  const searchInput = document.getElementById('entrance-modal-search');
  const clearBtn = document.getElementById('entrance-modal-clear');
  const countEl = document.getElementById('entrance-modal-count');

  if (!listContainer) return;

  const allStores = getAllStores();

  const startingLocations = [
    // 1. Giriş Kapıları
    ...(mallData.entrances || []).filter(e => e.id !== 'ent_danisma' && e.id !== 'ent_havuz').map(ent => ({
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
      nav_node: 'n_danisma',
      cx: 1085,
      cy: 425,
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
      nav_node: 'c_4_m_700',
      cx: 700.0,
      cy: 440.0,
      iconEmoji: '🌊',
      badge: 'Buluşma Noktası',
      badgeClass: 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
    },
    // 4. Tüm Mağazalar (173 Mağaza - Alfabetik Sıralı)
    ...allStores
      .filter(s => s.nav_node)
      .sort((a, b) => a.name.localeCompare(b.name, 'tr'))
      .map(store => ({
        id: store.id,
        name: store.name,
        floor: store.floor,
        floor_name: store.floor_name || (store.floor === 4 ? 'Zemin Kat' : store.floor + '. Kat'),
        nav_node: store.nav_node,
        cx: store.cx,
        cy: store.cy,
        category: store.category,
        category_name: store.category_name || store.category,
        unit: store.unit,
        isStore: true,
        storeObj: store,
        iconEmoji: '🛍️',
        badge: store.category_name || 'Mağaza',
        badgeClass: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
      }))
  ];

  function renderList(query = '') {
    const q = normalizeTr(query);
    const filtered = q
      ? startingLocations.filter(loc =>
          normalizeTr(loc.name).includes(q) ||
          normalizeTr(loc.floor_name).includes(q) ||
          normalizeTr(loc.badge).includes(q) ||
          normalizeTr(loc.category_name || '').includes(q) ||
          normalizeTr(loc.unit || '').includes(q)
        )
      : startingLocations;

    if (countEl) {
      if (q) {
        countEl.textContent = `${filtered.length} sonuç bulundu`;
        countEl.classList.remove('hidden');
      } else {
        countEl.classList.add('hidden');
      }
    }

    if (clearBtn) {
      if (q.length > 0) {
        clearBtn.classList.remove('hidden');
      } else {
        clearBtn.classList.add('hidden');
      }
    }

    if (!filtered.length) {
      listContainer.innerHTML = `
        <div class="text-center py-8 text-slate-400">
          <div class="text-3xl mb-1.5">🔍</div>
          <div class="text-xs font-bold text-slate-700 dark:text-slate-200">"${query}" için sonuç bulunamadı</div>
          <div class="text-[11px] text-slate-400 mt-1">Farklı bir mağaza adı veya kapı deneyebilirsiniz.</div>
        </div>
      `;
      return;
    }

    listContainer.innerHTML = filtered.map(loc => {
      const isSelected = selectedStartStore && (selectedStartStore.id === loc.id || selectedStartStore.name === loc.name);
      const iconHtml = loc.storeObj
        ? getStoreLogo(loc.storeObj, 24)
        : `<span class="text-lg leading-none">${loc.iconEmoji}</span>`;

      return `
        <div 
          class="flex items-center justify-between p-2.5 rounded-2xl border transition-all cursor-pointer ${
            isSelected 
              ? 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-500 shadow-sm' 
              : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200/80 dark:border-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-700/80'
          }" 
          data-loc-id="${loc.id}"
        >
          <div class="flex items-center gap-2.5 min-w-0 flex-1">
            <div class="w-8 h-8 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 flex items-center justify-center shrink-0 overflow-hidden p-1 shadow-xs">
              ${iconHtml}
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5 flex-wrap">
                <h4 class="text-xs font-bold text-slate-900 dark:text-white truncate">${loc.name}</h4>
                <span class="text-[9px] px-1.5 py-0.5 rounded-md font-bold ${loc.badgeClass}">${loc.badge}</span>
              </div>
              <p class="text-[10px] text-slate-400 mt-0.5">${loc.floor_name}${loc.unit ? ' • ' + loc.unit : ''}</p>
            </div>
          </div>
          <button class="ml-2 px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all ${
            isSelected 
              ? 'bg-emerald-600 text-white shadow-xs' 
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
          closeEntranceModal();
          const targetLoc = chosen.storeObj || chosen;
          setStartLocation(targetLoc);
        }
      });
    });
  }

  // Arama motoru event listener'ı (Tekil kayıt)
  if (searchInput && !searchInput.dataset.initialized) {
    searchInput.dataset.initialized = 'true';
    searchInput.addEventListener('input', (e) => {
      renderList(e.target.value);
    });
  }

  if (clearBtn && !clearBtn.dataset.initialized) {
    clearBtn.dataset.initialized = 'true';
    clearBtn.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      renderList('');
      searchInput?.focus();
    });
  }

  if (searchInput) {
    searchInput.value = '';
  }

  renderList('');
  modal.classList.remove('hidden');

  setTimeout(() => {
    searchInput?.focus();
  }, 80);
}

function closeEntranceModal() {
  document.getElementById('entrance-modal')?.classList.add('hidden');
}

window.openEntranceModal = openEntranceModal;
window.closeEntranceModal = closeEntranceModal;
