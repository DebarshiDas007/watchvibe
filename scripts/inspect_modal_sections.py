with open(r'C:\Users\USER\.gemini\antigravity\scratch\watchvibe\web_live_build\index.html', 'r', encoding='utf-8') as f:
    html = f.read()

import re
ids_to_check = ['authEmailInput', 'authNameInput', 'authSubmitBtn', 'googleSignInBtn', 'googleSignInLabel', 'emailToggleBtn', 'mimicoreEmailBox', 'mimicorePasswordField']

for el_id in ids_to_check:
    matches = [m.start() for m in re.finditer(re.escape(el_id), html)]
    print(f"ID '{el_id}': {len(matches)} occurrences")
    for m in matches:
        # print snippet around it
        start = max(0, m - 40)
        end = min(len(html), m + 60)
        print("  ->", html[start:end].replace('\n', ' '))
