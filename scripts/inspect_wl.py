path = r"D:\watchvibe\web_live_build\index.html"
with open(path, "r", encoding="utf-8") as f:
    lines = f.readlines()

print("=== LINES 3160-3240 ===")
print("".join(lines[3160:3240]))

print("=== LINES 6130-6200 ===")
print("".join(lines[6130:6200]))
