```markdown
# Feature Specification: Mejorar la visualización del arbitraje de plazos (separar resumen y detalle)

**Feature Branch**: `007-title-mejorar-la`  
**Created**: 2025-10-20  
**Status**: Draft  
**Input**: User description: "Mejorar la visualización del arbitraje de plazos separando la vista de resumen de la vista de detalles. Las tablas de operaciones individuales (compra/venta CI y 24H) se moverán a una página dedicada por instrumento, mientras que la vista principal mostrará directamente los detalles de cálculo que actualmente están en tooltips.
Objetivos:
1. Separación de vistas: Crear una página específica para ver todas las operaciones de un instrumento particular
2. Mejor visibilidad: Mostrar los detalles de cálculo directamente en la tabla principal sin necesidad de hover
3. Navegación intuitiva: Permitir hacer clic en una fila para ver el detalle completo de operaciones
4. Información completa: Mostrar todos los componentes de costos (comisiones, DM, cauciones) de forma clara"

## Clarifications

### Session 2025-10-20

- Q: Which layout should the main view use to show the new calculation details without hover? → A: D (Use responsive behavior: columns on wide view, compact/expand on narrow view)
- Q: On wide (desktop) view, which set of calculation columns should be visible by default in the main table? → A: A (Full detailed columns: show all fields from FR-011)
- Q: Specify the responsive breakpoint to distinguish "wide" vs "narrow" behavior for tests and CSS? → A: A (Wide >= 1200px, Narrow < 1200px)
 - Q: Where should user column visibility/customization preferences be persisted? → A: D (Do not persist; session-only)
- Q: For CSV export on the instrument detail page, which behavior should we use by default? → A: No CSV export (do not provide CSV export in this iteration)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver resumen con detalles en línea (Priority: P1)

Un usuario quiere revisar rápidamente los cálculos de arbitraje para varios instrumentos desde la vista principal, sin depender de tooltips o hover.

**Why this priority**: Es la mejora de usabilidad más visible y reduce fricción al analizar oportunidades de arbitraje.

**Independent Test**: Abrir la vista principal, observar la tabla resumen y verificar que cada fila muestra los campos de cálculo (tasa, diferencia, comisiones, DM, cauciones) sin necesidad de hover.

**Acceptance Scenarios**:

1. **Given** que hay datos para al menos un instrumento, **When** el usuario abre la vista principal, **Then** cada fila muestra los detalles de cálculo en columnas explícitas (no dependientes de hover).
2. **Given** que una fila tiene valores largos, **When** la tabla se muestra en la pantalla, **Then** todos los componentes críticos son visibles o accesibles mediante una acción de expansión en la misma fila.

---

### User Story 2 - Página de detalle por instrumento (Priority: P1)

Un usuario necesita ver todas las operaciones individuales (compra/venta CI y 24H) de un instrumento y sus cálculos en contexto.

**Why this priority**: Permite auditoría y análisis profundo por instrumento, requisito funcional para entender desgloses de costos.

**Independent Test**: Desde la vista principal, hacer clic en una fila de instrumento y verificar que se abre la página de detalle del instrumento que contiene las tablas de operaciones individuales y el resumen de cálculo.

**Acceptance Scenarios**:

1. **Given** que existe un instrumento con operaciones, **When** el usuario hace clic en la fila del instrumento, **Then** se navega a la página dedicada al instrumento que muestra:
   - Tablas separadas para operaciones Compra/Venta CI y 24H.
   - Para cada operación: fecha/hora, cantidad, precio, y componentes de costo (comisión, DM, caución) y el cálculo resultante usado en el resumen.

---

### User Story 3 - Navegación intuitiva (Priority: P2)

Un usuario quiere abrir detalladamente una operación realizando una acción clara (click en fila o botón) sin perder el contexto de la vista resumen.

**Why this priority**: Mejora el flujo entre exploración rápida y análisis profundo.

**Independent Test**: Desde la vista principal, hacer click en una fila o en el control "Ver detalle" y confirmar que se abre la página de instrumento en una nueva vista o panel, con posibilidad de volver a la vista resumen.

**Acceptance Scenarios**:

1. **Given** que el usuario está en la vista principal, **When** hace click en una fila de instrumento, **Then** la aplicación presenta la página de detalle del instrumento y permite regresar con un único paso (ej. botón "Atrás" o breadcrumb).

---

### Edge Cases

- Instrumento sin operaciones: la página de detalle muestra un mensaje claro "No hay operaciones disponibles" y mantiene las columnas del resumen vacías o con valores nulos.
- Datos incompletos para componentes de costo: mostrar "--" o "No disponible" por componente y explicar en una tooltip/ayuda breve el motivo.
- Filas con textos muy largos o números con muchas cifras: truncar con posibilidad de expandir/mostrar en modal o línea expandida para leer el valor completo.
- Concurrencia / datos en actualización: si los datos se actualizan mientras el usuario navega, mostrar indicador "Datos actualizados" y opción para refrescar manualmente.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: La vista principal MUST mostrar una tabla de instrumentos donde, por cada instrumento, se expongan columnas que contienen los detalles de cálculo actualmente en tooltips (ej.: tasa calculada, diferencia neta, total de comisiones, DM, cauciones).
 - **FR-001**: La vista principal MUST mostrar una tabla de instrumentos donde, por cada instrumento, se expongan los detalles de cálculo actualmente en tooltips. En vistas anchas estos detalles se presentan como columnas separadas (mostrar todas las columnas detalladas listadas en FR-011); en vistas angostas se aplicará un comportamiento responsivo que muestra una columna compacta con control de expansión para ver el desglose completo.
- **FR-002**: Cada fila de la tabla en la vista principal MUST ser clicable y navegar a la página de detalle del instrumento correspondiente.
- **FR-003**: Debe existir una página dedicada por instrumento que muestre al menos dos tablas de operaciones: Compra/Venta CI y 24H, con las columnas: fecha/hora, tipo (compra/venta), cantidad, precio, comisiones, DM, cauciones y resultado del cálculo.
- **FR-004**: Los componentes de costo (comisiones, DM, cauciones) MUST mostrarse como columnas separadas y con un subtotal/desglose visible en la página de detalle y en la fila resumen.
- **FR-005**: Si un componente de costo no está disponible, el sistema MUST indicar explícitamente su ausencia en la celda correspondiente (p. ej. "No disponible").
- **FR-006**: La navegación desde la vista principal a la página de detalle MUST preservar el contexto de filtrado/ordenamiento aplicado en la vista principal (al volver, el usuario debe ver la misma lista ordenada/filtrada).
- **FR-007**: La vista principal MUST soportar paginación o scroll virtual cuando existan más instrumentos de los que caben en la pantalla, manteniendo la capacidad de ver los detalles de cálculo en las filas visibles.
- **FR-008**: La página de detalle MUST NOT proporcionar una opción de exportación CSV en esta iteración.
- **FR-009**: Las tablas con las operaciones individuales (Compra/Venta CI y 24H) MUST trasladarse exclusivamente a la página dedicada por instrumento; la vista principal NO debe contener estas tablas completas.
- **FR-010**: En la vista principal, en lugar de las tablas completas, MUST mostrarse el detalle de cálculo que hoy aparece en tooltips como columnas explícitas y (opcional) una fila expandible que muestre el desglose completo por lado (Venta CI / Compra 24H).
 - **FR-010**: En la vista principal, en lugar de las tablas completas, MUST mostrarse el detalle de cálculo que hoy aparece en tooltips. El comportamiento debe ser responsivo: en pantallas anchas se mostrarán columnas explícitas; en pantallas angostas se mostrará una columna compacta y se permitirá expandir la fila para ver el desglose completo por lado (Venta CI / Compra 24H).
- **FR-011**: Para cada instrumento y para cada "lado" relevante (p. ej. Venta CI y Compra 24H), el sistema MUST mostrar el desglose detallado con al menos los siguientes campos: importe total de la operación, comisiones (detalle por tipo si aplica: tomadora/colocadora), Derechos de Mercado (DM), importe a caucionar, interés bruto, interés neto, arancel, gastos de garantía (gastos, gastos de gestión), IVA, subtotal de gastos, y total neto.
- **FR-012**: Las sumas y subtotales MUST reconciliarse: subtotal de componentes = suma de comisiones + DM + arancel + gastos + IVA; y total neto MUST coincidir con el cálculo mostrado en la vista resumen.
- **FR-013**: En la página de detalle por instrumento, además de las tablas de operaciones, MUST mostrarse una sección visual con el desglose por lado (Venta CI / Compra 24H) tal como aparece en la imagen adjunta: importe a caucionar, interés, arancel, derechos de mercado, gastos de garantía, IVA y total gastos.
- **FR-014**: Las celdas que muestran valores monetarios o porcentuales MUST indicar moneda/unidad y formateo consistente (separador de miles, decimales) y una ayuda contextual (tooltip) para explicar el cálculo del valor.
 

### Key Entities *(include if feature involves data)*

- **Instrumento**: Identificador único (ticker/Codigo), nombre, mercado, últimos valores relevantes.
- **Operación**: id, instrumento_id, tipo (compra/venta), origen (CI / 24H), fecha_hora, cantidad, precio, comisiones, DM, cauciones, resultado_calculo.
- **CálculoDetalle**: entrada (operaciones involucradas), fórmula resumida (sin implementación), valores intermedios, total neto.
- **Usuario (contexto)**: preferencias de visualización (columnas visibles, orden, filtros) — solo como dato de UI para preservar contexto.
 

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 95% de los usuarios podrán localizar el desglose de cálculo para un instrumento en la vista principal sin usar hover (verificación: test de usabilidad o QA manual, tiempo objetivo por búsqueda < 10s).
- **SC-002**: Navegar desde la vista principal a la página de detalle y volver mantiene el contexto en al menos el 98% de intentos en pruebas automatizadas/manuales.
- **SC-003**: En pruebas funcionales, las tablas de detalle muestran todos los componentes de costo en columnas separadas en 100% de los registros que contienen esos datos.
- **SC-004**: Reducción de preguntas/soporte relacionadas con "¿Dónde están los cálculos?" en un 50% comparado con la línea base previa a la implementación (métricas de tickets o feedback interno).

- **SC-005**: Las verificaciones de reconciliación numérica (subtotales y totales por lado) pasan en 100% de casos de prueba con datos sintéticos y reales disponibles en QA.

## Assumptions

- La aplicación ya dispone de identificadores de instrumento y endpoints/datos necesarios para poblar las tablas de operaciones.  
- La navegación y el sistema de rutas permiten crear una vista/página por instrumento dentro del producto existente.  
- No se introducen cambios en modelos de datos de backend que requieran coordinación compleja; si fuera necesario, se gestionará como dependencia explícita.
 - No se proporcionará exportación CSV en esta iteración.
 

## Dependencies

- Dependencia en feed de datos de operaciones que incluya desgloses de costos (comisiones, DM, cauciones).  
- Dependencia en la capa de navegación/ruteo del frontend para soportar páginas por instrumento.

## Acceptance Criteria (mapped to Functional Requirements)

- **FR-001 Acceptance**: Given instruments with data, the main table displays explicit calculation columns (tasa calculada, diferencia neta, total comisiones, DM, cauciones) for each visible instrument row. Verified by UI checks asserting presence of these columns and sample values for at least 10 instruments.
 - **FR-001 Acceptance**: Given instruments with data, the main table displays calculation details according to the responsive rule: on wide view the table shows explicit columns (tasa calculada, diferencia neta, total comisiones, DM, cauciones); on narrow view a compact "Calculation" column appears with an expand control to reveal the full breakdown. Verified by UI checks asserting presence of these columns or the compact column and expand behavior for at least 10 instruments. Tests should simulate a narrow viewport and a wide viewport (e.g., desktop vs mobile widths).
 - **FR-001 Acceptance**: Given instruments with data, the main table displays calculation details according to the responsive rule: on wide view the table shows the full detailed columns (all fields from FR-011: importe total, comisiones (tomadora/colocadora), DM, importe a caucionar, interés bruto, interés neto, arancel, gastos de garantía, IVA, subtotal gastos, total neto, plus tasa calculada, diferencia neta); on narrow view a compact "Calculation" column appears with an expand control to reveal the full breakdown. Verified by UI checks asserting presence of the full detailed headers and sample values for at least 10 instruments on wide viewport, and presence/expand behavior on narrow viewport. Tests should simulate narrow and wide viewports (e.g., desktop vs mobile widths).
 - **FR-001 Acceptance**: Given instruments with data, the main table displays calculation details according to the responsive rule: on wide view (viewport width >= 1200px) the table shows the full detailed columns (all fields from FR-011: importe total, comisiones (tomadora/colocadora), DM, importe a caucionar, interés bruto, interés neto, arancel, gastos de garantía, IVA, subtotal gastos, total neto, plus tasa calculada, diferencia neta); on narrow view (viewport width < 1200px) a compact "Calculation" column appears with an expand control to reveal the full breakdown. Verified by UI checks asserting presence of the full detailed headers and sample values for at least 10 instruments on wide viewport, and presence/expand behavior on narrow viewport. Tests must simulate both viewport widths (>=1200px and <1200px) when asserting layout and expansion behavior.
- **FR-002 Acceptance**: Clicking any instrument row navigates to the corresponding instrument detail page; verified by navigation test that asserts URL/routing change and presence of instrument identifier on detail page.
- **FR-003 Acceptance**: The instrument detail page contains two tables (Compra/Venta CI and 24H) with required columns (fecha/hora, tipo, cantidad, precio, comisiones, DM, cauciones, resultado_calculo). Verified by asserting table headers and sample row content.
- **FR-004 Acceptance**: Columns for comisiones, DM, cauciones are present both in summary row and detail tables; subtotal/desglose mostrado en la página de detalle y un valor resumen en la fila principal. Verified by sample data where subtotals equal sum of components.
- **FR-005 Acceptance**: For records missing a component, the cell explicitly shows "No disponible" and automated tests assert this string appears for missing values.
- **FR-006 Acceptance**: Apply a filter or sort on the main view, navigate to a detail page and return; the main view preserves filter/sort state. Verified by automated UI test or manual QA steps.
- **FR-007 Acceptance**: With more instruments than fit on screen, pagination or infinite scroll is available and rows show calculation columns for visible instruments. Verified by simulating large dataset and asserting UI behavior.
- **FR-008 Acceptance**: CSV export is not provided in this iteration; verified by UI checks asserting there is no export control (button/menu) on the instrument detail page.
- **FR-009 Acceptance**: The main view no longer renders full operation tables; instrument detail page contains the operation tables. Verified by DOM inspection and UI test that asserts absence of operation table elements in the main view and presence in the instrument page.
- **FR-010 Acceptance**: The main view shows the detailed breakdown (fields from FR-011) inline in columns or in an expandable row; verified by asserting presence of breakdown headers and sample values for both Venta CI and Compra 24H sides.
 - **FR-010 Acceptance**: The main view shows the detailed breakdown (fields from FR-011) inline following the responsive rule: explicit columns on wide view; compact expandable cell on narrow view. Verified by asserting presence of breakdown headers and sample values on wide view, and verifying the compact column + expansion reveals the same breakdown on narrow view. Automated UI tests should run viewport-width based assertions.
 - **FR-010 Acceptance**: The main view shows the full detailed breakdown (all fields from FR-011) inline on wide view and via the compact expandable cell on narrow view. Verified by asserting presence of all breakdown headers and sample values for both Venta CI and Compra 24H sides on wide view, and verifying the compact column + expansion reveals the same complete breakdown on narrow view. Automated UI tests should run viewport-width based assertions.
 - **FR-010 Acceptance**: The main view shows the full detailed breakdown (all fields from FR-011) inline on wide view (viewport width >= 1200px) and via the compact expandable cell on narrow view (viewport width < 1200px). Verified by asserting presence of all breakdown headers and sample values for both Venta CI and Compra 24H sides on wide view, and verifying the compact column + expansion reveals the same complete breakdown on narrow view. Automated UI tests must run assertions at the specified viewport widths (>=1200px and <1200px).
- **FR-011 Acceptance**: For each side, the breakdown includes: importe total, comisiones (tomadora/colocadora si aplica), DM, importe a caucionar, interés bruto, interés neto, arancel, gastos de garantía, IVA, subtotal gastos, y total neto. Verified by sampling rows and checking all the listed fields are present and populated when available.
- **FR-012 Acceptance**: Numeric reconciliation tests confirm subtotals and totals match component sums for a representative dataset.
- **FR-013 Acceptance**: The instrument detail page renders a visual section matching the image (importe a caucionar, interés, arancel, DM, gastos, IVA, total gastos) and QA confirms layout and values for sample data.
- **FR-014 Acceptance**: Monetary and percentage cells indicate units and format; UI tests verify format and presence of contextual help strings.

