# Mission Radiance

A highly polished, mobile-first 2D browser game designed for **St. Joseph's School** to showcase their core values. The player controls a rocket traveling from Earth to the Moon, collecting the seven core values while avoiding asteroids. The game features a premium navy-and-gold color palette, fully responsive layouts, and synthesized sound effects, creating a cinematic vertical scrolling experience.

## Features

- **Mobile-First Portrait Design**: Optimized for vertical phone screens, perfect for scanning a QR code from a print or digital publication.
- **Responsive Canvas Scaling**: Renders at crisp high-DPI resolution, adapting to both Android and iOS devices.
- **Intuitive Touch Splits**: Tapping/holding the left side of the screen steers the rocket left, and the right side steers it right. Falls back to WASD/Arrow keys on desktop.
- **Zero Assets Size (Under 100 KB)**: All visuals (planets, rocket, debris, badges, flags) are drawn programmatically using HTML Canvas vector paths.
- **Procedural Synthesized Sound**: Retro and futuristic sound effects generated entirely using the Web Audio API—no MP3 or WAV files needed, ensuring instant loading.
- **Offline Playability (PWA)**: Registering a Service Worker caches index.html, style.css, and game.js, allowing the game to load instantly offline.
- **Rescue Mechanic**: Restarts from the same progress point upon collision failures so players don't lose their journey.
- **Cinematic Finale**: Features an autonomous landing sequence, planting the St. Joseph's flag with a waving flag animation.

---

## File Structure

```text
mission-radiance/
├── index.html   # HTML structure, HUD, and overlays
├── style.css    # Responsive layouts, color schemes, and CSS animations
├── game.js      # Game loop, Canvas rendering, synthesizers, physics, and states
└── sw.js        # Service Worker for PWA/offline caching
```

---

## Getting Started

### Local Development

Since the game uses a Service Worker, it must be run on a local server (or localhost) for safety permissions. Opening `index.html` directly as a file (`file:///...`) might disable the Service Worker in certain browsers.

You can launch a simple local development server using any of the following methods:

#### Method A: Python (Built-in)
If you have Python installed, open your command terminal in the `mission-radiance` directory and run:
```bash
python -m http.server 8000
```
Then navigate to `http://localhost:8000` in your browser.

#### Method B: Node.js (http-server)
If you have Node.js installed, run:
```bash
npx http-server . -p 8000
```
Then open `http://localhost:8000` in your web browser.

#### Method C: VS Code Live Server
If you use VS Code, right-click `index.html` and choose **Open with Live Server**.

---

## Deployment Steps

The project contains only static files (`index.html`, `style.css`, `game.js`, `sw.js`), making it completely free and easy to host on static web hosting providers.

### Option 1: Cloudflare Pages (Recommended)
1. Log in to your [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. Navigate to **Workers & Pages** -> **Create application** -> **Pages**.
3. Connect your GitHub repository containing the `mission-radiance` folder, or select **Direct Upload** to drag-and-drop the directory.
4. If uploading via git, set the Build Command as empty (leave blank) and the Build Output Directory as `./` (or the folder name).
5. Click **Save and Deploy**. Cloudflare will give you a custom `*.pages.dev` subdomain.

### Option 2: Netlify
1. Log in to [Netlify](https://www.netlify.com/).
2. Drag and drop the `mission-radiance` folder directly into the Netlify dashboard upload zone.
3. Your site will deploy instantly. You can customize the site name and add custom domains.

### Option 3: GitHub Pages
1. Push the files to a GitHub repository.
2. In the repository settings, go to the **Pages** tab.
3. Set the build source to **Deploy from a branch** and select the `main` or `master` branch.
4. Save, and your game will be published at `https://<username>.github.io/<repo-name>/`.

---

## Game Architecture

1. **State Machine (`gameState`)**:
   - `INTRO`: Splash screen with controls.
   - `FULLSCREEN_PROMPT`: Recommend entering fullscreen.
   - `LAUNCH`: Launch cutscene (accelerating upward, shrinking Earth).
   - `GAMEPLAY`: Main playing mode.
   - `INTERRUPTED`: Reset panel showing "Continue".
   - `LANDING`: Auto descent towards the Moon and flag planting.
   - `VICTORY`: Success report with replay action.
   
2. **Web Audio Synthesis**:
   - Uses `AudioContext` to construct oscillators, gains, and filters on the fly.
   - Saves bandwidth, increases compatibility, and functions without network.

3. **Responsive Coordinate System**:
   - Calculations use virtual dimensions of `360 x 640`.
   - Canvas resizes dynamically to fill the browser window. A scaling matrix coordinates translation to physical screen pixels, ensuring perfect proportions.
