# Fumómetro — Especificación de producto (MVP)

## Propósito

Ayudar a personas adultas a entender su relación con el cannabis a partir de sus propios datos: cuánto, cuándo, en qué situaciones, cuánto gastan y cómo avanzan los objetivos que eligieron. La app sirve tanto a quien quiere reducir o pausar como a quien solo quiere observar. No fomenta el consumo, no recomienda dosis, no diagnostica y no juzga.

## Principios de producto aplicados

| Principio | Cómo se materializa |
| --- | --- |
| Registro sin fricción | Solo fecha y formato son necesarios; se puede guardar una sesión sin cantidad. Los campos emocionales están plegados y son opcionales. Los campos opcionales se pueden ocultar en Ajustes. |
| Ningún dato inventado | Todas las métricas se derivan de registros. Estados vacíos explican qué aparecerá. Los días antes del primer registro se muestran como «sin datos». |
| Cálculos correctos | Unidades nunca mezcladas, dinero en enteros, comparaciones con rangos explícitos, días locales con aritmética de calendario. |
| Sin culpa | Los objetivos no cumplidos muestran mensajes de continuidad («el próximo período empieza de cero»). Las tendencias se describen con texto neutro; la reducción se marca con icono, no con alarmas. |
| Prudencia estadística | Las asociaciones entre registro personal y consumo solo se muestran con ≥5 días en cada grupo, y siempre con la aclaración de que no implican causa. |
| Privacidad por defecto | Sin cuenta, sin servidor, sin terceros. Nombre neutro. Explicación honesta de límites (sin cifrado; borrar no alcanza exportaciones ni respaldos). |

## Identidad y tono

Nombre y voz con humor fumón («¿cómo viene la mano?», «días sin humo», «plata en humo»), mascota Humito y un velocímetro con aguja de hoja. El humor nunca empuja a consumir: Humito describe los datos («vas 3, tu promedio era 6,8»), no felicita por fumar ni reta por hacerlo, y no hay logros por cantidad.

## Modo demo

Para mostrar la app sin datos propios: link `/#/demo` o Ajustes → Modo demo. Ocho semanas de datos de ejemplo con una historia de reducción gradual, en almacenamiento separado, con aviso permanente y salida en un toque que restaura los datos reales.

## Alcance del MVP

### Incluido

1. **Inicio** — velocímetro de la semana (con tu promedio de las 4 semanas completas anteriores y tu meta si existe), Humito comentando tus datos, saludo, fecha, resumen de hoy (sesiones, cantidades por unidad, gasto real), semana en curso (sesiones, días sin consumo de días ya terminados), tendencia últimos 7 días vs. 7 anteriores con fechas explícitas, gráfico de 7 días, gasto del mes vs. presupuesto, objetivos activos y «mi próxima acción» editable.
2. **Registrar consumo** — fecha/hora, formato, cantidad + unidad (opcional), contexto, ánimo/sueño/estrés previos, gasto (sin importe / pagado en el momento / valor estimado), notas. Validación con mensajes claros, aviso de posible duplicado (mismo formato y cantidad a <10 min), edición, cancelación y eliminación con confirmación.
3. **Historial** — agrupado por día, filtros por período, formato, contexto (incluido «sin contexto») y búsqueda en notas sin tildes; paginación progresiva; detalle con distinción explícita de «Sin dato».
4. **Estadísticas («El humo en números»)** — calendario de calor de 12 semanas, hora pico y sesiones por hora, semana tipo, dona de formatos; rangos 7/30/90 días y mes en curso; frecuencia diaria y semanal, promedio por día con datos, días sin consumo, comparación con el período anterior equivalente (rangos impresos), cantidades por unidad, distribución por contexto, gasto real con período anterior y valor estimado aparte, serie del registro personal, asociación prudente y cumplimiento de objetivos por período.
5. **Gastos** — gasto acumulado del mes contra el presupuesto; compras con fecha, importe, moneda, categoría y cantidad; resumen hoy/semana/mes con períodos anteriores; presupuesto semanal y mensual con margen o exceso; gasto por semana (8 semanas).
6. **Objetivos** — seis tipos con métrica, período y criterio propios; crear, editar, pausar/reanudar (las semanas completamente en pausa no se evalúan), eliminar; historial por período.
7. **Registro personal** — ánimo, estrés, sueño, deseo de consumir, motivo, observaciones; independiente del consumo; editable y eliminable.
8. **Ajustes y datos** — preferencias, campos visibles, precios de referencia por unidad, estado del almacenamiento y solicitud de persistencia, exportar JSON/CSV, importar con validación y confirmación, eliminar todo con doble confirmación, política de datos.

