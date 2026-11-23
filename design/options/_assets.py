"""Download the demo's images and Fontshare fonts so the demo has no outside dependencies (the artifact page only allows its own files)."""
import re, os, io, json, base64, urllib.request, concurrent.futures as cf
D = r'D:\watchvibe\design\options'
OUT = D + r'\artifact'
os.makedirs(OUT + r'\img\p', exist_ok=True); os.makedirs(OUT + r'\img\b', exist_ok=True); os.makedirs(OUT + r'\fonts', exist_ok=True)
src = io.open(D + r'\data.js', encoding='utf-8').read()
rows = re.findall(r'\["((?:[^"\\]|\\.)*)",(\d+),([\d.]+),"(/[^"]+\.jpg)","(/[^"]+\.jpg)"', src)
print(len(rows), 'films')
def get(url, path, ua='Mozilla/5.0'):
    if os.path.exists(path) and os.path.getsize(path) > 1000: return True
    req = urllib.request.Request(url, headers={'User-Agent': ua})
    with urllib.request.urlopen(req, timeout=40) as r: data = r.read()
    open(path, 'wb').write(data); return True
jobs = []
for i, (_t, _y, _r, p, b) in enumerate(rows):
    jobs.append((f'https://image.tmdb.org/t/p/w342{p}', f'{OUT}\\img\\p\\{i}.jpg'))
    jobs.append((f'https://image.tmdb.org/t/p/w780{b}', f'{OUT}\\img\\b\\{i}.jpg'))
def run(j):
    try: return get(*j)
    except Exception as e: return str(e)
with cf.ThreadPoolExecutor(8) as ex: res = list(ex.map(run, jobs))
print('images ok', sum(1 for r in res if r is True), 'of', len(jobs), [r for r in res if r is not True][:3])
# fonts
fam = 'gambetta@400,500,600,400i&f[]=satoshi@400,500,700&f[]=clash-display@500,600,700&f[]=cabinet-grotesk@500,700,800&f[]=general-sans@400,500,600&f[]=switzer@400,500,600,700'
css = urllib.request.urlopen(urllib.request.Request('https://api.fontshare.com/v2/css?f[]=' + fam + '&display=swap', headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120 Safari/537.36'}), timeout=40).read().decode('utf-8')
open(OUT + r'\fonts\fontshare.css', 'w', encoding='utf-8').write(css)
blocks = re.findall(r'@font-face\s*\{.*?\}', css, re.S)
print(len(blocks), 'font faces')
manifest = {}
for b in blocks:
    name = re.search(r"font-family:\s*['\"]?([^;'\"]+)", b).group(1).strip()
    weight = re.search(r'font-weight:\s*([^;]+);', b).group(1).strip()
    style = (re.search(r'font-style:\s*([^;]+);', b) or [None, 'normal'])[1].strip() if re.search(r'font-style:\s*([^;]+);', b) else 'normal'
    url = re.findall(r'url\(["\']?([^)"\']+\.woff2[^)"\']*)', b)
    if not url: continue
    u = url[0]; u = 'https:' + u if u.startswith('//') else u
    key = f'{name}|{weight}|{style}'
    try:
        data = urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': 'Mozilla/5.0'}), timeout=40).read()
        manifest[key] = {'name': name, 'weight': weight, 'style': style, 'b64': base64.b64encode(data).decode(), 'kb': len(data) // 1024}
    except Exception as e:
        print('font fail', key, e)
json.dump(manifest, open(OUT + r'\fonts\manifest.json', 'w'))
print({k: v['kb'] for k, v in manifest.items()})
