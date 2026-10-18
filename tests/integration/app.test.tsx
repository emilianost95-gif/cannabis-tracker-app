/**
 * Flujos completos sobre la app real, con IndexedDB simulada (fake-indexeddb).
 * Cada prueba usa una base nueva; "recargar" = desmontar y volver a montar.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { IDBFactory } from 'fake-indexeddb';
import { AppRoutes } from '@/app/App';
import { DataProvider } from '@/state/DataContext';
import { ToastProvider } from '@/components/Toast';
import { exportJson, readFileText } from '@/services/exportImport';
import { testData, testEntry } from '../fixtures';
import { IndexedDbRepository } from '@/services/repository';

function renderApp(route = '/') {
  const user = userEvent.setup();
  const utils = render(
    <MemoryRouter initialEntries={[route]}>
      <ToastProvider>
        <DataProvider>
          <AppRoutes />
        </DataProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
  return { user, ...utils };
}

/** El layout tiene navegación lateral y barra inferior: tomamos el primer enlace. */
async function go(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getAllByRole('link', { name })[0]!);
}

async function registerEntry(user: ReturnType<typeof userEvent.setup>, opts: { qty?: string; notes?: string } = {}) {
  await go(user, 'Registrar');
  await screen.findByRole('heading', { name: 'Anotar sesión' });
  if (opts.qty) await user.type(screen.getByLabelText(/Cantidad/), opts.qty);
  if (opts.notes) await user.type(screen.getByLabelText(/Notas/), opts.notes);
  await user.click(screen.getByRole('button', { name: 'Guardar registro' }));
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('flujo principal', () => {
  it('muestra estados vacíos sin inventar datos', async () => {
    renderApp('/');
    expect(await screen.findByText('Todavía no hay humo por acá')).toBeInTheDocument();
    await go(userEvent.setup(), 'Estadísticas');
    expect(await screen.findByText('Aún no hay datos para analizar')).toBeInTheDocument();
  });

  it('registra un consumo, actualiza el panel y persiste al recargar', async () => {
    const { user, unmount } = renderApp('/');
    await screen.findByText('Todavía no hay humo por acá');
    await registerEntry(user, { qty: '0,5', notes: 'prueba integración' });

    // Vuelve al inicio con el panel actualizado.
    const today = await screen.findByRole('region', { name: 'Hoy' });
    expect(within(today).getByText('Sesiones').nextElementSibling).toHaveTextContent('1');
    expect(within(today).getByText(/0,5 g/)).toBeInTheDocument();

    unmount();
    const second = renderApp('/historial');
    expect(await screen.findByText('prueba integración')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Flor fumada a las/ })).toBeInTheDocument();
    second.unmount();
  });

  it('edita y elimina un registro; el historial refleja los cambios', async () => {
    const { user } = renderApp('/');
    await screen.findByText('Todavía no hay humo por acá');
    await registerEntry(user, { notes: 'original' });
    await screen.findByRole('region', { name: 'Hoy' });

    await go(user, 'Historial');
    await user.click(await screen.findByRole('link', { name: /Flor fumada a las .*ver detalle/ }));
    expect(await screen.findByText('original')).toBeInTheDocument();
    expect(screen.getAllByText('Sin dato').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('link', { name: 'Editar' }));
    const notes = await screen.findByLabelText(/Notas/);
    await user.clear(notes);
    await user.type(notes, 'editado');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    // Esperar a volver al detalle (la textarea del formulario también contiene el texto).
    await screen.findByRole('link', { name: 'Editar' });
    expect(screen.getByText('editado').tagName).toBe('P');

    await user.click(screen.getByRole('button', { name: 'Eliminar' }));
    const dialog = await screen.findByRole('dialog', { name: '¿Eliminar este registro?' });
    await user.click(within(dialog).getByRole('button', { name: 'Eliminar registro' }));
    expect(await screen.findByText('Todavía no hay humo registrado')).toBeInTheDocument();
  });

  it('cancelar la eliminación no borra nada', async () => {
    const { user } = renderApp('/');
    await screen.findByText('Todavía no hay humo por acá');
    await registerEntry(user, { notes: 'se queda' });
    await screen.findByRole('region', { name: 'Hoy' });
    await go(user, 'Historial');
    await user.click(await screen.findByRole('link', { name: /ver detalle/ }));
    await user.click(await screen.findByRole('button', { name: 'Eliminar' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('se queda')).toBeInTheDocument();
  });

  it('valida el formulario sin exigir campos emocionales', async () => {
    const { user } = renderApp('/registrar');
    await screen.findByRole('heading', { name: 'Anotar sesión' });
    await user.type(screen.getByLabelText(/Cantidad/), 'mucho');
    await user.click(screen.getByRole('button', { name: 'Guardar registro' }));
    expect(await screen.findByText(/Ingresá un número mayor que cero/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Cantidad/)).toHaveAttribute('aria-invalid', 'true');
  });

  it('avisa de posibles duplicados antes de guardar', async () => {
    const { user } = renderApp('/');
    await screen.findByText('Todavía no hay humo por acá');
    await registerEntry(user, { qty: '1' });
    await screen.findByRole('region', { name: 'Hoy' });
    await registerEntry(user, { qty: '1' });
    const dialog = await screen.findByRole('dialog', { name: '¿Es un registro repetido?' });
    await user.click(within(dialog).getByRole('button', { name: 'Guardar igual' }));
    const today = await screen.findByRole('region', { name: 'Hoy' });
    expect(within(today).getByText('Sesiones').nextElementSibling).toHaveTextContent('2');
  });

  it('las estadísticas se actualizan con los registros', async () => {
    const { user } = renderApp('/');
    await screen.findByText('Todavía no hay humo por acá');
    await registerEntry(user, { qty: '0,25' });
    await screen.findByRole('region', { name: 'Hoy' });
    await registerEntry(user, { qty: '3' }); // distinto: no es duplicado (cantidad diferente)
    await screen.findByRole('region', { name: 'Hoy' });
    await go(user, 'Estadísticas');
    const freq = await screen.findByRole('region', { name: 'Frecuencia' });
    expect(within(freq).getByText('Sesiones', { selector: 'div' }).nextElementSibling).toHaveTextContent('2');
    const qty = screen.getByRole('region', { name: 'Cantidades por unidad' });
    expect(within(qty).getByText('3,25', { selector: 'span' })).toBeInTheDocument();
    expect(within(qty).getByText('gramos', { selector: 'span' })).toBeInTheDocument();
  });
});

describe('datos: exportar, importar y eliminar', () => {
  it('exporta un JSON válido con los registros', async () => {
    let captured: Blob | null = null;
    // jsdom no implementa createObjectURL: lo definimos para poder espiarlo.
    URL.createObjectURL ??= (() => '') as typeof URL.createObjectURL;
    URL.revokeObjectURL ??= (() => undefined) as typeof URL.revokeObjectURL;
    vi.spyOn(URL, 'createObjectURL').mockImplementation((b: Blob | MediaSource) => {
      captured = b as Blob;
      return 'blob:test';
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    const { user } = renderApp('/');
    await screen.findByText('Todavía no hay humo por acá');
    await registerEntry(user, { notes: 'para exportar' });
    await screen.findByRole('region', { name: 'Hoy' });
    await go(user, 'Ajustes y datos');
    await user.click(await screen.findByRole('button', { name: 'Copia sin cifrar (JSON)' }));
    expect(captured).not.toBeNull();
    const json = JSON.parse(await readFileText(captured!));
    expect(json.meta).toMatchObject({ app: 'fumometro', schemaVersion: 1, counts: { consumption: 1 } });
    expect(json.consumption[0].notes).toBe('para exportar');
  });

  it('importa una copia válida tras confirmar', async () => {
    const { user } = renderApp('/ajustes');
    await screen.findByRole('heading', { name: 'Ajustes y datos' });
    const file = new File(
      [exportJson(testData({ consumption: [testEntry('2026-10-01 20:00', { notes: 'importado A' }), testEntry('2026-10-02 20:00', { notes: 'importado B' })] }))],
      'copia.json',
      { type: 'application/json' },
    );
    await user.upload(screen.getByTestId('import-file'), file);
    const dialog = await screen.findByRole('dialog', { name: '¿Reemplazar tus datos con esta copia?' });
    expect(within(dialog).getByText(/2 registros de consumo/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Reemplazar e importar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await go(user, 'Historial');
    expect(await screen.findByText('importado A')).toBeInTheDocument();
    expect(screen.getByText('importado B')).toBeInTheDocument();
  });

  it('rechaza una importación inválida sin perder los datos actuales', async () => {
    const repo = await IndexedDbRepository.open();
    await repo.put('consumption', testEntry('2026-10-01 20:00', { notes: 'dato existente' }));

    const { user } = renderApp('/ajustes');
    await screen.findByRole('heading', { name: 'Ajustes y datos' });
    const broken = JSON.parse(exportJson(testData({ consumption: [testEntry('2026-10-02 20:00')] })));
    broken.consumption[0].quantity = { value: 'mucho', unit: 'g' };
    await user.upload(screen.getByTestId('import-file'), new File([JSON.stringify(broken)], 'mala.json', { type: 'application/json' }));
    expect(await screen.findByText(/El archivo tiene datos inválidos. No se importó nada./)).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.upload(screen.getByTestId('import-file'), new File(['{ roto'], 'rota.json', { type: 'application/json' }));
    expect(await screen.findByText(/no es un JSON válido/)).toBeInTheDocument();

    await go(user, 'Historial');
    expect(await screen.findByText('dato existente')).toBeInTheDocument();
  });

  it('elimina todos los datos desde Ajustes (con confirmación explícita)', async () => {
    const repo = await IndexedDbRepository.open();
    await repo.put('consumption', testEntry('2026-10-01 20:00', { notes: 'a borrar' }));

    const { user, unmount } = renderApp('/ajustes');
    await screen.findByRole('heading', { name: 'Ajustes y datos' });
    await user.click(screen.getByRole('button', { name: 'Eliminar todos los datos' }));
    const dialog = await screen.findByRole('dialog', { name: '¿Eliminar todos los datos?' });
    const confirm = within(dialog).getByRole('button', { name: 'Eliminar todo' });
    expect(confirm).toBeDisabled();
    await user.click(within(dialog).getByRole('checkbox'));
    await user.click(confirm);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    unmount();
    renderApp('/historial');
    expect(await screen.findByText('Todavía no hay humo registrado')).toBeInTheDocument();
  });
});

describe('gastos y objetivos', () => {
  it('registra un gasto y lo refleja en el resumen', async () => {
    const { user } = renderApp('/gastos');
    await screen.findByRole('heading', { name: 'Gastos' });
    await user.click(screen.getAllByRole('button', { name: 'Agregar gasto' })[0]!);
    const form = await screen.findByRole('form', { name: 'Nuevo gasto' });
    await user.type(within(form).getByLabelText('Importe'), '20.000');
    await user.click(within(form).getByRole('button', { name: 'Guardar gasto' }));
    const summary = await screen.findByRole('region', { name: 'Resumen' });
    expect(within(summary).getByText('Hoy').nextElementSibling?.textContent).toMatch(/20\.000/);
  });

  it('crea, pausa y elimina un objetivo', async () => {
    const { user } = renderApp('/objetivos');
    await screen.findByText('Sin objetivos por ahora');
    await user.click(screen.getByRole('button', { name: 'Crear un objetivo' }));
    const form = await screen.findByRole('form', { name: 'Nuevo objetivo' });
    await user.click(within(form).getByRole('button', { name: 'Crear objetivo' }));
    expect(await screen.findByText('Como máximo 3 sesiones por semana')).toBeInTheDocument();
    expect(screen.getByText(/Esta semana: 0 de un máximo de 3 sesiones/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Pausar' }));
    expect(await screen.findByRole('button', { name: 'Reanudar' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Eliminar' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Eliminar objetivo' }));
    expect(await screen.findByText('Sin objetivos por ahora')).toBeInTheDocument();
  });
});

describe('modo demo', () => {
  beforeEach(() => {
    localStorage.removeItem('fumometro-mode');
  });

  it('el link /demo muestra datos de ejemplo marcados y no toca los datos reales', async () => {
    const repo = await IndexedDbRepository.open();
    await repo.put('consumption', testEntry('2026-10-01 20:00', { notes: 'mi dato real' }));

    const { user } = renderApp('/demo');
    expect(await screen.findByText(/Todo lo que ves son datos de ejemplo/)).toBeInTheDocument();
    expect(await screen.findByRole('region', { name: 'Fumómetro de la semana' })).toBeInTheDocument();

    // El historial muestra la demo, no el dato real.
    await go(user, 'Historial');
    await screen.findByRole('heading', { name: 'Historial' });
    expect(screen.queryByText('mi dato real')).not.toBeInTheDocument();

    // La base real sigue igual.
    expect((await repo.load()).data.consumption.map((e) => e.notes)).toEqual(['mi dato real']);

    // Salir vuelve a los datos reales y quita el aviso.
    await user.click(screen.getByRole('button', { name: 'Salir de la demo' }));
    expect(await screen.findByText('mi dato real')).toBeInTheDocument();
    expect(screen.queryByText(/Todo lo que ves son datos de ejemplo/)).not.toBeInTheDocument();
  });

  it('se puede abrir desde el inicio vacío', async () => {
    const { user } = renderApp('/');
    await screen.findByText('Todavía no hay humo por acá');
    await user.click(screen.getByRole('link', { name: 'Ver la demo' }));
    expect(await screen.findByText(/Todo lo que ves son datos de ejemplo/)).toBeInTheDocument();
    await go(user, 'Estadísticas');
    expect(await screen.findByRole('region', { name: 'Calendario de humo (últimas 12 semanas)' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Cómo lo consumís' })).toBeInTheDocument();
  });
});

describe('bienvenida', () => {
  it('aparece una sola vez y guarda nombre y moneda', async () => {
    localStorage.removeItem('fumometro-onboarded');
    const { user, unmount } = renderApp('/');
    expect(await screen.findByRole('heading', { name: 'Bienvenido al Fumómetro' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(await screen.findByRole('heading', { name: 'Lo tuyo queda acá' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Siguiente' }));
    await user.type(screen.getByLabelText(/¿Cómo te llamo\?/), 'Emi');
    await user.click(screen.getByLabelText('Pesos argentinos'));
    await user.click(screen.getByRole('button', { name: 'Anotar mi primera sesión' }));
    expect(await screen.findByRole('heading', { name: 'Anotar sesión' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '¿Cómo arrancamos?' })).not.toBeInTheDocument();
    unmount();

    const again = renderApp('/');
    expect(await screen.findByText(/Emi · ¿cómo viene la mano\?/)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Bienvenido al Fumómetro' })).not.toBeInTheDocument();
    again.unmount();
  });

  it('se puede saltar', async () => {
    localStorage.removeItem('fumometro-onboarded');
    const { user } = renderApp('/');
    await user.click(await screen.findByRole('button', { name: 'Saltar' }));
    expect(await screen.findByText('Todavía no hay humo por acá')).toBeInTheDocument();
    expect(localStorage.getItem('fumometro-onboarded')).toBe('1');
  });
});

describe('copia con contraseña', () => {
  it('exporta cifrada, rechaza contraseña incorrecta e importa con la correcta', async () => {
    let captured: Blob | null = null;
    URL.createObjectURL ??= (() => '') as typeof URL.createObjectURL;
    URL.revokeObjectURL ??= (() => undefined) as typeof URL.revokeObjectURL;
    vi.spyOn(URL, 'createObjectURL').mockImplementation((b: Blob | MediaSource) => {
      captured = b as Blob;
      return 'blob:test';
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    const repo = await IndexedDbRepository.open();
    await repo.put('consumption', testEntry('2026-10-01 20:00', { notes: 'viaja cifrado' }));
    const { user } = renderApp('/ajustes');
    await user.click(await screen.findByRole('button', { name: 'Copia con contraseña' }));
    let dialog = await screen.findByRole('dialog', { name: 'Copia con contraseña' });
    await user.type(within(dialog).getByLabelText('Contraseña'), 'mi-clave-123');
    await user.type(within(dialog).getByLabelText('Repetí la contraseña'), 'otra-cosa');
    await user.click(within(dialog).getByRole('button', { name: 'Crear copia' }));
    expect(await within(dialog).findByText('Las contraseñas no coinciden.')).toBeInTheDocument();
    await user.clear(within(dialog).getByLabelText('Repetí la contraseña'));
    await user.type(within(dialog).getByLabelText('Repetí la contraseña'), 'mi-clave-123');
    await user.click(within(dialog).getByRole('button', { name: 'Crear copia' }));
    await waitFor(() => expect(captured).not.toBeNull(), { timeout: 10000 });
    const encrypted = await readFileText(captured!);
    expect(encrypted).not.toContain('viaja cifrado');

    // Borrar todo y restaurar desde la copia cifrada.
    await repo.clearAll();
    await user.upload(screen.getByTestId('import-file'), new File([encrypted], 'c.json', { type: 'application/json' }));
    dialog = await screen.findByRole('dialog', { name: 'Esta copia tiene contraseña' });
    await user.type(within(dialog).getByLabelText('Contraseña'), 'equivocada');
    await user.click(within(dialog).getByRole('button', { name: 'Abrir copia' }));
    expect(await within(dialog).findByText('Contraseña incorrecta o archivo alterado.', {}, { timeout: 10000 })).toBeInTheDocument();
    await user.clear(within(dialog).getByLabelText('Contraseña'));
    await user.type(within(dialog).getByLabelText('Contraseña'), 'mi-clave-123');
    await user.click(within(dialog).getByRole('button', { name: 'Abrir copia' }));
    const confirm = await screen.findByRole('dialog', { name: '¿Reemplazar tus datos con esta copia?' }, { timeout: 10000 });
    await user.click(within(confirm).getByRole('button', { name: 'Reemplazar e importar' }));
    await go(user, 'Historial');
    expect(await screen.findByText('viaja cifrado')).toBeInTheDocument();
  });
});
