path = r"D:\watchvibe\web_live_build\index.html"
with open(path, "r", encoding="utf-8") as f:
    text = f.read()

import re
matches = [m.start() for m in re.finditer(r'>\s*Remove\s*<', text, re.I)]
print(f"Total '>Remove<' occurrences: {len(matches)}")
for m in matches:
    line = text[:m].count('\n') + 1
    print(f"L{line}: {text[max(0, m-120):min(len(text), m+80)].replace(chr(10), ' ')}")
    print("-" * 50)
