path = r"D:\watchvibe\web_live_build\index.html"
with open(path, "r", encoding="utf-8") as f:
    text = f.read()

import re
matches = [m.start() for m in re.finditer(r'bookmark|watchlist', text, re.I)]
print(f"Total occurrences of bookmark/watchlist: {len(matches)}")
# Filter for onclick or buttons
for m in matches:
    snippet = text[max(0, m-40):min(len(text), m+60)].replace(chr(10), ' ')
    if 'onclick' in snippet or 'button' in snippet or 'href' in snippet:
        line = text[:m].count('\n') + 1
        print(f"L{line}: {snippet}")
