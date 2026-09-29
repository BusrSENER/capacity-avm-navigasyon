/**
 * İstanbul Bakırköy Capacity AVM - Ana Uygulama Kontrolcüsü (App State Manager)
 * UI Etkileşimleri, Arama, Kategori Filtreleme, Navigasyon & Kupon Yönetimi
 */

let mallData = null;
let mallMap = null;
let navEngine = null;
let cartSimulator = null;

let selectedStore = null;
let startStore = null;
let targetStore = null;
let activeRoute = null;
let navMode = 'escalator'; // 'escalator' | 'elevator' | 'both'

// Toast Notification Engine
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  const typeColors = {
    info: 'border-cyan-500/40 bg-slate-900/90 text-cyan-300',
    success: 'border-emerald-500/40 bg-slate-900/90 text-emerald-300',
    warning: 'border-amber-500/40 bg-slate-900/90 text-amber-300',
    error: 'border-rose-500/40 bg-slate-900/90 text-rose-300'
  };

  toast.className = `flex items-center gap-2.5 px-4 py-3 rounded-2xl border shadow-2xl backdrop-blur-md text-xs sm:text-sm font-semibold transition-all duration-300 transform translate-y-4 opacity-0 ${typeColors[type] || typeColors.info}`;
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
    if (!resp.ok) throw new Error('mall_data.json fetch failed');
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
    openStoreDetailModal(store);
  });

  cartSimulator = new CartSimulator(
    mallMap,
    (progress, currentNode) => {
      updateSimProgressBar(progress);
    },
    (newFloor) => {
      highlightActiveFloorBtn(newFloor);
    },
    () => {
      showToast('🎉 Hedefe ulaştınız! Keyifli alışverişler dileriz.', 'success');
      resetSimControls();
    }
  );

  setupUIEventListeners();
  setupSearchEngine();
  setupTheme();
  highlightActiveFloorBtn(mallMap.currentFloor);
}

function setupUIEventListeners() {
  // Kat Değiştirme Butonları
  const floorButtons = document.querySelectorAll('.floor-btn');
  floorButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const fl = parseInt(btn.getAttribute('data-floor'), 10);
      mallMap.loadFloor(fl);
      highlightActiveFloorBtn(fl);
    });
  });

  // Kategori Filtre Butonları
  const catPills = document.querySelectorAll('.cat-pill');
  catPills.forEach(pill => {
    pill.addEventListener('click', () => {
      catPills.forEach(p => p.classList.remove('active', 'bg-slate-900', 'text-white', 'dark:bg-white', 'dark:text-slate-900'));
      pill.classList.add('active', 'bg-slate-900', 'text-white', 'dark:bg-white', 'dark:text-slate-900');

      const cat = pill.getAttribute('data-category');
      mallMap.setCategoryFilter(cat);
      renderStoreSearchResults(filterStoresByCategory(cat));
    });
  });

  // Harita Görünüm Seçici (Öne Çıkanlar / Tümü)
  const displayModeToggle = document.getElementById('display-mode-select');
  if (displayModeToggle) {
    displayModeToggle.addEventListener('change', (e) => {
      mallMap.setDisplayMode(e.target.value);
    });
  }

  // Navigasyon Tercih Modu (Merdiven / Asansör)
  const modeRadios = document.querySelectorAll('input[name="nav-mode"]');
  modeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      navMode = e.target.value;
      if (startStore && targetStore) {
        calculateAndDisplayRoute();
      }
    });
  });

  // GPS / Giriş Seçim Butonu
  const gpsBtn = document.getElementById('gps-quick-btn');
  if (gpsBtn) {
    gpsBtn.addEventListener('click', () => {
      openEntranceModal();
    });
  }

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

  // Simülatör Oynat / Durdur Butonları
  document.getElementById('sim-play-btn')?.addEventListener('click', () => {
    if (!activeRoute) {
      showToast('Lütfen önce bir rota oluşturun.', 'warning');
      return;
    }
    if (cartSimulator.isPlaying) {
      cartSimulator.pause();
      document.getElementById('sim-play-icon').setAttribute('data-lucide', 'play');
    } else {
      cartSimulator.play();
      document.getElementById('sim-play-icon').setAttribute('data-lucide', 'pause');
    }
    if (window.lucide) lucide.createIcons();
  });

  document.getElementById('sim-stop-btn')?.addEventListener('click', () => {
    cartSimulator.stop();
    resetSimControls();
  });

  document.getElementById('sim-speed-select')?.addEventListener('change', (e) => {
    cartSimulator.setSpeed(e.target.value);
  });

  // Rota Temizle Butonu
  document.getElementById('clear-route-btn')?.addEventListener('click', () => {
    clearCurrentRoute();
  });

  // Modal Kapatma
  document.getElementById('store-modal-close')?.addEventListener('click', () => {
    closeStoreDetailModal();
  });
  document.getElementById('store-modal-backdrop')?.addEventListener('click', () => {
    closeStoreDetailModal();
  });
  document.getElementById('entrance-modal-close')?.addEventListener('click', () => {
    closeEntranceModal();
  });
}

