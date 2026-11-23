import re, os, json, base64, urllib.request
OUT = r'D:\watchvibe\design\options\artifact\fonts'
UA = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120 Safari/537.36'}
fams = ['gambetta@400,500,600,400i', 'satoshi@400,500,700', 'clash-display@500,600,700', 'cabinet-grotesk@500,700,800', 'general-sans@400,500,600', 'switzer@400,500,600,700']
manifest = {}
for f in fams:
    url = 'https://api.fontshare.com/v2/css?f[]=' + f + '&display=swap'
    try:
        css = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40).read().decode('utf-8')
    except Exception as e:
        print('css fail', f, e); continue
    blocks = re.findall(r'@font-face\s*\{.*?\}', css, re.S)
    print(f, len(blocks), 'faces')
    for b in blocks:
        name = re.search(r"font-family:\s*['\"]?([^;'\"]+)", b).group(1).strip()
        wm = re.search(r'font-weight:\s*([^;]+);', b); weight = wm.group(1).strip() if wm else '400'
        sm = re.search(r'font-style:\s*([^;]+);', b); style = sm.group(1).strip() if sm else 'normal'
        um = re.findall(r"url\(['\"]?([^)'\"]+\.woff2[^)'\"]*)", b)
        if not um: continue
        u = um[0]; u = 'https:' + u if u.startswith('//') else u
        key = f'{name}|{weight}|{style}'
        if key in manifest: continue
        data = urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=40).read()
        manifest[key] = {'name': name, 'weight': weight, 'style': style, 'b64': base64.b64encode(data).decode(), 'kb': len(data) // 1024}
json.dump(manifest, open(OUT + r'\manifest.json', 'w'))
print({k: v['kb'] for k, v in manifest.items()})
