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
let currentPathPreference = 'wide'; // 'wide' (Geniş Yol) | 'short' (Kısa Yol)
window.currentPathPreference = currentPathPreference;

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

// Cihaz ve Ekran Durum Yardımcısı (Mobil Dikey & Mobil Yatay/Landscape)
function isMobileOrLandscape() {
  const isPortraitMobile = window.innerWidth < 768;
  const isLandscapeMobile = window.innerWidth <= 950 && (window.innerHeight < 550 || (window.matchMedia && window.matchMedia('(orientation: landscape)').matches));
  return isPortraitMobile || isLandscapeMobile;
}
window.isMobileOrLandscape = isMobileOrLandscape;

// Mobil Bottom Sheet (Alt Çekmece) ve Yatay Mod Çekmecesi Durum Yöneticisi
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
  const sheetSubhint = document.getElementById('bottom-sheet-subhint');

  if (!panel) return;
  panel.classList.add('is-expanded');
  document.body.classList.add('has-sheet-expanded');
  isBottomSheetExpanded = true;

  if (toggleIcon) toggleIcon.textContent = '🗺️';
  if (toggleText) toggleText.textContent = 'Harita';
  if (sheetToggleIcon) sheetToggleIcon.style.transform = 'rotate(180deg)';
  if (sheetHint) sheetHint.innerHTML = '<span>Mağazalar &amp; Rota</span>';
  if (sheetSubhint) sheetSubhint.textContent = 'Kapatmak için aşağı kaydırın';

  updateFloatingToggleVisibility();
}

function collapseBottomSheet() {
  const panel = document.getElementById('sidebar-panel');
  const toggleIcon = document.getElementById('floating-toggle-icon');
  const toggleText = document.getElementById('floating-toggle-text');
  const sheetToggleIcon = document.getElementById('sheet-toggle-icon');
  const sheetHint = document.getElementById('bottom-sheet-hint');
  const sheetSubhint = document.getElementById('bottom-sheet-subhint');
  const backdrop = document.getElementById('landscape-drawer-backdrop');

  if (!panel) return;
  panel.classList.remove('is-expanded', 'is-drawer-open');
  document.body.classList.remove('has-sheet-expanded');
  isBottomSheetExpanded = false;
  if (backdrop) backdrop.classList.add('hidden');

  if (toggleIcon) toggleIcon.textContent = '📋';
  if (toggleText) toggleText.textContent = 'Liste';
  if (sheetToggleIcon) sheetToggleIcon.style.transform = 'rotate(0deg)';
  if (sheetHint) sheetHint.innerHTML = '<span>Yeni Rota Çiz</span> <span class="text-[10px] font-semibold text-slate-400 dark:text-slate-500">&bull; Mağaza Ara</span>';
  if (sheetSubhint) sheetSubhint.textContent = 'Paneli açmak için dokunun';

  updateFloatingToggleVisibility();
}
window.expandBottomSheet = expandBottomSheet;
window.collapseBottomSheet = collapseBottomSheet;

// Mobil Yatay (Landscape) Çekmece (Drawer) Yöneticisi (Apple Haritalar Stili)
function openSidebarDrawer() {
  const panel = document.getElementById('sidebar-panel');
  const backdrop = document.getElementById('landscape-drawer-backdrop');
  if (!panel) return;
  panel.classList.add('is-expanded', 'is-drawer-open');
  document.body.classList.add('has-sheet-expanded');
  isBottomSheetExpanded = true;
  if (backdrop) backdrop.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function closeSidebarDrawer() {
  collapseBottomSheet();
}

function toggleSidebarDrawer() {
  const panel = document.getElementById('sidebar-panel');
  if (panel && (panel.classList.contains('is-drawer-open') || panel.classList.contains('is-expanded'))) {
    closeSidebarDrawer();
  } else {
    openSidebarDrawer();
  }
}

window.openSidebarDrawer = openSidebarDrawer;
window.closeSidebarDrawer = closeSidebarDrawer;
window.toggleSidebarDrawer = toggleSidebarDrawer;

// Masaüstü Sol Panel Daraltma / Tam Ekran Harita Yöneticisi (Desktop Collapse Sidebar)
function collapseDesktopSidebar() {
  if (window.innerWidth < 950) return;
  document.body.classList.add('sidebar-collapsed');

  // Haritayı hemen ve animasyon bitiminde (320ms) yeni genişliğe göre ortala
  if (window.mallMap && typeof window.mallMap.resetView === 'function') {
    window.mallMap.resetView();
  }
  setTimeout(() => {
    window.dispatchEvent(new Event('resize'));
    if (window.mallMap && typeof window.mallMap.resetView === 'function') {
      window.mallMap.resetView();
    }
  }, 320);

  if (window.lucide) lucide.createIcons();
}

function expandDesktopSidebar() {
  if (window.innerWidth < 950) return;
  document.body.classList.remove('sidebar-collapsed');

  // Haritayı hemen ve animasyon bitiminde (320ms) yeni genişliğe göre ortala
  if (window.mallMap && typeof window.mallMap.resetView === 'function') {
    window.mallMap.resetView();
  }
  setTimeout(() => {
    window.dispatchEvent(new Event('resize'));
    if (window.mallMap && typeof window.mallMap.resetView === 'function') {
      window.mallMap.resetView();
    }
  }, 320);

  if (window.lucide) lucide.createIcons();
}

function toggleDesktopSidebar() {
  if (window.innerWidth < 950) return;
  if (document.body.classList.contains('sidebar-collapsed')) {
    expandDesktopSidebar();
  } else {
    collapseDesktopSidebar();
  }
}

window.collapseDesktopSidebar = collapseDesktopSidebar;
window.expandDesktopSidebar = expandDesktopSidebar;
window.toggleDesktopSidebar = toggleDesktopSidebar;

window.addEventListener('resize', () => {
  if (window.innerWidth < 950 && document.body.classList.contains('sidebar-collapsed')) {
    document.body.classList.remove('sidebar-collapsed');
  }
});

// Toast Notification Engine (Tekil Kuyruk & Yığılma Önleyici)
let activeToastTimeout = null;

function hideToast() {
  if (activeToastTimeout) {
    clearTimeout(activeToastTimeout);
    activeToastTimeout = null;
  }
  const container = document.getElementById('toast-container');
  if (container) {
    container.innerHTML = '';
  }
}
window.hideToast = hideToast;

function showToast(message, type = 'info') {
  // QR modal açıkken arka planda hiçbir toast oluşturma / gösterme
  const qrModal = document.getElementById('route-qr-modal');
  if (qrModal && !qrModal.classList.contains('hidden')) return;
  if (document.body.classList.contains('has-qr-modal-open')) return;

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

// ==========================================
// DİL DESTEĞİ VE YERELLEŞTİRME (TR / EN)
// ==========================================
let currentLanguage = localStorage.getItem('capacity_language') || 'tr';
window.currentLanguage = currentLanguage;

const TRANSLATIONS = {
  tr: {
    startPlaceholder: '📍 Nereden? (Giriş / Mağaza)',
    targetPlaceholder: '🎯 Nereye? (Mağaza / Hizmet)',
    entranceLabel: 'Giriş:',
    danisma: 'ℹ️ Danışma',
    escalator: 'Yürüyen Merdiven',
    elevator: 'Asansör / Bebek',
    tabThisFloor: 'Bu katta · ',
    tabAllFloors: 'Tüm katlar',
    categories: {
      all: 'Tümü',
      fashion: 'Moda',
      shoes: 'Ayakkabı & Çanta',
      sports: 'Spor',
      tech: 'Teknoloji',
      cosmetics: 'Kozmetik',
      food: 'Yeme & İçme',
      home: 'Ev & Yaşam',
      entertainment: 'Eğlence',
      service: 'Hizmet'
    },
    amenities: {
      wc: 'Tuvalet',
      entrance: 'Giriş-Çıkış',
      info: 'Danışma',
      atm: 'ATM',
      carpark: 'Otopark',
      prayer: 'Mescit',
      baby: 'Bebek Odası'
    },
    parkingMemoryBtn: 'Otopark Konumu Kaydet',
    parkingModalTitle: 'Otopark Hafızası',
    parkingModalDesc: 'Park yerinizi kaydedin, dönüşte tek tıkla rotanızı çizin',
    parkingFloorLabel: 'Hangi Kat?',
    parkingZoneLabel: 'Hangi Bölge / Renk?',
    parkingPillarLabel: 'Direk No / Sütun / Not (İsteğe Bağlı):',
    parkingPillarPlaceholder: 'Örn: R08, S12, Voltrun şarj yanı...',
    parkingSaveBtn: 'Otopark Konumunu Kaydet',
    parkingSavedTitle: 'Kayıtlı Araç Konumu',
    parkingDeleteBtn: 'Konumu Sil',
    parkingNavigateBtn: 'Arabama Git (En Yakın Asansöre Yönlendir)',
    peekStartBtn: 'Buradayım (Başlangıç Yap)',
    peekTargetBtn: 'Hedef Yap',
    simStart: 'Simülasyonu Başlat',
    simPause: 'Duraklat',
    hudDetail: 'Detay',
    compass: 'Kuzey: Carousel • Doğu: Fişekhane Cad.'
  },
  en: {
    startPlaceholder: '📍 From where? (Entrance / Store)',
    targetPlaceholder: '🎯 To where? (Store / Service)',
    entranceLabel: 'Entrance:',
    danisma: 'ℹ️ Info Desk',
    escalator: 'Escalator',
    elevator: 'Elevator / Stroller',
    tabThisFloor: 'On this floor · ',
    tabAllFloors: 'All floors',
    categories: {
      all: 'All',
      fashion: 'Fashion',
      shoes: 'Shoes & Bags',
      sports: 'Sports',
      tech: 'Technology',
      cosmetics: 'Cosmetics',
      food: 'Food & Drink',
      home: 'Home & Living',
      entertainment: 'Entertainment',
      service: 'Services'
    },
    amenities: {
      wc: 'Restrooms',
      entrance: 'Entrances',
      info: 'Info Desk',
      atm: 'ATMs',
      carpark: 'Parking',
      prayer: 'Prayer Room',
      baby: 'Baby Care'
    },
    parkingMemoryBtn: 'Save Parking Spot',
    parkingModalTitle: 'Parking Memory',
    parkingModalDesc: 'Save your parking spot, route back with 1-click',
    parkingFloorLabel: 'Which Floor?',
    parkingZoneLabel: 'Which Zone / Color?',
    parkingPillarLabel: 'Pillar No / Column / Note (Optional):',
    parkingPillarPlaceholder: 'e.g. R08, S12, near EV charger...',
    parkingSaveBtn: 'Save Parking Spot',
    parkingSavedTitle: 'Saved Vehicle Location',
    parkingDeleteBtn: 'Delete Spot',
    parkingNavigateBtn: 'Go to My Car (Nearest Elevator)',
    peekStartBtn: 'I am here (Start Point)',
    peekTargetBtn: 'Set as Target',
    simStart: 'Start Simulation',
    simPause: 'Pause',
    hudDetail: 'Details',
    compass: 'North: Carousel • East: Fişekhane Ave.'
  }
};

function setLanguage(lang) {
  currentLanguage = (lang === 'en') ? 'en' : 'tr';
  try {
    localStorage.setItem('capacity_language', currentLanguage);
  } catch (e) {}
  window.currentLanguage = currentLanguage;

  const t = TRANSLATIONS[currentLanguage];

  // 1. Language Toggle Button labels
  const trLabel = document.getElementById('lang-tr-label');
  const enLabel = document.getElementById('lang-en-label');
  if (trLabel && enLabel) {
    if (currentLanguage === 'tr') {
      trLabel.className = 'text-slate-900 dark:text-white font-black';
      enLabel.className = 'text-slate-400 dark:text-slate-400 font-normal';
    } else {
      trLabel.className = 'text-slate-400 dark:text-slate-400 font-normal';
      enLabel.className = 'text-slate-900 dark:text-white font-black';
    }
  }

  // 2. Input Placeholders
  const startInput = document.getElementById('input-start-loc');
  const targetInput = document.getElementById('input-target-loc');
  if (startInput) startInput.placeholder = t.startPlaceholder;
  if (targetInput) targetInput.placeholder = t.targetPlaceholder;

  // 3. Escalator / Elevator
  const escBtn = document.getElementById('tab-pref-escalator');
  const eleBtn = document.getElementById('tab-pref-elevator');
  if (escBtn) {
    const span = escBtn.querySelectorAll('span')[1];
    if (span) span.textContent = t.escalator;
  }
  if (eleBtn) {
    const span = eleBtn.querySelectorAll('span')[1];
    if (span) span.textContent = t.elevator;
  }

  // 4. Quick start chips
  const quickDanisma = document.getElementById('btn-quick-danisma');
  if (quickDanisma) {
    const span = quickDanisma.querySelector('span');
    if (span) span.textContent = t.danisma;
  }
  const quickRow = document.getElementById('quick-start-chips-row');
  if (quickRow) {
    const labelSpan = quickRow.querySelector('span');
    if (labelSpan) labelSpan.textContent = t.entranceLabel;
  }

  // 5. Category Pills
  document.querySelectorAll('#category-pills-row .cat-pill').forEach(pill => {
    const cat = pill.getAttribute('data-category');
    if (cat && t.categories[cat]) {
      const dot = pill.querySelector('span');
      if (dot) {
        pill.innerHTML = '';
        pill.appendChild(dot);
        pill.appendChild(document.createTextNode(' ' + t.categories[cat]));
      } else {
        pill.textContent = t.categories[cat];
      }
    }
  });

  // 6. Amenity Pills
  document.querySelectorAll('#amenity-chips-row .amenity-pill').forEach(pill => {
    const amen = pill.getAttribute('data-amenity');
    if (amen && t.amenities[amen]) {
      const iconSpan = pill.querySelector('span');
      const iconText = iconSpan ? iconSpan.textContent : '';
      pill.innerHTML = `<span>${iconText}</span> ${t.amenities[amen]}`;
    }
  });

  // 7. Parking memory button
  const pBtnText = document.getElementById('parking-memory-btn-text');
  if (pBtnText) {
    pBtnText.textContent = t.parkingMemoryBtn;
  }

  // 8. Tabs (Bu katta / Tüm katlar)
  const tabAll = document.getElementById('tab-all-floors');
  if (tabAll) tabAll.textContent = t.tabAllFloors;

  // 9. Peek Card Buttons
  const peekStart = document.getElementById('btn-peek-start');
  const peekTarget = document.getElementById('btn-peek-target');
  if (peekStart) {
    const span = peekStart.querySelectorAll('span')[1];
    if (span) span.textContent = t.peekStartBtn;
  }
  if (peekTarget) {
    const span = peekTarget.querySelectorAll('span')[1];
    if (span) span.textContent = t.peekTargetBtn;
  }

  // 10. Compass
  const compass = document.querySelector('#map-cardinal-compass span');
  if (compass) compass.textContent = t.compass;

  // 11. Parking Modal texts
  const pModalTitle = document.querySelector('#parking-memory-modal h3');
  if (pModalTitle) pModalTitle.textContent = t.parkingModalTitle;
  const pModalDesc = document.querySelector('#parking-memory-modal p');
  if (pModalDesc) pModalDesc.textContent = t.parkingModalDesc;
  const pFloorLabels = document.querySelectorAll('#parking-form label');
  if (pFloorLabels.length >= 3) {
    pFloorLabels[0].textContent = t.parkingFloorLabel;
    pFloorLabels[1].textContent = t.parkingZoneLabel;
    pFloorLabels[2].textContent = t.parkingPillarLabel;
  }
  const pPillarInput = document.getElementById('parking-spot-pillar');
  if (pPillarInput) pPillarInput.placeholder = t.parkingPillarPlaceholder;
  const pSaveBtn = document.getElementById('btn-parking-save');
  if (pSaveBtn) {
    const span = pSaveBtn.querySelectorAll('span')[1];
    if (span) span.textContent = t.parkingSaveBtn;
  }
  const pNavBtn = document.getElementById('btn-parking-navigate-car');
  if (pNavBtn) {
    const span = pNavBtn.querySelectorAll('span')[1];
    if (span) span.textContent = t.parkingNavigateBtn;
  }
  const pDelBtn = document.getElementById('btn-parking-delete');
  if (pDelBtn) pDelBtn.innerHTML = `<i data-lucide="trash-2" class="w-3 h-3"></i> ${t.parkingDeleteBtn}`;

  // 12. Simulation play button
  const simPlayText = document.getElementById('sim-play-text');
  if (simPlayText) {
    const isRunning = cartSimulator && cartSimulator.isRunning;
    simPlayText.textContent = isRunning ? t.simPause : t.simStart;
  }

  if (window.lucide) lucide.createIcons();
}
window.setLanguage = setLanguage;

function toggleLanguage() {
  const nextLang = (currentLanguage === 'tr') ? 'en' : 'tr';
  setLanguage(nextLang);
}
window.toggleLanguage = toggleLanguage;

function setupLanguageToggle() {
  const btn = document.getElementById('lang-toggle-btn');
  btn?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleLanguage();
  });
  setLanguage(currentLanguage);
}
window.setupLanguageToggle = setupLanguageToggle;