function highlightActiveFloorBtn(floorNum) {
  const floorButtons = document.querySelectorAll('.floor-btn');
  floorButtons.forEach(btn => {
    const f = parseInt(btn.getAttribute('data-floor'), 10);
    if (f === floorNum) {
      btn.classList.add('bg-red-600', 'text-white', 'shadow-lg', 'scale-105');
      btn.classList.remove('bg-white', 'text-slate-700', 'dark:bg-slate-800', 'dark:text-slate-300');
    } else {
      btn.classList.remove('bg-red-600', 'text-white', 'shadow-lg', 'scale-105');
      btn.classList.add('bg-white', 'text-slate-700', 'dark:bg-slate-800', 'dark:text-slate-300');
    }
  });

  // Alt bilgi etiketini güncelle
  const floorTitle = document.getElementById('current-floor-title');
  const floorSub = document.getElementById('current-floor-sub');
  const flInfo = mallData?.floors[floorNum];
  if (floorTitle && flInfo) floorTitle.textContent = flInfo.label;
  if (floorSub && flInfo) floorSub.textContent = flInfo.subtitle;
}

// Arama & Otomatik Tamamlama
function setupSearchEngine() {
  const searchInput = document.getElementById('search-input');
  const clearBtn = document.getElementById('search-clear-btn');
  const searchResults = document.getElementById('search-results-list');

  let debounceTimer = null;

  searchInput?.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    const query = e.target.value.trim().toLowerCase();

    if (query.length > 0) {
      clearBtn?.classList.remove('hidden');
    } else {
      clearBtn?.classList.add('hidden');
      renderStoreSearchResults([]);
      return;
    }

    debounceTimer = setTimeout(() => {
      const allStores = getAllStoresList();
      const filtered = allStores.filter(s => 
        s.name.toLowerCase().includes(query) || 
        (s.category_name && s.category_name.toLowerCase().includes(query))
      );
      renderStoreSearchResults(filtered);
    }, 180);
  });

  clearBtn?.addEventListener('click', () => {
    searchInput.value = '';
    clearBtn.classList.add('hidden');
    renderStoreSearchResults([]);
  });
}

function getAllStoresList() {
  const list = [];
  if (!mallData) return list;
  for (let fl = 1; fl <= 6; fl++) {
    const fStores = mallData.floors[fl]?.stores || [];
    fStores.forEach(s => list.push(s));
  }
  return list;
}

function filterStoresByCategory(cat) {
  const all = getAllStoresList();
  if (cat === 'all') return all.slice(0, 30);
  return all.filter(s => s.category === cat);
}

