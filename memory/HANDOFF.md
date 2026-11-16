# WATCHVIBE — Project Memory & Session Handoff Document
> **CRITICAL DIRECTIVE FOR ALL FUTURE SESSIONS:**  
> When starting or resuming work on WATCHVIBE, **READ THIS FILE FIRST**.  
> **RULE #1:** Under NO circumstances should any paid tool, API, or service tier be introduced. Everything MUST remain strictly within **100% Free / Generous Free Tier** allowances.

---

## 1. Project Overview & Core Identity
* **App Name:** **WATCHVIBE**
* **Tagline:** *"Don't just rate it. Tell us the vibe."*
* **Core Concept:** A social entertainment discovery platform targeting **Android, iOS, macOS, and Windows** (with Web preview) where users classify the emotional experience of watching a title using multi-select **Vibe Categories** rather than just a traditional 1–10 number.

---

## 2. The Strict $0 Cost / Free-Tier Stack
All architectural decisions and service integrations use verified free tools:

| Domain | Free Service / Tool | Tier Allowance / Details |
| :--- | :--- | :--- |
| **Frontend Framework** | **Flutter SDK (Dart)** & **Vanilla PWA** | Open source, multiplatform native compilation for Android, iOS, Windows, macOS, Web. |
| **Backend & Database** | **Supabase Free Tier** | 500 MB PostgreSQL, 50,000 MAU Auth, Realtime WebSocket feeds, Edge Functions.<br>• **Project ID:** `lbtuikgpgcgrizijfiyl`<br>• **URL:** `https://lbtuikgpgcgrizijfiyl.supabase.co`<br>• **Tables:** `profiles`, `user_watchlists`, `vibe_ratings`, `battle_votes`<br>• **Test User:** `vibe_tester@watchvibe.app` / `WatchVibe2026!` (Verified Live) |
| **Movie & TV Metadata** | **TMDB API** | Free unlimited non-commercial API: plots, high-res posters/backdrops, release dates, genres. |
| **Streaming Availability** | **JustWatch (via TMDB API)** | Free global streaming data: Netflix, Prime, Disney+, JioCinema, Hotstar, SonyLIV, ZEE5 across 50+ countries. |
| **Soundtrack Audio Previews**| **Apple / iTunes Search API** | **100% Free with zero API keys or authentication needed**. 30-second `.m4a` music previews & album art. |
| **Actor & Box Office Data** | **TMDB + Wikidata SPARQL** | 100% Free public domain API for cumulative box office totals & filmography credits. |
| **Web Hosting** | **Netlify Drop / Vercel** | Free static & PWA deployment. |
| **Edge & CDN** | **Cloudflare Free Plan** | Global DNS, DDoS protection, free SSL. |

---

## 3. The 7 Signature Vibe Categories
Users can select **one or multiple** vibes for a single movie or show. The app calculates the exact percentage of the audience that tagged each vibe:

$$\text{Vibe Percentage} = \left( \frac{\text{Votes for this Vibe}}{\text{Total Voters}} \right) \times 100$$

| Vibe | Color | Icon | Definition |
| :--- | :--- | :--- | :--- |
| **Must Watch** | `#22C55E` (Emerald Green) | 👑 Verified | Top pick • Exceptional storytelling & unforgettable impact. |
| **Mind Blown** | `#A855F7` (Vivid Purple) | 💥 Sparkle | Unexpected twists, brilliant concepts & mind-bending storytelling. |
| **Emotional Damage** | `#F43F5E` (Rose Pink) | ❤️ Heart | Stories that make you cry, think or feel something deeply. |
| **Hidden Gem** | `#F59E0B` (Amber Gold) | 💎 Diamond | Underrated titles that deserve way more attention. |
| **Fun Time** | `#06B6D4` (Cyan) | 😄 Smile | Entertaining, funny, exciting. Perfect for a good time. |
| **Time Pass** | `#FB923C` (Orange) | ⏳ Hourglass | Good enough to watch when bored, nothing extraordinary. |
| **Skip It** | `#EF4444` (Crimson Red) | 🚫 Block | Not worth your time. Better things to watch. |

---

## 4. Implemented Features & Capabilities

1. **Automatic Country & Streaming Platform Auto-Detection (Option C):**
   * Multi-stage zero-cost geolocation:
     * 1. Inspects client timezone (`Intl.DateTimeFormat().resolvedOptions().timeZone`), resolving `Asia/Kolkata` -> `IN`, `Europe/London` -> `GB`, `America/New_York` -> `US`, `America/Toronto` -> `CA`, `Australia/Sydney` -> `AU`.
     * 2. Inspects `navigator.languages` (e.g. `en-IN`, `hi`, `te`, `ta`, `ml`, `kn` -> `IN`).
     * 3. Performs an asynchronous Cloudflare edge trace (`/cdn-cgi/trace`) for zero-auth network refinement.
     * 4. Synchronizes header dropdown and updates all local OTT availability chips (*JioCinema, Disney+ Hotstar, SonyLIV, Prime Video, Netflix*).
