# Feature Specification: Daily Instruments Sync

**Feature Branch**: `008-daily-instruments-sync`  
**Created**: 2025-10-25  
**Status**: Draft  
**Input**: User description: "Diariamente, obtener la lista detallada de Instrumentos disponibles y guardarlos en local storage para usarlos en lugar de frontend/InstrumentsWithDetails.json. Sólo realizar esta operación si el usuario se encuentra conectado con la Broker API"

## User Scenarios & Testing *(mandatory)*

tests_requested: false

Per Constitution Principle 3 (Test On Request): the spec includes acceptance tests and at least one edge case per priority user story.

### User Story 1 - Automatic daily sync when connected (Priority: P1)

Como usuario autenticado en la Broker API, quiero que la aplicación obtenga diariamente la lista detallada de instrumentos y la guarde en el almacenamiento local, para que la UI use datos actualizados en lugar del archivo estático `frontend/InstrumentsWithDetails.json`.

**Why this priority**: Mantener datos de instrumentos actualizados es crítico para mostrar precios, opciones y reglas de mercado correctas; evita errores en órdenes y reduce soporte.

**Independent Test**: Con una sesión de Broker API válida, ejecutar el proceso de sincronización (manual o mediante job) y verificar que `localStorage` contiene la clave `instrumentsWithDetails` con el JSON completo y que la UI carga desde localStorage.

**Acceptance Scenarios**:

1. **Given** usuario autenticado con sesión válida, **When** el proceso de sincronización diario corre (o el usuario fuerza una sincronización), **Then** `localStorage.instrumentsWithDetails` contiene la lista y `fetchedAt` con timestamp ISO8601.
2. **Given** la respuesta de la Broker API contiene instrumentos, **When** se guarda en `localStorage`, **Then** los atributos principales (instrumentId, cficode, maturityDate, lowLimitPrice, tickPriceRanges) están presentes y accesibles.

---

### User Story 2 - Manual refresh and visibility (Priority: P2)

Como usuario, quiero poder forzar una actualización manual desde la UI (cuando esté conectado), y ver la hora de la última sincronización, para confirmar que los datos son recientes.

**Why this priority**: Facilita pruebas y resolución de problemas, y permite a operadores actualizar datos en caso de cambios intradiarios.

**Independent Test**: Con sesión válida, usar la acción "Actualizar instrumentos" y verificar que `localStorage` se actualiza y que el indicador de "Última sincronización" muestra la nueva fecha/hora.

**Acceptance Scenarios**:

1. **Given** usuario autenticado, **When** pulsa "Actualizar instrumentos", **Then** la app consulta la API, actualiza `localStorage` y muestra la nueva marca de tiempo.

---

### User Story 3 - Resilient startup fallback (Priority: P3)

Como usuario, quiero que si la sincronización falla (API indisponible o sesión inválida) la aplicación arranque usando el archivo estático para minimizar errores en la UI.

**Why this priority**: Evitar caídas de la UI y permitir operación básica aunque no se pueda actualizar remotamente.

**Independent Test**: Simular fallo de conexión o sesión y verificar que la app carga `frontend/InstrumentsWithDetails.json` y muestra un aviso discreto de que los datos podrían estar desactualizados.

**Acceptance Scenarios**:

1. **Given** no hay sesión válida o la API responde con error, **When** la app intenta sincronizar, **Then** la app usa el archivo estático y registra el error para diagnóstico.

---

### Edge Cases

- Duplicados por `instrumentId` deben deduplicarse conservando el último registro recibido.
- Instrumentos con campos nulos se almacenan y se marcan `incomplete: true` con `issues: []`.
- `localStorage` quota exceeded: se debe aplicar la política definida en FR-011 (clarification).

## Parsed Concepts (actors / actions / data / constraints)

- Actors:
  - Usuario autenticado (Broker API session)
  - Aplicación frontend (componente de sincronización)
- Actions:
  - Obtener diariamente la lista detallada de instrumentos mediante GET /rest/instruments/details
  - Guardar resultado en `localStorage` y exponerlo a la UI
  - Fallback a archivo estático cuando no hay sesión o la petición falla
- Data:
  - Lista de `InstrumentDetails` con campos: instrumentId, segment, lowLimitPrice, highLimitPrice, minPriceIncrement, tickPriceRanges, maturityDate, cficode, securityDescription, currency, orderTypes, timesInForce, etc.
- Constraints / Non-functional:
  - Sólo ejecutar cuando el usuario está conectado (token válido)
  - Respetar límites de `localStorage` del navegador
  - Respetar rate-limits y realizar reintentos con backoff (máx 3 reintentos en 5 minutos)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST intentar obtener diariamente la lista detallada de instrumentos desde la Broker API (`GET https://BASE_URL/rest/instruments/details`) solo si el usuario tiene una sesión activa con la Broker API.
