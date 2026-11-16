# WATCHVIBE 🎬
> **"Don't just rate it. Tell us the vibe."**  
> Social entertainment discovery for **Android, iOS, macOS, Windows, and Web** built with Flutter.

🌐 **Live Production Web App:** [https://watchvibe-app.netlify.app/](https://watchvibe-app.netlify.app/)  
⚡ **Local Dev Server:** `http://localhost:8080`

---

> [!IMPORTANT]
> **Persistent Session Handoff & Memory:**  
> For complete architecture history, zero-cost free-tier guidelines, component maps, and session instructions, see:  
> 📖 [memory/HANDOFF.md](file:///C:/Users/USER/.gemini/antigravity/scratch/watchvibe/memory/HANDOFF.md)

---

## 🌟 The Core Differentiator: Vibe Rating System
Instead of relying solely on a traditional 1–10 numerical score, **WATCHVIBE** lets users classify what kind of emotional and cinematic experience to expect. Users can assign **multiple categories** to a single title.

### The 7 Vibe Categories:
| Category | Color | Icon | Definition |
| :--- | :--- | :--- | :--- |
| **Must Watch** | `#22C55E` (Green) | 👑 Verified | Top pick • Exceptional storytelling & unforgettable impact. |
| **Mind Blown** | `#A855F7` (Purple) | 💥 Sparkle | Unexpected twists, brilliant concepts & mind-bending storytelling. |
| **Emotional Damage** | `#F43F5E` (Rose) | ❤️ Heart | Stories that make you cry, think or feel something deeply. |
| **Hidden Gem** | `#F59E0B` (Amber) | 💎 Diamond | Underrated movies and shows that deserve way more attention. |
| **Fun Time** | `#06B6D4` (Cyan) | 😄 Smile | Entertaining, funny, exciting. Perfect for a good time. |
| **Time Pass** | `#FB923C` (Orange) | ⏳ Hourglass | Good enough to watch when bored, nothing extraordinary. |
| **Skip It** | `#EF4444` (Red) | 🚫 Block | Not worth your time. Better things to watch. |

---

## 🚀 Key Implemented Features

1. **Universal Search Engine:** Search actors (e.g. Johnny Depp), directors, movies, and shows simultaneously.
2. **Dedicated Actor Profile Pages:** Bio, \$10.2B Box Office counter, Actor Vibe DNA, and filmography aligned in sequence with sorting by:
   - 💰 Box Office (Highest to Lowest)
   - ⭐ Rating (Highest to Lowest)
   - 🔥 Popularity in App
   - 📅 Newest First / Chronological
3. **"Where to Watch" (Country-Specific Streaming):** Powered by free TMDB / JustWatch data for US, India, UK, and Canada.
4. **Theme Soundtrack Previews:** 30-second audio preview powered by the free Apple / iTunes Search API with animated equalizer.
5. **How to Watch (Sensory Guide):** Ideal environment, pacing profile, cry gauge (1-10), and attention level.
6. **Community Vibe Percentage Engine:** Dynamically calculates the percentage breakdown across all 7 categories on vote submission.
7. **Taste Match (Friend Compatibility):** Mathematical alignment percentage between two users.
8. **Watch Battles:** Head-to-head weekly community voting.
9. **Responsive Shell:** Bottom navigation on Mobile (Android & iOS), Sidebar layout on Desktop (Windows & macOS).

---

## 🛠️ How to Run & Build

### Prerequisites
- Install [Flutter SDK](https://docs.flutter.dev/get-started/install) (`>= 3.0.0`).

### 1. Run on Windows
```bash
flutter run -d windows
```

### 2. Run on macOS
```bash
flutter run -d macos
```

### 3. Run on Android
```bash
flutter run -d android
```

### 4. Run on iOS
```bash
flutter run -d ios
```

### 5. Run on Web
```bash
flutter run -d chrome
```
