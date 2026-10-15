# WorldForge — Visual Brief

Everything visual WorldForge needs: images, backgrounds, icons and motion. Use it to plan, create and check assets. Each item lists **where it appears**, its **size and format**, **what it should show**, its **priority** and its **status**.

- **Status**: ✅ exists (can be improved) · 🟡 placeholder in use · ⬜ missing
- **Priority**: **P1** before launch · **P2** soon after · **P3** nice to have

---

## 1. Style rules (apply to every asset)

**Mood:** a fantasy archivist's study at night. Candle-lit maps, old ink, moonlight, quiet mystery. Premium and calm, never cartoonish or neon.

| Token | Hex | Use |
| --- | --- | --- |
| Background | `#101116` | Page background; images must blend into it at their edges |
| Background 2 | `#15161C` | Panels |
| Surface | `#1C1D24` | Cards |
| Border | `#30313A` | Lines |
| Text | `#F1EEE7` | Parchment white |
| Gold (accent) | `#D6BD8D` | Highlights, candlelight, important objects. Use sparingly |
| Violet (accent) | `#8D80B8` | Magic, alternate timelines, AI. Rare |

**Do:**
- Dark, low-contrast scenes.
- One warm light source (moon, candle or ember).
- Painterly or engraved textures, silhouettes, mist, parchment and ink.

**Don't:**
- Bright saturated colours, glowing neon edges or busy patterns.
- Text baked into images (the UI adds text).
- Real-world logos, copyrighted characters, or a recognisable living artist's style.

**Technical defaults:**
- Formats: WebP or AVIF for photos and paintings, SVG for line art and icons, PNG only when transparency needs it.
- Supply raster images at **2×** the display size.
- Keep each image **under 400 KB** (heroes under 600 KB).
- Fade every image's edges to `#101116` so it sits on the page without a hard border.
- Leave clear space where text will sit (noted per item).

---

## 2. Brand

| ID | Asset | Where | Size / format | What it shows | Priority | Status |
| --- | --- | --- | --- | --- | --- | --- |
| B1 | Logo mark | Top bar, favicon, sign-in | SVG, square, works at 16 px | A forge-ember or diamond inside a ring (current mark is a placeholder in `components/brand/logo.tsx`) | P1 | 🟡 |
| B2 | Wordmark | Top bar, marketing | SVG, horizontal | "WorldForge" in an editorial serif (Cormorant-like) next to B1 | P2 | 🟡 |
| B3 | Favicon set | Browser tab, bookmarks | `favicon.ico` 32/16 px, `icon.png` 512 px, `apple-icon.png` 180 px | B1 on `#101116` | P1 | ⬜ (default Next.js icon) |
| B4 | Social share image | Link previews (WhatsApp, X, Discord, LinkedIn) | 1200×630 PNG/JPG | Hero scene, logo and the headline "Your universe. Every detail connected." Social cards are the one place text is allowed in the image | P1 | ⬜ |

---

## 3. Marketing website (public pages)

| ID | Asset | Where | Size / format | What it shows | Priority | Status |
| --- | --- | --- | --- | --- | --- | --- |
| M1 | Home hero landscape | `/` top, full width | 2880×1600 WebP, or keep the SVG | Moonlit highland citadel on a crag above a misty valley, a winding road, pines in the foreground. **Left 45 % kept dark and empty for the headline.** Currently a procedural SVG (`hero-landscape.tsx`) | P1 | ✅ (could be replaced by a painted version) |
| M2 | Hero parallax layers (optional) | Same as M1 | 4 transparent PNG/WebP layers, 2880 wide: sky, far ridges, citadel with mid ridge, near ridge with pines | M1 split into layers for gentle depth on scroll | P3 | ⬜ |
| M3 | Feature illustrations ×6 | `/features` and home "features" grid | 960×640 WebP each | Small vignettes: (1) a character dossier on a desk, (2) a wax-sealed faction banner, (3) a hand-drawn map with a compass, (4) a timeline scroll unrolling, (5) a lore book with a glowing rune, (6) a branching river splitting into two paths (alternate timelines) | P2 | ⬜ (text and live previews only) |
| M4 | "Living World Engine" banner | Home engine section | 2400×900 WebP | A single event (a crown falling) with ripples of light travelling outward through a web of threads. Gold for canon, violet for the alternate branch. Clear space in the centre top | P2 | ⬜ |
| M5 | Pricing background texture | `/pricing` | 1600×1600 tileable WebP, < 150 KB | Very faint parchment and engraved star chart | P3 | ⬜ |
| M6 | About page portrait or scene | `/about` | 1600×900 WebP | Empty archivist's desk: candles, quill, open atlas | P3 | ⬜ |
| M7 | Product screenshots | Home "showcase" | Live components today | Real UI previews (graph, timeline, engine). **Keep these as live UI**, don't replace them with mock-ups | — | ✅ |

