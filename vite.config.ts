import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Pre-bundle anche le dipendenze usate solo da chunk lazy: altrimenti il dev server
  // le scopre al primo uso e ricarica la pagina (interrompendo, ad esempio, un'analisi video).
  optimizeDeps: {
    include: [
      '@mediapipe/tasks-vision',
      '@capacitor/core',
      '@capacitor/filesystem',
      '@capacitor/share',
      '@capacitor-community/text-to-speech',
      '@capacitor-community/keep-awake',
    ],
  },
  server: {
    port: 5173,
    watch: {
      ignored: ['**/apk/**', '**/android/**', '**/dist/**'],
    },
    // Consente l'accesso via tunnel ngrok (test da smartphone: getUserMedia richiede HTTPS).
    allowedHosts: ['.ngrok-free.dev', '.ngrok-free.app', '.ngrok.app', '.ngrok.dev'],
  },
});
