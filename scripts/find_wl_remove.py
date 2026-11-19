import re

path = r"D:\watchvibe\web_live_build\index.html"
with open(path, "r", encoding="utf-8") as f:
    text = f.read()

keywords = ["remove", "watchlist", "userWatchlistIds", "saveWatchlistStore", "toggleWatchlist"]
# Find functions that deal with removing from watchlist
patterns = [
    r'function\s+\w*watchlist\w*\(',
    r'function\s+\w*remove\w*\(',
    r'onclick="[^"]*watchlist[^"]*"',
    r'onclick="[^"]*remove[^"]*"',
    r'userWatchlistIds\s*='
]

for pat in patterns:
    print(f"=== Pattern: {pat} ===")
    for m in re.finditer(pat, text, re.I):
        line = text[:m.start()].count('\n') + 1
        snippet = text[max(0, m.start()-20):min(len(text), m.end()+100)].replace('\n', ' ')
        print(f"L{line}: {snippet}")
