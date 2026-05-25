# AI Website Cloner — Agent Rehberi

Bu dosya Claude Code, Codex CLI, Gemini CLI, Aider ve
Cursor'un ortak kullandığı ana talimat belgesidir.

## Temel Görev
Kullanıcı /clone-website <url> yazdığında:
1. **ÖNCE** .claude/commands/clone-website.md'deki ADIM 0'ı uygula:
   kullanıcıya 4 soru sor (kalite, sayfa, framework, içerik) ve BEKLE.
2. Kullanıcı cevapladıktan sonra her fazı sırayla otomatik tamamla.
3. Fazlar sırasında kullanıcıdan hiçbir şey isteme.

## Teknoloji Stack
| Kategori      | Tercih                      | Alternatif       |
|---------------|-----------------------------|-----------------|
| Framework     | Next.js 15 App Router       | Vite + React    |
| Dil           | TypeScript strict            | —               |
| Stil          | Tailwind CSS v4              | —               |
| Animasyon     | Framer Motion 11             | CSS @keyframes  |
| Scroll Trigger| react-intersection-observer  | —               |
| Slider        | Embla Carousel               | —               |
| Smooth Scroll | Lenis                        | —               |
| Recon         | Puppeteer                    | —               |
| Video/States  | Playwright                   | —               |
| İkon          | Lucide React + custom SVG    | —               |
| UI Primitive  | shadcn/ui                    | —               |

---

## ⚠️ KRİTİK ANİMASYON KURALLARI — HİÇBİR ZAMAN İHLAL ETME

### Kural 1: Lenis ile whileInView KULLANMA
Projede Lenis smooth scroll varsa `framer-motion`'ın `whileInView` prop'u
IntersectionObserver'ı doğru tetiklemez → içerik görünmez olur.

❌ YASAK:
```tsx
<motion.div
  initial={{ opacity: 0 }}
  whileInView={{ opacity: 1 }}
  viewport={{ once: true }}
>
```

✅ ZORUNLU — useScrollReveal hook kullan:
```tsx
import { useScrollReveal } from '@/hooks/useScrollReveal';

const { ref, inView } = useScrollReveal();
<motion.div
  ref={ref}
  animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
  transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
>
```

### Kural 2: 'use client' Zorunlu
Framer Motion, useState, useEffect, useRef kullanan HER dosya
'use client' direktifi ile başlamalı.

❌ YASAK:
```tsx
import { motion } from 'framer-motion'; // server component'te
```

✅ ZORUNLU:
```tsx
'use client';
import { motion } from 'framer-motion';
```

### Kural 3: Animasyon Her Zaman İçeriği Gizlememeli
`initial={{ opacity: 0 }}` kullanıldığında eleman görünmez başlar.
IntersectionObserver tetiklenmezse içerik sonsuza kadar görünmez kalır.
Bu yüzden useScrollReveal hook'u her zaman kullan — direkt `animate` prop'una geçir.

### Kural 4: Tüm Butonlar Çalışmalı
Her buton/link bileşen yazıldıktan sonra şu kontrol yapılmalı:
- Tıklanınca görsel değişim var mı? (hover, active state)
- Açılır menü/dropdown varsa açılıp kapanıyor mu?
- Overlay/modal varsa backdrop click ile kapanıyor mu?

### Kural 5: Her Section Sonrası Görsel QA
Her section tamamlandıktan sonra:
```bash
node scripts/qa-check.js http://localhost:3000
```
Bu script scroll pozisyonlarında ekran görüntüsü alır ve boş bölüm var mı kontrol eder.

---

## Animasyon Kütüphane Dönüşüm Tablosu
| Orijinalde         | Klonda                              |
|--------------------|-------------------------------------|
| GSAP               | Framer Motion                       |
| GSAP ScrollTrigger | Framer Motion + useScrollReveal     |
| AOS                | Framer Motion + useScrollReveal     |
| ScrollReveal       | Framer Motion + useScrollReveal     |
| Lottie             | Lottie (koru)                       |
| CSS animation      | @keyframes birebir                  |
| Three.js           | Three.js (koru)                     |
| anime.js           | Framer Motion                       |

## GSAP Easing → Framer Motion Dönüşüm
| GSAP              | Framer Motion cubic-bezier              |
|-------------------|----------------------------------------|
| power2.out        | [0.16, 1, 0.3, 1]                      |
| power3.inOut      | [0.76, 0, 0.24, 1]                     |
| expo.out          | [0.19, 1, 0.22, 1]                     |
| elastic           | spring({ stiffness: 200, damping: 15}) |

---

## Standart Scroll Animasyon Şablonu

Her section bu pattern'ı kullanmalı:

```tsx
'use client';

import { motion } from 'framer-motion';
import { useScrollReveal } from '@/hooks/useScrollReveal';

const ease = [0.16, 1, 0.3, 1] as const;

export default function MySection() {
  const { ref, inView } = useScrollReveal();

  return (
    <section ref={ref}>
      <motion.h2
        animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
        transition={{ duration: 0.7, ease }}
      >
        Başlık
      </motion.h2>
      <motion.p
        animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
        transition={{ duration: 0.7, delay: 0.12, ease }}
      >
        Metin
      </motion.p>
    </section>
  );
}
```

---

## Standart İnteraktif Bileşen Şablonu (Dropdown/Overlay)