// Açılış Ekranı (Splash Screen): Hızlı & Mizahi Şaşkın Çanta & nrdsor Logo (Toplam ~2150ms)
const splashStartTime = Date.now();
window.splashStartedAt = splashStartTime;
const MIN_SPLASH_DURATION = 2150; // ms (~2.15s hızlı kurgu sonrası fade-out başlar)
const SPLASH_FADE_OUT_MS = 350;   // ms (toplam sürede harita açılışı tamamlanır)

function hideSplashScreen() {
  const elapsed = Date.now() - splashStartTime;
  const remaining = Math.max(0, MIN_SPLASH_DURATION - elapsed);
  setTimeout(() => {
    const splash = document.getElementById('splash-screen');
    if (splash && !splash.classList.contains('pointer-events-none')) {
      splash.classList.add('opacity-0', 'pointer-events-none');
      setTimeout(() => {
        splash.remove();
        window.splashFinishedAt = Date.now();
      }, SPLASH_FADE_OUT_MS);
    }
  }, remaining);
}
window.hideSplashScreen = hideSplashScreen;

// Rota Koridor Tercihi ([🛣️ Geniş Yol] vs [✂️ Kısa Yol])
function setPathPreference(pref) {
  currentPathPreference = pref;
  window.currentPathPreference = pref;
  const chipWide = document.getElementById('chip-path-wide');
  const chipShort = document.getElementById('chip-path-short');

  const activeClasses = ['border-indigo-600', 'bg-indigo-600', 'text-white', 'shadow-xs'];
  const inactiveClasses = ['border-slate-200', 'dark:border-slate-700', 'bg-slate-100', 'dark:bg-slate-800', 'text-slate-700', 'dark:text-slate-300', 'hover:bg-slate-200', 'dark:hover:bg-slate-700'];

  if (pref === 'wide') {
    chipWide?.classList.remove(...inactiveClasses);
    chipWide?.classList.add(...activeClasses);
    chipShort?.classList.remove(...activeClasses);
    chipShort?.classList.add(...inactiveClasses);
  } else {
    chipShort?.classList.remove(...inactiveClasses);
    chipShort?.classList.add(...activeClasses);
    chipWide?.classList.remove(...activeClasses);
    chipWide?.classList.add(...inactiveClasses);
  }

  if (selectedStartStore && selectedTargetStore && selectedStartStore.id !== selectedTargetStore.id) {
    calculateAndDisplayRoute();
    showToast(pref === 'wide' ? '🛣️ Geniş yol rotası uygulandı' : '✂️ Kısa yol rotası uygulandı', 'info');
  }
}
window.setPathPreference = setPathPreference;

function setupPathPreferenceChips() {
  document.getElementById('chip-path-wide')?.addEventListener('click', (e) => {
    e.stopPropagation();
    setPathPreference('wide');
  });
  document.getElementById('chip-path-short')?.addEventListener('click', (e) => {
    e.stopPropagation();
    setPathPreference('short');
  });
}
window.setupPathPreferenceChips = setupPathPreferenceChips;

