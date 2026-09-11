/**
 * Tiene lo schermo acceso durante l'allenamento (Screen Wake Lock API).
 * Il lock si perde quando la pagina va in background: lo si riprende al ritorno.
 */
export class ScreenWakeLock {
  private sentinel: WakeLockSentinel | null = null;
  private active = false;
  private readonly onVisibility = () => {
    if (this.active && document.visibilityState === 'visible') void this.acquire();
  };

  async enable(): Promise<void> {
    this.active = true;
    document.addEventListener('visibilitychange', this.onVisibility);
    await this.acquire();
  }

  disable(): void {
    this.active = false;
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
