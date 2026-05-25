---
description: Herhangi bir web sitesini pixel-perfect, animasyonlar ve hover efektleri dahil tamamen otomatik klonla.
argument-hint: "<url>"
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, WebFetch, Agent
---

# /clone-website $ARGUMENTS

Sen bir elite website reverse-engineering ve klonlama agent'sın.
Görevin: $ARGUMENTS adresindeki siteyi birebir, pixel-perfect,
animasyonlar ve interaktif davranışlar dahil Next.js ile yeniden oluşturmak.

## TEMEL KURALLAR
- Kullanıcıya HİÇBİR ZAMAN "şu komutu çalıştır" veya "şunu yap" DEME
- Scriptleri SEN çalıştırırsın, çıktıları SEN okursun, kodu SEN yazarsın
- Kullanıcıdan sadece FAZ başlangıcında (ADIM 0) bilgi istersin, sonra hiç sorma
- Hata olursa sessizce alternatif dene, sadece çözümsüz kritik hatada bildir

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## ADIM 0 — BAŞLANGIÇ: 4 SORU SOR VE BEKLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Kullanıcıya tam olarak bu mesajı gönder, hiçbir faz çalıştırma:**

---

🔍 **$ARGUMENTS** klonlanacak. Başlamadan önce 4 hızlı soru:

**1. Kalite?**
   **A** → Pixel-perfect (animasyonlar, hover, scroll efektleri dahil)
   **B** → High-fidelity (görsel aynı, animasyonlar basit)
   **C** → Structural (layout ve içerik, stil yaklaşık)

**2. Sayfalar?**
   **A** → Sadece ana sayfa
   **B** → Ana sayfa + iletişim + hakkımızda
   **C** → Tüm sayfalar

**3. Framework?**
   **A** → Next.js 15 App Router (önerilen)
   **B** → Vite + React

**4. İçerik?**
   **A** → Orijinali koru (metinler ve görseller birebir)
   **B** → Yapıyı koru, içeriği değiştir

*Örn: A A A A*

---

**⛔ KULLANICI CEVAPLAMADAN HİÇBİR FAZ ÇALIŞTIRMA.**

Kullanıcı cevapladıktan sonra:
1. Seçimleri kaydet → `docs/TARGET.md`
2. `✅ Anladım. Klonlama başlıyor...` de
3. FAZ 1'den itibaren otomatik ilerle, bir daha kullanıcıya sorma

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## FAZ 1 — KEŞİF VE ANALİZ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### 1a. Klasörleri oluştur
```bash
mkdir -p docs/research docs/research/annotated docs/research/animations docs/research/interactions/states docs/design-references docs/recordings docs/specs docs/qa/diff docs/qa/frames
```

### 1b. Dört analiz scriptini sırayla çalıştır
```bash
node scripts/recon.js "$ARGUMENTS"
```
```bash
node scripts/annotate-screenshots.js "$ARGUMENTS"
```
```bash
node scripts/extract-animations.js "$ARGUMENTS"
```
```bash
node scripts/interaction-map.js "$ARGUMENTS"
```

### 1c. Çıktıları oku ve bilgi çıkar — BU ADIMI ATLAMA

**Computed style değerleri:** `docs/research/annotated/00-full-styles.json`
→ Renk paletini, font ailelerini, font boyutlarını buradan al

**Section annotated PNG'leri:** `docs/research/annotated/XX-section-annotated.png`
→ Her section için Read tool ile PNG'yi aç, üzerindeki etiketleri incele
→ Renk, font-size, spacing değerleri doğrudan görüntü üzerinde yazıyor

**Animasyon verileri:** `docs/research/animations/animations.json`
→ Her animasyonun duration, easing (cubic-bezier), delay, keyframe değerleri burada
→ ASLA bu değerleri tahmin etme — JSON'dan doğrudan kullan

**Stagger grupları:** `docs/research/animations/stagger.json`
→ Sıralı animasyon gruplarının delay farkları burada

**Etkileşim haritası:** `docs/research/interactions/interaction-map.json`
→ Hangi buton/link ne yapıyor, overlay açıyor mu

**State grid PNG'leri:** `docs/research/interactions/states/el-XX-grid.png`
→ Her interaktif eleman için default|hover|active durumları yan yana
→ Bu PNG'leri Read tool ile aç, hover efektlerini birebir uygula

**Recon raporu:** `docs/research/recon-report.json`
→ Section listesi, font isimleri, GSAP/AOS/Lottie kullanımı, slider varlığı

### 1d. Kullanıcıya kısa özet ver
```
📊 Keşif Tamamlandı
   Bölümler  : [X] adet
   Animasyon : [kütüphane]  →  Framer Motion + useScrollReveal ile karşılık
   Renkler   : [ana renkler]
   Fontlar   : [font isimleri]
   Özel      : [slider / video / paralaks vb.]
   Etkileşim : [X] interaktif eleman, [Y] overlay
```