// Uygulamayı Başlat
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const resp = await fetch('public/mall_data.json');
    if (!resp.ok) throw new Error('mall_data.json fetch failed: ' + resp.status);
    mallData = await resp.json();
    window.mallData = mallData;
    window.getAllStores = getAllStores;

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
  mallMap.onMapClick = () => {
    closePoiPeekCard();
    if (isMobileOrLandscape() && isBottomSheetExpanded) {
      collapseBottomSheet();
    }
  };
  window.mallMap = mallMap;
  window.navEngine = navEngine;

  // Kullanıcı haritayı kaydırdığında / zoomladığında alt çekmece otomatik küçülür ve simülasyon serbest kameraya geçer
  mallMap.onUserPan = () => {
    if (isMobileOrLandscape() && isBottomSheetExpanded) {
      collapseBottomSheet();
    }
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
      // 1. Başarı Bildirimi Göster
      showToast('🎉 Hedefe ulaştınız! Keyifli alışverişler dileriz.', 'success');
      resetSimControls();

      // Az önce varılan hedef mağazayı sakla
      const reachedStore = selectedTargetStore;

      // A) Haritadaki kesik mavi/neon rota çizgisini (SVG path) 1 saniye içinde yumuşakça SİL (fade-out)
      const routeGroup = mallMap && mallMap.routeLayer;
      if (routeGroup) {
        routeGroup.style.transition = 'opacity 1s ease-out';
        routeGroup.style.opacity = '0';
        setTimeout(() => {
          if (mallMap) mallMap.clearRoute();
          if (mallMap && mallMap.routeLayer) {
            mallMap.routeLayer.style.transition = '';
            mallMap.routeLayer.style.opacity = '1';
          }
        }, 1000);
      } else if (mallMap) {
        mallMap.clearRoute();
      }

      // B) Hedefe varan "Alışveriş Torbası" ikonunu ekrandan kaldır (gizle)
      if (cartSimulator) {
        if (cartSimulator.cartEl) {
          cartSimulator.cartEl.classList.add('hidden');
        }
        cartSimulator.stop();
      }

      // C) UI panelindeki "Nereden" (Başlangıç) input'unu, az önce ulaşılan Hedef Mağaza olarak GÜNCELLE
      if (reachedStore) {
        selectedStartStore = reachedStore;
        if (mallMap) mallMap.activeStartStore = reachedStore;
        const startInput = document.getElementById('input-start-loc');
        if (startInput) startInput.value = reachedStore.name;
        document.getElementById('btn-clear-start')?.classList.remove('hidden');
        updateStartBadgeUI(reachedStore.name);
      }

      // D) UI panelindeki "Nereye" (Hedef) input'unu TEMİZLE (boşalt)
      selectedTargetStore = null;
      if (mallMap) mallMap.activeTargetStore = null;
      const targetInput = document.getElementById('input-target-loc');
      if (targetInput) targetInput.value = '';
      document.getElementById('btn-clear-target')?.classList.add('hidden');

      // Odak hedef kutusuna geçirilsin (kullanıcı bulunduğu noktadan yeni hedef arayabilir)
      setActiveFocusSlot('target');

      // Durum ve Harita Katmanlarını Güncelle
      lastCalculatedRoute = null;
      document.body.classList.remove('has-active-route');
      updateFloatingToggleVisibility();
      if (mallMap) {
        mallMap.updateActiveStorePolygons();
        mallMap.renderBrandMarkers(mallMap.currentFloor);
      }
      if (activePoiStore) renderPoiActionButtons(activePoiStore);
    }
  );
  window.cartSimulator = cartSimulator;

  // Yol Üstü Kampanya Sensörü & Rota Sıfırlama Kancaları
  cartSimulator.onProximityCheck = (x, y, floor) => {
    checkEnRouteCampaignProximity(x, y, floor);
  };
  cartSimulator.onRouteReset = () => {
    triggeredCampaignsThisRun.clear();
    dismissEnRouteCampaignToast();
  };

  setupTheme();
  setupUIEventListeners();
  setupPeekCardEvents();
  setupSearchEngine();
  setupAmenityPills();
  setupTabs();
  setupPathPreferenceChips();
  setupParkingMemoryEvents();
  setupLanguageToggle();
  setupCampaignEvents();
  updateParkingUI();

  // Dikey geçiş tercihini varsayılan olarak 'escalator' (yürüyen merdiven) olarak sabitle
  setRoutePreference('escalator');

  updateFloorUI(currentFloor);
  renderSidebarStoreGrid();

  // Başlangıç ve hedef noktaları varsayılan olarak boştur (Google Maps standardı)
  selectedStartStore = null;
  selectedTargetStore = null;

  // URL Parametreleri ve Kiosk Modu Denetimi (?kiosk=true & ?from=...&to=...)
  checkUrlParametersAndKiosk();

  if (window.lucide) {
    lucide.createIcons();
  }

  // Harita SVG ve JSON render edildiği anda açılış ekranını yapay gecikmesiz (0ms) kapat
  if (mallMap && mallMap.initialLoadPromise) {
    mallMap.initialLoadPromise.then(() => {
      hideSplashScreen();
      if (lastCalculatedRoute) {
        mallMap.fitRoute(lastCalculatedRoute);
      }
    }).catch(() => {
      hideSplashScreen();
    });
  } else {
    hideSplashScreen();
  }

  window.addEventListener('resize', () => {
    updateFloatingToggleVisibility();
    if (window.mallMap) {
      if (typeof window.mallMap.handleResize === 'function') window.mallMap.handleResize();
      else if (typeof window.mallMap.resetView === 'function') window.mallMap.resetView();
    }
  });
  window.addEventListener('orientationchange', () => {
    setTimeout(() => {
      updateFloatingToggleVisibility();
      if (window.mallMap) {
        if (typeof window.mallMap.handleResize === 'function') window.mallMap.handleResize();
        else if (typeof window.mallMap.resetView === 'function') window.mallMap.resetView();
      }
    }, 150);
  });
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

let lastCalculatedRoute = null;

// 1.1 Dinamik Üst Başlık (Header Card): Rota Özeti (1. Satır: Hedef • Kat, 2. Satır: Mesafe • Süre)
function updateHeaderNavSummary(targetStore, routeResult) {
  const titleEl = document.getElementById('current-floor-title');
  const subEl = document.getElementById('current-floor-sub');
  if (!titleEl || !subEl || !targetStore || !routeResult) return;
  const flInfo = mallData?.floors[targetStore.floor];
  const floorLabel = flInfo ? flInfo.label : (targetStore.floor + '. Kat');
  titleEl.textContent = `${targetStore.name} • ${floorLabel}`;
  subEl.textContent = `${routeResult.totalDistance} m • ~${routeResult.estimatedMinutes} dk`;
}
window.updateHeaderNavSummary = updateHeaderNavSummary;

// 2. Kat Değişimi & UI Güncellemesi
function updateFloorUI(floorNum) {
  currentFloor = floorNum;
  const flInfo = mallData?.floors[floorNum];

  // Başlık Kartı: Rota aktifse dinamik rota özetini koru, değilse varsayılan kat etiketini göster
  const titleEl = document.getElementById('current-floor-title');
  const subEl = document.getElementById('current-floor-sub');
  if (mallMap && mallMap.activeRoute && selectedTargetStore && lastCalculatedRoute) {
    updateHeaderNavSummary(selectedTargetStore, lastCalculatedRoute);
  } else {
    if (titleEl && flInfo) titleEl.textContent = flInfo.label;
    if (subEl && flInfo) subEl.textContent = flInfo.subtitle;
  }

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

      // Eğer seçilen kategoride bu katta mağaza yoksa, mağazaların bulunduğu kata otomatik geç (Örn: Spor -> B1 Katı)
      const currentFloorStores = (mallData?.floors[currentFloor]?.stores || []).filter(s => s.category === activeCategory);
      if (activeCategory !== 'all' && currentFloorStores.length === 0) {
        let bestFloor = null;
        let maxCount = 0;
        for (let fl = 1; fl <= 6; fl++) {
          const count = (mallData?.floors[fl]?.stores || []).filter(s => s.category === activeCategory).length;
          if (count > maxCount) {
            maxCount = count;
            bestFloor = fl;
          }
        }
        if (bestFloor) {
          mallMap.loadFloor(bestFloor).then(() => {
            updateFloorUI(bestFloor);
            mallMap.setCategoryFilter(activeCategory);
            renderSidebarStoreGrid();
          });
        } else {
          mallMap.setCategoryFilter(activeCategory);
          renderSidebarStoreGrid();
        }
      } else {
        mallMap.setCategoryFilter(activeCategory);
        renderSidebarStoreGrid();
      }

      // Mobilde kategori filtresine tıklandığında mağaza listesini göstermek için çekmeceyi genişlet
      if (window.innerWidth <= 768 && !isBottomSheetExpanded) {
        expandBottomSheet();
      }
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

  document.getElementById('btn-hud-swap')?.addEventListener('click', () => {
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
    if (window.isKioskMode) {
      showToast('Kiosk modundasınız. Başlangıç konumu Danışma / Kiosk olarak sabittir.', 'info');
      return;
    }
    openEntranceModal();
  });

  const startLocBtn = document.getElementById('start-location-btn') || document.getElementById('gps-quick-btn');
  startLocBtn?.addEventListener('click', () => {
    if (window.isKioskMode) {
      showToast('Kiosk modundasınız. Başlangıç konumu Danışma / Kiosk olarak sabittir.', 'info');
      return;
    }
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
      if (window.isKioskMode && entId !== 'ent_danisma') {
        showToast('Kiosk modunda başlangıç noktası Danışma / Kiosk olarak sabittir.', 'info');
        return;
      }
      const ent = mallData.entrances.find(e => e.id === entId);
      if (ent) {
        setStartLocation(ent);
      }
    });
  });

  // Rota kartı üzerindeki başlangıç etiketine tıklanırsa da başlangıç seçim modalını aç
  document.getElementById('route-start-label')?.addEventListener('click', () => {
    if (window.isKioskMode) {
      showToast('Kiosk modunda başlangıç noktası Danışma / Kiosk olarak sabittir.', 'info');
      return;
    }
    openEntranceModal();
  });

  document.getElementById('entrance-modal-close')?.addEventListener('click', () => {
    closeEntranceModal();
  });

  // Rotayı Cebine Al (QR Kod) Butonları & Modal Etkileşimleri
  document.getElementById('btn-route-qr')?.addEventListener('click', () => {
    openRouteQrModal();
  });

  document.getElementById('btn-hud-qr')?.addEventListener('click', () => {
    openRouteQrModal();
  });

  document.getElementById('btn-qr-modal-close')?.addEventListener('click', () => {
    closeRouteQrModal();
  });

  document.getElementById('btn-qr-copy-url')?.addEventListener('click', () => {
    const input = document.getElementById('qr-url-input');
    if (input && input.value) {
      navigator.clipboard.writeText(input.value).then(() => {
        showToast('📋 Rota bağlantısı kopyalandı!', 'success');
      }).catch(() => {
        input.select();
        document.execCommand('copy');
        showToast('📋 Rota bağlantısı kopyalandı!', 'success');
      });
    }
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

  // Haritaya veya dışarıya tıklandığında açık olan alt çekmeceyi küçült
  const mapCanvas = document.getElementById('map-canvas-container');
  mapCanvas?.addEventListener('click', () => {
    if (isMobileOrLandscape() && isBottomSheetExpanded) {
      collapseBottomSheet();
    }
  });
  document.addEventListener('click', (e) => {
    if (isMobileOrLandscape() && isBottomSheetExpanded) {
      const panel = document.getElementById('sidebar-panel');
      const floatingToggle = document.getElementById('btn-floating-drawer-toggle');
      if (panel && !panel.contains(e.target) && !floatingToggle?.contains(e.target)) {
        collapseBottomSheet();
      }
    }
  });

  // Apple Haritalar Tarzı Hamburger Drawer Butonu (#btn-sidebar-toggle), Kapatma Butonu ve Backdrop
  const btnSidebarToggle = document.getElementById('btn-sidebar-toggle');
  const btnSidebarClose = document.getElementById('btn-sidebar-close');
  const landscapeBackdrop = document.getElementById('landscape-drawer-backdrop');

  btnSidebarToggle?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (window.innerWidth >= 950) {
      expandDesktopSidebar();
    } else {
      openSidebarDrawer();
    }
  });

  btnSidebarClose?.addEventListener('click', (e) => {
    e.stopPropagation();
    closeSidebarDrawer();
  });

  landscapeBackdrop?.addEventListener('click', () => {
    closeSidebarDrawer();
  });

  // Masaüstü Sidebar Daraltma Butonları (Sağ kenar [<] butonu ve header butonu)
  const desktopCollapseBtns = document.querySelectorAll('.desktop-collapse-btn');
  desktopCollapseBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      collapseDesktopSidebar();
    });
  });
}

// 4. Çift Girdi Arama & Rota Motoru (Google Maps Standardı & Görsel Odak)
let activeFocusSlot = null; // 'start' | 'target' | null

function setActiveFocusSlot(slot) {
  activeFocusSlot = slot;
  window.activeFocusSlot = slot;

  const startInput = document.getElementById('input-start-loc');
  const targetInput = document.getElementById('input-target-loc');
  const activeClasses = ['active-focus-ring', 'ring-2', 'ring-indigo-500', 'border-indigo-500'];

  if (slot === 'start') {
    startInput?.classList.add(...activeClasses);
    targetInput?.classList.remove(...activeClasses);
  } else if (slot === 'target') {
    targetInput?.classList.add(...activeClasses);
    startInput?.classList.remove(...activeClasses);
  } else {
    startInput?.classList.remove(...activeClasses);
    targetInput?.classList.remove(...activeClasses);
  }
}
window.setActiveFocusSlot = setActiveFocusSlot;

