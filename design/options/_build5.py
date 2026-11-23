import io, json, os, shutil
D = r'D:\watchvibe\design\options'; S = D + r'\src'; A = D + r'\artifact'; OUT = D + r'\artifact5'
os.makedirs(OUT + r'\img', exist_ok=True)
man = json.load(open(A + r'\fonts\manifest.json'))
faces = '\n'.join("@font-face{font-family:'%s';font-style:%s;font-weight:%s;font-display:swap;src:url(data:font/woff2;base64,%s) format('woff2')}" % (v['name'], v['style'], v['weight'], v['b64']) for k, v in man.items() if v['name'] == 'Switzer')
base = io.open(S + r'\swiss-base.css', encoding='utf-8').read()
pages = io.open(S + r'\pages.css', encoding='utf-8').read()
for n in range(1, 7):
    t = io.open(S + f'\\s{n}.html', encoding='utf-8').read()
    for tag in ('/*FONTS*/', '/*BASE*/', '/*PAGES*/'): assert tag in t, (n, tag)
    t = t.replace('/*FONTS*/', faces).replace('/*BASE*/', base).replace('/*PAGES*/', pages)
    i = t.index('</style>') + len('</style>')
    html = '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n' + t[:i] + '\n</head><body>' + t[i:] + '\n</body></html>\n'
    io.open(OUT + f'\\v{n}.html', 'w', encoding='utf-8').write(html)
for f in ('app.js', 'swiss-ui.js'): shutil.copy(S + '\\' + f, OUT + '\\' + f)
shutil.copy(A + r'\data.js', OUT + r'\data.js')
for sub in ('p', 'b'):
    if not os.path.exists(OUT + f'\\img\\{sub}'): shutil.copytree(A + f'\\img\\{sub}', OUT + f'\\img\\{sub}')
print({f: os.path.getsize(OUT + '\\' + f) // 1024 for f in os.listdir(OUT) if f.endswith(('.html', '.js'))})
