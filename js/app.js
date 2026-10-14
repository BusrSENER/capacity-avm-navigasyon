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

// Simülasyon Hız Kontrolü (1x ➔ 2x ➔ 4x) - 2B Çanta, 3B Gözümden Yürüyüş ve Sesli Komut Hızı Senkronize
let currentSimSpeed = 1.0;
window.currentSimSpeed = currentSimSpeed;
const simSpeedSteps = [1.0, 2.0, 4.0];

function setSimSpeed(spd, silent = false) {
  const numericSpeed = Number(spd) || 1.0;
  currentSimSpeed = numericSpeed;
  window.currentSimSpeed = currentSimSpeed;

  if (cartSimulator) {
    cartSimulator.setSpeed(currentSimSpeed);
  }
  if (window.pov3dEngine && window.pov3dEngine.walkSpeed !== currentSimSpeed) {
    window.pov3dEngine.walkSpeed = currentSimSpeed;
    const povSpeedBtn = document.getElementById('btn-pov-speed');
    if (povSpeedBtn) {
      povSpeedBtn.textContent = `${currentSimSpeed}x`;
    }
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

  // Modal ve çekmecedeki 1x / 2x / 4x hız seçim butonlarını senkronize et
  document.querySelectorAll('.sim-speed-choice-btn').forEach(btn => {
    const btnSpd = Number(btn.getAttribute('data-sim-speed'));
    if (btnSpd === currentSimSpeed) {
      btn.classList.add('is-active-speed', 'bg-cyan-600', 'text-white', 'border-cyan-500', 'shadow-xs');
      btn.classList.remove('bg-slate-100', 'dark:bg-slate-800', 'text-slate-700', 'dark:text-slate-300');
    } else {
      btn.classList.remove('is-active-speed', 'bg-cyan-600', 'text-white', 'border-cyan-500', 'shadow-xs');
      btn.classList.add('bg-slate-100', 'dark:bg-slate-800', 'text-slate-700', 'dark:text-slate-300');
    }
  });

  const speedRangeSlider = document.getElementById('sim-speed-range-slider');
  if (speedRangeSlider) {
    speedRangeSlider.value = String(currentSimSpeed);
  }

  const routeSpeedText = document.getElementById('route-speed-text');
  const isEn = (currentLanguage === 'en' || window.currentLanguage === 'en');
  if (routeSpeedText) {
    routeSpeedText.textContent = `${currentSimSpeed}x ${isEn ? 'Speed' : 'Hız'}`;
  }

  if (!silent) {
    showToast(`⚡ Simülasyon ve seslendirme hızı: ${currentSimSpeed}x`, 'info');
  }
}
window.setSimSpeed = setSimSpeed;
window.setSimulationSpeed = setSimSpeed;

function cycleSimSpeed() {
  const currentIndex = simSpeedSteps.indexOf(currentSimSpeed);
  const nextIndex = (currentIndex + 1) % simSpeedSteps.length;
  setSimSpeed(simSpeedSteps[nextIndex]);
}
window.cycleSimSpeed = cycleSimSpeed;

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

  if (toggleIcon) toggleIcon.innerHTML = getMonoIconSvg('layers', 14);
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

  if (toggleIcon) toggleIcon.innerHTML = getMonoIconSvg('layers', 14);
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
  if (window.innerWidth < 768) return;
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
  if (window.innerWidth < 768) return;
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
  if (window.innerWidth < 768) return;
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

// Minimalist Tek Renk (Monochrome / currentColor) Inline SVG Çizgi İkon Yardımcısı (14-16px Lucide/Feather Tarzı)
function getMonoIconSvg(name, size = 14) {
  const s = Number(size) || 14;
  const base = `width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="inline-block shrink-0"`;
  const paths = {
    car: `<svg ${base}><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>`,
    navigation: `<svg ${base}><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>`,
    pin: `<svg ${base}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`,
    play: `<svg ${base}><polygon points="6 3 20 12 6 21 6 3"/></svg>`,
    route: `<svg ${base}><circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/></svg>`,
    logOut: `<svg ${base}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>`,
    volume2: `<svg ${base}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`,
    volumeX: `<svg ${base}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="22" x2="16" y1="9" y2="15"/><line x1="16" x2="22" y1="9" y2="15"/></svg>`,
    check: `<svg ${base}><path d="M20 6 9 17l-5-5"/></svg>`,
    info: `<svg ${base}><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`,
    warning: `<svg ${base}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`,
    arrowUp: `<svg ${base}><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>`,
    cornerUpRight: `<svg ${base}><polyline points="15 14 20 9 15 4"/><path d="M4 20v-7a4 4 0 0 1 4-4h12"/></svg>`,
    cornerUpLeft: `<svg ${base}><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>`,
    layers: `<svg ${base}><path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/></svg>`,
    eye: `<svg ${base}><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`,
    refresh: `<svg ${base}><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>`
  };
  return paths[name] || paths.info;
}
window.getMonoIconSvg = getMonoIconSvg;

function stripUiEmojis(raw) {
  if (!raw) return '';
  return String(raw)
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}
window.stripUiEmojis = stripUiEmojis;

// Toast Notification Engine (Tekil Kuyruk & Yığılma Önleyici - Kurumsal Minimalist)
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

  const cleanMsg = stripUiEmojis(message);
  const toast = document.createElement('div');
  const typeStyles = {
    info: 'border-cyan-500/40 bg-white/95 dark:bg-slate-900/90 text-cyan-700 dark:text-cyan-300',
    success: 'border-emerald-500/40 bg-white/95 dark:bg-slate-900/90 text-emerald-700 dark:text-emerald-300',
    warning: 'border-amber-500/40 bg-white/95 dark:bg-slate-900/90 text-amber-700 dark:text-amber-300',
    error: 'border-rose-500/40 bg-white/95 dark:bg-slate-900/90 text-rose-700 dark:text-rose-300'
  };

  const icons = {
    info: getMonoIconSvg('info', 15),
    success: getMonoIconSvg('check', 15),
    warning: getMonoIconSvg('warning', 15),
    error: getMonoIconSvg('warning', 15)
  };

  toast.className = `flex items-center gap-2.5 px-4 py-3 rounded-2xl border shadow-xl backdrop-blur-md text-xs sm:text-sm font-semibold transition-all duration-300 transform translate-y-4 opacity-0 ${typeStyles[type] || typeStyles.info}`;
  toast.innerHTML = `
    <span class="shrink-0 flex items-center">${icons[type] || icons.info}</span>
    <span class="flex-1">${cleanMsg}</span>
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
window.currentLang = currentLanguage;

const TRANSLATIONS = {
  tr: {
    startPlaceholder: 'Nereden? (Giriş / Mağaza)',
    targetPlaceholder: 'Nereye? (Mağaza / Hizmet)',
    entranceLabel: 'Giriş:',
    danisma: 'Danışma',
    escalator: 'Yürüyen Merdiven',
    elevator: 'Asansör / Bebek',
    tabThisFloor: 'Bu katta · ',
    tabAllFloors: 'Tüm katlar',
    categories: {
      all: 'Tümü',
      fashion: 'Moda',
      shoes: 'Ayakkabı & Çanta',
      sports: 'Spor',
      jewelry: 'Saat & Mücevher',
      tech: 'Teknoloji',
      cosmetics: 'Kozmetik',
      food: 'Yeme & İçme',
      home: 'Ev & Yaşam',
      entertainment: 'Eğlence',
      service: 'Hizmet'
    },
    amenities: {
      wc: 'Tuvalet',
      elevator: 'Asansör',
      baby: 'Bebek Odası',
      emergency: 'Acil Çıkış',
      carpark: 'Otopark',
      kiosk: 'Kiosk Harita',
      entrance: 'Giriş-Çıkış',
      info: 'Danışma',
      atm: 'Bankamatikler (ATM)',
      prayer: 'Mescit',
      wheelchair: 'Akülü Sandalye Şarj'
    },
    parkingMemoryBtn: 'Park Yerini Kaydet',
    parkingModalTitle: 'Otopark Hafızası',
    parkingModalDesc: 'Park yerinizi kaydedin, dönüşte tek tıkla rotanızı çizin',
    parkingFloorLabel: 'Hangi Kat?',
    parkingZoneLabel: 'Hangi Bölge / Renk?',
    parkingPillarLabel: 'Direk No / Sütun / Not (İsteğe Bağlı):',
    parkingPillarPlaceholder: 'Örn: B-04, B2-03 Hibatech, E-Şarj İstasyonu...',
    parkingSaveBtn: 'Park Yerini Kaydet',
    parkingSavedTitle: 'Kayıtlı Araç Konumu',
    parkingDeleteBtn: 'Park Kaydını Sonlandır',
    parkingNavigateBtn: 'Araca Rota Çiz',
    peekStartBtn: 'Buradayım (Başlangıç Yap)',
    peekTargetBtn: 'Hedef Yap',
    simStart: 'Rota Önizleme',
    simPause: 'Duraklat',
    hudDetail: 'Detay',
    compass: 'Kuzey: Carousel • Doğu: Fişekhane Cad.'
  },
  en: {
    startPlaceholder: 'From where? (Entrance / Store)',
    targetPlaceholder: 'To where? (Store / Service)',
    entranceLabel: 'Entrance:',
    danisma: 'Info Desk',
    escalator: 'Escalator',
    elevator: 'Elevator / Stroller',
    tabThisFloor: 'On this floor · ',
    tabAllFloors: 'All floors',
    categories: {
      all: 'All',
      fashion: 'Fashion',
      shoes: 'Shoes & Bags',
      sports: 'Sports',
      jewelry: 'Watches & Jewelry',
      tech: 'Technology',
      cosmetics: 'Cosmetics',
      food: 'Food & Drink',
      home: 'Home & Living',
      entertainment: 'Entertainment',
      service: 'Services'
    },
    amenities: {
      wc: 'Restrooms',
      elevator: 'Elevators',
      baby: 'Baby Care',
      emergency: 'Emergency Exit',
      carpark: 'Parking',
      kiosk: 'Kiosk Map',
      entrance: 'Entrances',
      info: 'Info Desk',
      atm: 'Bank ATMs',
      prayer: 'Prayer Room',
      wheelchair: 'Wheelchair Charger'
    },
    parkingMemoryBtn: 'Save Parking Spot',
    parkingModalTitle: 'Parking Memory',
    parkingModalDesc: 'Save your parking spot, route back with 1-click',
    parkingFloorLabel: 'Which Floor?',
    parkingZoneLabel: 'Which Zone / Color?',
    parkingPillarLabel: 'Pillar No / Column / Note (Optional):',
    parkingPillarPlaceholder: 'e.g. B-04, B2-03 Hibatech, EV Charger...',
    parkingSaveBtn: 'Park Yerini Kaydet',
    parkingSavedTitle: 'Saved Vehicle Location',
    parkingDeleteBtn: 'Park Kaydını Sonlandır',
    parkingNavigateBtn: 'Araca Rota Çiz',
    peekStartBtn: 'I am here (Start Point)',
    peekTargetBtn: 'Set as Target',
    simStart: 'Route Preview',
    simPause: 'Pause',
    hudDetail: 'Details',
    compass: 'North: Carousel • East: Fişekhane Ave.'
  }
};

function setLanguage(lang) {
  const prevLang = currentLanguage;
  currentLanguage = (lang === 'en') ? 'en' : 'tr';
  try {
    localStorage.setItem('capacity_language', currentLanguage);
  } catch (e) {}
  window.currentLanguage = currentLanguage;
  window.currentLang = currentLanguage;

  // Dil değiştirildiği an aktif konuşmayı derhal kes (Madde 3)
  if ('speechSynthesis' in window && window.speechSynthesis) {
    try {
      window.speechSynthesis.cancel();
    } catch (e) {}
  }
  if (window.activeTtsAudio) {
    try {
      window.activeTtsAudio.pause();
    } catch (e) {}
  }
  if (window.queuedArrivalTimer) {
    clearTimeout(window.queuedArrivalTimer);
    window.queuedArrivalTimer = null;
    window.arrivalSpeechQueueTimer = null;
  }
  window.speechBusyUntil = 0;
  window.speechMainBusyUntil = 0;

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
    const spans = escBtn.querySelectorAll('span');
    const textSpan = spans[spans.length - 1];
    if (textSpan) textSpan.textContent = t.escalator;
  }
  if (eleBtn) {
    const spans = eleBtn.querySelectorAll('span');
    const textSpan = spans[spans.length - 1];
    if (textSpan) textSpan.textContent = t.elevator;
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

  // 6. Amenity Pills (Monochrome SVG + Clean Text, 0 Emojis)
  document.querySelectorAll('#amenity-chips-row .amenity-pill').forEach(pill => {
    const amen = pill.getAttribute('data-amenity');
    if (amen && t.amenities[amen]) {
      pill.innerHTML = `${getMonoIconSvg('pin', 13)} <span>${t.amenities[amen]}</span>`;
    }
  });

  // 7. Parking memory button
  const pBtnText = document.getElementById('parking-memory-btn-text');
  if (pBtnText && !getSavedParkingSpot()) {
    pBtnText.textContent = t.parkingMemoryBtn;
  }

  // 8. Tabs (Bu katta / Tüm katlar)
  const tabAll = document.getElementById('tab-all-floors');
  if (tabAll) tabAll.textContent = t.tabAllFloors;

  // 9. Peek Card Buttons
  const peekStart = document.getElementById('btn-peek-start');
  const peekTarget = document.getElementById('btn-peek-target');
  if (peekStart) {
    peekStart.innerHTML = `${getMonoIconSvg('pin', 14)}<span class="truncate font-bold">${t.peekStartBtn}</span>`;
  }
  if (peekTarget) {
    peekTarget.innerHTML = `${getMonoIconSvg('navigation', 14)}<span class="truncate font-bold">${t.peekTargetBtn}</span>`;
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
    pSaveBtn.innerHTML = `${getMonoIconSvg('car', 15)}<span>Park Yerini Kaydet</span>`;
  }
  const pNavBtn = document.getElementById('btn-parking-navigate-car');
  if (pNavBtn) {
    pNavBtn.innerHTML = `${getMonoIconSvg('navigation', 15)}<span>Araca Rota Çiz</span>`;
  }
  const pDelBtn = document.getElementById('btn-parking-delete');
  if (pDelBtn) {
    pDelBtn.innerHTML = `${getMonoIconSvg('logOut', 14)}<span>Park Kaydını Sonlandır</span>`;
  }

  // 12. Simulation play button
  const simPlayText = document.getElementById('sim-play-text');
  if (simPlayText) {
    const isRunning = cartSimulator && cartSimulator.isRunning;
    simPlayText.textContent = isRunning ? t.simPause : t.simStart;
  }

  // 13. Eğer aktif bir rota varsa, yönergeleri seçilen dilde (TR / EN) yeniden üret ve HUD'ı güncelle
  if (lastCalculatedRoute && navEngine && typeof navEngine._generateInstructions === 'function') {
    const nodes = lastCalculatedRoute.pathNodes || lastCalculatedRoute.path || [];
    if (nodes.length > 0) {
      const startId = selectedStartStore?.nav_node || nodes[0]?.id || null;
      const targetId = selectedTargetStore?.nav_node || nodes[nodes.length - 1]?.id || null;
      const genRes = navEngine._generateInstructions(
        nodes,
        startId,
        targetId
      );
      const newInstructions = Array.isArray(genRes) ? genRes : (genRes?.instructions || []);
      lastCalculatedRoute.instructions = newInstructions;
      if (genRes?.enRouteStoreIds) lastCalculatedRoute.enRouteStoreIds = genRes.enRouteStoreIds;
      if (genRes?.enRouteStoreNames) lastCalculatedRoute.enRouteStoreNames = genRes.enRouteStoreNames;

      if (selectedTargetStore && typeof updateHeaderNavSummary === 'function') {
        updateHeaderNavSummary(selectedTargetStore, lastCalculatedRoute);
      }
      if (typeof renderHudStepsList === 'function') {
        renderHudStepsList(lastCalculatedRoute, selectedTargetStore);
      }

      if (typeof window.resetVoiceStepTracker === 'function') {
        window.resetVoiceStepTracker();
      }
      const curIdx = cartSimulator ? (cartSimulator.currentIndex || 0) : 0;
      const totalLen = Math.max(1, nodes.length - 1);
      const pct = Math.min(99, Math.round((curIdx / totalLen) * 100));
      if (typeof updateLiveNavHUD === 'function') {
        updateLiveNavHUD(curIdx, pct);
      }
      // Dil değişimi sonrası aktif yönergeyi yeni dilde (en-US / tr-TR) seslendir
      if (prevLang !== currentLanguage && lastCalculatedRoute.instructions.length > 0) {
        const firstIns = lastCalculatedRoute.instructions[0];
        if (firstIns && typeof window.speakNavigationText === 'function') {
          window.speakNavigationText(firstIns.voiceText || firstIns.text, true);
        }
      }
    }
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


// Açılış Ekranı (Splash Screen: 3.5s Giriş Koreografisi)
const splashStartTime = Date.now();
window.splashStartedAt = splashStartTime;
const MIN_SPLASH_DURATION = 3500; // ms (~3.5 saniye pendulum & CAPACITY reveal)
const SPLASH_FADE_OUT_MS = 800;   // ms (0.8s pürüzsüz fade-out)

function hideSplashScreen() {
  const elapsed = Date.now() - splashStartTime;
  const remaining = Math.max(0, MIN_SPLASH_DURATION - elapsed);
  setTimeout(() => {
    const splash = document.getElementById('splash-screen');
    if (splash && !splash.classList.contains('pointer-events-none')) {
      splash.classList.add('splash-hidden', 'opacity-0', 'pointer-events-none');
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
  const chipWideSidebar = document.getElementById('chip-path-wide-sidebar');
  const chipShortSidebar = document.getElementById('chip-path-short-sidebar');

  const activeClasses = ['border-indigo-600', 'bg-indigo-600', 'text-white', 'shadow-xs'];
  const inactiveClasses = ['border-slate-200', 'dark:border-slate-700', 'bg-slate-100', 'dark:bg-slate-800', 'text-slate-700', 'dark:text-slate-300', 'hover:bg-slate-200', 'dark:hover:bg-slate-700'];

  if (pref === 'wide') {
    chipWide?.classList.remove(...inactiveClasses);
    chipWide?.classList.add(...activeClasses);
    chipShort?.classList.remove(...activeClasses);
    chipShort?.classList.add(...inactiveClasses);

    chipWideSidebar?.classList.remove(...inactiveClasses);
    chipWideSidebar?.classList.add(...activeClasses);
    chipShortSidebar?.classList.remove(...activeClasses);
    chipShortSidebar?.classList.add(...inactiveClasses);
  } else {
    chipShort?.classList.remove(...inactiveClasses);
    chipShort?.classList.add(...activeClasses);
    chipWide?.classList.remove(...activeClasses);
    chipWide?.classList.add(...inactiveClasses);

    chipShortSidebar?.classList.remove(...inactiveClasses);
    chipShortSidebar?.classList.add(...activeClasses);
    chipWideSidebar?.classList.remove(...activeClasses);
    chipWideSidebar?.classList.add(...inactiveClasses);
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
  document.getElementById('chip-path-wide-sidebar')?.addEventListener('click', (e) => {
    e.stopPropagation();
    setPathPreference('wide');
  });
  document.getElementById('chip-path-short-sidebar')?.addEventListener('click', (e) => {
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

  // Türkçe Sesli Yönlendirme Motoru (Web Speech API - Varsayılan Açık & "Yanından Geçtiğim Mağazalar" Destekli)
  let isVoiceEnabled = true;
  let lastSpokenStepIndex = -999;
  window.isVoiceEnabled = true;
  window.lastSpokenNavigationText = '';

  // 👁️ Birinci Şahıs (X Kişisinin Gözü) 3B Koridor Motoru Başlatma
  if (typeof Pov3DEngine !== 'undefined') {
    window.pov3dEngine = new Pov3DEngine(mallData);
  }

  function setMapViewMode(mode) {
    document.getElementById('route-mode-choice-modal')?.classList.add('hidden');

    window.currentViewMode = mode;
    const modeBtns = document.querySelectorAll('.view-mode-btn');
    modeBtns.forEach(btn => {
      const bMode = btn.getAttribute('data-view-mode');
      if (bMode === mode) {
        btn.className = 'view-mode-btn py-1.5 px-1.5 rounded-lg text-[10.5px] font-extrabold flex items-center justify-center gap-1 transition-all cursor-pointer bg-gradient-to-r from-orange-500 to-rose-600 text-white shadow-sm';
      } else {
        btn.className = 'view-mode-btn py-1.5 px-1.5 rounded-lg text-[10.5px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-700/60';
      }
    });

    const headerPovBtn = document.getElementById('btn-header-pov-toggle');
    const headerPovIcon = document.getElementById('header-pov-icon');
    const headerPovText = document.getElementById('header-pov-text');

    if (mode === 'pov') {
      if (headerPovBtn) {
        headerPovBtn.className = 'header-pov-toggle-btn shrink-0 px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-400/40 text-[11px] font-extrabold flex items-center gap-1 shadow-sm transition-all active:scale-95 cursor-pointer';
      }
      if (headerPovIcon) headerPovIcon.innerHTML = getMonoIconSvg('layers', 14);
      if (headerPovText) headerPovText.textContent = '2B Harita';

      // 2B Çanta çalışıyorsa duraklat ve kaldığı segmenti (currentIndex, subProgress) 3B Gözümden kamerasına aktar
      const savedIdx = cartSimulator ? cartSimulator.currentIndex : 0;
      const savedProg = cartSimulator ? cartSimulator.subProgress : 0;
      const savedX = cartSimulator ? cartSimulator.currentX : (selectedStartStore?.cx || 0);
      const savedY = cartSimulator ? cartSimulator.currentY : (selectedStartStore?.cy || 0);
      const savedFloor = cartSimulator ? cartSimulator.currentFloor : (selectedStartStore?.floor || currentFloor || 4);

      if (cartSimulator && cartSimulator.isPlaying) {
        cartSimulator.pause();
      }

      if (window.pov3dEngine) {
        if (window.hasAnnouncedArrival || window.isRouteCompletedState) {
          // Rota zaten tamamlanmışsa 3B butonuna tekrar basıldığında yürüyüşü ve varış anonsunu YENİDEN BAŞLATMA!
          const reachedFocus = window.lastReachedStore || selectedTargetStore || selectedStartStore || activePoiStore || null;
          window.pov3dEngine.hasAnnouncedArrival = true;
          window.pov3dEngine.isWalking = false;
          window.pov3dEngine.enterFreeRoam(reachedFocus?.floor || currentFloor || 4, reachedFocus);
          window.pov3dEngine.totalProgressPct = 100;
          window.pov3dEngine.remainingMeters = 0;
          window.pov3dEngine._syncPlayPauseButton();
          window.pov3dEngine._updateHUDTexts();
        } else if (lastCalculatedRoute && selectedStartStore && selectedTargetStore) {
          if (savedIdx > 0 || savedProg > 0.02) {
            window.pov3dEngine.route = lastCalculatedRoute;
            window.pov3dEngine.startStore = selectedStartStore;
            window.pov3dEngine.targetStore = selectedTargetStore;
            window.pov3dEngine.syncFromCart(savedIdx, savedProg, savedX, savedY, savedFloor);
            window.pov3dEngine.isWalking = true;
            window.pov3dEngine._syncPlayPauseButton();
            window.pov3dEngine.activate();
          } else {
            window.pov3dEngine.startRouteWalk(lastCalculatedRoute, selectedStartStore, selectedTargetStore, true, true);
          }
        } else {
          // Aktif rota yoksa: Google Street View tarzı 3B Serbest AVM Sokak Gezintisi başlat!
          const focusStore = selectedStartStore || activePoiStore || null;
          window.pov3dEngine.enterFreeRoam(focusStore?.floor || currentFloor || 4, focusStore);
        }
      }
    } else {
      // '2d' veya '3d' moduna geçiş: 3B Gözümden aktifse kaldığı noktayı 2B/3B Çanta Simülatörüne kesintisiz aktar
      let shouldResumeCart = false;
      if (window.pov3dEngine && window.pov3dEngine.isActive) {
        shouldResumeCart = Boolean(window.pov3dEngine.isWalking && window.pov3dEngine.totalProgressPct < 99 && !window.hasAnnouncedArrival);
        const povIdx = window.pov3dEngine.segIndex;
        const povProg = window.pov3dEngine.segProgress;
        const povX = window.pov3dEngine.camX;
        const povY = window.pov3dEngine.camY;
        const povFloor = window.pov3dEngine.currentFloor;
        window.pov3dEngine.exit();

        if (cartSimulator && lastCalculatedRoute && !window.hasAnnouncedArrival && !window.isRouteCompletedState) {
          cartSimulator.syncFromPov(povIdx, povProg, povX, povY, povFloor);
        }
      }

      if (mallMap) {
        mallMap.set3DMode(mode === '3d');
      }
      if (headerPovBtn) {
        headerPovBtn.className = 'header-pov-toggle-btn shrink-0 px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-extrabold flex items-center gap-1 shadow-sm shadow-indigo-600/20 transition-all active:scale-95 cursor-pointer';
      }
      if (headerPovIcon) headerPovIcon.innerHTML = getMonoIconSvg('eye', 14);
      if (headerPovText) headerPovText.textContent = '3B Görünüm';

      if (shouldResumeCart && cartSimulator && !cartSimulator.isPlaying) {
        cartSimulator.start();
        const playText = document.getElementById('sim-play-text');
        if (playText) playText.textContent = 'Duraklat';
        const hudSimText = document.getElementById('hud-sim-text');
        if (hudSimText) hudSimText.textContent = 'Duraklat';
        const hudSimIcon = document.getElementById('hud-sim-icon');
        if (hudSimIcon) hudSimIcon.setAttribute('data-lucide', 'pause');
        if (window.lucide) lucide.createIcons();
      }
    }
  }
  window.setMapViewMode = setMapViewMode;

  window.speechBusyUntil = 0;
  window.speechMainBusyUntil = 0;
  window.activeTtsAudio = null;
  window.lastVoiceLanguage = 'tr-TR';
  window.hasAnnouncedArrival = false;

  function getTurkishPossessiveSuffix(name) {
    if (!name) return "'nın";
    const spoken = toTurkishPhoneticSpeech(name).toLowerCase().trim();
    if (!spoken) return "'nın";
    const vowels = 'aeıioöuü';
    let lastVowel = 'a';
    for (let i = spoken.length - 1; i >= 0; i--) {
      if (vowels.includes(spoken[i])) {
        lastVowel = spoken[i];
        break;
      }
    }
    const endsWithVowel = vowels.includes(spoken[spoken.length - 1]);
    const prefix = endsWithVowel ? 'n' : '';
    if (lastVowel === 'e' || lastVowel === 'i') return `'${prefix}in`;
    if (lastVowel === 'o' || lastVowel === 'u') return `'${prefix}un`;
    if (lastVowel === 'ö' || lastVowel === 'ü') return `'${prefix}ün`;
    return `'${prefix}ın`;
  }
  window.getTurkishPossessiveSuffix = getTurkishPossessiveSuffix;

  const ttsPronunciationMap = Object.assign(window.ttsPronunciationMap || {}, {
    'W Collection': 'Dabılyu Kolekşın',
    'Tommy Hilfiger': 'Tomi Hilfiger',
    'English Home': 'İngliş Hom',
    'Madame Coco': 'Madam Koko',
    'Marks & Spencer': 'Marks end Spensır',
    'Pull&Bear': 'Pul end Ber',
    'Pull & Bear': 'Pul end Ber',
    'U.S. Polo Assn.': 'Yu Es Polo',
    'US Polo': 'Yu Es Polo',
    'Mac': 'Mek',
    'MAC': 'Mek',
    'M·A·C': 'Mek',
    'Yves Rocher': 'İv Roşe',
    "L'Occitane": 'Loksitan',
    'SuperStep': 'Süper Step',
    'Sneaks Up': 'Sniks Ap',
    'Skechers': 'Skeçırs',
    'Pierre Cardin': 'Piyer Kardin',
    'The North Face': 'Dı Nort Feys',
    'Burger King': 'Börgır King',
    'HD İskender': 'He De İskender',
    'Tchibo': 'Çibo',
    'Blue Diamond': 'Mavi Elmas',
    'D&R': 'De ve Er',
    'D & R': 'De ve Er',
    'LCWaikiki': 'El Si Vaykiki',
    'LC Waikiki': 'El Si Vaykiki',
    'H&M': 'Haş ve Em',
    'B&G Store': 'Be ve Ge Stor',
    'Jack & Jones': 'Cek end Cons',
    'Saat & Saat': 'Saat ve Saat',
    'Sephora': 'Sefora',
    'DeFacto': 'Defakto',
    "Victoria's Secret": 'Viktoryaz Sikrıt',
    'Stradivarius': 'Stradivaryus',
    'Bershka': 'Berşka',
    'Oysho': 'Oyşo',
    'Massimo Dutti': 'Massimo Dutti',
    'Beymen Club': 'Beymen Klab',
    'Paribu Cineverse': 'Paribu Sinevörs',
    'KFC': 'Key Ef Si',
    "Arby's": 'Arbis',
    'Popeyes': 'Popays',
    "Carl's Jr.": 'Karls Cunyır',
    "McDonald's": 'Mekdanılds',
    'Green Salads': 'Grin Salads',
    'Subway': 'Sabvey',
    'Starbucks': 'Starbaks',
    'Caribou Coffee': 'Karibu Kofi',
    'Caffè Nero': 'Kafe Nero',
    'Cafe Nero': 'Kafe Nero',
    'Cold Stone': 'Kold Ston',
    'Krispy Kreme': 'Krispi Krim',
    'Rossmann': 'Rosman',
    'Watsons': 'Vatsıns',
    'Golden Rose': 'Goldın Roz',
    'Hairist': 'Heyrist',
    'Columbia': 'Kolombiya',
    'Timberland': 'Timbırlend',
    'New Balance': 'Niv Balans',
    'Under Armour': 'Andır Armır',
    'Harley Davidson': 'Harli Devidsın',
    'Hummel': 'Humel',
    'Camper': 'Kempır',
    'Crocs': 'Kroks',
    'Ecco': 'Eko',
    'Nine West': 'Nayn Vest',
    'MediaMarkt': 'Medya Markt',
    'Mi Store': 'Mi Stor',
    'Apple': 'Epıl',
    'Dyson': 'Daysın',
    'Swarovski': 'Svarovski',
    'Swatch': 'Svoç',
    'Tobacco Shop': 'Tobako Şop',
    'Dry Center': 'Dray Sentır',
    'Pets Club': 'Pets Klab',
    'FunTime': 'Fan Taym',
    'Toyzz Shop': 'Toyz Şop',
    'Mothercare': 'Madırkeyr',
    'Chicco': 'Kiko',
    'Flying Tiger': 'Flaying Taygır',
    'Samsonite': 'Semsonayt',
    "Levi's": 'Livays',
    'Lee Wrangler': 'Li Renglır',
    'Calvin Klein': 'Kalvin Klayn',
    'Guess': 'Ges',
    'Lacoste': 'Lakost',
    'Nautica': 'Notika',
    'Gant': 'Gent',
    'Calzedonia': 'Kalzedonya',
    'Suwen': 'Suven',
    'Cookshop': 'Kukşop',
    'The Hunger': 'Dı Hangır',
    'Storks Diamond': 'Storks Daymınd',
    'G Lingerie': 'Ci Lanjeri',
    'So Chic': 'So Şik',
    'Sunglass Hut': 'Sanglas Hat',
    'Cacharel': 'Kaşarel'
  });
  window.ttsPronunciationMap = ttsPronunciationMap;

  function toTurkishPhoneticSpeech(rawText) {
    if (!rawText) return '';
    let s = stripUiEmojis(String(rawText))
      .replace(/➔|→/g, ', ')
      .replace(/(\d+)\s*m\b/gi, '$1 metre')
      .replace(/(\d+)\s*dk\b/gi, '$1 dakika')
      .replace(/\bWC\b/gi, 'Tuvalet');

    const sortedEntries = Object.entries(ttsPronunciationMap).sort((a, b) => b[0].length - a[0].length);
    for (const [brand, phonetic] of sortedEntries) {
      const escaped = brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = /^[A-Za-z0-9]+$/.test(brand)
        ? new RegExp(`\\b${escaped}\\b`, 'gi')
        : new RegExp(escaped, 'gi');
      s = s.replace(regex, phonetic);
    }

    return s.replace(/\s+/g, ' ').trim();
  }
  window.toTurkishPhoneticSpeech = toTurkishPhoneticSpeech;
  window.normalizeTextForTurkishTts = toTurkishPhoneticSpeech;

  function updateVoiceSubtitleUI(rawText, isSpeaking = true) {
    const subBar = document.getElementById('live-voice-subtitle-bar');
    const subText = document.getElementById('live-voice-subtitle-text');
    if (!subBar || !subText) return;
    if (!rawText || window.hasAnnouncedArrival || window.isRouteCompletedState) {
      subBar.classList.add('hidden');
      return;
    }
    subBar.classList.remove('hidden');
    subText.textContent = stripUiEmojis(String(rawText));
    const dot = subBar.querySelector('span');
    if (dot) {
      dot.className = isSpeaking
        ? 'inline-block w-2 h-2 rounded-full bg-cyan-500 animate-ping shrink-0'
        : 'inline-block w-2 h-2 rounded-full bg-emerald-500 shrink-0';
    }
  }
  window.updateVoiceSubtitleUI = updateVoiceSubtitleUI;

  window.wasArrivalSpeechQueued = false;
  window.queuedArrivalDelayMs = 0;
  window.queuedArrivalTimer = null;

  function isSpeechEngineCurrentlyBusy() {
    const now = performance.now();
    const synthSpeaking = Boolean('speechSynthesis' in window && window.speechSynthesis && window.speechSynthesis.speaking);
    const audioSpeaking = Boolean(window.activeTtsAudio && !window.activeTtsAudio.paused && !window.activeTtsAudio.ended);
    const mainBusy = now < (window.speechMainBusyUntil || 0);
    return synthSpeaking || audioSpeaking || mainBusy;
  }
  window.isSpeechEngineCurrentlyBusy = isSpeechEngineCurrentlyBusy;

  function queueArrivalAnnouncement(arrMsgOrTarget) {
    if (!arrMsgOrTarget) return;
    let arrMsg = '';
    if (typeof arrMsgOrTarget === 'object') {
      const isEn = (currentLanguage === 'en' || window.currentLanguage === 'en');
      const isAmenity = isServiceOrAmenityItem(arrMsgOrTarget);
      const destName = stripUiEmojis(arrMsgOrTarget.name || arrMsgOrTarget.short_name || (isEn ? 'Destination' : 'Hedef Nokta'));
      if (isAmenity) {
        const amEn = (navEngine && typeof navEngine._getAmenityLabelEn === 'function')
          ? navEngine._getAmenityLabelEn(destName)
          : destName;
        arrMsg = isEn ? `You have arrived at ${amEn}.` : `${destName} noktasındasınız.`;
      } else {
        arrMsg = isEn
          ? `You have arrived at ${destName}.`
          : `Hedefe ulaştınız! ${destName} mağazası önündesiniz. Keyifli alışverişler dileriz.`;
      }
    } else {
      arrMsg = String(arrMsgOrTarget);
    }
    // Mükerrer varış anonsunu engelle (hasAnnouncedArrival bayrağı)
    if (window.hasAnnouncedArrival) return;
    window.hasAnnouncedArrival = true;
    if (window.pov3dEngine) {
      window.pov3dEngine.hasAnnouncedArrival = true;
    }

    if (window.queuedArrivalTimer) {
      clearTimeout(window.queuedArrivalTimer);
      window.queuedArrivalTimer = null;
      window.arrivalSpeechQueueTimer = null;
    }

    // Varış anında tekil bildirim kartı gösterilmesi için ikinci iç ses altyazı kutusunu gizle
    document.getElementById('live-voice-subtitle-bar')?.classList.add('hidden');

    const now = performance.now();
    const busyRemaining = Math.max(0, (window.speechMainBusyUntil || 0) - now);
    const isBusy = isSpeechEngineCurrentlyBusy();

    if (!isBusy) {
      window.wasArrivalSpeechQueued = false;
      window.queuedArrivalDelayMs = 0;
      if (isVoiceEnabled && typeof window.speakNavigationText === 'function') {
        window.speakNavigationText(arrMsg, false, false, true);
      }
      return;
    }

    // Önceki yönlendirme cümlesi hala okunuyorsa KESME;
    // speechSynthesis.speaking veya window.speechMainBusyUntil bitene kadar + 450ms kuyrukta beklet!
    const queueWaitMs = Math.max(450, Math.min(4000, Math.round(busyRemaining + 450)));
    window.wasArrivalSpeechQueued = true;
    window.queuedArrivalDelayMs = queueWaitMs;

    let pollCount = 0;
    const checkAndSpeak = () => {
      pollCount++;
      const stillSpeaking = (
        Boolean('speechSynthesis' in window && window.speechSynthesis && window.speechSynthesis.speaking) ||
        (performance.now() < (window.speechMainBusyUntil || 0))
      ) && pollCount < 2;
      if (stillSpeaking) {
        window.queuedArrivalTimer = setTimeout(checkAndSpeak, 450);
        window.arrivalSpeechQueueTimer = window.queuedArrivalTimer;
        return;
      }
      window.queuedArrivalTimer = null;
      window.arrivalSpeechQueueTimer = null;
      document.getElementById('live-voice-subtitle-bar')?.classList.add('hidden');
      if (isVoiceEnabled && typeof window.speakNavigationText === 'function') {
        window.speakNavigationText(arrMsg, false, false, true);
      }
    };

    window.queuedArrivalTimer = setTimeout(checkAndSpeak, queueWaitMs);
    window.arrivalSpeechQueueTimer = window.queuedArrivalTimer;
  }
  window.queueArrivalAnnouncement = queueArrivalAnnouncement;

  function speakNavigationText(text, force = false, isStoreCue = false, isArrival = false) {
    if (!text) return;

    if (isArrival) {
      document.getElementById('live-voice-subtitle-bar')?.classList.add('hidden');
    } else {
      updateVoiceSubtitleUI(text, true);
    }
    if (!isVoiceEnabled && !force) return;
    window.lastSpokenNavigationText = stripUiEmojis(String(text));
    const isEn = (currentLanguage === 'en' || window.currentLanguage === 'en');
    const targetLang = isEn ? 'en-US' : 'tr-TR';
    window.lastVoiceLanguage = targetLang;

    const spokenText = isEn ? stripUiEmojis(String(text)) : toTurkishPhoneticSpeech(text);
    window.lastSpokenPhoneticText = spokenText;
    const now = performance.now();
    const spd = (window.pov3dEngine && window.pov3dEngine.walkSpeed) || currentSimSpeed || 1.0;
    const baseRate = spd >= 3.5 ? 1.55 : (spd >= 1.8 ? 1.32 : 1.15);
    const rate = isStoreCue ? Math.min(1.65, baseRate * 1.08) : baseRate;

    // Kelime sayısına göre başlangıç tahmini konuşma süresi (ms)
    const wordCount = Math.max(1, spokenText.trim().split(/\s+/).length);
    const estMs = Math.round((wordCount * 380) / rate);

    const mainStillSpeaking = now < (window.speechMainBusyUntil || 0);
    if (isStoreCue && mainStillSpeaking) {
      return;
    }

    if (!isStoreCue) {
      window.speechMainBusyUntil = now + estMs;
      window.speechBusyUntil = now + estMs;
    } else {
      window.speechBusyUntil = Math.max(window.speechBusyUntil || 0, now + estMs);
    }

    try {
      if (window.activeTtsAudio) {
        try {
          window.activeTtsAudio.pause();
        } catch (e) {}
      }

      const voices = ('speechSynthesis' in window && window.speechSynthesis)
        ? window.speechSynthesis.getVoices()
        : [];
      const nativeTrVoice = voices.find(v => v.lang && v.lang.toLowerCase().startsWith('tr'));
      const nativeEnVoice = voices.find(v => v.lang && v.lang.toLowerCase().startsWith('en'));

      if ('speechSynthesis' in window && window.speechSynthesis) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(spokenText);
        utterance.lang = targetLang;
        if (isEn && nativeEnVoice) {
          utterance.voice = nativeEnVoice;
        } else if (!isEn && nativeTrVoice) {
          utterance.voice = nativeTrVoice;
        }
        utterance.rate = rate;
        utterance.pitch = 1.0;
        utterance.onend = () => {
          window.speechBusyUntil = 0;
          if (!isStoreCue) window.speechMainBusyUntil = 0;
          if (!isArrival && !window.hasAnnouncedArrival) {
            updateVoiceSubtitleUI(window.lastSpokenNavigationText, false);
          }
        };
        utterance.onerror = () => {
          window.speechBusyUntil = 0;
          if (!isStoreCue) window.speechMainBusyUntil = 0;
          if (!isArrival && !window.hasAnnouncedArrival) {
            updateVoiceSubtitleUI(window.lastSpokenNavigationText, false);
          }
        };
        window.lastSpeechUtterance = utterance;
        window.speechSynthesis.speak(utterance);
      }
    } catch (e) {
      // Headless / kısıtlı tarayıcı ortamlarında sessizce geç
    }
  }
  window.speakNavigationText = speakNavigationText;

  function toggleVoiceNavigation() {
    isVoiceEnabled = !isVoiceEnabled;
    window.isVoiceEnabled = isVoiceEnabled;
    const btn = document.getElementById('btn-voice-toggle');
    const iconEl = document.getElementById('voice-toggle-icon');
    const labelEl = document.getElementById('voice-toggle-label');
    const isEn = currentLanguage === 'en';

    if (isVoiceEnabled) {
      if (btn) {
        btn.className = 'shrink-0 h-8 px-2.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30 text-[11px] font-extrabold flex items-center gap-1 transition-all active:scale-95 cursor-pointer';
      }
      if (iconEl) iconEl.innerHTML = getMonoIconSvg('volume2', 14);
      if (labelEl) labelEl.textContent = isEn ? 'Voice On' : 'Sesli Açık';
      showToast(isEn ? 'Step-by-step voice navigation enabled' : 'Sesli adım adım yönlendirme açıldı', 'success');

      // Mevcut adımı hemen seslendir
      if (lastCalculatedRoute && lastCalculatedRoute.instructions && lastCalculatedRoute.instructions.length > 0 && !window.hasAnnouncedArrival) {
        const curIdx = cartSimulator ? cartSimulator.currentIndex : 0;
        let currentIns = lastCalculatedRoute.instructions[0];
        for (const ins of lastCalculatedRoute.instructions) {
          if (ins.nodeIndex !== undefined && curIdx >= ins.nodeIndex) {
            currentIns = ins;
          }
        }
        lastSpokenStepIndex = currentIns.step;
        speakNavigationText(currentIns.voiceText || currentIns.text, true);
      }
    } else {
      if (btn) {
        btn.className = 'shrink-0 h-8 px-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 text-[11px] font-extrabold flex items-center gap-1 transition-all active:scale-95 cursor-pointer';
      }
      if (iconEl) iconEl.innerHTML = getMonoIconSvg('volumeX', 14);
      if (labelEl) labelEl.textContent = isEn ? 'Muted' : 'Sessiz';
      if (window.queuedArrivalTimer) {
        clearTimeout(window.queuedArrivalTimer);
        window.queuedArrivalTimer = null;
      }
      try {
        if (window.activeTtsAudio) {
          window.activeTtsAudio.pause();
        }
        if ('speechSynthesis' in window && window.speechSynthesis) {
          window.speechSynthesis.cancel();
        }
      } catch (e) {}
      window.speechBusyUntil = 0;
      window.speechMainBusyUntil = 0;
      showToast(isEn ? 'Voice navigation muted' : 'Sesli yönlendirme kapatıldı', 'info');
    }
  }
  window.toggleVoiceNavigation = toggleVoiceNavigation;

  /**
   * Canlı Turn-by-Turn Adım Banner'ı (Adım Adım Yönlendirme HUD)
   * @param {number} nodeIndex - Mevcut düğüm indeksi (-1 ise varış)
   * @param {number} progressPct - İlerleme yüzdesi 0..100
   */
  function ensureArrivalActionBar() {
    const banner = document.getElementById('header-live-nav-banner');
    if (!banner) return null;
    let bar = document.getElementById('arrival-action-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'arrival-action-bar';
      bar.className = 'hidden flex items-center gap-1.5 pt-1';
      bar.innerHTML = `
        <button type="button" id="btn-arrival-new-route" class="flex-1 py-1.5 px-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-[11px] font-extrabold flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer">
          ${getMonoIconSvg('navigation', 14)}
          <span>Buradan Yeni Rota Seç</span>
        </button>
        <button type="button" id="btn-arrival-reset-all" class="py-1.5 px-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-700 dark:text-rose-300 border border-rose-500/30 text-[11px] font-extrabold flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer shrink-0">
          ${getMonoIconSvg('refresh', 14)}
          <span>Konumu Sıfırla</span>
        </button>
      `;
      banner.appendChild(bar);

      bar.querySelector('#btn-arrival-new-route')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const newStart = window.lastReachedStore || selectedTargetStore || selectedStartStore;
        if (newStart && !window.isKioskMode) {
          selectedStartStore = newStart;
          mallMap.activeStartStore = newStart;
          updateStartBadgeUI(newStart.name);
        }
        selectedTargetStore = null;
        mallMap.activeTargetStore = null;
        const targetInput = document.getElementById('input-target-loc');
        if (targetInput) targetInput.value = '';
        document.getElementById('btn-clear-target')?.classList.add('hidden');
        mallMap.updateActiveStorePolygons();

        document.body.classList.remove('has-active-route');
        const hudBar = document.getElementById('nav-hud-bar');
        if (hudBar) {
          hudBar.classList.remove('is-active');
          hudBar.classList.add('translate-y-full', 'opacity-0', 'pointer-events-none');
        }
        updateFloatingToggleVisibility();
        setActiveFocusSlot('target');
        if (isMobileOrLandscape()) {
          expandBottomSheet();
        }
        setTimeout(() => {
          document.getElementById('input-target-loc')?.focus();
        }, 120);
        showToast(`Başlangıç noktanız ${newStart ? newStart.name : 'güncellendi'}. Şimdi yeni hedef mağazanızı seçebilirsiniz.`, 'info');
      });

      bar.querySelector('#btn-arrival-reset-all')?.addEventListener('click', (e) => {
        e.stopPropagation();
        clearCurrentRoute();
        showToast('Konumunuz ve rotanız sıfırlandı.', 'info');
      });
    }
    return bar;
  }

  function updateLiveNavHUD(nodeIndex, progressPct = 0) {
    const banner = document.getElementById('header-live-nav-banner');
    const iconEl = document.getElementById('live-nav-icon');
    const textEl = document.getElementById('live-nav-text');
    const subEl = document.getElementById('live-nav-sub');
    const landmarksWrap = document.getElementById('live-nav-landmarks');
    const landmarksText = document.getElementById('live-nav-landmarks-text');
    if (!banner || !iconEl || !textEl || !subEl) return;

    if (!lastCalculatedRoute || !lastCalculatedRoute.instructions || !lastCalculatedRoute.instructions.length) {
      banner.classList.add('hidden');
      return;
    }

    const arrivalBar = ensureArrivalActionBar();
    const isEn = (currentLanguage === 'en' || window.currentLanguage === 'en');

    // 1. Hedefe Ulaşıldı Durumu (Tekil minimalist varış kartı, donatı metin kontrolü ve mükerrer anons koruması)
    if (nodeIndex === -1 || progressPct >= 100) {
      // Çakışan orta modal, toast ve ekstra altyazı kutularını tamamen gizle
      document.getElementById('live-voice-subtitle-bar')?.classList.add('hidden');
      document.getElementById('floor-transition-overlay')?.classList.add('hidden');
      document.getElementById('route-mode-choice-modal')?.classList.add('hidden');
      if (typeof hideToast === 'function') {
        hideToast();
      }

      banner.classList.remove('hidden');
      iconEl.innerHTML = getMonoIconSvg('check', 16);

      const targetObj = selectedTargetStore || window.lastReachedStore || null;
      const isAmenity = isServiceOrAmenityItem(targetObj);
      const destName = stripUiEmojis((targetObj && (targetObj.name || targetObj.short_name)) || (isEn ? 'Destination' : 'Hedef Nokta'));

      let arrMsg = '';
      if (isAmenity) {
        // Donatı / Hizmet noktası için: ASLA 'mağazası önündesiniz' ve 'Keyifli alışverişler dileriz' deme!
        const amEn = (navEngine && typeof navEngine._getAmenityLabelEn === 'function')
          ? navEngine._getAmenityLabelEn(destName)
          : destName;
        arrMsg = isEn ? `You have arrived at ${amEn}.` : `${destName} noktasındasınız.`;
        textEl.textContent = arrMsg;
        subEl.textContent = isEn
          ? 'Select a new destination or reset location'
          : 'Yeni hedef seçebilir veya konumu sıfırlayabilirsiniz';
      } else {
        arrMsg = isEn
          ? `You have arrived at ${destName}.`
          : `Hedefe ulaştınız! ${destName} mağazası önündesiniz. Keyifli alışverişler dileriz.`;
        textEl.textContent = isEn ? `You have arrived at ${destName}.` : `${destName} önündesiniz.`;
        subEl.textContent = isEn
          ? 'Enjoy your shopping • Select a new destination or reset'
          : 'Keyifli alışverişler dileriz • Yeni hedef seçebilirsiniz';
      }

      landmarksWrap?.classList.add('hidden');
      arrivalBar?.classList.remove('hidden');

      if (!window.hasAnnouncedArrival && lastSpokenStepIndex !== -1) {
        lastSpokenStepIndex = -1;
        queueArrivalAnnouncement(arrMsg);
      }
      return;
    }

    arrivalBar?.classList.add('hidden');
    banner.classList.remove('hidden');

    const instructions = lastCalculatedRoute.instructions;

    // 2. Mevcut düğüme karşılık gelen manevra adımını bul
    let activeIns = instructions[0];
    let nextIns = instructions[1] || null;

    for (let i = 0; i < instructions.length; i++) {
      const ins = instructions[i];
      if (ins.nodeIndex !== undefined && nodeIndex >= ins.nodeIndex) {
        activeIns = ins;
        nextIns = instructions[i + 1] || null;
      }
    }

    // 3. İkon ve Metinleri Güncelle (Monochrome Inline SVG)
    let iconSvg = getMonoIconSvg('arrowUp', 16);
    if (activeIns.type === 'turn_right') iconSvg = getMonoIconSvg('cornerUpRight', 16);
    else if (activeIns.type === 'turn_left') iconSvg = getMonoIconSvg('cornerUpLeft', 16);
    else if (activeIns.type === 'floor_change') iconSvg = getMonoIconSvg('layers', 16);
    else if (activeIns.type === 'destination') iconSvg = getMonoIconSvg('pin', 16);
    iconEl.innerHTML = iconSvg;
    textEl.textContent = stripUiEmojis(activeIns.text);

    // 4. Yanından Geçilecek Mağazalar (Referans Noktaları) Rozeti
    if (landmarksWrap && landmarksText) {
      const stepStores = (activeIns.passingStores && activeIns.passingStores.length > 0)
        ? activeIns.passingStores
        : (lastCalculatedRoute.enRouteStoreNames || []).slice(0, 3);
      if (stepStores.length > 0) {
        landmarksText.textContent = stepStores.join(' • ');
        landmarksWrap.classList.remove('hidden');
      } else {
        landmarksWrap.classList.add('hidden');
      }
    }

    // 5. Sesli Yönlendirme & Canlı Altyazı (Adım Değiştiğinde)
    updateVoiceSubtitleUI(activeIns.voiceText || activeIns.text, isVoiceEnabled);
    if (isVoiceEnabled && activeIns.step !== lastSpokenStepIndex) {
      lastSpokenStepIndex = activeIns.step;
      speakNavigationText(activeIns.voiceText || activeIns.text);
    }

    // 6. Alt Bilgi: Bir sonraki manevra veya kalan ilerleme
    if (nextIns) {
      subEl.textContent = isEn
        ? `Next: ${stripUiEmojis(nextIns.text)}`
        : `Sonraki: ${stripUiEmojis(nextIns.text)}`;
    } else {
      subEl.textContent = isEn
        ? `Proceeding to destination (${Math.round(progressPct)}%)`
        : `Hedefe doğru ilerliyorsunuz (%${Math.round(progressPct)})`;
    }
  }
  window.updateLiveNavHUD = updateLiveNavHUD;
  window.resetVoiceStepTracker = () => {
    lastSpokenStepIndex = -999;
    window.hasAnnouncedArrival = false;
    if (window.pov3dEngine) {
      window.pov3dEngine.hasAnnouncedArrival = false;
    }
    if (window.queuedArrivalTimer) {
      clearTimeout(window.queuedArrivalTimer);
      window.queuedArrivalTimer = null;
      window.arrivalSpeechQueueTimer = null;
    }
  };

  // Tamamlanan Rotayı Haritada Mat Gri-Mavi (opacity: 0.5, .route-completed) Olarak Bırakan Yardımcı Fonksiyon
  function markRouteAsCompletedOnMap() {
    window.isRouteCompletedState = true;
    document.querySelectorAll('.marker-name-pinned').forEach(el => el.remove());
    if (!mallMap || !mallMap.routeSvg) return;
    mallMap.routeSvg.classList.add('route-completed');
    mallMap.routeSvg.querySelectorAll('.route-group, path').forEach(el => {
      el.classList.add('route-completed');
    });
    const routeGroup = mallMap.routeSvg.querySelector('.route-group');
    if (routeGroup) {
      routeGroup.style.transition = 'none';
      routeGroup.style.opacity = '0.5';
    }
  }
  window.markRouteAsCompletedOnMap = markRouteAsCompletedOnMap;

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
      // Canlı Turn-by-Turn Adım Banner Güncellemesi
      if (cartSimulator) {
        updateLiveNavHUD(cartSimulator.currentIndex, pct);
      }
    },
    (newFloor) => {
      currentFloor = newFloor;
      updateFloorUI(newFloor);
    },
    () => {
      // 1. Çakışan orta toast/modal kutusunu gösterme; yalnızca tekil üst varış kartını (updateLiveNavHUD) güncelle!
      hideToast();
      resetSimControls();

      // 3B Gözümden Motorunu da varış durumuna senkronize et
      if (window.pov3dEngine) {
        window.pov3dEngine.isWalking = false;
        window.pov3dEngine.totalProgressPct = 100;
        window.pov3dEngine.remainingMeters = 0;
        window.pov3dEngine._syncPlayPauseButton();
        window.pov3dEngine._updateHUDTexts();
      }

      // Az önce varılan hedef mağazayı sakla
      const reachedStore = selectedTargetStore;
      if (reachedStore && typeof reachedStore === 'object') {
        window.lastReachedStore = reachedStore;
      }

      // Canlı HUD bildirimini tekil varış kartı olarak güncelle (aktif konuşma varsa kesmeden kuyruğa alır)
      updateLiveNavHUD(-1, 100);

      // Rota çizgisini silmeden 'route-completed' sınıfıyla mat gri-mavi (opacity: 0.5) olarak haritada bırak
      markRouteAsCompletedOnMap();

      // Hedefe varan "Alışveriş Torbası" ikonunu gizle ve simülasyonu durdur
      if (cartSimulator) {
        if (cartSimulator.cartEl) {
          cartSimulator.cartEl.classList.add('hidden');
        }
        cartSimulator.stop();
      }

      // Kısa bir varış kutlaması ardından 2B Haritaya dön, arama barını aç ve rotayı 'route-completed' olarak ekranda tut
      if (window.arrivalResetTimer) clearTimeout(window.arrivalResetTimer);
      const extraSpeechDelay = window.wasArrivalSpeechQueued ? Math.min(1500, window.queuedArrivalDelayMs || 500) : 0;
      window.arrivalResetTimer = setTimeout(() => {
        if (typeof window.completeAndResetRouteTo2D === 'function') {
          window.completeAndResetRouteTo2D(reachedStore);
        }
      }, 1500 + extraSpeechDelay);
    }
  );
  window.cartSimulator = cartSimulator;

  // Hedefe Varıldığında Rota Çizgisini Haritada ('route-completed', opacity: 0.5) Bırakarak
  // Yeni Rota Seçimine ve Konum Sıfırlamaya İzin Veren Merkezi Fonksiyon
  window.completeAndResetRouteTo2D = (reachedStore) => {
    if (window.arrivalResetTimer) {
      clearTimeout(window.arrivalResetTimer);
      window.arrivalResetTimer = null;
    }
    const storeObj = (reachedStore && typeof reachedStore === 'object') ? reachedStore : (selectedTargetStore || window.lastReachedStore);
    if (storeObj) {
      window.lastReachedStore = storeObj;
    }
    const targetFloor = storeObj?.floor || mallMap?.currentFloor || currentFloor;

    // 1. 3B Gözümden veya 3B Maket modundaysak 2B Haritaya (Plan) geri dön
    if (typeof window.setMapViewMode === 'function') {
      window.setMapViewMode('2d');
    }

    // 2. Simülatörü ve canlı GPS yürüyüşünü durdur, ancak ROTA ÇİZGİSİNİ HARİTADAN SİLME (.route-completed olarak bırak)
    if (cartSimulator) {
      if (cartSimulator.cartEl) {
        cartSimulator.cartEl.classList.add('hidden');
      }
      cartSimulator.stop();
    }
    if (typeof stopLiveGpsRouteWalk === 'function') {
      stopLiveGpsRouteWalk();
    }
    if (typeof closePoiDetail === 'function') {
      closePoiDetail();
    }

    // 3. 3B POV motorunun yürüyüşünü durdur
    if (window.pov3dEngine) {
      window.pov3dEngine.isWalking = false;
      window.pov3dEngine.totalProgressPct = 100;
    }

    // 4. KRİTİK: Kullanıcının yeni rotaya hemen geçebilmesi için:
    // - Alt HUD barı gizle ve 'has-active-route' kilidini kaldır ki mobilde alt arama çekmecesi (58px bar) geri gelsin!
    // - Varılan mağazayı yeni başlangıç noktası (selectedStartStore) olarak ata ve hedefi boşalt ki yeni mağaza seçildiğinde anında yeni rota çizilsin!
    document.body.classList.remove('has-active-route');
    const hudBar = document.getElementById('nav-hud-bar');
    if (hudBar) {
      hudBar.classList.remove('is-active');
      hudBar.classList.add('translate-y-full', 'opacity-0', 'pointer-events-none');
    }
    document.getElementById('hud-steps-drawer')?.classList.add('hidden');

    if (storeObj && !window.isKioskMode) {
      selectedStartStore = storeObj;
      mallMap.activeStartStore = storeObj;
      updateStartBadgeUI(storeObj.name);
    }
    selectedTargetStore = null;
    mallMap.activeTargetStore = null;
    const targetInput = document.getElementById('input-target-loc');
    if (targetInput) targetInput.value = '';
    document.getElementById('btn-clear-target')?.classList.add('hidden');
    setActiveFocusSlot('target');
    updateFloatingToggleVisibility();

    // 5. Varılan katın 2B haritasını göster ve rota çizgisini 'route-completed' (mat gri-mavi, opacity: 0.5) olarak koru
    const applyCompletedRouteState = () => {
      if (mallMap && lastCalculatedRoute) {
        if (!mallMap.routeSvg?.querySelector('.route-group')) {
          mallMap.renderRoute(lastCalculatedRoute);
        }
        markRouteAsCompletedOnMap();
        mallMap.updateActiveStorePolygons();
      }
      if (typeof updateHeaderResetButtonVisibility === 'function') {
        updateHeaderResetButtonVisibility();
      }
    };

    applyCompletedRouteState();

    if (mallMap && targetFloor) {
      currentFloor = targetFloor;
      updateFloorUI(targetFloor);
      if (mallMap.currentFloor !== targetFloor) {
        mallMap.loadFloor(targetFloor).then(() => {
          applyCompletedRouteState();
          if (typeof mallMap.resetView === 'function') mallMap.resetView();
        });
      } else {
        if (typeof mallMap.resetView === 'function') mallMap.resetView();
      }
    }
  };

  // 3B Sokak Görünümü İçinden Tıklanan Bir Mağazaya Anında Rota Çizip 3B Yürüyüş Başlatan Fonksiyon
  window.startRouteFromCurrentPovToStore = (targetStore) => {
    if (!targetStore || !window.pov3dEngine) return;
    const eng = window.pov3dEngine;
    const curFl = eng.currentFloor || currentFloor || 4;
    const floorStores = (mallData?.floors[curFl]?.stores || []).filter(s => s.nav_node && s.id !== targetStore.id);
    let nearestStart = selectedStartStore;
    if (!nearestStart || nearestStart.id === targetStore.id || nearestStart.floor !== curFl) {
      let bestDist = Infinity;
      for (const s of floorStores) {
        const d = Math.hypot((s.cx || 700) - eng.camX, (s.cy || 425) - eng.camY);
        if (d < bestDist) {
          bestDist = d;
          nearestStart = s;
        }
      }
      if (!nearestStart && mallData?.entrances?.length) {
        nearestStart = mallData.entrances[0];
      }
    }
    if (!nearestStart) return;

    selectedStartStore = nearestStart;
    updateStartBadgeUI(nearestStart.name);
    selectedTargetStore = targetStore;
    const targetInput = document.getElementById('input-target-loc');
    if (targetInput) targetInput.value = targetStore.name;
    document.getElementById('btn-clear-target')?.classList.remove('hidden');

    calculateAndDisplayRoute();
    document.getElementById('route-mode-choice-modal')?.classList.add('hidden');
    window.setMapViewMode('pov');
  };

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
  setupVoiceCommandEvents();
  setupGpsAutoLocationEvents();
  setupEventsCalendarEvents();
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
  const isEn = (currentLanguage === 'en' || window.currentLanguage === 'en');
  const flInfo = mallData?.floors[targetStore.floor];
  let floorLabel = flInfo ? flInfo.label : (targetStore.floor + '. Kat');
  if (isEn && navEngine && typeof navEngine._getFloorLabelEn === 'function') {
    floorLabel = navEngine._getFloorLabelEn(targetStore.floor);
  }
  const cleanTargetName = stripUiEmojis(targetStore.name);
  const timeSuffix = isEn ? 'min' : 'dk';
  titleEl.textContent = `${cleanTargetName} • ${floorLabel}`;
  subEl.textContent = `${routeResult.totalDistance} m • ~${routeResult.estimatedMinutes} ${timeSuffix}`;
}
window.updateHeaderNavSummary = updateHeaderNavSummary;

