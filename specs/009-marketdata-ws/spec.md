# Feature Specification: Market Data (WebSocket)

**Feature Branch**: `001-marketdata-ws`
**Created**: 2025-10-25
**Status**: Draft
**Input**: User description: "Como usuario autenticado en la Broker API, quiero que la aplicación obtenga market data en tiempo real por web socket. Suscribirse a MarketData en tiempo real a través de WebSocket..."

## User Scenarios & Testing *(mandatory)*

tests_requested: false

### User Story 1 - Subscribir y recibir Market Data en tiempo real (Priority: P1)

Como usuario autenticado en la Broker API, quiero suscribirme via WebSocket a Market Data de instrumentos específicos para recibir actualizaciones asíncronas del libro y otros entries (OF, BI, LA, TV, etc.) sin tener que realizar requests repetidos.

**Why this priority**: Recibir datos de mercado en tiempo real es crítico para mostrar precios, niveles de book y volumen actualizados, mejorar la experiencia de trading y permitir decisiones operativas oportunas.

**Independent Test**: Con una sesión válida WebSocket (con token), suscribir instrumentos y entries, generar cambios simulados en el servidor y verificar que la UI recibe y muestra mensajes `Md` por instrumento y entry; validar que el payload contiene los campos esperados y que la suscripción respeta el parámetro `depth`.

**Acceptance Scenarios**:

1. **Given** usuario autenticado por la Broker API y conexión WebSocket establecida, **When** la app envía el mensaje de suscripción (`type: "smd"`) con `products`, `entries` y `depth`, **Then** el servidor confirma o mantiene la suscripción y la app comienza a recibir mensajes `Md` para cada instrumento suscripto cuando su market data cambie.
2. **Given** la suscripción con `depth: 2`, **When** el servidor envía updates, **Then** el message `marketData` incluye arrays para la entry solicitada (por ejemplo, `OF` con dos niveles cuando hay profundidad 2) y cada item tiene `price` y `size`.
3. **Given** el usuario desconecta o la sesión expira, **When** la conexión WebSocket se interrumpe, **Then** la app debe marcar el estado de MD como inactivo, dejar de procesar mensajes y ofrecer la posibilidad de reconectar o re-suscribir al restaurar la sesión.
4. **Given** el usuario cambia la lista de `products` a los que está suscrito (agregar/quitar), **When** la app envía el mensaje `smd` actualizado, **Then** la suscripción activa en el servidor debe reflejar los cambios (el servidor deja de enviar MD para los instrumentos removidos y envía para los nuevos).

---

### User Story 2 - Control de entries y profundidad (Priority: P2)

Como usuario/operador, quiero indicar explícitamente qué `entries` (OF, BI, LA, TV, etc.) y qué `depth` del book deseo recibir para optimizar ancho de banda y latencia.

**Independent Test**: Suscribir con distintas combinaciones de `entries` y `depth` y verificar que los mensajes recibidos contienen únicamente las entradas solicitadas y la profundidad esperada.

**Acceptance Scenarios**:

1. **Given** suscripción con `entries:["OF","BI"]` y `depth:1`, **When** el servidor envía MD, **Then** el payload incluye únicamente `OF` y `BI` con un único nivel cada una.
2. **Given** `entries` que no aplican para un instrumento (por ejemplo EV/NV en un instrumento no-ByMA), **When** se suscribe, **Then** el servidor puede omitir esos entries para ese instrumento y la app debe manejar la ausencia sin error.

---

### User Story 3 - Manejo de reconexión y re-suscripción (Priority: P2)

Como usuario, quiero que la app reestablezca la conexión WebSocket y re-aplique las suscripciones automáticamente cuando la conexión se pierda y la sesión siga siendo válida.

**Independent Test**: Forzar desconexión del socket, mantener token válido, y verificar que la app vuelve a conectar y reenvía el mensaje `smd` para restaurar las suscripciones en menos de N segundos (operativo).

**Acceptance Scenarios**:

1. **Given** pérdida temporal de conexión y token aún válido, **When** la red se restablece, **Then** la app re-conecta y re-suscribe automáticamente sin intervención del usuario.
2. **Given** token expirado durante reconexión, **When** la app obtiene token nuevo (por refresco o login), **Then** la app re-conecta y re-suscribe; si no hay token, la app no intenta re-suscribir hasta que el usuario autentique.

---

### Edge Cases

- Mensajes duplicados: el cliente debe detectar y deduplicar actualizaciones que no cambien el estado (por ejemplo usando un `sequenceId` si existe o comparando timestamps/values).
- `entries` no soportados por servidor/instrumento: manejar silenciosamente (ignore) y reportar en logs diagnóstico.
- Suscripción masiva (miles de instrumentos): manejar límites de memoria/throughput; la UI debe permitir suscribir a listas razonables y paginar/segmentar si es necesario.
- Cambios de símbolo o instrumentId: si un instrumento deja de existir, el servidor puede enviar notificación; cliente debe limpiar la suscripción localmente.

## Parsed Concepts (actors / actions / data / constraints)

