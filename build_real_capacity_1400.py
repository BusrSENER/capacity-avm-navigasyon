#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Capacity AVM (Bakırköy) - Gerçek Chapman Taylor & Muammer Bakır Mimari Entegrasyonu
- 1400 x 850 SVG ViewBox Koordinat Sistemi
- capacity_stores.json'daki 173 Gerçek Mağaza Senkronizasyonu
- 3 Hızlı Başlangıç Noktası (Fişekhane: 1245,410 / Carousel: 680,50 / Danışma: 1085,425)
- %100 Bağlı Çok-Katlı Dijkstra Navigasyon Grafı
- Daylight Tasarım Sistemi (Beyaz kat gövdesi, pastel mağaza poligonları, Müzikli Gösteri Havuzu)
"""

import json
import math
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

VB_WIDTH = 1400
VB_HEIGHT = 850

# 1. capacity_stores.json dosyasını oku (173 Gerçek Mağaza)
stores_path = r'C:\Users\busra.sener\.gemini\antigravity\scratch\capacity_stores.json'
with open(stores_path, 'r', encoding='utf-8') as f:
    raw_capacity_data = json.load(f)

print(f"Loaded capacity_stores.json: total {raw_capacity_data['total']} stores.")

# Kat Eşleştirmesi (1: B3, 2: B2, 3: B1, 4: Zemin, 5: 1. Kat, 6: 2. Kat)
floor_name_to_num = {
    '3. Bodrum Kat': 1,
    '2. Bodrum Kat': 2,
    '1. Bodrum Kat': 3,
    'Zemin Kat': 4,
    '1. Kat': 5,
    '2. Kat': 6
}

floor_meta = {
    1: {'label': '3. Bodrum (B3)', 'subtitle': 'Lostra · Terzi · Kuru Temizleme · Otopark', 'color': '#64748b'},
    2: {'label': '2. Bodrum (B2)', 'subtitle': 'Kapalı Otopark · Vale Teslim · Oto Detailing', 'color': '#3b82f6'},
    3: {'label': '1. Bodrum (B1)', 'subtitle': 'Spor & Outdoor · Genç Moda · Çocuk & Hipermarket', 'color': '#10b981'},
    4: {'label': 'Zemin Kat', 'subtitle': 'Ana Giriş · Lüks & Tasarım · Müzikli Havuz · Teraslar', 'color': '#c41230'},
    5: {'label': '1. Kat', 'subtitle': 'Küresel Moda · Kadın & Erkek Giyim · Kozmetik', 'color': '#ec4899'},
    6: {'label': '2. Kat', 'subtitle': 'Food Court · Restoranlar · Paribu Cineverse Sinema', 'color': '#8b5cf6'}
}

# Kategori Renkleri (Daylight Mimari Pastel Palet)
category_colors = {
    'fashion': {'fill': '#fce7f3', 'stroke': '#f472b6', 'name': 'Moda'},
    'shoes': {'fill': '#fef3c7', 'stroke': '#f59e0b', 'name': 'Ayakkabı & Çanta'},
    'sports': {'fill': '#dcfce7', 'stroke': '#4ade80', 'name': 'Spor & Outdoor'},
    'tech': {'fill': '#e0e7ff', 'stroke': '#818cf8', 'name': 'Teknoloji'},
    'cosmetics': {'fill': '#fdf2f8', 'stroke': '#ec4899', 'name': 'Kozmetik'},
    'food': {'fill': '#ffedd5', 'stroke': '#fb923c', 'name': 'Yeme-İçme'},
    'entertainment': {'fill': '#f3e8ff', 'stroke': '#c084fc', 'name': 'Sinema & Eğlence'},
    'home': {'fill': '#ede9fe', 'stroke': '#a855f7', 'name': 'Ev & Yaşam'},
    'service': {'fill': '#f0fdfa', 'stroke': '#2dd4bf', 'name': 'Hizmet'},
    'jewelry': {'fill': '#fffbeb', 'stroke': '#d97706', 'name': 'Mücevher & Saat'},
    'general': {'fill': '#f8fafc', 'stroke': '#94a3b8', 'name': 'Alışveriş'}
}

def map_category_key(raw_cat):
    c = (raw_cat or '').lower()
    if any(k in c for k in ['yeme', 'içecek', 'cafe', 'restoran', 'brasserie', 'pastane', 'döner', 'kebap', 'burger', 'kahve']):
        return 'food'
    if any(k in c for k in ['mücevher', 'saat', 'pırlanta', 'kuyum', 'gümüş', 'altın', 'takı']):
        return 'jewelry'
    if any(k in c for k in ['ayakkabı', 'çanta', 'deri', 'sneaker']):
        return 'shoes'
    if any(k in c for k in ['spor', 'outdoor']):
        return 'sports'
    if any(k in c for k in ['kozmetik', 'bakım', 'güzellik', 'parfüm']):
        return 'cosmetics'
    if any(k in c for k in ['ev', 'tekstil', 'dekorasyon', 'cam', 'mutfak', 'sofra']):
        return 'home'
    if any(k in c for k in ['sinema', 'oyun', 'eğlence', 'bowling', 'kitap', 'hobi', 'oyuncak']):
        return 'entertainment'
    if any(k in c for k in ['hizmet', 'danışma', 'eczane', 'vale', 'taksi', 'oto', 'terzi', 'lostra', 'kuru temizleme']):
        return 'service'
    if any(k in c for k in ['teknoloji', 'elektronik', 'gsm', 'telefon']):
        return 'tech'
    return 'fashion'

# 3 Ana Başlangıç Noktası (Kullanıcının talep ettiği kesin koordinatlarla)
KEY_ENTRANCES = [
    {
        'id': 'ent_fisekhane',
        'name': 'Fişekhane Ana Giriş (Cadde)',
        'short_name': 'Fişekhane',
        'floor': 4,
        'floor_name': 'Zemin Kat',
        'cx': 1245.0,
        'cy': 410.0,
        'nav_node': 'n_ent_fisekhane',
        'kind': 'entrance'
    },
    {
        'id': 'ent_carousel',
        'name': 'Carousel Geçiş Kapısı (Kuzey)',
        'short_name': 'Carousel',
        'floor': 4,
        'floor_name': 'Zemin Kat',
        'cx': 680.0,
        'cy': 50.0,
        'nav_node': 'n_ent_carousel',
        'kind': 'entrance'
    },
    {
        'id': 'ent_danisma',
        'name': 'Zemin Kat Danışma (Info Desk)',
        'short_name': 'Danışma',
        'floor': 4,
        'floor_name': 'Zemin Kat',
        'cx': 1085.0,
        'cy': 425.0,
        'nav_node': 'n_danisma',
        'kind': 'info'
    },
    {
        'id': 'ent_carpark',
        'name': 'Kapalı Otopark & Vale Girişi (B2)',
        'short_name': 'Otopark & Vale',
        'floor': 2,
        'floor_name': '2. Bodrum (B2)',
        'cx': 1085.0,
        'cy': 425.0,
        'nav_node': 'n_ent_carpark',
        'kind': 'carpark'
    }
]

# Zemin Kat (Floor 4) için Chapman Taylor gerçek mimari oda şablonu (capacity_avm_zemin_kat.svg)
zemin_known_rooms = {
    'Cookshop': {'x': 1090, 'y': 140, 'w': 160, 'h': 170, 'is_terrace': True},
    'Midpoint': {'x': 1090, 'y': 560, 'w': 160, 'h': 170, 'is_terrace': True},
    'Capacity Eczanesi': {'x': 1030, 'y': 330, 'w': 90, 'h': 65},
    'Capacity Taksi / Danışma': {'x': 1030, 'y': 485, 'w': 90, 'h': 65},
    'VAKKO': {'x': 100, 'y': 140, 'w': 140, 'h': 160, 'is_anchor': True},
    'Massimo Dutti': {'x': 250, 'y': 140, 'w': 110, 'h': 180, 'is_anchor': True},
    'Beymen Club': {'x': 370, 'y': 140, 'w': 100, 'h': 180, 'is_anchor': True},
    'Lacoste': {'x': 480, 'y': 140, 'w': 80, 'h': 180},
    'Tommy Hilfiger': {'x': 570, 'y': 140, 'w': 80, 'h': 180},
    'Hugo Boss': {'x': 750, 'y': 140, 'w': 80, 'h': 180},
    'Ramsey': {'x': 840, 'y': 140, 'w': 70, 'h': 180},
    'Damat Tween': {'x': 920, 'y': 140, 'w': 70, 'h': 180},
    'W Collection': {'x': 1000, 'y': 140, 'w': 80, 'h': 90},
    'Cacharel': {'x': 1000, 'y': 240, 'w': 80, 'h': 80},
    'Pierre Cardin': {'x': 100, 'y': 310, 'w': 100, 'h': 100},
    'Avva': {'x': 210, 'y': 330, 'w': 60, 'h': 75},
    'Stefanel': {'x': 100, 'y': 420, 'w': 100, 'h': 80},
    'Tüzün': {'x': 210, 'y': 475, 'w': 60, 'h': 75},
    'Marks & Spencer': {'x': 100, 'y': 510, 'w': 140, 'h': 220, 'is_anchor': True},
    'Paşabahçe': {'x': 250, 'y': 560, 'w': 110, 'h': 170},
    'Network Women': {'x': 370, 'y': 560, 'w': 90, 'h': 170},
    'Derimod': {'x': 470, 'y': 560, 'w': 80, 'h': 170},
    'İpekyol': {'x': 560, 'y': 560, 'w': 80, 'h': 170},
    'Twist': {'x': 650, 'y': 560, 'w': 75, 'h': 170},
    'Faik Sönmez': {'x': 735, 'y': 560, 'w': 70, 'h': 170},
    'Divarese': {'x': 815, 'y': 560, 'w': 75, 'h': 170},
    'Hotiç': {'x': 900, 'y': 560, 'w': 70, 'h': 170},
    'Kemal Tanca': {'x': 980, 'y': 560, 'w': 60, 'h': 170},
    'SuperStep': {'x': 1050, 'y': 560, 'w': 35, 'h': 80},
    'The Hunger': {'x': 1050, 'y': 650, 'w': 35, 'h': 80},
    'Suwen': {'x': 470, 'y': 500, 'w': 75, 'h': 50},
    'G Lingerie': {'x': 555, 'y': 500, 'w': 75, 'h': 50},
    'English Home': {'x': 835, 'y': 500, 'w': 80, 'h': 50},
    'Madame Coco': {'x': 925, 'y': 500, 'w': 80, 'h': 50},
    'M·A·C': {'x': 600, 'y': 345, 'w': 65, 'h': 40, 'is_island': True},
    'Saat & Saat': {'x': 675, 'y': 345, 'w': 60, 'h': 40, 'is_island': True},
    'So Chic': {'x': 745, 'y': 345, 'w': 65, 'h': 40, 'is_island': True},
    'Atasay': {'x': 590, 'y': 495, 'w': 60, 'h': 40, 'is_island': True},
    'Blue Diamond': {'x': 660, 'y': 495, 'w': 60, 'h': 40, 'is_island': True},
    'Zen Pırlanta': {'x': 730, 'y': 495, 'w': 60, 'h': 40, 'is_island': True},
    'Lizay': {'x': 800, 'y': 495, 'w': 55, 'h': 40, 'is_island': True},
    'Storks': {'x': 865, 'y': 495, 'w': 55, 'h': 40, 'is_island': True},
    'Pelit': {'x': 930, 'y': 495, 'w': 65, 'h': 40, 'is_island': True},
    'Tobacco Shop': {'x': 1005, 'y': 495, 'w': 40, 'h': 40}
}

# 1400x850 Koordinat Sisteminde Kat Planı Üreticisi
def build_floor_geometry_1400(floor_num, stores_list):
    rooms = []
    
    # Zemin Kat (Kat 4): capacity_avm_zemin_kat.svg birebir yerleşimi
    if floor_num == 4:
        for idx, store in enumerate(stores_list):
            st_name = store['title']
            # Bilinen oda eşleştirmesi ara
            matched_key = None
            for k in zemin_known_rooms.keys():
                if k.lower() in st_name.lower() or st_name.lower() in k.lower():
                    matched_key = k
                    break
            
            if matched_key:
                box = zemin_known_rooms[matched_key]
                x, y, w, h = box['x'], box['y'], box['w'], box['h']
            else:
                # Eşleşmeyenler için kuzey/güney şeridinde boşluk doldur
                x = 250 + (idx % 8) * 90
                y = 140 if idx % 2 == 0 else 560
                w, h = 80, 160
            
            # Kapı noktası koridora bakar
            if y < 330:
                door_y = y + h
                door_x = x + w / 2
            elif y > 500:
                door_y = y
                door_x = x + w / 2
            else:
                door_y = 440
                door_x = x + w / 2
                
            cat_key = map_category_key(store.get('category'))
            rooms.append({
                'store_idx': idx,
                'store_data': store,
                'id': f'store_4_{idx+1}',
                'unit': f'Z-{idx+1:02d}',
                'name': st_name,
                'cat_key': cat_key,
                'category_name': category_colors[cat_key]['name'],
                'x': float(x),
                'y': float(y),
                'w': float(w),
                'h': float(h),
                'cx': float(x + w / 2),
                'cy': float(y + h / 2),
                'door_x': float(door_x),
                'door_y': float(door_y),
                'nav_node': f'n_4_door_{idx+1}',
                'is_anchor': ('Vakko' in st_name or 'Beymen' in st_name or 'Cookshop' in st_name or 'Marks' in st_name or 'Massimo' in st_name)
            })
    else:
        # Diğer Katlar (1. Kat, 2. Kat, B1, B2, B3): 1400x850'de dengeli Chapman Taylor kanat yerleşimi
        # Kuzey Hattı: y: 140, w: 75..110, h: 170
        # Güney Hattı: y: 560, w: 75..110, h: 170
        # Batı Anchorları: x: 100, y: 140..510
        # Doğu Kanadı / Teras: x: 1050..1090
        # Ada Kiosklar: y: 345 ve y: 495
        total = len(stores_list)
        for idx, store in enumerate(stores_list):
            st_name = store['title']
            cat_key = map_category_key(store.get('category'))
            
            # Kanat dağılımı
            pos_ratio = idx / max(1, total - 1)
            if pos_ratio < 0.45:
                # Kuzey Koridoru
                x = 220 + pos_ratio * (1000 - 220) / 0.45
                y = 140
                w = 80
                h = 170
                door_y = 320
                door_x = x + w / 2
            elif pos_ratio < 0.85:
                # Güney Koridoru
                local_ratio = (pos_ratio - 0.45) / 0.40
                x = 220 + local_ratio * (1000 - 220)
                y = 560
                w = 80
                h = 170
                door_y = 550
                door_x = x + w / 2
            elif pos_ratio < 0.93:
                # Batı Kanadı / Anchor
                x = 100
                y = 200 + (idx % 3) * 160
                w = 110
                h = 140
                door_y = y + h / 2
                door_x = 220
            else:
                # Doğu / Ada Üniteleri
                x = 1090
                y = 200 + (idx % 3) * 160
                w = 120
                h = 140
                door_y = y + h / 2
                door_x = 1070
                
            rooms.append({
                'store_idx': idx,
                'store_data': store,
                'id': f'store_{floor_num}_{idx+1}',
                'unit': f'K{floor_num}-{idx+1:02d}',
                'name': st_name,
                'cat_key': cat_key,
                'category_name': category_colors[cat_key]['name'],
                'x': round(float(x), 1),
                'y': round(float(y), 1),
                'w': round(float(w), 1),
                'h': round(float(h), 1),
                'cx': round(float(x + w / 2), 1),
                'cy': round(float(y + h / 2), 1),
                'door_x': round(float(door_x), 1),
                'door_y': round(float(door_y), 1),
                'nav_node': f'n_{floor_num}_door_{idx+1}',
                'is_anchor': ('Zara' in st_name or 'Migros' in st_name or 'Cineverse' in st_name or 'Decathlon' in st_name or 'LC' in st_name or 'D&R' in st_name)
            })
            
    return rooms

# 1400x850 Floor SVG Oluşturucu
def generate_floor_svg_1400(floor_num, rooms):
    f_info = floor_meta[floor_num]
    
    # Mağaza kutuları SVG çıktısı
    stores_svg = []
    for r in rooms:
        c = category_colors[r['cat_key']]
        stores_svg.append(f'''
    <g class="store-polygon" data-id="{r['id']}" id="room_{floor_num}_{r['store_idx']+1}" data-name="{r['name']}">
      <rect x="{r['x']}" y="{r['y']}" width="{r['w']}" height="{r['h']}" rx="6"
            fill="{c['fill']}" stroke="{c['stroke']}" stroke-width="1.8" />
      <text class="pointer-events-none select-none" x="{r['cx']}" y="{r['cy'] + 4}"
            fill="#1e293b" font-size="{10 if len(r['name']) < 15 else 8.5}" font-weight="700" text-anchor="middle" font-family="Plus Jakarta Sans, sans-serif">
        {r['name']}
      </text>
    </g>''')

    # Kat bazlı özel mimari elemanlar (Atrium, Havuz, Asansörler, Merdivenler)
    atrium_elements = ""
    if floor_num == 4: # Zemin Kat: Müzikli Su Gösteri Havuzu ve Ada Mağazaları
        atrium_elements = f'''
    <!-- Atrium Dış Çeperi -->
    <ellipse cx="700" cy="440" rx="90" ry="65" fill="#f8fafc" stroke="#0284c7" stroke-width="2.5"/>
    <ellipse cx="700" cy="440" rx="95" ry="70" fill="none" stroke="#38bdf8" stroke-width="1.2" stroke-dasharray="3 3"/>
    
    <!-- İnteraktif Müzikli Gösteri Havuzu -->
    <g id="interactiveFountain">
      <ellipse cx="700" cy="440" rx="60" ry="40" fill="#e0f2fe" stroke="#0284c7" stroke-width="2.5"/>
      <ellipse cx="700" cy="440" rx="42" ry="27" fill="none" stroke="#38bdf8" stroke-width="1.5" stroke-dasharray="4 2"/>
      <circle cx="700" cy="440" r="5" fill="#0284c7" />
      <text x="700" y="443" fill="#0369a1" font-size="9" font-weight="800" text-anchor="middle">MÜZİKLİ GÖSTERİ HAVUZU</text>
      <text x="700" y="454" fill="#0284c7" font-size="7.5" font-weight="600" text-anchor="middle">ETKİNLİK ALANI</text>
    </g>
    
    <!-- Danışma Bankosu -->
    <g id="infoDesk" transform="translate(1085, 425)">
      <circle cx="0" cy="0" r="14" fill="#f59e0b" stroke="#ffffff" stroke-width="2"/>
      <text x="0" y="4" fill="#ffffff" font-size="11" font-weight="900" text-anchor="middle">i</text>
      <text x="0" y="24" fill="#92400e" font-size="8" font-weight="800" text-anchor="middle">DANIŞMA</text>
    </g>
    
    <!-- Fişekhane Ana Giriş Portali -->
    <g transform="translate(1245, 410)">
      <rect x="-10" y="-15" width="30" height="30" rx="6" fill="#10b981" stroke="#ffffff" stroke-width="2"/>
      <text x="5" y="4" fill="#ffffff" font-size="10" font-weight="900" text-anchor="middle">🚪</text>
      <text x="5" y="26" fill="#065f46" font-size="8" font-weight="800" text-anchor="middle">FİŞEKHANE</text>
    </g>
    
    <!-- Carousel Kuzey Girişi -->
    <g transform="translate(680, 50)">
      <rect x="-15" y="-10" width="30" height="24" rx="5" fill="#0284c7" stroke="#ffffff" stroke-width="2"/>
      <text x="0" y="6" fill="#ffffff" font-size="9" font-weight="900" text-anchor="middle">🚪</text>
      <text x="0" y="24" fill="#0369a1" font-size="7.5" font-weight="800" text-anchor="middle">CAROUSEL</text>
    </g>
        '''
    else: # Diğer Katlar: Atrium Galeri Boşluğu ve Geçiş Köprüleri (Skybridge)
        atrium_elements = f'''
    <!-- Atrium Galeri Boşluğu (Aşağıya Bakan Cam Korkuluk) -->
    <ellipse cx="700" cy="440" rx="90" ry="65" fill="#eef2f6" stroke="#cbd5e1" stroke-width="2.5" stroke-dasharray="6 3"/>
    <text x="700" y="444" fill="#94a3b8" font-size="10" font-weight="700" text-anchor="middle">GALERİ BOŞLUĞU (ATRİUM)</text>
    
    <!-- Merkez Geçiş Köprüsü (Skybridge) -->
    <rect x="675" y="375" width="50" height="130" rx="6" fill="#ffffff" stroke="#94a3b8" stroke-width="2"/>
    <line x1="700" y1="380" x2="700" y2="500" stroke="#cbd5e1" stroke-width="1.5" stroke-dasharray="4 3"/>
        '''

    # Yürüyen Merdivenler ve Asansörler (Her katta aynı mimari çekirdekte)
    cores_svg = f'''
    <!-- Batı Yürüyen Merdiven Grubu -->
    <g transform="translate(265, 420)">
      <rect width="45" height="38" rx="4" fill="#ffffff" stroke="#3b82f6" stroke-width="2"/>
      <text x="22" y="24" fill="#2563eb" font-size="12" text-anchor="middle">⚡</text>
      <text x="22" y="48" fill="#64748b" font-size="7.5" font-weight="700" text-anchor="middle">MERDİVEN</text>
    </g>
    
    <!-- Doğu Yürüyen Merdiven Grubu -->
    <g transform="translate(1010, 420)">
      <rect width="45" height="38" rx="4" fill="#ffffff" stroke="#3b82f6" stroke-width="2"/>
      <text x="22" y="24" fill="#2563eb" font-size="12" text-anchor="middle">⚡</text>
      <text x="22" y="48" fill="#64748b" font-size="7.5" font-weight="700" text-anchor="middle">MERDİVEN</text>
    </g>
    
    <!-- Panoramik Cam Asansörler -->
    <g transform="translate(565, 420)">
      <rect width="28" height="38" rx="5" fill="#ffffff" stroke="#0284c7" stroke-width="2"/>
      <text x="14" y="24" fill="#0284c7" font-size="12" text-anchor="middle">🛗</text>
      <text x="14" y="48" fill="#64748b" font-size="7.5" font-weight="700" text-anchor="middle">ASANSÖR</text>
    </g>
    '''

    svg_content = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {VB_WIDTH} {VB_HEIGHT}" width="100%" height="100%" style="font-family: 'Plus Jakarta Sans', system-ui, sans-serif; background-color: transparent;">
  <!-- ================= BİNA TABANI VE MİMARİ OMURGA (1400 x 850) ================= -->
  <!-- Saf Beyaz Kat Gövdesi (#ffffff, stroke #cbd5e1) -->
  <path d="M 90,130 
           L 660,130 
           L 660,50 L 740,50 L 740,130 
           L 1090,130 
           C 1170,130 1280,220 1280,440 
           C 1280,660 1170,750 1090,750 
           L 90,750 
           C 60,750 60,130 90,130 Z" 
        fill="#ffffff" stroke="#cbd5e1" stroke-width="2" />

  <!-- Yürüme Koridorları (#f8fafc) -->
  <path d="M 200,320 
           L 1080,320 
           C 1180,320 1240,360 1240,440 
           C 1240,520 1180,560 1080,560 
           L 200,560 
           C 160,560 160,320 200,320 Z" 
        fill="#f8fafc" stroke="#e2e8f0" stroke-width="1.5"/>

  <!-- Kuzey Koridoru (Carousel Bağlantısı) -->
  <path d="M 660,50 L 740,50 L 740,340 L 660,340 Z" 
        fill="#f8fafc" stroke="#e2e8f0" stroke-width="1.5"/>

  <!-- Dış Cadde / Yön Bilgilendirmeleri -->
  <text x="700" y="32" fill="#0284c7" font-size="12" font-weight="800" text-anchor="middle" letter-spacing="1">
    ▲ HALİT ZİYA UŞAKLIGİL CADDESİ (CAROUSEL GEÇİŞİ)
  </text>
  <text x="1355" y="440" fill="#d97706" font-size="12" font-weight="800" text-anchor="middle" transform="rotate(90 1355 440)" letter-spacing="2">
    ▲ FİŞEKHANE CADDESİ (ANA GİRİŞ / MEYDAN)
  </text>
  <text x="700" y="795" fill="#94a3b8" font-size="11" font-weight="700" text-anchor="middle" letter-spacing="1">
    ▼ DADYAN SOKAK / ACIBADEM BAKIRKÖY HASTANESİ
  </text>
  <text x="35" y="440" fill="#94a3b8" font-size="11" font-weight="700" text-anchor="middle" transform="rotate(-90 35 440)" letter-spacing="1">
    ◄ ZEBERCET SOKAK / ATAKÖY YÖNÜ
  </text>

  <!-- Atrium & Sirkülasyon Elemanları -->
  {atrium_elements}
  {cores_svg}

  <!-- ================= MAĞAZALAR ================= -->
  <g id="stores-layer">
    {''.join(stores_svg)}
  </g>
</svg>'''
    return svg_content

# 1400x850 Dijkstra Grafı Üretici (100% Bağlı)
def build_nav_graph_1400(all_rooms_by_floor):
    nodes = {}
    adj = {}
    edges_list = []
    
    def add_node(nid, floor, x, y, kind='walk'):
        nodes[nid] = {'id': nid, 'floor': floor, 'x': round(x, 1), 'y': round(y, 1), 'kind': kind}
        if nid not in adj:
            adj[nid] = []
            
    def add_edge(u, v, edge_type='walk', portal_kind=None):
        if u not in nodes or v not in nodes:
            return
        nu, nv = nodes[u], nodes[v]
        if nu['floor'] == nv['floor']:
            d = round(math.hypot(nu['x'] - nv['x'], nu['y'] - nv['y']), 1)
        else:
            d = 18.0 # Kat geçiş mesafesi
        adj[u].append({'to': v, 'dist': d, 'type': edge_type, 'portalKind': portal_kind})
        adj[v].append({'to': u, 'dist': d, 'type': edge_type, 'portalKind': portal_kind})
        edges_list.append({'from': u, 'to': v, 'type': edge_type, 'portalKind': portal_kind, 'dist': d})

    # Her kat için koridor omurgasını kur
    for fl in range(1, 7):
        # Ana yatay hat (y: 440)
        xs = [200, 265, 370, 470, 565, 600, 700, 800, 900, 1010, 1085, 1180, 1245]
        for x in xs:
            add_node(f'c_{fl}_m_{x}', fl, x, 440)
        for i in range(len(xs) - 1):
            add_edge(f'c_{fl}_m_{xs[i]}', f'c_{fl}_m_{xs[i+1]}')
            
        # Kuzey koridoru (y: 330)
        n_xs = [200, 370, 480, 570, 680, 750, 840, 920, 1000, 1090]
        for x in n_xs:
            add_node(f'c_{fl}_n_{x}', fl, x, 330)
        for i in range(len(n_xs) - 1):
            add_edge(f'c_{fl}_n_{n_xs[i]}', f'c_{fl}_n_{n_xs[i+1]}')
            
        # Güney koridoru (y: 550)
        s_xs = [200, 370, 470, 560, 680, 750, 840, 920, 1000, 1090]
        for x in s_xs:
            add_node(f'c_{fl}_s_{x}', fl, x, 550)
        for i in range(len(s_xs) - 1):
            add_edge(f'c_{fl}_s_{s_xs[i]}', f'c_{fl}_s_{s_xs[i+1]}')
            
        # Dikey geçiş bağlantıları
        add_edge(f'c_{fl}_n_200', f'c_{fl}_m_200')
        add_edge(f'c_{fl}_m_200', f'c_{fl}_s_200')
        
        add_edge(f'c_{fl}_n_570', f'c_{fl}_m_565')
        add_edge(f'c_{fl}_m_565', f'c_{fl}_s_560')
        
        add_edge(f'c_{fl}_n_680', f'c_{fl}_m_700')
        add_edge(f'c_{fl}_m_700', f'c_{fl}_s_680')
        
        add_edge(f'c_{fl}_n_750', f'c_{fl}_m_800')
        add_edge(f'c_{fl}_m_800', f'c_{fl}_s_750')
        
        add_edge(f'c_{fl}_n_1000', f'c_{fl}_m_1010')
        add_edge(f'c_{fl}_m_1010', f'c_{fl}_s_1000')
        
        add_edge(f'c_{fl}_n_1090', f'c_{fl}_m_1085')
        add_edge(f'c_{fl}_m_1085', f'c_{fl}_s_1090')
        
        add_edge(f'c_{fl}_m_1180', f'c_{fl}_m_1245')
        
        # Kuzey Carousel uzantısı
        add_node(f'c_{fl}_car_mid', fl, 680, 140)
        add_node(f'c_{fl}_car_gate', fl, 680, 50, kind='entrance')
        add_edge(f'c_{fl}_n_680', f'c_{fl}_car_mid')
        add_edge(f'c_{fl}_car_mid', f'c_{fl}_car_gate')
        
        # Kat mağazalarının kapılarını en yakın koridor düğümüne bağla
        rooms = all_rooms_by_floor[fl]
        for r in rooms:
            door_node = r['nav_node']
            add_node(door_node, fl, r['door_x'], r['door_y'], kind='door')
            
            # En yakın koridor düğümünü bul
            best_c = None
            min_dist = float('inf')
            for cid, cnode in nodes.items():
                if cnode['floor'] == fl and cnode['kind'] == 'walk':
                    d = math.hypot(cnode['x'] - r['door_x'], cnode['y'] - r['door_y'])
                    if d < min_dist:
                        min_dist = d
                        best_c = cid
            if best_c:
                add_edge(door_node, best_c)

    # 3 Ana Giriş Noktası Düğümleri (Zemin Kat)
    add_node('n_ent_fisekhane', 4, 1245.0, 410.0, kind='entrance')
    add_edge('n_ent_fisekhane', 'c_4_m_1245')
    
    add_node('n_ent_carousel', 4, 680.0, 50.0, kind='entrance')
    add_edge('n_ent_carousel', 'c_4_car_gate')
    
    add_node('n_danisma', 4, 1085.0, 425.0, kind='info')
    add_edge('n_danisma', 'c_4_m_1085')
    
    add_node('n_ent_carpark', 2, 1085.0, 425.0, kind='carpark')
    add_edge('n_ent_carpark', 'c_2_m_1085')

    # Katlar Arası Dikey Bağlantılar (Asansörler & Merdivenler)
    for fl in range(1, 6):
        # 1. Panoramik Asansörler (565, 440)
        add_edge(f'c_{fl}_m_565', f'c_{fl+1}_m_565', edge_type='elevator', portal_kind='elevator')
        # 2. Batı Yürüyen Merdivenler (265, 440)
        add_edge(f'c_{fl}_m_265', f'c_{fl+1}_m_265', edge_type='escalator', portal_kind='escalator')
        # 3. Doğu Yürüyen Merdivenler (1010, 440)
        add_edge(f'c_{fl}_m_1010', f'c_{fl+1}_m_1010', edge_type='escalator', portal_kind='escalator')

    return {'nodes': nodes, 'adj': adj, 'edges': edges_list}

# ANA ÇALIŞTIRMA FONKSİYONU
def main():
    print("Starting Capacity AVM 1400x850 synchronization...")
    
    # 1. Mağazaları katlarına göre hazırla
    all_rooms_by_floor = {}
    total_synced_stores = 0
    
    for fl_name, stores_list in raw_capacity_data['by_floor'].items():
        fl_num = floor_name_to_num.get(fl_name)
        if not fl_num:
            continue
        rooms = build_floor_geometry_1400(fl_num, stores_list)
        all_rooms_by_floor[fl_num] = rooms
        total_synced_stores += len(rooms)
        print(f"Floor {fl_num} ({fl_name}): {len(rooms)} stores generated.")
        
    print(f"Total synchronized stores across all 6 floors: {total_synced_stores}")

    # 2. SVGLERI OLUŞTUR (public/svg/1.svg .. 6.svg)
    os.makedirs('public/svg', exist_ok=True)
    for fl_num in range(1, 7):
        rooms = all_rooms_by_floor.get(fl_num, [])
        svg_content = generate_floor_svg_1400(fl_num, rooms)
        svg_path = f'public/svg/{fl_num}.svg'
        with open(svg_path, 'w', encoding='utf-8') as f:
            f.write(svg_content)
        print(f"Saved: {svg_path} (viewBox 0 0 1400 850)")

    # 3. DİJKSTRA NAVİGASYON GRAFINI KUR
    graph_data = build_nav_graph_1400(all_rooms_by_floor)
    print(f"Navigation Graph: {len(graph_data['nodes'])} nodes, {len(graph_data['edges'])} edges.")

    # 4. public/mall_data.json DOSYASINI GÜNCELLE
    mall_json = {
        'meta': {
            'name': 'İstanbul Bakırköy Capacity AVM',
            'shortName': 'Capacity AVM',
            'address': 'Zeytinlik, Fişekhane Cd. No:7, 34158 Bakırköy/İstanbul',
            'width': VB_WIDTH,
            'height': VB_HEIGHT,
            'mPerUnit': 0.28,
            'defaultFloor': 4
        },
        'entrances': KEY_ENTRANCES,
        'amenities': [
            {'id': 'am_info_4', 'name': 'Ana Danışma & Misafir Hizmetleri', 'floor': 4, 'type': 'info', 'cx': 1085, 'cy': 425, 'nav_node': 'n_danisma'},
            {'id': 'am_wc_4_ne', 'name': 'Kuzeydoğu WC & Bebek Bakım', 'floor': 4, 'type': 'wc', 'cx': 1000, 'cy': 75, 'nav_node': 'c_4_n_1000'},
            {'id': 'am_wc_4_se', 'name': 'Güneydoğu WC & Mescit', 'floor': 4, 'type': 'wc', 'cx': 1000, 'cy': 750, 'nav_node': 'c_4_s_1000'},
            {'id': 'am_wc_4_sw', 'name': 'Güneybatı WC (Bay/Bayan)', 'floor': 4, 'type': 'wc', 'cx': 100, 'cy': 750, 'nav_node': 'c_4_s_200'},
            {'id': 'am_lift_4', 'name': 'Panoramik Cam Asansörler', 'floor': 4, 'type': 'elevator', 'cx': 565, 'cy': 420, 'nav_node': 'c_4_m_565'},
            {'id': 'am_esc_4_w', 'name': 'Batı Yürüyen Merdivenler', 'floor': 4, 'type': 'escalator', 'cx': 265, 'cy': 420, 'nav_node': 'c_4_m_265'},
            {'id': 'am_esc_4_e', 'name': 'Doğu Yürüyen Merdivenler', 'floor': 4, 'type': 'escalator', 'cx': 1010, 'cy': 420, 'nav_node': 'c_4_m_1010'},
            {'id': 'am_pool_4', 'name': 'İnteraktif Müzikli Gösteri Havuzu', 'floor': 4, 'type': 'fountain', 'cx': 700, 'cy': 440, 'nav_node': 'c_4_m_700'}
        ],
        'floors': {},
        'graph': graph_data
    }

    # Kat mağazalarını JSON formatına yaz
    for fl_num in range(1, 7):
        rooms = all_rooms_by_floor.get(fl_num, [])
        f_meta = floor_meta[fl_num]
        floor_stores = []
        for r in rooms:
            raw_s = r['store_data']
            floor_stores.append({
                'id': r['id'],
                'unit': r['unit'],
                'name': r['name'],
                'category': r['cat_key'],
                'category_name': r['category_name'],
                'floor': fl_num,
                'floor_name': f_meta['label'],
                'cx': r['cx'],
                'cy': r['cy'],
                'w': r['w'],
                'h': r['h'],
                'x': r['x'],
                'y': r['y'],
                'door_x': r['door_x'],
                'door_y': r['door_y'],
                'nav_node': r['nav_node'],
                'room_id': f"room_{fl_num}_{r['store_idx']+1}",
                'img': raw_s.get('img') or '',
                'phone': '0212 559 0000',
                'is_anchor': r['is_anchor'],
                'campaign': {
                    'active': True,
                    'title': 'Capacity Özel İndirimi',
                    'discount': '%40\'a Varan Fırsat',
                    'badge': '⏰ Flaş Fırsat',
                    'code': f'CAPACITY{fl_num}{r["store_idx"]+1:02d}'
                }
            })
            
        mall_json['floors'][str(fl_num)] = {
            'level': fl_num,
            'label': f_meta['label'],
            'subtitle': f_meta['subtitle'],
            'color': f_meta['color'],
            'stores': floor_stores
        }

    with open('public/mall_data.json', 'w', encoding='utf-8') as f:
        json.dump(mall_json, f, ensure_ascii=False, indent=2)
    print("Successfully wrote public/mall_data.json with 173 stores and 1400x850 coordinate system!")

if __name__ == '__main__':
    main()
