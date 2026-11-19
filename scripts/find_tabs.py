path = r"D:\watchvibe\web_live_build\index.html"
with open(path, "r", encoding="utf-8") as f:
    text = f.read()

import re
print("Occurrences of activeTab:", len(re.findall(r'\bactiveTab\b', text)))
for m in re.finditer(r'\bactiveTab\b', text):
    line = text[:m.start()].count('\n') + 1
    print(f"L{line}: {text[max(0, m.start()-40):min(len(text), m.end()+60)].replace(chr(10), ' ')}")

print("\nOccurrences of currentTab:", len(re.findall(r'\bcurrentTab\b', text)))
for m in re.finditer(r'\bcurrentTab\b', text):
    line = text[:m.start()].count('\n') + 1
    print(f"L{line}: {text[max(0, m.start()-40):min(len(text), m.end()+60)].replace(chr(10), ' ')}")
