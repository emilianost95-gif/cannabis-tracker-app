import {
  forwardRef,
  useId,
  type ButtonHTMLAttributes,
  type ComponentProps,
  type ReactElement,
  type ReactNode,
} from 'react';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { Humito, type HumitoMood } from './brand';

export function cx(...xs: (string | false | null | undefined)[]): string {
  return xs.filter(Boolean).join(' ');
}

// ---------- Botones ----------

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

const base =
  'inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] font-medium whitespace-nowrap select-none ' +
  'transition-[background,border-color,color,transform] duration-150 active:translate-y-px disabled:opacity-50 disabled:pointer-events-none';
const variants: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink hover:bg-accent-hover',
  secondary: 'bg-surface-2 text-fg border border-border-strong hover:bg-surface-3 hover:border-[#4a505a]',
  ghost: 'text-fg-muted hover:text-fg hover:bg-surface-2',
  danger: 'bg-danger-soft text-danger border border-[rgb(255_138_128/0.35)] hover:bg-[rgb(255_138_128/0.2)]',
};
const sizes: Record<Size, string> = {
  sm: 'min-h-9 px-3 text-sm',
  md: 'min-h-11 px-4 text-[0.95rem]',
};

export function buttonClass(variant: Variant = 'secondary', size: Size = 'md', extra?: string) {
  return cx(base, variants[variant], sizes[size], extra);
}

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; icon?: LucideIcon }
>(function Button({ variant = 'secondary', size = 'md', icon: Icon, className, children, type = 'button', ...rest }, ref) {
  return (
    <button ref={ref} type={type} className={buttonClass(variant, size, className)} {...rest}>
      {Icon && <Icon aria-hidden size={size === 'sm' ? 16 : 18} strokeWidth={2} />}
      {children}
    </button>
  );
});

export function LinkButton({
  variant = 'secondary',
  size = 'md',
  icon: Icon,
  className,
  children,
  ...rest
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size; icon?: LucideIcon }) {
  return (
    <Link className={buttonClass(variant, size, className)} {...rest}>
      {Icon && <Icon aria-hidden size={size === 'sm' ? 16 : 18} strokeWidth={2} />}
      {children}
    </Link>
  );
}

// ---------- Estructura ----------

export function PageHeader({
  title,
  description,
  actions,
  mood,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  /** Muestra a Humito junto al título. */
  mood?: HumitoMood;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="flex min-w-0 items-end gap-3">
        {mood && <Humito mood={mood} className="hidden w-16 shrink-0 sm:block" float={false} />}
        <div className="min-w-0">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-fg sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 max-w-prose text-sm text-fg-muted">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function Card({
  title,
  icon: Icon,
  action,
  children,
  className,
  as: As = 'section',
  ...rest
}: {
  title?: ReactNode;
  icon?: LucideIcon;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  as?: 'section' | 'div' | 'article';
} & Omit<ComponentProps<'section'>, 'title' | 'ref'>) {
  const headingId = useId();
  return (
    <As className={cx('card p-4 sm:p-5', className)} aria-labelledby={title ? headingId : undefined} {...rest}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && (
            <h2 id={headingId} className="flex items-center gap-2 text-sm font-semibold text-fg">
              {Icon && <Icon aria-hidden size={16} className="text-fg-subtle" />}
              {title}
            </h2>
          )}
          {action}
        </div>
      )}
      {children}
    </As>
  );
}

