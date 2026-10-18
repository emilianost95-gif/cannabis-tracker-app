/**
 * Modelo de datos de Fumómetro (versión de esquema 1).
 *
 * Los esquemas Zod son la única fuente de verdad: los tipos TypeScript se
 * infieren de ellos, y los mismos esquemas validan formularios, lectura de
 * IndexedDB e importaciones.
 */
import { z } from 'zod';

export const SCHEMA_VERSION = 1 as const;

// ---------- Primitivas ----------

/** Instante en ISO 8601 UTC, p. ej. 2026-10-18T14:03:00.000Z */
export const isoDateTime = z
  .string()
  .refine((s) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(s) && !Number.isNaN(Date.parse(s)), {
    message: 'Fecha y hora inválida',
  });

/** Fecha de calendario local, sin hora: YYYY-MM-DD */
export const localDate = z.string().refine(
  (s) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const [y, m, d] = s.split('-').map(Number) as [number, number, number];
    const dt = new Date(y, m - 1, d);
    return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
  },
  { message: 'Fecha inválida' },
);

export const id = z.string().min(8).max(64);

/** Escala 1–5 opcional (ánimo, estrés, sueño). null = no registrado. */
export const scale5 = z.number().int().min(1).max(5).nullable();
/** Deseo de consumir 0–4 (0 = nada). null = no registrado. */
export const craving = z.number().int().min(0).max(4).nullable();

export const CURRENCIES = ['CLP', 'ARS', 'USD', 'EUR', 'MXN', 'UYU', 'COP', 'PEN', 'BRL'] as const;
export const currency = z.enum(CURRENCIES);
export type Currency = z.infer<typeof currency>;

/**
 * Importe en unidades menores enteras (centavos; para CLP, pesos).
 * Nunca se usan flotantes para dinero.
 */
export const MAX_AMOUNT_MINOR = 100_000_000_000; // tope de cordura
export const money = z.object({
  amountMinor: z.number().int().min(0).max(MAX_AMOUNT_MINOR),
  currency,
});
export type Money = z.infer<typeof money>;

// ---------- Consumo ----------

export const METHODS = [
  'flower_smoked',
  'flower_vaporized',
  'vape_cartridge',
  'edible',
  'concentrate',
  'tincture',
  'other',
] as const;
export const method = z.enum(METHODS);
export type Method = z.infer<typeof method>;

export const UNITS = ['g', 'joint', 'puff', 'mg_thc', 'piece', 'ml', 'drop'] as const;
export const unit = z.enum(UNITS);
export type Unit = z.infer<typeof unit>;

/** Límite razonable por unidad para un único registro. */
export const UNIT_LIMITS: Record<Unit, number> = {
  g: 50,
  joint: 20,
  puff: 200,
  mg_thc: 2000,
  piece: 20,
  ml: 100,
  drop: 500,
};

export const quantity = z
  .object({
    value: z.number().positive(),
    unit,
  })
  .superRefine((q, ctx) => {
    if (q.value > UNIT_LIMITS[q.unit]) {
      ctx.addIssue({ code: 'custom', path: ['value'], message: `El máximo por registro es ${UNIT_LIMITS[q.unit]}` });
    }
    if (Math.abs(q.value * 1000 - Math.round(q.value * 1000)) > 1e-6) {
      ctx.addIssue({ code: 'custom', path: ['value'], message: 'Usá como máximo 3 decimales' });
    }
  });
export type Quantity = z.infer<typeof quantity>;

export const CONTEXTS = [
  'social',
  'relax',
  'stress',
  'sleep',
  'boredom',
  'creative',
  'discomfort',
  'habit',
  'celebration',
  'other',
] as const;
export const context = z.enum(CONTEXTS);
export type Context = z.infer<typeof context>;

/**
 * Coste asociado a una sesión.
 * - `paid`: dinero efectivamente pagado en el momento (cuenta como gasto real).
 * - `estimated`: valor estimado del producto usado según un precio de referencia
 *   (NO cuenta como gasto real: el gasto real ya se registró al comprar).
 */
