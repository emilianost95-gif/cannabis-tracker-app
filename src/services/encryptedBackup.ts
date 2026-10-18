/**
 * Copias de seguridad cifradas con contraseña.
 *
 * - Clave: PBKDF2-SHA-256 (600 000 iteraciones, sal aleatoria de 16 bytes).
 * - Cifrado: AES-GCM de 256 bits (IV aleatorio de 12 bytes). GCM autentica el
 *   contenido: una contraseña incorrecta o un archivo alterado no se descifran.
 * - Todo ocurre en el navegador (Web Crypto). La contraseña nunca se guarda.
 *
 * El contenido descifrado es exactamente el JSON de exportación normal, así
 * que pasa por la misma validación que cualquier importación.
 */
import { EXPORT_APP_ID } from '@/domain/model';

export const ENCRYPTED_TYPE = 'encrypted-backup';
export const DEFAULT_ITERATIONS = 600_000;
export const MIN_PASSWORD_LENGTH = 8;

export interface EncryptedBackup {
  app: typeof EXPORT_APP_ID;
  type: typeof ENCRYPTED_TYPE;
  version: 1;
  kdf: { name: 'PBKDF2'; hash: 'SHA-256'; iterations: number; salt: string };
  cipher: { name: 'AES-GCM'; iv: string };
  data: string;
}

const toB64 = (bytes: Uint8Array): string => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const fromB64 = (b64: string): Uint8Array<ArrayBuffer> => {
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};
const bytes = (n: number): Uint8Array<ArrayBuffer> => crypto.getRandomValues(new Uint8Array(new ArrayBuffer(n)));
const utf8 = (s: string): Uint8Array<ArrayBuffer> => {
  const enc = new TextEncoder().encode(s);
  const out = new Uint8Array(new ArrayBuffer(enc.length));
  out.set(enc);
  return out;
};

async function deriveKey(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', utf8(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, base, { name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt',
  ]);
}

export function validatePassword(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `Usá al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  return null;
}

export async function encryptBackup(plainJson: string, password: string, iterations = DEFAULT_ITERATIONS): Promise<string> {
  const err = validatePassword(password);
  if (err) throw new Error(err);
  const salt = bytes(16);
  const iv = bytes(12);
  const key = await deriveKey(password, salt, iterations);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, utf8(plainJson)));
  const file: EncryptedBackup = {
    app: EXPORT_APP_ID,
    type: ENCRYPTED_TYPE,
    version: 1,
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations, salt: toB64(salt) },
    cipher: { name: 'AES-GCM', iv: toB64(iv) },
    data: toB64(cipher),
  };
  return JSON.stringify(file);
}

/** ¿El texto es una copia cifrada de Fumómetro? (sin intentar descifrar) */
export function isEncryptedBackup(text: string): boolean {
  try {
    const v = JSON.parse(text) as Partial<EncryptedBackup>;
    return v?.type === ENCRYPTED_TYPE && typeof v.data === 'string';
  } catch {
    return false;
  }
}

export type DecryptResult = { ok: true; json: string } | { ok: false; error: string };

export async function decryptBackup(text: string, password: string): Promise<DecryptResult> {
  let f: EncryptedBackup;
  try {
    f = JSON.parse(text) as EncryptedBackup;
  } catch {
    return { ok: false, error: 'El archivo está dañado.' };
  }
  if (
    f?.type !== ENCRYPTED_TYPE ||
    f.version !== 1 ||
    f.kdf?.name !== 'PBKDF2' ||
    f.cipher?.name !== 'AES-GCM' ||
    typeof f.kdf.salt !== 'string' ||
    typeof f.cipher.iv !== 'string' ||
    typeof f.data !== 'string' ||
    !Number.isInteger(f.kdf.iterations) ||
    f.kdf.iterations < 100_000 ||
    f.kdf.iterations > 10_000_000
  ) {
    return { ok: false, error: 'El archivo no es una copia cifrada válida de Fumómetro.' };
  }
  try {
    const key = await deriveKey(password, fromB64(f.kdf.salt), f.kdf.iterations);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(f.cipher.iv) }, key, fromB64(f.data));
    return { ok: true, json: new TextDecoder().decode(plain) };
  } catch {
    return { ok: false, error: 'Contraseña incorrecta o archivo alterado.' };
  }
}

/**
 * Comparte el archivo con el menú nativo del celular (WhatsApp, AirDrop, mail…)
 * cuando el navegador lo permite. Devuelve false si hay que descargarlo.
 */
export async function shareFile(filename: string, content: string, mime: string): Promise<boolean> {
  const file = new File([content], filename, { type: mime });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (!nav.share || !nav.canShare?.({ files: [file] })) return false;
  try {
    await nav.share({ files: [file], title: filename });
    return true;
  } catch (err) {
    // Cancelar el menú no es un error.
    if (err instanceof Error && err.name === 'AbortError') return true;
    return false;
  }
}
