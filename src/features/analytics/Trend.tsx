import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import type { PeriodComparison } from '@/domain/analytics';
import { formatPeriod, plural } from '@/i18n';

/**
 * Comparación de sesiones entre dos períodos, en texto + icono (nunca solo color).
 * El tono es neutro: describe el cambio sin juzgarlo.
 */
export function TrendLine({ c }: { c: PeriodComparison }) {
  if (!c.previousComparable) {
    return (
      <p className="text-sm text-fg-muted">
        Sin datos suficientes para comparar con {formatPeriod(c.range.previous)}: empezaste a registrar después.
      </p>
    );
  }
  const Icon = c.delta < 0 ? TrendingDown : c.delta > 0 ? TrendingUp : Minus;
  const text =
    c.delta === 0
      ? 'La misma cantidad de sesiones que'
      : `${plural(Math.abs(c.delta), 'sesión', 'sesiones')} ${c.delta < 0 ? 'menos' : 'más'} que`;
  return (
    <p className="flex items-start gap-2 text-sm text-fg">
      <Icon aria-hidden size={18} className={c.delta < 0 ? 'mt-px shrink-0 text-accent' : 'mt-px shrink-0 text-fg-muted'} />
      <span>
        {text} en {formatPeriod(c.range.previous)}{' '}
        <span className="num text-fg-muted">
          ({c.current} frente a {c.previous})
        </span>
      </span>
    </p>
  );
}