function renderHudStepsList(result, targetStore) {
  const sidebarStepsList = document.getElementById('sidebar-route-steps-list');
  const sidebarStepsCount = document.getElementById('sidebar-steps-count');
  const hudStepsList = document.getElementById('hud-steps-list');
  const hudStepsCount = document.getElementById('hud-steps-count');

  if (!result || !result.instructions) return;
  const isEn = (currentLanguage === 'en' || window.currentLanguage === 'en');
  const countText = `${result.instructions.length} ${isEn ? 'Steps' : 'Adım'}`;
  if (sidebarStepsCount) sidebarStepsCount.textContent = countText;
  if (hudStepsCount) hudStepsCount.textContent = countText;

  const pmrHeaderHtml = activeRouteMode === 'elevator'
    ? `<div class="p-2 rounded-xl bg-sky-500/12 border border-sky-500/35 text-sky-800 dark:text-sky-200 text-[10.5px] font-bold flex items-center gap-1.5">
         ${getMonoIconSvg('info', 14)}
         <span>${isEn ? 'Accessible Route for Reduced Mobility (Wide Corridors + Elevators)' : 'Hareket Kabiliyeti Kısıtlı Kişiler İçin Uyarlanmış Engelsiz Güzergah (Geniş Koridor + Panoramik Asansör)'}</span>
       </div>`
    : '';

  const storeObj = targetStore || selectedTargetStore;
  let storeServiceGuideHtml = '';
  if (storeObj) {
    const targetCat = storeObj.category_name || storeObj.category || (isEn ? 'Service Point' : 'Hizmet Noktası');
    const targetFloorName = isEn && navEngine && typeof navEngine._getFloorLabelEn === 'function'
      ? navEngine._getFloorLabelEn(storeObj.floor)
      : (mallData?.floors[storeObj.floor]?.label || (storeObj.floor + '. Kat'));
    const openStatus = isEn ? 'Open (10:00-22:00)' : 'Açık (10:00-22:00)';
    const timeSuffix = isEn ? 'min' : 'dk';
    storeServiceGuideHtml = `
      <div class="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/25 text-slate-800 dark:text-slate-100 text-[10.5px] flex items-center justify-between gap-2">
        <div class="min-w-0">
          <div class="font-extrabold truncate flex items-center gap-1">${getMonoIconSvg('navigation', 13)}<span>${stripUiEmojis(storeObj.name)}</span></div>
          <div class="text-[9.5px] text-slate-500 dark:text-slate-400 truncate">${targetFloorName} • ${targetCat} • ${openStatus}</div>
        </div>
        <span class="px-2 py-0.5 rounded-md bg-indigo-600 text-white text-[9.5px] font-black shrink-0">${Math.round(result.totalDistance)}m • ~${result.estimatedMinutes || Math.max(1, Math.ceil(result.totalDistance / 60))}${timeSuffix}</span>
      </div>
    `;
  }

  const stepsHtml = pmrHeaderHtml + storeServiceGuideHtml + result.instructions.map(ins => {
    const passingHtml = (ins.passingStores && ins.passingStores.length > 0)
      ? `<div class="mt-0.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[9px] font-bold"><span>${ins.passingStores.join(' ➔ ')}</span></div>`
      : '';
    const flLabel = isEn && navEngine && typeof navEngine._getFloorLabelEn === 'function'
      ? navEngine._getFloorLabelEn(ins.floor)
      : (mallData?.floors[ins.floor]?.label || ins.floor + '. Kat');
    return `
      <div class="flex items-start gap-2 p-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
        <span class="w-5 h-5 rounded-full bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center font-bold text-[9px] shrink-0 mt-0.5">${ins.step}</span>
        <div>
          <div class="font-bold text-slate-800 dark:text-slate-200">${ins.text}</div>
          ${passingHtml}
          <div class="text-[10px] text-slate-400">${flLabel}</div>
        </div>
      </div>
    `;
  }).join('');

  if (sidebarStepsList) sidebarStepsList.innerHTML = stepsHtml;
  if (hudStepsList) hudStepsList.innerHTML = stepsHtml;
}
window.renderHudStepsList = renderHudStepsList;

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
  if (typeof window.syncSavedParkingOnSvgMap === 'function') {
    setTimeout(() => window.syncSavedParkingOnSvgMap(), 60);
    setTimeout(() => window.syncSavedParkingOnSvgMap(), 260);
  }
}