function getAllMallStores() {
  const list = [];
  if (!mallData || !mallData.floors) return list;
  Object.values(mallData.floors).forEach(fl => {
    (fl.stores || []).forEach(s => list.push(s));
  });
  return list;
}

function normalizeSearchStr(str) {
  if (!str) return '';
  let s = str.trim();
  s = s.replace(/İ/g, 'i').replace(/I/g, 'ı').replace(/ı/g, 'i').toLowerCase();
  s = s.replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u');
  s = s.replace(/[\'\"&.,/\\()\-–—+!?:;]/g, ' ');
  return s.replace(/\s+/g, ' ').trim();
}

function handleStoreSelectedFromSearch(store, targetSlot) {
  if (!store) return;
  const slot = targetSlot || activeFocusSlot || 'target';

  // 1. Autocomplete listesini kapat
  const autoList = document.getElementById('search-autocomplete-list');
  if (autoList) {
    autoList.classList.add('hidden');
    autoList.innerHTML = '';
  }

  // 2. Girdileri ata
  if (slot === 'start') {
    setStartLocation(store);
  } else {
    setTargetLocation(store);
  }

  // 3. Arama katmanını kapat (mobilde alt çekmece genişletilmişse kapat)
  if (isMobileOrLandscape() && isBottomSheetExpanded) {
    collapseBottomSheet();
  }

  // 4. Farklı kattaysa kata geç (switchFloor) ve kamerayı mağazanın merkezine (cx, cy) kaydırıp zoomla
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

  // 5. Altta 130px'lik kompakt kartı (Peek Mode) aç (rota başlamadıysa)
  if (!mallMap.activeRoute) {
    showPoiPeekCard(store);
  }
}

function setupSearchEngine() {
  const startInput = document.getElementById('input-start-loc');
  const clearStartBtn = document.getElementById('btn-clear-start');
  const targetInput = document.getElementById('input-target-loc');
  const clearTargetBtn = document.getElementById('btn-clear-target');
  const autoList = document.getElementById('search-autocomplete-list');

  let debounceTimer = null;

  function renderAutocomplete(query, targetSlot) {
    if (!autoList) return;
    const q = normalizeSearchStr(query);
    if (!q || q.length === 0) {
      autoList.classList.add('hidden');
      autoList.innerHTML = '';
      return;
    }

    const allStores = getAllMallStores();
    const matches = allStores.filter(s => {
      const nameNorm = normalizeSearchStr(s.name);
      const catNorm = normalizeSearchStr(s.category_name || s.category || '');
      const floorNorm = normalizeSearchStr(s.floor_name || '');
      const unitNorm = (s.unit || '').toLowerCase();
      return nameNorm.includes(q) || catNorm.includes(q) || floorNorm.includes(q) || unitNorm.includes(q);
    });

    if (matches.length === 0) {
      autoList.innerHTML = `<div class="p-3 text-center text-xs text-slate-400">Sonuç bulunamadı ("${query}")</div>`;
      autoList.classList.remove('hidden');
      return;
    }

    autoList.innerHTML = matches.slice(0, 16).map(s => {
      const landmark = getStoreLandmark(s);
      const wing = landmark.includes('•') ? landmark.split('•')[1].trim() : (s.floor_name || '');
      return `
        <div class="search-autocomplete-item p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer flex items-center justify-between gap-2 transition-colors active:bg-slate-200 dark:active:bg-slate-700 select-none" data-store-id="${s.id}">
          <div class="flex items-center gap-2.5 min-w-0">
            <div class="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 p-1">
              ${getStoreLogo(s, 20)}
            </div>
            <div class="flex flex-col min-w-0">
              <span class="font-bold text-xs text-slate-800 dark:text-slate-100 truncate">${s.name}</span>
              <span class="text-[10px] text-slate-400 dark:text-slate-400 truncate">${s.category_name || s.category || 'Mağaza'}</span>
            </div>
          </div>
          <div class="flex flex-col items-end shrink-0 gap-0.5">
            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60">${s.floor_name || s.floor + '. Kat'}</span>
            <span class="text-[9px] font-medium text-slate-400 dark:text-slate-400">${wing}</span>
          </div>
        </div>
      `;
    }).join('');

    autoList.classList.remove('hidden');

    autoList.querySelectorAll('.search-autocomplete-item').forEach(itemEl => {
      itemEl.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const storeId = itemEl.getAttribute('data-store-id');
        const st = allStores.find(x => x.id === storeId);
        if (st) {
          handleStoreSelectedFromSearch(st, targetSlot);
        }
      });
    });
  }

  // 1. [ 📍 Nereden? ] Girdisi
  startInput?.addEventListener('focus', () => {
    if (window.isKioskMode) {
      targetInput?.focus();
      return;
    }
    if (window.innerWidth <= 768 && !isBottomSheetExpanded) {
      expandBottomSheet();
    }
    setActiveFocusSlot('start');
    if (startInput.value.trim().length > 0) {
      renderAutocomplete(startInput.value.trim(), 'start');
    }
  });

  startInput?.addEventListener('click', () => {
    if (window.isKioskMode) {
      showToast('Kiosk modundasınız. Başlangıç konumu Danışma / Kiosk olarak sabittir.', 'info');
      targetInput?.focus();
      return;
    }
    if (window.innerWidth <= 768 && !isBottomSheetExpanded) {
      expandBottomSheet();
    }
    setActiveFocusSlot('start');
    if (!startInput.value || startInput.value.trim().length === 0) {
      openEntranceModal();
    } else {
      renderAutocomplete(startInput.value.trim(), 'start');
    }
  });

  startInput?.addEventListener('input', (e) => {
    if (window.isKioskMode) {
      return;
    }
    if (window.innerWidth <= 768 && !isBottomSheetExpanded) {
      expandBottomSheet();
    }
    setActiveFocusSlot('start');
    const val = e.target.value.trim();
    if (val.length > 0) {
      clearStartBtn?.classList.remove('hidden');
    } else {
      clearStartBtn?.classList.add('hidden');
    }
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      renderAutocomplete(val, 'start');
    }, 120);
  });

  clearStartBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (window.isKioskMode) {
      showToast('Kiosk modunda başlangıç noktası sabittir.', 'info');
      return;
    }
    selectedStartStore = null;
    if (startInput) startInput.value = '';
    clearStartBtn.classList.add('hidden');
    updateStartBadgeUI('');
    mallMap.activeStartStore = null;
    mallMap.updateActiveStorePolygons();
    if (mallMap.activeRoute) {
      clearCurrentRoute();
    }
    autoList?.classList.add('hidden');
    setActiveFocusSlot('start');
    startInput?.focus();
  });

  // 2. [ 🎯 Nereye? ] Girdisi
  targetInput?.addEventListener('focus', () => {
    if (window.innerWidth <= 768 && !isBottomSheetExpanded) {
      expandBottomSheet();
    }
    setActiveFocusSlot('target');
    if (targetInput.value.trim().length > 0) {
      renderAutocomplete(targetInput.value.trim(), 'target');
    }
  });

  targetInput?.addEventListener('click', () => {
    if (window.innerWidth <= 768 && !isBottomSheetExpanded) {
      expandBottomSheet();
    }
    setActiveFocusSlot('target');
    if (targetInput.value.trim().length > 0) {
      renderAutocomplete(targetInput.value.trim(), 'target');
    }
  });

  targetInput?.addEventListener('input', (e) => {
    if (window.innerWidth <= 768 && !isBottomSheetExpanded) {
      expandBottomSheet();
    }
    setActiveFocusSlot('target');
    const val = e.target.value.trim();
    searchQuery = val;

    if (val.length > 0) {
      clearTargetBtn?.classList.remove('hidden');
    } else {
      clearTargetBtn?.classList.add('hidden');
    }

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      renderAutocomplete(val, 'target');
      // Arka plan listesini de güncelle
      closePoiDetail();
      renderSidebarStoreGrid();
    }, 120);
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
    autoList?.classList.add('hidden');
    closePoiDetail();
    renderSidebarStoreGrid();
    setActiveFocusSlot('target');
    targetInput?.focus();
  });

  // Dışarı tıklandığında açılır listeyi kapat
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#dual-search-container') && !e.target.closest('#search-autocomplete-list')) {
      autoList?.classList.add('hidden');
    }
  });
}

// 5. Hızlı İhtiyaç Çipleri (Amenities) & En Yakın Servis Noktası Bulma Algoritması
function findNearestAmenity(amenityKind, floor) {
  if (!mallData) return null;
  const currentFl = floor || currentFloor || 4;

  const allList = [];
  if (Array.isArray(mallData.amenities)) allList.push(...mallData.amenities);
  if (Array.isArray(mallData.entrances)) allList.push(...mallData.entrances);
  if (mallData.floors) {
    for (let fl = 1; fl <= 6; fl++) {
      const floorAms = mallData.floors[fl]?.amenities || [];
      allList.push(...floorAms);
    }
  }

  const seen = new Set();
  const deduped = [];
  for (const item of allList) {
    if (item && item.id && !seen.has(item.id)) {
      seen.add(item.id);
      deduped.push(item);
    }
  }

  const kind = (amenityKind || '').toLowerCase();
  const matches = deduped.filter(a => {
    const aType = (a.type || '').toLowerCase();
    const aKind = (a.kind || '').toLowerCase();
    const aName = (a.name || '').toLowerCase();

    if (kind === 'wc') {
      return aType === 'wc' || aKind === 'wc' || aName.includes('wc') || aName.includes('tuvalet') || aName.includes('lavabo');
    }
    if (kind === 'baby') {
      return aType === 'baby' || aKind === 'baby' || aName.includes('bebek');
    }
    if (kind === 'prayer') {
      return aType === 'prayer' || aKind === 'prayer' || aName.includes('mescit');
    }
    if (kind === 'atm') {
      return aType === 'atm' || aKind === 'atm' || aName.includes('atm') || aName.includes('bankamatik');
    }
    if (kind === 'info') {
      return aType === 'info' || aKind === 'info' || aName.includes('danışma') || aName.includes('danisma');
    }
    if (kind === 'entrance') {
      return aType === 'entrance' || aKind === 'entrance' || aName.includes('giriş') || aName.includes('giris');
    }
    if (kind === 'carpark') {
      return aType === 'carpark' || aKind === 'carpark' || aName.includes('otopark') || aName.includes('vale');
    }
    return aType === kind || aKind === kind || aName.includes(kind);
  });

  if (matches.length === 0) return null;

  // 1. Kullanıcının bulunduğu kattaki servis noktası
  const sameFloor = matches.find(m => m.floor === currentFl);
  if (sameFloor) return sameFloor;

  // 2. Kat farkı mutlak değeri en az olan en yakın kat
  matches.sort((a, b) => {
    const distA = Math.abs((a.floor || 4) - currentFl);
    const distB = Math.abs((b.floor || 4) - currentFl);
    return distA - distB;
  });

  return matches[0];
}
window.findNearestAmenity = findNearestAmenity;

