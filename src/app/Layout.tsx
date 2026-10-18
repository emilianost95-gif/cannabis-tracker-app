import { useEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  ChartColumn,
  CirclePlus,
  History,
  House,
  NotebookPen,
  Settings,
  FlaskConical,
  ShieldCheck,
  Target,
  TriangleAlert,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { useData } from '@/state/DataContext';
import { Banner, Button, Spinner, cx } from '@/components/ui';
import { Logo } from '@/components/brand';
import { useToast } from '@/components/Toast';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

const PRIMARY: NavItem[] = [
  { to: '/', label: 'Inicio', icon: House, end: true },
  { to: '/historial', label: 'Historial', icon: History },
  { to: '/registrar', label: 'Registrar', icon: CirclePlus },
  { to: '/estadisticas', label: 'Estadísticas', icon: ChartColumn },
  { to: '/objetivos', label: 'Objetivos', icon: Target },
];
const SECONDARY: NavItem[] = [
  { to: '/diario', label: 'Registro personal', icon: NotebookPen },
  { to: '/gastos', label: 'Gastos', icon: Wallet },
  { to: '/ajustes', label: 'Ajustes y datos', icon: Settings },
];

function SideLink({ item }: { item: NavItem }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cx(
          'flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-sm transition-colors',
          isActive ? 'bg-surface-3 text-fg' : 'text-fg-muted hover:bg-surface-2 hover:text-fg',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon aria-hidden size={18} className={isActive ? 'text-accent' : undefined} />
          {item.label}
        </>
      )}
    </NavLink>
  );
}

export function Layout() {
  const { status, storage, mode, exitDemo } = useData();
  const toast = useToast();
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const first = useRef(true);

  // Al cambiar de pantalla: volver arriba y mover el foco al contenido (lectores de pantalla).
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    window.scrollTo({ top: 0 });
    mainRef.current?.focus({ preventScroll: true });
  }, [location.pathname]);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15rem_1fr]">
      <a
        href="#contenido"
        className="sr-only z-[70] rounded bg-accent px-3 py-2 text-accent-ink focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Saltar al contenido
      </a>

      {/* Barra lateral (escritorio) */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-border bg-[rgb(18_20_23/0.6)] px-3 py-5 lg:flex">
        <div className="px-2 pb-6">
          <Logo />
        </div>
        <nav aria-label="Principal" className="flex flex-col gap-0.5">
          {PRIMARY.map((i) => (
            <SideLink key={i.to} item={i} />
          ))}
          <div className="my-3 h-px bg-border" />
          {SECONDARY.map((i) => (
            <SideLink key={i.to} item={i} />
          ))}
        </nav>
        <div className="mt-auto flex items-start gap-2 rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2.5 text-xs text-fg-muted">
          <ShieldCheck aria-hidden size={16} className="mt-0.5 shrink-0 text-accent" />
          <span>
            {storage.kind === 'memory'
              ? 'Modo temporal: los datos no se guardan al cerrar.'
              : 'Tus datos se guardan solo en este navegador. Sin cuenta, sin servidor.'}
          </span>
        </div>
      </aside>

      <div className="min-w-0">
        {/* Barra superior (móvil) */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-[rgb(11_12_14/0.85)] px-4 py-2.5 backdrop-blur lg:hidden">
          <Logo />
          <nav aria-label="Secundaria" className="flex items-center gap-1">
            {SECONDARY.map((i) => (
              <NavLink
                key={i.to}
                to={i.to}
                aria-label={i.label}
                title={i.label}
                className={({ isActive }) =>
                  cx(
                    'grid size-10 place-items-center rounded-[var(--radius-md)] transition-colors',
                    isActive ? 'bg-surface-3 text-accent' : 'text-fg-muted hover:bg-surface-2 hover:text-fg',
                  )
                }
              >
                <i.icon aria-hidden size={19} />
              </NavLink>
            ))}
          </nav>
        </header>

        <main
          id="contenido"
          ref={mainRef}
          tabIndex={-1}
          className="mx-auto w-full max-w-5xl px-4 pb-[calc(var(--nav-h)+env(safe-area-inset-bottom)+2rem)] pt-5 outline-none sm:px-6 lg:px-10 lg:pb-12 lg:pt-10"
        >
          {mode === 'demo' && (
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[rgb(111_214_236/0.35)] bg-cyan-soft px-3 py-2.5 text-sm" role="status">
              <span className="flex items-start gap-2 text-fg">
                <FlaskConical aria-hidden size={18} className="mt-0.5 shrink-0 text-cyan" />
                <span>
                  <strong className="font-semibold">Modo demo.</strong> Todo lo que ves son datos de ejemplo inventados, guardados aparte de
                  los tuyos. Probá lo que quieras.
                </span>
              </span>
              <Button
                size="sm"
                onClick={async () => {
                  await exitDemo();
                  toast('Saliste de la demo. Estos son tus datos reales.');
                }}
              >
                Salir de la demo
              </Button>
            </div>
          )}
          {(storage.error || storage.kind === 'memory') && (
            <div className="mb-5">
              <Banner tone="danger" icon={TriangleAlert} role="alert">
                <strong className="font-semibold">Almacenamiento no disponible.</strong>{' '}
                {storage.error ?? ''} Podés usar la app, pero los datos se perderán al cerrar o recargar. Exportá una copia
                antes de salir.
              </Banner>
            </div>
          )}
          {storage.skipped > 0 && (
            <div className="mb-5">
              <Banner tone="warn" icon={TriangleAlert}>
                {storage.skipped === 1 ? 'Un registro guardado no es válido' : `${storage.skipped} registros guardados no son válidos`} y
                no se muestra. No se borró nada.
              </Banner>
            </div>
          )}
          {status === 'loading' ? (
            <div className="py-20">
              <Spinner label="Abriendo tus datos" />
            </div>
          ) : (
            <Outlet />
          )}
        </main>

        {/* Navegación inferior (móvil) */}
        <nav
          aria-label="Principal"
          className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-[rgb(14_16_18/0.92)] pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
        >
          <ul className="mx-auto grid h-[var(--nav-h)] max-w-md grid-cols-5">
            {PRIMARY.map((i) => {
              const isAdd = i.to === '/registrar';
              return (
                <li key={i.to} className="flex">
                  <NavLink
                    to={i.to}
                    end={i.end}
                    className={({ isActive }) =>
                      cx(
                        'flex flex-1 flex-col items-center justify-center gap-1 text-[0.7rem] font-medium transition-colors',
                        isActive ? 'text-fg' : 'text-fg-subtle hover:text-fg',
                      )
                    }
                  >
                    {({ isActive }) =>
                      isAdd ? (
                        <>
                          <span className="grid h-8 w-12 place-items-center rounded-full bg-accent text-accent-ink">
                            <i.icon aria-hidden size={20} />
                          </span>
                          {i.label}
                        </>
                      ) : (
                        <>
                          <i.icon aria-hidden size={21} className={isActive ? 'text-accent' : undefined} />
                          {i.label}
                        </>
                      )
                    }
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </div>
  );
}
