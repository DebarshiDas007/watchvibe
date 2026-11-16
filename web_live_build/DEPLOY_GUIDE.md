# WATCHVIBE — Live Production Deployment Guide ($0 Free Tier)

This directory (`web_live_build/`) contains the complete standalone production bundle for WATCHVIBE:
- `index.html` — Full responsive application (OTT Releases, Hyped Actors, TV Series Binge Hub, 4-Way Swipe Deck, Johnny Depp & Zendaya profiles with sequence sorting, Hans Zimmer soundtrack audio player).
- `manifest.json` — PWA manifest enabling native "Add to Home Screen" on iPhone and Android.
- `vercel.json` & `netlify.toml` — Preconfigured edge routing & security headers.

---

## ⚡ Option 1: Netlify Drop (Fastest — 10 Seconds, No CLI, $0)
1. Open [app.netlify.com/drop](https://app.netlify.com/drop) in your browser.
2. Drag and drop the folder:
   `C:\Users\USER\.gemini\antigravity\scratch\watchvibe\web_live_build`
   directly into the dotted box on screen.
3. In 5 seconds, Netlify generates a live, public, SSL-secured URL (e.g. `https://watchvibe-discovery.netlify.app`).
4. You can share this URL with anyone on mobile or PC.

---

## 🚀 Option 2: Vercel (Best for Incremental Continuous Deployment)
1. Push this folder to a GitHub repository (e.g. `github.com/your-username/watchvibe`).
2. Go to [vercel.com/new](https://vercel.com/new) and import the repository.
3. Set the Root Directory to `web_live_build`.
4. Click **Deploy**. Vercel will auto-deploy every commit we make in future sessions within 15 seconds.

---

## 🐙 Option 3: GitHub Pages (100% Free Forever)
1. Push the code to a GitHub repository.
2. In Repository Settings ➔ **Pages** ➔ Set Source to **Deploy from branch** (`main` / `/web_live_build`).
3. Your app is live at `https://<your-username>.github.io/watchvibe`.

---

## 💻 Local Live Preview (Running Now)
A local live server is actively running on port 8080:
- **Local URL:** `http://localhost:8080`
