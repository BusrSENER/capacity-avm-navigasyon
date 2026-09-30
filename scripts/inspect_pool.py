import json

with open('public/mall_data.json', 'r', encoding='utf-8') as f:
    d = json.load(f)

print("--- STORES ON FLOOR 4 NEAR POOL (550 <= cx <= 850) ---")
for s in d['floors']['4']['stores']:
    if 550 <= s.get('cx', 0) <= 850:
        print(f"{s['id']}: {s['name']}, cx={s['cx']}, cy={s['cy']}, nav_node={s.get('nav_node')}")

print("\n--- NODES ON FLOOR 4 (550 <= x <= 850) ---")
for nid, nd in d['graph']['nodes'].items():
    if nd.get('floor') == 4 and 550 <= nd.get('x', 0) <= 850:
        print(f"{nid}: x={nd['x']}, y={nd['y']}, kind={nd.get('kind')}")
