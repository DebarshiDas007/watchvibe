import io, json, os, shutil
D = r'D:\watchvibe\design\options'; S = D + r'\src'; A5 = D + r'\artifact5'; A = D + r'\artifact'; OUT = D + r'\artifact6'
os.makedirs(OUT + r'\img', exist_ok=True)
man = json.load(open(A + r'\fonts\manifest.json'))
faces = '\n'.join("@font-face{font-family:'%s';font-style:%s;font-weight:%s;font-display:swap;src:url(data:font/woff2;base64,%s) format('woff2')}" % (v['name'], v['style'], v['weight'], v['b64']) for k, v in man.items() if v['name'] == 'Switzer')
rep = {'/*FONTS*/': faces, '/*BASE*/': io.open(S + r'\swiss-base.css', encoding='utf-8').read(), '/*PAGES*/': io.open(S + r'\pages.css', encoding='utf-8').read(), '/*WALL*/': io.open(S + r'\wall.css', encoding='utf-8').read()}
for n in range(1, 4):
    t = io.open(S + f'\\h{n}.html', encoding='utf-8').read()
    for k, v in rep.items():
        assert k in t, (n, k); t = t.replace(k, v)
    t = t.replace('wall-index.html', 'index.html')
    i = t.index('</style>') + len('</style>')
    html = '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n' + t[:i] + '\n</head><body>' + t[i:] + '\n</body></html>\n'
    io.open(OUT + f'\\h{n}.html', 'w', encoding='utf-8').write(html)
for f in ('app.js', 'swiss-ui.js', 'wall-ui.js'): shutil.copy(S + '\\' + f, OUT + '\\' + f)
shutil.copy(A + r'\data.js', OUT + r'\data.js')
for sub in ('p', 'b'):
    if not os.path.exists(OUT + f'\\img\\{sub}'): shutil.copytree(A + f'\\img\\{sub}', OUT + f'\\img\\{sub}')
os.makedirs(D + r'\publish6', exist_ok=True)
shutil.copy(S + r'\wall-picker.html', D + r'\publish6\index.html')
print({f: os.path.getsize(OUT + '\\' + f) // 1024 for f in os.listdir(OUT) if f.endswith(('.html', '.js'))})