export function Stat({
  label,
  value,
  hint,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('min-w-0', className)}>
      <div className="text-xs text-fg-subtle">{label}</div>
      <div className="num mt-1 text-xl font-semibold tracking-tight text-fg sm:text-2xl">{value}</div>
      {hint && <div className="mt-1 text-xs text-fg-muted">{hint}</div>}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  mood,
  title,
  children,
  action,
  compact,
}: {
  icon?: LucideIcon;
  /** Humito en lugar del icono. */
  mood?: HumitoMood;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={cx('flex flex-col items-center text-center', compact ? 'py-6' : 'py-12')}>
      {mood ? (
        <Humito mood={mood} className={cx('mb-3', compact ? 'w-20' : 'w-28')} />
      ) : (
        Icon && (
          <div className="mb-4 grid size-12 place-items-center rounded-[var(--radius-lg)] border border-border bg-surface-2 text-accent">
            <Icon aria-hidden size={22} />
          </div>
        )
      )}
      <h3 className="font-display text-lg font-semibold text-fg">{title}</h3>
      {children && <div className="mt-1 max-w-sm text-sm text-fg-muted">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

const tones = {
  neutral: 'bg-surface-3 text-fg-muted border-border-strong',
  accent: 'bg-accent-soft text-accent border-[rgb(182_243_106/0.3)]',
  cyan: 'bg-cyan-soft text-cyan border-[rgb(111_214_236/0.3)]',
  warn: 'bg-warn-soft text-warn border-[rgb(240_195_90/0.3)]',
  danger: 'bg-danger-soft text-danger border-[rgb(255_138_128/0.3)]',
} as const;

export function Badge({
  tone = 'neutral',
  icon: Icon,
  children,
}: {
  tone?: keyof typeof tones;
  icon?: LucideIcon;
  children: ReactNode;
}) {
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium', tones[tone])}>
      {Icon && <Icon aria-hidden size={12} strokeWidth={2.5} />}
      {children}
    </span>
  );
}

export function Banner({
  tone = 'warn',
  icon: Icon,
  children,
  role = 'status',
}: {
  tone?: 'warn' | 'danger' | 'cyan' | 'accent';
  icon: LucideIcon;
  children: ReactNode;
  role?: 'status' | 'alert';
}) {
  return (
    <div role={role} className={cx('flex items-start gap-3 rounded-[var(--radius-md)] border px-3 py-2.5 text-sm', tones[tone])}>
      <Icon aria-hidden size={18} className="mt-0.5 shrink-0" />
      <div className="text-fg">{children}</div>
    </div>
  );
}

// ---------- Formularios ----------

export function Field({
  label,
  hint,
  error,
  optional,
  children,
}: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  optional?: boolean;
  children: (ids: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactElement;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errId = `${id}-err`;
  const describedBy = [hint ? hintId : null, error ? errId : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-fg">
        {label}
        {optional && <span className="ml-1.5 font-normal text-fg-subtle">(opcional)</span>}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint && !error && (
        <p id={hintId} className="text-xs text-fg-subtle">
          {hint}
        </p>
      )}
      {error && (
        <p id={errId} className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/** Grupo de opciones exclusivas accesible (radio nativo, estilo segmentado). */
export function Segmented<T extends string>({
  legend,
  value,
  options,
  onChange,
  name,
  hideLegend,
  size = 'md',
}: {
  legend: string;
  value: T | null;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  name?: string;
  hideLegend?: boolean;
  size?: 'sm' | 'md';
}) {
  const autoName = useId();
  return (
    <fieldset className="min-w-0">
      <legend className={hideLegend ? 'sr-only' : 'mb-1.5 text-sm font-medium text-fg'}>{legend}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <label
            key={o.value}
            className={cx(
              'relative cursor-pointer rounded-[var(--radius-md)] border text-sm transition-colors',
              'has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent',
              size === 'sm' ? 'px-2.5 py-1.5' : 'px-3 py-2',
              value === o.value
                ? 'border-[rgb(182_243_106/0.5)] bg-accent-soft text-fg'
                : 'border-border-strong bg-surface-2 text-fg-muted hover:text-fg',
            )}
          >
            <input
              type="radio"
              className="sr-only"
              name={name ?? autoName}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Escala 1–5 (o 0–4) opcional, con opción explícita "Sin dato". */
export function ScalePicker({
  legend,
  value,
  onChange,
  labels,
  min = 1,
}: {
  legend: string;
  value: number | null;
  onChange: (v: number | null) => void;
  labels: readonly string[];
  min?: 0 | 1;
}) {
  const name = useId();
  const opts = labels.map((l, i) => ({ v: i + min, l }));
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1.5 flex w-full items-center justify-between text-sm font-medium text-fg">
        <span>
          {legend} <span className="font-normal text-fg-subtle">(opcional)</span>
        </span>
      </legend>
      <div className="grid grid-cols-6 gap-1">
        <label
          className={cx(
            'flex cursor-pointer items-center justify-center rounded-[var(--radius-sm)] border px-1 py-2 text-xs transition-colors',
            'has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent',
            value === null ? 'border-border-strong bg-surface-3 text-fg' : 'border-border bg-surface-2 text-fg-subtle hover:text-fg',
          )}
        >
          <input type="radio" className="sr-only" name={name} checked={value === null} onChange={() => onChange(null)} />
          Sin dato
        </label>
        {opts.map((o) => (
          <label
            key={o.v}
            title={o.l}
            className={cx(
              'flex cursor-pointer flex-col items-center justify-center rounded-[var(--radius-sm)] border py-1.5 transition-colors',
              'has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent',
              value === o.v
                ? 'border-[rgb(182_243_106/0.5)] bg-accent-soft text-fg'
                : 'border-border bg-surface-2 text-fg-muted hover:text-fg',
            )}
          >
            <input
              type="radio"
              className="sr-only"
              name={name}
              value={o.v}
              checked={value === o.v}
              onChange={() => onChange(o.v)}
              aria-label={`${o.v}: ${o.l}`}
            />
            <span className="num text-sm font-semibold" aria-hidden>
              {o.v}
            </span>
          </label>
        ))}
      </div>
      <p className="mt-1 text-xs text-fg-subtle" aria-live="polite">
        {value === null ? 'Sin dato registrado' : `${value}: ${opts.find((o) => o.v === value)?.l ?? ''}`}
      </p>
    </fieldset>
  );
}

export function Spinner({ label = 'Cargando' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-3 text-sm text-fg-muted">
      <span className="size-4 animate-spin rounded-full border-2 border-border-strong border-t-accent motion-reduce:animate-none" />
      {label}…
    </div>
  );
}
