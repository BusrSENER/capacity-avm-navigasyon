/**
 * İstanbul Bakırköy Capacity AVM - Vektörel Marka Logoları & Rozet Motoru
 * %100 çevrimdışı SVG vektörler + resmi CDN resim entegrasyonu + lüks monogram rozet fallback
 */

const BrandLogos = {
  // --- LÜKS & PRESTİJ MODA ---
  beymenclub: `<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#0f172a"/>
    <text x="50" y="48" font-family="'Times New Roman', serif" font-weight="900" font-size="20" fill="#ffffff" text-anchor="middle" letter-spacing="1">BEYMEN</text>
    <text x="50" y="66" font-family="sans-serif" font-weight="600" font-size="9" fill="#38bdf8" text-anchor="middle" letter-spacing="3">CLUB</text>
  </svg>`,

  vakko: `<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#18181b"/>
    <text x="50" y="58" font-family="'Times New Roman', serif" font-weight="900" font-size="20" fill="#eab308" text-anchor="middle" letter-spacing="3">VAKKO</text>
  </svg>`,

  lacoste: `<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#064e3b"/>
    <path d="M35 50 C38 42, 50 40, 58 44 C66 48, 72 45, 75 42 C74 48, 70 54, 62 55 C54 56, 44 60, 36 56 Z" fill="#10b981"/>
    <text x="50" y="74" font-family="sans-serif" font-weight="900" font-size="9" fill="#ffffff" text-anchor="middle" letter-spacing="1.5">LACOSTE</text>
  </svg>`,

  gant: `<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#0f172a"/>
    <text x="50" y="58" font-family="'Times New Roman', serif" font-weight="900" font-size="22" fill="#ffffff" text-anchor="middle" letter-spacing="2">GANT</text>
  </svg>`,

  network: `<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#1e1b4b"/>
    <text x="50" y="58" font-family="sans-serif" font-weight="800" font-size="14" fill="#ffffff" text-anchor="middle" letter-spacing="2">NETWORK</text>
  </svg>`,

  // --- KÜRESEL MODA DEVLERİ ---
  zara: `<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#000000"/>
    <text x="50" y="60" font-family="'Times New Roman', serif" font-weight="900" font-size="28" fill="#ffffff" text-anchor="middle" letter-spacing="-1">ZARA</text>
  </svg>`,

  massimodutti: `<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#1c1917"/>
    <text x="50" y="48" font-family="'Times New Roman', serif" font-weight="700" font-size="24" fill="#d4af37" text-anchor="middle">MD</text>
    <text x="50" y="68" font-family="'Times New Roman', serif" font-size="8.5" fill="#d4af37" text-anchor="middle" letter-spacing="1">MASSIMO DUTTI</text>
  </svg>`,

  tommyhilfiger: `<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#001744"/>
    <rect x="24" y="38" width="26" height="24" fill="#ffffff"/>
    <rect x="50" y="38" width="26" height="24" fill="#cc0c2f"/>
    <text x="50" y="27" font-family="'Times New Roman', serif" font-weight="900" font-size="10.5" fill="#ffffff" text-anchor="middle" letter-spacing="1.5">TOMMY</text>
    <text x="50" y="80" font-family="'Times New Roman', serif" font-weight="900" font-size="9" fill="#ffffff" text-anchor="middle" letter-spacing="1">HILFIGER</text>
  </svg>`,

  tommy: `<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#001744"/>
    <rect x="24" y="38" width="26" height="24" fill="#ffffff"/>
    <rect x="50" y="38" width="26" height="24" fill="#cc0c2f"/>
    <text x="50" y="27" font-family="'Times New Roman', serif" font-weight="900" font-size="10.5" fill="#ffffff" text-anchor="middle" letter-spacing="1.5">TOMMY</text>
    <text x="50" y="80" font-family="'Times New Roman', serif" font-weight="900" font-size="9" fill="#ffffff" text-anchor="middle" letter-spacing="1">HILFIGER</text>
  </svg>`,

  bershka: `<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#000000"/>
    <text x="50" y="58" font-family="sans-serif" font-weight="900" font-size="16" fill="#f8fafc" text-anchor="middle" letter-spacing="1">BERSHKA</text>
  </svg>`,

  stradivarius: `<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#18181b"/>
    <path d="M50 18 C46 26 44 38 52 46 C56 50 58 56 54 62 C50 68 42 66 40 60 C38 52 48 48 50 42 C42 42 36 50 36 60 C36 74 52 78 60 68 C66 60 62 48 56 42 L54 28 C56 22 58 18 50 18 Z" fill="#f59e0b"/>
    <circle cx="50" cy="80" r="4" fill="#f59e0b"/>
  </svg>`,

  oysho: `<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#27272a"/>
    <text x="50" y="58" font-family="sans-serif" font-weight="800" font-size="17" fill="#ffffff" text-anchor="middle" letter-spacing="2">OYSHO</text>
  </svg>`,

  mango: `<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#18181b"/>
    <text x="50" y="58" font-family="sans-serif" font-weight="900" font-size="17" fill="#ffffff" text-anchor="middle" letter-spacing="1">MANGO</text>
  </svg>`,

  mavi: `<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#1d4ed8"/>
    <text x="50" y="58" font-family="sans-serif" font-weight="900" font-size="20" fill="#ffffff" text-anchor="middle" letter-spacing="1">mavi</text>
  </svg>`,

  koton: `<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#000000"/>
    <text x="50" y="58" font-family="sans-serif" font-weight="900" font-size="17" fill="#ffffff" text-anchor="middle" letter-spacing="2">KOTON</text>
  </svg>`,

  lcwaikiki: `<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#1e3a8a"/>
    <text x="50" y="50" font-family="sans-serif" font-weight="900" font-size="22" fill="#ffffff" text-anchor="middle">LCW</text>
    <text x="50" y="66" font-family="sans-serif" font-weight="700" font-size="8" fill="#60a5fa" text-anchor="middle" letter-spacing="1">AIKIKI</text>
  </svg>`,

  // --- MÜCEVHER & AKSESUAR ---
  atasay: `<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#0f172a"/>
    <polygon points="50,22 68,36 50,50 32,36" fill="#f59e0b"/>
    <text x="50" y="70" font-family="'Times New Roman', serif" font-weight="700" font-size="13" fill="#ffffff" text-anchor="middle" letter-spacing="1">ATASAY</text>
  </svg>`,

  altınbaş: `<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#18181b"/>
    <circle cx="50" cy="38" r="14" fill="none" stroke="#eab308" stroke-width="2.5"/>
    <text x="50" y="68" font-family="'Times New Roman', serif" font-weight="700" font-size="11" fill="#eab308" text-anchor="middle" letter-spacing="1">ALTINBAŞ</text>
  </svg>`,

  bluediamond: `<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#0369a1"/>
    <polygon points="50,20 66,35 50,55 34,35" fill="#38bdf8"/>
    <text x="50" y="72" font-family="sans-serif" font-weight="800" font-size="10" fill="#ffffff" text-anchor="middle" letter-spacing="1">BLUE</text>
  </svg>`,

  // --- KOZMETİK & BAKIM ---
  sephora: `<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#000000"/>
    <path d="M50 20 C42 32, 42 45, 50 55 C58 65, 58 78, 50 82" stroke="#ffffff" stroke-width="4.5" fill="none" stroke-linecap="round"/>
    <text x="50" y="72" font-family="sans-serif" font-weight="900" font-size="11" fill="#ffffff" text-anchor="middle" letter-spacing="1">SEPHORA</text>
  </svg>`,

  watsons: `<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#0f766e"/>
    <text x="50" y="58" font-family="sans-serif" font-weight="900" font-size="14" fill="#ffffff" text-anchor="middle" letter-spacing="1">watsons</text>
  </svg>`,

  gratis: `<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#6b21a8"/>
    <text x="50" y="58" font-family="sans-serif" font-weight="900" font-size="16" fill="#facc15" text-anchor="middle" letter-spacing="1">gratis</text>
  </svg>`,

  // --- SPOR & AYAKKABI ---
  adidas: `<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#000000"/>
    <polygon points="28,62 36,62 50,38 42,38" fill="#ffffff"/>
    <polygon points="44,62 52,62 66,32 58,32" fill="#ffffff"/>
    <polygon points="60,62 68,62 82,26 74,26" fill="#ffffff"/>
    <text x="50" y="76" font-family="sans-serif" font-weight="900" font-size="11" fill="#ffffff" text-anchor="middle">adidas</text>
  </svg>`,

  skechers: `<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#0284c7"/>
    <text x="50" y="52" font-family="sans-serif" font-weight="900" font-size="30" fill="#ffffff" text-anchor="middle">S</text>
    <text x="50" y="72" font-family="sans-serif" font-weight="800" font-size="8" fill="#e0f2fe" text-anchor="middle" letter-spacing="1">SKECHERS</text>
  </svg>`,

  flo: `<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#ea580c"/>
    <text x="50" y="58" font-family="sans-serif" font-weight="900" font-size="24" fill="#ffffff" text-anchor="middle">FLO</text>
  </svg>`,

  columbia: `<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#0284c7"/>
    <rect x="36" y="28" width="12" height="12" rx="2" fill="#ffffff"/>
    <rect x="52" y="28" width="12" height="12" rx="2" fill="#ffffff"/>
    <rect x="36" y="44" width="12" height="12" rx="2" fill="#ffffff"/>
    <rect x="52" y="44" width="12" height="12" rx="2" fill="#ffffff"/>
    <text x="50" y="74" font-family="sans-serif" font-weight="900" font-size="8" fill="#ffffff" text-anchor="middle" letter-spacing="1">COLUMBIA</text>
  </svg>`,

  superstep: `<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#0f172a"/>
    <text x="50" y="50" font-family="sans-serif" font-weight="900" font-size="14" fill="#f43f5e" text-anchor="middle">SUPER</text>
    <text x="50" y="68" font-family="sans-serif" font-weight="900" font-size="14" fill="#ffffff" text-anchor="middle">STEP</text>
  </svg>`,

  // --- EĞLENCE & SİNEMA & KİTAP ---
  paribucineverse: `<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#4f46e5"/>
    <polygon points="40,30 40,70 72,50" fill="#ffffff"/>
    <text x="50" y="82" font-family="sans-serif" font-weight="800" font-size="7.5" fill="#c7d2fe" text-anchor="middle" letter-spacing="0.5">CINEVERSE</text>
  </svg>`,

  dr: `<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#dc2626"/>
    <text x="50" y="58" font-family="sans-serif" font-weight="900" font-size="28" fill="#ffffff" text-anchor="middle">D&amp;R</text>
  </svg>`,

  // --- YEME-İÇME & KAFE ---
  midpoint: `<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#1e293b"/>
    <circle cx="50" cy="40" r="10" fill="#ef4444"/>
    <text x="50" y="70" font-family="sans-serif" font-weight="800" font-size="10" fill="#ffffff" text-anchor="middle" letter-spacing="1">MIDPOINT</text>
  </svg>`,

  cookshop: `<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#f59e0b"/>
    <text x="50" y="58" font-family="'Times New Roman', serif" font-weight="900" font-size="13" fill="#ffffff" text-anchor="middle" letter-spacing="1">COOKSHOP</text>
  </svg>`,

  burgerking: `<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#78350f"/>
    <circle cx="50" cy="50" r="32" fill="#dc2626"/>
    <path d="M28 42 C38 32, 62 32, 72 42" stroke="#f59e0b" stroke-width="6" fill="none" stroke-linecap="round"/>
    <path d="M28 58 C38 68, 62 68, 72 58" stroke="#f59e0b" stroke-width="6" fill="none" stroke-linecap="round"/>
    <text x="50" y="53" font-family="sans-serif" font-weight="900" font-size="8" fill="#ffffff" text-anchor="middle">BURGER</text>
    <text x="50" y="61" font-family="sans-serif" font-weight="900" font-size="8" fill="#ffffff" text-anchor="middle">KING</text>
  </svg>`,

  arbys: `<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#991b1b"/>
    <text x="50" y="58" font-family="sans-serif" font-weight="900" font-size="18" fill="#ffffff" text-anchor="middle">Arby's</text>
  </svg>`,

  doyuyo: `<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#ea580c"/>
    <text x="50" y="58" font-family="sans-serif" font-weight="900" font-size="15" fill="#ffffff" text-anchor="middle">DOYUYO</text>
  </svg>`,

  dürümle: `<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#15803d"/>
    <text x="50" y="58" font-family="sans-serif" font-weight="900" font-size="14" fill="#ffffff" text-anchor="middle">DÜRÜMLE</text>
  </svg>`,

  // --- HİZMET & SERVİS NOKTALARI ---
  fountain: `<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#0284c7"/>
    <circle cx="50" cy="50" r="28" fill="none" stroke="#38bdf8" stroke-width="3" stroke-dasharray="4 4"/>
    <circle cx="50" cy="50" r="14" fill="#38bdf8"/>
    <path d="M50 20 L50 40 M50 60 L50 80 M20 50 L40 50 M60 50 L80 50" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round"/>
  </svg>`,

  wc: `<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#1e293b"/>
    <text x="50" y="60" font-family="sans-serif" font-weight="900" font-size="28" fill="#38bdf8" text-anchor="middle">WC</text>
  </svg>`,

  atm: `<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#047857"/>
    <text x="50" y="60" font-family="sans-serif" font-weight="900" font-size="24" fill="#ffffff" text-anchor="middle">ATM</text>
  </svg>`,

  info: `<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#2563eb"/>
    <circle cx="50" cy="36" r="6" fill="#ffffff"/>
    <rect x="45" y="48" width="10" height="26" rx="3" fill="#ffffff"/>
  </svg>`,

  valet: `<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#b91c1c"/>
    <text x="50" y="58" font-family="sans-serif" font-weight="900" font-size="18" fill="#fef08a" text-anchor="middle">VALE</text>
  </svg>`,

  taxi: `<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#eab308"/>
    <text x="50" y="58" font-family="sans-serif" font-weight="900" font-size="18" fill="#0f172a" text-anchor="middle">TAKSİ</text>
  </svg>`
};

