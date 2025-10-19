# Feature Specification: Arbitraje de Plazos – Visualización y cálculo de P&L

**Feature Branch**: `006-arbitraje-de-plazos`  
**Created**: 2025-10-18  
**Status**: Draft  
**Input**: User description:

"""
Arbitraje de Plazos – Diseño de visualización y cálculo de P&L

Este documento define cómo detectar, agrupar y visualizar las operaciones de arbitraje de plazo para calcular el P&L por instrumento y por día, integrándolo en la página actual de "Arbitraje de Plazos".

Restricciones y alcance acordados:

- Filtro superior: solo Instrumento (sin selector de fecha). El periodo analizado es siempre 1 día (la jornada activa en la app).
- Caso con posición: cuando la estrategia es "vender CI y recomprar en 24h", se asume que ya se tenía posición en el instrumento y se vende desde inventario (no es venta corta).
- Sin tests en esta entrega.
- Agrupación principal: por Instrumento y por Plazo (tenor) de caución.

---

1) Conceptos y objetivos

Queremos identificar dos patrones de arbitraje de plazo dentro del mismo instrumento y mismo día base (agrupado por Plazo de caución):

1. Vender en CI, recomprar en 24h y colocar el dinero en caución colocadora (teniendo posición):
   - Flujo: se vende inventario en CI => entra efectivo t0 => se coloca en caución => se recompra 24h en t1 para recomponer la posición.
   - P&L = P&L de trade (CI vs 24h, neto de comisiones) + Interés de caución colocadora.

2. Comprar en CI, vender en 24h y financiar con caución tomadora:
   - Flujo: se compra en CI financiado con caución tomadora => se vende 24h en t1 => se cancela caución.
   - P&L = P&L de trade (24h vs CI, neto de comisiones) − Interés pagado de caución tomadora.

Resultado esperado: una tabla por instrumento, por plazo y por día que sintetice cada operación de arbitraje (incluyendo diferencias de cantidades) con P&L del trade, P&L de caución y P&L total.
"""

## User Scenarios & Testing (mandatory)

### User Story 1 - Ver P&L diario por Instrumento+Plazo (Priority: P1)

Como operador, quiero filtrar por un instrumento y ver, para cada plazo de caución del día, el P&L del trade, el P&L de caución y el P&L total por patrón (VenderCI-Recomprar24 y ComprarCI-Vender24), para decidir si la estrategia de arbitraje fue rentable.

**Why this priority**: Es la decisión diaria clave de la mesa: identificar rápidamente qué arbitrajes generaron o destruyeron valor.

**Independent Test**: Con un set de operaciones del día y cauciones asociadas, al seleccionar un instrumento se muestra una tabla con filas por plazo y columnas de P&L. Puede verificarse contra un cálculo manual del ejemplo y otros casos controlados.

**Acceptance Scenarios**:
1. Given un día con ventas CI y recompras 24h y cauciones colocadoras en plazo 1, When selecciono el instrumento, Then veo una fila para plazo=1 con P&L Trade, P&L Caución e indicador de estado.
2. Given un día con compras CI y ventas 24h y cauciones tomadoras en plazo 2, When selecciono el instrumento, Then veo una fila para plazo=2 con el patrón ComprarCI-Vender24 y sus P&L.
3. Given cantidades desbalanceadas entre CI y 24h, When se calcula el P&L, Then se usa la menor cantidad (matchedQty) y se escalan montos por ratio, y el estado muestra “cantidades_desbalanceadas”.

---

### User Story 2 - Auditar detalles de cálculo (Priority: P2)

Como analista de riesgo, quiero expandir una fila para ver IDs y campos crudos de las operaciones CI/24h y de las cauciones utilizadas, para auditar el cálculo y rastrear cualquier discrepancia.

**Why this priority**: Trazabilidad y auditoría son esenciales para confianza y cumplimiento.

**Independent Test**: Al expandir una fila, aparecen los detalles con IDs, cantidades, precios, comisiones, montos de caución y TNA ponderada utilizada.

**Acceptance Scenarios**:
1. Given una fila con P&L calculado, When la expando, Then veo listadas las operaciones subyacentes (CI y 24h) con sus campos clave e identidades.
2. Given una fila con caución, When la expando, Then veo los tramos de caución que componen la TNA ponderada y sus montos/principales.

---

### User Story 3 - Ordenar y ver totales (Priority: P3)

Como trader, quiero ordenar la tabla por P&L Total descendente y ver los totales del día para el instrumento seleccionado, para priorizar revisiones y entender el resultado agregado.

**Why this priority**: Acelera la toma de decisiones y el control del resultado total.

**Independent Test**: La tabla se ordena por P&L Total desc. y se muestran totales (P&L Trade, P&L Caución, P&L Total) para el instrumento.

**Acceptance Scenarios**:
1. Given múltiples filas/plazos, When aplico orden por P&L Total desc., Then la primera fila es la de mayor P&L Total.
2. Given varias filas del mismo instrumento, When consulto los totales, Then los totales coinciden con la suma de las filas visibles.

---

### Edge Cases

- Con posición: patrón 1 asume venta desde inventario (no préstamo de títulos).
- Parciales: recompras/ventas en 24h en múltiples tickets generan matches parciales; P&L suma los parciales.
- Sin caución registrada: estado “matched_sin_caucion”; intereses considerados 0 o estimados si la configuración lo habilita [NEEDS CLARIFICATION: ¿Habilitar estimación de interés con TNA por defecto cuando no hay caución?].
- Moneda distinta entre instrumento y caución: convertir con tipo de cambio del día definido por política de FX antes del P&L de caución [NEEDS CLARIFICATION: Fuente y timestamp del FX a utilizar].
- Base de días: 360 por defecto; parametrizable en configuración.
- Ventana temporal: matching dentro del día operativo con tolerancia de minutos para registros contiguos [NEEDS CLARIFICATION: Definir “jornada activa” y zona horaria].

