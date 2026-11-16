path = r"C:\Users\USER\.gemini\antigravity\scratch\watchvibe\web_live_build\index.html"
with open(path, "r", encoding="utf-8") as f:
    code = f.read()

target = """    function sanitizeRealUserName(rawName, email) {
      if (rawName && typeof rawName === 'string') {
        const trimmed = rawName.trim();
        // If it's a real name without @ and without numbers like 1234
        if (trimmed.length > 1 && !trimmed.includes('@') && !/\\d{2,}/.test(trimmed)) {
          return trimmed;
        }
      }
      if (email && typeof email === 'string') {
        const handle = email.split('@')[0].toLowerCase();
        // Specific check for Debarshi Das
        if (handle.includes('dasdebarshi') || handle.includes('debarshidas') || handle.includes('debarshi')) {
          return 'Debarshi Das';
        }
        // Remove trailing numbers (e.g. alex1234 -> alex)
        const clean = handle.replace(/\\d+$/, '');
        const parts = clean.split(/[._-]+/).filter(Boolean);
        if (parts.length > 1) {
          return parts.map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ');
        } else if (clean.length > 1) {
          return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
        }
      }
      return 'Debarshi Das';
    }"""

replacement = """    function sanitizeRealUserName(rawName, email) {
      if (rawName && typeof rawName === 'string') {
        const trimmed = rawName.trim();
        if (trimmed.length > 1 && !trimmed.includes('@') && !/\\d{2,}/.test(trimmed)) {
          return trimmed;
        }
      }
      if (email && typeof email === 'string') {
        const handle = email.split('@')[0].toLowerCase();
        // Remove trailing numbers (e.g. alex1234 -> alex)
        const clean = handle.replace(/\\d+$/, '');
        const parts = clean.split(/[._-]+/).filter(Boolean);
        if (parts.length > 1) {
          return parts.map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ');
        } else if (clean.length > 0) {
          return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
        }
      }
      return 'Guest';
    }"""

assert target in code, "Target function not found!"
code = code.replace(target, replacement)

with open(path, "w", encoding="utf-8") as f:
    f.write(code)

print("sanitizeRealUserName successfully updated!")