// 3. UI Dinleyicileri
function setupUIEventListeners() {
  // Kat Seçici Butonları
  document.querySelectorAll('.floor-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      const fl = parseInt(btn.getAttribute('data-floor'), 10);
      mallMap.loadFloor(fl).then(() => {
        if (window.isRouteCompletedState && typeof window.markRouteAsCompletedOnMap === 'function') {
          window.markRouteAsCompletedOnMap();
        }
        if (typeof window.syncSavedParkingOnSvgMap === 'function') {
          window.syncSavedParkingOnSvgMap();
        }
      });
      updateFloorUI(fl);
      if (window.pov3dEngine && window.pov3dEngine.isActive && typeof window.pov3dEngine.switchFloorInFreeRoam === 'function') {
        window.pov3dEngine.switchFloorInFreeRoam(fl);
      }
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

      activeCategory = pill.getAttribute('data-category') || 'all';

      // Açık olan mağaza detay kartını ve alt önizleme kartını kapat, arama filtresini ve servis vurgusunu temizle ki kategori mağazaları anında listelensin
      searchQuery = '';
      document.getElementById('search-autocomplete-list')?.classList.add('hidden');
      if (typeof closePoiDetail === 'function') {
        closePoiDetail();
      }
      if (typeof closePoiPeekCard === 'function') {
        closePoiPeekCard();
      }
      if (typeof clearAmenityHighlightOnMap === 'function' && mallMap?.activeAmenityHighlight) {
        clearAmenityHighlightOnMap();
      }

      // Eğer seçilen kategoride bu katta mağaza yoksa, mağazaların bulunduğu kata otomatik geç
      const currentFloorStores = (mallData?.floors[currentFloor]?.stores || []).filter(s => storeMatchesCategory(s, activeCategory));
      if (activeCategory !== 'all' && currentFloorStores.length === 0) {
        let bestFloor = null;
        let maxCount = 0;
        for (let fl = 1; fl <= 6; fl++) {
          const count = (mallData?.floors[fl]?.stores || []).filter(s => storeMatchesCategory(s, activeCategory)).length;
          if (count > maxCount) {
            maxCount = count;
            bestFloor = fl;
          }
        }
        if (bestFloor) {
          mallMap.loadFloor(bestFloor).then(() => {
            updateFloorUI(bestFloor);
            mallMap.setCategoryFilter(activeCategory);
            if (!mallMap.activeRoute) mallMap.resetView();
            renderSidebarStoreGrid();
          });
        } else {
          mallMap.setCategoryFilter(activeCategory);
          if (!mallMap.activeRoute) mallMap.resetView();
          renderSidebarStoreGrid();
        }
      } else {
        mallMap.setCategoryFilter(activeCategory);
        if (!mallMap.activeRoute) mallMap.resetView();
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

  // 2.5B / 3B Mimari Perspektif Görünümü Butonu (#btn-3d-toggle)
  document.getElementById('btn-3d-toggle')?.addEventListener('click', () => {
    if (!mallMap) return;
    const is3D = mallMap.toggle3DMode();
    if (window.setMapViewMode) {
      window.setMapViewMode(is3D ? '3d' : '2d');
    }
    showToast(
      is3D
        ? '🧊 3B Mimari Perspektif Görünümü Açıldı'
        : '🗺️ 2B Kuşbakışı Harita Görünümüne Dönüldü',
      'info'
    );
  });

  // 👁️ [Gözümden 3B | 3B Maket | 2B Plan] Görünüm Modu Seçici Butonları
  document.querySelectorAll('.view-mode-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const mode = btn.getAttribute('data-view-mode') || '2d';
      if (window.setMapViewMode) {
        window.setMapViewMode(mode);
      }
    });
  });

  // Üst Başlık [👁️ Gözümden 3B / 🗺️ 2B Harita] Geçiş Çipi
  document.getElementById('btn-header-pov-toggle')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const isCurrentlyPov = window.pov3dEngine && window.pov3dEngine.isActive;
    if (window.setMapViewMode) {
      window.setMapViewMode(isCurrentlyPov ? '2d' : 'pov');
    }
  });

  // 3B Gözümden İçinden [🗺️ 2B Plan] Çıkış Butonu
  document.getElementById('btn-pov-exit-2d')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (window.setMapViewMode) {
      window.setMapViewMode('2d');
    }
  });

  // Sesli Adım Adım Yönlendirme Butonu (#btn-voice-toggle)
  document.getElementById('btn-voice-toggle')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (window.toggleVoiceNavigation) {
      window.toggleVoiceNavigation();
    }
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

  // Sidebar İçi Birleşik Rota Kontrolleri (#sidebar-route-detail)
  document.getElementById('btn-sidebar-route-finish')?.addEventListener('click', () => {
    clearCurrentRoute();
  });

  document.getElementById('btn-route-sim-play')?.addEventListener('click', () => {
    toggleCartSimulation();
  });

  document.getElementById('btn-route-pov-toggle')?.addEventListener('click', () => {
    if (typeof window.setMapViewMode === 'function') {
      const targetMode = (window.currentViewMode === 'pov' || (window.pov3dEngine && window.pov3dEngine.isActive)) ? '2d' : 'pov';
      window.setMapViewMode(targetMode);
    }
  });

  document.getElementById('btn-route-speed-toggle')?.addEventListener('click', () => {
    cycleSimSpeed();
  });

  document.getElementById('btn-sidebar-route-qr')?.addEventListener('click', () => {
    if (typeof showPhoneTransferModal === 'function') {
      showPhoneTransferModal();
    }
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
    document.getElementById('route-mode-choice-modal')?.classList.add('hidden');
    if (window.activeTravelNavigationMode === 'gps') {
      setTravelNavigationMode('sim');
      return;
    }
    toggleCartSimulation();
  });

  document.getElementById('btn-hud-sim-play')?.addEventListener('click', () => {
    document.getElementById('route-mode-choice-modal')?.classList.add('hidden');
    if (window.activeTravelNavigationMode === 'gps') {
      setTravelNavigationMode('sim');
      return;
    }
    toggleCartSimulation();
  });

  // GPS Kullanımı İçin Seçim Modu (📍 Canlı Konumla Git vs. 🎬 Önizle / Simülasyon) UI Enjeksiyonu ve Olayları
  setupTravelModeSelectorUI();

  document.getElementById('btn-choose-mode-close')?.addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('route-mode-choice-modal')?.classList.add('hidden');
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

  // Başlangıç Konumu Seçim Butonları & 1-Tıkla "📍 Şu An Buradayım" Pinleme
  document.getElementById('input-start-loc')?.addEventListener('click', () => {
    if (window.isKioskMode) {
      showToast('Kiosk modundasınız. Başlangıç konumu Danışma / Kiosk olarak sabittir.', 'info');
      return;
    }
    openEntranceModal();
  });

  document.getElementById('btn-pin-here')?.addEventListener('click', () => {
    if (window.isKioskMode) {
      showToast('Kiosk modundasınız. Başlangıç konumu Danışma / Kiosk olarak sabittir.', 'info');
      return;
    }
    openEntranceModal();
  });

  document.getElementById('btn-header-pin-here')?.addEventListener('click', (e) => {
    e.stopPropagation();
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

  // 4 Hızlı Başlangıç Butonu (C Kapısı, B Kapısı, A Kapısı, Danışma - 1-Tıkla Anında Seçim)
  const quickStartMap = {
    'btn-quick-fisekhane': 'ent_fisekhane',
    'btn-quick-carousel': 'ent_carousel',
    'btn-quick-akapisi': 'ent_a_kapisi',
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
    const povBtn = e.target.closest('[data-action="pov3d"]');
    const callDanismaBtn = e.target.closest('[data-action="call-danisma"]');

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
    } else if (povBtn && activePoiStore) {
      if (typeof window.setMapViewMode === 'function') {
        window.setMapViewMode('pov');
      }
      if (window.pov3dEngine && typeof window.pov3dEngine.teleportInFrontOfStore === 'function') {
        window.pov3dEngine.teleportInFrontOfStore(activePoiStore);
      }
      if (isMobileOrLandscape()) {
        collapseBottomSheet();
      }
    } else if (callDanismaBtn) {
      window.location.href = 'tel:02125590000';
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
  searchQuery = '';

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
    if (mallMap.activeRoute || window.isRouteCompletedState || lastCalculatedRoute) {
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
      if (window.isRouteCompletedState || mallMap.activeRoute) {
        clearCurrentRoute();
      }
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
    if (mallMap.activeRoute || window.isRouteCompletedState || lastCalculatedRoute) {
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
  const currentFl = floor || (selectedStartStore && selectedStartStore.floor) || currentFloor || 4;

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
    const aName = normalizeTr(a.name || '');

    if (kind === 'wc') {
      return aType === 'wc' || aKind === 'wc' || aName.includes('wc') || aName.includes('tuvalet') || aName.includes('lavabo');
    }
    if (kind === 'baby') {
      return aType === 'baby' || aKind === 'baby' || aName.includes('bebek');
    }
    if (kind === 'elevator') {
      return aType === 'elevator' || aKind === 'elevator' || aName.includes('asansor');
    }
    if (kind === 'escalator') {
      return aType === 'escalator' || aKind === 'escalator' || aName.includes('yuruyen merdiven');
    }
    if (kind === 'emergency') {
      return aType === 'emergency' || aKind === 'emergency' || aName.includes('acil cikis') || aName.includes('yangin');
    }
    if (kind === 'kiosk') {
      return aType === 'kiosk' || aKind === 'kiosk' || aName.includes('kiosk');
    }
    if (kind === 'prayer') {
      return aType === 'prayer' || aKind === 'prayer' || aName.includes('mescit');
    }
    if (kind === 'atm') {
      return aType === 'atm' || aKind === 'atm' || aName.includes('atm') || aName.includes('bankamatik');
    }
    if (kind === 'info') {
      return aType === 'info' || aKind === 'info' || aName.includes('danisma');
    }
    if (kind === 'entrance') {
      return aType === 'entrance' || aKind === 'entrance' || aName.includes('giris');
    }
    if (kind === 'carpark') {
      return aType === 'carpark' || aKind === 'carpark' || aName.includes('otopark') || aName.includes('vale');
    }
    if (kind === 'wheelchair') {
      return aType === 'wheelchair' || aKind === 'wheelchair' || aName.includes('akulu') || aName.includes('sandalye') || aName.includes('engelli');
    }
    return aType === kind || aKind === kind || aName.includes(kind);
  });

  if (matches.length === 0) return null;

  const refX = (selectedStartStore && selectedStartStore.floor === currentFl) ? selectedStartStore.cx : 700;
  const refY = (selectedStartStore && selectedStartStore.floor === currentFl) ? selectedStartStore.cy : 425;

  // 1. Kullanıcının bulunduğu kattaki en yakın servis noktası (Öklid mesafesine göre)
  const sameFloorMatches = matches.filter(m => m.floor === currentFl);
  if (sameFloorMatches.length > 0) {
    sameFloorMatches.sort((a, b) => {
      const dA = Math.hypot((a.cx || 700) - refX, (a.cy || 425) - refY);
      const dB = Math.hypot((b.cx || 700) - refX, (b.cy || 425) - refY);
      return dA - dB;
    });
    return sameFloorMatches[0];
  }

  // 2. Kat farkı mutlak değeri en az olan en yakın kat
  matches.sort((a, b) => {
    const distA = Math.abs((a.floor || 4) - currentFl);
    const distB = Math.abs((b.floor || 4) - currentFl);
    if (distA !== distB) return distA - distB;
    const dA = Math.hypot((a.cx || 700) - refX, (a.cy || 425) - refY);
    const dB = Math.hypot((b.cx || 700) - refX, (b.cy || 425) - refY);
    return dA - dB;
  });

  return matches[0];
}
window.findNearestAmenity = findNearestAmenity;

const AMENITY_META_LABELS = {
  elevator: { icon: '', label: 'Asansör' },
  baby: { icon: '', label: 'Bebek Bakım Odası' },
  wc: { icon: '', label: 'Tuvalet', labelEn: 'Restroom' },
  emergency: { icon: '', label: 'Acil Çıkış' },
  exit: { icon: '', label: 'Acil Çıkış' },
  entrance: { icon: '', label: 'Giriş / Çıkış Kapısı' },
  kiosk: { icon: '', label: 'Kiosk & Danışma' },
  info: { icon: '', label: 'Danışma Noktası' },
  carpark: { icon: '', label: 'Otopark Girişi / Asansörü' },
  wheelchair: { icon: '', label: 'Engelsiz / Akülü Sandalye Noktası' },
  atm: { icon: '', label: 'ATM' },
  prayer: { icon: '', label: 'Mescit' }
};

function clearAmenityHighlightOnMap() {
  if (mallMap && typeof mallMap.setAmenityHighlight === 'function') {
    mallMap.setAmenityHighlight(null);
  }
  document.getElementById('amenity-highlight-banner')?.classList.add('hidden');
  document.querySelectorAll('.amenity-pill[data-amenity]').forEach(b => {
    b.classList.remove('ring-2', 'ring-sky-500', 'bg-sky-600', 'text-white');
  });
}
window.clearAmenityHighlightOnMap = clearAmenityHighlightOnMap;

function highlightAmenitiesOnMap(amenityKind, alsoRouteNearest = false) {
  if (!amenityKind || !mallMap) return;

  if (amenityKind === 'wheelchair') {
    setRoutePreference('elevator');
  }

  // Harita üzerinde tüm noktaları net görebilmek için 3B POV açıksa 2B haritaya geç
  if (window.currentViewMode === 'pov' && typeof window.setMapViewMode === 'function') {
    window.setMapViewMode('2d');
  }

  // Eğer bu katta hiç eşleşen servis yoksa (örn. Mescit B1'de, ATM Zemin'de), en yakın kata geç
  let matchesOnFloor = mallMap.getMatchingAmenitiesOnFloor(currentFloor, amenityKind);
  if (matchesOnFloor.length === 0) {
    const nearestAny = findNearestAmenity(amenityKind, currentFloor);
    if (nearestAny && nearestAny.floor && nearestAny.floor !== currentFloor) {
      currentFloor = nearestAny.floor;
      mallMap.loadFloor(currentFloor).then(() => {
        updateFloorUI(currentFloor);
        highlightAmenitiesOnMap(amenityKind, alsoRouteNearest);
      });
      return;
    }
  }

  const matchedList = mallMap.setAmenityHighlight(amenityKind);
  mallMap.resetView();

  // Aktif çip vurgusu
  document.querySelectorAll('.amenity-pill[data-amenity]').forEach(b => {
    const isMatch = b.getAttribute('data-amenity') === amenityKind;
    b.classList.toggle('ring-2', isMatch);
    b.classList.toggle('ring-sky-500', isMatch);
  });

  // Mobilde alt çekmeceyi kapat ki haritadaki tüm işaretli noktalar görünsün
  if (isMobileOrLandscape() && isBottomSheetExpanded) {
    collapseBottomSheet();
  }

  const meta = AMENITY_META_LABELS[amenityKind] || { icon: '📍', label: 'Hizmet Noktası' };
  const floorLabel = mallData?.floors[currentFloor]?.label || `${currentFloor}. Kat`;
  const banner = document.getElementById('amenity-highlight-banner');
  const iconEl = document.getElementById('amenity-banner-icon');
  const titleEl = document.getElementById('amenity-banner-title');
  const subEl = document.getElementById('amenity-banner-sub');

  if (banner && titleEl && subEl) {
    if (iconEl) iconEl.textContent = meta.icon;
    const count = matchedList.length;
    const namesStr = matchedList.map(m => m.name).slice(0, 3).join(' • ');
    titleEl.textContent = `${floorLabel}: ${count} adet ${meta.label} haritada işaretlendi`;
    subEl.textContent = namesStr || 'Haritadaki işaretli pinlere dokunarak veya sağdaki butonla rota çizebilirsiniz';
    banner.classList.remove('hidden');
  }

  showToast(`${meta.icon} ${floorLabel} katındaki tüm ${meta.label} noktaları (${matchedList.length} adet) haritada işaretlendi!`, 'info');

  if (window.speakNavigationText && window.isVoiceEnabled && !alsoRouteNearest) {
    window.speakNavigationText(`${floorLabel} katında ${matchedList.length} adet ${meta.label} haritada işaretlendi.`);
  }

  if (alsoRouteNearest) {
    const targetAmenity = findNearestAmenity(amenityKind, currentFloor);
    if (targetAmenity) {
      if (!selectedStartStore) {
        const defaultEnt = (mallData?.entrances || []).find(e => e.id === 'ent_fisekhane') || (mallData?.entrances || [])[0];
        if (defaultEnt) setStartLocation(defaultEnt);
      }
      setTargetLocation(targetAmenity);
    }
  }
}
window.highlightAmenitiesOnMap = highlightAmenitiesOnMap;

function setupHorizontalChipScrollers() {
  // 1. Sol/Sağ [<] [>] ok butonları
  document.querySelectorAll('.chip-scroll-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const targetId = btn.getAttribute('data-scroll-target');
      const dir = parseInt(btn.getAttribute('data-scroll-dir') || '1', 10);
      const row = targetId ? document.getElementById(targetId) : null;
      if (row) {
        row.scrollBy({ left: dir * 185, behavior: 'smooth' });
      }
    });
  });

  // 2. Mouse tekerleği (wheel) ve basılı tutup sürükleme (click-and-drag) ile yatay kaydırma
  document.querySelectorAll('.horizontal-chip-scroller').forEach(row => {
    row.addEventListener('wheel', (e) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        row.scrollLeft += e.deltaY;
      }
    }, { passive: false });

    let isDown = false;
    let startX = 0;
    let scrollLeftStart = 0;
    let dragged = false;

    row.addEventListener('mousedown', (e) => {
      isDown = true;
      dragged = false;
      startX = e.pageX - row.offsetLeft;
      scrollLeftStart = row.scrollLeft;
    });

    row.addEventListener('mouseleave', () => {
      isDown = false;
    });

    row.addEventListener('mouseup', () => {
      isDown = false;
    });

    row.addEventListener('mousemove', (e) => {
      if (!isDown) return;
      const x = e.pageX - row.offsetLeft;
      const walk = x - startX;
      if (Math.abs(walk) > 6) {
        dragged = true;
        e.preventDefault();
        row.scrollLeft = scrollLeftStart - walk * 1.25;
      }
    });

    row.addEventListener('click', (e) => {
      if (dragged) {
        e.stopPropagation();
        e.preventDefault();
        dragged = false;
      }
    }, true);
  });
}

