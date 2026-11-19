import json, re

with open(r'D:\watchvibe\web_live_build\catalog_extra.json', 'r', encoding='utf-8') as f:
    extra = json.load(f)
with open(r'D:\watchvibe\web_live_build\index.html', 'r', encoding='utf-8') as f:
    text = f.read()

m = re.search(r'mediaDatabase\s*=\s*(\[.*?\]);', text)
db = json.loads(m.group(1))

all_items = db + extra
bad_ids = [x['id'] for x in all_items if any(c in str(x['id']) for c in ["'", '"', '&', '<', '>', '\\', ' '])]
print('Total items with special characters in ID:', len(bad_ids))
if bad_ids:
    print('Sample bad IDs:', bad_ids[:10])
