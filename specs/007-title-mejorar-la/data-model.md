# Data Model — Mejorar la visualización del arbitraje de plazos

Entities extracted from feature spec:

- Instrumento
  - id (string) — unique identifier (ticker/Codigo)
  - nombre (string)
  - mercado (string)
  - ultimo_precio (number) — last known price (optional)

- Operación
  - id (string)
  - instrumento_id (string) — FK to Instrumento.id
  - tipo (enum: 'compra' | 'venta')
  - origen (enum: 'CI' | '24H')
  - fecha_hora (ISO8601 string)
  - cantidad (number)
  - precio (number)
  - comisiones (object) — may contain subfields e.g. { tomadora: number, colocadora: number }
  - DM (number)
  - cauciones (number)
  - resultado_calculo (number)

- CálculoDetalle (computed)
  - instrumento_id (string)
  - lado (string) — 'Venta CI' | 'Compra 24H'
  - importe_total (number)
  - comisiones_total (number)
  - DM (number)
  - importe_a_caucionar (number)
  - interes_bruto (number)
  - interes_neto (number)
  - arancel (number)
  - gastos_garantia (number)
  - IVA (number)
  - subtotal_gastos (number)
  - total_neto (number)

Validation rules (from FR-011 / FR-012):
- Numeric fields must be finite numbers; missing components should be represented as null and displayed as "No disponible" in UI.
- Subtotal_gastos = comisiones_total + DM + arancel + gastos_garantia + IVA. Implementations should verify these reconciliations during development and QA.

State transitions:
- Expanded row: none -> loading -> loaded (cached) OR error (with retry)
- Navigation: main view -> instrument detail (preserve filters/sort in navigation state)
