# Design brief: "Mai này em lớn" interactive session app

Owner: Huy Dũng · Status: working build (v7, 73 steps) · Last updated: 27/10/2026
Live (private artifact): https://claude.ai/artifact/E7sQm8FpTehz49d4PmTjH2

## 1. What this is

This is a single-page, 16:9 presentation app. It runs the whole 35-minute class session "Mai này em lớn" for lớp 2B0:

- 20 children, about 7 years old
- Homeroom teacher: cô Hương
- Date: 9/11/2026
- Subtitle: *"Lớn lên, em giúp mọi người như thế nào?"*

The app replaces a linear slide deck. Every idea is narrated on one data-driven **Ba vòng tròn** model, and slide-type content pops up as cards over it.

### Hardware in the room

- Touchscreen laptop and projector.
- Logitech Spotlight clicker. It sends PageDown/PageUp, or arrow keys depending on mode.
- On-screen taps are fine for team scoring and settings.

### Core messages

Every chapter must land one of these:

1. **Nghề nào cũng là để giúp đỡ người khác.**
2. **Nghề nào cũng cần rất nhiều kỹ năng và kiến thức bổ trợ** bên cạnh kỹ năng chính dễ thấy nhất. Example: a footballer also needs tactics, teamwork, natural science, their own body, English.
3. **Cần chăm chỉ luyện tập để trở nên giỏi**, thì mới thực sự giúp được người khác hiệu quả. Parents asked for this emphasis.
4. **Hãy cứ giữ những đam mê.** A passion can become the job, a "siêu năng lực" that makes you better at the job, or simply something that keeps you happy.

### Approved teaching lines

Keep these verbatim:

- "Môn học như dụng cụ trong balo. Chưa biết lúc nào dùng, nhưng nghề nào cũng phải mang theo."
- "Học giỏi ở lớp thì mai này em được chọn nhiều đường hơn."
- "Đi học là luyện cái đầu: biết đọc, biết tính, biết suy nghĩ." Do **not** promise every subject is used daily.

## 2. The model (visual metaphor)

| Circle | Colour | Meaning |
|---|---|---|
| ❤️ Thích | orange `#E8622C` | things I like |
| ⭐ Giỏi | blue `#2563C9` | things I'm good at |
| 🤝 Giúp mọi người | brand red `#BD0129` | **the target**: always the biggest circle |

Visual rules (implemented in `layout()`):

- **Size = count.** Radius grows with the number of items.
  - Thích/Giỏi: `min(250, 64 + 44√n)`
  - Red circle: `min(330, 190 + 36√n)`
- **Colour strength = intensity.** Fill opacity follows the average level (1–3) of the items in the circle.
- **Thích ∩ Giỏi overlap = shared topics.** The two circles are placed by the law of cosines.
- **Depth into the red circle = usefulness.** It is set by the share of a circle's topics marked "useful" (`U`).
- **Items** (emoji + name) sit at the mean of the circles they belong to.
  - Non-useful items are pushed away from red. A golden-angle spiral separates items in the same region.
  - School subjects get a `🏫` prefix, so kids see that school feeds the job.
- **Star badge** "⭐ <job>" shows only when all three circles truly overlap (at least 10 grid points inside all three). It sits low in the red circle so it doesn't cover items.
- A step may pass `hide: ['L','G']` to show the red circle alone (chapter 1).
- Every change tweens over 1100 ms (easeInOutCubic). The whole bbox is fit-scaled (k ≤ 2) into the left region `x 50–1110, y 140–990`.

State shorthand used in the script:

```js
S(like, good, help, use)   // e.g. S('bong:3', 'bong:3,khoe:2', 'niemvui:3', 'bong,khoe')
// "key:level" lists, level 1–3 (default 1); `use` = keys that overlap the red circle
```

## 3. Screen layout (1920 × 1080 stage, scaled to fit, letterboxed `#14192B`)

- **Left 1160 px:** the SVG model, or the kid's drawing during the guessing game.
- **Right 760 px:** narration panel with the "who" line, the big caption (`<b>` = red emphasis), and an optional yellow "ask" chip (🙋 a question to the class).
- **HUD:**
  - Chapter pill: top-left.
  - Team scoreboard: top-right. 🌿 Nhóm Xanh Lá Cây (green), 🌤️ Nhóm Xanh Da Trời (blue). Tap + / −; scores persist in `localStorage['mnel-score']`.
  - HDI logo: bottom-left, as a data URI.
  - Red progress bar: bottom.
  - ⚙️ ⛶ ◀ ▶ buttons: bottom-right.
