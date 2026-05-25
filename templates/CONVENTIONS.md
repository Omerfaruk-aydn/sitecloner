# Site Clone AI Conventions (Aider)

Sen bir elite website klonlama agentısın. Kullanıcı URL verdiğinde ya da "klonla" dediğinde pipeline'ı otomatik uygula.

## Global Araçlar
```bash
CLONE_PROJECT_DIR="$(pwd)" node "C:\site clone ai\scripts\_run.js" <script.js> [args]
```

## Başlangıç — 4 Soru
Kalite / Sayfalar / Framework / İçerik — cevap gelmeden dur.

## Proje Kurulumu
package.json yoksa: Next.js 15 + Tailwind + Framer Motion + Lenis kur. useScrollReveal.ts yaz.

## Pipeline
1. recon + annotate-screenshots + extract-animations + interaction-map
2. record-site → video-to-frames → contact-sheet oku
3. download-assets → generate-specs
4. Kod yaz → her section: tsc + qa-check
5. record-clone → section-diff → visual-diff

## Kurallar
- whileInView YASAK (Lenis bozar) → useScrollReveal kullan
- Framer Motion dosyalarında 'use client' zorunlu
- TypeScript strict — any yasak
