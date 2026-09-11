/**
 * Prepara gli asset MediaPipe locali in public/mediapipe/ (serviti da Vite e
 * impacchettati nell'APK): l'app non dipende da CDN e funziona offline.
 *
 * - wasm: copiato da node_modules/@mediapipe/tasks-vision/wasm (stessa versione della libreria JS)
 * - modelli .task: scaricati una volta sola da storage.googleapis.com
 *
 * Uso: node scripts/fetch-models.mjs [--heavy]
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const wasmSrc = join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const outDir = join(root, 'public', 'mediapipe');
const wasmOut = join(outDir, 'wasm');
const modelsOut = join(outDir, 'models');

const MODEL_BASE = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker';
const models = ['lite', 'full'];
if (process.argv.includes('--heavy')) models.push('heavy');

mkdirSync(wasmOut, { recursive: true });
mkdirSync(modelsOut, { recursive: true });

if (!existsSync(wasmSrc)) {
  console.warn('[fetch-models] @mediapipe/tasks-vision non installato: salto la copia del wasm');
} else {
  for (const file of readdirSync(wasmSrc)) {
    copyFileSync(join(wasmSrc, file), join(wasmOut, file));
  }
  console.log(`[fetch-models] wasm copiato in ${wasmOut}`);
}

for (const model of models) {
  const target = join(modelsOut, `pose_landmarker_${model}.task`);
  if (existsSync(target) && statSync(target).size > 0) {
    console.log(`[fetch-models] ${model}: già presente`);
    continue;
  }
  const url = `${MODEL_BASE}/pose_landmarker_${model}/float16/latest/pose_landmarker_${model}.task`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    writeFileSync(target, Buffer.from(await res.arrayBuffer()));
    console.log(`[fetch-models] ${model}: scaricato (${(statSync(target).size / 1e6).toFixed(1)} MB)`);
  } catch (err) {
    // Non bloccare npm install offline: l'app segnalerà l'asset mancante all'avvio.
    console.warn(`[fetch-models] ${model}: download fallito (${err.message}) — rilanciare "npm run fetch-models"`);
  }
}
