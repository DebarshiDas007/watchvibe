path = r"D:\watchvibe\web_live_build\index.html"
with open(path, "r", encoding="utf-8") as f:
    text = f.read()

import re
matches = [m.start() for m in re.finditer(r'userWatchlistIds', text)]
print(f"Total occurrences of userWatchlistIds: {len(matches)}")
for m in matches:
    line = text[:m].count('\n') + 1
    snippet = text[max(0, m-30):min(len(text), m+70)].replace(chr(10), ' ')
    print(f"L{line}: {snippet}")
