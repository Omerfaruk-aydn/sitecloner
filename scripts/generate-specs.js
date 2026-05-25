#!/usr/bin/env node
'use strict';
/**
 * generate-specs.js — Recon çıktısından otomatik spec üretici
 * Kullanım: node scripts/generate-specs.js
 * Okur: docs/research/recon-report.json
 * Çıktı: docs/specs/{section-name}.md
 */

const fs = require('fs');
const path = require('path');

const REPORT_PATH = path.resolve('docs/research/recon-report.json');
if (!fs.existsSync(REPORT_PATH)) {
  console.error('❌ recon-report.json bulunamadı. Önce: node scripts/recon.js <url>');
  process.exit(1);
}

const report = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));
const SPECS_DIR = path.resolve('docs/specs');
fs.mkdirSync(SPECS_DIR, { recursive: true });

function slugify(text) {
  return (text || 'section').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function getSectionName(section) {
  if (section.id) return section.id;
  if (section.classes) {
    const meaningful = section.classes.split(' ').find(c =>
      c.match(/hero|banner|nav|header|footer|about|service|feature|team|testimonial|gallery|portfolio|blog|faq|contact|cta|pricing|section/i)
    );
    if (meaningful) return meaningful;
  }
  return section.tag.toLowerCase();
}

function generateSpec(section, index, report) {
  const name = getSectionName(section);
  const sectionTitle = name.charAt(0).toUpperCase() + name.slice(1);
  const topColors = report.tokens.colors.slice(0, 6).join(', ') || 'tespit edilmedi';
  const topFonts = report.tokens.fonts.slice(0, 3).map(f => f.family).join(', ') || 'tespit edilmedi';

  return `# ${sectionTitle} — Komponent Spec

## 1. Genel Bakış
- Amaç: ${section.text ? section.text.slice(0, 80) : 'Tespit edilmedi'}
- Konum: ${index === 0 ? 'İlk section (üst)' : index < 3 ? 'Üst bölge' : 'Orta/alt bölge'}
- Tam yükseklik: ${section.height}px (desktop) / tahmin: ${Math.round(section.height * 0.8)}px (tablet) / ${Math.round(section.height * 0.6)}px (mobile)
- Arka plan: ${section.hasVideo ? 'Video arka plan' : 'Renk/görsel'}
- Özel: ${[
    section.hasVideo && 'Video',
    section.hasCanvas && 'Canvas/WebGL',
    section.hasSVG && 'SVG animasyon',
    section.hasSlider && 'Slider/Carousel',
    section.hasForm && 'Form',
  ].filter(Boolean).join(', ') || 'Yok'}

## 2. HTML Yapısı
\`\`\`html
<${section.tag.toLowerCase()}${section.id ? ` id="${section.id}"` : ''}${section.classes ? ` class="${section.classes}"` : ''}>
  <!-- ${section.children} alt element -->
</${section.tag.toLowerCase()}>
\`\`\`

## 3. Exact CSS Değerleri (Computed)
### Container
- Tespit edilen yükseklik: ${section.height}px
- Alt element sayısı: ${section.children}

### Typography (Siteden tespit edilen fontlar)
- font-family: ${topFonts}
- Renkler: ${topColors}

### Butonlar / Linkler
- transition: ${report.tokens.transitions[0] || 'all 0.3s ease'}
- border-radius: ${report.tokens.radii[0] || '4px'}
- box-shadow: ${report.tokens.shadows[0] || 'none'}

## 4. Animasyonlar
${report.tokens.animations.length > 0
  ? report.tokens.animations.slice(0, 3).map(a => `### ${a.name}
- Trigger      : sayfa yükü / scroll
- Eleman       : ${a.el}
- Süre         : ${a.duration}
- Easing       : ${a.easing}
- Delay        : ${a.delay}
- Tekrar       : ${a.iteration}
- Framer Motion karşılığı:
  \`\`\`typescript
  initial={{ opacity: 0, y: 24 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
  \`\`\``).join('\n\n')
  : '- Tespit edilen animasyon yok (CSS animasyon veya JS ile yapılmış olabilir)'}

## 5. Hover / Focus / Active Durumları
(interactions-map.json'dan al — tahmin etme)

## 6. Responsive Davranış
### Desktop → Tablet (768px breakpoint)
- Layout değişimi bekleniyor

### Tablet → Mobile (390px breakpoint)
- Stack layout, font küçülmesi

## 7. Slider / Carousel
${section.hasSlider
  ? `- Slider tespit edildi
- Kütüphane    : Tespit edilmedi (recon ile kontrol et)
- React karşılığı: Embla Carousel önerilir`
  : '- Slider yok'}

## 8. Özel Davranışlar
- Video arka plan: ${section.hasVideo ? 'Evet' : 'Hayır'}
- Canvas/WebGL  : ${section.hasCanvas ? 'Evet' : 'Hayır'}
- Form          : ${section.hasForm ? 'Evet' : 'Hayır'}

## 9. Kullanılacak Dosyalar
- Görseller : /public/images/
- Fontlar   : /public/fonts/
- Videolar  : /public/videos/
- İkonlar   : src/components/icons.tsx

## 10. React Komponent Yapısı
\`\`\`typescript
// src/components/sections/${sectionTitle}Section.tsx

interface ${sectionTitle}SectionProps {
  // Gerekli props recon verilerine göre doldurulur
}

export function ${sectionTitle}Section(_props: ${sectionTitle}SectionProps) {
  return (
    <section>
      {/* ${sectionTitle} içeriği */}
    </section>
  );
}
\`\`\`
`;
}

async function main() {
  console.log('\n📋 Spec yazımı başlıyor...\n');

  const { sections } = report.structure;
  let written = 0;

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const name = getSectionName(section);
    const slug = `${String(i + 1).padStart(2, '0')}-${slugify(name)}`;
    const specPath = path.join(SPECS_DIR, `${slug}.md`);
    const content = generateSpec(section, i, report);
    fs.writeFileSync(specPath, content, 'utf8');
    console.log(`  ✅ docs/specs/${slug}.md`);
    written++;
  }

  console.log(`\n📋 ${written} spec dosyası yazıldı\n`);
}

main().catch(err => { console.error('❌ Spec üretim hatası:', err.message); process.exit(1); });