/**
 * Returns HTML representation of the store logo.
 * Tries offline vector first -> then web image -> fallback to luxury monogram badge
 */
function getStoreLogo(store, size = 38) {
  if (!store) return '';
  const sName = (store.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  // 1. Check exact key or substring in BrandLogos dictionary
  for (const [k, svg] of Object.entries(BrandLogos)) {
    if (sName.includes(k) || k.includes(sName)) {
      return `<div class="store-badge-icon" style="width: ${size}px; height: ${size}px;">${svg}</div>`;
    }
  }

  // 2. If store has an official scraped thumbnail image URL
  if (store.img && store.img.startsWith('http')) {
    return `<div class="store-badge-icon rounded-2xl overflow-hidden bg-white shadow-sm border border-slate-200/60 dark:border-slate-700 flex items-center justify-center p-1" style="width: ${size}px; height: ${size}px;">
      <img src="${store.img}" alt="${store.name}" class="w-full h-full object-contain" onerror="this.parentElement.innerHTML = getStoreMonogram('${store.name}', '${store.category}', ${size});" />
    </div>`;
  }

  // 3. Fallback to intelligent monogram badge
  return getStoreMonogram(store.name || 'Capacity', store.category || 'fashion', size);
}

function getStoreMonogram(name, category, size = 38) {
  const initials = (name || 'CP')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('');

  const catColors = {
    fashion: ['#475569', '#1e293b'],
    shoes: ['#ea580c', '#9a3412'],
    sports: ['#0284c7', '#0369a1'],
    tech: ['#4f46e5', '#3730a3'],
    cosmetics: ['#db2777', '#9d174d'],
    food: ['#d97706', '#b45309'],
    home: ['#059669', '#047857'],
    entertainment: ['#7c3aed', '#5b21b6'],
    service: ['#0284c7', '#0f172a'],
    atm: ['#047857', '#064e3b']
  };

  const [bg1, bg2] = catColors[category] || catColors.fashion;

  return `
    <div class="store-badge-icon rounded-2xl flex items-center justify-center shadow-md border border-white/20 select-none text-white font-black" style="width: ${size}px; height: ${size}px; background: linear-gradient(135deg, ${bg1}, ${bg2}); font-size: ${Math.round(size * 0.38)}px; letter-spacing: 0.5px;">
      ${initials}
    </div>
  `;
}