- **Cards:**
  - Dim + blur veil, then a 1700×860 card with 56 px radius.
  - Variants: `paper` (default), `red` (brand red background), `full` (edge to edge, used for cover / collage / ending).
  - Fragments `.f[data-f=n]` reveal one per click. Consecutive steps that share a card `id` don't re-animate.

## 4. Visual language

- **Fonts:** Baloo 2 for display (800), Nunito for body (700–900). Both come from Google Fonts and handle Vietnamese diacritics.
- **Palette:**

| Token | Hex |
|---|---|
| paper | `#FFF8EC` |
| ink | `#1F2A44` |
| muted | `#4A5568` |
| line | `#E9DFCC` |
| sun (yellow) | `#FFD66B` |
| cream | `#F8F7D0` |
| red | `#BD0129` |
| deep red | `#8E011F` |
| green | `#2F9E44` |
| green (dark) | `#237A34` |
| blue | `#2563C9` |

  Tints: `#FFE3D3`, `#DDEBFF`, `#DFF5E3`, `#FFF0B8`.
- **Brand (HDI):** use red strategically on kid-facing material:
  - cover, chant card, collage and ending in deep red;
  - red only for emphasis words elsewhere;
  - logo always present but small.
- **Emoji instead of icon fonts.** Exceptions: two inline SVGs (running figure = "Em làm", hand-heart = "Em giúp") that match the paper worksheet.
- **Every emoji in the dictionaries is unique.** No emoji may be reused for a different meaning. `scripts/build.py` enforces this. Reserved for UI: ❤️ ⭐ 🤝 🌿 🌤️ 🖌️ 🎵 🤸 🎒 💼 🖍️.
- **Type sizes:** caption 48 px, card title 96 px (170 px XL), card body 50 px. Nothing under about 34 px is meant for kids to read.

## 5. Session flow (73 steps)

Each step has teacher notes (N key) with timing hints.

| # | Chapter | Content |
|---|---|---|
| 0–2 | Mở đầu | Cover · "Chú là bố của bạn ___" + `chu-game` image · team split & scoring rules (+1 correct answer, +1 helping a friend, +1 reading your sheet; the winning team only picks its gift bag first) |
| 3–6 | Mở đầu | "Người lớn đi làm để làm gì?" → money loop (help → 💰 thanks → we thank others) → "Một người lớn trong nhà con làm gì, giúp ai?" |
| 7–21 | 1 · Nghề nào cũng giúp người | 3 "Ai đã giúp?" quizzes (🍚 🚽 💊), "Đổi chiều!", 3 "Họ giúp thế nào?" quizzes (🔌 🧑‍🎤 👨‍💻), then all 6 jobs drop into the red circle alone. Doctor: 12 years at school + 6 years at university |
| 22–25 | 1 | AI card: machines do more → jobs change → helping is always needed |
| 26–29 | Ba vòng tròn | Kids' circles already touch red (housework 🧹, caring 🤗) → more likes = bigger → more practice = deeper colour |
| 30–34 | 2 · Hành trang | Footballer: kicking alone → + fitness → + tactics, teamwork, TN&XH, English → helps "niềm vui" ⭐ · 🎒 backpack card |
| 35–42 | 3 · Luyện tập | Minh the pianist: disliked piano → practised (Math for rhythm) → came to like it → audiences ⭐ · red chant card "Chưa giỏi là vì… chưa luyện!" |
| 43–50 | 4 · Giữ đam mê | Lan the chef (hobby becomes the job) · Huy the software engineer (drawing and singing make him better at image/audio software than other programmers: a superpower) · Minh's swimming and photos stay hobbies · 3-path summary card |
| 51–54 | 5 · Thử thật nhiều | A kid unsure what they like → try many things → practise some already-liked ones → "Học giỏi ở lớp…" ⭐ Nhà khoa học |
| 55–60 | Còn chú thì sao? | "Bạn nhỏ này là ai?" (`chu-nho`) → "Chính là chú đấy!" · Huy Dũng's own journey in 4 steps: acting/storytelling → tutoring, teacher-college exam → computers, "chưa giỏi" then kept practising → teaching the team to make games. **Wording is a draft; the owner will rewrite it.** |
| 61 | Hoàn thiện phiếu | Copy the 2 questions into the worksheet icons (🏃 Em làm / 🫶 Em giúp) |
| 62 | Bạn ấy là ai? | Game rules |
| 63–68 ×N | per kid | 4 hint clicks (❤️ Thích, ⭐ Giỏi, 💼 Sau này làm, 🖍️ drawing on the left) → reveal (name, own circles, portrait `NN-nay`, "Đứng lên đọc phiếu · +1") → 2041 photo card "Chăm chỉ học và luyện tập, con sẽ đến được đây!" |
| end-3…end | Kết thúc | "Lớp 2B0 năm 2041" collage (10×2) · "🎯 Ước mơ của em cần học gì?" (sentence frame "Muốn làm ___, em cần ___, ở lớp em luyện môn ___.") · live score card · closing red card + "Cảm ơn các con!" |

