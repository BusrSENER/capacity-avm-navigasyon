import json
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

def normalize_key(s):
    if not s: return ''
    s = (s.replace('İ', 'i').replace('I', 'i').replace('ı', 'i')
         .replace('Ğ', 'g').replace('ğ', 'g')
         .replace('Ü', 'u').replace('ü', 'u')
         .replace('Ş', 's').replace('ş', 's')
         .replace('Ö', 'o').replace('ö', 'o')
         .replace('Ç', 'c').replace('ç', 'c')
         .lower())
    return re.sub(r'[^a-z0-9]', '', s)

# Load BrandLogos keys from js/logos.js
with open('js/logos.js', 'r', encoding='utf-8') as f:
    logos_content = f.read()

# Extract keys in BrandLogos dictionary
# Keys are like: `  hotiç: ` or `  beymenclub: `
raw_keys = re.findall(r'^\s*([a-z0-9_]+)\s*:\s*`<svg', logos_content, re.MULTILINE)
logos = set(raw_keys)
print(f"Loaded {len(logos)} BrandLogos from js/logos.js: {sorted(list(logos))[:10]}...")

# Load stores from public/mall_data.json
with open('public/mall_data.json', 'r', encoding='utf-8') as f:
    mall_data = json.load(f)

all_stores = []
for floor_num, fl_data in mall_data.get('floors', {}).items():
    for st in fl_data.get('stores', []):
        all_stores.append((int(floor_num), st.get('id'), st.get('name', '')))

print(f"Total stores across floors: {len(all_stores)}")

def matches_logo(name):
    norm = normalize_key(name)
    if not norm: return False
    if norm in logos: return True
    for k in logos:
        if len(k) <= 3:
            if norm == k: return True
        else:
            if k in norm or (len(norm) >= 4 and norm in k):
                return True
    return False

missing = []
matched = []
for fl, sid, name in all_stores:
    if matches_logo(name):
        matched.append((fl, sid, name))
    else:
        missing.append((fl, sid, name))

print(f"\nMatched stores: {len(matched)}")
print(f"Missing stores without logos: {len(missing)}")
print("\nSample missing stores:")
for fl, sid, name in missing:
    print(f"  Floor {fl} [{sid}]: {name}")