function renderStoreSearchResults(stores) {
  const container = document.getElementById('search-results-list');
  if (!container) return;

  if (stores.length === 0) {
    container.innerHTML = `
      <div class="text-center py-8 text-slate-400">
        <i data-lucide="store" class="w-8 h-8 mx-auto mb-2 opacity-50"></i>
        <p class="text-xs">Aramanızla eşleşen mağaza bulunamadı.</p>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  container.innerHTML = stores.slice(0, 40).map(s => `
    <div class="store-list-item flex items-center justify-between p-2.5 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800/80 cursor-pointer transition-colors border border-transparent hover:border-slate-200/80 dark:hover:border-slate-700" data-store-id="${s.id}">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 shrink-0">
          ${getStoreLogo(s, 38)}
        </div>
        <div>
          <h4 class="text-xs font-bold text-slate-900 dark:text-white">${s.name}</h4>
          <p class="text-[11px] text-slate-400">${s.floor_name || s.floor + '. Kat'} &bull; ${s.category_name || s.category}</p>
        </div>
      </div>
      <button class="w-8 h-8 rounded-full bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-600 hover:text-white flex items-center justify-center transition-colors shadow-xs" title="Rotaya Ekle">
        <i data-lucide="navigation" class="w-3.5 h-3.5"></i>
      </button>
    </div>
  `).join('');

  if (window.lucide) lucide.createIcons();

  container.querySelectorAll('.store-list-item').forEach(item => {
    item.addEventListener('click', () => {
      const sId = item.getAttribute('data-store-id');
      const store = getAllStoresList().find(s => s.id === sId);
      if (store) {
        mallMap.loadFloor(store.floor).then(() => {
          highlightActiveFloorBtn(store.floor);
          mallMap.flyTo(store.cx, store.cy, 1.4);
          openStoreDetailModal(store);
        });
      }
    });
  });
}

// Mağaza Detay Modalı & Kupon
function openStoreDetailModal(store) {
  selectedStore = store;
  const modal = document.getElementById('store-detail-modal');
  if (!modal) return;

  document.getElementById('modal-store-name').textContent = store.name;
  document.getElementById('modal-store-floor').textContent = `${store.floor_name || store.floor + '. Kat'} ${store.unit ? '· No: ' + store.unit : ''}`;
  document.getElementById('modal-store-category').textContent = store.category_name || store.category;
  document.getElementById('modal-store-phone').textContent = store.phone || '0212 559 0000';
  document.getElementById('modal-store-logo').innerHTML = getStoreLogo(store, 56);

  // Kampanya / Kupon Gösterimi
  const campBox = document.getElementById('modal-campaign-box');
  if (store.campaign && store.campaign.active) {
    campBox.classList.remove('hidden');
    document.getElementById('modal-camp-title').textContent = store.campaign.title;
    document.getElementById('modal-camp-discount').textContent = store.campaign.discount;
    document.getElementById('modal-camp-code').textContent = store.campaign.code;
    document.getElementById('modal-camp-badge').textContent = store.campaign.badge;
  } else {
    campBox.classList.add('hidden');
  }

  // "Buraya Git" Butonu
  const routeToBtn = document.getElementById('modal-route-to-btn');
  routeToBtn.onclick = () => {
    setRouteTarget(store);
    closeStoreDetailModal();
  };

  // "Buradan Başla" Butonu
  const routeFromBtn = document.getElementById('modal-route-from-btn');
  routeFromBtn.onclick = () => {
    setRouteStart(store);
    closeStoreDetailModal();
  };

  modal.classList.remove('hidden');
}

function closeStoreDetailModal() {
  document.getElementById('store-detail-modal')?.classList.add('hidden');
}

// Kupon Kopyalama
window.copyStoreCoupon = function() {
  const code = document.getElementById('modal-camp-code')?.textContent;
  if (code) {
    navigator.clipboard.writeText(code).then(() => {
      showToast(`🎁 Kupon Kodu (${code}) kopyalandı! Kasada kullanabilirsiniz.`, 'success');
    });
  }
};

// Navigasyon Rota Hesaplama
function setRouteTarget(store) {
  targetStore = store;
  mallMap.activeTargetStore = store;
  document.getElementById('nav-target-name').textContent = store.name;

  if (!startStore) {
    // Varsayılan olarak Fişekhane Caddesi Ana Girişi'ni seç
    const defaultEntrance = mallData.entrances.find(e => e.id === 'entrance_east_main') || mallData.entrances[0];
    setRouteStart(defaultEntrance);
  } else {
    calculateAndDisplayRoute();
  }
}

function setRouteStart(store) {
  startStore = store;
  mallMap.activeStartStore = store;
  document.getElementById('nav-start-name').textContent = store.name;

  if (targetStore) {
    calculateAndDisplayRoute();
  }
}

function calculateAndDisplayRoute() {
  if (!startStore || !targetStore) return;

  const startNodeId = startStore.nav_node || startStore.doors?.[0];
  const targetNodeId = targetStore.nav_node || targetStore.doors?.[0];

  const result = navEngine.findRoute(startNodeId, targetNodeId, navMode);

  if (!result) {
    showToast('Bu iki nokta arasında uygun bir rota bulunamadı.', 'error');
    return;
  }

  activeRoute = result;
  mallMap.renderRoute(result);
  cartSimulator.setRoute(result);

  // Rota Panelini Doldur
  document.getElementById('nav-panel')?.classList.remove('hidden');
  document.getElementById('route-total-meters').textContent = `${result.totalDistance} m`;
  document.getElementById('route-est-time').textContent = `~${result.estimatedMinutes} dk`;

  if (result.fallbackUsed) {
    showToast('Seçilen modda yol bulunamadı, yürüyen merdiven ve asansör hibrit kullanıldı.', 'warning');
  } else {
    showToast(`✅ En hızlı rota oluşturuldu (${result.totalDistance} m, ~${result.estimatedMinutes} dk)`, 'success');
  }

  renderTurnInstructions(result.instructions);

  // Başlangıç katına odaklan
  if (mallMap.currentFloor !== startStore.floor) {
    mallMap.loadFloor(startStore.floor).then(() => {
      highlightActiveFloorBtn(startStore.floor);
      mallMap.flyTo(startStore.cx, startStore.cy, 1.25);
    });
  } else {
    mallMap.flyTo(startStore.cx, startStore.cy, 1.25);
  }
}

function renderTurnInstructions(instructions) {
  const container = document.getElementById('route-instructions-list');
  if (!container) return;

  container.innerHTML = instructions.map(ins => `
    <div class="flex items-start gap-3 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-xs">
      <div class="w-6 h-6 rounded-full bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0 mt-0.5 font-bold text-[10px]">
        ${ins.step}
      </div>
      <div class="flex-1">
        <p class="font-semibold text-slate-800 dark:text-slate-200">${ins.text}</p>
        <span class="text-[10px] text-slate-400">${mallData.floors[ins.floor]?.label || ins.floor + '. Kat'}</span>
      </div>
    </div>
  `).join('');
}

function clearCurrentRoute() {
  startStore = null;
  targetStore = null;
  activeRoute = null;
  mallMap.activeStartStore = null;
  mallMap.activeTargetStore = null;
  mallMap.clearRoute();
  cartSimulator.stop();

  document.getElementById('nav-start-name').textContent = 'Başlangıç Noktası Seçin';
  document.getElementById('nav-target-name').textContent = 'Hedef Noktası Seçin';
  document.getElementById('nav-panel')?.classList.add('hidden');
  resetSimControls();
}

// Simülatör İlerleme Çubuğu ve Kontroller
function updateSimProgressBar(pct) {
  const bar = document.getElementById('sim-progress-bar');
  if (bar) bar.style.width = `${Math.min(100, Math.max(0, pct))}%`;
}

function resetSimControls() {
  updateSimProgressBar(0);
  const icon = document.getElementById('sim-play-icon');
  if (icon) icon.setAttribute('data-lucide', 'play');
  if (window.lucide) lucide.createIcons();
}

// Giriş Noktası Seçim Modalı
function openEntranceModal() {
  const modal = document.getElementById('entrance-modal');
  if (!modal) return;

  const listContainer = document.getElementById('entrance-list');
  listContainer.innerHTML = (mallData.entrances || []).map(ent => `
    <div class="flex items-center justify-between p-3 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer transition-colors" data-ent-id="${ent.id}">
      <div class="flex items-center gap-3">
        <span class="text-xl">🚪</span>
        <div>
          <h4 class="text-xs font-bold text-slate-900 dark:text-white">${ent.name}</h4>
          <p class="text-[11px] text-slate-400">${ent.floor_name || ent.floor + '. Kat'}</p>
        </div>
      </div>
      <button class="px-3 py-1 rounded-full bg-red-600 text-white font-bold text-xs">Seç</button>
    </div>
  `).join('');

  listContainer.querySelectorAll('[data-ent-id]').forEach(el => {
    el.addEventListener('click', () => {
      const eid = el.getAttribute('data-ent-id');
      const entrance = mallData.entrances.find(e => e.id === eid);
      if (entrance) {
        setRouteStart(entrance);
        closeEntranceModal();
        showToast(`📍 Başlangıç noktası "${entrance.name}" olarak ayarlandı.`, 'info');
      }
    });
  });

  modal.classList.remove('hidden');
}

function closeEntranceModal() {
  document.getElementById('entrance-modal')?.classList.add('hidden');
}

// Gece / Gündüz Modu
function setupTheme() {
  const btn = document.getElementById('theme-toggle-btn');
  const icon = document.getElementById('theme-icon');

  const isDark = localStorage.getItem('capacity_theme') === 'dark' || 
    (!localStorage.getItem('capacity_theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);

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
      localStorage.setItem('capacity_theme', 'light');
      if (icon) icon.setAttribute('data-lucide', 'moon');
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('capacity_theme', 'dark');
      if (icon) icon.setAttribute('data-lucide', 'sun');
    }
    if (window.lucide) lucide.createIcons();
  });
}
