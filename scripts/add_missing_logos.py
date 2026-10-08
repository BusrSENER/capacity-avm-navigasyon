import re

# Additional Brand SVG definitions
NEW_LOGOS = {
  "marksspencer": """`<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#18181b"/>
    <text x="50" y="52" font-family="'Times New Roman', serif" font-weight="900" font-size="24" fill="#ffffff" text-anchor="middle" letter-spacing="1">M&amp;S</text>
    <text x="50" y="70" font-family="sans-serif" font-weight="600" font-size="7" fill="#38bdf8" text-anchor="middle" letter-spacing="1">EST. 1884</text>
  </svg>`""",

  "atelierrebul": """`<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#0f172a"/>
    <circle cx="50" cy="38" r="14" fill="none" stroke="#d4af37" stroke-width="1.8"/>
    <text x="50" y="43" font-family="'Times New Roman', serif" font-weight="700" font-size="12" fill="#d4af37" text-anchor="middle">AR</text>
    <text x="50" y="66" font-family="'Times New Roman', serif" font-weight="800" font-size="9" fill="#ffffff" text-anchor="middle" letter-spacing="1">ATELIER REBUL</text>
    <text x="50" y="77" font-family="sans-serif" font-weight="600" font-size="6" fill="#d4af37" text-anchor="middle" letter-spacing="2">EST. 1895</text>
  </svg>`""",

  "ayakkabidunyasi": """`<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#dc2626"/>
    <path d="M25 45 C35 32, 65 32, 75 45 C65 52, 35 52, 25 45 Z" fill="#ffffff"/>
    <text x="50" y="64" font-family="sans-serif" font-weight="900" font-size="8.5" fill="#ffffff" text-anchor="middle" letter-spacing="0.5">AYAKKABI</text>
    <text x="50" y="76" font-family="sans-serif" font-weight="800" font-size="8.5" fill="#fef08a" text-anchor="middle" letter-spacing="1">DÜNYASI</text>
  </svg>`""",

  "bgstore": """`<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#0f2b48"/>
    <text x="50" y="52" font-family="sans-serif" font-weight="900" font-size="22" fill="#ffffff" text-anchor="middle">B&amp;G</text>
    <text x="50" y="70" font-family="sans-serif" font-weight="800" font-size="10" fill="#fbbf24" text-anchor="middle" letter-spacing="2">STORE</text>
  </svg>`""",

  "besiktaskartalyuvasi": """`<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#000000"/>
    <rect x="30" y="20" width="8" height="24" fill="#ffffff"/>
    <rect x="46" y="20" width="8" height="24" fill="#e11d48"/>
    <rect x="62" y="20" width="8" height="24" fill="#ffffff"/>
    <text x="50" y="62" font-family="sans-serif" font-weight="900" font-size="9" fill="#ffffff" text-anchor="middle" letter-spacing="1">KARTAL YUVASI</text>
    <text x="50" y="74" font-family="sans-serif" font-weight="800" font-size="7" fill="#e11d48" text-anchor="middle" letter-spacing="1.5">BEŞİKTAŞ JK</text>
  </svg>`""",

  "kartalyuvasi": """`<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#000000"/>
    <rect x="30" y="20" width="8" height="24" fill="#ffffff"/>
    <rect x="46" y="20" width="8" height="24" fill="#e11d48"/>
    <rect x="62" y="20" width="8" height="24" fill="#ffffff"/>
    <text x="50" y="62" font-family="sans-serif" font-weight="900" font-size="9" fill="#ffffff" text-anchor="middle" letter-spacing="1">KARTAL YUVASI</text>
    <text x="50" y="74" font-family="sans-serif" font-weight="800" font-size="7" fill="#e11d48" text-anchor="middle" letter-spacing="1.5">BEŞİKTAŞ JK</text>
  </svg>`""",

  "gsstore": """`<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#a30000"/>
    <circle cx="50" cy="40" r="18" fill="#fdb913"/>
    <text x="50" y="47" font-family="'Times New Roman', serif" font-weight="900" font-size="18" fill="#a30000" text-anchor="middle">GS</text>
    <text x="50" y="74" font-family="sans-serif" font-weight="900" font-size="11" fill="#ffffff" text-anchor="middle" letter-spacing="2">STORE</text>
  </svg>`""",

  "bargello": """`<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#171717"/>
    <text x="50" y="52" font-family="'Times New Roman', serif" font-weight="800" font-size="13" fill="#ffffff" text-anchor="middle" letter-spacing="1.5">BARGELLO</text>
    <text x="50" y="68" font-family="sans-serif" font-weight="600" font-size="7" fill="#d4af37" text-anchor="middle" letter-spacing="3">PERFUME</text>
  </svg>`""",

  "panco": """`<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#0284c7"/>
    <text x="50" y="54" font-family="sans-serif" font-weight="900" font-size="20" fill="#ffffff" text-anchor="middle">panço</text>
    <path d="M36 62 Q50 72 64 62" stroke="#ea580c" stroke-width="3" fill="none" stroke-linecap="round"/>
  </svg>`""",

  "mistore": """`<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#ff6900"/>
    <text x="50" y="52" font-family="sans-serif" font-weight="900" font-size="24" fill="#ffffff" text-anchor="middle">mi</text>
    <text x="50" y="70" font-family="sans-serif" font-weight="700" font-size="10" fill="#ffffff" text-anchor="middle" letter-spacing="1">STORE</text>
  </svg>`""",

  "sunglasshutrayban": """`<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#09090b"/>
    <rect x="22" y="24" width="56" height="24" rx="4" fill="#dc2626"/>
    <text x="50" y="41" font-family="'Times New Roman', serif" font-weight="900" font-size="14" fill="#ffffff" text-anchor="middle">Ray·Ban</text>
    <text x="50" y="66" font-family="sans-serif" font-weight="700" font-size="8" fill="#ffffff" text-anchor="middle">sunglass hut</text>
  </svg>`""",

  "sunglasshut": """`<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#09090b"/>
    <circle cx="50" cy="40" r="14" fill="#dc2626"/>
    <text x="50" y="46" font-family="'Times New Roman', serif" font-weight="900" font-size="14" fill="#ffffff" text-anchor="middle">RB</text>
    <text x="50" y="68" font-family="sans-serif" font-weight="700" font-size="7.5" fill="#ffffff" text-anchor="middle">SUNGLASS HUT</text>
  </svg>`""",

  "intimissimi": """`<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#18181b"/>
    <text x="50" y="58" font-family="'Times New Roman', serif" font-weight="700" font-size="13" fill="#ffffff" text-anchor="middle" letter-spacing="1">intimissimi</text>
  </svg>`""",

  "intimissimiuomo": """`<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#0f172a"/>
    <text x="50" y="48" font-family="'Times New Roman', serif" font-weight="700" font-size="11" fill="#ffffff" text-anchor="middle" letter-spacing="1">intimissimi</text>
    <text x="50" y="66" font-family="sans-serif" font-weight="800" font-size="9" fill="#38bdf8" text-anchor="middle" letter-spacing="2">UOMO</text>
  </svg>`""",

  "jimmykey": """`<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#9a3412"/>
    <text x="50" y="48" font-family="sans-serif" font-weight="800" font-size="12" fill="#ffffff" text-anchor="middle" letter-spacing="1">JIMMY</text>
    <text x="50" y="66" font-family="sans-serif" font-weight="800" font-size="12" fill="#fdba74" text-anchor="middle" letter-spacing="1">KEY</text>
  </svg>`""",

  "kom": """`<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#1d4ed8"/>
    <text x="50" y="58" font-family="sans-serif" font-weight="900" font-size="24" fill="#ffffff" text-anchor="middle" letter-spacing="2">KOM</text>
  </svg>`""",

  "kifidis": """`<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#14532d"/>
    <text x="50" y="52" font-family="'Times New Roman', serif" font-weight="900" font-size="15" fill="#ffffff" text-anchor="middle" letter-spacing="1">KİFİDİS</text>
    <text x="50" y="68" font-family="sans-serif" font-weight="600" font-size="7" fill="#86efac" text-anchor="middle" letter-spacing="2">EST. 1919</text>
  </svg>`""",

  "alixavien": """`<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#09090b"/>
    <text x="50" y="48" font-family="'Times New Roman', serif" font-weight="800" font-size="11" fill="#fbcfe8" text-anchor="middle" letter-spacing="1">ALIX AVIEN</text>
    <text x="50" y="64" font-family="sans-serif" font-weight="600" font-size="7" fill="#f472b6" text-anchor="middle" letter-spacing="2">PARIS</text>
  </svg>`""",

  "madparfumeur": """`<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#171717"/>
    <text x="50" y="50" font-family="'Times New Roman', serif" font-weight="900" font-size="22" fill="#eab308" text-anchor="middle">MAD</text>
    <text x="50" y="68" font-family="sans-serif" font-weight="700" font-size="7" fill="#ffffff" text-anchor="middle" letter-spacing="2">PARFUMEUR</text>
  </svg>`""",

  "loris": """`<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#581c87"/>
    <text x="50" y="54" font-family="sans-serif" font-weight="900" font-size="18" fill="#ffffff" text-anchor="middle" letter-spacing="1">LORIS</text>
    <text x="50" y="68" font-family="sans-serif" font-weight="600" font-size="7" fill="#d8b4fe" text-anchor="middle" letter-spacing="2">PARFUM</text>
  </svg>`""",

  "gozgrupoptik": """`<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#0f172a"/>
    <circle cx="40" cy="40" r="10" fill="none" stroke="#06b6d4" stroke-width="2.5"/>
    <circle cx="60" cy="40" r="10" fill="none" stroke="#06b6d4" stroke-width="2.5"/>
    <line x1="50" y1="40" x2="50" y2="40" stroke="#06b6d4" stroke-width="3"/>
    <text x="50" y="68" font-family="sans-serif" font-weight="800" font-size="9" fill="#ffffff" text-anchor="middle" letter-spacing="1">GÖZGRUP</text>
  </svg>`""",

  "gozgrup": """`<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#0f172a"/>
    <circle cx="40" cy="40" r="10" fill="none" stroke="#06b6d4" stroke-width="2.5"/>
    <circle cx="60" cy="40" r="10" fill="none" stroke="#06b6d4" stroke-width="2.5"/>
    <text x="50" y="68" font-family="sans-serif" font-weight="800" font-size="9" fill="#ffffff" text-anchor="middle" letter-spacing="1">GÖZGRUP</text>
  </svg>`""",

  "emooptik": """`<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#18181b"/>
    <text x="50" y="52" font-family="sans-serif" font-weight="900" font-size="20" fill="#eab308" text-anchor="middle">EMO</text>
    <text x="50" y="68" font-family="sans-serif" font-weight="700" font-size="8" fill="#ffffff" text-anchor="middle" letter-spacing="2">OPTİK</text>
  </svg>`""",

  "enderspor": """`<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#1e3a8a"/>
    <polygon points="35,26 50,44 65,26" fill="#ef4444"/>
    <text x="50" y="62" font-family="sans-serif" font-weight="900" font-size="10" fill="#ffffff" text-anchor="middle" letter-spacing="1">ENDER</text>
    <text x="50" y="74" font-family="sans-serif" font-weight="800" font-size="8" fill="#ef4444" text-anchor="middle" letter-spacing="2">SPOR</text>
  </svg>`""",

  "malatyapazari": """`<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#78350f"/>
    <circle cx="50" cy="36" r="14" fill="#d97706"/>
    <text x="50" y="42" font-family="'Times New Roman', serif" font-weight="900" font-size="14" fill="#ffffff" text-anchor="middle">MP</text>
    <text x="50" y="64" font-family="sans-serif" font-weight="800" font-size="7.5" fill="#ffffff" text-anchor="middle">MALATYA PAZARI</text>
    <text x="50" y="74" font-family="sans-serif" font-weight="700" font-size="6.5" fill="#fde68a" text-anchor="middle">PALANCI</text>
  </svg>`""",

  "kervan": """`<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#065f46"/>
    <text x="50" y="56" font-family="'Times New Roman', serif" font-weight="900" font-size="16" fill="#fef08a" text-anchor="middle" letter-spacing="1">KERVAN</text>
    <text x="50" y="70" font-family="sans-serif" font-weight="600" font-size="6.5" fill="#ffffff" text-anchor="middle" letter-spacing="2">HOME</text>
  </svg>`""",

  "jollytur": """`<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#0284c7"/>
    <circle cx="50" cy="38" r="14" fill="#f59e0b"/>
    <text x="50" y="45" font-family="sans-serif" font-weight="900" font-size="18" fill="#ffffff" text-anchor="middle">j</text>
    <text x="50" y="68" font-family="sans-serif" font-weight="900" font-size="12" fill="#ffffff" text-anchor="middle">jolly</text>
  </svg>`""",

  "etstur": """`<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#dc2626"/>
    <text x="50" y="52" font-family="sans-serif" font-weight="900" font-size="26" fill="#ffffff" text-anchor="middle">ets</text>
    <text x="50" y="72" font-family="sans-serif" font-weight="800" font-size="9" fill="#ffffff" text-anchor="middle" letter-spacing="2">TUR</text>
  </svg>`""",

  "setur": """`<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#1e293b"/>
    <text x="50" y="56" font-family="sans-serif" font-weight="900" font-size="18" fill="#38bdf8" text-anchor="middle" letter-spacing="1.5">SETUR</text>
  </svg>`""",

  "haribo": """`<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#eab308"/>
    <rect x="15" y="32" width="70" height="34" rx="8" fill="#dc2626"/>
    <text x="50" y="54" font-family="sans-serif" font-weight="900" font-size="12" fill="#ffffff" text-anchor="middle" letter-spacing="0.5">HARIBO</text>
  </svg>`""",

  "bostondonuts": """`<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#831843"/>
    <circle cx="50" cy="38" r="14" fill="#f472b6"/>
    <circle cx="50" cy="38" r="5" fill="#831843"/>
    <text x="50" y="66" font-family="sans-serif" font-weight="800" font-size="8" fill="#ffffff" text-anchor="middle">BOSTON</text>
    <text x="50" y="76" font-family="sans-serif" font-weight="800" font-size="7" fill="#f472b6" text-anchor="middle">DONUTS</text>
  </svg>`""",

  "wafflestop": """`<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#d97706"/>
    <text x="50" y="48" font-family="sans-serif" font-weight="900" font-size="12" fill="#ffffff" text-anchor="middle">WAFFLE</text>
    <text x="50" y="68" font-family="sans-serif" font-weight="900" font-size="14" fill="#451a03" text-anchor="middle">STOP</text>
  </svg>`""",

  "cigkoftem": """`<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#15803d"/>
    <text x="50" y="54" font-family="sans-serif" font-weight="900" font-size="12" fill="#ffffff" text-anchor="middle">ÇİĞKÖFTEM</text>
  </svg>`""",

  "capacityeczane": """`<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#ffffff"/>
    <rect x="42" y="22" width="16" height="36" fill="#dc2626"/>
    <rect x="32" y="32" width="36" height="16" fill="#dc2626"/>
    <circle cx="50" cy="40" r="10" fill="#ffffff"/>
    <text x="50" y="46" font-family="sans-serif" font-weight="900" font-size="14" fill="#dc2626" text-anchor="middle">E</text>
    <text x="50" y="74" font-family="sans-serif" font-weight="800" font-size="8" fill="#dc2626" text-anchor="middle" letter-spacing="1">ECZANE</text>
  </svg>`""",

  "altinigneterzi": """`<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#1e293b"/>
    <text x="50" y="50" font-family="'Times New Roman', serif" font-weight="900" font-size="12" fill="#eab308" text-anchor="middle">ALTIN İĞNE</text>
    <text x="50" y="68" font-family="sans-serif" font-weight="700" font-size="8" fill="#ffffff" text-anchor="middle" letter-spacing="2">TERZİ</text>
  </svg>`""",

  "basaklostra": """`<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#7c2d12"/>
    <text x="50" y="48" font-family="'Times New Roman', serif" font-weight="800" font-size="13" fill="#fed7aa" text-anchor="middle">BAŞAK</text>
    <text x="50" y="68" font-family="sans-serif" font-weight="700" font-size="9" fill="#ffffff" text-anchor="middle" letter-spacing="1">LOSTRA</text>
  </svg>`""",

  "nailup": """`<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#be185d"/>
    <text x="50" y="48" font-family="sans-serif" font-weight="900" font-size="14" fill="#ffffff" text-anchor="middle">NAIL</text>
    <text x="50" y="68" font-family="sans-serif" font-weight="900" font-size="14" fill="#fbcfe8" text-anchor="middle">UP</text>
  </svg>`""",

  "simurgsanatevi": """`<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#115e59"/>
    <text x="50" y="50" font-family="'Times New Roman', serif" font-weight="900" font-size="14" fill="#ccfbf1" text-anchor="middle">SİMURG</text>
    <text x="50" y="68" font-family="sans-serif" font-weight="600" font-size="7" fill="#ffffff" text-anchor="middle" letter-spacing="1">SANAT EVİ</text>
  </svg>`""",

  "ortopedia": """`<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#2563eb"/>
    <text x="50" y="56" font-family="sans-serif" font-weight="900" font-size="11" fill="#ffffff" text-anchor="middle" letter-spacing="0.5">ORTOPEDIA</text>
  </svg>`""",

  "idilbaby": """`<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#0d9488"/>
    <text x="50" y="48" font-family="sans-serif" font-weight="900" font-size="13" fill="#ffffff" text-anchor="middle">İDİL</text>
    <text x="50" y="66" font-family="sans-serif" font-weight="700" font-size="9" fill="#99f6e4" text-anchor="middle">BABY</text>
  </svg>`""",

  "aydindoviz": """`<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#0f172a"/>
    <text x="50" y="46" font-family="sans-serif" font-weight="800" font-size="12" fill="#fbbf24" text-anchor="middle">AYDIN</text>
    <text x="50" y="66" font-family="sans-serif" font-weight="700" font-size="8" fill="#ffffff" text-anchor="middle" letter-spacing="1">DÖVİZ</text>
  </svg>`""",

  "gmgfirenze": """`<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#064e3b"/>
    <text x="50" y="48" font-family="'Times New Roman', serif" font-weight="900" font-size="14" fill="#ffffff" text-anchor="middle">GMG</text>
    <text x="50" y="66" font-family="'Times New Roman', serif" font-weight="700" font-size="8" fill="#a7f3d0" text-anchor="middle" letter-spacing="2">FIRENZE</text>
  </svg>`""",

  "cella": """`<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#262626"/>
    <text x="50" y="58" font-family="'Times New Roman', serif" font-weight="700" font-size="18" fill="#ffffff" text-anchor="middle" letter-spacing="1">cella</text>
  </svg>`""",

  "stylish": """`<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#581c87"/>
    <text x="50" y="56" font-family="sans-serif" font-weight="800" font-size="13" fill="#ffffff" text-anchor="middle" letter-spacing="1.5">STYLISH</text>
  </svg>`""",

  "takmatakma": """`<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#f43f5e"/>
    <text x="50" y="46" font-family="sans-serif" font-weight="900" font-size="10" fill="#ffffff" text-anchor="middle">TAKMA</text>
    <text x="50" y="66" font-family="sans-serif" font-weight="900" font-size="10" fill="#ffe4e6" text-anchor="middle">TAKMA</text>
  </svg>`""",

  "senolzeytinoglu": """`<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#18181b"/>
    <text x="50" y="46" font-family="sans-serif" font-weight="800" font-size="9" fill="#eab308" text-anchor="middle">ŞENOL</text>
    <text x="50" y="62" font-family="sans-serif" font-weight="700" font-size="7" fill="#ffffff" text-anchor="middle">ZEYTİNOĞLU</text>
    <text x="50" y="74" font-family="sans-serif" font-weight="600" font-size="5.5" fill="#a1a1aa" text-anchor="middle">KUAFÖR</text>
  </svg>`""",

  "yagcioglu": """`<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#451a03"/>
    <text x="50" y="52" font-family="'Times New Roman', serif" font-weight="800" font-size="10" fill="#fed7aa" text-anchor="middle">YAĞCIOĞLU</text>
    <text x="50" y="68" font-family="sans-serif" font-weight="600" font-size="7" fill="#ffffff" text-anchor="middle" letter-spacing="1">PASTANESİ</text>
  </svg>`""",

  "quum": """`<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#312e81"/>
    <text x="50" y="58" font-family="sans-serif" font-weight="900" font-size="18" fill="#ffffff" text-anchor="middle" letter-spacing="2">QUUM</text>
  </svg>`""",

  "bodytherapy": """`<svg viewBox="0 0 100 100" class="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="20" fill="#047857"/>
    <text x="50" y="48" font-family="sans-serif" font-weight="800" font-size="8.5" fill="#ffffff" text-anchor="middle">BODY THERAPY</text>
    <text x="50" y="66" font-family="sans-serif" font-weight="700" font-size="7" fill="#a7f3d0" text-anchor="middle" letter-spacing="1">PİLATES</text>
  </svg>`"""
}

# Read js/logos.js
with open('js/logos.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Insert new logos before `};` in BrandLogos
insert_marker = "\n};\n\n/**\n * Türkçe karakterleri"
if insert_marker not in content:
    # try finding closing brace of BrandLogos
    idx = content.rfind("};\n")
else:
    idx = content.find(insert_marker)

addition_lines = ["\n  // --- YENİ EKLENEN KURUMSAL MARKA LOGOLARI (WEB SCRAPING & RESMİ VEKTÖRLER) ---"]
for key, svg_code in NEW_LOGOS.items():
    addition_lines.append(f"  {key}: {svg_code},")

addition_str = "\n".join(addition_lines) + "\n"

new_content = content[:idx] + addition_str + content[idx:]

with open('js/logos.js', 'w', encoding='utf-8') as f:
    f.write(new_content)

print(f"Successfully added {len(NEW_LOGOS)} new brand logos to js/logos.js!")