function setupAmenityPills() {
  setupHorizontalChipScrollers();

  document.querySelectorAll('.amenity-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const amenityKind = pill.getAttribute('data-amenity');
      if (!amenityKind) return; // e.g. btn-parking-memory or btn-amenity-events handles itself

      // Aynı çipe tekrar basılırsa vurguyu kapat, değilse kattaki TÜM eşleşen servisleri haritada işaretle!
      if (mallMap && mallMap.activeAmenityHighlight === amenityKind) {
        clearAmenityHighlightOnMap();
      } else {
        highlightAmenitiesOnMap(amenityKind, false);
      }
    });
  });

  document.getElementById('btn-amenity-route-nearest')?.addEventListener('click', () => {
    const activeKind = mallMap?.activeAmenityHighlight;
    if (!activeKind) return;
    const targetAmenity = findNearestAmenity(activeKind, currentFloor);
    if (targetAmenity) {
      if (!selectedStartStore) {
        const defaultEnt = (mallData?.entrances || []).find(e => e.id === 'ent_fisekhane') || (mallData?.entrances || [])[0];
        if (defaultEnt) setStartLocation(defaultEnt);
      }
      setTargetLocation(targetAmenity);
      selectStore(targetAmenity);
    }
  });

  document.getElementById('btn-amenity-clear-highlight')?.addEventListener('click', () => {
    clearAmenityHighlightOnMap();
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

function storeMatchesCategory(store, category) {
  if (!store || !category || category === 'all') return true;
  if (store.category === category) return true;
  if (Array.isArray(store.subcategories) && store.subcategories.includes(category)) return true;
  return false;
}
window.storeMatchesCategory = storeMatchesCategory;

function isServiceOrAmenityItem(item) {
  if (!item) return false;
  if (item.is_service_area) return true;
  const id = String(item.id || '');
  if (id.startsWith('am_') || id.startsWith('ent_') || id.startsWith('p_') || id.startsWith('start_')) return true;
  const kind = String(item.kind || item.type || '').toLowerCase();
  if (['wc', 'baby', 'elevator', 'escalator', 'emergency', 'exit', 'atm', 'prayer', 'info', 'kiosk', 'entrance', 'carpark', 'wheelchair', 'health', 'medical', 'amenity'].includes(kind)) {
    return true;
  }
  const toAscii = (str) => normalizeTr(str)
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c');
  const normName = toAscii(item.name || item.short_name || '');
  const normCat = toAscii(item.category_name || item.category || '');
  const strictAmenityTerms = [
    'saglik', 'ilk yardim', 'revir', 'mescit', 'ibadet', 'bebek odasi', 'bebek bakim',
    'wc', 'tuvalet', 'lavabo', 'danisma', 'kiosk', 'atm', 'bankamatik',
    'otopark', 'asansor', 'yuruyen merdiven', 'acil cikis', 'kapisi'
  ];
  if (strictAmenityTerms.some(t => normName === t || normName.includes(t) || normCat.includes(t))) {
    return true;
  }
  return false;
}
window.isServiceOrAmenityItem = isServiceOrAmenityItem;

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

  // Kategori Filtresi (Hem ana kategori hem de çoklu alt kategorileri kapsar; önce bu kattaki mağazalar, ardından diğer katlardaki eşleşmeler listelenir)
  if (activeCategory && activeCategory !== 'all') {
    const filteredThisList = list.filter(s => storeMatchesCategory(s, activeCategory));
    if (filterTab === 'this_floor' && !searchQuery.trim()) {
      const otherFloorMatches = getAllStores().filter(s => s.floor !== currentFloor && storeMatchesCategory(s, activeCategory));
      list = [...filteredThisList, ...otherFloorMatches];
    } else {
      list = filteredThisList;
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

  // Sıralama: Kategori seçiliyse önce bu kattaki mağazalar, sonra alfabetik
  list.sort((a, b) => {
    if (activeCategory && activeCategory !== 'all') {
      const aThis = a.floor === currentFloor ? 0 : 1;
      const bThis = b.floor === currentFloor ? 0 : 1;
      if (aThis !== bThis) return aThis - bThis;
    }
    return a.name.localeCompare(b.name, 'tr');
  });

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
        <div class="store-card__floor">${store.floor_name || store.floor + '. Kat'}${store.unit ? ' • ' + store.unit : ''}</div>
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
  searchQuery = '';

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
  if (typeof mallMap.updateLiveUserLocation === 'function' && loc.cx !== undefined && loc.cy !== undefined) {
    const shortLbl = (loc.short_name || loc.name || 'Konumunuz').replace(/^📍\s*/, '').slice(0, 18);
    mallMap.updateLiveUserLocation(loc.cx, loc.cy, loc.floor || currentFloor, 0, shortLbl);
  }

  // KESİN KURAL: Hedef zaten seçiliyse rota otomatik hesaplansın; değilse 2B haritada kalınarak hedef seçimi beklensin (asla otomatik 3B'ye veya simülasyona geçilmez)
  if (selectedTargetStore && selectedTargetStore.id !== selectedStartStore.id) {
    calculateAndDisplayRoute();
    setActiveFocusSlot(null);
  } else {
    setActiveFocusSlot('target');
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
  searchQuery = '';

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
  renderPoiDetail(store);
  if (isMobileOrLandscape()) {
    expandBottomSheet();
  }
}
window.showPoiPeekCard = showPoiPeekCard;

function updateFloatingToggleVisibility() {
  // Floating view toggle removed in Paket 2
}
window.updateFloatingToggleVisibility = updateFloatingToggleVisibility;

function closePoiPeekCard() {
  document.body.classList.remove('has-peek-card');
  if (currentPeekStore) {
    if (mallMap) mallMap.setSelectedStore(null);
    currentPeekStore = null;
  }
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
      if (!selectedStartStore || selectedStartStore.id === store.id) {
        const fallbackStart = (window.lastReachedStore && window.lastReachedStore.id !== store.id)
          ? window.lastReachedStore
          : ((mallData?.entrances || []).find(e => e.id === 'ent_fisekhane') || (mallData?.entrances || [])[0]);
        if (fallbackStart) {
          selectedStartStore = fallbackStart;
          mallMap.activeStartStore = fallbackStart;
          updateStartBadgeUI(fallbackStart.name);
        }
      }
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

  if (isMobileOrLandscape()) {
    expandBottomSheet();
  }

  // Eğer 3B Sokak Görünümü (Gözümden 3B) açıksa, kamerayı doğrudan mağazanın 3B vitrini önüne götür!
  if (window.pov3dEngine && window.pov3dEngine.isActive && typeof window.pov3dEngine.teleportInFrontOfStore === 'function') {
    window.pov3dEngine.teleportInFrontOfStore(store);
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
  const pmrBanner = document.getElementById('pmr-accessible-banner');

  const activeEscalatorStyle = 'flex-1 py-1.5 px-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all border border-red-600 bg-red-600 text-white shadow-xs cursor-pointer';
  const activeElevatorStyle = 'flex-1 py-1.5 px-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all border border-sky-600 bg-sky-600 text-white shadow-xs cursor-pointer';
  const inactiveStyle = 'flex-1 py-1.5 px-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer';

  if (mode === 'escalator') {
    if (tabEscalator) tabEscalator.className = activeEscalatorStyle;
    if (tabElevator) tabElevator.className = inactiveStyle;
    if (pmrBanner) pmrBanner.classList.add('hidden');
  } else {
    if (tabElevator) tabElevator.className = activeElevatorStyle;
    if (tabEscalator) tabEscalator.className = inactiveStyle;
    if (pmrBanner) pmrBanner.classList.remove('hidden');

    // Hareket kabiliyeti kısıtlı kişiler için uyarlanmış engelsiz güzergah: otomatik olarak geniş ana koridorları ('wide') zorunlu kıl
    currentPathPreference = 'wide';
    const chipWide = document.getElementById('chip-path-wide');
    const chipShort = document.getElementById('chip-path-short');
    if (chipWide && chipShort) {
      chipWide.className = 'flex-1 py-1.5 px-2.5 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition-all active:scale-95 shadow-xs border border-indigo-600 bg-indigo-600 text-white cursor-pointer';
      chipShort.className = 'flex-1 py-1.5 px-2.5 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition-all active:scale-95 border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer';
    }
  }

  const btnEsc = document.getElementById('mode-escalator');
  const btnEle = document.getElementById('mode-elevator');
  if (btnEsc && btnEle) {
    if (mode === 'escalator') {
      btnEsc.className = 'flex-1 py-1.5 px-2.5 rounded-xl border border-red-500 bg-red-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm';
      btnEle.className = 'flex-1 py-1.5 px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-all';
    } else {
      btnEle.className = 'flex-1 py-1.5 px-2.5 rounded-xl border border-sky-500 bg-sky-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm';
      btnEsc.className = 'flex-1 py-1.5 px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-all';
    }
  }

  if (selectedStartStore && selectedTargetStore && selectedStartStore.id !== selectedTargetStore.id) {
    calculateAndDisplayRoute();
  }
}

function toggleCartSimulation() {
  const isEn = (currentLanguage === 'en' || window.currentLanguage === 'en');
  if (!cartSimulator.isPlaying) {
    if (isMobileOrLandscape() && isBottomSheetExpanded) {
      collapseBottomSheet();
    }
    cartSimulator.start();
    const playText = document.getElementById('sim-play-text');
    if (playText) playText.textContent = isEn ? 'Pause' : 'Duraklat';
    const hudSimText = document.getElementById('hud-sim-text');
    if (hudSimText) hudSimText.textContent = isEn ? 'Pause' : 'Duraklat';
    const hudSimIcon = document.getElementById('hud-sim-icon');
    if (hudSimIcon) hudSimIcon.setAttribute('data-lucide', 'pause');

    const routeSimText = document.getElementById('route-sim-text');
    const routeSimIcon = document.getElementById('route-sim-icon');
    if (routeSimText) routeSimText.textContent = isEn ? 'Pause' : 'Durdur';
    if (routeSimIcon) routeSimIcon.setAttribute('data-lucide', 'pause');
  } else {
    cartSimulator.pause();
    const playText = document.getElementById('sim-play-text');
    if (playText) playText.textContent = isEn ? 'Start' : 'Başlat';
    const hudSimText = document.getElementById('hud-sim-text');
    if (hudSimText) hudSimText.textContent = isEn ? 'Start' : 'Başlat';
    const hudSimIcon = document.getElementById('hud-sim-icon');
    if (hudSimIcon) hudSimIcon.setAttribute('data-lucide', 'play');

    const routeSimText = document.getElementById('route-sim-text');
    const routeSimIcon = document.getElementById('route-sim-icon');
    if (routeSimText) routeSimText.textContent = isEn ? 'Navigation' : 'Navigasyon';
    if (routeSimIcon) routeSimIcon.setAttribute('data-lucide', 'play');
  }
  if (window.lucide) lucide.createIcons();
}

function renderPoiDetail(store) {
  activePoiStore = store;
  const poiPanel = document.getElementById('sidebar-poi-detail');
  const storeGrid = document.getElementById('sidebar-store-grid');
  const tabsContainer = document.getElementById('sidebar-tabs-container');
  const campaignCard = document.getElementById('poi-campaign-card');

  if (!poiPanel) return;

  // Görünürlük
  storeGrid?.classList.add('hidden');
  tabsContainer?.classList.add('hidden');
  poiPanel.classList.remove('hidden');

  const isServiceItem = isServiceOrAmenityItem(store);

  // Bilgileri Doldur
  const logoEl = document.getElementById('poi-logo');
  if (logoEl) logoEl.innerHTML = getStoreLogo(store, 44);

  const nameEl = document.getElementById('poi-name');
  if (nameEl) nameEl.textContent = store.name;

  const catEl = document.getElementById('poi-category');
  if (catEl) {
    const kind = String(store.kind || store.type || '').toLowerCase();
    const fallbackCat = isServiceItem
      ? (kind === 'atm' ? 'Bankamatikler (ATM)' : (AMENITY_META_LABELS[kind]?.label || 'Hizmet & Ortak Alan'))
      : (store.category_name || store.category || 'Mağaza');
    catEl.textContent = store.category_name || fallbackCat;
  }

  const flBadge = document.getElementById('poi-floor-badge');
  if (flBadge) flBadge.textContent = store.floor_name || (mallData?.floors?.[store.floor]?.label) || (store.floor + '. Kat');

  const unitEl = document.getElementById('poi-unit-no');
  if (unitEl) {
    if (isServiceItem) {
      const kind = String(store.kind || store.type || '').toLowerCase();
      if (kind === 'atm') {
        unitEl.textContent = 'Konum: B-21 Turkcell & B-22 B&G Store Arası';
      } else {
        unitEl.textContent = store.unit ? `Konum: ${store.unit}` : 'Ortak Hizmet Noktası';
      }
    } else {
      unitEl.textContent = `Kapı No: ${store.unit || 'Z-12'}`;
    }
  }

  const phoneEl = document.getElementById('poi-phone');
  if (phoneEl) {
    if (isServiceItem) {
      const kind = String(store.kind || store.type || '').toLowerCase();
      phoneEl.textContent = kind === 'atm' ? '7/24 Tüm Banka Ortak ATM Alanı' : 'Capacity Danışma: 0212 559 0000';
    } else {
      phoneEl.textContent = store.phone || '0212 559 0000';
    }
  }

  // Hizmet ve ihtiyaç noktaları (ATM, WC, Asansör, Bebek Odası, Mescit vb.) bir mağaza değildir; kupon/indirim kartını gizle!
  if (isServiceItem) {
    campaignCard?.classList.add('hidden');
  } else {
    campaignCard?.classList.remove('hidden');
    const camp = store.campaign || {
      title: 'Capacity Sezon İndirimi',
      discount: '%40 İndirim',
      code: 'CAPACITY40',
      badge: 'Fırsat'
    };

    const campBadge = document.getElementById('poi-campaign-badge');
    if (campBadge) campBadge.textContent = stripUiEmojis(camp.badge || '%40 İndirim');

    const campText = document.getElementById('poi-campaign-text');
    if (campText) campText.textContent = camp.title;

    const couponCode = document.getElementById('poi-coupon-code');
    if (couponCode) couponCode.textContent = camp.code;
  }

  // Dinamik Butonları Durum Yönetimine Göre Render Et
  renderPoiActionButtons(store);
}

function renderPoiActionButtons(store) {
  const container = document.getElementById('poi-action-buttons');
  if (!container || !store) return;

  const isStart = selectedStartStore && selectedStartStore.id === store.id;
  const isTarget = selectedTargetStore && selectedTargetStore.id === store.id;

  const rawPhone = String(store.phone || '').trim();
  const cleanPhone = rawPhone.replace(/[^\d+]/g, '');

  const targetBtnHtml = isTarget
    ? `<button id="poi-route-btn" data-action="target" class="py-2.5 px-3 rounded-xl bg-red-700 text-white text-xs font-bold ring-2 ring-red-400 shadow-md flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer">
        <i data-lucide="check" class="w-4 h-4"></i>
        <span>🎯 Hedefte</span>
      </button>`
    : `<button id="poi-route-btn" data-action="target" class="py-2.5 px-3 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs font-bold shadow-md shadow-red-600/25 flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer">
        <i data-lucide="navigation" class="w-4 h-4"></i>
        <span>🎯 Hedef Yap</span>
      </button>`;

  const startBtnHtml = isStart
    ? `<button id="poi-start-btn" data-action="clear-start" class="py-2.5 px-3 rounded-xl bg-emerald-700 text-white text-xs font-bold ring-2 ring-emerald-400 shadow-md flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer" title="Başlangıcı Kaldır">
        <i data-lucide="check" class="w-4 h-4"></i>
        <span>📍 Başlangıçta</span>
      </button>`
    : `<button id="poi-start-btn" data-action="start" class="py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-md shadow-emerald-600/25 flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer">
        <i data-lucide="map-pin" class="w-4 h-4"></i>
        <span>📍 Başlangıç Yap</span>
      </button>`;

  const callBtnHtml = cleanPhone
    ? `<a href="tel:${cleanPhone}" class="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-xs font-bold border border-slate-200/80 dark:border-slate-700 shadow-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 no-underline cursor-pointer" title="Mağazayı Ara: ${rawPhone}">
        <i data-lucide="phone" class="w-4 h-4 text-emerald-600 dark:text-emerald-400"></i>
        <span>📞 Ara</span>
      </a>`
    : `<button type="button" data-action="call-danisma" class="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-xs font-bold border border-slate-200/80 dark:border-slate-700 shadow-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer" title="Capacity Danışma: 0212 559 0000">
        <i data-lucide="phone" class="w-4 h-4 text-emerald-600 dark:text-emerald-400"></i>
        <span>📞 Ara</span>
      </button>`;

  const povBtnHtml = `<button type="button" data-action="pov3d" class="py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/25 flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer" title="Mağaza Önüne 3B Işınlan">
      <i data-lucide="eye" class="w-4 h-4"></i>
      <span>👁️ 3B Görünüm</span>
    </button>`;

  container.innerHTML = `
    ${targetBtnHtml}
    ${startBtnHtml}
    ${callBtnHtml}
    ${povBtnHtml}
  `;

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
  if (window.arrivalResetTimer) {
    clearTimeout(window.arrivalResetTimer);
    window.arrivalResetTimer = null;
  }
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
  window.lastCalculatedRoute = result;
  updateHeaderNavSummary(selectedTargetStore, result);

  // 1. Sidebar / Çekmece İçi Aktif Rota Kartını (#sidebar-route-detail) Göster
  document.getElementById('sidebar-store-grid')?.classList.add('hidden');
  document.getElementById('sidebar-tabs-container')?.classList.add('hidden');
  document.getElementById('sidebar-poi-detail')?.classList.add('hidden');
  const routeDetailEl = document.getElementById('sidebar-route-detail');
  if (routeDetailEl) {
    routeDetailEl.classList.remove('hidden');
  }

  const cleanStart = (selectedStartStore.short_name || selectedStartStore.name || '').replace(/^📍\s*/, '');
  const cleanTarget = (selectedTargetStore.short_name || selectedTargetStore.name || '').replace(/^📍\s*/, '');
  const summaryTitle = document.getElementById('route-summary-title');
  if (summaryTitle) summaryTitle.textContent = `${cleanStart} ➔ ${cleanTarget}`;
  const summaryMeta = document.getElementById('route-summary-meta');
  const isEn = (currentLanguage === 'en' || window.currentLanguage === 'en');
  if (summaryMeta) {
    summaryMeta.textContent = `${Math.round(result.totalDistance)}m • ~${result.estimatedMinutes || Math.max(1, Math.ceil(result.totalDistance / 60))} ${isEn ? 'min' : 'dk'}`;
  }

  // Handle bar etiketini rota durumuna göre güncelle
  const sheetHint = document.getElementById('bottom-sheet-hint');
  const sheetSubhint = document.getElementById('bottom-sheet-subhint');
  if (sheetHint) sheetHint.innerHTML = `<span>${cleanTarget}</span> <span class="text-[10px] font-semibold text-indigo-500">• ${Math.round(result.totalDistance)}m</span>`;
  if (sheetSubhint) sheetSubhint.textContent = isEn ? 'Tap to view route details' : 'Yol tarifini görmek için dokunun';

  // Rota Kontrol Butonlarını Senkronize Et
  const routeSimText = document.getElementById('route-sim-text');
  const routeSimIcon = document.getElementById('route-sim-icon');
  if (routeSimText) routeSimText.textContent = isEn ? 'Navigation' : 'Navigasyon';
  if (routeSimIcon) routeSimIcon.setAttribute('data-lucide', 'play');
  const routeSpeedText = document.getElementById('route-speed-text');
  if (routeSpeedText) routeSpeedText.textContent = `${currentSimSpeed}x ${isEn ? 'Speed' : 'Hız'}`;

  // Adım Adım Detay Listesi (Çekmece) - Mağaza/Hizmet Bilgisi & Engelsiz Rota Rozeti ile
  renderHudStepsList(result, selectedTargetStore);

  // Yeni rota çizilirken önceki tamamlanmış rota (.route-completed) durumunu ve GPS yürüyüşünü sıfırla
  window.isRouteCompletedState = false;
  window.hasAnnouncedArrival = false;
  if (window.pov3dEngine) {
    window.pov3dEngine.hasAnnouncedArrival = false;
  }
  if (typeof stopLiveGpsRouteWalk === 'function') {
    stopLiveGpsRouteWalk();
  }

  // Haritada Rota Çiz
  mallMap.activeStartStore = selectedStartStore;
  mallMap.activeTargetStore = selectedTargetStore;
  mallMap.renderRoute(result);
  mallMap.updateActiveStorePolygons();

  // Rota çizgisinin opaklığını tam opak yap ve route-completed sınıfını temizle
  if (mallMap && mallMap.routeSvg) {
    mallMap.routeSvg.classList.remove('route-completed');
    mallMap.routeSvg.querySelectorAll('.route-completed').forEach(el => {
      el.classList.remove('route-completed');
      el.style.opacity = '';
    });
  }
  const routeGroup = mallMap?.routeSvg?.querySelector('.route-group') || mallMap?.routeSvg;
  if (routeGroup) {
    routeGroup.classList.remove('route-completed');
    routeGroup.style.opacity = '1';
  }

  // Canlı Turn-by-Turn HUD Banner'ını ilk adıma ayarla ve sesli adım sayacını sıfırla
  if (window.resetVoiceStepTracker) {
    window.resetVoiceStepTracker();
  }
  updateLiveNavHUD(0, 0);

  // Mobilde Alt Çekmeceyi Otomatik Küçült ve Rota Modunu Aktif Et
  if (isMobileOrLandscape()) {
    collapseBottomSheet();
  }
  document.body.classList.add('has-active-route');
  updateFloatingToggleVisibility();
  closePoiPeekCard(); // Rota başlayınca peek card gizlenir, tekil 64px HUD kalır

  // Kullanıcı zaten "Gözümden 3B" modundaysa 2B haritaya geri atma; doğrudan 3B yürüyüşü başlat!
  const wasAlreadyInPov = (window.currentViewMode === 'pov') || Boolean(window.pov3dEngine && window.pov3dEngine.isActive);

  cartSimulator.setRoute(result);
  cartSimulator.resetToStart();
  if (cartSimulator.cartEl) {
    cartSimulator.cartEl.style.display = (window.activeTravelNavigationMode === 'gps') ? 'none' : 'block';
  }
  resetSimControls();
  if (typeof updateTravelModeButtonsUI === 'function') {
    updateTravelModeButtonsUI();
  }

  // Başlangıç Katına Odaklan ve Rotayı Kadrajla
  updateFloorUI(selectedStartStore.floor);
  if (mallMap.currentFloor !== selectedStartStore.floor) {
    mallMap.loadFloor(selectedStartStore.floor).then(() => {
      mallMap.fitRoute(result);
    });
  } else {
    mallMap.fitRoute(result);
  }

  const choiceModal = document.getElementById('route-mode-choice-modal');
  const choiceMeta = document.getElementById('route-choice-meta');
  const choiceTitle = document.getElementById('route-choice-title');
  if (choiceMeta) {
    choiceMeta.textContent = `${result.totalDistance} m • ~${result.estimatedMinutes} dk`;
  }
  if (choiceTitle) {
    const cleanStart = (selectedStartStore.short_name || selectedStartStore.name || '').replace(/^📍\s*/, '');
    choiceTitle.textContent = `${cleanStart} ➔ ${selectedTargetStore.name}`;
  }

  if (wasAlreadyInPov && window.pov3dEngine) {
    choiceModal?.classList.add('hidden');
    window.currentViewMode = 'pov';
    window.pov3dEngine.startRouteWalk(result, selectedStartStore, selectedTargetStore, true, true);
  } else {
    if (window.pov3dEngine) {
      window.pov3dEngine.startRouteWalk(result, selectedStartStore, selectedTargetStore, false, false);
    }
    choiceModal?.classList.remove('hidden');
  }

  hideToast();
  if (window.lucide) lucide.createIcons();
}
window.calculateAndDisplayRoute = calculateAndDisplayRoute;

function clearCurrentRoute() {
  window.isRouteCompletedState = false;
  window.hasAnnouncedArrival = false;
  if (window.pov3dEngine) {
    window.pov3dEngine.hasAnnouncedArrival = false;
  }
  window.lastReachedStore = null;
  if (window.arrivalResetTimer) {
    clearTimeout(window.arrivalResetTimer);
    window.arrivalResetTimer = null;
  }
  if (typeof stopLiveGpsRouteWalk === 'function') {
    stopLiveGpsRouteWalk();
  }
  document.getElementById('route-mode-choice-modal')?.classList.add('hidden');
  document.getElementById('live-voice-subtitle-bar')?.classList.add('hidden');
  document.getElementById('arrival-action-bar')?.classList.add('hidden');
  if (typeof clearAmenityHighlightOnMap === 'function') {
    clearAmenityHighlightOnMap();
  }
  if (window.pov3dEngine && window.pov3dEngine.isActive) {
    window.setMapViewMode('2d');
  }
  if (mallMap && mallMap.routeSvg) {
    mallMap.routeSvg.classList.remove('route-completed');
    mallMap.routeSvg.querySelectorAll('.route-completed').forEach(el => {
      el.classList.remove('route-completed');
      el.style.opacity = '';
    });
  }
  if (window.isKioskMode) {
    selectedTargetStore = null;
    lastCalculatedRoute = null;
    searchQuery = '';
    mallMap.activeTargetStore = null;
    mallMap.selectedStore = null;
    mallMap.clearRoute();
    const routeGroup = mallMap?.routeSvg?.querySelector('.route-group') || mallMap?.routeSvg;
    if (routeGroup) {
      routeGroup.classList.remove('route-completed');
      routeGroup.style.opacity = '1';
    }
    document.getElementById('header-live-nav-banner')?.classList.add('hidden');
    cartSimulator.stop();
    document.body.classList.remove('has-active-route');
    updateFloatingToggleVisibility();
    updateFloorUI(mallMap.currentFloor || currentFloor);

    document.getElementById('sidebar-route-detail')?.classList.add('hidden');
    document.getElementById('sidebar-store-grid')?.classList.remove('hidden');
    document.getElementById('sidebar-tabs-container')?.classList.remove('hidden');
    const sheetHintKiosk = document.getElementById('bottom-sheet-hint');
    const sheetSubhintKiosk = document.getElementById('bottom-sheet-subhint');
    if (sheetHintKiosk) sheetHintKiosk.innerHTML = '<span>Yeni Rota Çiz</span> <span class="text-[10px] font-semibold text-slate-400 dark:text-slate-500">&bull; Mağaza Ara</span>';
    if (sheetSubhintKiosk) sheetSubhintKiosk.textContent = 'Paneli açmak için dokunun';

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
      cx: 265.0,
      cy: 570.0,
      nav_node: 'n_danisma'
    };
    selectedStartStore = { ...danismaEnt, name: '📍 Zemin Kat - Danışma / Kiosk' };
    mallMap.activeStartStore = selectedStartStore;
    mallMap.activeTargetStore = null;
    mallMap.updateActiveStorePolygons();
    mallMap.renderBrandMarkers(mallMap.currentFloor);
    renderSidebarStoreGrid();
    return;
  }

  selectedStartStore = null;
  selectedTargetStore = null;
  lastCalculatedRoute = null;
  searchQuery = '';

  // Harita üzerindeki Başlangıç, Hedef, Seçili Mağaza ve Canlı Konum rozetlerini tamamen temizle
  mallMap.activeStartStore = null;
  mallMap.activeTargetStore = null;
  mallMap.selectedStore = null;
  if (typeof mallMap.updateLiveUserLocation === 'function') {
    mallMap.updateLiveUserLocation(null, null);
  }
  mallMap.clearRoute();

  const routeGroup = mallMap?.routeSvg?.querySelector('.route-group') || mallMap?.routeSvg;
  if (routeGroup) {
    routeGroup.classList.remove('route-completed');
    routeGroup.style.opacity = '1';
  }
  document.getElementById('header-live-nav-banner')?.classList.add('hidden');
  cartSimulator.stop();
  document.body.classList.remove('has-active-route');
  updateFloatingToggleVisibility();

  // Header Kartını Varsayılan Kat Görünümüne Sıfırla
  updateFloorUI(mallMap.currentFloor || currentFloor);

  document.getElementById('sidebar-route-detail')?.classList.add('hidden');
  document.getElementById('sidebar-store-grid')?.classList.remove('hidden');
  document.getElementById('sidebar-tabs-container')?.classList.remove('hidden');
  const sheetHint = document.getElementById('bottom-sheet-hint');
  const sheetSubhint = document.getElementById('bottom-sheet-subhint');
  if (sheetHint) sheetHint.innerHTML = '<span>Yeni Rota Çiz</span> <span class="text-[10px] font-semibold text-slate-400 dark:text-slate-500">&bull; Mağaza Ara</span>';
  if (sheetSubhint) sheetSubhint.textContent = 'Paneli açmak için dokunun';

  document.getElementById('route-path-chips')?.classList.add('hidden');

  // Inputları ve temizleme butonlarını sıfırla
  const startInput = document.getElementById('input-start-loc');
  const targetInput = document.getElementById('input-target-loc');
  if (startInput) startInput.value = '';
  if (targetInput) targetInput.value = '';

  document.getElementById('btn-clear-start')?.classList.add('hidden');
  document.getElementById('btn-clear-target')?.classList.add('hidden');
  updateStartBadgeUI('');

  // Hızlı Başlangıç Çiplerini Sıfırla
  document.querySelectorAll('.quick-start-chip').forEach(b => {
    b.className = 'quick-start-chip px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-semibold flex items-center gap-1 shrink-0 transition-all border border-slate-200 dark:border-slate-700';
  });

  // Mağaza kartlarındaki aktif sınıfını kaldır ve mağaza listesini tazele
  document.querySelectorAll('.store-card').forEach(c => c.classList.remove('is-active'));
  renderSidebarStoreGrid();

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

function updateHeaderResetButtonVisibility() {
  if (window.isKioskMode) return;
  const pinBtn = document.getElementById('btn-header-pin-here');
  if (!pinBtn || !pinBtn.parentElement) return;

  let resetBtn = document.getElementById('btn-header-reset-all');
  if (!resetBtn) {
    resetBtn = document.createElement('button');
    resetBtn.id = 'btn-header-reset-all';
    resetBtn.type = 'button';
    resetBtn.className = 'hidden shrink-0 px-2 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-extrabold items-center justify-center gap-1 shadow-sm shadow-rose-600/20 transition-all active:scale-95 cursor-pointer';
    resetBtn.title = 'Konumu ve Rotayı Sıfırla';
    resetBtn.innerHTML = `${getMonoIconSvg('refresh', 13)}<span class="hidden sm:inline">Sıfırla</span>`;
    resetBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      clearCurrentRoute();
      showToast('Başlangıç konumu ve rota sıfırlandı.', 'info');
    });
    pinBtn.parentElement.appendChild(resetBtn);
  }

  const hasStateToReset = Boolean(selectedStartStore || selectedTargetStore || lastCalculatedRoute || window.isRouteCompletedState);
  if (hasStateToReset) {
    resetBtn.classList.remove('hidden');
    resetBtn.classList.add('flex');
  } else {
    resetBtn.classList.add('hidden');
    resetBtn.classList.remove('flex');
  }
}
window.updateHeaderResetButtonVisibility = updateHeaderResetButtonVisibility;

// 10. Başlangıç Konumu Rozetini ve Hızlı Butonları Güncelle
function updateStartBadgeUI(name) {
  const startInput = document.getElementById('input-start-loc');
  const clearStartBtn = document.getElementById('btn-clear-start');
  const badge = document.getElementById('start-badge-text');
  const headerPinText = document.getElementById('header-pin-here-text');

  if (name) {
    if (startInput) startInput.value = name;
    if (clearStartBtn) clearStartBtn.classList.remove('hidden');
    if (badge) badge.textContent = name;
    if (headerPinText) {
      const cleanShort = name.replace(/^📍\s*/, '').split('(')[0].trim();
      headerPinText.textContent = cleanShort.length > 14 ? cleanShort.slice(0, 13) + '…' : cleanShort;
    }

    // 4 Hızlı Başlangıç Çipini Senkronize Et
    document.querySelectorAll('.quick-start-chip').forEach(b => {
      const isMatch = (b.id === 'btn-quick-fisekhane' && (name.includes('Fişekhane') || name.includes('C Kapısı'))) ||
                      (b.id === 'btn-quick-carousel' && (name.includes('Carousel') || name.includes('B Kapısı'))) ||
                      (b.id === 'btn-quick-akapisi' && (name.includes('A Kapısı') || name.includes('Ataköy'))) ||
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
    if (headerPinText) headerPinText.textContent = 'Buradayım';
    document.querySelectorAll('.quick-start-chip').forEach(b => {
      b.className = 'quick-start-chip px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-semibold flex items-center gap-1 shrink-0 transition-all border border-slate-200 dark:border-slate-700';
    });
  }

  updateHeaderResetButtonVisibility();
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
      cx: 265,
      cy: 570,
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
      nav_node: 'c_4_s_340',
      cx: 338.0,
      cy: 504.0,
      iconEmoji: '🌊',
      badge: 'Buluşma Noktası',
      badgeClass: 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
    },
    // 4. Tüm Mağazalar (Alfabetik Sıralı)
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

    const activeStartLabel = selectedStartStore ? stripUiEmojis(selectedStartStore.short_name || selectedStartStore.name) : '';
    const resetHeaderHtml = (selectedStartStore || selectedTargetStore || lastCalculatedRoute || window.isRouteCompletedState)
      ? `
        <button type="button" id="btn-modal-reset-location" class="w-full mb-2 p-2.5 rounded-2xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 border border-rose-500/40 text-rose-700 dark:text-rose-300 text-xs font-extrabold flex items-center justify-between gap-2 transition-all active:scale-95 cursor-pointer shadow-xs">
          <span class="flex items-center gap-2 min-w-0">
            ${getMonoIconSvg('refresh', 14)}
            <span class="truncate">Mevcut Konumu ve Rotayı Sıfırla${activeStartLabel ? ' (' + activeStartLabel + ')' : ''}</span>
          </span>
          <span class="px-2 py-0.5 rounded-lg bg-rose-600 text-white text-[10px] font-black shrink-0">Sıfırla</span>
        </button>
      `
      : '';

    listContainer.innerHTML = resetHeaderHtml + filtered.map(loc => {
      const isSelected = selectedStartStore && (selectedStartStore.id === loc.id || selectedStartStore.name === loc.name);
      const iconHtml = loc.storeObj
        ? getStoreLogo(loc.storeObj, 24)
        : getMonoIconSvg('pin', 16);

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

    listContainer.querySelector('#btn-modal-reset-location')?.addEventListener('click', (e) => {
      e.stopPropagation();
      closeEntranceModal();
      clearCurrentRoute();
      showToast('🔄 Konumunuz ve rotanız sıfırlandı.', 'info');
    });

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
    cx: 265.0,
    cy: 570.0,
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

  // Paylaşılan Otopark Konumu URL Parametresi (?parking=P2&zone=Mavi&pillar=R08)
  const parkingCodeParam = urlParams.get('parking') || urlParams.get('parkingFloor');
  if (parkingCodeParam) {
    const pCode = parkingCodeParam.toUpperCase();
    const pFloorMap = {
      P1: { floor: 3, name: 'P1 (1. Bodrum Kat)' },
      P2: { floor: 2, name: 'P2 (2. Bodrum Kat)' },
      P3: { floor: 1, name: 'P3 (3. Bodrum Kat)' }
    };
    const pFloorInfo = pFloorMap[pCode] || { floor: Number(urlParams.get('pfloor')) || 2, name: `${pCode} Otopark Katı` };
    const pZone = urlParams.get('zone') || urlParams.get('parkingZone') || 'Mavi';
    const pColorMap = { Mavi: '#2563eb', Sarı: '#eab308', Turuncu: '#f97316', Kırmızı: '#ef4444' };
    const pPillar = urlParams.get('pillar') || urlParams.get('parkingPillar') || '';
    const sharedSpot = {
      floor: pFloorInfo.floor,
      code: pCode,
      name: pFloorInfo.name,
      zone: pZone,
      zoneColor: pColorMap[pZone] || '#2563eb',
      pillar: pPillar,
      time: 'Paylaşılan Konum'
    };
    try {
      localStorage.setItem('capacity_parking_spot', JSON.stringify(sharedSpot));
    } catch (e) {}
    updateParkingUI();
    showToast(`🚗 Paylaşılan otopark konumu yüklendi: ${sharedSpot.code} ${sharedSpot.zone} Bölge${sharedSpot.pillar ? ' (' + sharedSpot.pillar + ')' : ''}`, 'success');
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
// OTOPARK HAFIZASI, GOOGLE SHEETS SERVİSİ VE AKILLI KARŞILAMA SİSTEMİ
// ========================================================
let selectedParkingFloor = { floor: 2, code: 'P2', name: 'P2 (2. Bodrum Kat)' };
let selectedParkingZone = { name: 'Mavi', color: '#2563eb' };
let currentParkingOccupancy = {
  P1_Mavi: 18,
  P1_Sarı: 34,
  P1_Turuncu: 14,
  P1_Kırmızı: 52,
  P2_Mavi: 12,
  P2_Sarı: 5,
  P2_Turuncu: 36,
  P2_Kırmızı: 54,
  P3_Mavi: 9,
  P3_Sarı: 15,
  P3_Turuncu: 22,
  P3_Kırmızı: 49
};

function getSavedParkingSpot() {
  try {
    const raw = localStorage.getItem('capacity_parking_spot');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const floorCode = String(parsed.code || parsed.floor_id || 'P2').toUpperCase();
    const zoneName = String(parsed.zone || parsed.zone_color || 'Mavi');
    const pillarCode = String(parsed.pillar ?? parsed.pillar_code ?? '').trim();
    return {
      ...parsed,
      code: floorCode,
      floor_id: floorCode,
      zone: zoneName,
      zone_color: zoneName,
      pillar: pillarCode,
      pillar_code: pillarCode
    };
  } catch (e) {
    return null;
  }
}
window.getSavedParkingSpot = getSavedParkingSpot;

function computeZoneHeatbarMeta(activeCount) {
  if (window.ParkingService && typeof window.ParkingService.getZoneHeatbarInfo === 'function') {
    return window.ParkingService.getZoneHeatbarInfo(activeCount, 60);
  }
  const capacity = 60;
  const count = Math.max(0, Number(activeCount) || 0);
  const pct = Math.min(100, Math.round((count / capacity) * 100));
  if (pct < 50) {
    return {
      activeCount: count,
      capacity,
      pct,
      level: 'green',
      colorHex: '#10b981',
      statusLabel: 'Rahat Park',
      label: `%${pct} Dolu - Rahat Park`
    };
  }
  if (pct < 80) {
    return {
      activeCount: count,
      capacity,
      pct,
      level: 'orange',
      colorHex: '#f59e0b',
      statusLabel: 'Yoğun',
      label: `%${pct} Dolu - Yoğun`
    };
  }
  return {
    activeCount: count,
    capacity,
    pct,
    level: 'red',
    colorHex: '#ef4444',
    statusLabel: 'Doluya Yakın',
    label: `%${pct} Dolu - Doluya Yakın`
  };
}

function getZoneOccupancyCount(occupancyData, floorCode, zoneName) {
  const data = (occupancyData && typeof occupancyData === 'object') ? occupancyData : currentParkingOccupancy;
  const exactKey = `${floorCode}_${zoneName}`;
  if (data[exactKey] !== undefined && !isNaN(Number(data[exactKey]))) {
    return Number(data[exactKey]);
  }
  // ASCII fallback (e.g. P2_Sari / P2_Kirmizi)
  const asciiZone = zoneName
    .replace(/ı/g, 'i')
    .replace(/İ/g, 'I')
    .replace(/ş/g, 's')
    .replace(/Ş/g, 'S');
  const asciiKey = `${floorCode}_${asciiZone}`;
  if (data[asciiKey] !== undefined && !isNaN(Number(data[asciiKey]))) {
    return Number(data[asciiKey]);
  }
  return Number(currentParkingOccupancy[exactKey] ?? 12);
}

function renderParkingHeatbars(occupancyMap = null) {
  if (occupancyMap && typeof occupancyMap === 'object' && Object.keys(occupancyMap).length > 0) {
    currentParkingOccupancy = { ...currentParkingOccupancy, ...occupancyMap };
  }

  const floorCode = selectedParkingFloor?.code || 'P2';
  const zones = ['Mavi', 'Sarı', 'Turuncu', 'Kırmızı'];

  // 1. Kat seçicilerinin yanına/altına kat bazlı doluluk barı ekle
  document.querySelectorAll('#parking-floor-options .parking-floor-btn').forEach(btn => {
    const fCode = btn.getAttribute('data-code') || 'P2';
    const totalCars = zones.reduce((acc, z) => acc + getZoneOccupancyCount(currentParkingOccupancy, fCode, z), 0);
    const avgCountPerZone = Math.round(totalCars / zones.length);
    const meta = computeZoneHeatbarMeta(avgCountPerZone);

    let heatEl = btn.querySelector('.parking-floor-heatbar-wrap');
    if (!heatEl) {
      heatEl = document.createElement('div');
      heatEl.className = 'parking-floor-heatbar-wrap w-full mt-1.5 flex flex-col gap-0.5';
      btn.appendChild(heatEl);
    }
    const textColorClass = meta.level === 'green'
      ? 'text-emerald-600 dark:text-emerald-400'
      : (meta.level === 'orange' ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400');

    heatEl.innerHTML = `
      <div class="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
        <div class="parking-heatbar-fill h-full rounded-full transition-all duration-300" style="width: ${Math.max(6, meta.pct)}%; background-color: ${meta.colorHex};"></div>
      </div>
      <span class="parking-floor-heatbar-text text-[9px] font-extrabold leading-tight ${textColorClass}">%${meta.pct} Dolu</span>
    `;
  });

  // 2. Bölge seçicilerinin içine ve yanına detaylı Heatbar (%X Dolu - Rahat Park / Yoğun / Doluya Yakın) ekle
  document.querySelectorAll('#parking-zone-options .parking-zone-btn').forEach(btn => {
    const zName = btn.getAttribute('data-zone') || 'Mavi';
    const count = getZoneOccupancyCount(currentParkingOccupancy, floorCode, zName);
    const meta = computeZoneHeatbarMeta(count);

    btn.setAttribute('data-status', meta.level === 'red' ? 'full' : 'available');
    btn.setAttribute('data-occupancy-pct', String(meta.pct));
    btn.setAttribute('data-occupancy-level', meta.level);

    // Mevcut durum etiketini güncelle
    const statusSpan = btn.querySelector('.parking-zone-heat-label') || btn.querySelectorAll(':scope > span')[1];
    const textColorClass = meta.level === 'green'
      ? 'text-emerald-600 dark:text-emerald-400'
      : (meta.level === 'orange' ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400');

    if (statusSpan) {
      statusSpan.className = `parking-zone-heat-label text-[9px] font-extrabold ${textColorClass}`;
      statusSpan.textContent = meta.label;
    }

    let barWrap = btn.querySelector('.parking-zone-heatbar');
    if (!barWrap) {
      barWrap = document.createElement('div');
      barWrap.className = 'parking-zone-heatbar w-full mt-1 flex flex-col gap-0.5';
      btn.appendChild(barWrap);
    }
    barWrap.innerHTML = `
      <div class="w-full h-1.5 rounded-full bg-slate-200/90 dark:bg-slate-700/90 overflow-hidden">
        <div class="parking-heatbar-fill h-full rounded-full transition-all duration-300" style="width: ${Math.max(6, meta.pct)}%; background-color: ${meta.colorHex};"></div>
      </div>
      <div class="flex items-center justify-between text-[8px] font-bold text-slate-500 dark:text-slate-400 px-0.5">
        <span>${meta.activeCount}/${meta.capacity} Araç</span>
        <span>%${meta.pct}</span>
      </div>
    `;
  });

  // 3. Seçili katın tüm bölgeleri için özet Heatbar listesi (#parking-occupancy-heatbar-panel)
  const parkingForm = document.getElementById('parking-form');
  const zoneContainer = document.getElementById('parking-zone-options');
  if (parkingForm && zoneContainer) {
    let summaryPanel = document.getElementById('parking-occupancy-heatbar-panel');
    if (!summaryPanel) {
      summaryPanel = document.createElement('div');
      summaryPanel.id = 'parking-occupancy-heatbar-panel';
      summaryPanel.className = 'mt-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 flex flex-col gap-1.5';
      zoneContainer.parentElement.appendChild(summaryPanel);
    }

    const rowsHtml = zones.map(zName => {
      const count = getZoneOccupancyCount(currentParkingOccupancy, floorCode, zName);
      const meta = computeZoneHeatbarMeta(count);
      const badgeClass = meta.level === 'green'
        ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border-emerald-500/30'
        : (meta.level === 'orange'
          ? 'text-amber-700 dark:text-amber-300 bg-amber-500/10 border-amber-500/30'
          : 'text-red-700 dark:text-red-300 bg-red-500/10 border-red-500/30');
      return `
        <div class="parking-heatbar-row flex flex-col gap-1" data-heatbar-key="${floorCode}_${zName}" data-heatbar-level="${meta.level}">
          <div class="flex items-center justify-between text-[10px] font-extrabold">
            <span class="text-slate-700 dark:text-slate-200">${floorCode} ${zName} Bölge <span class="text-[9px] font-semibold text-slate-400">(${meta.activeCount}/60)</span></span>
            <span class="px-1.5 py-0.5 rounded-md border text-[9px] font-black ${badgeClass}">${meta.label}</span>
          </div>
          <div class="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
            <div class="parking-heatbar-bar h-full rounded-full transition-all duration-300" style="width: ${Math.max(6, meta.pct)}%; background-color: ${meta.colorHex};"></div>
          </div>
        </div>
      `;
    }).join('');

    summaryPanel.innerHTML = `
      <div class="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
        <span>Canlı Bölge Doluluk Oranları (${floorCode})</span>
        <span class="text-[9px] font-bold text-indigo-600 dark:text-indigo-400">Kapasite: 60 Araç/Bölge</span>
      </div>
      <div class="flex flex-col gap-1.5">${rowsHtml}</div>
    `;
  }
}
window.renderParkingHeatbars = renderParkingHeatbars;

async function refreshParkingOccupancyHeatbars() {
  renderParkingHeatbars(currentParkingOccupancy);
  if (window.ParkingService && typeof window.ParkingService.getOccupancy === 'function') {
    try {
      const liveData = await window.ParkingService.getOccupancy();
      if (liveData && typeof liveData === 'object' && Object.keys(liveData).length > 0) {
        renderParkingHeatbars(liveData);
      }
    } catch (e) {
      // Fallback occupancy already rendered
    }
  }
}
window.refreshParkingOccupancyHeatbars = refreshParkingOccupancyHeatbars;

const CAPACITY_PARKING_ZONE_AXIS_META = {
  Mavi: {
    letter: 'A',
    range: 'A-01..A-15',
    lobbyLabel: 'Batı Panoramik Asansör & Koton-LCW Aksı',
    colorHex: '#2563eb'
  },
  Sarı: {
    letter: 'B',
    range: 'B-01..B-15',
    lobbyLabel: 'Merkez / B2-03 Hibatech & Lostra Aksı',
    colorHex: '#eab308'
  },
  Turuncu: {
    letter: 'C',
    range: 'C-01..C-15',
    lobbyLabel: 'Doğu Asansör & E-Şarj İstasyonu / Dry Clean Aksı',
    colorHex: '#f97316'
  },
  Kırmızı: {
    letter: 'D',
    range: 'D-01..D-15',
    lobbyLabel: 'Güney Merdiven • VIP Vale & Fişekhane Çıkış Aksı',
    colorHex: '#ef4444'
  }
};

function renderQuickPillarChipsForZone(zoneName = 'Mavi', floorCode = 'P2') {
  const chipsWrap = document.getElementById('parking-quick-pillar-chips');
  const pillarInput = document.getElementById('parking-spot-pillar');
  if (!chipsWrap) return;

  const axisMeta = CAPACITY_PARKING_ZONE_AXIS_META[zoneName] || CAPACITY_PARKING_ZONE_AXIS_META.Mavi;
  const L = axisMeta.letter;

  const quickPillars = [
    { val: 'B-04', label: 'B-04' },
    ...(L !== 'B' ? [{ val: `${L}-04`, label: `${L}-04` }] : []),
    { val: `${L}-08`, label: `${L}-08` },
    { val: `${L}-12`, label: `${L}-12` },
    { val: 'B2-03 Hibatech', label: 'B2-03 Hibatech' },
    { val: 'E-Şarj İstasyonu', label: 'E-Şarj İstasyonu' },
    { val: 'Asansör Karşısı', label: 'Asansör Karşısı' }
  ];

  chipsWrap.innerHTML = quickPillars.map(item => `
    <button type="button" data-pillar-val="${item.val}" class="parking-pillar-chip px-2 py-1 rounded-lg bg-slate-100 hover:bg-amber-500/20 dark:bg-slate-800 dark:hover:bg-amber-500/20 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-[10px] font-bold transition-all cursor-pointer">
      ${item.label}
    </button>
  `).join('');

  chipsWrap.querySelectorAll('.parking-pillar-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const val = chip.getAttribute('data-pillar-val') || '';
      if (pillarInput) pillarInput.value = val;
    });
  });
}

function ensureCleanParkingModalUI() {
  // Karmaşık URL/link paylaşım kutularını kaldır
  document.getElementById('parking-saved-share-actions')?.remove();
  document.getElementById('parking-share-link-box')?.remove();
  document.getElementById('btn-parking-save-and-share')?.remove();

  // Kaydet, Rota Çiz ve Kaydı Sonlandır butonlarını kurumsal minimalist metin ve tek renk SVG ikonlarla güncelle
  const saveBtn = document.getElementById('btn-parking-save');
  if (saveBtn) {
    saveBtn.innerHTML = `${getMonoIconSvg('car', 15)}<span>Park Yerini Kaydet</span>`;
  }
  const navCarBtn = document.getElementById('btn-parking-navigate-car');
  if (navCarBtn) {
    navCarBtn.innerHTML = `${getMonoIconSvg('navigation', 15)}<span>Araca Rota Çiz</span>`;
  }
  const delSpotBtn = document.getElementById('btn-parking-delete');
  if (delSpotBtn) {
    delSpotBtn.innerHTML = `${getMonoIconSvg('logOut', 14)}<span>Park Kaydını Sonlandır</span>`;
  }

  // Hızlı sütun ve gerçek Capacity referans çiplerini oluştur
  const pillarInput = document.getElementById('parking-spot-pillar');
  if (pillarInput && pillarInput.parentElement) {
    let chipsWrap = document.getElementById('parking-quick-pillar-chips');
    if (!chipsWrap) {
      chipsWrap = document.createElement('div');
      chipsWrap.id = 'parking-quick-pillar-chips';
      chipsWrap.className = 'flex items-center gap-1.5 flex-wrap mt-1.5';
      pillarInput.parentElement.appendChild(chipsWrap);
    }
    renderQuickPillarChipsForZone(selectedParkingZone?.name || 'Mavi', selectedParkingFloor?.code || 'P2');
  }
}

function syncSavedParkingOnSvgMap() {
  const container = document.getElementById('map-canvas-container');
  if (!container) return;
  const svgEl = container.querySelector('svg');
  if (!svgEl) return;

  // 1. B2 ve B3 kat planlarındaki .parking-svg-zone alanlarına tıklama etkileşimi bağla
  svgEl.querySelectorAll('.parking-svg-zone').forEach(zoneGroup => {
    if (!zoneGroup.dataset.boundClick) {
      zoneGroup.dataset.boundClick = '1';
      zoneGroup.style.cursor = 'pointer';
      zoneGroup.addEventListener('click', (e) => {
        e.stopPropagation();
        const fCode = zoneGroup.getAttribute('data-floor-code') || 'P2';
        const zName = zoneGroup.getAttribute('data-zone') || 'Mavi';
        openParkingMemoryModal();
        const flBtn = document.querySelector(`.parking-floor-btn[data-code="${fCode}"]`);
        if (flBtn && typeof window.selectParkingFloor === 'function') {
          window.selectParkingFloor(flBtn);
        }
        const zBtn = document.querySelector(`.parking-zone-btn[data-zone="${zName}"]`);
        if (zBtn && typeof window.selectParkingZone === 'function') {
          window.selectParkingZone(zBtn);
        }
      });
    }
  });

  // 2. Kayıtlı araç bu kattaysa SVG harita üzerinde ilgili otopark alanında canlı rozet göster
  svgEl.querySelector('#svg-saved-car-pin')?.remove();
  const saved = getSavedParkingSpot();
  if (!saved) return;

  const floorCode = String(saved.code || saved.floor_id || 'P2').toUpperCase();
  const savedFloorNum = floorCode === 'P1' ? 3 : (floorCode === 'P3' ? 1 : 2);
  const activeFloorNum = mallMap ? mallMap.currentFloor : currentFloor;
  if (activeFloorNum !== savedFloorNum) return;

  const zoneName = saved.zone || saved.zone_color || 'Mavi';
  const pillarText = (saved.pillar || saved.pillar_code || '').trim();
  const targetZoneEl = svgEl.querySelector(`.parking-svg-zone[data-floor-code="${floorCode}"][data-zone="${zoneName}"]`);

  const cx = Number(targetZoneEl?.getAttribute('data-cx')) || (savedFloorNum === 2 ? 1040 : 1115);
  const cy = Number(targetZoneEl?.getAttribute('data-cy')) || 520;

  const pinGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  pinGroup.setAttribute('id', 'svg-saved-car-pin');
  pinGroup.setAttribute('transform', `translate(${cx}, ${cy})`);
  pinGroup.style.cursor = 'pointer';

  const labelText = `ARACINIZ: ${floorCode} ${zoneName.toUpperCase()}${pillarText ? ' (' + pillarText + ')' : ''}`;
  const boxWidth = Math.max(176, labelText.length * 6.8 + 24);

  pinGroup.innerHTML = `
    <circle cx="0" cy="0" r="24" fill="#f59e0b" fill-opacity="0.28">
      <animate attributeName="r" values="18;30;18" dur="1.8s" repeatCount="indefinite" />
      <animate attributeName="fill-opacity" values="0.35;0.08;0.35" dur="1.8s" repeatCount="indefinite" />
    </circle>
    <rect x="${-boxWidth / 2}" y="-20" width="${boxWidth}" height="34" rx="10" fill="#0f172a" stroke="#f59e0b" stroke-width="2.4" />
    <text x="0" y="1" fill="#fef3c7" font-size="9.5" font-weight="900" text-anchor="middle" font-family="Plus Jakarta Sans, sans-serif">${labelText}</text>
  `;
  pinGroup.addEventListener('click', (e) => {
    e.stopPropagation();
    navigateToSavedCar();
  });
  svgEl.appendChild(pinGroup);
}
window.syncSavedParkingOnSvgMap = syncSavedParkingOnSvgMap;

function ensureSmartParkingGreetingCard() {
  const headerContainer = document.getElementById('floor-header-card');
  if (!headerContainer) return null;

  let card = document.getElementById('smart-parking-greeting-card');
  if (!card) {
    card = document.createElement('div');
    card.id = 'smart-parking-greeting-card';
    card.className = 'pointer-events-auto hidden mt-1.5 px-3 py-2 rounded-2xl glass-panel border-2 border-amber-500/50 bg-slate-900/95 text-white shadow-xl flex flex-wrap items-center justify-between gap-2 max-w-[96vw] transition-all';
    card.innerHTML = `
      <div class="flex items-center gap-2 min-w-0">
        <span class="w-7 h-7 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-300 flex items-center justify-center shrink-0">${getMonoIconSvg('car', 15)}</span>
        <span id="smart-parking-greeting-text" class="text-xs sm:text-sm font-black tracking-tight text-amber-100 truncate">
          Aracınız: P2 - Mavi (B-12)
        </span>
      </div>
      <div class="flex items-center gap-1.5 shrink-0">
        <button type="button" id="btn-smart-parking-route" class="px-2.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[11px] shadow-sm flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer">
          ${getMonoIconSvg('navigation', 14)}
          <span>Araca Rota Çiz</span>
        </button>
        <button type="button" id="btn-smart-parking-release" class="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-red-950/80 text-slate-200 hover:text-red-200 border border-slate-700 hover:border-red-500/40 font-bold text-[11px] flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer">
          ${getMonoIconSvg('logOut', 14)}
          <span>Park Kaydını Sonlandır</span>
        </button>
      </div>
    `;
    headerContainer.appendChild(card);

    card.querySelector('#btn-smart-parking-route')?.addEventListener('click', (e) => {
      e.stopPropagation();
      navigateToSavedCar();
    });

    card.querySelector('#btn-smart-parking-release')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      await deleteParkingSpot();
    });
  }
  return card;
}

function updateParkingUI() {
  ensureCleanParkingModalUI();
  const saved = getSavedParkingSpot();
  const btnText = document.getElementById('parking-memory-btn-text');
  const headerBtn = document.getElementById('btn-header-find-car');
  const headerText = document.getElementById('header-car-spot-text');
  const savedCard = document.getElementById('parking-saved-card');
  const parkingForm = document.getElementById('parking-form');
  const smartCard = ensureSmartParkingGreetingCard();
  const smartText = document.getElementById('smart-parking-greeting-text');

  if (saved) {
    const floorCode = saved.code || saved.floor_id || 'P2';
    const zoneName = saved.zone || saved.zone_color || 'Mavi';
    const pillarText = stripUiEmojis((saved.pillar || saved.pillar_code || '').trim());
    const axisMeta = CAPACITY_PARKING_ZONE_AXIS_META[zoneName] || CAPACITY_PARKING_ZONE_AXIS_META.Mavi;
    const label = `${floorCode} ${zoneName}`;

    if (btnText) btnText.textContent = `Araca Rota Çiz (${label})`;
    if (headerText) headerText.textContent = `Araca Rota Çiz (${label})`;
    if (headerBtn) headerBtn.classList.remove('hidden');

    if (smartCard && smartText) {
      const pillarSuffix = pillarText ? ` (${pillarText})` : ` (${axisMeta.letter} Aksı)`;
      smartText.textContent = `Aracınız: ${floorCode} - ${zoneName}${pillarSuffix}`;
      smartCard.classList.remove('hidden');
    }

    if (savedCard) {
      savedCard.classList.remove('hidden');
      const badge = document.getElementById('parking-saved-zone-badge');
      const title = document.getElementById('parking-saved-location-title');
      const pillar = document.getElementById('parking-saved-pillar-text');
      const time = document.getElementById('parking-saved-time-text');

      if (badge) {
        badge.textContent = floorCode;
        badge.style.backgroundColor = saved.zoneColor || axisMeta.colorHex || '#2563eb';
      }
      if (title) title.textContent = `${saved.name || floorCode + ' Katı'} • ${zoneName} Bölge (${axisMeta.letter} Aksı)`;
      if (pillar) pillar.textContent = pillarText ? `Sütun / Referans: ${pillarText} • ${axisMeta.lobbyLabel}` : axisMeta.lobbyLabel;
      if (time) time.textContent = saved.time ? `Kaydedildi: ${saved.time}` : 'Kayıtlı';
    }
    if (parkingForm) parkingForm.classList.remove('hidden');
  } else {
    if (btnText) btnText.textContent = 'Park Yerini Kaydet';
    if (headerBtn) headerBtn.classList.add('hidden');
    if (smartCard) smartCard.classList.add('hidden');
    if (savedCard) savedCard.classList.add('hidden');
    if (parkingForm) parkingForm.classList.remove('hidden');
  }

  syncSavedParkingOnSvgMap();
}

function openParkingMemoryModal() {
  const modal = document.getElementById('parking-memory-modal');
  if (!modal) return;
  updateParkingUI();
  modal.classList.remove('hidden');
  refreshParkingOccupancyHeatbars();
  if (window.lucide) lucide.createIcons();
}

function closeParkingMemoryModal() {
  document.getElementById('parking-memory-modal')?.classList.add('hidden');
}

async function saveParkingSpot(closeModalAfter = true) {
  const pillarInput = document.getElementById('parking-spot-pillar');
  const pillar = pillarInput ? stripUiEmojis(pillarInput.value.trim()) : '';
  const floorCode = selectedParkingFloor.code || 'P2';
  const zoneName = selectedParkingZone.name || 'Mavi';

  let spot = null;
  if (window.ParkingService && typeof window.ParkingService.saveSpot === 'function') {
    spot = await window.ParkingService.saveSpot(floorCode, zoneName, pillar);
  } else {
    spot = {
      floor: selectedParkingFloor.floor,
      code: floorCode,
      floor_id: floorCode,
      name: selectedParkingFloor.name,
      zone: zoneName,
      zone_color: zoneName,
      zoneColor: selectedParkingZone.color,
      pillar: pillar,
      pillar_code: pillar,
      time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
    };
    try {
      localStorage.setItem('capacity_parking_spot', JSON.stringify(spot));
    } catch (e) {
      console.error('LocalStorage write error', e);
    }
  }

  // Aktif bölge sayacını yerel olarak da +1 güncelle
  const key = `${floorCode}_${zoneName}`;
  currentParkingOccupancy[key] = (Number(currentParkingOccupancy[key]) || 0) + 1;
  renderParkingHeatbars(currentParkingOccupancy);

  showToast(`Park yeriniz kaydedildi: ${floorCode} - ${zoneName} Bölge${pillar ? ' (' + pillar + ')' : ''}`, 'success');
  updateParkingUI();
  if (closeModalAfter) {
    closeParkingMemoryModal();
  }
  return spot;
}
window.saveParkingSpot = saveParkingSpot;

async function deleteParkingSpot() {
  if (window.ParkingService && typeof window.ParkingService.releaseSpot === 'function') {
    await window.ParkingService.releaseSpot();
  } else {
    try {
      localStorage.removeItem('capacity_parking_spot');
    } catch (e) {}
  }
  showToast('Park kaydınız sonlandırıldı. İyi yolculuklar dileriz.', 'info');
  updateParkingUI();
}
window.deleteParkingSpot = deleteParkingSpot;

function resolveSavedParkingTargetStore(saved, currentFl) {
  const floorCode = String(saved?.code || saved?.floor_id || 'P2').toUpperCase();
  const zoneName = String(saved?.zone || saved?.zone_color || 'Mavi');
  const pillarText = stripUiEmojis(String(saved?.pillar || saved?.pillar_code || '').trim());
  const pillarNorm = normalizeTr(pillarText);
  const axisMeta = CAPACITY_PARKING_ZONE_AXIS_META[zoneName] || CAPACITY_PARKING_ZONE_AXIS_META.Mavi;

  const targetFloorNum = floorCode === 'P1' ? 3 : (floorCode === 'P3' ? 1 : 2);
  const allStores = getAllStores();

  // Eğer B2 (P2) katında Hibatech Oto Yıkama referansı veya Sarı Bölge seçildiyse ve B2-03 Hibatech mevcutsa:
  if (targetFloorNum === 2 && (pillarNorm.includes('hibatech') || pillarNorm.includes('yikama') || zoneName === 'Sarı')) {
    const hibatech = allStores.find(s => s.id === 'store_2_1');
    if (hibatech && hibatech.nav_node) {
      return {
        ...hibatech,
        name: `${floorCode} ${zoneName} Bölge (${pillarText || 'B2-03 Hibatech'})`,
        category_name: 'Kayıtlı Araç Konumu (B2 Otopark)',
        is_service_area: true
      };
    }
  }

  // Eğer B3 (P3) katında Lostra / Dry Clean / Mescit referansı seçildiyse:
  if (targetFloorNum === 1) {
    if (pillarNorm.includes('lostra') || zoneName === 'Sarı') {
      const lostra = allStores.find(s => s.id === 'store_1_2');
      if (lostra && lostra.nav_node) {
        return {
          ...lostra,
          name: `${floorCode} ${zoneName} Bölge (${pillarText || 'B3-10 Başak Lostra Lobisi'})`,
          category_name: 'Kayıtlı Araç Konumu (B3 Otopark)',
          is_service_area: true
        };
      }
    }
    if (pillarNorm.includes('dry') || zoneName === 'Turuncu') {
      const dryClean = allStores.find(s => s.id === 'store_1_4');
      if (dryClean && dryClean.nav_node) {
        return {
          ...dryClean,
          name: `${floorCode} ${zoneName} Bölge (${pillarText || 'B3-05 Dry Clean Lobisi'})`,
          category_name: 'Kayıtlı Araç Konumu (B3 Otopark)',
          is_service_area: true
        };
      }
    }
  }

  // Bölge rengine göre o kattaki gerçek Otopark Asansör / Yaya Lobisi düğümünü seç
  let navNode = `c_${targetFloorNum}_m_760`;
  let cx = 780;
  let cy = 440;
  if (zoneName === 'Mavi' || pillarNorm.startsWith('a')) {
    navNode = `c_${targetFloorNum}_m_240`;
    cx = 220;
    cy = 440;
  } else if (zoneName === 'Sarı' || pillarNorm.startsWith('b')) {
    navNode = `c_${targetFloorNum}_n_430`;
    cx = 430;
    cy = 295;
  } else if (zoneName === 'Turuncu' || pillarNorm.startsWith('c') || pillarNorm.includes('sarj')) {
    navNode = `c_${targetFloorNum}_m_760`;
    cx = 780;
    cy = 440;
  } else if (zoneName === 'Kırmızı' || pillarNorm.startsWith('d') || pillarNorm.includes('vale')) {
    navNode = `c_${targetFloorNum}_s_760`;
    cx = 760;
    cy = 570;
  }

  return {
    id: `parking_target_${floorCode}_${zoneName}`,
    name: `Aracınız: ${floorCode} ${zoneName} Bölge (${pillarText || axisMeta.letter + ' Aksı'})`,
    floor: targetFloorNum,
    category_name: `${floorCode} Kapalı Otopark (${axisMeta.lobbyLabel})`,
    kind: 'carpark',
    is_service_area: true,
    cx,
    cy,
    nav_node: navNode
  };
}

function navigateToSavedCar() {
  const saved = getSavedParkingSpot();
  if (!saved) {
    openParkingMemoryModal();
    return;
  }

  closeParkingMemoryModal();

  const currentFl = mallMap ? mallMap.currentFloor : 4;
  let startStoreObj = null;

  if (selectedStartStore && selectedStartStore.floor === currentFl) {
    startStoreObj = selectedStartStore;
  } else {
    if (currentFl === 4) {
      startStoreObj = (mallData?.entrances || []).find(e => e.id === 'ent_danisma') || {
        id: 'danisma',
        name: 'Zemin Kat Danışma',
        floor: 4,
        cx: 265,
        cy: 570,
        nav_node: 'n_danisma'
      };
    } else {
      const floorStores = getAllStores().filter(s => s.floor === currentFl && s.nav_node);
      startStoreObj = floorStores.length > 0
        ? floorStores[0]
        : { id: 'door_0', name: 'Kat Girişi', floor: currentFl, cx: 240, cy: 440, nav_node: `c_${currentFl}_m_240` };
    }
  }

  const floorCode = saved.code || saved.floor_id || 'P2';
  const zoneName = saved.zone || saved.zone_color || 'Mavi';
  const pillarText = stripUiEmojis(saved.pillar || saved.pillar_code || '');
  const targetParkingObj = resolveSavedParkingTargetStore(saved, currentFl);

  // Eğer başlangıç ve hedef aynı düğümdeyse farklı bir başlangıç noktası seç
  if (startStoreObj && startStoreObj.nav_node === targetParkingObj.nav_node) {
    startStoreObj = {
      id: `lobby_entry_${currentFl}`,
      name: 'Kat Kuzeybatı Girişi',
      floor: currentFl,
      cx: 240,
      cy: 310,
      nav_node: `c_${currentFl}_n_240`
    };
  }

  if (startStoreObj) {
    setStartLocation(startStoreObj);
  }
  setTargetLocation(targetParkingObj);

  showToast(`Aracınız ${floorCode} - ${zoneName} Bölge (${pillarText || 'Otopark'}) noktasında. Otopark katına ve bölgesine rota çizildi.`, 'success');
}

function navigateToAvailableParking(recordFullZone = false) {
  if (recordFullZone) {
    try {
      const reports = JSON.parse(localStorage.getItem('capacity_full_parking_reports') || '[]');
      reports.push({
        floor: selectedParkingFloor.code,
        zone: selectedParkingZone.name,
        time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
      });
      localStorage.setItem('capacity_full_parking_reports', JSON.stringify(reports.slice(-10)));
    } catch (e) {}
  }

  closeParkingMemoryModal();

  const currentFl = mallMap ? mallMap.currentFloor : 4;
  const nearestLift = findNearestAmenity('elevator', currentFl);
  const elevatorNodeId = nearestLift?.nav_node || `p_${currentFl}_lift_w`;

  let startStoreObj = null;
  if (selectedStartStore && selectedStartStore.floor === currentFl) {
    startStoreObj = selectedStartStore;
  } else {
    if (currentFl === 4) {
      startStoreObj = { id: 'danisma', name: 'Zemin Kat Danışma', floor: 4, cx: 265, cy: 570, nav_node: 'n_danisma' };
    } else {
      const floorStores = getAllStores().filter(s => s.floor === currentFl);
      startStoreObj = floorStores.length > 0 ? floorStores[0] : { id: 'door_0', name: 'Kat Girişi', floor: currentFl, cx: 240, cy: 400, nav_node: `p_${currentFl}_lift_w` };
    }
  }

  const availableParkingTarget = {
    id: nearestLift?.id || `am_lift_w_${currentFl}`,
    name: 'P2 Mavi Bölge Boş Otopark Alanı (Panoramik Asansör)',
    floor: currentFl,
    category_name: 'Boş Otopark Yönlendirme',
    kind: 'carpark',
    is_service_area: true,
    cx: nearestLift?.cx || 240,
    cy: nearestLift?.cy || 400,
    nav_node: elevatorNodeId
  };

  if (startStoreObj) {
    setStartLocation(startStoreObj);
  }
  setTargetLocation(availableParkingTarget);

  if (recordFullZone) {
    showToast('Dolu park alanı kaydedildi. En yakın rahat park alanı olan P2 Mavi Bölge asansörüne yönlendiriliyorsunuz.', 'success');
  } else {
    showToast('En yakın rahat otopark alanı olan P2 (-2. Kat) Mavi Bölge noktasına yönlendiriliyorsunuz.', 'success');
  }
}
window.navigateToAvailableParking = navigateToAvailableParking;

function setupParkingMemoryEvents() {
  ensureCleanParkingModalUI();
  ensureSmartParkingGreetingCard();
  renderParkingHeatbars(currentParkingOccupancy);

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

  document.getElementById('btn-parking-save')?.addEventListener('click', async () => {
    await saveParkingSpot(true);
  });

  document.getElementById('btn-parking-delete')?.addEventListener('click', async () => {
    await deleteParkingSpot();
  });

  document.getElementById('btn-parking-navigate-car')?.addEventListener('click', () => {
    navigateToSavedCar();
  });

  document.getElementById('btn-parking-route-available')?.addEventListener('click', () => {
    navigateToAvailableParking(false);
  });

  document.getElementById('btn-parking-full-redirect')?.addEventListener('click', () => {
    navigateToAvailableParking(true);
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
    renderParkingHeatbars(currentParkingOccupancy);
    renderQuickPillarChipsForZone(selectedParkingZone.name, selectedParkingFloor.code);
  }
  window.selectParkingFloor = selectParkingFloor;

  function selectParkingZone(btn) {
    if (!btn) return;
    const zone = btn.getAttribute('data-zone') || 'Mavi';
    const color = btn.getAttribute('data-color') || '#2563eb';
    const status = btn.getAttribute('data-status') || 'available';
    const fullWarningBox = document.getElementById('parking-full-warning-box');

    document.querySelectorAll('.parking-zone-btn').forEach(b => {
      b.classList.remove('active');
      b.className = 'parking-zone-btn py-1.5 px-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer';
    });

    btn.classList.add('active');
    if (zone === 'Mavi') {
      btn.className = 'parking-zone-btn active py-1.5 px-2 rounded-xl border-2 border-blue-600 bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500/50 text-xs font-black flex flex-col items-center justify-center gap-0.5 transition-all shadow-xs cursor-pointer';
    } else if (zone === 'Sarı') {
      btn.className = 'parking-zone-btn active py-1.5 px-2 rounded-xl border-2 border-amber-500 bg-amber-50 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 ring-2 ring-amber-400/50 text-xs font-black flex flex-col items-center justify-center gap-0.5 transition-all shadow-xs cursor-pointer';
    } else if (zone === 'Turuncu') {
      btn.className = 'parking-zone-btn active py-1.5 px-2 rounded-xl border-2 border-orange-500 bg-orange-50 dark:bg-orange-900/40 text-orange-800 dark:text-orange-200 ring-2 ring-orange-400/50 text-xs font-black flex flex-col items-center justify-center gap-0.5 transition-all shadow-xs cursor-pointer';
    } else if (zone === 'Kırmızı') {
      btn.className = 'parking-zone-btn active py-1.5 px-2 rounded-xl border-2 border-red-500 bg-red-50 dark:bg-red-900/40 text-red-800 dark:text-red-200 ring-2 ring-red-400/50 text-xs font-black flex flex-col items-center justify-center gap-0.5 transition-all shadow-xs cursor-pointer';
    }

    if (fullWarningBox) {
      if (status === 'full' || zone === 'Kırmızı') {
        fullWarningBox.classList.remove('hidden');
      } else {
        fullWarningBox.classList.add('hidden');
      }
    }

    selectedParkingZone = {
      name: zone,
      color: color
    };
    renderParkingHeatbars(currentParkingOccupancy);
    renderQuickPillarChipsForZone(selectedParkingZone.name, selectedParkingFloor.code);
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

  // İlk açılışta doluluk ve akıllı karşılama kartını güncelle
  updateParkingUI();
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
  'store_3_27': {
    storeId: 'store_3_27',
    storeName: 'Koton',
    floor: 3,
    x: 396.5,
    y: 550,
    title: 'Koton Sezon Ortası İndirimi',
    discount: '%50 İndirim',
    description: 'Koton Capacity mağazasında seçili kadın, erkek ve çocuk koleksiyonlarında net %50 indirim!',
    couponCode: 'KOTON50',
    category: 'Moda',
    badgeClass: 'bg-red-600'
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
  // Aktif yürüyüş / simülasyon sırasında ekranı kaplayan kampanya bildirimini bastır (yalnızca duraklatıldığında veya manuel çağrıda göster)
  if ((cartSimulator && cartSimulator.isPlaying) || (window.pov3dEngine && window.pov3dEngine.isActive)) {
    return;
  }
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
    const suffix = window.getTurkishPossessiveSuffix ? window.getTurkishPossessiveSuffix(campaign.storeName) : "'nın";
    textEl.textContent = `Şu an ${campaign.storeName}${suffix} yanından geçiyorsunuz.`;
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

// ========================================================
// 🎙️ SESLİ KOMUT ASİSTANI (WEB SPEECH RECOGNITION & TÜRKÇE NLP)
// ========================================================
let activeSpeechRecognition = null;
let isListeningVoice = false;

function openVoiceCommandModal() {
  const modal = document.getElementById('voice-command-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();

  // Modalı açarken mikrofonu otomatik dinlemeye başlat (destekleniyorsa)
  startVoiceRecognition();
}
window.openVoiceCommandModal = openVoiceCommandModal;

function closeVoiceCommandModal() {
  const modal = document.getElementById('voice-command-modal');
  if (modal) modal.classList.add('hidden');
  stopVoiceRecognition();
}
window.closeVoiceCommandModal = closeVoiceCommandModal;

function stopVoiceRecognition() {
  isListeningVoice = false;
  const pulse = document.getElementById('voice-mic-pulse');
  const statusEl = document.getElementById('voice-listen-status');
  if (pulse) pulse.classList.add('hidden');
  if (statusEl) {
    statusEl.textContent = 'Konuşmak için mikrofona dokunun veya aşağıdaki hazır sesli komutlardan birini seçin';
  }
  if (activeSpeechRecognition) {
    try {
      activeSpeechRecognition.stop();
    } catch (e) {}
    activeSpeechRecognition = null;
  }
}

function startVoiceRecognition() {
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  const pulse = document.getElementById('voice-mic-pulse');
  const statusEl = document.getElementById('voice-listen-status');
  const inputEl = document.getElementById('voice-command-input');

  if (!SpeechRec) {
    if (statusEl) {
      statusEl.textContent = '🎙️ Sesli komutunuzu kutuya yazabilir veya örnek komutlara tek tıkla dokunabilirsiniz:';
    }
    inputEl?.focus();
    return;
  }

  try {
    if (activeSpeechRecognition) {
      activeSpeechRecognition.stop();
    }
    const rec = new SpeechRec();
    rec.lang = 'tr-TR';
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    activeSpeechRecognition = rec;
    isListeningVoice = true;

    if (pulse) pulse.classList.remove('hidden');
    if (statusEl) {
      statusEl.textContent = '🔴 Dinleniyor... Lütfen bulunduğunuz yeri ve gitmek istediğiniz mağazayı söyleyin';
    }

    rec.onresult = (event) => {
      let transcript = '';
      let isFinal = false;
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
        if (event.results[i].isFinal) isFinal = true;
      }
      if (inputEl) inputEl.value = transcript.trim();
      if (isFinal && transcript.trim().length > 1) {
        stopVoiceRecognition();
        executeVoiceCommandText(transcript.trim());
      }
    };

    rec.onerror = () => {
      stopVoiceRecognition();
      if (statusEl) {
        statusEl.textContent = '🗣️ Hazır sesli komutlardan birine dokunabilir veya aşağıya yazabilirsiniz:';
      }
    };

    rec.onend = () => {
      isListeningVoice = false;
      if (pulse) pulse.classList.add('hidden');
    };

    rec.start();
  } catch (e) {
    stopVoiceRecognition();
  }
}
window.startVoiceRecognition = startVoiceRecognition;

/**
 * Türkçe Sesli Komut Cümlesini Çözümler ve X Kişisinin Gözünden 3B Rotayı Başlatır
 * Örn: "Pierre Cardin'deyim, Paşabahçe'ye götür" -> Başlangıç: Pierre Cardin, Hedef: Paşabahçe Mağazaları
 */
function executeVoiceCommandText(rawText) {
  if (!rawText || !rawText.trim()) return false;
  const textNorm = normalizeTr(rawText);

  // 1. Tüm Kapı, Buluşma Noktası ve 173 Mağaza Adaylarını Oluştur
  const allStores = getAllStores();
  const candidates = [];

  // Kapılar ve Özel Noktalar
  const gateAliases = [
    { keywords: ['c kapisi', 'c kapisindayim', 'fisekhane'], obj: (mallData.entrances || []).find(e => e.id === 'ent_fisekhane') },
    { keywords: ['b kapisi', 'b kapisindayim', 'carousel'], obj: (mallData.entrances || []).find(e => e.id === 'ent_carousel') },
    { keywords: ['a kapisi', 'a kapisindayim', 'atakoy kapisi'], obj: (mallData.entrances || []).find(e => e.id === 'ent_a_kapisi') },
    { keywords: ['danisma', 'kiosk'], obj: (mallData.entrances || []).find(e => e.id === 'ent_danisma') },
    { keywords: ['muzikli havuz', 'gosteri havuzu', 'havuz'], obj: (mallData.entrances || []).find(e => e.id === 'ent_havuz') }
  ];

  gateAliases.forEach(ga => {
    if (!ga.obj) return;
    for (const kw of ga.keywords) {
      const idx = textNorm.indexOf(kw);
      if (idx !== -1) {
        candidates.push({ index: idx, len: kw.length, item: ga.obj });
        break;
      }
    }
  });

  // Mağazalar
  allStores.forEach(s => {
    const fullNorm = normalizeTr(s.name);
    // "Paşabahçe Mağazaları" -> "pasabahce" gibi kısa kökleri de yakala
    const firstWord = fullNorm.split(/\s+/)[0];
    let matchedIdx = textNorm.indexOf(fullNorm);
    let matchedLen = fullNorm.length;

    if (matchedIdx === -1 && firstWord.length >= 4 && !['kapi', 'kat', 'cafe', 'kafe'].includes(firstWord)) {
      matchedIdx = textNorm.indexOf(firstWord);
      matchedLen = firstWord.length;
    }

    if (matchedIdx !== -1) {
      candidates.push({ index: matchedIdx, len: matchedLen, item: s });
    }
  });

  // Aynı başlangıç indeksindeki çakışmalarda en uzun eşleşmeyi koru ve cümle içi sıraya diz
  candidates.sort((a, b) => a.index - b.index || b.len - a.len);
  const uniqueMatches = [];
  for (const c of candidates) {
    if (!uniqueMatches.some(u => u.item.id === c.item.id || Math.abs(u.index - c.index) < 4)) {
      uniqueMatches.push(c);
    }
  }

  closeVoiceCommandModal();

  // Hareket Kabiliyeti Kısıtlı Kişiler (PMR / Engelsiz Rota) Anahtar Kelime Denetimi
  if (/(engelsiz|tekerlekli sandalye|asansorle|asansor rota|bebek arabasi|pmr)/.test(textNorm)) {
    setRoutePreference('elevator');
  }

  // Otomatik GPS Konum Algılama veya Etkinlik Takvimi Sesli Komutları
  if (/(gps|konumumu bul|otomatik konum|neredeyim)/.test(textNorm) && uniqueMatches.length === 0) {
    detectUserLocationGPS();
    return true;
  }
  if (/(etkinlik|takvim|konser|atolye|gosteri)/.test(textNorm) && uniqueMatches.length === 0) {
    openEventsCalendarModal();
    return true;
  }

  // Hızlı ihtiyaç / servis anahtar kelimeleri (Tuvalet, Bebek Odası, Asansör, Acil Çıkış, Kiosk, Otopark, ATM, Mescit)
  const amenityKeywords = [
    { kw: ['acil cikis', 'yangin merdiveni', 'acil'], kind: 'emergency' },
    { kw: ['bebek', 'emzirme'], kind: 'baby' },
    { kw: ['tuvalet', 'lavabo', 'wc'], kind: 'wc' },
    { kw: ['asansor'], kind: 'elevator' },
    { kw: ['yuruyen merdiven'], kind: 'escalator' },
    { kw: ['kiosk harita', 'dijital kiosk', 'harita ekran'], kind: 'kiosk' },
    { kw: ['mescit', 'namaz'], kind: 'prayer' },
    { kw: ['atm', 'banka', 'bankamatik'], kind: 'atm' },
    { kw: ['otopark', 'araba', 'vale'], kind: 'carpark' },
    { kw: ['sandalye', 'sarj', 'engelli'], kind: 'wheelchair' }
  ];

  let matchedAmenityKind = null;
  for (const ak of amenityKeywords) {
    if (ak.kw.some(k => textNorm.includes(k))) {
      matchedAmenityKind = ak.kind;
      break;
    }
  }

  // Senaryo A: Cümlede hem Başlangıç hem Hedef mağaza/kapı geçtiyse (Örn: "Pierre Cardin'deyim, Paşabahçe'ye götür")
  if (uniqueMatches.length >= 2) {
    const startItem = uniqueMatches[0].item;
    const targetItem = uniqueMatches[1].item;
    setStartLocation(startItem);
    setTargetLocation(targetItem);
    return true;
  }

  // Senaryo B: Cümlede 1 Başlangıç Mağazası/Kapısı + 1 Hizmet/Servis Noktası geçtiyse (Örn: "Pierre Cardin'deyim, acil çıkışa götür" veya "C Kapısındayım, en yakın bebek odasına götür")
  if (uniqueMatches.length === 1 && matchedAmenityKind) {
    const startItem = uniqueMatches[0].item;
    setStartLocation(startItem);
    const nearest = findNearestAmenity(matchedAmenityKind, startItem.floor || currentFloor);
    if (nearest) {
      setTargetLocation(nearest);
      return true;
    }
  }

  // Senaryo C: Cümlede tek bir mağaza/kapı geçtiyse
  if (uniqueMatches.length === 1) {
    const singleItem = uniqueMatches[0].item;
    const isStartIntent = /(deyim|dayim|teyim|tayim|onundeyim|yanindayim|buradayim|girisindeyim)/.test(textNorm) &&
                          !/(gotur|git|nerede|tarif)/.test(textNorm);

    if (isStartIntent) {
      setStartLocation(singleItem);
      if (window.speakNavigationText) {
        window.speakNavigationText(`Konumunuz ${singleItem.name.replace(/^📍\s*/, '')} olarak pinlendi. Gözünüzden 3 boyutlu koridor görünümü açıldı.`, true);
      }
      return true;
    } else {
      if (!selectedStartStore) {
        const defaultStart = (mallData.entrances || []).find(e => e.id === 'ent_fisekhane') || allStores[0];
        if (defaultStart) setStartLocation(defaultStart);
      }
      setTargetLocation(singleItem);
      return true;
    }
  }

  // Senaryo D: Yalnızca hızlı ihtiyaç / servis söylendiyse (Örn: "Asansörler nerede" veya "En yakın tuvalete götür")
  if (matchedAmenityKind) {
    const wantsRoute = /(gotur|git|rota|yuru|tarif|en yakin)/.test(textNorm);
    if (typeof window.highlightAmenitiesOnMap === 'function') {
      window.highlightAmenitiesOnMap(matchedAmenityKind, wantsRoute);
      return true;
    }
    const nearest = findNearestAmenity(matchedAmenityKind, currentFloor);
    if (nearest) {
      if (!selectedStartStore) {
        const defaultStart = (mallData.entrances || []).find(e => e.id === 'ent_fisekhane') || allStores[0];
        if (defaultStart) setStartLocation(defaultStart);
      }
      setTargetLocation(nearest);
      return true;
    }
  }

  showToast(`🎙️ "${rawText}" komutu için mağaza bulunamadı. Lütfen tekrar deneyin.`, 'warning');
  return false;
}
window.executeVoiceCommandText = executeVoiceCommandText;

function setupVoiceCommandEvents() {
  const openTriggers = ['btn-sidebar-voice-cmd', 'btn-header-voice-command', 'btn-pov-voice-cmd'];
  openTriggers.forEach(id => {
    document.getElementById(id)?.addEventListener('click', (e) => {
      e.stopPropagation();
      openVoiceCommandModal();
    });
  });

  document.getElementById('btn-voice-modal-close')?.addEventListener('click', () => {
    closeVoiceCommandModal();
  });

  document.getElementById('voice-modal-backdrop')?.addEventListener('click', () => {
    closeVoiceCommandModal();
  });

  document.getElementById('btn-voice-mic-listen')?.addEventListener('click', () => {
    if (isListeningVoice) {
      stopVoiceRecognition();
    } else {
      startVoiceRecognition();
    }
  });

  const voiceInput = document.getElementById('voice-command-input');
  document.getElementById('btn-voice-command-run')?.addEventListener('click', () => {
    if (voiceInput && voiceInput.value.trim()) {
      executeVoiceCommandText(voiceInput.value.trim());
    }
  });

  voiceInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && voiceInput.value.trim()) {
      e.preventDefault();
      executeVoiceCommandText(voiceInput.value.trim());
    }
  });

  document.querySelectorAll('.voice-sample-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const cmd = chip.getAttribute('data-voice-cmd');
      if (cmd) {
        if (voiceInput) voiceInput.value = cmd;
        executeVoiceCommandText(cmd);
      }
    });
  });
}
window.setupVoiceCommandEvents = setupVoiceCommandEvents;

// ========================================================
// 📡 SITUM-STYLE OTOMATİK KONUM ALGILAMA (GPS + İÇ MEKAN IPS SENSÖRÜ + CANLI YÜRÜYÜŞ TAKİBİ)
// ========================================================
let isGpsLocating = false;
let gpsBeaconIndex = 0;
let liveGpsWatchId = null;

// Bakırköy Capacity AVM Merkez Koordinatları (Fişekhane Cad. / Ataköy 1. Kısım)
const CAPACITY_AVM_LAT = 40.9781;
const CAPACITY_AVM_LNG = 28.8719;

function calculateHaversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371; // Dünya yarıçapı (km)
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function projectGpsToMallSvg(lat, lng) {
  // Capacity AVM sınır kutusu: Kuzey 40.9792, Güney 40.9770, Batı 28.8705, Doğu 28.8735
  const normX = Math.max(0.05, Math.min(0.95, (lng - 28.8705) / (28.8735 - 28.8705)));
  const normY = Math.max(0.05, Math.min(0.95, 1 - (lat - 40.9770) / (40.9792 - 40.9770)));
  return {
    svgX: normX * 1400,
    svgY: normY * 850
  };
}

function startLiveGpsWatchTracking() {
  if (!('geolocation' in navigator) || !navigator.geolocation) return;
  if (liveGpsWatchId !== null) return;
  try {
    liveGpsWatchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (!pos || !pos.coords) return;
        const { latitude, longitude, heading } = pos.coords;
        const distKm = calculateHaversineKm(latitude, longitude, CAPACITY_AVM_LAT, CAPACITY_AVM_LNG);
        // Kullanıcı gerçekten Capacity AVM içindeyse (<= 350m), gerçek yürüyüşünü haritadaki mavi noktaya canlı yansıt
        if (distKm <= 0.35 && mallMap) {
          const { svgX, svgY } = projectGpsToMallSvg(latitude, longitude);
          const activeFl = mallMap.currentFloor || currentFloor || 4;
          mallMap.updateLiveUserLocation(svgX, svgY, activeFl, heading || 0, 'Canlı GPS Konumunuz');
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 8000 }
    );
  } catch (e) {}
}

function getGateCStartObject() {
  const entFisekhane = (mallData?.entrances || []).find(e => e.id === 'ent_fisekhane' || e.id === 'store_gate_c');
  return {
    ...(entFisekhane || {}),
    id: 'store_gate_c',
    alias_id: 'ent_fisekhane',
    name: 'C Kapısı (Fişekhane Cad.)',
    short_name: 'C Kapısı',
    floor: 4,
    cx: entFisekhane?.cx || 1245.0,
    cy: entFisekhane?.cy || 410.0,
    nav_node: entFisekhane?.nav_node || 'n_ent_fisekhane'
  };
}
window.getGateCStartObject = getGateCStartObject;

function detectUserLocationGPS() {
  if (window.isKioskMode) {
    showToast('Kiosk modundasınız. Başlangıç konumu Danışma / Kiosk olarak sabittir.', 'info');
    return;
  }
  if (isGpsLocating) return;
  isGpsLocating = true;

  closeEntranceModal();

  const gpsBtnLabel = document.getElementById('gps-btn-label');
  const gpsBtnIcon = document.getElementById('gps-btn-icon');
  const statusPill = document.getElementById('gps-live-status-pill');
  const statusText = document.getElementById('gps-live-status-text');

  if (gpsBtnLabel) gpsBtnLabel.textContent = 'GPS Taranıyor...';
  if (gpsBtnIcon) gpsBtnIcon.innerHTML = getMonoIconSvg('navigation', 14);

  const finalizeLocation = (lat, lng, accuracyMeters) => {
    isGpsLocating = false;
    const activeFl = currentFloor || 4;
    const floorStores = (mallData?.floors[activeFl]?.stores || []).filter(s => s.nav_node);
    const entrances = mallData?.entrances || [];

    let detectedObj = null;
    let isPhysicallyAtCapacity = false;
    let outsideDistKm = null;

    if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
      const distKm = calculateHaversineKm(lat, lng, CAPACITY_AVM_LAT, CAPACITY_AVM_LNG);
      if (distKm <= 0.35) {
        isPhysicallyAtCapacity = true;
        const { svgX, svgY } = projectGpsToMallSvg(lat, lng);
        const pool = activeFl === 4 ? [...entrances, ...floorStores] : floorStores;
        let bestD = Infinity;
        for (const item of pool) {
          const d = Math.hypot((item.cx || 700) - svgX, (item.cy || 425) - svgY);
          if (d < bestD) {
            bestD = d;
            detectedObj = item;
          }
        }
        if (mallMap) {
          mallMap.updateLiveUserLocation(svgX, svgY, activeFl, 0, 'Canlı GPS Konumunuz');
        }
      } else {
        outsideDistKm = distKm;
      }
    }

    // Kullanıcı AVM dışındaysa (>350m) veya GPS yedeği tetiklendiyse:
    // ASLA B1 katındaki bir mağazayı (örn: Adidas) seçme! Doğrudan C Kapısı (store_gate_c) olarak ata.
    if (!isPhysicallyAtCapacity || !detectedObj) {
      detectedObj = getGateCStartObject();
      if (outsideDistKm === null) {
        outsideDistKm = 1.2;
      }
    }

    if (!detectedObj) return;

    const cleanName = stripUiEmojis(detectedObj.short_name || detectedObj.name || 'C Kapısı');
    const accText = `±${accuracyMeters || '1.8'}m`;

    if (gpsBtnLabel) gpsBtnLabel.textContent = `GPS: ${cleanName.slice(0, 14)}`;
    if (gpsBtnIcon) gpsBtnIcon.innerHTML = getMonoIconSvg('navigation', 14);

    if (statusPill) {
      statusPill.classList.remove('hidden');
      statusPill.classList.add('inline-flex');
    }
    if (statusText) {
      statusText.textContent = isPhysicallyAtCapacity
        ? `CANLI GPS ${accText}`
        : `AVM Dışı (${outsideDistKm.toFixed(1)} km) • C Kapısı`;
    }

    // Haritada B1 katındaki bir mağaza seçili kalmasın
    if (!isPhysicallyAtCapacity && mallMap) {
      mallMap.selectedStore = null;
      mallMap.setSelectedStore(null);
      document.querySelectorAll('.store-card.is-active').forEach(c => c.classList.remove('is-active'));
    }

    setStartLocation(detectedObj);
    window.selectedStartStore = selectedStartStore;

    // Harita üzerinde mavi canlı kullanıcı noktasını (#live-user-gps-dot) hemen göster
    if (mallMap && !isPhysicallyAtCapacity) {
      mallMap.updateLiveUserLocation(
        detectedObj.cx || 1245,
        detectedObj.cy || 410,
        detectedObj.floor || 4,
        0,
        'C Kapısı'
      );
    }

    startLiveGpsWatchTracking();

    if (isPhysicallyAtCapacity) {
      const insideMsg = `Canlı GPS konumunuz algılandı: ${cleanName} (${accText}).`;
      showToast(insideMsg, 'success');
      if (window.speakNavigationText && isVoiceEnabled) {
        window.speakNavigationText(insideMsg, true);
      }
    } else {
      const distKmFormatted = outsideDistKm.toFixed(1);
      window.lastGpsDistanceToMallKm = outsideDistKm;
      const outsideMsg = `AVM dışındasınız (${distKmFormatted} km). Navigasyon en yakın giriş olan C Kapısı üzerinden başlatıldı.`;
      window.lastGpsOutsideNoticeText = outsideMsg;
      showToast(outsideMsg, 'info');
      updateVoiceSubtitleUI(outsideMsg, true);
      if (window.speakNavigationText) {
        window.speakNavigationText(outsideMsg, true);
      }
    }
  };

  if ('geolocation' in navigator && navigator.geolocation) {
    let settled = false;
    const fallbackTimer = setTimeout(() => {
      if (!settled) {
        settled = true;
        finalizeLocation(null, null, '1.8');
      }
    }, 1500);

    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (settled) return;
          settled = true;
          clearTimeout(fallbackTimer);
          const acc = pos.coords && pos.coords.accuracy ? Math.min(3.5, Math.max(1.2, +(pos.coords.accuracy / 10).toFixed(1))) : '1.6';
          finalizeLocation(pos.coords.latitude, pos.coords.longitude, acc);
        },
        () => {
          if (settled) return;
          settled = true;
          clearTimeout(fallbackTimer);
          finalizeLocation(null, null, '1.8');
        },
        { enableHighAccuracy: true, timeout: 1400, maximumAge: 15000 }
      );
    } catch (e) {
      clearTimeout(fallbackTimer);
      finalizeLocation(null, null, '1.8');
    }
  } else {
    setTimeout(() => {
      finalizeLocation(null, null, '1.8');
    }, 350);
  }
}
window.detectUserLocationGPS = detectUserLocationGPS;