function setupAmenityPills() {
  document.querySelectorAll('.amenity-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const amenityKind = pill.getAttribute('data-amenity');
      if (!amenityKind) return; // e.g. btn-parking-memory handles itself

      const targetAmenity = findNearestAmenity(amenityKind, currentFloor);
      if (targetAmenity) {
        setTargetLocation(targetAmenity);
        selectStore(targetAmenity);
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
    const filtered = list.filter(s => s.category === activeCategory);
    if (filtered.length === 0 && filterTab === 'this_floor') {
      // Eğer bu katta o kategoriden mağaza yoksa, kullanıcının boş liste görmemesi için tüm AVM'deki mağazaları göster
      list = getAllStores().filter(s => s.category === activeCategory);
    } else {
      list = filtered;
    }
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
    setActiveFocusSlot(null);
  } else {
    setActiveFocusSlot('target');
    // Bilgi kutusu kaldırıldı
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

  // Farklı kattaysa kata geç ve mağazayı vurgula (Yalnızca henüz başlangıç seçilmediyse!)
  if (!selectedStartStore) {
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
  }

  // POI Detay Paneli
  renderPoiDetail(store);

  // KESİN KURAL: İki alan da seçilmeden ASLA otomatik rota çizilmez
  if (selectedStartStore && selectedStartStore.id !== selectedTargetStore.id) {
    calculateAndDisplayRoute();
    setActiveFocusSlot(null);
  } else if (!selectedStartStore) {
    setActiveFocusSlot('start');
    // Bilgi kutusu kaldırıldı
  }

  if (activePoiStore) {
    renderPoiActionButtons(activePoiStore);
  }
}
window.setStartLocation = setStartLocation;
window.setTargetLocation = setTargetLocation;

function getStoreLandmark(store) {
  if (!store) return '';
  const floorName = store.floor_name || (store.floor ? `${store.floor}. Kat` : '');

  let zone = '';
  const cx = store.cx || 700;
  const cy = store.cy || 425;

  if (store.floor === 4) { // Zemin Kat
    if (Math.hypot(cx - 700, cy - 425) < 140) {
      zone = 'Müzikli Havuz Yanı';
    } else if (cx > 1050) {
      zone = 'Fişekhane Girişi Yanı';
    } else if (cy < 250) {
      zone = 'Carousel Girişi Yanı';
    } else if (cx < 550) {
      zone = 'Ataköy Kanadı';
    } else {
      zone = 'Merkez Atrium';
    }
  } else if (store.floor === 6) { // 2. Kat
    if (cy < 350 && cx < 600) {
      zone = 'Paribu Cineverse Yanı';
    } else if (cy > 450) {
      zone = 'Food Court & Teras';
    } else if (cx > 900) {
      zone = 'Teras Kanadı';
    } else {
      zone = 'Restoranlar Meydanı';
    }
  } else if (store.floor === 5) { // 1. Kat
    if (cx < 550) {
      zone = 'Ataköy Kanadı';
    } else if (cx > 900) {
      zone = 'Fişekhane Kanadı';
    } else {
      zone = 'Galeri Boşluğu Çevresi';
    }
  } else if (store.floor === 3) { // 1. Bodrum
    if (cx < 600) {
      zone = 'Spor & Gençlik Alanı';
    } else if (cx > 900) {
      zone = 'Migros & Hipermarket';
    } else {
      zone = 'Merkez Meydan';
    }
  } else if (store.floor === 1) { // 3. Bodrum
    zone = 'Lostra & Hizmet Alanı';
  } else if (store.floor === 2) { // 2. Bodrum
    zone = 'Otopark & Vale Noktası';
  } else {
    zone = cx < 700 ? 'Ataköy Kanadı' : 'Fişekhane Kanadı';
  }

  return `${floorName} • ${zone}`;
}
window.getStoreLandmark = getStoreLandmark;

let currentPeekStore = null;

function showPoiPeekCard(store) {
  if (!store) return;
  currentPeekStore = store;

  const peekCard = document.getElementById('poi-peek-card');
  if (!peekCard) return;

  const nameEl = document.getElementById('peek-store-name');
  const catEl = document.getElementById('peek-category-badge');
  const landmarkEl = document.getElementById('peek-landmark-text');
  const btnStart = document.getElementById('btn-peek-start');
  const btnTarget = document.getElementById('btn-peek-target');

  if (nameEl) nameEl.textContent = store.name;
  if (catEl) catEl.textContent = store.category_name || store.category || 'Mağaza';
  if (landmarkEl) landmarkEl.textContent = getStoreLandmark(store);

  // Buton Metinlerini & İkonlarını Kesinlikle Standardize Et (Mobilde taşmadan kusursuz görünür)
  if (btnStart) {
    btnStart.innerHTML = '<span>📍</span><span class="truncate font-bold"><span class="sm:hidden">Başlangıç Yap</span><span class="hidden sm:inline">Buradayım (Başlangıç Yap)</span></span>';
  }
  if (btnTarget) {
    btnTarget.innerHTML = '<span>🎯</span><span class="truncate font-bold">Hedef Yap</span>';
  }

  // Dinamik Buton Önceliği (Durum Makinesi):
  // Eğer activeFocusSlot === 'start' veya başlangıç noktası henüz seçilmemişse:
  // [📍 Buradayım (Başlangıç Yap)] birincil buton, [🎯 Hedef Yap] ikincil buton.
  // Aksi halde [🎯 Hedef Yap] birincil buton, [📍 Buradayım (Başlangıç Yap)] ikincil buton.
  const prioritizeStart = (activeFocusSlot === 'start') || (!selectedStartStore && activeFocusSlot !== 'target');

  if (btnStart && btnTarget) {
    if (prioritizeStart) {
      btnStart.className = 'py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-md bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30 cursor-pointer';
      btnTarget.className = 'py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 cursor-pointer';
    } else {
      btnTarget.className = 'py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-md bg-red-600 hover:bg-red-700 text-white shadow-red-600/30 cursor-pointer';
      btnStart.className = 'py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 cursor-pointer';
    }
  }

  // Mobilde alt çekmece genişletilmişse kapat
  if (isMobileOrLandscape() && isBottomSheetExpanded) {
    collapseBottomSheet();
  }

  document.body.classList.add('has-peek-card');
  peekCard.classList.remove('hidden');
  updateFloatingToggleVisibility();

  if (window.lucide) {
    lucide.createIcons();
  }
}
window.showPoiPeekCard = showPoiPeekCard;

function updateFloatingToggleVisibility() {
  const toggle = document.getElementById('floating-view-toggle');
  if (!toggle) return;
  const isRoute = document.body.classList.contains('has-active-route');
  const isPeek = document.body.classList.contains('has-peek-card');
  const isExpanded = document.body.classList.contains('has-sheet-expanded');
  if (isRoute || isPeek || isExpanded) {
    toggle.classList.add('hidden');
  } else {
    toggle.classList.remove('hidden');
  }
}
window.updateFloatingToggleVisibility = updateFloatingToggleVisibility;

function closePoiPeekCard() {
  document.body.classList.remove('has-peek-card');
  const peekCard = document.getElementById('poi-peek-card');
  if (peekCard) {
    peekCard.classList.add('hidden');
  }
  if (currentPeekStore) {
    if (mallMap) mallMap.setSelectedStore(null);
    currentPeekStore = null;
  }
  updateFloatingToggleVisibility();
}
window.closePoiPeekCard = closePoiPeekCard;

function setupPeekCardEvents() {
  document.getElementById('btn-peek-start')?.addEventListener('click', () => {
    if (currentPeekStore) {
      const store = currentPeekStore;
      setStartLocation(store);
      closePoiPeekCard();
    }
  });

  document.getElementById('btn-peek-target')?.addEventListener('click', () => {
    if (currentPeekStore) {
      const store = currentPeekStore;
      setTargetLocation(store);
      closePoiPeekCard();
    }
  });

  document.getElementById('btn-peek-close')?.addEventListener('click', () => {
    closePoiPeekCard();
  });
}
window.setupPeekCardEvents = setupPeekCardEvents;

function selectStore(store) {
  if (!store) return;

  // Haritada seçili mağazayı ve kalıcı seçim vurgusunu (highlight / active stroke) ayarla
  mallMap.setSelectedStore(store);

  // Farklı kattaysa kata geç ve mağazaya odaklan
  if (mallMap.currentFloor !== store.floor) {
    mallMap.loadFloor(store.floor).then(() => {
      updateFloorUI(store.floor);
      mallMap.flyTo(store.cx, store.cy, 1.45);
      mallMap.setSelectedStore(store);
    });
  } else {
    mallMap.flyTo(store.cx, store.cy, 1.45);
    mallMap.setSelectedStore(store);
  }

  // POI Detay Panelini Güncelle (Masaüstü genişliğinde #sidebar-poi-detail görünür kılınır)
  renderPoiDetail(store);

  // Mobilde veya yatay modda sol çekmece / alt çekmece açıksa haritayı rahat görebilmek için kapat
  if (isMobileOrLandscape() && isBottomSheetExpanded) {
    collapseBottomSheet();
  }

  // Ekranın altında kompakt etkileşimli pinleme kartı (Peek Mode) gösterilir:
  if (!mallMap.activeRoute) {
    showPoiPeekCard(store);
  }
}

function swapLocations() {
  if (window.isKioskMode) {
    showToast('Kiosk modundasınız. Başlangıç konumu Danışma / Kiosk olarak sabittir.', 'info');
    return;
  }
  const startInput = document.getElementById('input-start-loc');
  const targetInput = document.getElementById('input-target-loc');
  const clearStartBtn = document.getElementById('btn-clear-start');
  const clearTargetBtn = document.getElementById('btn-clear-target');

  // 1. Durum: Her iki nokta da doluyken [⇅] basılırsa
  if (selectedStartStore && selectedTargetStore) {
    // Simülasyon çalışıyorsa derhal durdur (cancelAnimationFrame)
    if (cartSimulator) {
      cartSimulator.stop();
    }

    // Başlangıç ve hedef düğümlerini takas et
    const temp = selectedStartStore;
    selectedStartStore = selectedTargetStore;
    selectedTargetStore = temp;

    if (startInput) startInput.value = selectedStartStore.name;
    if (targetInput) targetInput.value = selectedTargetStore.name;
    clearStartBtn?.classList.remove('hidden');
    clearTargetBtn?.classList.remove('hidden');
    updateStartBadgeUI(selectedStartStore.name);

    mallMap.activeStartStore = selectedStartStore;
    mallMap.activeTargetStore = selectedTargetStore;
    mallMap.updateActiveStorePolygons();
    mallMap.renderBrandMarkers(mallMap.currentFloor);

    // Rotayı ters yönde yeniden hesaplayıp önizleme moduna al
    calculateAndDisplayRoute();
    setActiveFocusSlot(null);

    showToast(`⇄ Rota tersine çevrildi: ${selectedStartStore.name} → ${selectedTargetStore.name}`, 'info');
  }
  // 2. Durum: Yalnızca [📍 Nereden?] doluyken [⇅] basılırsa
  else if (selectedStartStore && !selectedTargetStore) {
    if (cartSimulator) cartSimulator.stop();

    selectedTargetStore = selectedStartStore;
    selectedStartStore = null;

    if (startInput) startInput.value = '';
    if (targetInput) targetInput.value = selectedTargetStore.name;
    clearStartBtn?.classList.add('hidden');
    clearTargetBtn?.classList.remove('hidden');
    updateStartBadgeUI('');

    mallMap.activeStartStore = null;
    mallMap.activeTargetStore = selectedTargetStore;
    mallMap.updateActiveStorePolygons();
    mallMap.renderBrandMarkers(mallMap.currentFloor);

    if (mallMap.activeRoute) {
      mallMap.clearRoute();
      lastCalculatedRoute = null;
      document.body.classList.remove('has-active-route');
      updateFloatingToggleVisibility();
      updateFloorUI(mallMap.currentFloor || currentFloor);
      const hudBar = document.getElementById('nav-hud-bar');
      if (hudBar) {
        hudBar.classList.remove('is-active');
        hudBar.classList.add('translate-y-full', 'opacity-0', 'pointer-events-none');
      }
    }

    // Dolu kutudaki değer hedefe aktarıldı, eski kutu temizlendi ve odak boşalan kutuya (Nereden?) geçirildi
    setActiveFocusSlot('start');
    startInput?.focus();

    // Bilgi kutusu kaldırıldı
  }
  // 3. Durum: Yalnızca [🎯 Nereye?] doluyken [⇅] basılırsa
  else if (!selectedStartStore && selectedTargetStore) {
    if (cartSimulator) cartSimulator.stop();

    selectedStartStore = selectedTargetStore;
    selectedTargetStore = null;

    if (startInput) startInput.value = selectedStartStore.name;
    if (targetInput) targetInput.value = '';
    clearStartBtn?.classList.remove('hidden');
    clearTargetBtn?.classList.add('hidden');
    updateStartBadgeUI(selectedStartStore.name);

    mallMap.activeStartStore = selectedStartStore;
    mallMap.activeTargetStore = null;
    mallMap.updateActiveStorePolygons();
    mallMap.renderBrandMarkers(mallMap.currentFloor);

    if (mallMap.activeRoute) {
      mallMap.clearRoute();
      lastCalculatedRoute = null;
      document.body.classList.remove('has-active-route');
      updateFloatingToggleVisibility();
      updateFloorUI(mallMap.currentFloor || currentFloor);
      const hudBar = document.getElementById('nav-hud-bar');
      if (hudBar) {
        hudBar.classList.remove('is-active');
        hudBar.classList.add('translate-y-full', 'opacity-0', 'pointer-events-none');
      }
    }

    // Dolu kutudaki değer başlangıca aktarıldı, eski kutu temizlendi ve odak boşalan kutuya (Nereye?) geçirildi
    setActiveFocusSlot('target');
    targetInput?.focus();

    // Bilgi kutusu kaldırıldı
  }
  // 4. Durum: İkisi de boşken [⇅] basılırsa
  else {
    setActiveFocusSlot('start');
    startInput?.focus();
    showToast('Lütfen önce bir başlangıç veya hedef konumu seçin.', 'info');
  }

  if (activePoiStore) {
    renderPoiActionButtons(activePoiStore);
  }
}
window.swapLocations = swapLocations;

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
    if (isMobileOrLandscape() && isBottomSheetExpanded) {
      collapseBottomSheet();
    }
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
    if (playText) playText.textContent = 'Başlat';
    const hudSimText = document.getElementById('hud-sim-text');
    if (hudSimText) hudSimText.textContent = 'Başlat';
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
  } else if (!selectedStartStore || activeFocusSlot === 'start') {
    // 1. Durum: [📍 Nereden?] boşsa veya odak [📍 Nereden?] üzerindeyse ➔ [📍 Buradan Başla] (öncelikli) ve [🎯 Hedef Yap]
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
    // 2. Durum: [📍 Nereden?] doluysa ve odak hedefteyse ➔ [🎯 Hedef Yap] (öncelikli) ve [📍 Başlangıcı Değiştir]
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

  if (mallMap) {
    mallMap.setSelectedStore(null);
  }
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
    activeRouteMode,
    currentPathPreference
  );

  if (!result || !result.pathNodes || !result.pathNodes.length) {
    showToast('Bu iki nokta arasında uygun yol bulunamadı.', 'error');
    return;
  }
  result.path = result.pathNodes;

  // 1. Dinamik Üst Başlık Kartı: 1. Satır: Hedef • Kat, 2. Satır: Mesafe • Süre
  lastCalculatedRoute = result;
  updateHeaderNavSummary(selectedTargetStore, result);

  // Koridor Tercih Çiplerini [🛣️ Geniş Yol] ve [✂️ Kısa Yol] Göster
  const pathChips = document.getElementById('route-path-chips');
  if (pathChips) {
    pathChips.classList.remove('hidden');
  }

  // 2. Minimal 64px HUD Navigasyon Çubuğunu Göster
  const hudBar = document.getElementById('nav-hud-bar');
  if (hudBar) {
    hudBar.classList.add('is-active');
    hudBar.classList.remove('translate-y-full', 'opacity-0', 'pointer-events-none');
  }

  const hudSimText = document.getElementById('hud-sim-text');
  const hudSimIcon = document.getElementById('hud-sim-icon');
  if (hudSimText) hudSimText.textContent = 'Başlat';
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

  // Haritada Rota Çiz
  mallMap.activeStartStore = selectedStartStore;
  mallMap.activeTargetStore = selectedTargetStore;
  mallMap.renderRoute(result);
  mallMap.updateActiveStorePolygons();

  // Mobilde Alt Çekmeceyi Otomatik Küçült ve Rota Modunu Aktif Et
  if (isMobileOrLandscape()) {
    collapseBottomSheet();
  }
  document.body.classList.add('has-active-route');
  updateFloatingToggleVisibility();
  closePoiPeekCard(); // Rota başlayınca peek card gizlenir, tekil 64px HUD kalır

  // ROTA ÖNİZLEME (MANUEL BAŞLATMA):
  // Sepet başlangıç noktasına yerleştirilir ve durdurulur; ASLA otomatik başlatılmaz!
  cartSimulator.setRoute(result);
  cartSimulator.resetToStart();
  resetSimControls();

  // Başlangıç Katına Odaklan ve Rotayı Kadrajla
  updateFloorUI(selectedStartStore.floor);
  if (mallMap.currentFloor !== selectedStartStore.floor) {
    mallMap.loadFloor(selectedStartStore.floor).then(() => {
      mallMap.fitRoute(result);
    });
  } else {
    mallMap.fitRoute(result);
  }

  if (window.lucide) lucide.createIcons();
  showToast(`Rota hazır (${result.totalDistance} m, ~${result.estimatedMinutes} dk). Başlat'a basarak simülasyonu başlatabilirsiniz.`, 'success');
}

