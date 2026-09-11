import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Shell Android: la build web (dist/) gira nella WebView di sistema, servita da
 * https://localhost (contesto sicuro: getUserMedia funziona). Gli asset MediaPipe
 * sono in dist/mediapipe: l'APK funziona offline.
 */
const config: CapacitorConfig = {
  appId: 'com.cleanrep.app',
  appName: 'CleanRep',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
