# Fumómetro

**En vivo:** https://fumometro.onrender.com · **Demo para compartir:** https://fumometro.onrender.com/#/demo

Aplicación web progresiva (PWA) para que personas adultas registren, visualicen y comprendan su consumo de cannabis, controlen su gasto y se propongan objetivos personales de reducción o pausa. Identidad con humor fumón (Humito, la mascota de humo; el velocímetro con aguja de hoja) sin perder el enfoque de autoconocimiento y reducción de daños: sin juicios, sin rankings, sin incentivar el consumo, sin consejos médicos.

**Local-first:** no hay cuenta ni servidor. Todos los datos viven en el IndexedDB del navegador.

## Funciones destacadas

- **Bienvenida** de 3 pasos en el primer uso (nombre y moneda opcionales, o ir directo a la demo).
- **Copias con contraseña:** AES-256-GCM con clave derivada por PBKDF2-SHA-256 (600 000 iteraciones), todo con Web Crypto en el navegador ([`encryptedBackup.ts`](src/services/encryptedBackup.ts)). En el celular se comparten con el menú nativo (WhatsApp, AirDrop, mail). La importación detecta la copia cifrada y pide la contraseña.
- **Logros sin humo** ([`achievements.ts`](src/domain/achievements.ts)): rachas, finde sin humo, semana bajo tu promedio, metas cumplidas, constancia del registro personal y mes dentro del presupuesto. Ninguno se puede ganar consumiendo más.
- **Recordatorio diario** como evento de calendario `.ics` (iPhone y Android, título discreto opcional) y aviso suave en la app desde las 19 h si no anotaste cómo estás.

## Modo demo

`/#/demo` (o Ajustes → Modo demo) carga 8 semanas de datos de ejemplo generados de forma determinista ([`src/demo/demoData.ts`](src/demo/demoData.ts)), relativos a la fecha actual. Se guardan en una base IndexedDB separada (`fumometro-demo`), un aviso permanente indica que son datos inventados, y «Salir de la demo» los descarta y vuelve a los datos reales, que nunca se leen ni se modifican durante la demo.

## Stack

| Área | Tecnología |
| --- | --- |
| UI | React 19 + TypeScript 5.9 (modo estricto, `noUncheckedIndexedAccess`) |
| Build | Vite 7, `vite-plugin-pwa` (service worker + manifiesto) |
| Estilos | Tailwind CSS 4 con tokens en `@theme` (`src/styles/index.css`) |
| Navegación | React Router 7 (`HashRouter`: rutas `/#/...`, sin reglas de reescritura en el hosting) |
| Ilustraciones | SVG en línea propios (logo, Humito, volutas): sin imágenes ni peticiones externas |
| Gráficos | Recharts 3 |
| Iconos | Lucide React |
| Validación | Zod 3 (única fuente de verdad del modelo) |
| Persistencia | IndexedDB vía `idb` |
| Fechas | date-fns 4 |
| Fuentes | Inter y Space Grotesk auto-hospedadas (`@fontsource`), sin peticiones a terceros |
| Pruebas | Vitest + Testing Library + fake-indexeddb; Playwright para E2E |

React Hook Form no se incorporó: los formularios son pequeños y la validación vive en el dominio (Zod + funciones puras), por lo que no aportaba valor suficiente.

## Requisitos

- Node.js ≥ 20.19 (probado con 24.21) y npm ≥ 10.
- Para E2E: navegador Chromium de Playwright (`npx playwright install chromium`).

## Instalación y comandos

```bash
npm install
npm run dev          # servidor de desarrollo (http://localhost:5173)
npm run typecheck    # tsc estricto
npm run lint         # ESLint
npm test             # pruebas unitarias e integración (Vitest)
npm run test:e2e     # Playwright: compila, levanta vite preview y prueba en escritorio y móvil
npm run build        # build de producción en dist/
npm run preview      # sirve el build
npm run check        # typecheck + lint + test + build
```