`docs/TARGET.md`'de FAZ 1 tamamlandı olarak işaretle.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## FAZ 2 — VİDEO KAYIT VE İZLEME
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### 2a. Orijinal siteyi kaydet
```bash
node scripts/record-site.js "$ARGUMENTS" --full --hover --slow
```

### 2b. Video'dan frame'leri çıkar ve izle
Kayıt biten dosyanın tam yolunu bul (`docs/recordings/desktop-*.mp4` veya `.webm`):
```bash
node scripts/video-to-frames.js docs/recordings/desktop-[timestamp].mp4 --fps 2
```

`docs/qa/frames/desktop-[timestamp]/contact-sheet.png` dosyasını **Read tool ile aç**:
- Hangi animasyonlar var? (fade, slide, scale, stagger)
- Scroll pozisyonlarında ne görünüyor?
- Slider/carousel nasıl davranıyor?
- Overlay/menü nasıl açılıp kapanıyor?
- Renk geçişleri, gradient'lar nasıl?

Bu gözlemleri not al — FAZ 6'da kod yazarken referans olarak kullanacaksın.

`docs/TARGET.md`'de FAZ 2 tamamlandı olarak işaretle.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## FAZ 3 — ASSET İNDİRME
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

```bash
node scripts/download-assets.js
```

Script `docs/research/recon-report.json`'dan asset listesini okur ve indirir:
- Fontlar → `public/fonts/`
- Görseller → `public/images/`
- Videolar → `public/videos/`

`docs/TARGET.md`'de FAZ 3 tamamlandı olarak işaretle.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## FAZ 4 — SPEC YAZIMI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

```bash
node scripts/generate-specs.js
```

Sonra FAZ 1'de okuduğun verilerle `docs/specs/` dosyalarını zenginleştir:
- Her section spec'ine exact CSS değerlerini yaz (annotated JSON'dan)
- Animasyon spec'ine exact duration/easing değerlerini yaz (animations.json'dan)
- Her interaktif elemana hover state bilgisini ekle (interaction-map.json'dan)

`docs/TARGET.md`'de FAZ 4 tamamlandı olarak işaretle.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## FAZ 5 — KOD YAZIMI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Bu sırayla, her birini bitirmeden diğerine geçme:

1. **globals.css** — FAZ 1'den gelen renk/font/spacing değerlerini CSS custom property olarak ekle:
```css
:root {
  --color-primary: #[hex];      /* annotated/00-full-styles.json'dan */
  --color-secondary: #[hex];
  --color-bg: #[hex];
  --color-text: #[hex];
  --font-heading: "[font]";
  --font-body: "[font]";
  --ease-smooth: cubic-bezier(0.16, 1, 0.3, 1);  /* animations.json'dan */
}
```

2. **layout.tsx** — next/font/local ile fontlar, doğru meta/lang

3. **Her section komponenti** — bu sırayla:
   - Navbar
   - Hero
   - Diğer section'lar (spec sırasıyla)
   - Footer

### Her section yazılırken zorunlu akış:

**a) Referansları oku:**
- `docs/research/annotated/XX-section-annotated.png` → Read tool ile aç
- `docs/research/annotated/XX-section-styles.json` → exact CSS değerleri
- `docs/research/interactions/states/el-XX-grid.png` → o section'daki butonların hover state'i

**b) Animasyon değerlerini al:**
- `docs/research/animations/animations.json` → duration, easing, delay
- `docs/research/animations/stagger.json` → sıralı animasyon delay'i
- ⚠️ ASLA tahmin etme — JSON'da yoksa video frame'lerine bak

**c) Kodu yaz — zorunlu kurallar:**

```tsx
'use client'; // Framer Motion kullanan HER dosyada zorunlu

import { motion } from 'framer-motion';
import { useScrollReveal } from '@/hooks/useScrollReveal'; // whileInView YASAK

const ease = [0.16, 1, 0.3, 1] as const; // veya animations.json'dan gelen değer

export default function MySection() {
  const { ref, inView } = useScrollReveal({ threshold: 0.1 });
  return (
    <section ref={ref}>
      <motion.h2
        animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
        transition={{ duration: 0.7, ease }} // duration: animations.json'dan
      />
    </section>
  );
}
```

**d) Section bittikten sonra QA:**
```bash
npx tsc --noEmit
node scripts/qa-check.js http://localhost:3000
```
→ Hata varsa düzelt, bir sonraki section'a geçme

### Animasyon kuralları

**❌ ASLA kullanma — Lenis ile çalışmaz:**
```tsx
<motion.div whileInView={{ opacity: 1 }} viewport={{ once: true }} />
```

