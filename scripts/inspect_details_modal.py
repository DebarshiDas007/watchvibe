path = r"D:\watchvibe\web_live_build\index.html"
with open(path, "r", encoding="utf-8") as f:
    lines = f.readlines()

print("".join(lines[5500:5540]))