With 20 kids the total is 73 + 19×6 = **187 steps**.

## 6. Data and settings (⚙️)

- **Kids:** one line each, in order of appearance: `Tên; Thích; Giỏi; Sau này làm; Giúp`.
  - Items are comma-separated, with an optional leading emoji.
  - Known names map to dictionary keys; unknown ones become dynamic keys (`k-<slug>`, default emoji ✨).
  - A kid's model puts every Thích/Giỏi item in `U` (all useful).
  - The current sample has one placeholder kid.
- **Images:** multi-file input. File name without extension = key:
  - per kid: `NN-ve` (drawing), `NN-nay` (photo now), `NN-2041` (AI image, square, 3×3 in print);
  - Huy Dũng: `chu-nho`, `chu-game`.
  
  Images are stored in IndexedDB (`mai-nay-em-lon` / `img`) on **this browser only**.
- **Lists:** topics and help items are editable, saved in `localStorage['mnel-lists']`. "Về mặc định" restores the defaults.
- **Chapter jump buttons** for rehearsal.

### Privacy commitments to parents

These are promises; don't break them:

- Photos are processed on a personal computer.
- Photos are shown in class only.
- Each family receives only its own child's image.
- Everything is deleted on **23/11/2026**: clear site data in the classroom browser.
- No upload, no analytics, no external calls except Google Fonts.

## 7. Controls

| Input | Action |
|---|---|
| PageDown / → / ↓ / Space / Enter / ▶ | next |
| PageUp / ← / ↑ / Backspace / ◀ | back |
| N | teacher-notes bar |
| B or `.` | blackout (click to dismiss) |
| F / ⛶ | fullscreen |
| Home | first step |

Keys are ignored while settings are open or focus is in an input.

## 8. Content and sensitivity rules

- Say "một người lớn trong nhà", never assume "bố mẹ". Never put a child on the spot about family.
- Stories are illustrative, not real people. In "Bạn An" (old deck) the grandmother **recovers**.
- No gender-coded jobs.
- Praise effort ("luyện"), not talent ("con giỏi quá").
- Two-direction "Ai đứng sau" quiz: who helped me → how does this job help.

## 9. Known gaps / next steps

1. Load real data: 20 kid rows plus 60 images, then do a full rehearsal on the classroom laptop and projector.
2. Rewrite chú's journey copy (steps 56–60) and fill in "Chú là bố của bạn ___".
3. The star only appears when a kid's Thích and Giỏi share a topic. Decide whether kid reveals should always show a star, e.g. force one shared item.
4. Items have no collision avoidance; labels can touch when a circle holds more than about 7 items. Consider a light force or label nudging.
5. Pacing: the guessing game is 6 clicks × 20 kids. Check it against the 35-minute plan; consider 2 hint steps for later kids.
6. **Offline fallback:** fonts come from Google Fonts. Open `dist/ba-vong-tron.html` locally as a backup; it falls back to system fonts without internet. Option: base64-embed the fonts.
7. The lesson-plan Doc (https://claude.ai/artifact/W99o9TEwXobeR96pvzRfqJ) and both Slides decks still describe the old linear flow. Sync them if the app becomes the main presentation.

## 10. Related artifacts

- Lesson plan (Doc): https://claude.ai/artifact/W99o9TEwXobeR96pvzRfqJ (includes the Nano Banana Pro image prompt and the parent-form link forms.gle/vFTtxY5QGxtWu2Un6)
- Worksheet (Design, A4 front + drawing back): https://claude.ai/artifact/L65NBpfSMQbyRbi4siqgQZ
- Full deck (Slides, 69 slides): https://claude.ai/artifact/MDoihQGtXYk9fM8xvimkSX
- Short deck (Slides, 66 slides, no hobbies/superpower): https://claude.ai/artifact/Akgvyhodpx1oRdSYKoxDFk
