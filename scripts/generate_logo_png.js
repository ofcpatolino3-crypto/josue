import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

async function generateImages() {
  // 1. Crisp Emblem Icon (400x400)
  const emblemSvg = `
  <svg width="400" height="400" viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg">
    <!-- Clean white circular backdrop -->
    <circle cx="200" cy="200" r="196" fill="#ffffff"/>
    
    <!-- Outer Navy Ring -->
    <path d="M200 24C102.8 24 24 102.8 24 200C24 297.2 102.8 376 200 376C297.2 376 376 297.2 376 200C376 102.8 297.2 24 200 24ZM200 324C131.6 324 76 268.4 76 200C76 131.6 131.6 76 200 76C268.4 76 324 131.6 324 200C324 268.4 268.4 324 200 324Z" fill="#0D1B3E"/>
    
    <!-- Center white circle -->
    <circle cx="200" cy="200" r="108" fill="#ffffff"/>
    
    <!-- Left Blue Book / Ribbon Wing -->
    <path d="M136 156L188 180V272L136 248V156Z" fill="#0077E6"/>
    
    <!-- Right Red Book / Ribbon Wing -->
    <path d="M212 180L264 156V248L212 272V180Z" fill="#E52320"/>
  </svg>
  `;

  const emblemBuffer = await sharp(Buffer.from(emblemSvg))
    .png({ quality: 100 })
    .toBuffer();

  fs.writeFileSync(path.join(process.cwd(), 'public', 'logo.png'), emblemBuffer);

  // 2. Full Header Banner (600x120) with dark navy background, gold accents, emblem and official text
  const bannerSvg = `
  <svg width="1200" height="240" viewBox="0 0 1200 240" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="1200" height="240" fill="#0F172A"/>
    
    <!-- Gold accent top & bottom line -->
    <line x1="0" y1="236" x2="1200" y2="236" stroke="#C9A227" stroke-width="8"/>

    <!-- Emblem Container -->
    <g transform="translate(60, 30)">
      <circle cx="90" cy="90" r="88" fill="#ffffff"/>
      <path d="M90 10C45.8 10 10 45.8 10 90C10 134.2 45.8 170 90 170C134.2 170 170 134.2 170 90C170 45.8 134.2 10 90 10ZM90 146C59.1 146 34 120.9 34 90C34 59.1 59.1 34 90 34C120.9 34 146 59.1 146 90C146 120.9 120.9 146 90 146Z" fill="#0D1B3E"/>
      <circle cx="90" cy="90" r="48" fill="#ffffff"/>
      <path d="M61 70L84 81V122L61 111V70Z" fill="#0077E6"/>
      <path d="M96 81L119 70V111L96 122V81Z" fill="#E52320"/>
    </g>

    <!-- Typography -->
    <text x="280" y="115" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-weight="900" font-size="64" fill="#EDE6D6" letter-spacing="4">PORTAL</text>
    <text x="282" y="165" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-weight="800" font-size="28" fill="#C9A227" letter-spacing="8">CONCURSOS E OAB</text>

    <!-- Right Badge -->
    <rect x="940" y="85" width="200" height="50" rx="25" fill="#1E293B" stroke="#334155" stroke-width="2"/>
    <text x="1040" y="116" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-weight="600" font-size="20" fill="#94A3B8" text-anchor="middle">Canal Oficial</text>
  </svg>
  `;

  const bannerBuffer = await sharp(Buffer.from(bannerSvg))
    .png({ quality: 100 })
    .toBuffer();

  fs.writeFileSync(path.join(process.cwd(), 'public', 'email_header_banner.png'), bannerBuffer);

  console.log('Images generated successfully!');
}

generateImages().catch(console.error);