## Requirements (mandatory)

### Functional Requirements

- FR-001: Debe existir un filtro superior de Instrumento cuyo alcance se limita a la página “Arbitraje de Plazos” (no afecta otras páginas ni es afectado por ellas).
- FR-002: Para el instrumento seleccionado y el día activo, el sistema debe consolidar operaciones en cuatro buckets: Ventas CI, Compras 24h, Compras CI, Ventas 24h.
- FR-003: Para cada plazo (tenor) presente en cauciones del instrumento, el sistema debe calcular TNA ponderada por monto para caución Colocadora y Tomadora, con reglas de fallback: usar la del otro tipo si existe; si ninguna existe, usar una TNA por defecto configurable.
- FR-004: Para cada plazo, el sistema debe calcular matchedQty1=min(totalQtySellCI,totalQtyBuy24) y matchedQty2=min(totalQtyBuyCI,totalQtySell24), escalar los flujos netos por sus ratios y obtener pnl_trade_1 y pnl_trade_2, restando comisiones proporcionalmente a la cantidad utilizada.
- FR-005: Debe calcularse el interés de caución por patrón: interes_colocadora_1=cash_base_1*TNA_colocadora*(días/base) e interes_tomadora_2=cash_base_2*TNA_tomadora*(días/base), con base de días por defecto 360 y días=plazo.
- FR-006: Debe calcularse y mostrarse, por fila (Instrumento+Plazo+Patrón), P&L Trade, P&L Caución, P&L Total y el Estado (completo/sin_caucion/cantidades_desbalanceadas/sin_contraparte/matched_sin_caucion).
- FR-007: La tabla debe permitir ordenar por P&L Total descendente y resaltar P&L positivos en verde y negativos en rojo; debe indicar con badge cuando hay parciales o unmatched.
- FR-008: Debe existir capacidad de expandir una fila para ver detalle de operaciones y cauciones subyacentes, incluyendo IDs y campos crudos relevantes.
- FR-009: Debe mostrarse en la parte superior un bloque de totales para el instrumento: suma de P&L Trade, P&L Caución y P&L Total del día.
- FR-010: Debe ofrecer una vista alternativa compacta por instrumento, con P&L del día y acción “Ver detalles” para abrir el desglose por matches.
- FR-011: Los siguientes parámetros deben ser configurables: tolerancia de monto (default 0.5%), TNA por defecto (default 30% TNA), base de días (default 360) y tolerancia temporal para matching.
- FR-012: En ausencia de caución para un plazo/tipo, los intereses se consideran 0; si la opción de estimación está habilitada, se utilizará la TNA por defecto para estimar el interés y se marcará como “estimado”.
- FR-013: Si existe discrepancia de moneda entre instrumento y caución, debe aplicarse conversión según política de FX definida; si no hay FX disponible, el estado debe indicar “requiere FX” y P&L de caución=0.

### Key Entities (data)

- Instrumento: Identificador y metadatos necesarios para filtrar y mostrar.
- Operación CI: { id, instrumento, lado (C/V), fechaHora, cantidad, precio, comisiones, total, venue:"CI" }.
- Operación 24h: { id, instrumento, lado (C/V), fechaHora, cantidad, precio, comisiones, total, venue:"24h" }.
- Caución: { id, tipo (colocadora|tomadora), inicio, fin, monto (principal), tasa (TNA), interes, tenorDias (plazo), referencia? }.
- Grupo Instrumento+Plazo: unidad de agregación diaria que concentra buckets, TNAs ponderadas y resultados por patrón.
- Resultado de Patrón: { patrón, matchedQty, precios promedio ponderados del match, pnl_trade, pnl_caucion, pnl_total, estado }.

### Assumptions & Constraints

- Periodo fijo 1 día (jornada activa de la app); no hay selector de fecha.
- Patrón 1 asume posición previa (no venta corta ni costos de préstamo de títulos).
- No se hace matching por ticket; se usan mínimas cantidades con escalamiento por ratio.
- Sin pruebas automatizadas en esta entrega; validación manual con ejemplos controlados.

## Success Criteria (mandatory)

### Measurable Outcomes

- SC-001: Al seleccionar un instrumento con datos del día, los totales (P&L Trade, P&L Caución, P&L Total) deben coincidir con un cálculo manual independiente en ±0.5% para al menos 3 días de prueba.
- SC-002: Para casos con cantidades desbalanceadas, el matchedQty y los P&L escalados deben verificarse contra una planilla de referencia, coincidiendo en ±1 unidad monetaria por fila.
- SC-003: Usuarios pueden identificar el P&L total por instrumento y plazo en menos de 10 segundos desde que se muestra la página, incluyendo uso de ordenamiento por P&L Total.
- SC-004: La vista de detalle debe permitir rastrear cada fila hasta los IDs de operaciones y cauciones utilizadas en el cálculo en el 100% de los casos mostrados.
- SC-005: Estados deben reflejar correctamente las condiciones “completo”, “sin_caucion”, “cantidades_desbalanceadas”, “sin_contraparte” o “matched_sin_caucion” en el 100% de los escenarios de prueba definidos en Edge Cases.
