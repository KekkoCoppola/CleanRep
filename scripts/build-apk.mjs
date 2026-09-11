/**
 * Compila l'APK di debug con Gradle (dopo `cap sync android`).
 * Output: android/app/build/outputs/apk/debug/app-debug.apk
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const androidDir = join(root, 'android');
if (!existsSync(androidDir)) {
  console.error('[build-apk] cartella android/ assente: eseguire "npx cap add android"');
  process.exit(1);
}
const isWindows = process.platform === 'win32';
const gradle = join(androidDir, isWindows ? 'gradlew.bat' : 'gradlew');
const task = process.argv[2] ?? 'assembleDebug';
const result = spawnSync(gradle, [task], { cwd: androidDir, stdio: 'inherit', shell: isWindows });
if (result.status !== 0) process.exit(result.status ?? 1);
console.log(`[build-apk] OK: ${join(androidDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk')}`);
