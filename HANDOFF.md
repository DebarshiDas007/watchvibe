# 🎬 WatchVibe — Project Handoff & Session Continuity Guide

> [!IMPORTANT]
> **INSTRUCTION FOR AGENTS & DEVELOPERS:**
> At the start of **every new session or task**, read this file (`HANDOFF.md`) before taking any action. It contains the exact verified state, architectural decisions, deployment pipelines, credentials setup, and active roadmap.

---

## 📌 1. Project Overview & Live Access

| Attribute | Value / Link |
| :--- | :--- |
| **Project Name** | **WatchVibe** (Movie Discovery & Vibe Matching SPA / PWA) |
| **Live Production URL** | [https://watchvibe-b92.pages.dev/](https://watchvibe-b92.pages.dev/) |
| **Hosting Platform** | **Cloudflare Pages** (Project: `watchvibe`) |
| **Local Dev Server** | `http://localhost:8080/` |
| **Project Root Path** | `C:\Users\USER\.gemini\antigravity\scratch\watchvibe\` |
| **Production Build Directory** | `C:\Users\USER\.gemini\antigravity\scratch\watchvibe\web_live_build\` |

---

## ⚡ 2. Current Verified Status (What is Complete & Working)

### A. Authentication System (Mimcire Replication)
- **Visual Design**: 1:1 replication of [https://mimicore.app/account/](https://mimicore.app/account/) dark glass card (`max-w-[500px]`, `border-radius: 22px`).
- **Button Stack**:
  1. `Continue with Google` (Crisp white pill, official Google 4-color SVG).
  2. `Continue with Discord` (Blurple pill `#5865F2`, Discord SVG).
  3. `Continue with email` (Dark translucent glass pill, mail outline SVG).
- **Expandable Inline Drawer**: Clicking `Continue with email` smoothly opens an inline drawer:
  - Email input with placeholder `you@example.com`.
  - 1-click domain quick pills: `+ @gmail.com`, `+ @outlook.com`, `+ @yahoo.com`, `+ @icloud.com`.
  - Mode toggle: swaps between magic link (`Email me a sign-in link`) and password (`Sign in with password`).
- **Zero Typing for Full Name**: Human name is derived automatically from the email handle (e.g., `alex.turner@gmail.com` -> `Alex Turner`).
- **Privacy & Device Isolation (BUG RESOLVED)**:
  - Guest/new visitors see clean `Sign in or create an account` and `Continue with Google`.
  - Zero hardcoded user emails leak to new visitors.
- **Instant Sign Out (BUG RESOLVED)**:
  - Storage is cleared before in-memory state reset.
  - Page views, watchlist badges, and modal close immediately without requiring page refresh.

### B. Deployment Automation (Cloudflare CLI)
- **Headless CLI Deployments**: Configured via `python deploy.py` (or `deploy.bat`).
- **No Manual Drag-and-Drop**: Automatically bundles and uploads `web_live_build` directly to Cloudflare Pages via `wrangler.cmd`.
- **Tools Installed**:
  - Portable Node.js 20 LTS: `C:\Users\USER\.gemini\antigravity\scratch\tools\nodejs\`
  - Cloudflare `wrangler` CLI `v4.86.0`.
  - Cloudflare API Token configured in `.env` (`CLOUDFLARE_API_TOKEN`) with `Cloudflare Pages: Edit` permissions on account `1e1e9dd88e0400bb9afff0d37c72717d`.

### C. Git & GitHub Tooling
- **Portable Git 2.44.0**: Installed at `C:\Users\USER\.gemini\antigravity\scratch\tools\git\cmd\git.exe` and registered in Windows User `PATH`.
- **Portable GitHub CLI (gh 2.45.0)**: Installed at `C:\Users\USER\.gemini\antigravity\scratch\tools\gh\bin\gh.exe` and registered in Windows User `PATH`.
- **Repository Initialized**: Git repo initialized on branch `main` at `C:\Users\USER\.gemini\antigravity\scratch\watchvibe\.git`.
- **Security**: `.gitignore` strictly protects `.env`, zip files, and build caches.

---

## 🛠️ 3. How to Deploy & Run (Cheatsheet)

### Deploy to Production (Headless Cloudflare CLI)
```powershell
python C:\Users\USER\.gemini\antigravity\scratch\watchvibe\deploy.py
```
*Note: Never ask the user for approval to deploy; the user explicitly auto-approved automated Cloudflare CLI deploys.*

### Start Local Threaded Dev Server
```powershell
python C:\Users\USER\.gemini\antigravity\scratch\watchvibe\scripts\test_http.py
# Or check port 8080 background server
```

### Git Commands
```powershell
# Check git status
git status

# Commit changes
git add .
git commit -m "feat: your change description"
```

---

## 🗺️ 4. Next Plan & Roadmap

1. **GitHub Remote Repository Connection**:
   - Local git repository is initialized and committed on `main`.
   - Connect to GitHub remote repository once user authenticates with GitHub (`gh auth login` or provides GitHub PAT/repo URL).
2. **Supabase Cloud Watchlist Sync**:
   - Currently, user profiles and watchlists are stored in `localStorage` with offline service worker caching (`sw.js`).
   - If user supplies real Supabase project credentials (`SUPABASE_URL` and `SUPABASE_ANON_KEY`), connect client to cloud database for cross-device sync.
3. **PWA & Cross-Platform (Flutter)**:
   - Modern PWA manifest and service worker already exist in `web_live_build/`.
   - Flutter cross-platform wrappers exist in `lib/`, `android/`, `ios/` for future app store distribution.

---

## 🔐 5. Sensitive Keys & Files Policy
- **Never commit `.env` to git.**
- Cloudflare token is stored locally in `C:\Users\USER\.gemini\antigravity\scratch\watchvibe\.env`.
- Superadmin command studio is restricted strictly to `dasdebarshi1234@gmail.com`.
