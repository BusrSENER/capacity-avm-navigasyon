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
  </svg>`,

  // --- ZEMİN KAT KURUMSAL MARKA LOGOLARI ---
  twist: `<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#09090b"/>
    <path d="M50 18 L53 28 L64 28 L55 35 L58 46 L50 39 L42 46 L45 35 L36 28 L47 28 Z" fill="#f43f5e"/>
    <text x="50" y="72" font-family="'Plus Jakarta Sans', sans-serif" font-weight="900" font-size="16" fill="#ffffff" text-anchor="middle" letter-spacing="2">TWIST</text>
  </svg>`,

  faiksonmez: `<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#18181b"/>
    <text x="50" y="44" font-family="'Times New Roman', serif" font-weight="700" font-size="17" fill="#ffffff" text-anchor="middle" letter-spacing="1">FAİK</text>
    <line x1="26" y1="52" x2="74" y2="52" stroke="#d4af37" stroke-width="1.5"/>
    <text x="50" y="68" font-family="'Times New Roman', serif" font-weight="700" font-size="13.5" fill="#d4af37" text-anchor="middle" letter-spacing="1.5">SÖNMEZ</text>
  </svg>`,

  derimod: `<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#0f172a"/>
    <path d="M50 18 C40 18 36 28 36 36 C36 46 48 54 50 56 C52 54 64 46 64 36 C64 28 60 18 50 18 Z" fill="#dc2626"/>
    <circle cx="50" cy="35" r="4" fill="#ffffff"/>
    <text x="50" y="74" font-family="'Plus Jakarta Sans', sans-serif" font-weight="900" font-size="12" fill="#ffffff" text-anchor="middle" letter-spacing="1.5">DERİMOD</text>
  </svg>`,

  pasabahce: `<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#0369a1"/>
    <path d="M50 20 C42 32 38 42 38 52 C38 64 44 70 50 70 C56 70 62 64 62 52 C62 42 58 32 50 20 Z" fill="#e0f2fe" opacity="0.9"/>
    <path d="M50 28 C45 36 42 44 42 52 C42 60 46 64 50 64 C54 64 58 60 58 52 C58 44 55 36 50 28 Z" fill="#0284c7"/>
    <text x="50" y="83" font-family="'Times New Roman', serif" font-weight="700" font-size="9" fill="#ffffff" text-anchor="middle" letter-spacing="0.5">PAŞABAHÇE</text>
  </svg>`,

  suwen: `<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#4c0519"/>
    <path d="M50 20 C42 26 36 36 42 44 C48 52 50 56 50 58 C50 56 52 52 58 44 C64 36 58 26 50 20 Z" fill="#fda4af"/>
    <text x="50" y="76" font-family="'Times New Roman', serif" font-weight="800" font-size="13" fill="#ffffff" text-anchor="middle" letter-spacing="2">SUWEN</text>
  </svg>`,

  zen: `<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#09090b"/>
    <polygon points="50,18 68,34 50,56 32,34" fill="#ffffff"/>
    <polygon points="50,18 68,34 50,34" fill="#e2e8f0"/>
    <polygon points="50,18 32,34 50,34" fill="#cbd5e1"/>
    <text x="50" y="74" font-family="'Times New Roman', serif" font-weight="900" font-size="16" fill="#ffffff" text-anchor="middle" letter-spacing="2">ZEN</text>
    <text x="50" y="86" font-family="sans-serif" font-weight="600" font-size="7" fill="#94a3b8" text-anchor="middle" letter-spacing="1.5">PIRLANTA</text>
  </svg>`,

  marksandspencer: `<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#18181b"/>
    <text x="50" y="52" font-family="'Times New Roman', serif" font-weight="900" font-size="24" fill="#ffffff" text-anchor="middle" letter-spacing="1">M&amp;S</text>
    <text x="50" y="70" font-family="sans-serif" font-weight="600" font-size="7" fill="#38bdf8" text-anchor="middle" letter-spacing="1">EST. 1884</text>
  </svg>`,

  avva: `<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#1e293b"/>
    <polygon points="50,22 66,48 34,48" fill="#38bdf8"/>
    <text x="50" y="72" font-family="sans-serif" font-weight="900" font-size="16" fill="#ffffff" text-anchor="middle" letter-spacing="2">AVVA</text>
  </svg>`,

  cacharel: `<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#1e1b4b"/>
    <text x="50" y="56" font-family="'Times New Roman', serif" font-weight="700" font-size="14" fill="#ffffff" text-anchor="middle" letter-spacing="1">cacharel</text>
    <text x="50" y="72" font-family="sans-serif" font-weight="600" font-size="7" fill="#94a3b8" text-anchor="middle" letter-spacing="2">PARIS</text>
  </svg>`,

  damattween: `<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#09090b"/>
    <circle cx="50" cy="38" r="14" fill="none" stroke="#d4af37" stroke-width="2"/>
    <text x="50" y="44" font-family="'Times New Roman', serif" font-weight="900" font-size="15" fill="#d4af37" text-anchor="middle">D</text>
    <text x="50" y="68" font-family="sans-serif" font-weight="800" font-size="9" fill="#ffffff" text-anchor="middle" letter-spacing="1">DAMAT</text>
    <text x="50" y="79" font-family="sans-serif" font-weight="600" font-size="7" fill="#d4af37" text-anchor="middle" letter-spacing="2">TWEEN</text>
  </svg>`,

  divarese: `<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#1e1b4b"/>
    <text x="50" y="52" font-family="'Times New Roman', serif" font-weight="800" font-size="14" fill="#ffffff" text-anchor="middle" letter-spacing="1">DIVARESE</text>
    <text x="50" y="68" font-family="sans-serif" font-weight="600" font-size="7.5" fill="#a5b4fc" text-anchor="middle" letter-spacing="2">DAL 1870</text>
  </svg>`,

  englishhome: `<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#064e3b"/>
    <path d="M50 20 C42 28 42 38 50 44 C58 38 58 28 50 20 Z" fill="#6ee7b7"/>
    <text x="50" y="64" font-family="'Times New Roman', serif" font-weight="800" font-size="9.5" fill="#ffffff" text-anchor="middle" letter-spacing="0.5">ENGLISH</text>
    <text x="50" y="76" font-family="'Times New Roman', serif" font-weight="800" font-size="9.5" fill="#6ee7b7" text-anchor="middle" letter-spacing="0.5">HOME</text>
  </svg>`,

  glingerie: `<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#831843"/>
    <text x="50" y="50" font-family="'Times New Roman', serif" font-weight="900" font-size="24" fill="#fbcfe8" text-anchor="middle">GL</text>
    <text x="50" y="68" font-family="sans-serif" font-weight="700" font-size="8" fill="#ffffff" text-anchor="middle" letter-spacing="1.5">LINGERIE</text>
  </svg>`,

  hotic: `<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#78350f"/>
    <text x="50" y="56" font-family="'Times New Roman', serif" font-weight="900" font-size="18" fill="#ffffff" text-anchor="middle" letter-spacing="2">HOTİÇ</text>
    <text x="50" y="72" font-family="sans-serif" font-weight="600" font-size="7" fill="#fde68a" text-anchor="middle" letter-spacing="2">1938</text>
  </svg>`,

  hugoboss: `<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#000000"/>
    <text x="50" y="54" font-family="'Plus Jakarta Sans', sans-serif" font-weight="900" font-size="20" fill="#ffffff" text-anchor="middle" letter-spacing="2">BOSS</text>
    <text x="50" y="70" font-family="sans-serif" font-weight="700" font-size="7" fill="#a1a1aa" text-anchor="middle" letter-spacing="2">HUGO BOSS</text>
  </svg>`,

  ipekyol: `<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#18181b"/>
    <text x="50" y="58" font-family="'Times New Roman', serif" font-weight="800" font-size="16" fill="#ffffff" text-anchor="middle" letter-spacing="2">İPEKYOL</text>
  </svg>`,

  kemaltanca: `<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#1c1917"/>
    <circle cx="50" cy="38" r="14" fill="none" stroke="#eab308" stroke-width="1.8"/>
    <text x="50" y="44" font-family="'Times New Roman', serif" font-weight="900" font-size="14" fill="#eab308" text-anchor="middle">KT</text>
    <text x="50" y="68" font-family="'Times New Roman', serif" font-weight="800" font-size="9" fill="#ffffff" text-anchor="middle" letter-spacing="1">KEMAL TANCA</text>
  </svg>`,

  lizay: `<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#0f172a"/>
    <polygon points="50,22 62,34 50,48 38,34" fill="#f59e0b"/>
    <text x="50" y="68" font-family="'Times New Roman', serif" font-weight="800" font-size="14" fill="#ffffff" text-anchor="middle" letter-spacing="1.5">LİZAY</text>
  </svg>`,

  mac: `<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#000000"/>
    <text x="50" y="58" font-family="sans-serif" font-weight="900" font-size="20" fill="#ffffff" text-anchor="middle" letter-spacing="3">M·A·C</text>
  </svg>`,

  madamecoco: `<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#3b0764"/>
    <text x="50" y="48" font-family="'Times New Roman', serif" font-weight="800" font-size="10" fill="#f5d0fe" text-anchor="middle" letter-spacing="1">MADAME</text>
    <text x="50" y="68" font-family="'Times New Roman', serif" font-weight="800" font-size="12" fill="#ffffff" text-anchor="middle" letter-spacing="1.5">COCO</text>
  </svg>`,

  pelit: `<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#451a03"/>
    <text x="50" y="54" font-family="'Times New Roman', serif" font-weight="900" font-size="20" fill="#fef08a" text-anchor="middle" letter-spacing="1">PELİT</text>
    <text x="50" y="70" font-family="sans-serif" font-weight="600" font-size="7" fill="#ffffff" text-anchor="middle" letter-spacing="2">1957</text>
  </svg>`,

  pierrecardin: `<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#1e293b"/>
    <path d="M42 26 L42 74 M42 26 C56 26 62 34 62 46 C62 58 56 64 42 64" fill="none" stroke="#ef4444" stroke-width="4.5" stroke-linecap="round"/>
    <text x="50" y="84" font-family="sans-serif" font-weight="700" font-size="6.5" fill="#ffffff" text-anchor="middle" letter-spacing="1">PIERRE CARDIN</text>
  </svg>`,

  ramsey: `<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#0f172a"/>
    <text x="50" y="58" font-family="'Times New Roman', serif" font-weight="900" font-size="16" fill="#ffffff" text-anchor="middle" letter-spacing="2">RAMSEY</text>
  </svg>`,

  saatsaat: `<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#0c4a6e"/>
    <circle cx="50" cy="38" r="14" fill="none" stroke="#ffffff" stroke-width="2"/>
    <path d="M50 38 L50 30 M50 38 L56 38" stroke="#38bdf8" stroke-width="2" stroke-linecap="round"/>
    <text x="50" y="68" font-family="sans-serif" font-weight="800" font-size="8.5" fill="#ffffff" text-anchor="middle" letter-spacing="0.5">SAAT&amp;SAAT</text>
  </svg>`,

  sochic: `<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#701a75"/>
    <text x="50" y="48" font-family="'Times New Roman', serif" font-weight="700" font-size="14" fill="#f5d0fe" text-anchor="middle">SO</text>
    <text x="50" y="66" font-family="'Times New Roman', serif" font-weight="900" font-size="14" fill="#ffffff" text-anchor="middle" letter-spacing="1">CHIC...</text>
  </svg>`,

  stefanel: `<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#1c1917"/>
    <text x="50" y="58" font-family="'Times New Roman', serif" font-weight="800" font-size="15" fill="#ffffff" text-anchor="middle" letter-spacing="1.5">STEFANEL</text>
  </svg>`,

  storksdiamond: `<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#1e1b4b"/>
    <polygon points="50,20 64,34 50,50 36,34" fill="#eab308"/>
    <text x="50" y="68" font-family="'Times New Roman', serif" font-weight="800" font-size="12" fill="#ffffff" text-anchor="middle" letter-spacing="1">STORKS</text>
  </svg>`,

  thehunger: `<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#991b1b"/>
    <text x="50" y="48" font-family="sans-serif" font-weight="900" font-size="12" fill="#fef08a" text-anchor="middle" letter-spacing="1">THE</text>
    <text x="50" y="68" font-family="sans-serif" font-weight="900" font-size="13" fill="#ffffff" text-anchor="middle" letter-spacing="1">HUNGER</text>
  </svg>`,

  tobaccoshop: `<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#27272a"/>
    <text x="50" y="58" font-family="sans-serif" font-weight="800" font-size="11" fill="#facc15" text-anchor="middle" letter-spacing="1">TOBACCO</text>
  </svg>`,

  tuzun: `<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#1e1b4b"/>
    <text x="50" y="58" font-family="'Times New Roman', serif" font-weight="800" font-size="16" fill="#ffffff" text-anchor="middle" letter-spacing="2">TÜZÜN</text>
  </svg>`,

  wcollection: `<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#09090b"/>
    <text x="50" y="52" font-family="'Times New Roman', serif" font-weight="900" font-size="28" fill="#ffffff" text-anchor="middle">W</text>
    <text x="50" y="70" font-family="sans-serif" font-weight="700" font-size="7" fill="#d4af37" text-anchor="middle" letter-spacing="1.5">COLLECTION</text>
  </svg>`
};

/**
 * Türkçe karakterleri ASCII eşdeğerlerine dönüştürür
 */
function normalizeLogoKey(str) {
  return (str || '')
    .replace(/İ/g, 'i').replace(/I/g, 'i').replace(/ı/g, 'i')
    .replace(/Ğ/g, 'g').replace(/ğ/g, 'g')
    .replace(/Ü/g, 'u').replace(/ü/g, 'u')
    .replace(/Ş/g, 's').replace(/ş/g, 's')
    .replace(/Ö/g, 'o').replace(/ö/g, 'o')
    .replace(/Ç/g, 'c').replace(/ç/g, 'c')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Mağazanın kurumsal vektörel logosu olup olmadığını kontrol eder
 */
function hasBrandLogo(store) {
  if (!store || !store.name) return false;
  const sName = normalizeLogoKey(store.name);
  if (!sName) return false;

  for (const k of Object.keys(BrandLogos)) {
    if (sName.includes(k) || k.includes(sName)) {
      return true;
    }
  }
  return false;
}
window.hasBrandLogo = hasBrandLogo;

/**
 * Returns HTML representation of the store logo.
 * Tries offline vector first -> then web image -> fallback to luxury monogram badge
 */
function getStoreLogo(store, size = 38) {
  if (!store) return '';
  const sName = normalizeLogoKey(store.name || '');

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
