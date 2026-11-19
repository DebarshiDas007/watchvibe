path = r"D:\watchvibe\web_live_build\index.html"
with open(path, "r", encoding="utf-8") as f:
    text = f.read()

import re
matches = [m.start() for m in re.finditer(r'syncUserDataToSupabaseCloud|loadUserWatchlistStore', text)]
for m in matches:
    print(text[m:m+1500])
    print("="*60)
