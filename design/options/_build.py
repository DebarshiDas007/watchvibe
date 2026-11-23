"""Assemble the clickable demo: design/options/artifact/{index.html, option-N.html, data.js, app.js, img/...}"""
import io, json, os, re, shutil
D = r'D:\watchvibe\design\options'; S = D + r'\src'; OUT = D + r'\artifact'
man = json.load(open(OUT + r'\fonts\manifest.json'))
pages = io.open(S + r'\pages.css', encoding='utf-8').read()
def faces(families):
    out = []
    for k, v in man.items():
        if v['name'] in families:
            out.append("@font-face{font-family:'%s';font-style:%s;font-weight:%s;font-display:swap;src:url(data:font/woff2;base64,%s) format('woff2')}" % (v['name'], v['style'], v['weight'], v['b64']))
    return '\n'.join(out)
FONTS = {1: ['Gambetta', 'Satoshi'], 2: ['Clash Display', 'Satoshi'], 3: ['Cabinet Grotesk', 'Satoshi'], 4: ['General Sans'], 5: ['Switzer']}
for n in range(1, 6):
    t = io.open(S + f'\\option-{n}.html', encoding='utf-8').read()
    assert '/*FONTS*/' in t and '/*PAGES*/' in t, n
    t = t.replace('/*FONTS*/', faces(FONTS[n])).replace('/*PAGES*/', pages)
    i = t.index('</style>') + len('</style>')
    head, body = t[:i], t[i:]
    html = '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n' + head + '\n</head><body>' + body + '\n</body></html>\n'
    io.open(OUT + f'\\option-{n}.html', 'w', encoding='utf-8').write(html)
# data.js with local images
d = io.open(D + r'\data.js', encoding='utf-8').read()
a = "poster: (w = 342) => `https://image.tmdb.org/t/p/w${w}${p}`, back: (w = 1280) => `https://image.tmdb.org/t/p/w${w}${b}`"
assert a in d
d = d.replace(a, "poster: () => 'img/p/' + i + '.jpg', back: () => 'img/b/' + i + '.jpg'")
io.open(OUT + r'\data.js', 'w', encoding='utf-8').write(d)
shutil.copy(S + r'\app.js', OUT + r'\app.js')
shutil.copy(S + r'\index.html', OUT + r'\index.html')
print({f: os.path.getsize(OUT + '\\' + f) // 1024 for f in os.listdir(OUT) if f.endswith(('.html', '.js'))})