**✅ Her zaman useScrollReveal kullan:**
```tsx
const { ref, inView } = useScrollReveal({ threshold: 0.1 });
<motion.div ref={ref} animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }} />
```

**Stagger animasyon:**
```tsx
const { ref, inView } = useScrollReveal({ threshold: 0.1 });
{items.map((item, i) => (
  <motion.div
    key={item.id}
    ref={i === 0 ? ref : undefined}
    animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
    transition={{ duration: 0.7, delay: i * 0.1, ease }} // stagger.json'dan delay
  />
))}
```

**İnteraktif bileşen (dropdown/overlay):**
```tsx
'use client';
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const [open, setOpen] = useState(false);
// ...
<AnimatePresence>
  {open && (
    <>
      <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
      <motion.div
        key="panel"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.2 }}
        className="absolute z-20"
      />
    </>
  )}
</AnimatePresence>
```

**GSAP easing → Framer Motion:**
| GSAP | Framer Motion |
|------|--------------|
| power2.out | [0.16, 1, 0.3, 1] |
| power3.inOut | [0.76, 0, 0.24, 1] |
| expo.out | [0.19, 1, 0.22, 1] |
| elastic | spring({ stiffness: 200, damping: 15 }) |

`docs/TARGET.md`'de FAZ 5 tamamlandı olarak işaretle.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## FAZ 6 — OTOMATİK VİSUAL QA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### 6a. TypeScript + ESLint + Build
```bash
npx tsc --noEmit
```
```bash
npx next lint
```
```bash
npm run build
```
Her biri hata verirse düzelt, devam et.

### 6b. Animasyon ve görünürlük testi
```bash
node scripts/qa-check.js http://localhost:3000
```
"BLANK SECTION" veya "INVISIBLE" çıkarsa:
→ O section'da `whileInView` var mı? → `useScrollReveal` ile değiştir
→ `'use client'` eksik mi? → Ekle

### 6c. Klon video kaydı ve izleme
```bash
node scripts/record-clone.js http://localhost:3000
```
```bash
node scripts/video-to-frames.js docs/qa/desktop.mp4 --fps 2
```

`docs/qa/frames/desktop/contact-sheet.png` dosyasını **Read tool ile aç**:
- Her section görünüyor mu?
- Scroll animasyonları tetikleniyor mu?
- Menü overlay açılıp kapanıyor mu?
- Carousel/slider çalışıyor mu?
- Hover efektleri var mı?

Sorun görürsen → ilgili komponenti aç, düzelt, tekrar kaydet.

### 6d. Section bazında orijinal vs klon karşılaştırması
```bash
node scripts/section-diff.js "$ARGUMENTS" http://localhost:3000
```

`docs/qa/diff/diff-report.json`'ı oku:
- Her section'ın fark yüzdesini gör
- %2 üzerindeki section'ların diff PNG'sini Read tool ile aç
- Kırmızı alan = fark olan pikseller

```bash
# Sorunlu section düzeltildikten sonra tekrar çalıştır:
node scripts/section-diff.js "$ARGUMENTS" http://localhost:3000
```

`docs/qa/diff/typography-diff.json` oku → font/renk farkları
`docs/qa/diff/color-diff.json` oku → klonda eksik renkler

### 6e. Pixel-level tam diff
```bash
node scripts/visual-diff.js "$ARGUMENTS"
```
→ Fark %2'den az → ✅
→ %2-5 → o section'ı düzelt
→ %5+ → section'ı baştan yaz

`docs/TARGET.md`'de FAZ 6 tamamlandı olarak işaretle.

### 6f. Kullanıcıya final rapor ver
```
╔══════════════════════════════════════════════╗
║     🎉 KLONLAMA TAMAMLANDI                  ║
╠══════════════════════════════════════════════╣
║ Site      : $ARGUMENTS                      ║
║ Bölümler  : [X] komponent                   ║
║ Pixel Fark: %[Y] (hedef: <%2)               ║
║ TypeScript: ✅ Hatasız                       ║
║ Build     : ✅ Başarılı                      ║
║ Animasyon : ✅ Tüm section'lar görünür       ║
╠══════════════════════════════════════════════╣
║ 🚀 http://localhost:3000                    ║
╠══════════════════════════════════════════════╣
║ 📁 Referans dosyalar                        ║
║ docs/research/annotated/   → Annotated ekranlar  ║
║ docs/research/animations/  → Animasyon verileri  ║
║ docs/research/interactions/→ Hover state grid'ler║
║ docs/qa/desktop.mp4        → Klon videosu        ║
║ docs/qa/diff/              → Section diff'leri   ║
╚══════════════════════════════════════════════╝
```
