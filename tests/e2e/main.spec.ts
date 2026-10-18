/**
 * Flujos principales en un navegador real (build de producción).
 * Cada prueba usa un contexto nuevo: IndexedDB vacío.
 */
import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // La bienvenida tiene sus propias pruebas; acá se da por vista.
  await page.addInitScript(() => localStorage.setItem('fumometro-onboarded', '1'));
});

const ROUTES = ['/', '/#/registrar', '/#/historial', '/#/estadisticas', '/#/objetivos', '/#/gastos', '/#/diario', '/#/ajustes'];

async function primaryNav(page: Page, name: string) {
  // En móvil la navegación principal está abajo; en escritorio, a la izquierda. Ambas se llaman "Principal".
  await page.getByRole('navigation', { name: 'Principal' }).locator('visible=true').getByRole('link', { name, exact: true }).click();
}

async function register(page: Page, opts: { qty?: string; notes?: string } = {}) {
  await primaryNav(page, 'Registrar');
  await expect(page.getByRole('heading', { name: 'Anotar sesión' })).toBeVisible();
  if (opts.qty) await page.getByLabel('Cantidad').fill(opts.qty);
  if (opts.notes) await page.getByLabel('Notas').fill(opts.notes);
  await page.getByRole('button', { name: 'Guardar registro' }).click();
  await expect(page.getByRole('region', { name: 'Hoy' })).toBeVisible();
}

test('registrar, recargar, editar y eliminar', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Todavía no hay humo por acá')).toBeVisible();

  await register(page, { qty: '0,5', notes: 'e2e original' });
  const today = page.getByRole('region', { name: 'Hoy' });
  await expect(today.getByText('Cantidad: 0,5 g')).toBeVisible();

  await page.reload();
  await expect(page.getByRole('region', { name: 'Hoy' }).getByText('Cantidad: 0,5 g')).toBeVisible();

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
  await expect(page.getByText('Todavía no hay humo registrado')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Todavía no hay humo registrado')).toBeVisible();
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

  const [json] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Copia sin cifrar (JSON)' }).click()]);
  expect(json.suggestedFilename()).toMatch(/^fumometro-copia-\d{4}-\d{2}-\d{2}\.json$/);
  const content = JSON.parse(await (await json.createReadStream()).toArray().then((c) => Buffer.concat(c).toString('utf8')));
  expect(content.meta.counts.consumption).toBe(1);

  const [csv] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Historial (CSV)' }).click()]);
  expect(csv.suggestedFilename()).toMatch(/\.csv$/);

  await page.getByTestId('import-file').setInputFiles({ name: 'mala.json', mimeType: 'application/json', buffer: Buffer.from('{"meta":{"app":"fumometro","schemaVersion":1}}') });
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
  await expect(page.getByText('Todavía no hay humo por acá')).toBeVisible();
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

test('el link de la demo abre datos de ejemplo y se ve bien en todas las pantallas', async ({ page }) => {
  await page.goto('/#/demo');
  await expect(page.getByText(/Todo lo que ves son datos de ejemplo/)).toBeVisible();
  await expect(page.getByRole('region', { name: 'Fumómetro de la semana' })).toBeVisible();
  for (const r of ROUTES) {
    await page.goto(r);
    await expect(page.getByText(/Todo lo que ves son datos de ejemplo/)).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `desborde en ${r}`).toBeLessThanOrEqual(0);
  }
  await page.getByRole('button', { name: 'Salir de la demo' }).first().click();
  await page.goto('/');
  await expect(page.getByText('Todavía no hay humo por acá')).toBeVisible();
});

test('bienvenida en el primer uso', async ({ browser }) => {
  const ctx = await browser.newContext({ baseURL: 'http://localhost:4317', timezoneId: 'America/Santiago' });
  const page = await ctx.newPage();
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Bienvenido al Fumómetro' })).toBeVisible();
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByRole('button', { name: 'Ver la demo primero' }).click();
  await expect(page.getByText(/Todo lo que ves son datos de ejemplo/)).toBeVisible();
  await ctx.close();
});

test('tarjeta de la semana: se genera una imagen PNG en el dispositivo', async ({ page }, info) => {
  const requests: string[] = [];
  page.on('request', (r) => requests.push(r.url()));
  await page.goto('/#/demo');
  await page.getByRole('button', { name: 'Compartir mi semana' }).click();
  const dialog = page.getByRole('dialog', { name: 'Compartir mi semana' });
  await expect(dialog.getByRole('img', { name: 'Vista previa de la tarjeta de tu semana' })).toBeVisible();
  const [dl] = await Promise.all([page.waitForEvent('download'), dialog.getByRole('button', { name: 'Descargar' }).click()]);
  expect(dl.suggestedFilename()).toMatch(/^fumometro-semana-\d{4}-\d{2}-\d{2}\.png$/);
  const path = info.outputPath('tarjeta.png');
  await dl.saveAs(path);
  const { statSync } = await import('node:fs');
  expect(statSync(path).size).toBeGreaterThan(20_000);
  // La imagen se crea localmente: ninguna petición fuera del propio sitio.
  expect(requests.every((u) => u.startsWith('http://localhost:4317') || u.startsWith('data:') || u.startsWith('blob:'))).toBe(true);
});

test('repetir la última sesión y deshacer', async ({ page }) => {
  await page.goto('/');
  await register(page, { qty: '0,5' });
  const hoy = page.getByRole('region', { name: 'Hoy' });
  await expect(hoy.getByText('Sesiones', { exact: true }).locator('xpath=following-sibling::div[1]')).toHaveText('1');
  await hoy.getByRole('button', { name: 'Repetir la última' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Sí, anotar otra' }).click(); // la anterior fue hace menos de 10 min
  await expect(hoy.getByText('Sesiones', { exact: true }).locator('xpath=following-sibling::div[1]')).toHaveText('2');
  await page.getByRole('button', { name: 'Deshacer' }).click();
  await expect(hoy.getByText('Sesiones', { exact: true }).locator('xpath=following-sibling::div[1]')).toHaveText('1');
});
