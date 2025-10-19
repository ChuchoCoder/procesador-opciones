# Data Model: Arbitraje de Plazos

**Date**: 2025-10-18  
**Feature**: 006-arbitraje-de-plazos  

## Entities

### Instrumento

- **Fields**: id (string), symbol (string), name (string), currency (string)
- **Validation**: Required for filtering
- **Relationships**: Referenced by Operación CI/24h, Caución

### Operación CI

- **Fields**: id (string), instrumento (string), lado ('C'|'V'), fechaHora (Date), cantidad (number), precio (number), comisiones (number), total (number), venue ('CI')
- **Validation**: cantidad > 0, precio > 0, fechaHora within jornada activa
- **Relationships**: Belongs to Instrumento

### Operación 24h

- **Fields**: id (string), instrumento (string), lado ('C'|'V'), fechaHora (Date), cantidad (number), precio (number), comisiones (number), total (number), venue ('24h')
- **Validation**: cantidad > 0, precio > 0, fechaHora within jornada activa
- **Relationships**: Belongs to Instrumento

### Caución

- **Fields**: id (string), instrumento (string), tipo ('colocadora'|'tomadora'), inicio (Date), fin (Date), monto (number), tasa (number), interes (number), tenorDias (number), referencia (string?), currency (string)
- **Validation**: monto > 0, tasa >= 0, tenorDias > 0, currency matches instrumento
- **Relationships**: Belongs to Instrumento

### Grupo Instrumento+Plazo

- **Fields**: instrumento (string), plazo (number), jornada (Date), ventasCI (array of Operación), compras24h (array), comprasCI (array), ventas24h (array), cauciones (array of Caución)
- **Validation**: Aggregated from operations and cauciones
- **Relationships**: Aggregates operations and cauciones

### Resultado de Patrón

- **Fields**: patrón (string), matchedQty (number), precioPromedio (number), pnl_trade (number), pnl_caucion (number), pnl_total (number), estado (string)
- **Validation**: pnl_total = pnl_trade + pnl_caucion, estado in ['completo', 'sin_caucion', 'cantidades_desbalanceadas', 'sin_contraparte', 'matched_sin_caucion']
- **Relationships**: Belongs to Grupo Instrumento+Plazo

## State Transitions

- Operations: Created from data import, immutable
- Caución: Created from data, immutable
- Grupo: Computed on demand from operations and cauciones
- Resultado: Computed from Grupo