function setupGpsAutoLocationEvents() {
  const triggers = ['btn-gps-auto-locate', 'btn-header-gps-locate', 'btn-modal-gps-locate'];
  triggers.forEach(id => {
    document.getElementById(id)?.addEventListener('click', (e) => {
      e.stopPropagation();
      detectUserLocationGPS();
    });
  });
}
window.setupGpsAutoLocationEvents = setupGpsAutoLocationEvents;

// ========================================================
// 1. GPS KULLANIMI İÇİN SEÇİM MODU (CANLI NAVİGASYON VS. ROTA ÖNİZLEME)
// ========================================================
window.activeTravelNavigationMode = 'sim'; // 'gps' | 'sim'
let routeGpsWatchId = null;
let liveGpsSimulatedWalkTimer = null;
let liveGpsRouteWalkIndex = 0;

function stopLiveGpsRouteWalk() {
  if (routeGpsWatchId !== null && 'geolocation' in navigator && navigator.geolocation) {
    try {
      navigator.geolocation.clearWatch(routeGpsWatchId);
    } catch (e) {}
    routeGpsWatchId = null;
  }
  if (liveGpsSimulatedWalkTimer) {
    clearInterval(liveGpsSimulatedWalkTimer);
    liveGpsSimulatedWalkTimer = null;
  }
}
window.stopLiveGpsRouteWalk = stopLiveGpsRouteWalk;

