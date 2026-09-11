import fs from 'fs';

const logoSvg = fs.readFileSync('assets/mockups/logo/Logo_Scritta.svg', 'utf8');
const match = logoSvg.match(/xlink:href="(data:image\/[^"]+)"/);
if (!match) {
  console.error('No image data found in Logo_Scritta.svg');
  process.exit(1);
}
const dataUri = match[1];

// We know the white R is located at x: 595, y: 387, w: 1083, h: 1114 in the 2000x2000 space.
// We create an SVG with viewBox="595 387 1083 1114" that uses the luminance mask from Logo_Scritta.svg
const standaloneSvg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="595 387 1083 1114">
  <defs>
    <filter id="r-luminance">
      <feColorMatrix type="matrix" values="0 0 0 0 1   0 0 0 0 1   0 0 0 0 1   0.2126 0.7152 0.0722 0 0"/>
    </filter>
    <mask id="r-mask">
      <image x="0" y="0" width="2000" height="2000" xlink:href="${dataUri}" filter="url(#r-luminance)" preserveAspectRatio="none"/>
    </mask>
  </defs>
  <rect x="595" y="387" width="1083" height="1114" fill="#ffffff" mask="url(#r-mask)"/>
</svg>`;

fs.writeFileSync('public/assets/logo/CleanRep_R.svg', standaloneSvg);
console.log('Created public/assets/logo/CleanRep_R.svg');
