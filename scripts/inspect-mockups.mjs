import fs from 'fs';
import path from 'path';

function inspect(name, filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  console.log(`=== ${name} ===`);
  console.log('File size:', content.length);
  
  const regex = /xlink:href="data:image\/(png|jpeg);base64,([^"]+)"/g;
  let match;
  let count = 0;
  const outDir = 'assets/mockups/extracted';
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  while ((match = regex.exec(content)) !== null) {
    const ext = match[1];
    const base64Data = match[2];
    const buf = Buffer.from(base64Data, 'base64');
    const outName = `${name}_img_${count}.${ext}`;
    const outPath = path.join(outDir, outName);
    fs.writeFileSync(outPath, buf);
    console.log(`Saved image ${count}: ${outPath} (${buf.length} bytes)`);
    count++;
  }
}

inspect('HomeRest', 'assets/mockups/HomeRest.svg');
inspect('HomeWork', 'assets/mockups/HomeWork.svg');
inspect('Logo_Scritta', 'assets/mockups/logo/Logo_Scritta.svg');
