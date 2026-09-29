#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
İstanbul Bakırköy Capacity AVM - Gerçek Mimari Kat Planı & Navigasyon Motoru Üreticisi
- Cevahir AVM standartlarında aydınlık, temiz, modern mimari
- Eliptik bumerang atrium, Müzikli Gösteri Havuzu, geniş promenadlar
- 173 Mağaza, 24 Servis Noktası, 4 Giriş Kapısı, Kusursuz Dijkstra Navigasyon Grafı
"""

import json
import math
import os

# Mevcut mağaza verisini oku
with open('public/mall_data.json', 'r', encoding='utf-8') as f:
    existing_mall = json.load(f)

# Kat Metadata
floor_meta = {
    1: {'label': '3. Bodrum (B3)', 'subtitle': 'Lostra · Terzi · Kuru Temizleme · Otopark', 'color': '#64748b'},
    2: {'label': '2. Bodrum (B2)', 'subtitle': 'Kapalı Otopark · Vale Teslim · Oto Detailing', 'color': '#3b82f6'},
    3: {'label': '1. Bodrum (B1)', 'subtitle': 'Spor & Outdoor · Genç Moda · Çocuk & Kitap', 'color': '#10b981'},
    4: {'label': 'Zemin Kat', 'subtitle': 'Ana Giriş · Lüks & Tasarım · Müzikli Havuz · Kafe', 'color': '#c41230'},
    5: {'label': '1. Kat', 'subtitle': 'Kadın & Erkek Moda · Kozmetik & Aksesuar', 'color': '#ec4899'},
    6: {'label': '2. Kat', 'subtitle': 'Restoranlar · Teras · Paribu Cineverse Sinema', 'color': '#8b5cf6'}
}

# Kategori Renk Eşleştirmesi (Mimari Pastel Palet)
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
    'atm': {'fill': '#ecfdf5', 'stroke': '#34d399', 'name': 'ATM'}
}

# Mağazaları katlarına göre ayıkla
stores_by_floor = {fl: existing_mall['floors'][str(fl)]['stores'] for fl in range(1, 7)}

# Mimari Oda Üretici Fonksiyonu
def generate_architectural_rooms_for_floor(floor_num, stores):
    total = len(stores)
    rooms = []
    store_objs = []
    
    # Katlara göre kanat kontenjanları
    if floor_num == 4: # Zemin (44 mağaza)
        w_cnt, e_cnt, n_cnt, s_cnt, k_cnt = 16, 16, 5, 5, 2
    elif floor_num == 3: # B1 (51 mağaza)
        w_cnt, e_cnt, n_cnt, s_cnt, k_cnt = 18, 18, 6, 5, 4
    elif floor_num == 5: # 1. Kat (45 mağaza)
        w_cnt, e_cnt, n_cnt, s_cnt, k_cnt = 16, 16, 5, 5, 3
    elif floor_num == 6: # 2. Kat (24 mağaza - Sinema & Restoranlar)
        w_cnt, e_cnt, n_cnt, s_cnt, k_cnt = 9, 9, 3, 3, 0
    elif floor_num == 1: # B3 (8 mağaza)
        w_cnt, e_cnt, n_cnt, s_cnt, k_cnt = 3, 3, 1, 1, 0
    else: # B2 (1 mağaza)
        w_cnt, e_cnt, n_cnt, s_cnt, k_cnt = 1, 0, 0, 0, 0

    idx = 0
    
    # 1. BATI KANADI MAĞAZALARI (Carousel / Cumhuriyet Meydanı Tarafı)
    # x: 34 .. 142 (Genişlik ~108px), y: 175 .. 555
    actual_w = min(w_cnt, total - idx)
    if actual_w > 0:
        step_y = (555 - 175) / actual_w
        for i in range(actual_w):
            st = stores[idx]
            y0 = 175 + i * step_y + 1.5
            y1 = y0 + step_y - 3.0
            x0, x1 = 34.0, 142.0
            cx = (x0 + x1) / 2
            cy = (y0 + y1) / 2
            door_x = 144.0
            door_y = cy
            d = f"M {x0:.1f} {y0:.1f} L {x1:.1f} {y0:.1f} L {x1:.1f} {y1:.1f} L {x0:.1f} {y1:.1f} Z"
            r_id = f"room_{floor_num}_{idx+1}"
            rooms.append({'id': r_id, 'd': d, 'cx': round(cx, 1), 'cy': round(cy, 1), 'door': (door_x, round(door_y, 1)), 'store_id': st['id'], 'category': st['category']})
            idx += 1

    # 2. DOĞU KANADI MAĞAZALARI (Fişekhane Caddesi Tarafı)
    # x: 374 .. 482 (Genişlik ~108px), y: 175 .. 555
    actual_e = min(e_cnt, total - idx)
    if actual_e > 0:
        step_y = (555 - 175) / actual_e
        for i in range(actual_e):
            st = stores[idx]
            y0 = 175 + i * step_y + 1.5
            y1 = y0 + step_y - 3.0
            x0, x1 = 374.0, 482.0
            cx = (x0 + x1) / 2
            cy = (y0 + y1) / 2
            door_x = 372.0
            door_y = cy
            d = f"M {x0:.1f} {y0:.1f} L {x1:.1f} {y0:.1f} L {x1:.1f} {y1:.1f} L {x0:.1f} {y1:.1f} Z"
            r_id = f"room_{floor_num}_{idx+1}"
            rooms.append({'id': r_id, 'd': d, 'cx': round(cx, 1), 'cy': round(cy, 1), 'door': (door_x, round(door_y, 1)), 'store_id': st['id'], 'category': st['category']})
            idx += 1

    # 3. KUZEY KANADI MAĞAZALARI (İstanbul Caddesi Tarafı)
    # y: 56 .. 136, x: 70 .. 446
    actual_n = min(n_cnt, total - idx)
    if actual_n > 0:
        step_x = (446 - 70) / actual_n
        for i in range(actual_n):
            st = stores[idx]
            x0 = 70 + i * step_x + 2.0
            x1 = x0 + step_x - 4.0
            y0, y1 = 56.0, 136.0
            cx = (x0 + x1) / 2
            cy = (y0 + y1) / 2
            door_x = cx
            door_y = 138.0
            d = f"M {x0:.1f} {y0:.1f} L {x1:.1f} {y0:.1f} L {x1:.1f} {y1:.1f} L {x0:.1f} {y1:.1f} Z"
            r_id = f"room_{floor_num}_{idx+1}"
            rooms.append({'id': r_id, 'd': d, 'cx': round(cx, 1), 'cy': round(cy, 1), 'door': (round(door_x, 1), door_y), 'store_id': st['id'], 'category': st['category']})
            idx += 1

    # 4. GÜNEY KANADI MAĞAZALARI (Marmaray / Tren İstasyonu Tarafı)
    # y: 594 .. 674, x: 70 .. 446
    actual_s = min(s_cnt, total - idx)
    if actual_s > 0:
        step_x = (446 - 70) / actual_s
        for i in range(actual_s):
            st = stores[idx]
            x0 = 70 + i * step_x + 2.0
            x1 = x0 + step_x - 4.0
            y0, y1 = 594.0, 674.0
            cx = (x0 + x1) / 2
            cy = (y0 + y1) / 2
            door_x = cx
            door_y = 592.0
            d = f"M {x0:.1f} {y0:.1f} L {x1:.1f} {y0:.1f} L {x1:.1f} {y1:.1f} L {x0:.1f} {y1:.1f} Z"
            r_id = f"room_{floor_num}_{idx+1}"
            rooms.append({'id': r_id, 'd': d, 'cx': round(cx, 1), 'cy': round(cy, 1), 'door': (round(door_x, 1), door_y), 'store_id': st['id'], 'category': st['category']})
            idx += 1

    # 5. ATRIUM İÇ KÖŞK / BUTİK ADALARI (Promenad kenarı şık köşkler)
    # Kalan mağazalar için
    while idx < total:
        st = stores[idx]
        k_i = idx - (actual_w + actual_e + actual_n + actual_s)
        side = 'west' if k_i % 2 == 0 else 'east'
        pos_y = 280 + (k_i // 2) * 55
        if side == 'west':
            x0, x1 = 182.0, 206.0
            door_x = 178.0
        else:
            x0, x1 = 310.0, 334.0
            door_x = 338.0
        y0, y1 = pos_y, pos_y + 24.0
        cx = (x0 + x1) / 2
        cy = (y0 + y1) / 2
        d = f"M {x0:.1f} {y0:.1f} L {x1:.1f} {y0:.1f} L {x1:.1f} {y1:.1f} L {x0:.1f} {y1:.1f} Z"
        r_id = f"room_{floor_num}_{idx+1}"
        rooms.append({'id': r_id, 'd': d, 'cx': round(cx, 1), 'cy': round(cy, 1), 'door': (round(door_x, 1), round(cy, 1)), 'store_id': st['id'], 'category': st['category']})
        idx += 1

    # Store objelerini güncelle
    for i, rm in enumerate(rooms):
        st = stores[i]
        st_copy = dict(st)
        st_copy['room_id'] = rm['id']
        st_copy['cx'] = rm['cx']
        st_copy['cy'] = rm['cy']
        st_copy['doors'] = [f"n_{floor_num}_door_{i+1}"]
        st_copy['doorP'] = rm['door']
        st_copy['nav_node'] = f"n_{floor_num}_door_{i+1}"
        store_objs.append(st_copy)

    return rooms, store_objs

# Navigasyon Grafı Oluşturucu
nav_graph = {'nodes': {}, 'adj': {}}

def add_node(nid, fl, x, y, ntype='corridor'):
    nav_graph['nodes'][nid] = {'floor': fl, 'x': round(x, 1), 'y': round(y, 1), 'type': ntype}
    if nid not in nav_graph['adj']:
        nav_graph['adj'][nid] = []

def add_edge(u, v, dist=None, etype='walk', pkind=None):
    if dist is None:
        p1 = nav_graph['nodes'][u]
        p2 = nav_graph['nodes'][v]
        dist = round(math.hypot(p1['x'] - p2['x'], p1['y'] - p2['y']) * 0.48, 1) # ~0.48m/px
    
    nav_graph['adj'][u].append({'to': v, 'dist': dist, 'type': etype, 'kind': pkind})
    nav_graph['adj'][v].append({'to': u, 'dist': dist, 'type': etype, 'kind': pkind})

# Her kat için promenad ve koridor düğümlerini üret
for fl in range(1, 7):
    # Batı Promenadı (x: 162)
    for i in range(11):
        y = 155 + i * 42 # 155 .. 575
        add_node(f"c_{fl}_w_{i}", fl, 162.0, y)
        if i > 0:
            add_edge(f"c_{fl}_w_{i-1}", f"c_{fl}_w_{i}")

    # Doğu Promenadı (x: 354)
    for i in range(11):
        y = 155 + i * 42 # 155 .. 575
        add_node(f"c_{fl}_e_{i}", fl, 354.0, y)
        if i > 0:
            add_edge(f"c_{fl}_e_{i-1}", f"c_{fl}_e_{i}")

    # Kuzey Geçiş Koridoru (y: 155)
    for i in range(1, 4):
        x = 162.0 + i * 48.0 # 210, 258, 306
        add_node(f"c_{fl}_n_{i}", fl, x, 155.0)
    add_edge(f"c_{fl}_w_0", f"c_{fl}_n_1")
    add_edge(f"c_{fl}_n_1", f"c_{fl}_n_2")
    add_edge(f"c_{fl}_n_2", f"c_{fl}_n_3")
    add_edge(f"c_{fl}_n_3", f"c_{fl}_e_0")

    # Güney Geçiş Koridoru (y: 575)
    for i in range(1, 4):
        x = 162.0 + i * 48.0 # 210, 258, 306
        add_node(f"c_{fl}_s_{i}", fl, x, 575.0)
    add_edge(f"c_{fl}_w_10", f"c_{fl}_s_1")
    add_edge(f"c_{fl}_s_1", f"c_{fl}_s_2")
    add_edge(f"c_{fl}_s_2", f"c_{fl}_s_3")
    add_edge(f"c_{fl}_s_3", f"c_{fl}_e_10")

    # Kuzey Köprüsü (y: 239) -> c_w_2 ile c_e_2 arası
    add_node(f"bridge_{fl}_n", fl, 258.0, 239.0)
    add_edge(f"c_{fl}_w_2", f"bridge_{fl}_n")
    add_edge(f"bridge_{fl}_n", f"c_{fl}_e_2")

    # Orta Köprü (y: 365) -> c_w_5 ile c_e_5 arası
    add_node(f"bridge_{fl}_m", fl, 258.0, 365.0)
    add_edge(f"c_{fl}_w_5", f"bridge_{fl}_m")
    add_edge(f"bridge_{fl}_m", f"c_{fl}_e_5")

    # Güney Köprüsü (y: 491) -> c_w_8 ile c_e_8 arası
    add_node(f"bridge_{fl}_s", fl, 258.0, 491.0)
    add_edge(f"c_{fl}_w_8", f"bridge_{fl}_s")
    add_edge(f"bridge_{fl}_s", f"c_{fl}_e_8")

    # Dikey Geçiş Düğümleri (Asansör, Merdiven)
    # Güney Panoramik Asansör
    add_node(f"portal_elev_s_{fl}", fl, 258.0, 535.0, 'elevator')
    add_edge(f"portal_elev_s_{fl}", f"c_{fl}_s_2")
    
    # Kuzey Servis Asansörü
    add_node(f"portal_elev_n_{fl}", fl, 210.0, 155.0, 'elevator')
    add_edge(f"portal_elev_n_{fl}", f"c_{fl}_n_1")

    # Güney Yürüyen Merdivenler
    add_node(f"portal_esc_s_{fl}", fl, 220.0, 520.0, 'escalator')
    add_edge(f"portal_esc_s_{fl}", f"c_{fl}_s_1")

    # Kuzey Yürüyen Merdivenler
    add_node(f"portal_esc_n_{fl}", fl, 258.0, 200.0, 'escalator')
    add_edge(f"portal_esc_n_{fl}", f"bridge_{fl}_n")

# Dikey Kat Bağlantı Kenarları (Merdiven ve Asansör Geçişleri)
links_list = []
for fa in range(1, 7):
    for fb in range(fa + 1, 7):
        diff = fb - fa
        # Asansör (tüm katlar arası kesintisiz)
        add_edge(f"portal_elev_s_{fa}", f"portal_elev_s_{fb}", dist=diff * 8.0, etype='elevator', pkind='elevator')
        add_edge(f"portal_elev_n_{fa}", f"portal_elev_n_{fb}", dist=diff * 9.0, etype='elevator', pkind='elevator')
        links_list.append({'kind': 'elevator', 'a': [fa, f"portal_elev_s_{fa}"], 'b': [fb, f"portal_elev_s_{fb}"]})
        
        # Yürüyen merdiven (ardışık katlar)
        if diff == 1:
            add_edge(f"portal_esc_s_{fa}", f"portal_esc_s_{fb}", dist=10.0, etype='escalator', pkind='escalator')
            add_edge(f"portal_esc_n_{fa}", f"portal_esc_n_{fb}", dist=10.0, etype='escalator', pkind='escalator')
            links_list.append({'kind': 'escalator', 'a': [fa, f"portal_esc_s_{fa}"], 'b': [fb, f"portal_esc_s_{fb}"]})

# Tüm Katların Odalarını ve Mağazalarını İşle
unified_floors = {}
all_stores_count = 0

for fl in range(1, 7):
    stores_raw = stores_by_floor[fl]
    rooms, store_objs = generate_architectural_rooms_for_floor(fl, stores_raw)
    all_stores_count += len(store_objs)

    # Kapı düğümlerini koridora bağla
    for rm in rooms:
        d_id = f"n_{fl}_door_{rm['id'].split('_')[-1]}"
        dx, dy = rm['door']
        add_node(d_id, fl, dx, dy, 'door')
        
        # En yakın koridor düğümünü bul
        min_d = float('inf')
        closest_id = None
        for nid, nd in nav_graph['nodes'].items():
            if nd['floor'] == fl and nd['type'] == 'corridor':
                d = math.hypot(dx - nd['x'], dy - nd['y'])
                if d < min_d:
                    min_d = d
                    closest_id = nid
        if closest_id:
            add_edge(d_id, closest_id, dist=round(min_d * 0.48, 1), etype='walk')

    # Kat Servis Noktaları (Amenities) - Üst üste binmeyecek şekilde mimari konumlarda
    amenities = []
    
    # Her kata standart WC (Kuzey ve Güney servis koridorlarında)
    amenities.append({
        'id': f"amenity_wc_n_{fl}",
        'name': f"Kuzey WC & Bebek Bakım ({fl}. Kat)",
        'kind': 'wc',
        'category': 'service',
        'floor': fl,
        'cx': 258.0,
        'cy': 95.0,
        'nav_node': f"n_wc_n_{fl}"
    })
    add_node(f"n_wc_n_{fl}", fl, 258.0, 95.0, 'amenity')
    add_edge(f"n_wc_n_{fl}", f"c_{fl}_n_2")

    amenities.append({
        'id': f"amenity_wc_s_{fl}",
        'name': f"Güney WC & Engelli ({fl}. Kat)",
        'kind': 'wc',
        'category': 'service',
        'floor': fl,
        'cx': 258.0,
        'cy': 645.0,
        'nav_node': f"n_wc_s_{fl}"
    })
    add_node(f"n_wc_s_{fl}", fl, 258.0, 645.0, 'amenity')
    add_edge(f"n_wc_s_{fl}", f"c_{fl}_s_2")

    if fl == 4: # Zemin Kat Özel Servisleri
        # Danışma Masası
        amenities.append({
            'id': 'amenity_info_4',
            'name': 'Ana Danışma & Misafir Hizmetleri',
            'kind': 'info',
            'category': 'service',
            'floor': 4,
            'cx': 258.0,
            'cy': 185.0,
            'nav_node': 'n_info_4'
        })
        add_node('n_info_4', 4, 258.0, 185.0, 'amenity')
        add_edge('n_info_4', 'c_4_n_2')

        # ATM Merkezi
        amenities.append({
            'id': 'amenity_atm_4',
            'name': 'ATM Noktası (Zemin Kat)',
            'kind': 'atm',
            'category': 'atm',
            'floor': 4,
            'cx': 185.0,
            'cy': 185.0,
            'nav_node': 'n_atm_4'
        })
        add_node('n_atm_4', 4, 185.0, 185.0, 'amenity')
        add_edge('n_atm_4', 'c_4_w_1')

        # Taksi Durağı (Dış Kapı Fişekhane)
        amenities.append({
            'id': 'amenity_taxi_4',
            'name': 'Capacity Taksi Durağı (Fişekhane Çıkışı)',
            'kind': 'taxi',
            'category': 'service',
            'floor': 4,
            'cx': 485.0,
            'cy': 440.0,
            'nav_node': 'n_taxi_4'
        })
        add_node('n_taxi_4', 4, 485.0, 440.0, 'amenity')
        add_edge('n_taxi_4', 'c_4_e_7')

        # Vale Noktası
        amenities.append({
            'id': 'amenity_valet_4',
            'name': 'Fişekhane Vale Teslim',
            'kind': 'valet',
            'category': 'service',
            'floor': 4,
            'cx': 485.0,
            'cy': 290.0,
            'nav_node': 'n_valet_4'
        })
        add_node('n_valet_4', 4, 485.0, 290.0, 'amenity')
        add_edge('n_valet_4', 'c_4_e_3')

    elif fl == 3: # B1 Katı Özel Servisleri
        amenities.append({
            'id': 'amenity_atm_3',
            'name': 'B1 Ortak ATM Alanı',
            'kind': 'atm',
            'category': 'atm',
            'floor': 3,
            'cx': 185.0,
            'cy': 185.0,
            'nav_node': 'n_atm_3'
        })
        add_node('n_atm_3', 3, 185.0, 185.0, 'amenity')
        add_edge('n_atm_3', 'c_3_w_1')

    elif fl == 2: # B2 Katı Otopark & Mescit
        amenities.append({
            'id': 'amenity_valet_2',
            'name': 'B2 Kapalı Otopark Vale',
            'kind': 'valet',
            'category': 'service',
            'floor': 2,
            'cx': 258.0,
            'cy': 490.0,
            'nav_node': 'n_valet_2'
        })
        add_node('n_valet_2', 2, 258.0, 490.0, 'amenity')
        add_edge('n_valet_2', 'bridge_2_s')

    elif fl == 1: # B3 Katı Mescit & Şarj
        amenities.append({
            'id': 'amenity_mescit_1',
            'name': 'Capacity Mescidi & Abdesthane',
            'kind': 'prayer',
            'category': 'service',
            'floor': 1,
            'cx': 258.0,
            'cy': 490.0,
            'nav_node': 'n_mescit_1'
        })
        add_node('n_mescit_1', 1, 258.0, 490.0, 'amenity')
        add_edge('n_mescit_1', 'bridge_1_s')

    # Portallar
    portals = [
        {'id': f"portal_esc_s_{fl}", 'type': 'escalator', 'x': 220.0, 'y': 520.0, 'floor': fl},
        {'id': f"portal_esc_n_{fl}", 'type': 'escalator', 'x': 258.0, 'y': 200.0, 'floor': fl},
        {'id': f"portal_elev_s_{fl}", 'type': 'elevator', 'x': 258.0, 'y': 535.0, 'floor': fl},
        {'id': f"portal_elev_n_{fl}", 'type': 'elevator', 'x': 210.0, 'y': 155.0, 'floor': fl}
    ]

    unified_floors[fl] = {
        'level': fl,
        'label': floor_meta[fl]['label'],
        'subtitle': floor_meta[fl]['subtitle'],
        'color': floor_meta[fl]['color'],
        'stores': store_objs,
        'amenities': amenities,
        'portals': portals,
        'rooms': rooms
    }

# Giriş Kapıları (Zemin Kat)
entrances_list = [
    {
        'id': 'ent_fisekhane',
        'name': 'Fişekhane Caddesi Ana Giriş (Cadde)',
        'kind': 'entrance',
        'floor': 4,
        'floor_name': 'Zemin Kat',
        'cx': 485.0,
        'cy': 365.0,
        'nav_node': 'n_ent_fisekhane'
    },
    {
        'id': 'ent_carousel',
        'name': 'Carousel Tarafı Batı Giriş (Meydan)',
        'kind': 'entrance',
        'floor': 4,
        'floor_name': 'Zemin Kat',
        'cx': 31.0,
        'cy': 365.0,
        'nav_node': 'n_ent_carousel'
    },
    {
        'id': 'ent_kuzey',
        'name': 'İstanbul Caddesi Kuzey Girişi',
        'kind': 'entrance',
        'floor': 4,
        'floor_name': 'Zemin Kat',
        'cx': 258.0,
        'cy': 52.0,
        'nav_node': 'n_ent_kuzey'
    },
    {
        'id': 'ent_carpark',
        'name': 'Kapalı Otopark & Vale Girişi (B2)',
        'kind': 'carpark',
        'floor': 2,
        'floor_name': '2. Bodrum (B2)',
        'cx': 258.0,
        'cy': 680.0,
        'nav_node': 'n_ent_carpark'
    }
]

# Girişleri grafa bağla
add_node('n_ent_fisekhane', 4, 485.0, 365.0, 'entrance')
add_edge('n_ent_fisekhane', 'c_4_e_5', dist=14.0)

add_node('n_ent_carousel', 4, 31.0, 365.0, 'entrance')
add_edge('n_ent_carousel', 'c_4_w_5', dist=14.0)

add_node('n_ent_kuzey', 4, 258.0, 52.0, 'entrance')
add_edge('n_ent_kuzey', 'c_4_n_2', dist=12.0)

add_node('n_ent_carpark', 2, 258.0, 680.0, 'entrance')
add_edge('n_ent_carpark', 'c_2_s_2', dist=12.0)

# SVG'leri Üret
os.makedirs('public/svg', exist_ok=True)

for fl in range(1, 7):
    f_data = unified_floors[fl]
    rooms = f_data['rooms']
    
    svg_content = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 516 735" width="100%" height="100%" class="map__svg">
  <defs>
    <filter id="slab-shadow" x="-5%" y="-5%" width="110%" height="110%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-opacity="0.08"/>
    </filter>
    <linearGradient id="fountainWaterGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.5"/>
      <stop offset="100%" stop-color="#0284c7" stop-opacity="0.35"/>
    </linearGradient>
    <linearGradient id="atriumVoidGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f8fafc" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="#f1f5f9" stop-opacity="0.95"/>
    </linearGradient>
  </defs>

  <!-- 1. TEMİZ BEYAZ MİMARİ KAT TABANI (SLAB) -->
  <g id="FloorSlab" class="map__slab">
    <!-- Dış Bina Duvarı (Kavisli Beyaz Mimari Döşeme) -->
    <path id="slab_outer_{fl}" class="slab corridor-path" d="M 120 45 C 200 35, 316 35, 396 45 C 475 55, 490 120, 488 200 L 488 535 C 490 620, 470 685, 396 695 C 316 705, 200 705, 120 695 C 45 685, 26 620, 28 535 L 28 200 C 26 120, 45 55, 120 45 Z" fill="#ffffff" stroke="#cbd5e1" stroke-width="2.5" />
    
    <!-- Batı Yürüyüş Promenadı -->
    <path class="corridor-lane" d="M 144 140 L 180 140 L 180 590 L 144 590 Z" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1" />
    <!-- Doğu Yürüyüş Promenadı -->
    <path class="corridor-lane" d="M 336 140 L 372 140 L 372 590 L 336 590 Z" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1" />
    <!-- Kuzey Bağlantı Koridoru -->
    <path class="corridor-lane" d="M 144 140 L 372 140 L 372 170 L 144 170 Z" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1" />
    <!-- Güney Bağlantı Koridoru -->
    <path class="corridor-lane" d="M 144 560 L 372 560 L 372 590 L 144 590 Z" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1" />

    <!-- Kuzey Skybridge -->
    <rect x="178" y="233" width="160" height="24" rx="8" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="1.2" />
    <!-- Orta Skybridge (Geçiş Köprüsü) -->
    <rect x="178" y="351" width="160" height="28" rx="8" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="1.2" />
    <!-- Güney Skybridge -->
    <rect x="178" y="473" width="160" height="24" rx="8" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="1.2" />
  </g>

  <!-- 2. MERKEZİ ATRIUM & MÜZİKLİ GÖSTERİ HAVUZU -->
  <g id="FloorVoids">
'''

    if fl in [5, 6]:
        # 1. ve 2. Kat: Zemin kattaki havuza bakan açık galeri boşluğu ve cam korkuluk
        svg_content += '''    <!-- Açık Galeri Boşluğu & Cam Korkuluk -->
    <ellipse cx="258" cy="365" rx="74" ry="145" fill="url(#atriumVoidGrad)" stroke="#38bdf8" stroke-width="1.8" stroke-dasharray="6 4" class="void-atrium" />
    <text x="258" y="365" text-anchor="middle" fill="#0284c7" font-size="11" font-weight="700" letter-spacing="1" opacity="0.85">ATRIUM GALERİ BOŞLUĞU</text>
'''
    elif fl == 4:
        # Zemin Kat: Capacity'nin İkonik Müzikli Gösteri Havuzu (Işıklı Su Gösterisi)
        svg_content += '''    <!-- Capacity İkonik Müzikli Gösteri Havuzu -->
    <ellipse cx="258" cy="365" rx="74" ry="138" fill="#e0f2fe" stroke="#0284c7" stroke-width="2.5" class="central-fountain" />
    <circle cx="258" cy="365" r="34" fill="#bae6fd" opacity="0.5" stroke="#0284c7" stroke-width="1.5" />
    <circle cx="258" cy="365" r="8" fill="#0284c7" />
    <!-- Su Dalgacık Halkaları -->
    <circle cx="258" cy="365" r="20" fill="none" stroke="#0284c7" stroke-width="1.2" stroke-dasharray="4 4" opacity="0.75" />
    <circle cx="258" cy="365" r="50" fill="none" stroke="#0ea5e9" stroke-width="1" stroke-dasharray="8 6" opacity="0.5" />
    <text x="258" y="325" text-anchor="middle" fill="#0369a1" font-size="11" font-weight="800" letter-spacing="0.5">MÜZİKLİ GÖSTERİ HAVUZU</text>
    <text x="258" y="415" text-anchor="middle" fill="#64748b" font-size="9.5" font-weight="600">ETKİNLİK ALANI</text>
'''
    elif fl == 3:
        # B1 Katı: Alt Atrium Meydanı
        svg_content += '''    <!-- B1 Alt Atrium Meydanı -->
    <ellipse cx="258" cy="365" rx="72" ry="135" fill="#f8fafc" stroke="#94a3b8" stroke-width="1.8" />
    <text x="258" y="365" text-anchor="middle" fill="#64748b" font-size="10.5" font-weight="700">ALT ATRIUM MEYDANI</text>
'''
    else:
        # B2 & B3 Katı: Otopark & Hizmet Alanları
        p_color = "#2563eb" if fl == 2 else "#d97706"
        p_label = "B2 OTOPARK (KIRMIZI / MAVİ SEKTÖR)" if fl == 2 else "B3 OTOPARK &amp; ELEKTRİKLİ ŞARJ"
        svg_content += f'''    <!-- Otopark Merkez Adası -->
    <rect x="195" y="240" width="126" height="250" rx="16" fill="#f8fafc" stroke="{p_color}" stroke-width="2" stroke-dasharray="8 6" opacity="0.85" />
    <text x="258" y="365" text-anchor="middle" fill="{p_color}" font-size="11" font-weight="800">{p_label}</text>
'''

    svg_content += '''  </g>

  <!-- 3. MİMARİ MAĞAZA ODALARI (PASTEL RENKLER) -->
  <g id="FloorRooms">
'''

    for rm in rooms:
        cat = rm['category']
        col = category_colors.get(cat, category_colors['fashion'])
        svg_content += f'''    <path id="{rm['id']}" class="room room--tenant g-{cat} cat-{cat} store-polygon" d="{rm['d']}" fill="{col['fill']}" stroke="{col['stroke']}" stroke-width="1.2" fillRule="evenodd" data-id="{rm['store_id']}" />\n'''

    svg_content += '''  </g>

  <!-- 4. SABİT DİKEY İKONLAR (Asansör, Yürüyen Merdiven, Girişler) -->
  <g id="FloorIcons" class="pointer-events-none">
    <!-- Güney Panoramik Cam Asansörler -->
    <g transform="translate(258, 535)" class="portal-svg portal-elevator" opacity="0.95">
      <rect x="-14" y="-12" width="28" height="24" rx="6" fill="#0284c7" stroke="#38bdf8" stroke-width="1.8"/>
      <path d="M-6 -4 L0 -10 L6 -4 M-6 4 L0 10 L6 4" stroke="#ffffff" stroke-width="2" fill="none" stroke-linecap="round"/>
    </g>

    <!-- Kuzey Servis Asansörü -->
    <g transform="translate(210, 155)" class="portal-svg portal-elevator" opacity="0.9">
      <rect x="-11" y="-10" width="22" height="20" rx="5" fill="#0284c7" stroke="#38bdf8" stroke-width="1.5"/>
      <text x="0" y="4" text-anchor="middle" fill="#ffffff" font-size="9" font-weight="900">AS</text>
    </g>

    <!-- Güney Yürüyen Merdivenler -->
    <g transform="translate(220, 520)" class="portal-svg portal-escalator" opacity="0.95">
      <rect x="-13" y="-11" width="26" height="22" rx="5" fill="#10b981" stroke="#34d399" stroke-width="1.5"/>
      <path d="M-7 4 L-2 4 L3 -4 L7 -4" stroke="#ffffff" stroke-width="2" fill="none" stroke-linecap="round"/>
    </g>

    <!-- Kuzey Yürüyen Merdivenler -->
    <g transform="translate(258, 200)" class="portal-svg portal-escalator" opacity="0.95">
      <rect x="-13" y="-11" width="26" height="22" rx="5" fill="#10b981" stroke="#34d399" stroke-width="1.5"/>
      <path d="M-7 -4 L-2 -4 L3 4 L7 4" stroke="#ffffff" stroke-width="2" fill="none" stroke-linecap="round"/>
    </g>
  </g>
</svg>
'''

    with open(f"public/svg/{fl}.svg", 'w', encoding='utf-8') as svg_f:
        svg_f.write(svg_content)

# Final JSON Dosyasını Kaydet
final_mall_data = {
    'meta': {
        'name': 'İstanbul Bakırköy Capacity AVM',
        'shortName': 'Capacity AVM',
        'address': 'Zeytinlik, Fişekhane Cd. No:7, 34158 Bakırköy/İstanbul',
        'width': 516,
        'height': 735,
        'mPerUnit': 0.48,
        'defaultFloor': 4
    },
    'floors': unified_floors,
    'amenities': [a for fl in unified_floors.values() for a in fl['amenities']],
    'entrances': entrances_list,
    'links': links_list,
    'graph': nav_graph
}

with open('public/mall_data.json', 'w', encoding='utf-8') as f_out:
    json.dump(final_mall_data, f_out, ensure_ascii=False, indent=2)

print("\n--- CAPACITY AVM ARCHITECTURAL BUILD COMPLETE ---")
print(f"Total stores placed: {all_stores_count}")
print(f"Total graph nodes: {len(nav_graph['nodes'])}")
print(f"Total graph edges: {sum(len(v) for v in nav_graph['adj'].values()) // 2}")
print("Generated SVGs: 1.svg, 2.svg, 3.svg, 4.svg, 5.svg, 6.svg")
print("Saved to public/mall_data.json successfully!")
