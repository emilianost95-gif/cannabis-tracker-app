/**
 * Textos en español latinoamericano. Para añadir un idioma, crear un módulo
 * con la misma forma (`typeof es`) y seleccionarlo en `i18n/index.ts`.
 */
import type { Context, Currency, ExpenseCategory, GoalType, Method, Unit } from '@/domain/model';
import type { GoalStatus } from '@/domain/goals';

export const es = {
  locale: 'es-CL',
  methods: {
    flower_smoked: 'Flor fumada',
    flower_vaporized: 'Flor vaporizada',
    vape_cartridge: 'Vaporizador de cartucho',
    edible: 'Comestible',
    concentrate: 'Concentrado o extracto',
    tincture: 'Aceite o tintura',
    other: 'Otro',
  } satisfies Record<Method, string>,
  units: {
    g: { short: 'g', one: 'gramo', many: 'gramos' },
    joint: { short: 'porros', one: 'porro', many: 'porros' },
    puff: { short: 'caladas', one: 'calada', many: 'caladas' },
    mg_thc: { short: 'mg THC', one: 'mg de THC declarado', many: 'mg de THC declarados' },
    piece: { short: 'unid.', one: 'unidad (comestible)', many: 'unidades' },
    ml: { short: 'ml', one: 'mililitro', many: 'mililitros' },
    drop: { short: 'gotas', one: 'gota', many: 'gotas' },
  } satisfies Record<Unit, { short: string; one: string; many: string }>,
  contexts: {
    social: 'Social',
    relax: 'Relajarme',
    stress: 'Estrés o ansiedad',
    sleep: 'Para dormir',
    boredom: 'Aburrimiento',
    creative: 'Actividad creativa',
    discomfort: 'Malestar físico',
    habit: 'Costumbre',
    celebration: 'Celebración',
    other: 'Otro',
  } satisfies Record<Context, string>,
  expenseCategories: {
    product: 'Producto',
    accessory: 'Accesorios',
    other: 'Otro',
  } satisfies Record<ExpenseCategory, string>,
  currencies: {
    CLP: 'Peso chileno (CLP)',
    ARS: 'Peso argentino (ARS)',
    USD: 'Dólar estadounidense (USD)',
    EUR: 'Euro (EUR)',
    MXN: 'Peso mexicano (MXN)',
    UYU: 'Peso uruguayo (UYU)',
    COP: 'Peso colombiano (COP)',
    PEN: 'Sol peruano (PEN)',
    BRL: 'Real brasileño (BRL)',
  } satisfies Record<Currency, string>,
  goalTypes: {
    reduce_frequency: { title: 'Reducir la frecuencia', hint: 'Un máximo de sesiones por semana.' },
    spending_limit: { title: 'Límite de gasto', hint: 'Un tope de gasto real por semana o por mes.' },
    free_days: { title: 'Días sin consumo', hint: 'Un mínimo de días sin consumo registrado por semana.' },
    pause: { title: 'Hacer una pausa', hint: 'Ningún consumo entre dos fechas que elijas.' },
    daily_log: { title: 'Registro diario', hint: 'Anotar algo (consumo o registro personal) varios días por semana.' },
    observe: { title: 'Observar mis hábitos', hint: 'Registrar durante unas semanas, sin meta de cantidad.' },
  } satisfies Record<GoalType, { title: string; hint: string }>,
  goalStatus: {
    met: 'Cumplido',
    not_met: 'No cumplido',
    in_progress: 'En curso',
    paused: 'En pausa',
    not_started: 'Aún no empieza',
  } satisfies Record<GoalStatus, string>,
  scales: {
    mood: ['Muy bajo', 'Bajo', 'Neutral', 'Bueno', 'Muy bueno'],
    stress: ['Muy bajo', 'Bajo', 'Medio', 'Alto', 'Muy alto'],
    sleep: ['Muy malo', 'Malo', 'Regular', 'Bueno', 'Muy bueno'],
    craving: ['Nada', 'Poco', 'Moderado', 'Bastante', 'Mucho'],
    effect: ['Mal', 'Regular', 'Bien', 'Muy bien', 'Excelente'],
  },
} as const;

export type Dictionary = typeof es;