- **FR-002**: El sistema MUST guardar el JSON completo devuelto por la API en `localStorage` bajo la clave `instrumentsWithDetails` junto con metadatos: `{ fetchedAt: ISO8601, source: 'broker-api', versionHash: <sha1> }`.
- **FR-003**: La UI MUST preferir los datos de `localStorage.instrumentsWithDetails` sobre `frontend/InstrumentsWithDetails.json` cuando exista una entrada válida.
- **FR-004**: Si el usuario NO está conectado o la solicitud falla, la app MUST usar `frontend/InstrumentsWithDetails.json` como fallback y registrar la causa del fallo en logs (nivel diagnóstico).
- **FR-005**: La operación de sincronización MUST poder ejecutarse manualmente desde la UI por usuarios autenticados para forzar actualización inmediata.
- **FR-006**: Las entradas en localStorage deben deduplicarse por `instrumentId.marketId + '|' + instrumentId.symbol` y normalizar los campos de fecha (`maturityDate`) a ISO-8601 (YYYY-MM-DD) en el metadato local.
- **FR-007**: En caso de datos incompletos, el registro guardado debe incluir `incomplete: true` y un campo `issues: []` con descripciones breves de campos faltantes.
- **FR-008**: La sincronización diaria MUST respetar límites de tasa (rate-limiting): no reintentar más de 3 veces con backoff exponencial en una ventana de 5 minutos.
- **FR-009**: Las pruebas automatizadas deben cubrir: éxito de sincronización y guardado en localStorage, fallback cuando no hay sesión, deduplicación y manejo de campos nulos.
- **FR-010**: Definir el disparador preciso para la ejecución "diaria": la sincronización debe ejecutarse al menos una vez por día después de 09:45 AM Hora Argentina (ART). Implementación operativa sugerida: la app intentará ejecutar la sincronización a las 09:45 ART si está abierta; si la app no está abierta en ese momento, en el próximo arranque la app comprobará la fecha de `fetchedAt` y, si no existe una sincronización realizada el mismo día (según zona horaria ART), forzará una sincronización al inicio.
- **FR-011**: Política para `localStorage` cuando el payload excede la cuota: segmentar en múltiples claves (sharding) con prefijo conocido (`instrumentsWithDetails.part.<n>`) y metadatos para recomponer en lectura. Esta política permite almacenar grandes catálogos evitando excepciones de cuota; la recomposición y validación se hará al leer los datos.
- **FR-012**: TTL / validez de los datos sincronizados: los datos se consideran válidos "hasta el próximo día hábil de mercado" (market-aware). Esto significa que, fuera de sesión de mercado o en días no hábiles, no se forzará una nueva descarga hasta el siguiente día hábil; durante días hábiles se aplicará como válida hasta la próxima apertura o sincronización diaria según FR-010.

### Key Entities *(include if feature involves data)*

- **InstrumentDetails**: Representa el objeto completo devuelto por la API para cada instrumento. Atributos relevantes: instrumentId { marketId, symbol }, securityDescription, cficode, segment { marketSegmentId, marketId }, lowLimitPrice, highLimitPrice, minPriceIncrement, tickPriceRanges, maturityDate, currency, orderTypes, timesInForce, contractMultiplier, tickSize, instrumentPricePrecision, instrumentSizePrecision, roundLot, minTradeVol, maxTradeVol.
- **BrokerSession**: Representa el estado de conexión del usuario con la Broker API (isAuthenticated, tokenExpiry, refreshTokenAvailable).
- **LocalStorageRecord**: `{ fetchedAt: ISO8601, source: 'broker-api'|'fallback-file', versionHash: string, instruments: [InstrumentDetails], issuesSummary?: {countIncomplete, duplicatesRemoved} }`

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Cuando el usuario está conectado, la sincronización diaria completa exitosamente en el 95% de los días en un periodo de 30 días (excluyendo ventanas de mantenimiento conocidas).
- **SC-002**: La UI carga instrumentos desde `localStorage` y despliega la lista inicial en menos de 1.5 segundos (aplicable para catálogos de hasta 5k instrumentos) en dispositivos de escritorio razonables.
- **SC-003**: En pruebas automatizadas, el 100% de los casos P1 y P2 (sincronización exitosa y fallback) pasan en CI.
- **SC-004**: Tras la sincronización manual, `fetchedAt` refleja el tiempo de la operación y el usuario ve la nueva hora en la UI inmediatamente.
- **SC-005**: Los datos guardados no contienen duplicados por `instrumentId`; las pruebas confirman deduplicación para entradas duplicadas simuladas.

