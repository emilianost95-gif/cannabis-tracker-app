/**
 * Identidad de Fumómetro: logo (velocímetro con aguja-hoja) y Humito, la
 * mascota de humo. Todo en SVG en línea: sin imágenes externas ni peticiones.
 */
import { useId } from 'react';
import { cx } from './ui';

export const APP_NAME = 'Fumómetro';

/** Marca: arco de velocímetro, aguja con forma de hoja y una voluta de humo. */
export function LogoMark({ className = 'size-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <rect width="64" height="64" rx="15" fill="#15181c" stroke="#2a2e34" />
      {/* arco */}
      <path d="M13 43a19 19 0 0 1 38 0" fill="none" stroke="#2f343b" strokeWidth="5" strokeLinecap="round" />
      <path d="M13 43a19 19 0 0 1 27.5-17" fill="none" stroke="#b6f36a" strokeWidth="5" strokeLinecap="round" />
      {/* aguja-hoja */}
      <path d="M32 43 C33 35 37 29 43 25 C41 32 37 38 32 43Z" fill="#b6f36a" />
      <path d="M32 43 L42 26" stroke="#15181c" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="32" cy="43" r="3.4" fill="#eceef1" />
      {/* humo */}
      <path d="M47 18c2-2 1-4-1-5m4 1c1.5-1.8.8-3.6-.6-4.6" fill="none" stroke="#a7adb5" strokeWidth="1.8" strokeLinecap="round" opacity=".8" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark />
      <span className="font-display text-lg font-semibold tracking-tight text-fg">
        Fum<span className="text-accent">ó</span>metro
      </span>
    </span>
  );
}

export type HumitoMood = 'chill' | 'happy' | 'sleepy' | 'curious';

/**
 * Humito: una nube de humo relajada. Flota suavemente (sin animación si la
 * persona prefiere movimiento reducido). Decorativa: aria-hidden.
 */
export function Humito({ mood = 'chill', className = 'w-28', float = true }: { mood?: HumitoMood; className?: string; float?: boolean }) {
  const gid = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 140 120" className={cx(className, float && 'humito-float')} aria-hidden>
      <defs>
        <radialGradient id={`${gid}-body`} cx="45%" cy="35%" r="70%">
          <stop offset="0" stopColor="#f3f5f7" />
          <stop offset="1" stopColor="#b9c0c8" />
        </radialGradient>
      </defs>
      {/* estela de humo */}
      <path d="M70 104c-8 4-6 10 1 12m-14-11c-5 3-4 8 1 9" fill="none" stroke="#858c95" strokeWidth="3" strokeLinecap="round" opacity=".55" />
      {/* cuerpo: nube de círculos */}
      <g fill={`url(#${gid}-body)`}>
        <circle cx="44" cy="62" r="24" />
        <circle cx="70" cy="46" r="30" />
        <circle cx="98" cy="62" r="23" />
        <circle cx="58" cy="78" r="22" />
        <circle cx="86" cy="80" r="21" />
      </g>
      {/* cachetes */}
      <circle cx="52" cy="74" r="5" fill="#b6f36a" opacity=".35" />
      <circle cx="92" cy="74" r="5" fill="#b6f36a" opacity=".35" />
      {/* ojos */}
      {mood === 'chill' && (
        <g stroke="#1b1e22" strokeWidth="3.2" strokeLinecap="round" fill="none">
          <path d="M55 62h11" />
          <path d="M78 62h11" />
          <path d="M55 62c2 4 9 4 11 0M78 62c2 4 9 4 11 0" strokeWidth="2.4" />
        </g>
      )}
      {mood === 'happy' && (
        <g stroke="#1b1e22" strokeWidth="3.2" strokeLinecap="round" fill="none">
          <path d="M55 64c2-6 9-6 11 0" />
          <path d="M78 64c2-6 9-6 11 0" />
        </g>
      )}
      {mood === 'sleepy' && (
        <g stroke="#1b1e22" strokeWidth="3" strokeLinecap="round" fill="none">
          <path d="M55 63c3 3 8 3 11 0" />
          <path d="M78 63c3 3 8 3 11 0" />
        </g>
      )}
      {mood === 'curious' && (
        <g fill="#1b1e22">
          <circle cx="60" cy="61" r="4.5" />
          <circle cx="84" cy="61" r="4.5" />
          <circle cx="61.5" cy="59.5" r="1.4" fill="#fff" />
          <circle cx="85.5" cy="59.5" r="1.4" fill="#fff" />
        </g>
      )}
      {/* boca */}
      {mood === 'curious' ? (
        <circle cx="72" cy="74" r="3" fill="#1b1e22" />
      ) : (
        <path d="M66 73c3 4 9 4 12 0" stroke="#1b1e22" strokeWidth="3" strokeLinecap="round" fill="none" />
      )}
      {mood === 'sleepy' && (
        <g fill="#a7adb5" fontFamily="var(--font-display)" fontWeight="700">
          <text x="108" y="30" fontSize="14">z</text>
          <text x="118" y="18" fontSize="10">z</text>
        </g>
      )}
      {/* hojita en la cabeza */}
      <path d="M72 18c-1-6 3-11 9-12-1 6-4 10-9 12Z" fill="#b6f36a" />
      <path d="M72 18c2-4 5-7 8-10" stroke="#5f8f2a" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

/** Globo de diálogo de Humito: texto basado en datos reales, tono neutro. */
export function HumitoSays({ mood, children }: { mood?: HumitoMood; children: React.ReactNode }) {
  return (
    <div className="flex items-end gap-3">
      <Humito mood={mood} className="w-24 shrink-0 sm:w-28" />
      <div className="relative mb-4 rounded-[var(--radius-lg)] rounded-bl-sm border border-border-strong bg-surface-2 px-3.5 py-2.5 text-sm text-fg">
        {children}
      </div>
    </div>
  );
}

/** Volutas de humo decorativas para fondos de tarjetas destacadas. */
export function SmokeWisps({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 160" className={cx('pointer-events-none', className)} aria-hidden preserveAspectRatio="none">
      <g fill="none" stroke="#b6f36a" strokeLinecap="round" opacity=".05" strokeWidth="10">
        <path d="M-10 120c60-40 110 20 170-20s100-60 160-20 80 30 100 10" />
        <path d="M20 160c50-30 90 10 140-15s90-50 140-15" strokeWidth="6" />
      </g>
    </svg>
  );
}
