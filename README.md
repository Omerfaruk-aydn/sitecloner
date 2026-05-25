<div align="center">

# AI Website Cloner

**Turn any website into a pixel-perfect Next.js clone — automatically.**

Animations, hover effects, fonts, colors, videos, carousels — everything reproduced faithfully.

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green?logo=node.js)](https://nodejs.org)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue?logo=typescript)](https://typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38bdf8?logo=tailwindcss)](https://tailwindcss.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

https://github.com/Omerfaruk-aydn/sitecloner/raw/main/docs/qa/comparison.mp4

*Left: original website — Right: AI-generated clone*

</div>

---

## What Is This?

A scaffolded Next.js project + a set of automation scripts that work together with an AI coding assistant (Claude Code, Cursor, Aider, etc.) to clone any public website into clean, production-ready code.

**One command starts the whole pipeline:**

```
/clone-website https://target-site.com
```

The AI handles everything from there — analysis, asset downloading, spec generation, component building, and visual QA.

---

## How It Works

| Phase | What happens | Tool |
|-------|-------------|------|
| **1. Recon** | Extracts colors, fonts, CSS tokens, section structure, animations | Puppeteer |
| **2. Embed detection** | Finds Vimeo/YouTube iframes, HLS streams | Puppeteer |
| **3. Asset download** | Downloads images, fonts, videos (streams via yt-dlp) | Node.js + yt-dlp |
| **4. Spec generation** | Produces per-section Markdown specs with exact CSS values | Node.js |
| **5. Code generation** | Builds React components with animations and interactions | AI (Claude, GPT-4, etc.) |
| **6. Visual QA** | Checks for invisible sections, broken images, console errors | Puppeteer |
| **7. Comparison video** | Records original + clone side-by-side | Playwright + ffmpeg |

---

## Requirements

Before installing, make sure you have:

| Requirement | Version | Notes |
|-------------|---------|-------|
| [Node.js](https://nodejs.org) | 18+ | JavaScript runtime |
| [Python](https://python.org) | 3.8+ | Required for yt-dlp and ffmpeg |
| An AI coding assistant | — | Claude Code (recommended), Cursor, Aider, Codex CLI |

That's all you need manually. Everything else is installed automatically.

---

## Installation

### Step 1 — Clone the repository

```bash
git clone https://github.com/Omerfaruk-aydn/sitecloner.git
cd sitecloner
```

### Step 2 — Install npm packages

```bash
npm install
```

This installs Next.js, Framer Motion, Lenis, Embla Carousel, Puppeteer, Playwright, and all other dependencies.

### Step 3 — Install system tools

```bash
npm run setup
```

This automatically installs:
- **yt-dlp** — downloads Vimeo, YouTube, and HLS streaming videos
- **ffmpeg** — converts and merges video files
- **Playwright Chromium** — headless browser for recording

### Step 4 — Verify everything is ready

```bash
npm run check
```

You should see all green checkmarks. If anything is missing, the command tells you exactly how to fix it.

---

## Usage

### With Claude Code (recommended)

Open Claude Code in the project directory and run:

```
/clone-website https://target-site.com
```

Claude will ask 4 questions (quality level, pages to clone, framework preference, content handling), then run the full pipeline automatically.

### With other AI tools

The project includes config files for all major AI assistants:

| Tool | Config file | Command |
|------|------------|---------|
| **Claude Code** | `.claude/commands/clone-website.md` | `/clone-website <url>` |
| **Cursor** | `.cursorrules` | Describe the task in chat |
| **Aider** | `AGENTS.md` | `aider --message "clone https://..."` |
| **Codex CLI** | `AGENTS.md` | Describe the task in chat |
| **Gemini CLI** | `GEMINI.md` | Describe the task in chat |

---

## npm Scripts Reference

```bash
# Setup & verification
npm run setup          # Install yt-dlp, ffmpeg, Playwright browser
npm run check          # Verify all dependencies are installed

# Cloning pipeline (run in order)
npm run recon <url>            # Phase 1: Analyze the target site
npm run download-assets        # Phase 3: Download images, fonts, videos
npm run annotations            # Extract annotated screenshots
npm run animations             # Extract animation data
npm run interaction-map        # Map all interactive elements

# Development
npm run dev                    # Start Next.js dev server (localhost:3000)
npm run build                  # Production build
npm run lint                   # Run ESLint

# Quality assurance
npm run qa                     # Check clone for invisible sections, broken images, console errors
npm run diff                   # Pixel-level visual diff vs original

# Video recording
npm run record <url>           # Record the original site
npm run record:clone           # Record the clone (localhost:3000)
npm run comparison             # Merge into side-by-side comparison video

# Reset
npm run clone:reset            # Clean all generated files, start fresh
```

---

## Project Structure

```
ai-website-cloner/
│
├── .claude/
│   └── commands/
│       └── clone-website.md   ← /clone-website slash command definition
│
├── scripts/                   ← Automation scripts (run by AI automatically)
│   ├── recon.js               ← Site analysis: colors, fonts, CSS, sections
│   ├── download-assets.js     ← Image/font/video downloader (yt-dlp support)
│   ├── generate-specs.js      ← Per-section Markdown spec generator
│   ├── annotate-screenshots.js← Annotated section screenshots
│   ├── extract-animations.js  ← Animation & timing extraction
│   ├── interaction-map.js     ← Interactive element mapper
│   ├── record-site.js         ← Original site recorder (Playwright)
│   ├── record-clone.js        ← Clone recorder (Playwright)
│   ├── make-comparison.js     ← Side-by-side video generator (ffmpeg)
│   ├── qa-check.js            ← Visibility & error QA checker
│   ├── visual-diff.js         ← Pixel-level diff tool
│   ├── section-diff.js        ← Section-by-section comparison
│   ├── video-to-frames.js     ← Frame extractor for manual review
│   ├── setup-check.js         ← Dependency verifier
│   └── install-system-deps.js ← Automatic system tool installer
│
├── src/
│   ├── app/                   ← Next.js 15 App Router
│   │   ├── layout.tsx         ← Root layout with fonts and providers
│   │   ├── page.tsx           ← Home page (assembled sections)
│   │   └── globals.css        ← Design tokens, color variables, keyframes
│   │
│   ├── components/
│   │   ├── sections/          ← Cloned page sections (one file per section)
│   │   ├── icons.tsx          ← Extracted SVG icons as React components
│   │   └── providers/         ← Lenis smooth scroll provider
│   │
│   ├── hooks/
│   │   └── useScrollReveal.ts ← Lenis-compatible scroll animation hook
│   │
│   └── types/                 ← TypeScript interfaces for content structures
│
├── docs/                      ← Generated during cloning (git-ignored)
│   ├── research/              ← recon-report.json + section data
│   ├── specs/                 ← Per-section Markdown specs
│   ├── design-references/     ← Full-page screenshots (desktop/tablet/mobile)
│   └── qa/                    ← QA screenshots + comparison.mp4
│
├── public/                    ← Downloaded assets (git-ignored)
│   ├── images/
│   ├── fonts/
│   └── videos/
│
├── AGENTS.md                  ← Shared AI instructions (all tools)
├── CLAUDE.md                  ← Claude Code specific config
└── next.config.ts             ← Next.js config with image optimization
```

---

## Tech Stack

### Frontend (clone output)
| Library | Version | Purpose |
|---------|---------|---------|
| Next.js | 15 | App Router, image optimization, font loading |
| TypeScript | 5 | Strict type safety |
| Tailwind CSS | v4 | Utility-first styling |
| Framer Motion | 11 | Scroll animations, transitions |
| Lenis | 1.3 | Smooth scroll |
| Embla Carousel | 8 | Touch-friendly sliders |
| Lucide React | — | Icon library |
| shadcn/ui | — | Accessible UI primitives |

### Automation (scripts)
| Tool | Purpose |
|------|---------|
| Puppeteer | Headless Chrome for site analysis and QA |
| Playwright | Video recording and interaction testing |
| yt-dlp | Vimeo/YouTube/HLS video downloading |
| ffmpeg | Video conversion and comparison merging |
| pixelmatch + pngjs | Pixel-level visual diffing |
| sharp | Image processing |

---

## Animation Rules (Critical)

This project enforces strict animation patterns to ensure compatibility between **Lenis smooth scroll** and **Framer Motion**:

### ❌ Never use `whileInView`
```tsx
// BROKEN with Lenis — element stays invisible forever
<motion.div whileInView={{ opacity: 1 }} viewport={{ once: true }}>
```

### ✅ Always use `useScrollReveal`
```tsx
import { useScrollReveal } from '@/hooks/useScrollReveal';

const { ref, inView } = useScrollReveal();

<motion.div
  ref={ref}
  animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
  transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
>
```

This hook uses `react-intersection-observer` with `fallbackInView: true`, which works correctly regardless of scroll library.

---

## QA Checklist

Run after each section is built:

```bash
npm run qa
```

The QA script checks:
- [ ] No invisible sections (opacity: 0 stuck elements)
- [ ] No broken images (404s)
- [ ] No JavaScript console errors
- [ ] All sections have visible content
- [ ] Animations trigger correctly on scroll
- [ ] TypeScript compiles without errors (`npx tsc --noEmit`)

---

## Troubleshooting

**Video stays as `.webm` instead of converting to `.mp4`**
→ ffmpeg was installed via `imageio[ffmpeg]` and isn't in PATH. Run `npm run setup` again, then restart your terminal.

**`networkidle` timeout when recording**
→ Pages with video backgrounds never reach networkidle. The scripts use `waitUntil: 'load'` instead, which handles this correctly.

**Vimeo/YouTube videos download as empty files**
→ Make sure yt-dlp is installed: `pip install yt-dlp`. The recon script detects iframes automatically and stores embed URLs for yt-dlp to download.

**Scroll animations don't trigger (content stays invisible)**
→ You're using `whileInView` instead of `useScrollReveal`. See the Animation Rules section above.

**`npm run setup` fails**
→ Python must be installed and accessible as `python` in your terminal. Download from [python.org](https://python.org).

---

## License

MIT — free to use, modify, and distribute.

---

<div align="center">

Built with Claude Code · Next.js · Tailwind CSS · Framer Motion

</div>
