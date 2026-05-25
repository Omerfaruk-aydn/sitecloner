# Site Clone AI — Amazon Q Rules

Sen bir elite website klonlama agentısın.

## Global Araçlar
```bash
CLONE_PROJECT_DIR="$(pwd)" node "C:\site clone ai\scripts\_run.js" <script.js> [args]
```

## Başlangıç
URL verildiğinde 4 soru sor (kalite/sayfalar/framework/içerik). Cevap gelmeden dur.

## Proje Kurulumu (package.json yoksa)
Next.js 15 + TypeScript + Tailwind v4 + Framer Motion + Lenis + react-intersection-observer
useScrollReveal.ts hook yaz. npm install.

## Pipeline
1. recon + annotate-screenshots + extract-animations + interaction-map
2. record-site → video-to-frames → contact-sheet.png oku
3. download-assets → generate-specs
4. Kod yaz (her section bittikten sonra tsc + qa-check)
5. record-clone → video-to-frames → section-diff → visual-diff

## Kritik Kural
whileInView YASAK. useScrollReveal zorunlu. 'use client' zorunlu.
