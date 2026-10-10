import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

/**
 * Filename from a `Content-Disposition` header (RFC 6266: `filename*=UTF-8''…` wins over
 * `filename="…"`). Path separators are stripped; `fallback` when absent or unusable.
 */
export function filenameFromContentDisposition(header: string | null | undefined, fallback: string): string {
  if (!header) {
    return fallback;
  }
  let name: string | null = null;
  const extended = /filename\*\s*=\s*([^']*)'[^']*'([^;]+)/i.exec(header);
  if (extended) {
    try {
      name = decodeURIComponent(extended[2].trim().replace(/^"|"$/g, ''));
    } catch {
      name = null;
    }
  }
  if (!name) {
    const plain = /filename\s*=\s*("([^"]*)"|[^;]+)/i.exec(header);
    name = plain ? (plain[2] ?? plain[1]).trim() : null;
  }
  return sanitizeFilename(name) ?? fallback;
}

/** Longest filename kept; longer ones are cut, keeping a short extension when there is one. */
export const MAX_FILENAME_LENGTH = 100;

/**
 * A filename safe to hand to the browser or the native filesystem: path separators become "_",
 * control characters are removed, "." / ".." and names without a letter or digit are rejected
 * (null), and the result is cut to {@link MAX_FILENAME_LENGTH} characters.
 */
export function sanitizeFilename(name: string | null | undefined): string | null {
  if (!name) {
    return null;
  }
  // eslint-disable-next-line no-control-regex
  let safe = name.replace(/[\\/]/g, '_').replace(/[\x00-\x1f\x7f]/g, '').trim();
  if (!safe || /^\.+$/.test(safe) || !/[A-Za-z0-9]/.test(safe)) {
    return null;
  }
  if (safe.length > MAX_FILENAME_LENGTH) {
    const dot = safe.lastIndexOf('.');
    const ext = dot > 0 && safe.length - dot <= 10 ? safe.slice(dot) : '';
    safe = safe.slice(0, MAX_FILENAME_LENGTH - ext.length) + ext;
  }
  return safe;
}

/** Cache subfolder for exported files shared from the Android app. */
const EXPORT_DIR = 'exports';

/** Base64 payload of a blob (without the `data:` prefix), for Capacitor Filesystem. */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** True when the user just dismissed the native share sheet (not a real failure). */
function isShareCancel(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /cancel/i.test(message);
}

/**
 * Hands a downloaded file to the user: a regular browser download on web; on the Android app
 * (WebViews ignore `download` links) it is written to the cache and opened in the share sheet.
 */
@Injectable({ providedIn: 'root' })
export class FileExportService {
  private readonly isNative = Capacitor.isNativePlatform();

  async save(blob: Blob, filename: string, shareTitle: string): Promise<void> {
    if (this.isNative) {
      await this.shareNative(blob, filename, shareTitle);
    } else {
      this.downloadWeb(blob, filename);
    }
  }

  private downloadWeb(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Give the browser time to start the download before releasing the blob.
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }

  private async shareNative(blob: Blob, filename: string, shareTitle: string): Promise<void> {
    const path = `${EXPORT_DIR}/${sanitizeFilename(filename) ?? 'pytra-export'}`;
    const { uri } = await Filesystem.writeFile({
      path,
      data: await blobToBase64(blob),
      directory: Directory.Cache,
      recursive: true,
    });
    try {
      await Share.share({ title: shareTitle, url: uri, dialogTitle: shareTitle });
    } catch (error) {
      if (!isShareCancel(error)) {
        throw error;
      }
    } finally {
      // The share sheet already handed the file over (or was dismissed): don't keep copies around.
      await Filesystem.deleteFile({ path, directory: Directory.Cache }).catch(() => undefined);
    }
  }
}
