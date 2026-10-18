/**
 * Exportación (JSON completo, CSV del historial) e importación validada.
 * La importación nunca toca los datos existentes hasta que el archivo
 * completo pasó la validación y la persona lo confirmó.
 */
import { EXPORT_APP_ID, LEGACY_EXPORT_APP_IDS, SCHEMA_VERSION, exportFile, type AppData, type ExportFile } from '@/domain/model';
import { t } from '@/i18n';
import { isoToLocalInput } from '@/utils/dates';
import { MINOR_DIGITS } from '@/domain/money';

export const MAX_IMPORT_BYTES = 20 * 1024 * 1024;

export function buildExport(data: AppData, now: Date = new Date()): ExportFile {
  return {
    meta: {
      app: EXPORT_APP_ID,
      schemaVersion: SCHEMA_VERSION,
      exportedAt: now.toISOString(),
      counts: {
        consumption: data.consumption.length,
        checkins: data.checkins.length,
        expenses: data.expenses.length,
        goals: data.goals.length,
      },
    },
    preferences: data.preferences,
    consumption: [...data.consumption].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt)),
    checkins: [...data.checkins].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt)),
    expenses: [...data.expenses].sort((a, b) => a.date.localeCompare(b.date)),
    goals: data.goals,
  };
}

export function exportJson(data: AppData, now?: Date): string {
  return JSON.stringify(buildExport(data, now), null, 2);
}

export type ImportResult = { ok: true; data: AppData; file: ExportFile } | { ok: false; error: string; details: string[] };

/**
 * Lleva un archivo de una versión anterior del esquema a la actual.
 * Hoy solo existe la versión 1; aquí se encadenarán las migraciones futuras.
 */
function migrate(raw: Record<string, unknown>): Record<string, unknown> {
  return raw;
}

export function parseImport(text: string): ImportResult {
  if (text.length > MAX_IMPORT_BYTES) {
    return { ok: false, error: 'El archivo es demasiado grande para ser una copia de Fumómetro.', details: [] };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'El archivo no es un JSON válido o está dañado.', details: [] };
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, error: 'El archivo no tiene el formato de una copia de Fumómetro.', details: [] };
  }
  const meta = (raw as { meta?: { app?: unknown; schemaVersion?: unknown } }).meta;
  const knownApp = meta && (meta.app === EXPORT_APP_ID || (LEGACY_EXPORT_APP_IDS as readonly unknown[]).includes(meta.app));
  if (!meta || !knownApp) {
    return { ok: false, error: 'El archivo no es una copia de seguridad de Fumómetro.', details: [] };
  }
  if (typeof meta.schemaVersion === 'number' && meta.schemaVersion > SCHEMA_VERSION) {
    return {
      ok: false,
      error: 'La copia se creó con una versión más nueva de la aplicación. Actualizá la app antes de importarla.',
      details: [],
    };
  }
  const res = exportFile.safeParse(migrate(raw as Record<string, unknown>));
  if (!res.success) {
    const details = res.error.issues.slice(0, 5).map((i) => `${i.path.join('.') || 'archivo'}: ${i.message}`);
    return { ok: false, error: 'El archivo tiene datos inválidos. No se importó nada.', details };
  }
  const f = res.data;
  return {
    ok: true,
    file: f,
    data: { preferences: f.preferences, consumption: f.consumption, checkins: f.checkins, expenses: f.expenses, goals: f.goals },
  };
}

// ---------- CSV ----------

/**
 * Escapa una celda CSV. Además neutraliza la inyección de fórmulas en hojas de
 * cálculo anteponiendo un apóstrofo a valores que empiezan con = + - @ tab o CR.
 */
export function csvCell(v: string | number | null): string {
  if (v === null) return '';
  let s = String(v);
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",;\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

function minorToDecimal(amountMinor: number, digits: number): string {
  if (digits === 0) return String(amountMinor);
  const s = String(amountMinor).padStart(digits + 1, '0');
  return `${s.slice(0, -digits)}.${s.slice(-digits)}`;
}

export const CSV_HEADERS = [
  'id',
  'fecha_hora_local',
  'fecha_hora_utc',
  'formato',
  'cantidad',
  'unidad',
  'contexto',
  'animo_antes_1a5',
  'sueno_previo_1a5',
  'estres_1a5',
  'importe',
  'moneda',
  'tipo_importe',
  'variedad',
  'como_cayo_1a5',
  'notas',
] as const;

/** Historial de consumo en CSV (separador coma, UTF-8 con BOM para Excel). */
export function consumptionCsv(data: AppData): string {
  const rows = [...data.consumption]
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))
    .map((e) =>
      [
        e.id,
        isoToLocalInput(e.occurredAt).replace('T', ' '),
        e.occurredAt,
        t.methods[e.method],
        e.quantity ? e.quantity.value : null,
        e.quantity ? e.quantity.unit : null,
        e.context ? t.contexts[e.context] : null,
        e.moodBefore,
        e.sleepQuality,
        e.stress,
        e.cost ? minorToDecimal(e.cost.amountMinor, MINOR_DIGITS[e.cost.currency]) : null,
        e.cost ? e.cost.currency : null,
        e.cost ? (e.cost.kind === 'paid' ? 'pagado' : 'estimado') : null,
        e.strain,
        e.effectRating,
        e.notes || null,
      ]
        .map(csvCell)
        .join(','),
    );
  return '﻿' + [CSV_HEADERS.join(','), ...rows].join('\r\n') + '\r\n';
}

/** Dispara la descarga de un archivo generado localmente (sin red). */
export function downloadText(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Lee un archivo como texto (Blob.text o FileReader como respaldo). */
export function readFileText(f: Blob): Promise<string> {
  if (typeof f.text === 'function') return f.text();
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ''));
    r.onerror = () => reject(r.error ?? new Error('No se pudo leer el archivo'));
    r.readAsText(f);
  });
}
