<div align="center">

<img src="https://img.shields.io/badge/AI-Powered-blueviolet?style=for-the-badge" />
<img src="https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js" />
<img src="https://img.shields.io/badge/TypeScript-Strict-blue?style=for-the-badge&logo=typescript" />
<img src="https://img.shields.io/badge/Tailwind-v4-38bdf8?style=for-the-badge&logo=tailwindcss" />

# AI Website Cloner

### Turn any website into a pixel-perfect Next.js clone — automatically.

Animations · Hover effects · Fonts · Colors · Videos · Carousels · Scroll effects

https://github.com/user-attachments/assets/ac7d298b-9272-4719-80f4-79191e10d702

*Left: original aman.com — Right: AI-generated clone*

[Getting Started](#-getting-started) · [Supported AI Tools](#-supported-ai-tools) · [How It Works](#-how-it-works) · [Scripts](#-scripts-reference) · [Troubleshooting](#-troubleshooting)

</div>

---

## What Is This?

**AI Website Cloner** is a fully scaffolded Next.js project combined with a set of automation scripts. Together with an AI coding assistant, it clones any public website into clean, production-ready code — pixel-perfect.

You run one command. The AI does everything else:

- Analyzes the target site (colors, fonts, CSS, animations, section structure)
- Detects and downloads embedded videos (Vimeo, YouTube, HLS streams)
- Downloads all images and fonts
- Generates per-section specs with exact CSS values
- Builds React components with all animations and interactions
- Runs visual QA to verify nothing is broken

Works with **Claude Code**, **Cursor**, **Aider**, **Codex CLI**, **Gemini CLI**, **GitHub Copilot**, **Cline**, **Roo**, **Windsurf**, and more.

---

## ✅ Requirements

You need these installed **before** starting:

| Tool | Version | Download |
|------|---------|----------|
| **Node.js** | 18 or higher | [nodejs.org](https://nodejs.org) |
| **Python** | 3.8 or higher | [python.org](https://python.org) |
| **Git** | Any recent version | [git-scm.com](https://git-scm.com) |
| **An AI coding assistant** | — | See [Supported AI Tools](#-supported-ai-tools) below |

> **Windows users:** Make sure Python is added to PATH during installation. Check the box *"Add Python to PATH"* in the installer.

> **Mac users:** Install Node.js with `brew install node` and Python with `brew install python`.

---

## 🚀 Getting Started

### Step 1 — Clone the repository

```bash
git clone https://github.com/Omerfaruk-aydn/sitecloner.git
cd sitecloner
```

### Step 2 — Install npm packages

```bash
npm install
```

This installs everything: Next.js, Framer Motion, Lenis smooth scroll, Embla Carousel, Puppeteer, Playwright, Tailwind CSS v4, TypeScript, and all other dependencies.

### Step 3 — Install system tools

```bash
npm run setup
```

This automatically installs three system-level tools:

| Tool | What it does |
|------|-------------|
| **yt-dlp** | Downloads videos from Vimeo, YouTube, and HLS streams |
| **ffmpeg** | Converts and merges video files |
| **Playwright Chromium** | Headless browser for recording and QA |

### Step 4 — Verify the installation

```bash
npm run check
```

You should see all green checkmarks. Example output:

```
✅ node: v20.x.x
✅ puppeteer: v22.x.x
✅ framer-motion: v11.x.x
✅ playwright: v1.x.x
✅ yt-dlp: 2024.x.x
✅ ffmpeg: found
✅ git: git version 2.x.x
✅ All required directories exist
✅ next.config.ts: found
✅ useScrollReveal hook: found
```

If anything shows ❌, the command tells you exactly what to run to fix it.

---

## 🤖 Supported AI Tools

### Claude Code *(Recommended)*

The best experience. Claude Code has a built-in `/clone-website` slash command.

**Installation:**
```bash
npm install -g @anthropic-ai/claude-code
```

**Usage:**
```
/clone-website https://target-site.com
```

Claude will ask 4 quick questions, then run the full pipeline automatically without interruption.

---

### Cursor

**Installation:**
Download from [cursor.com](https://cursor.com) and open the project folder.

**Usage:**
Open Cursor in the project directory and type in the chat:
```
Clone this website pixel-perfect: https://target-site.com
Follow the instructions in AGENTS.md
```

Cursor reads `.cursorrules` automatically — no extra setup needed.

---

### Aider

**Installation:**
```bash
pip install aider-chat
```

**Usage:**
```bash
cd sitecloner
aider --model gpt-4o
```
Then type in the chat:
```
Clone this website: https://target-site.com
Follow AGENTS.md for the full pipeline.
```

---

### Codex CLI (OpenAI)

**Installation:**
```bash
npm install -g @openai/codex
```

**Usage:**
```bash
codex "Clone https://target-site.com pixel-perfect. Follow AGENTS.md."
```

---

### Gemini CLI

**Installation:**
```bash
npm install -g @google/gemini-cli
```

**Usage:**
```bash
gemini
```
Then type:
```
Clone this website: https://target-site.com
Read GEMINI.md for instructions.
```

---

### GitHub Copilot (VS Code)

**Installation:**
Install the [GitHub Copilot extension](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot) in VS Code.

**Usage:**
Open the project in VS Code, then in Copilot Chat:
```
Clone this website: https://target-site.com
Follow the instructions in .github/copilot-instructions.md
```

---

### Cline

**Installation:**
Install the [Cline extension](https://marketplace.visualstudio.com/items?itemName=saoudrizwan.claude-dev) in VS Code.

**Usage:**
Open Cline panel and type:
```
Clone https://target-site.com following .clinerules
```

---

### Roo Code

**Installation:**
Install the [Roo Code extension](https://marketplace.visualstudio.com/items?itemName=RooVeterinaryInc.roo-cline) in VS Code.

**Usage:**
Open Roo panel and type:
```
Clone https://target-site.com following .roorules
```

---

### Windsurf (Codeium)

**Installation:**
Download from [codeium.com/windsurf](https://codeium.com/windsurf).

**Usage:**
Open the project in Windsurf, then in the Cascade panel:
```
Clone https://target-site.com following .windsurfrules
```

---

### Amazon Q Developer

**Installation:**
Install the [Amazon Q extension](https://marketplace.visualstudio.com/items?itemName=AmazonWebServices.amazon-q-vscode) in VS Code.

**Usage:**
Open Q Chat and type:
```
Clone https://target-site.com following .amazonq/rules/clone-ai.md
```

---

## ⚙️ How It Works

The cloning pipeline runs in 7 phases:

```
Phase 1 → Recon          Analyze colors, fonts, CSS, animations, section structure
Phase 2 → Embeds         Detect Vimeo/YouTube iframes, HLS streams
Phase 3 → Assets         Download images, fonts, and videos (via yt-dlp for streams)
Phase 4 → Specs          Generate per-section Markdown specs with exact CSS values
Phase 5 → Code           Build React components with animations and interactions
Phase 6 → QA             Check for invisible sections, broken images, console errors
Phase 7 → Video          Record original + clone, merge into comparison video
```

### What gets extracted

| Data | How |
|------|-----|
| Colors, fonts, CSS variables | `getComputedStyle()` on every element |
| Animations | Keyframes, transitions, timing functions |
| Scroll behaviors | IntersectionObserver, sticky elements, parallax |
| Images | Direct download from `<img>` tags and CSS backgrounds |
| Videos | Streaming via yt-dlp for Vimeo/YouTube, direct download otherwise |
| SVGs | Extracted as inline React components |
| Interactions | Click, hover, dropdown, modal behaviors |

---

## 🛠 Scripts Reference

All scripts run automatically during cloning. You can also run them manually:

### Setup scripts

```bash
npm run setup      # Install yt-dlp, ffmpeg, Playwright browser
npm run check      # Verify all dependencies are installed
```

### Cloning pipeline

```bash
npm run recon https://site.com     # Phase 1: Analyze target site
npm run download-assets            # Phase 3: Download images/fonts/videos
npm run annotations                # Extract annotated screenshots
npm run animations                 # Extract animation timing data
npm run interaction-map            # Map all interactive elements
```

### Development

```bash
npm run dev        # Start Next.js dev server → http://localhost:3000
npm run build      # Production build
npm run lint       # ESLint check
```

### Quality assurance

```bash
npm run qa         # Check clone: invisible sections, broken images, console errors
npm run diff       # Pixel-level visual diff vs original
```

### Video recording

```bash
npm run record https://site.com    # Record original site (Playwright)
npm run record:clone               # Record clone at localhost:3000
npm run comparison                 # Merge into side-by-side comparison video
```

### Reset

```bash
npm run clone:reset    # Delete all generated files, start fresh
```

---

## 📁 Project Structure

```
sitecloner/
│
├── .claude/commands/
│   └── clone-website.md        ← /clone-website slash command
│
├── templates/                  ← Config files for each AI tool
│   ├── .cursor/rules/          ← Cursor rules
│   ├── .github/                ← GitHub Copilot instructions
│   ├── .amazonq/               ← Amazon Q rules
│   ├── .clinerules             ← Cline rules
│   ├── .roorules               ← Roo rules
│   ├── .windsurfrules          ← Windsurf rules
│   ├── .aider.conf.yml         ← Aider config
│   └── augment-guidelines.md  ← Augment rules
│
├── scripts/                    ← Automation scripts
│   ├── recon.js                ← Site analyzer (Puppeteer)
│   ├── download-assets.js      ← Asset downloader (yt-dlp support)
│   ├── generate-specs.js       ← Markdown spec generator
│   ├── annotate-screenshots.js ← Annotated section screenshots
│   ├── extract-animations.js   ← Animation extractor
│   ├── interaction-map.js      ← Interactive element mapper
│   ├── record-site.js          ← Original site recorder
│   ├── record-clone.js         ← Clone recorder
│   ├── make-comparison.js      ← Side-by-side video merger
│   ├── qa-check.js             ← QA checker
│   ├── visual-diff.js          ← Pixel diff tool
│   ├── section-diff.js         ← Section comparison
│   ├── video-to-frames.js      ← Frame extractor
│   ├── setup-check.js          ← Dependency checker
│   └── install-system-deps.js  ← Auto installer
│
├── src/
│   ├── app/
│   │   ├── layout.tsx          ← Root layout + font loading
│   │   ├── page.tsx            ← Home page (assembled sections)
│   │   └── globals.css         ← Design tokens + keyframes
│   │
│   ├── components/
│   │   ├── sections/           ← Cloned sections (one file each)
│   │   ├── icons.tsx           ← Extracted SVG icons
│   │   └── providers/          ← Lenis smooth scroll provider
│   │
│   ├── hooks/
│   │   └── useScrollReveal.ts  ← Lenis-compatible scroll hook
│   │
│   └── types/                  ← TypeScript interfaces
│
├── docs/                       ← Generated during cloning (git-ignored)
├── public/                     ← Downloaded assets (git-ignored)
├── AGENTS.md                   ← AI instructions (all tools)
├── CLAUDE.md                   ← Claude Code config
└── GEMINI.md                   ← Gemini CLI config
```

---

## 🎨 Tech Stack

### Clone output (what gets built)

| Library | Version | Purpose |
|---------|---------|---------|
| Next.js | 15 | App Router, image optimization, font loading |
| TypeScript | 5 | Strict type safety |
| Tailwind CSS | v4 | Utility-first styling |
| Framer Motion | 11 | Scroll animations, page transitions |
| Lenis | 1.3 | Smooth scroll |
| Embla Carousel | 8 | Touch-friendly sliders |
| Lucide React | latest | Icon library |
| shadcn/ui | latest | Accessible UI primitives |
| react-intersection-observer | 9 | Scroll trigger (Lenis-compatible) |

### Automation (scripts)

| Tool | Purpose |
|------|---------|
| Puppeteer | Headless Chrome for analysis and QA |
| Playwright | Video recording and interaction testing |
| yt-dlp | Vimeo / YouTube / HLS streaming video download |
| ffmpeg | Video conversion and comparison merging |
| pixelmatch | Pixel-level visual diffing |
| pngjs | PNG image processing |
| sharp | High-performance image optimization |

---

## ⚠️ Critical Animation Rules

This project enforces strict patterns to keep **Lenis smooth scroll** and **Framer Motion** working together correctly.

### ❌ Never use `whileInView`

```tsx
// BROKEN — stays invisible forever when Lenis is active
<motion.div
  initial={{ opacity: 0 }}
  whileInView={{ opacity: 1 }}
  viewport={{ once: true }}
>
```

### ✅ Always use `useScrollReveal`

```tsx
'use client';
import { motion } from 'framer-motion';
import { useScrollReveal } from '@/hooks/useScrollReveal';

export default function MySection() {
  const { ref, inView } = useScrollReveal();

  return (
    <section ref={ref}>
      <motion.h2
        animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      >
        Heading
      </motion.h2>
    </section>
  );
}
```

The `useScrollReveal` hook uses `react-intersection-observer` with `fallbackInView: true` — this works correctly with any scroll library.

### Other rules

- Every file using `motion`, `useState`, `useEffect`, or `useRef` must start with `'use client'`
- Always use `next/image` with `fill` + `sizes` props for images
- Always use `next/font/local` — never CDN font links
- Videos must have all four attributes: `autoPlay loop muted playsInline`

---

## 🔍 QA Checklist

Run after each section is built:

```bash
npm run qa
```

The QA script automatically checks:

- ✅ No invisible sections (opacity: 0 stuck from broken animation)
- ✅ No broken images (HTTP 404)
- ✅ No JavaScript console errors
- ✅ All sections have visible content (text, images, or background)
- ✅ Scroll animations trigger correctly
- ✅ TypeScript compiles: `npx tsc --noEmit`

Results are saved to `docs/qa/qa-report.json`.

---

## ❓ Troubleshooting

**`npm run setup` fails**

Make sure Python is installed and accessible:
```bash
python --version   # Should print Python 3.x.x
pip --version      # Should print pip version
```
If not found, download from [python.org](https://python.org) and ensure it's added to PATH.

---

**Video stays as `.webm` instead of `.mp4`**

ffmpeg was installed via Python but isn't in your system PATH. This is normal — the scripts find it automatically via `imageio_ffmpeg`. Run:
```bash
npm run setup
```
Then restart your terminal.

---

**Vimeo or YouTube video downloads as an empty file**

The site uses streaming video (HLS). Make sure yt-dlp is installed:
```bash
pip install yt-dlp
yt-dlp --version
```
The recon script detects iframes automatically and stores embed URLs. Run `npm run download-assets` again after installing yt-dlp.

---

**`networkidle` timeout when recording**

Pages with video backgrounds (like hero videos) never reach `networkidle` because the video keeps streaming. The recording scripts use `waitUntil: 'load'` which handles this correctly. No action needed.

---

**Scroll animations don't trigger — content stays invisible**

You (or the AI) used `whileInView` instead of `useScrollReveal`. Replace all `whileInView` usage. See the [Critical Animation Rules](#️-critical-animation-rules) section.

---

**`npm run check` shows ❌ for a package**

Run `npm install` again. If it still fails:
```bash
rm -rf node_modules package-lock.json
npm install
```

---

**Page looks broken on mobile**

Check that every section uses responsive Tailwind classes (`md:`, `lg:` prefixes) and that images use `sizes` prop correctly on `next/image`.

---

## 📄 License

MIT — free to use, modify, and distribute for any purpose.

---

<div align="center">

**Built with** [Claude Code](https://claude.ai/code) · [Next.js](https://nextjs.org) · [Tailwind CSS](https://tailwindcss.com) · [Framer Motion](https://framer.motion.com)

If this project helped you, consider giving it a ⭐

</div>
