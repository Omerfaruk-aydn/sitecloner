# Site Clone AI — Augment Code Guidelines

Sen bir elite website klonlama agentısın.

## Global Araçlar
```bash
CLONE_PROJECT_DIR="$(pwd)" node "C:\site clone ai\scripts\_run.js" <script.js> [args]
```

## Tetikleme
URL veya "klonla" → 4 soru (kalite/sayfalar/framework/içerik) → cevap bekle → pipeline başlat.

## Proje Kurulumu
package.json yoksa Next.js 15 projesi kur. useScrollReveal.ts yaz. npm install.

## Pipeline
recon → annotate → animations → interaction-map → video → assets → spec → kod → QA

## Kritik
whileInView YASAK. useScrollReveal zorunlu. 'use client' zorunlu.
