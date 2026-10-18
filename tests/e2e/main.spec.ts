/**
 * Flujos principales en un navegador real (build de producción).
 * Cada prueba usa un contexto nuevo: IndexedDB vacío.
 */
import { expect, test, type Page } from '@playwright/test';

const ROUTES = ['/', '/#/registrar', '/#/historial', '/#/estadisticas', '/#/objetivos', '/#/gastos', '/#/diario', '/#/ajustes'];

async function primaryNav(page: Page, name: string) {
  // En móvil la navegación principal está abajo; en escritorio, a la izquierda. Ambas se llaman "Principal".
  await page.getByRole('navigation', { name: 'Principal' }).locator('visible=true').getByRole('link', { name, exact: true }).click();
}

async function register(page: Page, opts: { qty?: string; notes?: string } = {}) {
  await primaryNav(page, 'Registrar');
  await expect(page.getByRole('heading', { name: 'Registrar consumo' })).toBeVisible();
  if (opts.qty) await page.getByLabel('Cantidad').fill(opts.qty);
  if (opts.notes) await page.getByLabel('Notas').fill(opts.notes);
  await page.getByRole('button', { name: 'Guardar registro' }).click();
  await expect(page.getByRole('region', { name: 'Hoy' })).toBeVisible();
}

test('registrar, recargar, editar y eliminar', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Tu registro empieza acá')).toBeVisible();

  await register(page, { qty: '0,5', notes: 'e2e original' });
  const today = page.getByRole('region', { name: 'Hoy' });
  await expect(today.getByText('0,5 g')).toBeVisible();

  await page.reload();
  await expect(page.getByRole('region', { name: 'Hoy' }).getByText('0,5 g')).toBeVisible();

  await primaryNav(page, 'Historial');
  await page.getByRole('link', { name: /Flor fumada a las .* ver detalle/ }).click();
  await expect(page.getByText('e2e original')).toBeVisible();
  await page.getByRole('link', { name: 'Editar' }).click();
  await page.getByLabel('Notas').fill('e2e editado');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByRole('link', { name: 'Editar' })).toBeVisible();
  await expect(page.getByText('e2e editado')).toBeVisible();

  await page.reload();
  await expect(page.getByText('e2e editado')).toBeVisible();

  await page.getByRole('button', { name: 'Eliminar' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Eliminar registro' }).click();
  await expect(page.getByText('Todavía no hay registros')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Todavía no hay registros')).toBeVisible();
});

test('estadísticas reflejan los registros y no mezclan unidades', async ({ page }) => {
  await page.goto('/');
  await register(page, { qty: '0,25' });
  await register(page, { qty: '1' });
  await primaryNav(page, 'Registrar');
  await page.getByText('Vaporizador de cartucho').click();
  await page.getByLabel('Cantidad').fill('5');
  await page.getByRole('button', { name: 'Guardar registro' }).click();
  await expect(page.getByRole('region', { name: 'Hoy' })).toBeVisible();

  await primaryNav(page, 'Estadísticas');
  const qty = page.getByRole('region', { name: 'Cantidades por unidad' });
  await expect(qty.locator('li', { hasText: 'gramos' })).toContainText('1,25');
  await expect(qty.locator('li', { hasText: 'caladas' })).toContainText('5');
  const freq = page.getByRole('region', { name: 'Frecuencia' });
  await expect(freq.getByText('Sesiones', { exact: true }).locator('xpath=following-sibling::div[1]')).toHaveText('3');
});

test('exporta JSON y CSV, rechaza importación inválida sin perder datos', async ({ page }) => {
  await page.goto('/');
  await register(page, { notes: 'dato que debe sobrevivir' });
  await page.goto('/#/ajustes');

  const [json] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Copia completa (JSON)' }).click()]);
  expect(json.suggestedFilename()).toMatch(/^ritmo-copia-\d{4}-\d{2}-\d{2}\.json$/);
  const content = JSON.parse(await (await json.createReadStream()).toArray().then((c) => Buffer.concat(c).toString('utf8')));
  expect(content.meta.counts.consumption).toBe(1);

  const [csv] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Historial (CSV)' }).click()]);
  expect(csv.suggestedFilename()).toMatch(/\.csv$/);

  await page.getByTestId('import-file').setInputFiles({ name: 'mala.json', mimeType: 'application/json', buffer: Buffer.from('{"meta":{"app":"ritmo","schemaVersion":1}}') });
  await expect(page.getByText('El archivo tiene datos inválidos. No se importó nada.')).toBeVisible();

  // Importar la copia válida (reemplazo con confirmación).
  content.consumption[0].notes = 'restaurado desde copia';
  await page.getByTestId('import-file').setInputFiles({ name: 'ok.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(content)) });
  await page.getByRole('dialog').getByRole('button', { name: 'Reemplazar e importar' }).click();
  await primaryNav(page, 'Historial');
  await expect(page.getByText('restaurado desde copia')).toBeVisible();
});

test('eliminar todos los datos', async ({ page }) => {
  await page.goto('/');
  await register(page);
  await page.goto('/#/ajustes');
  await page.getByRole('button', { name: 'Eliminar todos los datos' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: 'Eliminar todo' })).toBeDisabled();
  await dialog.getByRole('checkbox').check();
  await dialog.getByRole('button', { name: 'Eliminar todo' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('Se eliminaron todos los datos')).toBeVisible();
  await page.reload();
  await page.goto('/');
  await expect(page.getByText('Tu registro empieza acá')).toBeVisible();
});

test('sin desborde horizontal en ninguna pantalla', async ({ page }) => {
  await page.goto('/');
  await register(page, { qty: '0,5' });
  for (const r of ROUTES) {
    await page.goto(r);
    await page.waitForLoadState('networkidle');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `desborde en ${r}`).toBeLessThanOrEqual(0);
  }
});

test('las URLs nunca contienen datos del registro', async ({ page }) => {
  await page.goto('/');
  await register(page, { notes: 'secreto-xyz' });
  const urls: string[] = [];
  page.on('request', (r) => urls.push(r.url()));
  for (const r of ROUTES) await page.goto(r);
  await primaryNav(page, 'Historial');
  await page.getByRole('link', { name: /ver detalle/ }).click();
  expect(page.url()).toMatch(/#\/historial\/[0-9a-f-]{36}$/);
  expect(urls.every((u) => !u.includes('secreto') && new URL(u).origin === 'http://localhost:4317')).toBe(true);
});