- Actors:
  - Usuario autenticado (Broker API session / token)
  - Cliente Web (app frontend) con WebSocket
  - Broker WebSocket server (envía mensajes `Md` a suscriptores)

- Actions:
  - Establecer conexión WebSocket autenticada
  - Enviar mensaje de suscripción `smd` con `products`, `entries`, `level`/`depth`
  - Recibir mensajes `Md` por instrumento con `marketData` para las entries solicitadas
  - Re-suscribir automáticamente tras reconexión

- Data:
  - Mensaje de suscripción (ej. `{"type":"smd","level":1,"entries":["OF"],"products":[{...}],"depth":2}`)
  - Mensaje de Market Data (`{"type":"Md","instrumentId":{...},"marketData":{"OF":[{price,size},...]}}`)
  - Entries: `BI`, `OF`, `LA`, `OP`, `CL`, `SE`, `HI`, `LO`, `TV`, `OI`, `IV`, `EV`, `NV`, `ACP`

- Constraints / Non-functional:
  - Solo operar si el usuario está autenticado (token válido)
  - Respetar límites de mensajes y suscripciones (server-side); implementar backoff y limit checks en cliente
  - Minimizar uso de CPU/mem en cliente; permitir control sobre `entries` y `depth` para gestionar ancho de banda

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El cliente MUST poder establecer una conexión WebSocket autenticada con la Broker API usando el token de sesión cuando el usuario esté autenticado.
- **FR-002**: El cliente MUST enviar mensajes de suscripción con `type: "smd"`, `entries`, `products` y `depth` para indicar qué instrumentos y qué datos recibir.
- **FR-003**: El cliente MUST procesar mensajes de Market Data (`type: "Md"`) recibidos del servidor y propagar cambios a la capa UI/consumers relevantes.
- **FR-004**: El cliente MUST soportar especificar `entries` y `depth` por suscripción y solo procesar las entradas solicitadas para reducir ancho de banda.
- **FR-005**: El cliente MUST poder agregar o remover `products` de la suscripción en tiempo real (enviar `smd` actualizado) sin reiniciar la conexión.
- **FR-006**: El cliente MUST manejar reconexión automática con re-suscripción solo si existe una sesión válida; si no hay sesión, debe pausar intentos de re-suscripción hasta autenticación.
- **FR-007**: El cliente MUST deduplicar mensajes que no representen cambios reales (por ejemplo, comparar valor/sequence)
- **FR-008**: El cliente MUST exponer un API/handler interno para que otros módulos (book widgets, chart, orders) consuman los `marketData` en un formato simple y consistente.
- **FR-009**: El cliente MUST registrar eventos de conexión, reconexión, errores de suscripción y mensajes rechazados en logs de diagnóstico (nivel debug/info según severidad).
- **FR-010**: El cliente MUST implementar backoff exponencial en reintentos de reconexión y limitar reintentos para evitar bucles continuos (configurable, valor por defecto sugerido: 5 reintentos con backoff creciente).
- **FR-011**: El cliente MUST permitir suscribir múltiples instrumentos en un único mensaje `smd` (batch) y manejar respuestas de server-side que confirmen o indiquen errores por producto.
- **FR-012**: Las pruebas automatizadas deben cubrir: conexión y autenticación, suscripción y recepción de `Md`, reconexión y re-suscripción, manejo de `entries` y `depth`, y deduplicación.

### Key Entities *(include if feature involves data)*

### Non-Functional / Security

- WebSocket connections MAY use either ws:// or wss://, and the session token MAY be provided in either the query parameter or header, as permitted by the server. This approach is chosen for compatibility with server defaults, but implementers should be aware of the security tradeoffs (token in URL can be logged/intercepted; ws:// is not encrypted).

## Clarifications

### Session 2025-10-25

- Q: What is the required security posture for WebSocket authentication and token handling? → A: Allow both ws:// and wss://, token in query param or header.

## Success Criteria *(mandatory)*

- **SC-001**: Con una sesión válida, la app establece conexión WebSocket y suscribe a los instrumentos indicados; al generar cambios de MD simulados, el 99% de mensajes esperados se reciben y procesan en menos de 500 ms en condiciones de red razonables.
- **SC-002**: La app reestablece conexión y re-suscribe automáticamente cuando la red se recupera, en al menos el 95% de las reconexiones simuladas en pruebas automatizadas.
- **SC-003**: Suscribir con `depth: 2` devuelve arrays con longitud <= 2 para `OF`/`BI` en mensajes recibidos; las pruebas confirman cumplimiento para un conjunto de instrumentos de prueba.
- **SC-004**: Los módulos consumidores (book widgets, chart) reciben eventos normalizados del handler de MD y actualizan sin errores en el 100% de las pruebas unitarias definidas.

## Assumptions

- Autenticación WebSocket: la Broker API admite autenticación por token sobre WebSocket (header o query param) y mantiene sesiones asociadas al token.
- Mensajes `Md` contienen suficientes metadatos (timestamp o sequence) para permitir deduplicación.
- El servidor acepta suscripciones batch en un solo `smd` y administra límites de suscripción por conexión.
- Control fino de reconexión (timers, backoff) puede ser configurable por la app.

