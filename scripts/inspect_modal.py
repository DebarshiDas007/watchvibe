import os

path = r"C:\Users\USER\.gemini\antigravity\scratch\watchvibe\web_live_build\index.html"
with open(path, "r", encoding="utf-8") as f:
    html = f.read()

start_marker = '<div id="authModal"'
start_idx = html.find(start_marker)

# Find where authModal ends - usually before next modal or main scripts
end_marker = '<!-- QUICK VIEW MODAL'
end_idx = html.find(end_marker, start_idx)
if end_idx == -1:
    end_marker = '<script'
    end_idx = html.find(end_marker, start_idx)

print(f"Start: {start_idx}, End: {end_idx}")
print(html[start_idx:start_idx+4000])