## Assumptions

- El cliente (navegador) tiene suficiente quota de `localStorage` para guardar el JSON de instrumentos. Si el tamaño excede el límite de `localStorage`, la app deberá usar la política definida en FR-011.
- Periodicidad: "Diariamente" se interpreta como una ejecución programada una vez al día; el mecanismo exacto se definirá tras resolver FR-010.
- Formato de fecha: `maturityDate` en la API puede venir en formato `YYYYMMDD`; la app normalizará a `YYYY-MM-DD` al guardar.
- El usuario autenticado significa: existe token válido y el estado `BrokerSession.isAuthenticated === true`.

## Testing & QA

- Unit tests: No requerido
- Integration test (CI): No requerido
- E2E: No requerido

### Manual Validation Steps

1. Conectar con una sesión válida y forzar sincronización desde UI. Verificar `localStorage.instrumentsWithDetails` y la marca `fetchedAt`.
2. Invalidar sesión y recargar la app: comprobar que la fuente de datos es el archivo `frontend/InstrumentsWithDetails.json` y que existe un aviso discreto sobre la falta de conexión.
3. Probar respuesta con duplicados y campos nulos: validar que `issues` y `incomplete` aparecen y que no hay duplicados.

## Notes

- No se incluyen detalles de implementación (frameworks/paths internos) en este documento; la fase de planificación definirá exacto hook de scheduling y manejo de cuota de localStorage.

## Attachments / Example API Response

Se adjunta en la especificación el esquema de ejemplo devuelto por la Broker API con los campos esperados.

### Obtener Lista detallada de Instrumentos disponibles

Devuelve una lista con todos los instrumentos pero se agrega una descripción detallada de cada uno de ellos. Por cada instrumento devuelve datos de segmento, precio mínimo/máximo, vencimiento, etc.

HTTP request
GET https://BASE_URL/rest/instruments/details

Respuesta:

```json
{
   "status":"OK",
   "instruments":[
      {
         "symbol":null,
         "segment":{
            "marketSegmentId":"DDA",
            "marketId":"ROFX"
         },
         "lowLimitPrice":0.1,
         "highLimitPrice":100,
         "minPriceIncrement":0.1,
         "minTradeVol":1,
         "maxTradeVol":20,
         "tickSize":1,
         "contractMultiplier":100,
         "roundLot":1,
         "priceConvertionFactor":1,
         "maturityDate":"20231123",
         "currency":"USD",
         "orderTypes":[
            "STOP_LIMIT",
            "MARKET_TO_LIMIT",
            "LIMIT"
         ],
         "timesInForce":[
            "FOK",
            "IOC",
            "DAY",
            "GTD"
         ],
         "securityType":null,
         "settlType":null,
         "instrumentPricePrecision":1,
         "instrumentSizePrecision":0,
         "securityId":null,
         "securityIdSource":null,
         "securityDescription":"TRI.ROS/DIC23 352 C",
         "tickPriceRanges":{
            "0":{
               "lowerLimit":0,
               "upperLimit":null,
               "tick":0.1
            }
         },
         "cficode":"OCAFXS",
         "instrumentId":{
            "marketId":"ROFX",
            "symbol":"TRI.ROS/DIC23 352 C"
         }
      },
      {
         "symbol":null,
         "segment":{
            "marketSegmentId":"DDF",
            "marketId":"ROFX"
         },
         "lowLimitPrice":161.2,
         "highLimitPrice":201.2,
         "minPriceIncrement":0.05,
         "minTradeVol":1,
         "maxTradeVol":10000,
         "tickSize":1,
         "contractMultiplier":1000,
         "roundLot":1,
         "priceConvertionFactor":1,
         "maturityDate":"20221230",
         "currency":"ARS",
         "orderTypes":[
            "STOP_LIMIT",
            "MARKET_TO_LIMIT",
            "MARKET",
            "LIMIT"
         ],
         "timesInForce":[
            "IOC",
            "DAY",
            "GTD"
         ],
         "securityType":null,
         "settlType":null,
         "instrumentPricePrecision":2,
         "instrumentSizePrecision":0,
         "securityId":null,
         "securityIdSource":null,
         "securityDescription":"DLR/DIC22",
         "tickPriceRanges":{
            "0":{
               "lowerLimit":0,
               "upperLimit":null,
               "tick":0.05
            }
         },
         "cficode":"FXXXSX",
         "instrumentId":{
            "marketId":"ROFX",
            "symbol":"DLR/DIC22"
         }
      }
   ]
}
```
