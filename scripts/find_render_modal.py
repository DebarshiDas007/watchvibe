path = r"D:\watchvibe\web_live_build\index.html"
with open(path, "r", encoding="utf-8") as f:
    text = f.read()

import re
matches = [m.start() for m in re.finditer(r'renderMovieDetailsModal', text)]
print(f"Total renderMovieDetailsModal: {len(matches)}")
for m in matches:
    line = text[:m].count('\n') + 1
    print(f"L{line}: {text[max(0, m-40):min(len(text), m+100)].replace(chr(10), ' ')}")