function updateTravelModeButtonsUI() {
  const mode = window.activeTravelNavigationMode || 'sim';
  const gpsBtns = document.querySelectorAll('[data-travel-mode="gps"], #btn-choose-mode-gps, #btn-hud-mode-gps');
  const simBtns = document.querySelectorAll('[data-travel-mode="sim"], #btn-choose-mode-2d, #btn-hud-mode-sim');

  gpsBtns.forEach(btn => {
    btn.classList.toggle('is-active-mode', mode === 'gps');
    btn.setAttribute('aria-pressed', mode === 'gps' ? 'true' : 'false');
  });
  simBtns.forEach(btn => {
    btn.classList.toggle('is-active-mode', mode === 'sim');
    btn.setAttribute('aria-pressed', mode === 'sim' ? 'true' : 'false');
  });
}
window.updateTravelModeButtonsUI = updateTravelModeButtonsUI;

function startLiveGpsRouteWalk() {
  stopLiveGpsRouteWalk();
  window.activeTravelNavigationMode = 'gps';

  const cKapisiRef = getGateCStartObject();

  let hasHandledOutsideNotice = false;
  const triggerOutsideReferenceWalk = (distKmVal) => {
    if (hasHandledOutsideNotice) return;
    hasHandledOutsideNotice = true;
    const outsideNoticeShownAt = Date.now();

    // Başlangıç düğümü doğrudan C Kapısı (store_gate_c) olarak atansın; haritada B1 katındaki bir mağaza seçili kalmasın!
    selectedStartStore = cKapisiRef;
    window.selectedStartStore = cKapisiRef;
    currentFloor = 4;
    updateStartBadgeUI(cKapisiRef.name);
    const startInput = document.getElementById('input-start-loc');
    if (startInput) startInput.value = cKapisiRef.name;

    if (mallMap) {
      mallMap.selectedStore = null;
      mallMap.setSelectedStore(null);
      mallMap.activeStartStore = cKapisiRef;
    }

    // Eğer hedef seçiliyse ve mevcut rota C Kapısı'ndan (n_ent_fisekhane) başlamıyorsa rotayı C Kapısı'ndan yeniden hesapla
    if (selectedTargetStore && navEngine && typeof navEngine.findRoute === 'function') {
      const currentFirstNodeId = lastCalculatedRoute?.pathNodes?.[0]?.id;
      if (currentFirstNodeId !== cKapisiRef.nav_node) {
        const recalc = navEngine.findRoute(
          cKapisiRef.nav_node,
          selectedTargetStore.nav_node,
          activeRouteMode,
          currentPathPreference
        );
        if (recalc && recalc.pathNodes && recalc.pathNodes.length > 0) {
          recalc.path = recalc.pathNodes;
          lastCalculatedRoute = recalc;
          window.lastCalculatedRoute = recalc;
          updateHeaderNavSummary(selectedTargetStore, recalc);
          if (mallMap) {
            mallMap.renderRoute(recalc);
            mallMap.updateActiveStorePolygons();
          }
        }
      }
    } else if (mallMap) {
      mallMap.updateActiveStorePolygons();
    }

    const statusPill = document.getElementById('gps-live-status-pill');
    const statusText = document.getElementById('gps-live-status-text');
    if (statusPill) {
      statusPill.classList.remove('hidden');
      statusPill.classList.add('inline-flex');
    }
    if (statusText) {
      statusText.textContent = 'CANLI NAVİGASYON • C KAPISI';
    }

    const effectiveDistKm = (typeof distKmVal === 'number' && !isNaN(distKmVal) && distKmVal > 0)
      ? distKmVal
      : (typeof window.lastGpsDistanceToMallKm === 'number' && window.lastGpsDistanceToMallKm > 0 ? window.lastGpsDistanceToMallKm : 1.2);
    const distFormatted = effectiveDistKm.toFixed(1);
    window.lastGpsDistanceToMallKm = effectiveDistKm;

    const politeMsg = `AVM dışındasınız (${distFormatted} km). Navigasyon en yakın giriş olan C Kapısı üzerinden başlatıldı.`;
    window.lastGpsOutsideNoticeText = politeMsg;

    // Ekrana ve ses motoruna dış mekan C Kapısı başlangıç metnini ver
    showToast(politeMsg, 'info');
    updateVoiceSubtitleUI(politeMsg, true);
    const liveNavBanner = document.getElementById('header-live-nav-banner');
    if (liveNavBanner) liveNavBanner.classList.remove('hidden');
    const liveNavTextEl = document.getElementById('live-nav-text');
    if (liveNavTextEl) {
      liveNavTextEl.textContent = politeMsg;
    }
    if (typeof window.speakNavigationText === 'function') {
      window.speakNavigationText(politeMsg, true);
    }

    // İlk düğümü C Kapısı (Zemin Kat - 4) üzerinde #live-user-gps-dot olarak göster
    const nodesNow = lastCalculatedRoute?.pathNodes || [];
    const firstNode = nodesNow[0] || { x: cKapisiRef.cx, y: cKapisiRef.cy, floor: 4 };
    const secondNode = nodesNow[1] || firstNode;
    const initHeading = (Math.atan2(secondNode.y - firstNode.y, secondNode.x - firstNode.x) * 180) / Math.PI;
    liveGpsRouteWalkIndex = 0;

    if (mallMap && typeof mallMap.updateLiveUserLocation === 'function') {
      if (mallMap.currentFloor !== 4) {
        mallMap.loadFloor(4).then(() => {
          updateFloorUI(4);
          mallMap.updateLiveUserLocation(firstNode.x, firstNode.y, 4, initHeading, 'Canlı Navigasyon (C Kapısı)');
        });
      } else {
        mallMap.updateLiveUserLocation(firstNode.x, firstNode.y, 4, initHeading, 'Canlı Navigasyon (C Kapısı)');
      }
    }

    // Harita üzerinde #live-user-gps-dot noktasını rota boyunca adım adım ilerlet
    if (liveGpsSimulatedWalkTimer) clearInterval(liveGpsSimulatedWalkTimer);
    liveGpsSimulatedWalkTimer = setInterval(() => {
      if (window.activeTravelNavigationMode !== 'gps' || !lastCalculatedRoute) {
        stopLiveGpsRouteWalk();
        return;
      }
      // İlk 2.5 saniye boyunca dış mekan C Kapısı anonsunu ekranda sabit tut
      if (Date.now() - outsideNoticeShownAt < 2500) {
        return;
      }
      const nodes = lastCalculatedRoute.pathNodes || [];
      if (nodes.length === 0) return;

      liveGpsRouteWalkIndex = Math.min(nodes.length - 1, liveGpsRouteWalkIndex + 1);
      const cur = nodes[liveGpsRouteWalkIndex];
      const prev = nodes[Math.max(0, liveGpsRouteWalkIndex - 1)];
      const headingDeg = (Math.atan2(cur.y - prev.y, cur.x - prev.x) * 180) / Math.PI;
      const ratio = nodes.length > 1 ? liveGpsRouteWalkIndex / (nodes.length - 1) : 1;

      if (mallMap) {
        if (mallMap.currentFloor !== cur.floor) {
          mallMap.loadFloor(cur.floor).then(() => {
            updateFloorUI(cur.floor);
            mallMap.updateLiveUserLocation(cur.x, cur.y, cur.floor, headingDeg, 'Canlı Konumunuz');
          });
        } else {
          mallMap.updateLiveUserLocation(cur.x, cur.y, cur.floor, headingDeg, 'Canlı Konumunuz');
        }
      }

      const insCount = (lastCalculatedRoute.instructions || []).length;
      const stepIdx = insCount > 1 ? Math.min(insCount - 1, Math.floor(ratio * insCount)) : 0;

      if (liveGpsRouteWalkIndex >= nodes.length - 1) {
        clearInterval(liveGpsSimulatedWalkTimer);
        liveGpsSimulatedWalkTimer = null;
        const reachedStore = selectedTargetStore;
        if (reachedStore && typeof reachedStore === 'object') {
          window.lastReachedStore = reachedStore;
        }
        updateLiveNavHUD(-1, 100);
        if (typeof markRouteAsCompletedOnMap === 'function') {
          markRouteAsCompletedOnMap();
        }
        if (window.arrivalResetTimer) clearTimeout(window.arrivalResetTimer);
        const extraSpeechDelay = window.wasArrivalSpeechQueued ? Math.min(1500, window.queuedArrivalDelayMs || 500) : 0;
        window.arrivalResetTimer = setTimeout(() => {
          if (typeof window.completeAndResetRouteTo2D === 'function') {
            window.completeAndResetRouteTo2D(reachedStore);
          }
        }, 1500 + extraSpeechDelay);
      } else {
        updateLiveNavHUD(stepIdx, ratio * 100);
      }
    }, 950);
  };

  if ('geolocation' in navigator && navigator.geolocation) {
    const watchFallbackTimer = setTimeout(() => {
      if (!hasHandledOutsideNotice && window.activeTravelNavigationMode === 'gps') {
        triggerOutsideReferenceWalk(null);
      }
    }, 1200);

    try {
      routeGpsWatchId = navigator.geolocation.watchPosition(
        (pos) => {
          clearTimeout(watchFallbackTimer);
          if (!pos || !pos.coords || window.activeTravelNavigationMode !== 'gps') return;
          const { latitude, longitude, heading } = pos.coords;
          const distKm = calculateHaversineKm(latitude, longitude, CAPACITY_AVM_LAT, CAPACITY_AVM_LNG);

          if (distKm <= 0.35 && mallMap) {
            hasHandledOutsideNotice = true;
            const { svgX, svgY } = projectGpsToMallSvg(latitude, longitude);
            const activeFl = mallMap.currentFloor || currentFloor || 4;
            const proj = (navEngine && typeof navEngine.projectPointOntoRoute === 'function' && lastCalculatedRoute)
              ? navEngine.projectPointOntoRoute(lastCalculatedRoute, svgX, svgY, activeFl)
              : null;
            const dotX = proj ? proj.x : svgX;
            const dotY = proj ? proj.y : svgY;
            const dotFloor = proj ? proj.floor : activeFl;
            const dotHeading = typeof heading === 'number' && !isNaN(heading) ? heading : (proj ? proj.heading : 0);

            mallMap.updateLiveUserLocation(dotX, dotY, dotFloor, dotHeading, 'Canlı GPS Konumunuz');
            if (proj && lastCalculatedRoute) {
              const insCount = (lastCalculatedRoute.instructions || []).length;
              const stepIdx = insCount > 1 ? Math.min(insCount - 1, Math.floor(proj.progressRatio * insCount)) : 0;
              updateLiveNavHUD(stepIdx, proj.progressRatio * 100);
            }
          } else {
            triggerOutsideReferenceWalk(distKm);
          }
        },
        () => {
          clearTimeout(watchFallbackTimer);
          triggerOutsideReferenceWalk(null);
        },
        { enableHighAccuracy: true, maximumAge: 2500, timeout: 5000 }
      );
    } catch (e) {
      clearTimeout(watchFallbackTimer);
      triggerOutsideReferenceWalk(null);
    }
  } else {
    triggerOutsideReferenceWalk(null);
  }
}
window.startLiveGpsRouteWalk = startLiveGpsRouteWalk;

