import os

path = r"C:\Users\USER\.gemini\antigravity\scratch\watchvibe\web_live_build\index.html"
with open(path, "r", encoding="utf-8") as f:
    html = f.read()

# 1. Replace the entire #authModal section
start_marker = '<!-- USER PROFILE & AUTHENTICATION MODAL'
end_marker = '<!-- SUPERADMIN COMMAND STUDIO MODAL'

start_idx = html.find(start_marker)
end_idx = html.find(end_marker)

assert start_idx != -1, "start_marker not found"
assert end_idx != -1, "end_marker not found"

from test_replacement import modal_replacement

new_html = html[:start_idx] + modal_replacement + "\n\n  " + html[end_idx:]

# 2. Update openAuthModal default header greeting for guest visitors
target_greeting = "if (headerTitle) headerTitle.innerText = `${timeGreeting}! Welcome to WatchVibe 🎬`;\n        if (headerSub) headerSub.innerText = 'Sync your watchlist and discover your cinema vibe';"
replacement_greeting = "if (headerTitle) headerTitle.innerText = 'Sign in or create an account';\n        if (headerSub) headerSub.innerText = 'Free to use. Sync your watchlist across all your devices with zero passwords.';"

if target_greeting in new_html:
    new_html = new_html.replace(target_greeting, replacement_greeting)
    print("Updated openAuthModal guest greeting successfully")
else:
    print("Notice: target_greeting not found in new_html, checking variant")

with open(path, "w", encoding="utf-8") as f:
    f.write(new_html)

print("index.html updated successfully!")