function clearCurrentRoute() {
  if (window.isKioskMode) {
    selectedTargetStore = null;
    lastCalculatedRoute = null;
    mallMap.clearRoute();
    cartSimulator.stop();
    document.body.classList.remove('has-active-route');
    updateFloatingToggleVisibility();
    updateFloorUI(mallMap.currentFloor || currentFloor);

    const hudBar = document.getElementById('nav-hud-bar');
    if (hudBar) {
      hudBar.classList.remove('is-active');
      hudBar.classList.add('translate-y-full', 'opacity-0', 'pointer-events-none');
    }
    const hudStepsDrawer = document.getElementById('hud-steps-drawer');
    if (hudStepsDrawer) {
      hudStepsDrawer.classList.add('hidden');
    }
    document.getElementById('route-path-chips')?.classList.add('hidden');

    const targetInput = document.getElementById('input-target-loc');
    if (targetInput) targetInput.value = '';
    document.getElementById('btn-clear-target')?.classList.add('hidden');

    document.querySelectorAll('.store-card').forEach(c => c.classList.remove('is-active'));
    document.getElementById('btn-recenter-cart')?.classList.add('hidden');
    if (cartSimulator) cartSimulator.autoFollow = true;

    currentSimSpeed = 1.0;
    if (cartSimulator) cartSimulator.setSpeed(1.0);
    const hudSpeedText = document.getElementById('hud-speed-text');
    if (hudSpeedText) hudSpeedText.textContent = '1x';
    if (activePoiStore) renderPoiActionButtons(activePoiStore);

    resetSimControls();
    setActiveFocusSlot('target');

    const danismaEnt = mallData.entrances.find(e => e.id === 'ent_danisma') || {
      id: 'ent_danisma',
      name: '📍 Zemin Kat - Danışma / Kiosk',
      short_name: 'Danışma / Kiosk',
      floor: 4,
      floor_name: 'Zemin Kat',
      cx: 1085.0,
      cy: 425.0,
      nav_node: 'n_danisma'
    };
    selectedStartStore = { ...danismaEnt, name: '📍 Zemin Kat - Danışma / Kiosk' };
    mallMap.activeStartStore = selectedStartStore;
    mallMap.activeTargetStore = null;
    mallMap.updateActiveStorePolygons();
    return;
  }

  selectedStartStore = null;
  selectedTargetStore = null;
  lastCalculatedRoute = null;
  mallMap.clearRoute();
  cartSimulator.stop();
  document.body.classList.remove('has-active-route');
  updateFloatingToggleVisibility();

  // Header Kartını Varsayılan Kat Görünümüne Sıfırla
  updateFloorUI(mallMap.currentFloor || currentFloor);

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

  // Koridor Tercih Çiplerini Gizle
  document.getElementById('route-path-chips')?.classList.add('hidden');

  // Inputları ve temizleme butonlarını sıfırla
  const startInput = document.getElementById('input-start-loc');
  const targetInput = document.getElementById('input-target-loc');
  if (startInput) startInput.value = '';
  if (targetInput) targetInput.value = '';

  document.getElementById('btn-clear-start')?.classList.add('hidden');
  document.getElementById('btn-clear-target')?.classList.add('hidden');

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
  setActiveFocusSlot(null);
}
window.clearCurrentRoute = clearCurrentRoute;