---

## 4. Sign-in and onboarding

| ID | Asset | Where | Size / format | What it shows | Priority | Status |
| --- | --- | --- | --- | --- | --- | --- |
| A1 | Auth side art | `/login`, `/signup`, password pages (desktop side panel) | 1200×1600 portrait WebP | A great library door, slightly open, with warm light spilling out. Dark top third | P2 | ⬜ |
| A2 | Wizard genre cards ×10 | `/worlds/new` step 2 | 480×320 WebP each | One small scene per genre: High fantasy (castle), Dark fantasy (thorned ruin), Sci-fi (ring station), Post-apocalyptic (overgrown city), Historical (harbour with tall ships), Mythology (temple and constellation), Superhero (city rooftop at night), Horror (lone lantern in fog), Contemporary (rainy street), Custom (blank map with a quill) | P2 | ⬜ (text only) |
| A3 | Start-method illustrations ×3 | Wizard step 3 | 320×200 SVG or WebP | Blank page · open template book · sparkling quill (AI) | P3 | ⬜ (icons only) |

---

## 5. Inside the app

| ID | Asset | Where | Size / format | What it shows | Priority | Status |
| --- | --- | --- | --- | --- | --- | --- |
| W1 | Universe cover: Ashen Crown | Dashboard card, world overview header | 1600×900 WebP (current: SVG) | A blackened crown on a stone plinth, ash drifting, a distant burning sky. Lower third darker for the title | P1 | ✅ (`public/art/ashen-crown-cover.svg`; a painted version would lift it) |
| W2 | Default universe covers ×6 | Cards for worlds without an uploaded cover | 1600×900 WebP | Generic moods: mountains, sea, desert, forest, starfield, ruins. Picked by genre | P2 | ⬜ (gradient fallback) |
| W3 | Ashen Crown world map | Atlas | 2400×1600 (current SVG) | Parchment map: Highmarch, Saltmere, Qirath, Solenne ruins, Greyford, Thornwall Pass, Port Ilvane, the Glass Wastes, the Ember Road, Kestrel Abbey, Cairn Hollow, Duskmere. **Positions must match `src/sample/ashen-crown.ts` (`map: [x, y]`)** | P2 | ✅ (`public/maps/ashen-crown.svg`) |
| W4 | Blank parchment map | Atlas for new worlds | 2400×1600 | Empty aged parchment with a faint compass rose and grid | P2 | ✅ (`public/maps/parchment.svg`) |
| W5 | Globe texture | Atlas → Globe (experimental) | 4096×2048 equirectangular WebP | W3 painted as a full world (equirectangular projection), with oceans around the known lands | P3 | 🟡 (reuses W3) |
| W6 | Character portrait placeholders | Character cards, graph nodes, detail pages | 512×512 WebP or SVG, circular-safe | 6 neutral silhouette busts (hooded, crowned, armoured, scholar, rogue, elder) on a dark vignette. Picked by a hash of the name. Today: initials | P2 | 🟡 |
| W7 | Ashen Crown portraits ×17 (optional) | Sample world characters | 512×512 WebP | One portrait per sample character (e.g. Aldren Caldris the young king, Seren Vale the returned heir, Maelis Ivell the queen of Maren). Same painterly style, same lighting, shoulders-up, plain dark background | P3 | ⬜ |
| W8 | Faction emblems ×6 (sample) | Faction cards, map regions, graph | 512×512 SVG preferred | Heraldic crests: Kingdom of Veyr, Kingdom of Maren, Kesh Dominion, Ember Road Compact, Order of the Veiled Flame, The Hollow Court. Flat, two- or three-colour, gold line on dark | P2 | ⬜ (icon only) |
| W9 | Empty-state illustrations ×6 | Empty directories, codex, timeline, graph, assets, branches | 400×280 SVG, line art in `#30313A` and `#D6BD8D` | An empty bookshelf, an unwritten scroll, an empty hourglass, a single unlinked node, an empty frame, a river fork | P2 | ⬜ (text only) |
| W10 | 404 / error scene | Not-found and error pages | 1200×600 WebP | A torn map edge fading into fog: "Here be nothing" | P3 | ⬜ |
| W11 | Lore category icons | Lore Codex | SVG 24 px (Lucide style) | History, Myth, Religion, Culture, Magic, Geography, Politics, Bestiary | P3 | 🟡 (generic icons) |