Las pruebas fijan `TZ=America/Santiago` (zona con horario de verano) para ejercitar límites de día y cambios de hora de forma reproducible.

## Estructura

```
src/
  app/            App (rutas), Layout (navegación), PWA, 404
  components/     ui.tsx, Dialog, Toast, charts (barras/líneas), patternCharts (velocímetro, calendario,
                  dona, acumulado), brand (logo y Humito)
  demo/           generador de datos de ejemplo
  domain/         model.ts (esquemas Zod + tipos), money, quantity, analytics, goals, entries
  features/
    dashboard/    Inicio
    consumption/  Registrar/editar, historial, detalle
    analytics/    Estadísticas, tendencia
    expenses/     Gastos y presupuestos
    goals/        Objetivos
    checkins/     Registro personal (ánimo, estrés, sueño, deseo)
    settings/     Preferencias, precios de referencia, exportar/importar, borrar todo, política
  services/       repository.ts (IndexedDB + memoria), exportImport.ts (JSON, CSV)
  state/          DataContext (estado en memoria + escritura a la persistencia), useToday
  i18n/           es.ts (textos de dominio) + formateadores Intl
  utils/          fechas locales, ids, texto
tests/
  fixtures.ts     datos de prueba (marcados como tales, nunca se cargan en la app)
  integration/    flujos completos con Testing Library
  e2e/            Playwright (escritorio + Pixel 7)
```

Las reglas de negocio (`src/domain`) son funciones puras sin React, probadas de forma aislada.

## Modelo de datos (esquema v1)

Definido en [`src/domain/model.ts`](src/domain/model.ts). Todos los registros llevan `id` (UUID aleatorio), `schemaVersion`, `createdAt` y `updatedAt`.

- **ConsumptionEntry** — `occurredAt` (instante ISO UTC), `method` (formato), `quantity: {value, unit} | null`, `context | null`, `moodBefore`, `sleepQuality`, `stress` (1–5 o `null` = sin dato), `cost | null`, `notes`.
- **MoodCheckIn** — registro personal independiente del consumo: ánimo, estrés, sueño (1–5), deseo de consumir (0–4), motivo, notas. Exige al menos un campo.
- **ExpenseEntry** — compra real: fecha local, importe, categoría, cantidad comprada opcional.
- **PersonalGoal** — unión discriminada por `target.type` (`reduce_frequency`, `spending_limit`, `free_days`, `pause`, `daily_log`, `observe`), con fechas, estado e intervalos de pausa.
- **UserPreferences** — nombre para el saludo, moneda, formato/unidad por defecto, campos opcionales visibles, precios de referencia, presupuestos, próxima acción.
- **DataExportMetadata** — app, versión de esquema, fecha y conteos (para detectar archivos truncados).

Decisiones clave:

- **Dinero:** enteros en unidades menores (`amountMinor`) con su moneda; CLP sin decimales, ARS/USD/etc. con 2. Nunca hay conversión entre monedas: los totales se agrupan por moneda y lo que no está en la moneda preferida se muestra aparte.
- **Cantidades:** solo se suman dentro de la misma unidad (internamente en milésimas enteras). `addQuantities` lanza error ante unidades distintas. No hay equivalencias entre gramos, caladas, mg de THC, etc.
- **Gasto real vs. estimado:** el gasto real es la suma de compras (`ExpenseEntry`) y de importes de sesión marcados `paid`. Un coste `estimated` (cantidad × precio de referencia de esa misma unidad) es informativo y **nunca** se suma al gasto real, evitando el doble conteo de producto ya comprado.
- **Fechas:** instantes en UTC; toda agregación por día/semana (lunes–domingo)/mes se hace en la zona horaria del dispositivo con aritmética de calendario.
- **Datos desconocidos vs. cero:** los días anteriores al primer registro se tratan como «sin datos», no como días sin consumo; las escalas vacías se muestran como «Sin dato»; las sesiones sin cantidad se cuentan aparte.