function resetSimControls() {
  document.getElementById('btn-recenter-cart')?.classList.add('hidden');
  if (cartSimulator) cartSimulator.autoFollow = true;
  const progressBar = document.getElementById('sim-progress-bar');
  if (progressBar) progressBar.style.width = '0%';
  const playText = document.getElementById('sim-play-text');
  if (playText) playText.textContent = 'Simülasyonu Başlat';
  const hudSimText = document.getElementById('hud-sim-text');
  if (hudSimText) hudSimText.textContent = 'Başlat';
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
  if (window.isKioskMode) {
    showToast('Kiosk modundasınız. Başlangıç konumu Danışma / Kiosk olarak sabittir.', 'info');
    return;
  }
  const modal = document.getElementById('entrance-modal');
  if (!modal) return;
  setActiveFocusSlot('start');

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

// 12. URL Parametreleri (?from=...&to=...) ve Kiosk Modu (?kiosk=true)
function checkUrlParametersAndKiosk() {
  const urlParams = new URLSearchParams(window.location.search);
  const isKiosk = urlParams.get('kiosk') === 'true';
  window.isKioskMode = isKiosk;

  const danismaEnt = (mallData && mallData.entrances) ? mallData.entrances.find(e => e.id === 'ent_danisma') : null;
  const kioskLocationObj = danismaEnt ? {
    ...danismaEnt,
    name: '📍 Zemin Kat - Danışma / Kiosk',
    short_name: 'Danışma / Kiosk'
  } : {
    id: 'ent_danisma',
    name: '📍 Zemin Kat - Danışma / Kiosk',
    short_name: 'Danışma / Kiosk',
    floor: 4,
    floor_name: 'Zemin Kat',
    cx: 1085.0,
    cy: 425.0,
    nav_node: 'n_danisma'
  };

  if (isKiosk) {
    selectedStartStore = kioskLocationObj;
    updateStartBadgeUI(kioskLocationObj.name);
    if (mallMap) mallMap.activeStartStore = kioskLocationObj;

    const startInput = document.getElementById('input-start-loc');
    if (startInput) {
      startInput.value = kioskLocationObj.name;
      startInput.readOnly = true;
      startInput.classList.add('bg-slate-100', 'dark:bg-slate-800', 'cursor-not-allowed');
      startInput.title = 'Kiosk Modu: Başlangıç konumu Danışma / Kiosk olarak kilitlidir';
    }
    const clearStartBtn = document.getElementById('btn-clear-start');
    if (clearStartBtn) {
      clearStartBtn.style.display = 'none';
    }
    const danismaChip = document.getElementById('btn-quick-danisma');
    if (danismaChip) {
      danismaChip.classList.add('ring-2', 'ring-cyan-500', 'font-black');
    }
    const kioskBrandBadge = document.getElementById('kiosk-brand-badge');
    if (kioskBrandBadge) {
      kioskBrandBadge.classList.remove('hidden');
      kioskBrandBadge.classList.add('flex');
    }
    const kioskSidebarBanner = document.getElementById('kiosk-sidebar-banner');
    if (kioskSidebarBanner) {
      kioskSidebarBanner.classList.remove('hidden');
      kioskSidebarBanner.classList.add('flex');
    }
    showToast('🖥️ nrdsor Kiosk Modu Aktif: Başlangıç noktası Danışma olarak sabitlendi.', 'info');
  }

  const fromParam = urlParams.get('from');
  const toParam = urlParams.get('to');

  let resolvedFrom = null;
  if (fromParam) {
    if (fromParam === 'kiosk' || fromParam === 'danisma' || fromParam === 'ent_danisma') {
      resolvedFrom = kioskLocationObj;
    } else if (fromParam.startsWith('ent_')) {
      resolvedFrom = mallData.entrances?.find(e => e.id === fromParam);
    } else {
      resolvedFrom = getAllStores().find(s => s.id === fromParam || normalizeTr(s.name) === normalizeTr(fromParam));
    }
  } else if (isKiosk) {
    resolvedFrom = kioskLocationObj;
  }

  let resolvedTo = null;
  if (toParam) {
    resolvedTo = getAllStores().find(s => s.id === toParam || normalizeTr(s.name) === normalizeTr(toParam));
    if (!resolvedTo && mallData.entrances) {
      resolvedTo = mallData.entrances.find(e => e.id === toParam);
    }
  }

  if (resolvedFrom && !isKiosk) {
    setStartLocation(resolvedFrom);
  } else if (isKiosk && resolvedFrom) {
    setStartLocation(kioskLocationObj);
  }

  if (resolvedTo) {
    setTargetLocation(resolvedTo);
  }
}

// 13. Rotayı Cebine Al (QR Kod) Modalı
function openRouteQrModal() {
  const modal = document.getElementById('route-qr-modal');
  if (!modal) return;

  if (!selectedTargetStore) {
    showToast('Lütfen önce bir hedef seçip rota oluşturun.', 'warning');
    return;
  }

  // QR Modalı açıldığında arka plandaki tüm toast bildirimlerini anında temizle ve gizle
  hideToast();
  document.body.classList.add('has-qr-modal-open');

  const fromStoreName = selectedStartStore ? selectedStartStore.name : 'Zemin Kat - Danışma / Kiosk';
  const toStoreName = selectedTargetStore.name;
  const fromId = (selectedStartStore && selectedStartStore.id !== 'ent_danisma') ? selectedStartStore.id : 'kiosk';
  const toId = selectedTargetStore.id;

  const origin = window.location.origin;
  const pathname = window.location.pathname;
  const shareUrl = `${origin}${pathname}?from=${encodeURIComponent(fromId)}&to=${encodeURIComponent(toId)}`;

  const fromEl = document.getElementById('qr-modal-from');
  const toEl = document.getElementById('qr-modal-to');
  const distEl = document.getElementById('qr-modal-distance');
  const timeEl = document.getElementById('qr-modal-time');
  const urlInput = document.getElementById('qr-url-input');
  const qrContainer = document.getElementById('qr-code-container');

  if (fromEl) fromEl.textContent = fromStoreName;
  if (toEl) toEl.textContent = toStoreName;
  if (distEl && lastCalculatedRoute) distEl.textContent = `${lastCalculatedRoute.totalDistance} m`;
  if (timeEl && lastCalculatedRoute) timeEl.textContent = `~${lastCalculatedRoute.estimatedMinutes} dk`;
  if (urlInput) urlInput.value = shareUrl;

  if (qrContainer) {
    if (window.generateQRCodeSvg) {
      qrContainer.innerHTML = window.generateQRCodeSvg(shareUrl, 200);
    } else {
      qrContainer.innerHTML = '<div class="text-xs text-slate-400">QR kod üretilemedi</div>';
    }
  }

  modal.classList.remove('hidden');
}

function closeRouteQrModal() {
  document.getElementById('route-qr-modal')?.classList.add('hidden');
  document.body.classList.remove('has-qr-modal-open');
}

window.openEntranceModal = openEntranceModal;
window.closeEntranceModal = closeEntranceModal;
window.checkUrlParametersAndKiosk = checkUrlParametersAndKiosk;
window.openRouteQrModal = openRouteQrModal;
window.closeRouteQrModal = closeRouteQrModal;

// ========================================================
// OTOPARK HAFIZASI VE YÖNLENDİRME SİSTEMİ (PARKING MEMORY)
// ========================================================
let selectedParkingFloor = { floor: 2, code: 'P2', name: 'P2 (2. Bodrum Kat)' };
let selectedParkingZone = { name: 'Mavi', color: '#2563eb' };

function getSavedParkingSpot() {
  try {
    const raw = localStorage.getItem('capacity_parking_spot');
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function updateParkingUI() {
  const saved = getSavedParkingSpot();
  const btnText = document.getElementById('parking-memory-btn-text');
  const headerBtn = document.getElementById('btn-header-find-car');
  const headerText = document.getElementById('header-car-spot-text');
  const savedCard = document.getElementById('parking-saved-card');
  const parkingForm = document.getElementById('parking-form');

  if (saved) {
    const label = `${saved.code} ${saved.zone}`;
    if (btnText) btnText.textContent = `Arabama Git (${label})`;
    if (headerText) headerText.textContent = `Arabama Git (${label})`;
    if (headerBtn) headerBtn.classList.remove('hidden');

    if (savedCard) {
      savedCard.classList.remove('hidden');
      const badge = document.getElementById('parking-saved-zone-badge');
      const title = document.getElementById('parking-saved-location-title');
      const pillar = document.getElementById('parking-saved-pillar-text');
      const time = document.getElementById('parking-saved-time-text');

      if (badge) {
        badge.textContent = saved.code || 'P2';
        badge.style.backgroundColor = saved.zoneColor || '#2563eb';
      }
      if (title) title.textContent = `${saved.name || saved.code + ' Katı'} • ${saved.zone} Bölge`;
      if (pillar) pillar.textContent = saved.pillar ? `Direk / Not: ${saved.pillar}` : 'Genel Otopark Alanı';
      if (time) time.textContent = saved.time ? `Kaydedildi: ${saved.time}` : 'Kayıtlı';
    }
    if (parkingForm) parkingForm.classList.add('hidden');
  } else {
    if (btnText) btnText.textContent = 'Otopark Konumu Kaydet';
    if (headerBtn) headerBtn.classList.add('hidden');
    if (savedCard) savedCard.classList.add('hidden');
    if (parkingForm) parkingForm.classList.remove('hidden');
  }
}

function openParkingMemoryModal() {
  const modal = document.getElementById('parking-memory-modal');
  if (!modal) return;
  updateParkingUI();
  modal.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function closeParkingMemoryModal() {
  document.getElementById('parking-memory-modal')?.classList.add('hidden');
}

function saveParkingSpot() {
  const pillarInput = document.getElementById('parking-spot-pillar');
  const pillar = pillarInput ? pillarInput.value.trim() : '';

  const spot = {
    floor: selectedParkingFloor.floor,
    code: selectedParkingFloor.code,
    name: selectedParkingFloor.name,
    zone: selectedParkingZone.name,
    zoneColor: selectedParkingZone.color,
    pillar: pillar,
    time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
  };

  try {
    localStorage.setItem('capacity_parking_spot', JSON.stringify(spot));
  } catch (e) {
    console.error('LocalStorage write error', e);
  }

  showToast(`🚗 Otopark konumu kaydedildi: ${spot.code} ${spot.zone} Bölge`, 'success');
  updateParkingUI();
  closeParkingMemoryModal();
}

function deleteParkingSpot() {
  try {
    localStorage.removeItem('capacity_parking_spot');
  } catch (e) {}
  showToast('Otopark konumu silindi.', 'info');
  updateParkingUI();
}

function navigateToSavedCar() {
  const saved = getSavedParkingSpot();
  if (!saved) {
    openParkingMemoryModal();
    return;
  }

  closeParkingMemoryModal();

  const currentFl = mallMap ? mallMap.currentFloor : 4;
  const elevatorNodeId = `c_${currentFl}_m_565`;

  let startStoreObj = null;

  if (selectedStartStore && selectedStartStore.floor === currentFl) {
    startStoreObj = selectedStartStore;
  } else {
    if (currentFl === 4) {
      startStoreObj = { id: 'danisma', name: 'Zemin Kat Danışma', floor: 4, cx: 1085, cy: 425, nav_node: 'n_danisma' };
    } else {
      const floorStores = getAllStores().filter(s => s.floor === currentFl);
      startStoreObj = floorStores.length > 0 ? floorStores[0] : { id: 'door_0', name: 'Kat Girişi', floor: currentFl, cx: 600, cy: 400, nav_node: `c_${currentFl}_m_565` };
    }
  }

  const elevatorStore = {
    id: `am_lift_${currentFl}`,
    name: 'Panoramik Asansörler (Otopark İnişi)',
    floor: currentFl,
    category_name: 'Asansör',
    cx: 565,
    cy: 420,
    nav_node: elevatorNodeId
  };

  if (startStoreObj) {
    setStartLocation(startStoreObj);
  }
  setTargetLocation(elevatorStore);

  showToast(`🚗 Aracınız ${saved.code} ${saved.zone} katta (${saved.pillar || 'Otopark'}). Otoparka iniş için en yakın asansöre yönlendiriliyorsunuz.`, 'success');
}

function setupParkingMemoryEvents() {
  document.getElementById('btn-parking-memory')?.addEventListener('click', () => {
    openParkingMemoryModal();
  });

  document.getElementById('btn-header-find-car')?.addEventListener('click', () => {
    navigateToSavedCar();
  });

  document.getElementById('btn-parking-modal-close')?.addEventListener('click', () => {
    closeParkingMemoryModal();
  });

  document.getElementById('parking-modal-backdrop')?.addEventListener('click', () => {
    closeParkingMemoryModal();
  });

  document.getElementById('btn-parking-save')?.addEventListener('click', () => {
    saveParkingSpot();
  });

  document.getElementById('btn-parking-delete')?.addEventListener('click', () => {
    deleteParkingSpot();
  });

  document.getElementById('btn-parking-navigate-car')?.addEventListener('click', () => {
    navigateToSavedCar();
  });

  function selectParkingFloor(btn) {
    if (!btn) return;
    document.querySelectorAll('.parking-floor-btn').forEach(b => {
      b.classList.remove('active');
      b.className = 'parking-floor-btn py-2 px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold text-center transition-all cursor-pointer';
    });
    btn.classList.add('active');
    btn.className = 'parking-floor-btn active py-2 px-2.5 rounded-xl border-2 border-indigo-600 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 ring-2 ring-indigo-500/50 text-xs font-black text-center transition-all shadow-xs cursor-pointer';

    selectedParkingFloor = {
      floor: parseInt(btn.getAttribute('data-floor') || '2', 10),
      code: btn.getAttribute('data-code') || 'P2',
      name: btn.getAttribute('data-name') || 'P2 (2. Bodrum Kat)'
    };
  }
  window.selectParkingFloor = selectParkingFloor;

  function selectParkingZone(btn) {
    if (!btn) return;
    const zone = btn.getAttribute('data-zone') || 'Mavi';
    const color = btn.getAttribute('data-color') || '#2563eb';

    document.querySelectorAll('.parking-zone-btn').forEach(b => {
      b.classList.remove('active');
      b.className = 'parking-zone-btn py-1.5 px-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer';
    });

    btn.classList.add('active');
    if (zone === 'Mavi') {
      btn.className = 'parking-zone-btn active py-1.5 px-2 rounded-xl border-2 border-blue-600 bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500/50 text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer';
    } else if (zone === 'Sarı') {
      btn.className = 'parking-zone-btn active py-1.5 px-2 rounded-xl border-2 border-amber-500 bg-amber-50 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 ring-2 ring-amber-400/50 text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer';
    } else if (zone === 'Turuncu') {
      btn.className = 'parking-zone-btn active py-1.5 px-2 rounded-xl border-2 border-orange-500 bg-orange-50 dark:bg-orange-900/40 text-orange-800 dark:text-orange-200 ring-2 ring-orange-400/50 text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer';
    } else if (zone === 'Kırmızı') {
      btn.className = 'parking-zone-btn active py-1.5 px-2 rounded-xl border-2 border-red-500 bg-red-50 dark:bg-red-900/40 text-red-800 dark:text-red-200 ring-2 ring-red-400/50 text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer';
    }

    selectedParkingZone = {
      name: zone,
      color: color
    };
  }
  window.selectParkingZone = selectParkingZone;

  // Kat Seçenekleri Dinleyicileri (Delegation + Doğrudan)
  const floorContainer = document.getElementById('parking-floor-options');
  floorContainer?.addEventListener('click', (e) => {
    const btn = e.target.closest('.parking-floor-btn');
    if (btn) selectParkingFloor(btn);
  });
  document.querySelectorAll('.parking-floor-btn').forEach(btn => {
    btn.addEventListener('click', () => selectParkingFloor(btn));
  });

  // Bölge Seçenekleri Dinleyicileri (Delegation + Doğrudan)
  const zoneContainer = document.getElementById('parking-zone-options');
  zoneContainer?.addEventListener('click', (e) => {
    const btn = e.target.closest('.parking-zone-btn');
    if (btn) selectParkingZone(btn);
  });
  document.querySelectorAll('.parking-zone-btn').forEach(btn => {
    btn.addEventListener('click', () => selectParkingZone(btn));
  });
}

// ========================================================
// YOL ÜSTÜ CANLI KAMPANYA VE MARKA ETKİLEŞİMİ (KAMPANYA SENSÖRÜ)
// ========================================================
const ACTIVE_STORE_CAMPAIGNS = {
  'store_4_8': {
    storeId: 'store_4_8',
    storeName: 'Cookshop',
    floor: 4,
    x: 1170,
    y: 310,
    title: 'Cookshop Gurme Ayrıcalığı',
    discount: '%15 İndirim',
    description: 'Capacity ziyaretçilerine özel: 500 TL üzeri tüm siparişlerde anında %15 indirim ve Magnolia tatlısı ikramı!',
    couponCode: 'COOKSHOP15',
    category: 'Yeme & İçme',
    badgeClass: 'bg-orange-500'
  },
  'store_4_41': {
    storeId: 'store_4_41',
    storeName: 'Twist',
    floor: 4,
    x: 687.5,
    y: 560,
    title: 'İlkbahar / Yaz Koleksiyonu',
    discount: 'Net %20 İndirim',
    description: 'Yeni sezon tüm giyim ve aksesuar koleksiyonunda kasada anında net %20 indirim fırsatını yakalayın.',
    couponCode: 'TWIST20',
    category: 'Moda',
    badgeClass: 'bg-pink-600'
  },
  'store_4_42': {
    storeId: 'store_4_42',
    storeName: 'Vakko',
    floor: 4,
    x: 170,
    y: 300,
    title: 'Vakko Özel Ayrıcalık',
    discount: '2. Ürüne %40 İndirim',
    description: 'Vakko Capacity butiğinde seçili eşarp, şal ve çanta koleksiyonlarında 2. ürüne %40 indirim!',
    couponCode: 'VAKKO40',
    category: 'Lüks Moda',
    badgeClass: 'bg-slate-900'
  },
  'store_5_34': {
    storeId: 'store_5_34',
    storeName: 'Sephora',
    floor: 5,
    x: 845,
    y: 550,
    title: 'Beauty Pass Festivali',
    discount: '%25 İndirim',
    description: 'Seçili lüks parfüm ve cilt bakım ürünlerinde %25 indirim ve hediye minyatür bakım seti!',
    couponCode: 'SEPHORA25',
    category: 'Kozmetik',
    badgeClass: 'bg-rose-600'
  },
  'store_5_45': {
    storeId: 'store_5_45',
    storeName: 'Zara',
    floor: 5,
    x: 1070,
    y: 590,
    title: 'Zara Sezon Trendleri',
    discount: '%30 İndirim',
    description: 'Capacity Zara mağazasında seçili yeni sezon kadın, erkek ve çocuk ürünlerinde net %30 indirim fırsatı.',
    couponCode: 'ZARA30',
    category: 'Moda',
    badgeClass: 'bg-indigo-600'
  }
};

let triggeredCampaignsThisRun = new Set();
let activeCampaignToastTimeout = null;
let currentActiveCampaign = null;

function checkEnRouteCampaignProximity(curX, curY, curFloor) {
  for (const campaign of Object.values(ACTIVE_STORE_CAMPAIGNS)) {
    if (campaign.floor !== curFloor) continue;
    if (triggeredCampaignsThisRun.has(campaign.storeId)) continue;

    const dist = Math.hypot(campaign.x - curX, campaign.y - curY);
    if (dist <= 85) {
      triggeredCampaignsThisRun.add(campaign.storeId);
      showEnRouteCampaignToast(campaign);
      break;
    }
  }
}

function showEnRouteCampaignToast(campaign) {
  currentActiveCampaign = campaign;
  const toast = document.getElementById('en-route-campaign-toast');
  if (!toast) return;

  if (activeCampaignToastTimeout) {
    clearTimeout(activeCampaignToastTimeout);
    activeCampaignToastTimeout = null;
  }

  const textEl = document.getElementById('campaign-toast-text');
  const discountEl = document.getElementById('campaign-toast-discount');

  if (textEl) {
    textEl.textContent = `Şu an ${campaign.storeName}'nın yanından geçiyorsunuz.`;
  }
  if (discountEl) {
    discountEl.textContent = campaign.discount;
  }

  toast.classList.remove('hidden', 'is-fading-out');

  activeCampaignToastTimeout = setTimeout(() => {
    dismissEnRouteCampaignToast();
  }, 5000);

  if (window.lucide) lucide.createIcons();
}

function dismissEnRouteCampaignToast() {
  const toast = document.getElementById('en-route-campaign-toast');
  if (!toast || toast.classList.contains('hidden')) return;

  toast.classList.add('is-fading-out');
  setTimeout(() => {
    toast.classList.add('hidden');
    toast.classList.remove('is-fading-out');
  }, 350);
}

function openCampaignModal(campaign) {
  dismissEnRouteCampaignToast();
  const c = campaign || currentActiveCampaign;
  if (!c) return;

  const modal = document.getElementById('en-route-campaign-modal');
  if (!modal) return;

  const storeNameEl = document.getElementById('campaign-modal-store-name');
  const titleEl = document.getElementById('campaign-modal-title');
  const badgeEl = document.getElementById('campaign-modal-badge');
  const catEl = document.getElementById('campaign-modal-category');
  const descEl = document.getElementById('campaign-modal-desc');
  const couponEl = document.getElementById('campaign-modal-coupon');

  if (storeNameEl) storeNameEl.textContent = c.storeName;
  if (titleEl) titleEl.textContent = c.title;
  if (badgeEl) badgeEl.textContent = c.discount;
  if (catEl) catEl.textContent = c.category;
  if (descEl) descEl.textContent = c.description;
  if (couponEl) couponEl.textContent = c.couponCode;

  modal.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function closeCampaignModal() {
  document.getElementById('en-route-campaign-modal')?.classList.add('hidden');
}

function setupCampaignEvents() {
  document.getElementById('btn-campaign-toast-view')?.addEventListener('click', () => {
    openCampaignModal();
  });

  document.getElementById('btn-campaign-toast-close')?.addEventListener('click', () => {
    dismissEnRouteCampaignToast();
  });

  document.getElementById('btn-campaign-modal-close')?.addEventListener('click', () => {
    closeCampaignModal();
  });

  document.getElementById('campaign-modal-backdrop')?.addEventListener('click', () => {
    closeCampaignModal();
  });

  document.getElementById('btn-campaign-modal-ok')?.addEventListener('click', () => {
    closeCampaignModal();
  });

  document.getElementById('btn-campaign-copy-coupon')?.addEventListener('click', () => {
    const couponEl = document.getElementById('campaign-modal-coupon');
    const code = couponEl ? couponEl.textContent.trim() : '';
    if (code) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code).catch(() => {});
      }
      showToast(`🎟️ Kupon kodu kopyalandı: ${code}`, 'success');
    }
  });
}

window.openParkingMemoryModal = openParkingMemoryModal;
window.closeParkingMemoryModal = closeParkingMemoryModal;
window.saveParkingSpot = saveParkingSpot;
window.deleteParkingSpot = deleteParkingSpot;
window.navigateToSavedCar = navigateToSavedCar;
window.openCampaignModal = openCampaignModal;
window.closeCampaignModal = closeCampaignModal;
window.showEnRouteCampaignToast = showEnRouteCampaignToast;
window.dismissEnRouteCampaignToast = dismissEnRouteCampaignToast;
window.checkEnRouteCampaignProximity = checkEnRouteCampaignProximity;