2. **Universal Live Search Engine (Actors + Movies + Web Series + Vibes):**
   * Instant debounced search querying TMDB Person API, TMDB Multi-Search, and local indexed catalog.
   * Actor matches dynamically indexed and rendered with verified high-res portraits and filmography buttons.
3. **Dynamic Live Actor Personal Profile Sheet:**
   * Fully asynchronous: Clicking any actor (including dynamic TMDB search results such as Satyajit Ray, Rajinikanth, Christopher Nolan) fetches `/person/{id}` and `/person/{id}/movie_credits` live from TMDB.
   * Displays that specific artist's real portrait, real biography, real birthday/birthplace, career productions, and their actual filmography (cast + directing/writing credits) with real posters.
   * Tailored neutral avatar silhouettes (`getActorPlaceholder(name)`) prevent fallback image confusion.
4. **Real High-Resolution TMDB Actor Portraits:**
   * Verified portraits for Robert Downey Jr., Shah Rukh Khan, Prabhas, Fahadh Faasil, Thalapathy Vijay, Deepika Padukone, Ranbir Kapoor, Cillian Murphy, Zendaya, Pedro Pascal, Matthew McConaughey, Johnny Depp.
5. **🇮🇳 Desi Vibes: Indian & Regional Cinema Catalog:**
   * Dedicated shelf on Discover with language filter pills: `[All Indian] [Hindi] [Telugu] [Tamil] [Malayalam] [Kannada]`.
   * Verified titles (*Kalki 2898 AD, RRR, Manjummel Boys, Maharaja, Aavesham, Jawan, 12th Fail, Stree 2, Leo, Kantara, KGF 2, Bramayugam, Animal, Panchayat, Mirzapur*).
6. **AI Vibe Matcher Prompt Engine ($0 Free Tier):**
   * Natural language mood prompt bar + quick inspiration pills.
   * Evaluates mood semantics, calculates Vibe Alignment %, and displays ranked recommendation cards.
7. **Critic vs. Vibe Reality Check:**
   * Side-by-side comparison in `openDetails(mediaId)`: Rotten Tomatoes % & IMDb score vs. WatchVibe emotional sentiments breakdown with editorial Vibe Reality Verdict.
8. **Group Movie Night "Taste Battle" Room Codes:**
   * Modal and Community feature allowing users to generate or join a 6-letter room code (e.g. `VIBE-88`), with live real-time movie voting backed by Supabase channel `watch_rooms`.

---

## 5. Live Production URL & Artifacts
* **Official Live Production URL:** **`https://watchvibe-app.netlify.app/`**
* **Local Development Daemon:** `http://localhost:8080/`
* **Bundle Directory:** `C:\Users\USER\.gemini\antigravity\scratch\watchvibe\web_live_build`
* **Interactive Single-File Prototype:** `C:\Users\USER\.gemini\antigravity\brain\f6611d7b-a8f1-4c12-911c-f70a1960332b\watchvibe_interactive.html`

---

## 6. Commitments & Constraints
* **$0 Rule:** Maintain 100% free-tier architecture (Netlify, TMDB Free v3, Supabase Free Tier, Apple iTunes zero-auth API).
* **Cinematic Dark Theme:** Keep `#101014` dark background, `#1D1D25` cards, and vibrant vibe tag colors.
* **No Native Installers:** Maintain user directive dropping Phase 4.
* **Persistent Memory:** Always update `memory/HANDOFF.md` upon completing modifications.


---

## Production Deployment & Verification Milestone
- **Live URL:** https://watchvibe-app.netlify.app/
- **Netlify Deploy ID:** 6afa18909138a5f3b9d22906 (Published)
- **Status:** 100% Passed End-to-End Browser Automation & Verification
- **Audit Verification Report:** watchvibe_feature_testing_and_bugfix_report.md
- **Asset Integrity:** 71 of 71 TMDB Image URLs Verified HTTP 200 OK (0 broken)
- **Active Features:**
  1. Universal Search Engine (Actor & Title isolation)
  2. Dynamic TMDB Actor Profiles & Filmography
  3. Desi Vibes (Indian & Regional Cinema with 5 language filters)
  4. AI Vibe Matcher Natural Language Engine ( Free Tier)
  5. Critic vs. Vibe Reality Check
  6. Real-Time Interactive Vibe Voting Grid
  7. Dynamic Local & Supabase Cloud Watchlist
  8. YouTube HD Trailers (dynamic TMDB video ID lookup)
  9. Apple Music Soundtrack Previews with Floating Audio Equalizer
  10. Group Movie Night Taste Battle Room Codes
  11. Option C: Auto Country & Streaming Detection (Asia/Kolkata -> IN)
