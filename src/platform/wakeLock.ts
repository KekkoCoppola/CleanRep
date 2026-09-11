import { KeepAwake } from '@capacitor-community/keep-awake';
import { Capacitor } from '@capacitor/core';

/**
 * Tiene lo schermo acceso durante l'allenamento: plugin nativo nell'APK,
 * Screen Wake Lock API nel browser (il lock si perde in background e lo si
 * riprende al ritorno).
 */
export class ScreenWakeLock {
  private sentinel: WakeLockSentinel | null = null;
  private active = false;
  private readonly onVisibility = () => {
    if (this.active && document.visibilityState === 'visible') void this.acquire();
  };

  async enable(): Promise<void> {
    this.active = true;
    if (Capacitor.isNativePlatform()) {
      await KeepAwake.keepAwake().catch(() => undefined);
      return;
    }
    document.addEventListener('visibilitychange', this.onVisibility);
    await this.acquire();
  }

  disable(): void {
    this.active = false;
    if (Capacitor.isNativePlatform()) {
      void KeepAwake.allowSleep().catch(() => undefined);
      return;
    }
    document.removeEventListener('visibilitychange', this.onVisibility);
    void this.sentinel?.release().catch(() => undefined);
    this.sentinel = null;
  }

  private async acquire(): Promise<void> {
    if (!('wakeLock' in navigator)) return;
    try {
      this.sentinel = await navigator.wakeLock.request('screen');
    } catch {
      // Non supportato o negato (es. batteria scarica): non è bloccante.
    }
  }
}