function setTravelNavigationMode(mode) {
  const targetMode = mode === 'gps' ? 'gps' : 'sim';
  window.activeTravelNavigationMode = targetMode;

  document.getElementById('route-mode-choice-modal')?.classList.add('hidden');

  if (window.pov3dEngine && window.pov3dEngine.isActive) {
    window.setMapViewMode('2d');
  }

  // Eğer rota daha önce tamamlanmışsa (.route-completed), tekrar yürüyüş/önizleme için aktif görünüme döndür
  if (window.isRouteCompletedState && mallMap && mallMap.routeSvg) {
    window.isRouteCompletedState = false;
    mallMap.routeSvg.classList.remove('route-completed');
    mallMap.routeSvg.querySelectorAll('.route-completed').forEach(el => {
      el.classList.remove('route-completed');
      el.style.opacity = '';
    });
    const routeGroup = mallMap.routeSvg.querySelector('.route-group') || mallMap.routeSvg;
    if (routeGroup) routeGroup.style.opacity = '1';
  }

  const playText = document.getElementById('sim-play-text');
  const hudPlayText = document.getElementById('hud-sim-text');

  if (targetMode === 'gps') {
    if (cartSimulator) {
      cartSimulator.pause();
      if (cartSimulator.cartEl) {
        cartSimulator.cartEl.style.display = 'none';
      }
    }
    if (playText) playText.textContent = 'Canlı Navigasyon';
    if (hudPlayText) hudPlayText.textContent = 'Canlı Navigasyon';
    startLiveGpsRouteWalk();
  } else {
    stopLiveGpsRouteWalk();
    if (cartSimulator) {
      if (cartSimulator.cartEl) {
        cartSimulator.cartEl.style.display = 'block';
      }
      if (cartSimulator.currentIndex >= (cartSimulator.route?.pathNodes?.length || 1) - 1) {
        cartSimulator.resetToStart();
      }
      cartSimulator.start();
    }
    if (playText) playText.textContent = 'Duraklat';
    if (hudPlayText) hudPlayText.textContent = 'Duraklat';
    const hudPlayBtn = document.getElementById('btn-hud-sim-play');
    if (hudPlayBtn) {
      hudPlayBtn.className = 'flex-1 min-w-[78px] sm:min-w-[96px] h-9 sm:h-11 min-h-[36px] px-2 sm:px-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1 transition-all shadow-md shadow-amber-500/25 active:scale-95 shrink-0';
    }
  }

  updateTravelModeButtonsUI();
}
window.setTravelNavigationMode = setTravelNavigationMode;

