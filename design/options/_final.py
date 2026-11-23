import io, os, re
D = r'D:\watchvibe\design\options'; S = D + r'\src'
# 1. the Back link must not use a javascript: URL (artifact pages block them)
p = S + r'\app.js'
t = io.open(p, encoding='utf-8').read()
a = '<a class="pg-back" href="javascript:history.back()">← Back</a>'
assert a in t
t = t.replace(a, '<a class="pg-back" href="#home" data-back>← Back</a>')
a2 = "const t = e.target.closest('[data-add],"
assert a2 in t
t = t.replace(a2, "const t = e.target.closest('[data-back],[data-add],")
a3 = "if (t.dataset.add != null) {"
assert a3 in t
t = t.replace(a3, "if (t.hasAttribute('data-back')) { e.preventDefault(); if (history.length > 1) history.back(); else location.hash = 'home'; }\n    else if (t.dataset.add != null) {", 1)
io.open(p, 'w', encoding='utf-8').write(t)
# 2. keep the "All designs" button clear of the phone tab bar
p = S + r'\pages.css'
c = io.open(p, encoding='utf-8').read()
if '.back-all{bottom:88px' not in c:
    c += '\n@media (max-width:900px){.back-all{bottom:92px!important}}\n'
io.open(p, 'w', encoding='utf-8').write(c)
print('ok')