```tsx
'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

export default function InteractiveComponent() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button onClick={() => setOpen(v => !v)}>Aç</button>
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop — dışarı tıklayınca kapat */}
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <motion.div
              key="panel"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="absolute z-20"
            >
              İçerik
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
```

---

## Kod Kalite Standartları
- TypeScript strict: true — any tipi yasak
- Magic number yasak — hepsi CSS variable
- console.log yasak (development bile olsa)
- Inline style sadece gradient/mask gibi Tailwind'in yapamadığı durumlarda
- ESLint hata yasak — her section sonrası `npx tsc --noEmit` çalıştır
- Her komponent için interface tanımla
- Görsel için daima next/image kullan (fill + sizes prop zorunlu)
- Font için daima next/font/local kullan (CDN değil)
- SVG'leri daima inline yaz (img tag değil)
- Video: `<video autoPlay loop muted playsInline>` — tüm 4 attribute zorunlu

## QA Kontrol Listesi (Her Section Sonrası)
- [ ] `npx tsc --noEmit` → hata yok
- [ ] Tarayıcıda açık, konsol hatası yok
- [ ] Scroll ile o section'a git → içerik görünüyor mu?
- [ ] Animasyon tetikleniyor mu? (fade-in/slide-up)
- [ ] Butonlar tıklanabiliyor mu?
- [ ] Dropdown/overlay varsa → açılıp kapanıyor mu?
- [ ] Mobil görünümde kırık layout yok mu?
- [ ] Görsel dosyalar eksik değil (404 yok)

## Hata Yönetimi
Script hata verirse:
1. Hata mesajını oku
2. Sebebini tespit et
3. Sessizce alternatif dene
4. Kullanıcıyı rahatsız etme
5. Sadece ciddi, çözümsüz hatada bildir

## Dosya İsimlendirme
- Komponent: PascalCase (HeroSection.tsx)
- Hook: camelCase, use prefix (useScrollReveal.ts)
- Utility: camelCase (formatDate.ts)
- Tip: PascalCase, I prefix yok (SiteConfig.ts)
- CSS variable: kebab-case (--color-primary)

## Script Referans Tablosu (AI tarafından otomatik çalıştırılır)

Tüm scriptler AI tarafından çalıştırılır. Kullanıcı hiçbirini manuel çalıştırmaz.
Her scriptin çıktısını AI kendi Read tool ile okur ve kod yazarken kullanır.

| Script | Ne zaman çalıştırılır | Çıktı — AI bu dosyaları okur |
|--------|----------------------|------------------------------|
| `recon.js` | FAZ 1 başında | docs/research/recon-report.json |
| `annotate-screenshots.js` | FAZ 1 — recon'dan hemen sonra | docs/research/annotated/XX-annotated.png + XX-styles.json |
| `extract-animations.js` | FAZ 1 — annotate'ten sonra | docs/research/animations/animations.json + stagger.json |
| `interaction-map.js` | FAZ 1 — en son | docs/research/interactions/interaction-map.json + states/el-XX-grid.png |
| `record-site.js --full` | FAZ 2 | docs/recordings/desktop-*.mp4 |
| `video-to-frames.js` | FAZ 2 — record bittikten hemen sonra | docs/qa/frames/*/contact-sheet.png |
| `download-assets.js` | FAZ 3 | public/images/ public/fonts/ public/videos/ |
| `generate-specs.js` | FAZ 4 | docs/specs/ |
| `qa-check.js` | FAZ 5 — her section bittikten sonra | konsol raporu |
| `record-clone.js` | FAZ 6 — kod yazımı bittikten sonra | docs/qa/desktop.mp4 + mobile.mp4 |
| `video-to-frames.js` | FAZ 6 — record-clone'dan hemen sonra | docs/qa/frames/desktop/contact-sheet.png |
| `section-diff.js` | FAZ 6 — video izledikten sonra | docs/qa/diff/diff-report.json + XX-diff.png |
| `visual-diff.js` | FAZ 6 — son adım | docs/qa/ |

---

## Klonlama Fazları
1. FAZ 1 — Keşif ve Analiz (node scripts/recon.js)
2. FAZ 2 — Video Kayıt / Orijinal site (node scripts/record-site.js)
3. FAZ 3 — Interaction State (node scripts/record-interactions.js)
4. FAZ 4 — Asset İndirme (node scripts/download-assets.js)
5. FAZ 5 — Spec Yazımı (node scripts/generate-specs.js)
6. FAZ 6 — Kod Yazımı (AI tarafından manuel)
7. FAZ 7 — Visual QA:
   - Animasyon/görünürlük testi → node scripts/qa-check.js http://localhost:3000
   - Klon video kaydı (onay için) → node scripts/record-clone.js http://localhost:3000
   - Pixel diff → node scripts/visual-diff.js <orijinal-url>

### record-clone.js Ne Yapar?
Klon sitesini (localhost:3000) Playwright ile kayıt altına alır:
- Tüm sayfayı yavaş scroll (animasyonlar görünsün)
- Navbar menü açma/kapama
- Dil dropdown açma/kapama
- Carousel ilerletme
- Hover efektleri tarama
- Desktop (1440px) + Mobile (390px) — 2 ayrı video
- Çıktı: docs/qa/desktop.mp4 + docs/qa/mobile.mp4 (otomatik açılır)
