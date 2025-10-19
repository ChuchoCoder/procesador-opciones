# data-model.md

## Entities

### RepoOperation
- id: string (operation identifier)
- principalAmount: number (P)
- baseAmount: number (B)
- priceTNA: number (annualized rate in percent)
- tenorDays: integer (d)
- role: enum ["colocadora", "tomadora"]
- currency: enum ["ARS", "USD"]
- instrument: object
  - cfiCode: string (must start with 'RP')
  - displayName: string (contains tenor suffix e.g., "1D")
- metadata: object (free-form)

Validation rules:
- `cfiCode` MUST start with `RP` for repo calculations to apply (FR-001)
- `tenorDays` MUST be parsed from instrument.displayName; if missing or <=0 then set expenses to zero and log WARN (FR-014)
- `baseAmount` reconciliation: abs(baseAmount - (principalAmount + accruedInterest)) <= 0.01 else log WARN (FR-012)

### RepoFeeConfiguration
- arancelCaucionColocadora: object {ARS: number, USD: number} (percentage)
- arancelCaucionTomadora: object {ARS: number, USD: number} (percentage)
- derechosDeMercadoDailyRate: object {ARS: number, USD: number} (percentage, daily)
- gastosGarantiaDailyRate: object {ARS: number, USD: number} (percentage, daily)
- ivaRepoRate: number (multiplier e.g., 0.21)
- overridesMetadata: array of {currency: string, role: string, previousValue: number, effectiveDate: string}

Validation rules:
- All required rates must exist for operation currency & role; otherwise block calculations and surface error (FR-016, FR-028)

### RepoExpenseBreakdown
- repoOperationId: string
- arancelAmount: number
- derechosMercadoAmount: number
- gastosGarantiaAmount: number
- ivaAmount: number
- totalExpenses: number
- netSettlement: number
- accruedInterest: number
- rounding: object {displayDecimals: 2, roundingMode: "HALF_UP"}

## Relationships
- RepoOperation references RepoFeeConfiguration by currency
- RepoExpenseBreakdown belongs to a RepoOperation

## State transitions
- New RepoOperation (raw import) -> Parsed (tenor parsed) -> Validated (fees available) -> Calculated (expense breakdown) -> Displayed