**Icons:** the app uses the **Lucide** icon set (stroke 1.5–2 px, 24 px grid). New icons must match it. Don't mix icon styles.

---

## 6. Movement (motion design)

**Principle:** motion explains changes in the world. It is never decoration for its own sake. Everything must stop when the user enables **Reduce motion** (account setting) or their system's reduced-motion setting. That is already wired in.

| ID | Motion | Where | Spec | Status |
| --- | --- | --- | --- | --- |
| X1 | Hero mist drift | Home hero | Mist band slides about 3 % horizontally, 28 s loop, ease-in-out, alternating | ✅ |
| X2 | Hero slow parallax | Home hero (with M2) | Layers move at 0 / 4 / 10 / 18 px per 100 px of scroll | ⬜ |
| X3 | Star twinkle | Home hero sky | 5–8 random stars fade 40 %→100 % over 3–6 s, staggered | ⬜ |
| X4 | Page / panel fade-in | All app pages, dialogs | 180 ms fade and 4 px rise, ease-out | ✅ |
| X5 | Graph node settle | Relationship graph | Nodes spring into the force layout over about 400 ms; the camera fits the view over 400 ms | ✅ |
| X6 | Graph selection pulse | Graph | Selected node gets one gold ring pulse (scale 1→1.15, opacity 1→0) over 600 ms | ⬜ |
| X7 | Timeline zoom | Chronos | Smooth wheel or pinch zoom anchored at the cursor; ticks cross-fade between scales over 150 ms | ✅ (zoom), ⬜ (tick cross-fade) |
| X8 | **Impact ripple** (signature effect) | Living World Engine, after "Analyse impact" | From the changed event, rings expand outward through affected records in order of depth (0, 1, 2, 3), 120 ms stagger per level. Direct impacts are gold; contradictions get a muted red flicker | ⬜ (P2, the key "wow" moment) |
| X9 | Branch split | Commit to new timeline | A gold line splits into gold (canon) and violet (new branch) over 700 ms, then the success message appears | ⬜ |
| X10 | Autosave indicator | Lore Codex | "Saving…" dot breathes at 1.2 s; turns to a check with a 150 ms scale pop | ✅ (text), ⬜ (pop) |
| X11 | Map marker drop | Atlas, placing a location | Marker drops 12 px with a small bounce (spring), 250 ms | ⬜ |
| X12 | Loading skeletons | Graph, globe, lists | Soft shimmer, 1.6 s, low contrast (`#1C1D24`→`#22232B`) | ✅ (static), ⬜ (shimmer) |

**Limits:**
- Never animate more than about 3 things at once.
- No motion longer than 800 ms except ambient loops.
- No flashing faster than 3 times per second.

---

## 7. Production checklist

For every image, before it's added to `public/`:

- [ ] Matches the palette and the moonlit / candle-lit mood
- [ ] No text, logos or watermarks inside the image (except B4)
- [ ] Correct size (2×) and format; under the size limit
- [ ] Edges fade into `#101116`; text-safe area left clear where noted
- [ ] Looks right on a phone (390 px wide): the subject isn't cropped out
- [ ] Original work, or you hold the licence. Note the source and licence in `public/CREDITS.md`
- [ ] File named by its ID, e.g. `public/art/m4-engine-banner.webp`, `public/emblems/w8-veyr.svg`

**Where files go:** `public/art/` (illustrations, covers), `public/maps/` (maps, globe), `public/emblems/` (crests), `public/portraits/` (portraits), `src/app/` (favicon set: `icon.png`, `apple-icon.png`, `opengraph-image.png`).

---

## 8. Suggested order

1. **P1, before sharing the link:**
   - B1 logo mark and B3 favicon set.
   - B4 social share image.
   - Optionally a painted W1 cover.
2. **P2:**
   - X8 impact ripple (the signature moment).
   - W8 faction emblems.
   - W6 portrait placeholders.
   - W9 empty states.
   - A2 genre cards.
   - M3 and M4 marketing illustrations.
   - W2 default covers.
3. **P3:**
   - Hero parallax (M2, X2) and star twinkle (X3).
   - Sample portraits (W7) and globe texture (W5).
   - Remaining backgrounds and small motions.

## 9. Prompt template for image generation

Use this as a starting point and fill in the brackets:

> Dark fantasy concept art, [SUBJECT], moonlit night, single warm light source from [candle / ember / moon], deep blue-black shadows (#101116), muted parchment and antique-gold highlights (#D6BD8D), subtle mist, painterly texture, calm and mysterious, high detail, no text, no logo, edges fading to black, [ASPECT RATIO], empty dark space on the [left / top] for a headline.

Keep the same seed and style settings across a set (for example all 17 portraits) so they look like one collection.
