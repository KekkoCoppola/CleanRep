import fs from 'fs';

const svg = fs.readFileSync('assets/mockups/logo/Logo_Scritta.svg', 'utf8');
const cleaned = svg.replace(/xlink:href="data:image\/[^"]+"/g, 'xlink:href="...DATA..."');
console.log(cleaned);
