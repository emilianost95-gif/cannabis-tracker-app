import { describe, expect, it } from 'vitest';
import { decryptBackup, encryptBackup, isEncryptedBackup, validatePassword } from './encryptedBackup';
import { exportJson, parseImport } from './exportImport';
import { testData, testEntry } from '../../tests/fixtures';

// Menos iteraciones solo para que las pruebas sean rápidas; el mínimo aceptado al descifrar es 100 000.
const IT = 100_000;
const json = exportJson(testData({ consumption: [testEntry('2026-10-12 21:00', { notes: 'nota secreta' })] }));

describe('copia cifrada', () => {
  it('ida y vuelta con la contraseña correcta', async () => {
    const enc = await encryptBackup(json, 'clave-larga-123', IT);
    expect(isEncryptedBackup(enc)).toBe(true);
    expect(enc).not.toContain('nota secreta');
    const dec = await decryptBackup(enc, 'clave-larga-123');
    expect(dec).toEqual({ ok: true, json });
    if (dec.ok) expect(parseImport(dec.json).ok).toBe(true);
  });

  it('contraseña incorrecta no descifra', async () => {
    const enc = await encryptBackup(json, 'clave-larga-123', IT);
    expect(await decryptBackup(enc, 'otra-clave-999')).toEqual({ ok: false, error: 'Contraseña incorrecta o archivo alterado.' });
  });

  it('detecta archivos alterados', async () => {
    const enc = JSON.parse(await encryptBackup(json, 'clave-larga-123', IT));
    const data = atob(enc.data);
    enc.data = btoa(String.fromCharCode(data.charCodeAt(0) ^ 1) + data.slice(1));
    expect((await decryptBackup(JSON.stringify(enc), 'clave-larga-123')).ok).toBe(false);
  });

  it('cada copia usa sal e IV distintos', async () => {
    const a = JSON.parse(await encryptBackup(json, 'clave-larga-123', IT));
    const b = JSON.parse(await encryptBackup(json, 'clave-larga-123', IT));
    expect(a.kdf.salt).not.toBe(b.kdf.salt);
    expect(a.cipher.iv).not.toBe(b.cipher.iv);
  });

  it('rechaza formatos inválidos y parámetros débiles', async () => {
    expect((await decryptBackup('{roto', 'x')).ok).toBe(false);
    const enc = JSON.parse(await encryptBackup(json, 'clave-larga-123', IT));
    enc.kdf.iterations = 1000;
    expect(await decryptBackup(JSON.stringify(enc), 'clave-larga-123')).toMatchObject({ ok: false, error: expect.stringContaining('no es una copia') });
    expect(isEncryptedBackup(json)).toBe(false);
  });

  it('exige contraseñas de al menos 8 caracteres', async () => {
    expect(validatePassword('corta')).not.toBeNull();
    expect(validatePassword('suficiente')).toBeNull();
    await expect(encryptBackup(json, 'corta', IT)).rejects.toThrow();
  });
});