### Fuera de alcance (deliberadamente)

Cuentas, sincronización, cifrado, notificaciones, PDF, otros idiomas, IA, compra/venta/distribución, recomendaciones de dosis, estimación de intoxicación o niveles en sangre, rankings o comparaciones sociales.

## Definición de los objetivos

| Tipo | Métrica | Período | Criterio |
| --- | --- | --- | --- |
| Reducir frecuencia | Sesiones registradas | Semana (lun–dom) | ≤ máximo. Si se supera antes de terminar la semana, se marca no cumplido. |
| Límite de gasto | Gasto real en la moneda del límite | Semana o mes | ≤ límite. Estimaciones excluidas. |
| Días sin consumo | Días terminados sin sesiones | Semana | ≥ mínimo. Hoy no cuenta hasta que termine. |
| Registro diario | Días con al menos un consumo o registro personal | Semana | ≥ mínimo. |
| Pausa | Sesiones entre inicio y fin | Período elegido (fin obligatorio) | 0 sesiones al terminar. |
| Observar | Días con registro (informativo) | N semanas | Se completa al pasar el tiempo; sin meta de cantidad. |

Semanas parciales (inicio o fin a mitad de semana) consideran solo los días dentro del objetivo; las metas de días se ajustan a los días disponibles.

## Flujos principales

1. **Primer uso:** Inicio vacío → «Registrar un consumo» → guardar con dos toques → Inicio con datos reales.
2. **Registro habitual (móvil):** botón central «Registrar» de la barra inferior → (opcional) cantidad → Guardar → vuelve a Inicio actualizado.
3. **Corrección:** Historial → registro → Editar o Eliminar (confirmación) → estadísticas recalculadas al instante.
4. **Control de gasto:** Gastos → Agregar gasto (compra real) → definir presupuesto → ver margen en Inicio y Gastos. Al registrar sesiones de producto ya comprado, usar «Estimar valor» para no duplicar.
5. **Objetivo de pausa:** Objetivos → Nuevo → Hacer una pausa → fechas → seguimiento día a día; si hubo una sesión, mensaje de continuidad sin culpa.
6. **Respaldo y migración de dispositivo:** Ajustes → Copia completa (JSON) → en el otro navegador, Importar → confirmar reemplazo.
7. **Salida:** Ajustes → Eliminar todos los datos → marcar «entiendo» → confirmar.

## Navegación

- **Móvil:** barra inferior con Inicio, Historial, Registrar (destacado), Estadísticas y Objetivos; barra superior con Registro personal, Gastos y Ajustes.
- **Escritorio:** barra lateral con todas las secciones y recordatorio de privacidad; contenido limitado a ~1024 px de ancho.

## Identidad visual

Logo: velocímetro con aguja de hoja y voluta de humo. Mascota: Humito. Fondo carbón (#0b0c0e), superficies grafito escalonadas, bordes finos, radios moderados, acento lima controlado (#b6f36a) y cian secundario (#6fd6ec) para progreso. Inter para interfaz y números tabulares; Space Grotesk solo en títulos. Sin gradientes en superficies (solo un halo muy tenue de fondo), sin glow, iconografía Lucide, microanimaciones de ≤220 ms desactivadas con `prefers-reduced-motion`.

## Métricas de éxito sugeridas (para validar con usuarios, no se recolectan en la app)

Tiempo de registro < 10 s; porcentaje de sesiones registradas con cantidad; retención de uso a 4 semanas; percepción de juicio (entrevistas); comprensión de la diferencia entre gasto real y estimado.

## Próximo paso recomendado

Pruebas de usabilidad con 5–8 personas de Chile y Argentina sobre los flujos 1, 2 y 4, seguidas de: extracción completa de textos a `i18n`, copias de seguridad cifradas con contraseña (Web Crypto, AES-GCM + PBKDF2) y recordatorios locales opcionales.