export const sessionCost = money.extend({ kind: z.enum(['paid', 'estimated']) });
export type SessionCost = z.infer<typeof sessionCost>;

export const NOTES_MAX = 1000;

export const consumptionEntry = z.object({
  id,
  schemaVersion: z.literal(SCHEMA_VERSION),
  occurredAt: isoDateTime,
  method,
  quantity: quantity.nullable(),
  context: context.nullable(),
  moodBefore: scale5,
  sleepQuality: scale5,
  stress: scale5,
  cost: sessionCost.nullable(),
  notes: z.string().max(NOTES_MAX),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});
export type ConsumptionEntry = z.infer<typeof consumptionEntry>;

// ---------- Registro personal (check-in) ----------

export const moodCheckIn = z
  .object({
    id,
    schemaVersion: z.literal(SCHEMA_VERSION),
    occurredAt: isoDateTime,
    mood: scale5,
    stress: scale5,
    sleep: scale5,
    craving,
    reason: context.nullable(),
    notes: z.string().max(NOTES_MAX),
    createdAt: isoDateTime,
    updatedAt: isoDateTime,
  })
  .refine(
    (c) =>
      c.mood !== null ||
      c.stress !== null ||
      c.sleep !== null ||
      c.craving !== null ||
      c.reason !== null ||
      c.notes.trim() !== '',
    { message: 'Completá al menos un campo' },
  );
export type MoodCheckIn = z.infer<typeof moodCheckIn>;

// ---------- Gastos ----------

export const EXPENSE_CATEGORIES = ['product', 'accessory', 'other'] as const;
export const expenseEntry = z.object({
  id,
  schemaVersion: z.literal(SCHEMA_VERSION),
  date: localDate,
  amount: money.refine((m) => m.amountMinor > 0, { message: 'El importe debe ser mayor que cero' }),
  category: z.enum(EXPENSE_CATEGORIES),
  quantity: quantity.nullable(),
  notes: z.string().max(NOTES_MAX),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});
export type ExpenseEntry = z.infer<typeof expenseEntry>;
export type ExpenseCategory = ExpenseEntry['category'];

// ---------- Objetivos ----------

const goalBase = z.object({
  id,
  schemaVersion: z.literal(SCHEMA_VERSION),
  title: z.string().trim().min(1).max(80),
  startDate: localDate,
  endDate: localDate.nullable(),
  status: z.enum(['active', 'paused']),
  /** Intervalos en pausa (fechas locales). `to: null` = sigue en pausa. */
  pausedIntervals: z.array(z.object({ from: localDate, to: localDate.nullable() })),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

export const goalTarget = z.discriminatedUnion('type', [
  /** Máximo de sesiones por semana. */
  z.object({ type: z.literal('reduce_frequency'), maxSessionsPerWeek: z.number().int().min(0).max(100) }),
  /** Gasto real máximo por semana o mes, en una moneda. */
  z.object({
    type: z.literal('spending_limit'),
    period: z.enum(['week', 'month']),
    limit: money,
  }),
  /** Mínimo de días sin consumo registrado por semana. */
  z.object({ type: z.literal('free_days'), minFreeDaysPerWeek: z.number().int().min(1).max(7) }),
  /** Pausa: ninguna sesión entre startDate y endDate (obligatoria). */
  z.object({ type: z.literal('pause') }),
  /** Días por semana con al menos un registro (consumo o registro personal). */
  z.object({ type: z.literal('daily_log'), minLoggedDaysPerWeek: z.number().int().min(1).max(7) }),
  /** Observar hábitos durante N semanas, sin meta de cantidad. */
  z.object({ type: z.literal('observe'), weeks: z.number().int().min(1).max(52) }),
]);
export type GoalTarget = z.infer<typeof goalTarget>;
export type GoalType = GoalTarget['type'];

export const personalGoal = goalBase
  .extend({ target: goalTarget })
  .refine((g) => g.endDate === null || g.endDate >= g.startDate, {
    message: 'La fecha de fin debe ser posterior al inicio',
    path: ['endDate'],
  })
  .refine((g) => g.target.type !== 'pause' || g.endDate !== null, {
    message: 'Una pausa necesita fecha de fin',
    path: ['endDate'],
  });
export type PersonalGoal = z.infer<typeof personalGoal>;

// ---------- Preferencias ----------

export const referencePrice = z.object({
  unit,
  /** Precio pagado por `perQuantity` unidades. */
  price: money,
  perQuantity: z.number().positive().max(1000),
});
export type ReferencePrice = z.infer<typeof referencePrice>;

export const OPTIONAL_FIELDS = ['context', 'moodBefore', 'sleepQuality', 'stress', 'cost', 'notes'] as const;
export type OptionalField = (typeof OPTIONAL_FIELDS)[number];

export const userPreferences = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  displayName: z.string().trim().max(40),
  currency,
  defaultMethod: method,
  defaultUnit: unit.nullable(),
  enabledFields: z.object({
    context: z.boolean(),
    moodBefore: z.boolean(),
    sleepQuality: z.boolean(),
    stress: z.boolean(),
    cost: z.boolean(),
    notes: z.boolean(),
  }),
  referencePrices: z.array(referencePrice).max(UNITS.length),
  budgets: z.object({
    weekly: money.nullable(),
    monthly: money.nullable(),
  }),
  nextAction: z.string().trim().max(140),
  updatedAt: isoDateTime,
});
export type UserPreferences = z.infer<typeof userPreferences>;