function setupTravelModeSelectorUI() {
  // 1. Rota Hazır Kartındaki (#route-mode-choice-modal) butonları kurumsal sadelikte (Canlı Navigasyon vs. Rota Önizleme) yapılandır
  const choiceModal = document.getElementById('route-mode-choice-modal');
  if (choiceModal) {
    const gridContainer = choiceModal.querySelector('.grid') || choiceModal.querySelector('.flex.flex-col.gap-2');
    if (gridContainer) {
      gridContainer.className = 'flex flex-col gap-2';
      gridContainer.innerHTML = `
        <div class="grid grid-cols-2 gap-2">
          <button type="button" id="btn-choose-mode-gps" data-travel-mode="gps" class="nav-travel-mode-btn py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs flex flex-col items-center justify-center gap-1 shadow-md shadow-emerald-600/25 active:scale-95 transition-all cursor-pointer">
            <span class="text-sm sm:text-base leading-none flex items-center gap-1.5">${getMonoIconSvg('navigation', 15)}<span>Canlı Navigasyon</span></span>
            <span class="text-[10px] font-semibold text-emerald-100">Gerçek GPS ile Adım Adım</span>
          </button>
          <button type="button" id="btn-choose-mode-2d" data-travel-mode="sim" class="nav-travel-mode-btn is-active-mode py-2.5 px-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-extrabold text-xs flex flex-col items-center justify-center gap-1 shadow-md shadow-cyan-600/25 active:scale-95 transition-all cursor-pointer">
            <span class="text-sm sm:text-base leading-none flex items-center gap-1.5">${getMonoIconSvg('play', 15)}<span>Rota Önizleme</span></span>
            <span class="text-[10px] font-semibold text-cyan-100">Adım Adım Simülasyon</span>
          </button>
        </div>
        <div id="modal-sim-speed-selector" class="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80">
          <span class="text-[10.5px] font-extrabold text-slate-600 dark:text-slate-300 flex items-center gap-1">Simülasyon Hızı:</span>
          <div class="flex items-center gap-1">
            <button type="button" id="btn-modal-speed-1x" data-sim-speed="1" class="sim-speed-choice-btn is-active-speed px-2.5 py-1 rounded-lg text-[11px] font-extrabold border border-cyan-500 bg-cyan-600 text-white shadow-xs transition-all cursor-pointer">1x</button>
            <button type="button" id="btn-modal-speed-2x" data-sim-speed="2" class="sim-speed-choice-btn px-2.5 py-1 rounded-lg text-[11px] font-extrabold border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 transition-all cursor-pointer">2x</button>
            <button type="button" id="btn-modal-speed-4x" data-sim-speed="4" class="sim-speed-choice-btn px-2.5 py-1 rounded-lg text-[11px] font-extrabold border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 transition-all cursor-pointer">4x</button>
          </div>
        </div>
        <button type="button" id="btn-choose-mode-pov" class="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-orange-500 to-rose-600 hover:from-orange-400 hover:to-rose-500 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-md shadow-orange-500/25 active:scale-95 transition-all cursor-pointer">
          ${getMonoIconSvg('eye', 15)}
          <span class="text-sm leading-none">3B Görünüm</span>
          <span class="text-[10px] font-semibold text-orange-100">• Koridorda Yürü</span>
        </button>
      `;
    }
  }

  // Adım Adım Detay Çekmecesine de (#hud-steps-drawer) 1x / 2x / 4x Hız Seçici Ekle
  const stepsDrawer = document.getElementById('hud-steps-drawer');
  const routePathChips = document.getElementById('route-path-chips');
  if (stepsDrawer && routePathChips && !document.getElementById('drawer-sim-speed-selector')) {
    const drawerSpeedRow = document.createElement('div');
    drawerSpeedRow.id = 'drawer-sim-speed-selector';
    drawerSpeedRow.className = 'flex items-center justify-between gap-2 pb-1.5 border-b border-slate-100 dark:border-slate-800';
    drawerSpeedRow.innerHTML = `
      <span class="text-[11px] font-bold text-slate-600 dark:text-slate-300">Simülasyon Hızı:</span>
      <div class="flex items-center gap-1">
        <button type="button" data-sim-speed="1" class="sim-speed-choice-btn is-active-speed px-2.5 py-1 rounded-lg text-[11px] font-extrabold border border-cyan-500 bg-cyan-600 text-white shadow-xs transition-all cursor-pointer">1x</button>
        <button type="button" data-sim-speed="2" class="sim-speed-choice-btn px-2.5 py-1 rounded-lg text-[11px] font-extrabold border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 transition-all cursor-pointer">2x</button>
        <button type="button" data-sim-speed="4" class="sim-speed-choice-btn px-2.5 py-1 rounded-lg text-[11px] font-extrabold border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 transition-all cursor-pointer">4x</button>
      </div>
    `;
    stepsDrawer.insertBefore(drawerSpeedRow, routePathChips.nextSibling);
  }

  document.querySelectorAll('.sim-speed-choice-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const spd = Number(btn.getAttribute('data-sim-speed')) || 1;
      setSimSpeed(spd);
    });
  });

  // 2. #nav-hud-bar ve iç kapsayıcısındaki 'overflow-hidden' kısıtlamasını kaldırıp yatay kaydırmayı (horizontal-chip-scroller) aktif et
  const hudBar = document.getElementById('nav-hud-bar');
  const hudPlayBtn = document.getElementById('btn-hud-sim-play');
  if (hudBar) {
    hudBar.classList.remove('overflow-hidden');
    hudBar.classList.add('overflow-x-auto', 'horizontal-chip-scroller');
  }
  if (hudPlayBtn && hudPlayBtn.parentElement) {
    const innerRow = hudPlayBtn.parentElement;
    innerRow.classList.remove('overflow-hidden');
    innerRow.classList.add('overflow-x-auto', 'horizontal-chip-scroller');
    hudPlayBtn.classList.remove('min-w-[104px]');
    hudPlayBtn.classList.add('min-w-[78px]', 'sm:min-w-[100px]', 'px-2', 'sm:px-3');
  }

  // Üst karttaki (#floor-header-card) buton satırını da yatay kaydırılabilir yap
  const headerTopRow = document.querySelector('#floor-header-card > div:first-child');
  if (headerTopRow) {
    headerTopRow.classList.add('overflow-x-auto', 'horizontal-chip-scroller');
  }

  // 3. Başlat butonunun yanına (#nav-hud-bar içine) tek tıkla geçiş sağlayan kompakt Canlı Navigasyon / Rota Önizleme mod seçici butonları ekle
  if (hudPlayBtn && hudPlayBtn.parentElement && !document.getElementById('hud-travel-mode-switch')) {
    const modeSwitchWrap = document.createElement('div');
    modeSwitchWrap.id = 'hud-travel-mode-switch';
    modeSwitchWrap.className = 'flex items-center gap-0.5 sm:gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 sm:p-1 rounded-xl border border-slate-200/80 dark:border-slate-700 shrink-0';
    modeSwitchWrap.innerHTML = `
      <button type="button" id="btn-hud-mode-gps" data-travel-mode="gps" class="nav-travel-mode-btn h-8 px-1.5 sm:px-2.5 rounded-lg text-[10px] sm:text-xs font-extrabold bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-700 dark:text-emerald-300 flex items-center gap-1 cursor-pointer transition-all shrink-0" title="Canlı Navigasyon (Gerçek Cihaz GPS'i ile Takip)">
        ${getMonoIconSvg('navigation', 14)}
        <span>Canlı Navigasyon</span>
      </button>
      <button type="button" id="btn-hud-mode-sim" data-travel-mode="sim" class="nav-travel-mode-btn is-active-mode h-8 px-1.5 sm:px-2.5 rounded-lg text-[10px] sm:text-xs font-extrabold bg-cyan-600/15 hover:bg-cyan-600/25 text-cyan-700 dark:text-cyan-300 flex items-center gap-1 cursor-pointer transition-all shrink-0" title="Rota Önizleme (Adım Adım Simülasyon)">
        ${getMonoIconSvg('play', 14)}
        <span>Rota Önizleme</span>
      </button>
    `;
    hudPlayBtn.parentElement.insertBefore(modeSwitchWrap, hudPlayBtn);
  }

  // Yatay kaydırma olaylarını yeniden bağla
  if (typeof setupHorizontalChipScrollers === 'function') {
    setupHorizontalChipScrollers();
  }

  // Olay dinleyicilerini bağla
  document.getElementById('btn-choose-mode-gps')?.addEventListener('click', (e) => {
    e.stopPropagation();
    setTravelNavigationMode('gps');
  });

  document.getElementById('btn-choose-mode-2d')?.addEventListener('click', (e) => {
    e.stopPropagation();
    setTravelNavigationMode('sim');
  });

  document.getElementById('btn-choose-mode-pov')?.addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('route-mode-choice-modal')?.classList.add('hidden');
    window.setMapViewMode('pov');
  });

  document.getElementById('btn-hud-mode-gps')?.addEventListener('click', (e) => {
    e.stopPropagation();
    setTravelNavigationMode('gps');
  });

  document.getElementById('btn-hud-mode-sim')?.addEventListener('click', (e) => {
    e.stopPropagation();
    setTravelNavigationMode('sim');
  });

  updateTravelModeButtonsUI();
  updateHeaderResetButtonVisibility();
}
window.setupTravelModeSelectorUI = setupTravelModeSelectorUI;


// ========================================================
// TAKVİMİNİZDE YER ALAN ETKİNLİKLERİN KONUMLARI (SITUM EVENTS CALENDAR)
// ========================================================
const CAPACITY_MALL_EVENTS = [
  {
    id: 'evt_fountain_show',
    title: 'Müzikli Gösteri Havuzu Su & Işık Şovu',
    category: 'Canlı Gösteri',
    timeBadge: 'Şu An Canlı • Her Saat Başı',
    dateText: 'Bugün 10:00 - 22:00',
    floor: 4,
    floorLabel: 'Zemin Kat',
    venueName: 'Merkez Atrium • Müzikli Gösteri Havuzu',
    targetId: 'ent_havuz',
    description: 'Capacity AVM Merkez Atriumda koreografik su, ışık ve müzik gösterisi. Engelsiz izleme terası mevcuttur.',
    defaultInCalendar: true
  },
  {
    id: 'evt_kids_robotics',
    title: 'Çocuk Bilim, Sanat & Robotik Atölyesi',
    category: 'Çocuk & Aile',
    timeBadge: 'Bugün 15:00 - 18:00',
    dateText: 'Bugün 15:00',
    floor: 3,
    floorLabel: '1. Bodrum Kat (B1)',
    venueName: 'B1 Etkinlik Meydanı (D&R & Toyzz Shop Yanı)',
    targetStoreName: 'D&R',
    targetId: 'store_3_12',
    description: '4-12 yaş çocuklar için ücretsiz kodlama, robotik tasarım ve seramik boyama atölyesi.',
    defaultInCalendar: true
  },
  {
    id: 'evt_cinema_gala',
    title: 'Paribu Cineverse Özel Gala & Yönetmen Söyleşisi',
    category: 'Sinema & Sanat',
    timeBadge: 'Bugün 19:30',
    dateText: 'Bugün 19:30',
    floor: 6,
    floorLabel: '2. Kat',
    venueName: 'Paribu Cineverse Sinema Fuaye Alanı',
    targetStoreName: 'Paribu Cineverse',
    targetId: 'store_6_1',
    description: 'Vizyondaki yeni filmin oyuncularıyla söyleşi ve özel ön gösterim etkinliği.',
    defaultInCalendar: false
  },
  {
    id: 'evt_jazz_concert',
    title: 'Akustik Caz & Piyano Dinletisi',
    category: 'Canlı Müzik',
    timeBadge: 'Bugün 17:00 - 19:00',
    dateText: 'Bugün 17:00',
    floor: 4,
    floorLabel: 'Zemin Kat',
    venueName: 'Zemin Kat Kahve Meydanı (Starbucks & Vakko Yanı)',
    targetStoreName: 'Starbucks',
    targetId: 'store_4_37',
    description: 'Alışverişinize eşlik eden canlı saksafon ve akustik piyano performansı.',
    defaultInCalendar: false
  },
  {
    id: 'evt_beauty_masterclass',
    title: 'Sephora Cilt Bakımı & Makyaj Masterclass',
    category: 'Güzellik & Moda',
    timeBadge: 'Bugün 16:00 - 20:00',
    dateText: 'Bugün 16:00',
    floor: 5,
    floorLabel: '1. Kat',
    venueName: '1. Kat Sephora Mağaza İçi Deneyim Alanı',
    targetStoreName: 'Sephora',
    targetId: 'store_5_34',
    description: 'Uzman makyaj artistleriyle ücretsiz cilt analizi ve yeni sezon makyaj uygulamaları.',
    defaultInCalendar: false
  }
];

let activeEventsTab = 'all'; // 'all' | 'saved'

function getSavedCalendarEventIds() {
  try {
    const raw = localStorage.getItem('capacity_saved_events_v1');
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  const defaults = CAPACITY_MALL_EVENTS.filter(e => e.defaultInCalendar).map(e => e.id);
  try {
    localStorage.setItem('capacity_saved_events_v1', JSON.stringify(defaults));
  } catch (e) {}
  return defaults;
}

function toggleSaveEventToCalendar(eventId) {
  const saved = new Set(getSavedCalendarEventIds());
  const evt = CAPACITY_MALL_EVENTS.find(e => e.id === eventId);
  if (saved.has(eventId)) {
    saved.delete(eventId);
    if (evt) showToast(`"${evt.title}" takviminizden çıkarıldı.`, 'info');
  } else {
    saved.add(eventId);
    if (evt) showToast(`"${evt.title}" takviminize eklendi.`, 'success');
  }
  const arr = Array.from(saved);
  try {
    localStorage.setItem('capacity_saved_events_v1', JSON.stringify(arr));
  } catch (e) {}
  renderEventsCalendarList();
}
window.toggleSaveEventToCalendar = toggleSaveEventToCalendar;

function resolveEventTargetObject(evt) {
  if (!evt || !mallData) return null;
  if (evt.targetId && evt.targetId.startsWith('ent_')) {
    const ent = (mallData.entrances || []).find(e => e.id === evt.targetId);
    if (ent) return ent;
  }
  const allStores = getAllStores();
  if (evt.targetStoreName) {
    const byName = allStores.find(s => normalizeTr(s.name).includes(normalizeTr(evt.targetStoreName)));
    if (byName) return byName;
  }
  if (evt.targetId) {
    const byId = allStores.find(s => s.id === evt.targetId);
    if (byId) return byId;
  }
  const floorStores = allStores.filter(s => s.floor === evt.floor);
  return floorStores[0] || allStores[0];
}

function navigateToEventLocation(eventId) {
  const evt = CAPACITY_MALL_EVENTS.find(e => e.id === eventId);
  if (!evt) return;
  const targetObj = resolveEventTargetObject(evt);
  if (!targetObj) return;

  closeEventsCalendarModal();

  if (!selectedStartStore || selectedStartStore.id === targetObj.id) {
    const defaultEnt = (mallData?.entrances || []).find(e => e.id === 'ent_fisekhane') || (mallData?.entrances || [])[0];
    if (defaultEnt) {
      setStartLocation(defaultEnt);
    }
  }

  setTargetLocation({
    ...targetObj,
    name: `${evt.title} (${targetObj.short_name || targetObj.name})`
  });

  showToast(`"${evt.title}" etkinlik konumuna (${evt.floorLabel}) rota çizildi.`, 'success');
}
window.navigateToEventLocation = navigateToEventLocation;

function viewEventIn3D(eventId) {
  const evt = CAPACITY_MALL_EVENTS.find(e => e.id === eventId);
  if (!evt) return;
  const targetObj = resolveEventTargetObject(evt);
  if (!targetObj) return;

  closeEventsCalendarModal();

  if (window.setMapViewMode) {
    window.setMapViewMode('pov');
  }
  if (window.pov3dEngine && typeof window.pov3dEngine.teleportInFrontOfStore === 'function') {
    window.pov3dEngine.teleportInFrontOfStore(targetObj);
  }
  showToast(`"${evt.title}" etkinlik alanı (${evt.venueName}) 3B görünümde açıldı.`, 'info');
}
window.viewEventIn3D = viewEventIn3D;

function renderEventsCalendarList() {
  const listEl = document.getElementById('events-calendar-list');
  const savedCountEl = document.getElementById('saved-events-count');
  const tabAll = document.getElementById('tab-events-all');
  const tabSaved = document.getElementById('tab-events-saved');
  if (!listEl) return;

  const savedIds = new Set(getSavedCalendarEventIds());
  if (savedCountEl) savedCountEl.textContent = String(savedIds.size);

  if (tabAll && tabSaved) {
    if (activeEventsTab === 'all') {
      tabAll.className = 'flex-1 py-1.5 px-3 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-xs font-extrabold shadow-xs transition-all cursor-pointer';
      tabSaved.className = 'flex-1 py-1.5 px-3 rounded-xl text-slate-600 dark:text-slate-300 text-xs font-bold hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer';
    } else {
      tabSaved.className = 'flex-1 py-1.5 px-3 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-xs font-extrabold shadow-xs transition-all cursor-pointer';
      tabAll.className = 'flex-1 py-1.5 px-3 rounded-xl text-slate-600 dark:text-slate-300 text-xs font-bold hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer';
    }
  }

  const items = activeEventsTab === 'saved'
    ? CAPACITY_MALL_EVENTS.filter(e => savedIds.has(e.id))
    : CAPACITY_MALL_EVENTS;

  if (items.length === 0) {
    listEl.innerHTML = `
      <div class="py-10 text-center text-slate-400 flex flex-col items-center gap-2">
        ${getMonoIconSvg('info', 22)}
        <div class="text-xs font-bold text-slate-700 dark:text-slate-300">Takviminizde henüz kayıtlı etkinlik yok</div>
        <p class="text-[11px] text-slate-400">Tüm etkinlikler sekmesinden ilgilendiğiniz etkinlikleri takviminize ekleyebilirsiniz.</p>
      </div>
    `;
    return;
  }

  listEl.innerHTML = items.map(evt => {
    const isSaved = savedIds.has(evt.id);
    return `
      <div class="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/75 border ${isSaved ? 'border-violet-500/45 ring-1 ring-violet-500/20' : 'border-slate-200/80 dark:border-slate-700/80'} flex flex-col gap-2 transition-all">
        <div class="flex items-start justify-between gap-2">
          <div class="flex items-center gap-2.5 min-w-0">
            <div class="w-10 h-10 rounded-2xl bg-violet-500/15 text-violet-600 dark:text-violet-300 flex items-center justify-center shrink-0">
              ${getMonoIconSvg('pin', 16)}
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="px-2 py-0.5 rounded-md bg-violet-500/15 text-violet-700 dark:text-violet-300 text-[10px] font-black">${evt.timeBadge}</span>
                <span class="px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-bold">${evt.floorLabel}</span>
              </div>
              <h4 class="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white mt-1 leading-snug">${evt.title}</h4>
            </div>
          </div>
          <button type="button" onclick="window.toggleSaveEventToCalendar('${evt.id}')" class="px-2.5 py-1 rounded-xl text-[10.5px] font-extrabold shrink-0 transition-all cursor-pointer ${isSaved ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/35' : 'bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-violet-500/20'}">
            ${isSaved ? 'Takvimimde' : 'Takvime Ekle'}
          </button>
        </div>

        <div class="text-[11px] font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
          ${getMonoIconSvg('pin', 13)}
          <span>Konum: <strong class="text-slate-800 dark:text-slate-100">${evt.venueName}</strong></span>
        </div>

        <p class="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">${evt.description}</p>

        <div class="grid grid-cols-2 gap-2 pt-1">
          <button type="button" onclick="window.navigateToEventLocation('${evt.id}')" class="py-2 px-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer">
            ${getMonoIconSvg('navigation', 14)}
            <span>Etkinlik Konumuna Rota Çiz</span>
          </button>
          <button type="button" onclick="window.viewEventIn3D('${evt.id}')" class="py-2 px-3 rounded-xl bg-slate-200/90 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer">
            ${getMonoIconSvg('eye', 14)}
            <span>3B Görünümde Gör</span>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function openEventsCalendarModal() {
  const modal = document.getElementById('events-calendar-modal');
  if (!modal) return;
  renderEventsCalendarList();
  modal.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}
window.openEventsCalendarModal = openEventsCalendarModal;

function closeEventsCalendarModal() {
  document.getElementById('events-calendar-modal')?.classList.add('hidden');
}
window.closeEventsCalendarModal = closeEventsCalendarModal;

function setupEventsCalendarEvents() {
  const openBtns = ['btn-quick-events', 'btn-amenity-events', 'btn-header-events'];
  openBtns.forEach(id => {
    document.getElementById(id)?.addEventListener('click', (e) => {
      e.stopPropagation();
      openEventsCalendarModal();
    });
  });

  document.getElementById('btn-events-modal-close')?.addEventListener('click', () => {
    closeEventsCalendarModal();
  });

  document.getElementById('events-modal-backdrop')?.addEventListener('click', () => {
    closeEventsCalendarModal();
  });

  document.getElementById('tab-events-all')?.addEventListener('click', () => {
    activeEventsTab = 'all';
    renderEventsCalendarList();
  });

  document.getElementById('tab-events-saved')?.addEventListener('click', () => {
    activeEventsTab = 'saved';
    renderEventsCalendarList();
  });
}
window.setupEventsCalendarEvents = setupEventsCalendarEvents;

// Arayüzdeki tüm butonlardan, çip etiketlerinden ve modal başlıklarından ham Unicode emojileri temizleyen kurumsal sadeleştirici (De-AI Cleanup)
function sanitizeUiDomEmojis() {
  const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}]/gu;
  const selectors = 'button, .quick-start-chip, .amenity-pill, .parking-pillar-chip, h1, h2, h3, h4, #header-start-badge, #gps-live-status-pill';
  document.querySelectorAll(selectors).forEach(el => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    const nodes = [];
    let n;
    while ((n = walker.nextNode())) {
      if (emojiRegex.test(n.nodeValue)) {
        nodes.push(n);
      }
    }
    nodes.forEach(textNode => {
      const cleaned = textNode.nodeValue.replace(emojiRegex, '').replace(/\s+/g, ' ');
      textNode.nodeValue = cleaned;
    });
    // İçi tamamen boşalan span'ları kaldır (SVG veya alt eleman içermiyorsa)
    el.querySelectorAll('span').forEach(sp => {
      if (sp.children.length === 0 && sp.textContent.trim() === '' && !sp.classList.contains('rounded-full') && !sp.id) {
        sp.remove();
      }
    });
  });
}
window.sanitizeUiDomEmojis = sanitizeUiDomEmojis;

document.addEventListener('DOMContentLoaded', () => {
  sanitizeUiDomEmojis();
  setTimeout(sanitizeUiDomEmojis, 400);
});