## Testing & QA

- Unit tests: No requerido en esta fase, pero recomendable para validar comportamiento en entorno real.
- Integration test (CI): No requerido en esta fase, pero recomendable para validar comportamiento en entorno real.
- E2E: No requerido en esta fase, pero recomendable para validar comportamiento en entorno real.

### Manual Validation Steps

1. Iniciar sesión y establecer WebSocket autenticado. Enviar `smd` con `products` y `entries`. Verificar recepción de `Md` para cada instrumento al cambiar datos.
2. Probar agregar y quitar `products` de la suscripción y verificar que el servidor deja de enviar MD para los removidos.
3. Forzar desconexión y comprobar re-conexión automática y re-suscripción cuando el token sigue siendo válido.
4. Suscribir con distintos `entries` y `depth` y validar que los mensajes contienen únicamente los fields solicitados.

## Notes

- Este documento describe el "qué" y "por qué". Los detalles operativos (retry timings, backoff config, implementación del reconector) se decidirán en la fase de planificación.

## Attachments / Examples

### Suscribirse a MarketData en tiempo real a través de WebSocket

Utilizando el protocolo Web Socket es posible recibir Market Data de los instrumentos especificados de manera asíncrona cuando esta cambie sin necesidad de hacer un request cada vez que necesitemos.

Para recibir este tipo de mensajes hay que suscribirse indicando los instrumentos de los cuales queremos recibir MD. El servidor enviara un mensaje de MD por cada instrumento al que nos suscribimos cada vez que este cambie.

Utilizando el protocolo Web Socket es posible recibir Market Data de los instrumentos especificados de manera asíncrona cuando esta cambie sin necesidad de hacer un request cada vez que necesitemos.

Para recibir este tipo de mensajes hay que suscribirse indicando los instrumentos de los cuales queremos recibir MD. El servidor enviara un mensaje de MD por cada instrumento al que nos suscribimos cada vez que este cambie.

Con este mensaje nos suscribimos para recibir MD de los instrumentos especificados, el servidor solamente enviará los datos especificados en la lista “entries”. El parámetro “depth” indica la profundidad del book que se desea recibir, por defecto se devuelve el top of book, es decir profundidad 1.

Mensaje enviado:

```json
{
   "type":"smd",
   "level":1,
   "entries":[
      "OF"
   ],
   "products":[
      {
         "symbol":"DLR/DIC23",
         "marketId":"ROFX"
      },
      {
         "symbol":"SOJ.ROS/MAY23",
         "marketId":"ROFX"
      }
   ],
   "depth":2
}
```

#### Mensaje de Market Data

Este es el mensaje que envía el servidor a todos los que estén suscriptos a MD del
instrumento indicado. En este caso utilizamos el ejemplo de suscripción a market data con profundidad 2.

Mensaje recibido:

```json
{
   "type":"Md",
   "instrumentId":{
      "marketId":"ROFX",
      "symbol":"DLR/DIC23"
   },
   "marketData":{
      "OF":[
         {
            "price":189,
            "size":21
         },
         {
            "price":188,
            "size":13
         }
      ]
   }
}
```

### Descripción de MarketData Entries

A continuación se presentan los datos del mercado que son posibles consultar por
medio de las API tanto REST como Web Socket. Al momento de consultar market data
es posible indicar qué tipo de market data se quiere recibir, esto normalmente es una lista separada por comas de los siguientes símbolos:

| Símbolo | Significado                  | Descripción                                                 |
|---------|------------------------------|-------------------------------------------------------------|
| BI      | BIDS                         | Mejor oferta de compra en el Book                           |
| OF      | OFFERS                       | Mejor oferta de venta en el Book                            |
| LA      | LAST                         | Último precio operado en el mercado                         |
| OP      | OPENING PRICE                | Precio de apertura                                          |
| CL      | CLOSING PRICE                | Precio de cierre de la rueda de negociación anterior        |
| SE      | SETTLEMENT PRICE             | Precio de ajuste (solo para futuros)                        |
| HI      | TRADING SESSION HIGH PRICE   | Precio máximo de la rueda                                   |
| LO      | TRADING SESSION LOW PRICE    | Precio mínimo de la rueda                                   |
| TV      | TRADE VOLUME                 | Volumen operado en contratos/nominales para ese security    |
| OI      | OPEN INTEREST                | Interés abierto (solo para futuros)                         |
| IV      | INDEX VALUE                  | Valor del índice (solo para índices)                        |
| EV      | TRADE EFFECTIVE VOLUME       | Volumen efectivo de negociación para ese security           |
| NV      | NOMINAL VOLUME               | Volumen nominal de negociación para ese security            |
| ACP     | AUCTION PRICE                | Precio de cierre del día corriente                          |

Tanto el Entry EV como NV solo van a devolver información en el caso de que se utilice para un instrumento de ByMA, para consultar el Volumen de un instrumento MATBA ROFEX deberían incluír el Entry TV.
