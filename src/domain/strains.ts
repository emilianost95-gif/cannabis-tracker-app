/**
 * Variedades: agrupación y resumen descriptivo. No hay rankings de "mejores"
 * ni recomendaciones: solo lo que usás y cómo dijiste que te cayó.
 */
import type { ConsumptionEntry } from './model';
import { normalize } from '@/utils/text';

/** Clave para agrupar «Amnesia», «amnesia » y «AMNESIA». */
export function strainKey(s: string): string {
  return normalize(s).trim().replace(/\s+/g, ' ');
}

export interface StrainSummary {
  /** Nombre como lo escribiste la última vez. */
  name: string;
  sessions: number;
  /** Sesiones con «¿cómo te cayó?» registrado. */
  rated: number;
  averageRating: number | null;
  lastUsed: string;
}

export function strainSummaries(entries: ConsumptionEntry[]): StrainSummary[] {
  const groups = new Map<string, { name: string; sessions: number; rated: number; sum: number; lastUsed: string }>();
  for (const e of entries) {
    if (!e.strain) continue;
    const k = strainKey(e.strain);
    const g = groups.get(k) ?? { name: e.strain, sessions: 0, rated: 0, sum: 0, lastUsed: e.occurredAt };
    g.sessions += 1;
    if (e.effectRating !== null) {
      g.rated += 1;
      g.sum += e.effectRating;
    }
    if (e.occurredAt >= g.lastUsed) {
      g.lastUsed = e.occurredAt;
      g.name = e.strain;
    }
    groups.set(k, g);
  }
  return [...groups.values()]
    .map((g) => ({
      name: g.name,
      sessions: g.sessions,
      rated: g.rated,
      averageRating: g.rated ? Math.round((g.sum / g.rated) * 10) / 10 : null,
      lastUsed: g.lastUsed,
    }))
    .sort((a, b) => b.sessions - a.sessions || b.lastUsed.localeCompare(a.lastUsed));
}

/** Nombres ya usados, los más frecuentes primero (para autocompletar). */
export function strainNames(entries: ConsumptionEntry[]): string[] {
  return strainSummaries(entries).map((s) => s.name);
}
