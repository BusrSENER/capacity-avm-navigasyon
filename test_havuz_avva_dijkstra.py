import json
import heapq

with open('public/mall_data.json', encoding='utf-8') as f:
    data = json.load(f)

nodes = data['graph']['nodes']
adj = data['graph']['adj']
mPerUnit = data.get('meta', {}).get('mPerUnit', 0.28)

def dijkstra(start, target, mode='escalator'):
    dist = {start: 0}
    prev = {}
    pq = [(0, start)]
    allowed = ['stairs', 'escalator'] if mode == 'escalator' else (['elevator'] if mode == 'elevator' else ['stairs', 'escalator', 'elevator'])
    
    while pq:
        d, u = heapq.heappop(pq)
        if u == target:
            path = []
            curr = u
            while curr:
                path.append(curr)
                curr = prev.get(curr, (None, None))[0]
            path.reverse()
            return d, path
        if d > dist[u]:
            continue
        for edge in adj.get(u, []):
            v = edge['to']
            etype = edge.get('type', 'walk')
            if etype != 'walk' and etype not in allowed:
                continue
            alt = d + edge['dist']
            if v not in dist or alt < dist[v]:
                dist[v] = alt
                prev[v] = (u, edge)
                heapq.heappush(pq, (alt, v))
    return None, None

print("=== 1. TEST: Havuz (c_4_m_700) -> Avva (n_4_door_2) ===")
dist, path = dijkstra('c_4_m_700', 'n_4_door_2')
if dist is not None:
    meters = round(dist * mPerUnit)
    print(f"BAŞARILI: Mesafe = {dist} birim ({meters} m)")
    print(f"Yol ({len(path)} düğüm): {' -> '.join(path)}")
else:
    print("HATA: Rota bulunamadı!")

print("\n=== 2. TEST: Avva (n_4_door_2) -> Havuz (c_4_m_700) ===")
dist2, path2 = dijkstra('n_4_door_2', 'c_4_m_700')
if dist2 is not None:
    meters2 = round(dist2 * mPerUnit)
    print(f"BAŞARILI: Mesafe = {dist2} birim ({meters2} m)")
    print(f"Yol ({len(path2)} düğüm): {' -> '.join(path2)}")
else:
    print("HATA: Rota bulunamadı!")