## Persistencia y privacidad

- IndexedDB (`fumometro`, versión 1; la demo usa `fumometro-demo`) con stores `consumption`, `checkins`, `expenses`, `goals`, `meta`. Migraciones incrementales en el `upgrade` de [`repository.ts`](src/services/repository.ts); las importaciones pasan por `migrate()` antes de validarse.
- Al leer, cada registro se valida; los inválidos se omiten (sin borrarse) y se avisa.
- Si IndexedDB no está disponible, la app usa un repositorio en memoria y muestra un aviso permanente de que los datos se perderán.
- Importación: tamaño máximo 20 MB, JSON validado completo (esquema, ids únicos, conteos), confirmación explícita y reemplazo en **una sola transacción** (si falla, nada cambia).
- CSV con BOM UTF-8, escape correcto y neutralización de inyección de fórmulas.
- Sin telemetría, sin SDKs de terceros, sin fuentes remotas. Las URLs solo contienen ids aleatorios. Los mensajes de error no incluyen datos del registro.
- Se puede pedir al navegador almacenamiento persistente (`navigator.storage.persist`).
- **No hay cifrado.** La app no lo afirma en ningún lugar. «Eliminar todo» borra los datos de la app en ese navegador, pero no archivos exportados ni respaldos del sistema; esto se explica en Ajustes.

## Accesibilidad

Navegación por teclado, enlace «Saltar al contenido», foco visible, foco movido al contenido al cambiar de pantalla, modales con trampa de foco y Escape, etiquetas y errores asociados (`aria-describedby`, `aria-invalid`), avisos con `aria-live`, tendencias con icono + texto (no solo color), cada gráfico con tabla equivalente para lectores de pantalla, `prefers-reduced-motion` respetado. Paleta de gráficos validada para contraste sobre la superficie oscura.

## Estado de verificación

Ejecutado en Windows 11, Node 24.21:

- `npm run typecheck` ✔ · `npm run lint` ✔ · `npm run build` ✔
- `npm test` ✔ — 141 pruebas (dominio, logros, patrones, cifrado, recordatorios, datos de demo, persistencia, import/export e integración de flujos: demo, bienvenida y copia cifrada).
- `npm run test:e2e` ✔ — 16 pruebas (8 flujos × escritorio y móvil Pixel 7) sobre el build de producción.

## Limitaciones conocidas

- Sin sincronización entre dispositivos ni navegadores; cada uno tiene su propio almacenamiento.
- Datos sin cifrar en reposo dentro del navegador (las copias con contraseña sí están cifradas).
- Los recordatorios no son notificaciones push: son eventos de calendario; sin servidor no hay push confiable.
- La zona horaria usada es la del dispositivo en el momento de ver los datos: si viajás, los registros se agrupan según la zona actual.
- La importación reemplaza todo (no fusiona).
- Solo los textos de dominio (formatos, unidades, contextos, estados) están centralizados en `src/i18n/es.ts`; el resto de los textos de interfaz todavía están en los componentes.
- La PWA cachea los archivos de la app para uso sin conexión; no se probó la instalación en iOS.
- No se realizó una auditoría formal WCAG con lectores de pantalla reales; la accesibilidad se verificó con pruebas basadas en roles y revisión manual.
- Las pruebas E2E cubren Chromium (escritorio y emulación móvil); no Firefox ni Safari.

## Funciones pendientes (segunda etapa)

Sincronización opcional cifrada de extremo a extremo (reutilizando el formato de la copia cifrada; requiere servidor y base de datos, ~US$7/mes en Render), notificaciones push, informes PDF, idioma inglés (extraer todos los textos a `i18n`), importación con fusión, análisis de patrones con explicaciones transparentes, modo de acompañamiento para reducción. Cualquier función de IA debería ser opcional, explicar sus límites y no enviar el historial a terceros sin consentimiento explícito.

Ver también [PRODUCT_SPEC.md](PRODUCT_SPEC.md).
