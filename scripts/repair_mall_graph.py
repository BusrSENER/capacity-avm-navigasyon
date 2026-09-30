import json
import math
import os

DATA_FILE = os.path.join(os.path.dirname(__file__), '..', 'public', 'mall_data.json')

def dist(p1, p2):
    return round(math.sqrt((p1['x'] - p2['x'])**2 + (p1['y'] - p2['y'])**2), 1)

def repair_graph():
    print(f"Loading {DATA_FILE}...")
    with open(DATA_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)

    nodes = data['graph']['nodes']
    adj = data['graph']['adj']
    edges = data['graph']['edges']

    # 1. Havuzun ortasından geçen doğrudan bağlantıları (edge) sil
    # c_4_m_600 <-> c_4_m_700 ve c_4_m_700 <-> c_4_m_800
    forbidden_pairs = [
        ('c_4_m_600', 'c_4_m_700'),
        ('c_4_m_700', 'c_4_m_600'),
        ('c_4_m_700', 'c_4_m_800'),
        ('c_4_m_800', 'c_4_m_700'),
    ]

    initial_edge_count = len(edges)
    edges = [
        e for e in edges 
        if not (
            (e.get('from'), e.get('to')) in forbidden_pairs or 
            (e.get('to'), e.get('from')) in forbidden_pairs
        )
    ]
    print(f"Removed direct pool-crossing edges. Edges count: {initial_edge_count} -> {len(edges)}")

    # Adj listesinden de doğrudan havuz geçişlerini temizle
    for u, v in forbidden_pairs:
        if u in adj:
            adj[u] = [e for e in adj[u] if e.get('to') != v]

    # 2. Havuzun etrafından dolanan üst (dar) ve alt (geniş) koridorlar için yeni görünmez ara düğümler (waypoints) ekle
    new_waypoints = {
        'c_4_wp_pool_n1': {'id': 'c_4_wp_pool_n1', 'floor': 4, 'x': 625, 'y': 365, 'kind': 'waypoint'},
        'c_4_wp_pool_n2': {'id': 'c_4_wp_pool_n2', 'floor': 4, 'x': 700, 'y': 360, 'kind': 'waypoint'},
        'c_4_wp_pool_n3': {'id': 'c_4_wp_pool_n3', 'floor': 4, 'x': 775, 'y': 365, 'kind': 'waypoint'},
        'c_4_wp_pool_s1': {'id': 'c_4_wp_pool_s1', 'floor': 4, 'x': 625, 'y': 520, 'kind': 'waypoint'},
        'c_4_wp_pool_s2': {'id': 'c_4_wp_pool_s2', 'floor': 4, 'x': 700, 'y': 525, 'kind': 'waypoint'},
        'c_4_wp_pool_s3': {'id': 'c_4_wp_pool_s3', 'floor': 4, 'x': 775, 'y': 520, 'kind': 'waypoint'}
    }

    for nid, ndata in new_waypoints.items():
        nodes[nid] = ndata
        if nid not in adj:
            adj[nid] = []

    print(f"Added {len(new_waypoints)} waypoint nodes around Müzikli Havuz.")

    # 3. Yeni bağlantıları tanımla (Üst yol: narrow, Alt yol: main)
    new_connections = [
        # Üst yol (dar koridor - narrow)
        ('c_4_m_600', 'c_4_wp_pool_n1', 'narrow'),
        ('c_4_wp_pool_n1', 'c_4_wp_pool_n2', 'narrow'),
        ('c_4_wp_pool_n2', 'c_4_wp_pool_n3', 'narrow'),
        ('c_4_wp_pool_n3', 'c_4_m_800', 'narrow'),
        ('c_4_wp_pool_n1', 'c_4_n_680', 'narrow'),
        ('c_4_wp_pool_n3', 'c_4_n_750', 'narrow'),
        ('c_4_m_700', 'c_4_wp_pool_n2', 'narrow'),

        # Alt yol (geniş koridor - main)
        ('c_4_m_600', 'c_4_wp_pool_s1', 'main'),
        ('c_4_wp_pool_s1', 'c_4_wp_pool_s2', 'main'),
        ('c_4_wp_pool_s2', 'c_4_wp_pool_s3', 'main'),
        ('c_4_wp_pool_s3', 'c_4_m_800', 'main'),
        ('c_4_wp_pool_s1', 'c_4_s_680', 'main'),
        ('c_4_wp_pool_s3', 'c_4_s_750', 'main'),
        ('c_4_m_700', 'c_4_wp_pool_s2', 'main'),
    ]

    for u, v, road_type in new_connections:
        p_u = nodes[u]
        p_v = nodes[v]
        d = dist(p_u, p_v)

        # edges listesine ekle
        edges.append({
            'from': u,
            'to': v,
            'type': road_type,
            'portalKind': None,
            'dist': d
        })

        # adj listelerine çift yönlü ekle
        adj.setdefault(u, [])
        adj.setdefault(v, [])

        # Mevcut varsa temizle
        adj[u] = [e for e in adj[u] if e.get('to') != v]
        adj[v] = [e for e in adj[v] if e.get('to') != u]

        adj[u].append({'to': v, 'dist': d, 'type': road_type, 'portalKind': None})
        adj[v].append({'to': u, 'dist': d, 'type': road_type, 'portalKind': None})

    print(f"Added {len(new_connections)} bidirectional connections.")

    # 4. Tüm yollara varsayılan olarak "type": "main" ekle (yürüyen merdiven/asansör olmayanlar)
    portal_types = {'escalator', 'elevator', 'stairs'}

    main_labeled = 0
    narrow_labeled = 0

    for e in edges:
        t = e.get('type')
        if t in portal_types:
            continue
        if t == 'narrow':
            narrow_labeled += 1
        else:
            e['type'] = 'main'
            main_labeled += 1

    for u, neighbors in adj.items():
        for edge in neighbors:
            t = edge.get('type')
            if t in portal_types:
                continue
            if t != 'narrow':
                edge['type'] = 'main'

    print(f"Edge tagging complete: {main_labeled} main edges, {narrow_labeled} narrow edges.")

    # Güncellenen verileri kaydet
    data['graph']['nodes'] = nodes
    data['graph']['adj'] = adj
    data['graph']['edges'] = edges

    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"Successfully saved repaired graph to {DATA_FILE}")

if __name__ == '__main__':
    repair_graph()