export function defaultPreferences(now: Date = new Date()): UserPreferences {
  return {
    schemaVersion: SCHEMA_VERSION,
    displayName: '',
    currency: 'CLP',
    defaultMethod: 'flower_smoked',
    defaultUnit: null,
    enabledFields: { context: true, moodBefore: true, sleepQuality: true, stress: true, cost: true, notes: true },
    referencePrices: [],
    budgets: { weekly: null, monthly: null },
    nextAction: '',
    updatedAt: now.toISOString(),
  };
}

// ---------- Exportación ----------

export const EXPORT_APP_ID = 'fumometro';
/** Copias creadas cuando la app se llamaba «Ritmo»: mismo esquema, se aceptan al importar. */
export const LEGACY_EXPORT_APP_IDS = ['ritmo'] as const;

export const dataExportMetadata = z.object({
  app: z.union([z.literal(EXPORT_APP_ID), z.literal('ritmo')]),
  schemaVersion: z.number().int().min(1),
  exportedAt: isoDateTime,
  counts: z.object({
    consumption: z.number().int().min(0),
    checkins: z.number().int().min(0),
    expenses: z.number().int().min(0),
    goals: z.number().int().min(0),
  }),
});
export type DataExportMetadata = z.infer<typeof dataExportMetadata>;

const uniqueIds = <T extends { id: string }>(items: T[]) => new Set(items.map((i) => i.id)).size === items.length;

export const exportFile = z
  .object({
    meta: dataExportMetadata,
    preferences: userPreferences,
    consumption: z.array(consumptionEntry).refine(uniqueIds, 'Hay registros de consumo con id duplicado'),
    checkins: z.array(moodCheckIn).refine(uniqueIds, 'Hay registros personales con id duplicado'),
    expenses: z.array(expenseEntry).refine(uniqueIds, 'Hay gastos con id duplicado'),
    goals: z.array(personalGoal).refine(uniqueIds, 'Hay objetivos con id duplicado'),
  })
  .superRefine((f, ctx) => {
    const pairs: [keyof DataExportMetadata['counts'], number][] = [
      ['consumption', f.consumption.length],
      ['checkins', f.checkins.length],
      ['expenses', f.expenses.length],
      ['goals', f.goals.length],
    ];
    for (const [k, n] of pairs) {
      if (f.meta.counts[k] !== n) {
        ctx.addIssue({ code: 'custom', path: ['meta', 'counts', k], message: 'El archivo parece incompleto o alterado' });
      }
    }
  });
export type ExportFile = z.infer<typeof exportFile>;

export interface AppData {
  preferences: UserPreferences;
  consumption: ConsumptionEntry[];
  checkins: MoodCheckIn[];
  expenses: ExpenseEntry[];
  goals: PersonalGoal[];
}
