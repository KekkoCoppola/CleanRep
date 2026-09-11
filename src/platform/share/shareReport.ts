import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export interface ShareableFile {
  fileName: string;
  content: string;
  mimeType: string;
  title: string;
  /** Testo di accompagnamento (anteprima nelle app di messaggistica). */
  text: string;
}

export type ShareOutcome = 'shared' | 'downloaded' | 'cancelled';

/**
 * Condivide un file generato dall'app.
 * - APK: lo scrive nella cache e apre il foglio di condivisione Android.
 * - Browser: Web Share con file se disponibile (Chrome Android), altrimenti download.
 */
export async function shareFile(file: ShareableFile): Promise<ShareOutcome> {
  if (Capacitor.isNativePlatform()) {
    const written = await Filesystem.writeFile({
      path: file.fileName,
      data: file.content,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    try {
      await Share.share({ title: file.title, text: file.text, files: [written.uri], dialogTitle: file.title });
      return 'shared';
    } catch {
      return 'cancelled';
    }
  }

  const blob = new Blob([file.content], { type: file.mimeType });
  const webFile = new File([blob], file.fileName, { type: file.mimeType });
  if (navigator.canShare?.({ files: [webFile] })) {
    try {
      await navigator.share({ title: file.title, text: file.text, files: [webFile] });
      return 'shared';
    } catch {
      return 'cancelled';
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded';
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
