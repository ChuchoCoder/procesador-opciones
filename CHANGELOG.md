# Changelog

Todas las modificaciones notables de este proyecto se documentarán en este archivo.

## [Unreleased]

### Agregado

- Migración inicial a estructura SPA React + Vite (en paralelo al popup legacy).
- Lógica de promedios por strike con precio promedio ponderado.
- Suite de pruebas unitarias e integración (Vitest + Testing Library).
- Internacionalización base `es-AR` para la nueva interfaz.
- Documentación renovada (README en es-AR, quickstart, checklist smoke test).

### Cambiado

- Refactor layout (removido Grid v1 MUI legacy → nuevos contenedores flex/stack).
- Normalización de formato numérico: mantenimiento de hasta 4 decimales internos.

### Herramientas

- Incorporado ESLint (reglas: recommended, react-hooks, react-refresh) y Prettier.

### Pendiente

- Integrar build de la SPA al empaquetado final MV3.
- Documentar empaquetado final y distribución.

## [1.0.2] - 2025-10-08

- Ajuste: precios ahora mantienen 4 decimales en cálculo y visualización.
- Cálculo de promedios y sanitización sin truncar a 2 decimales.

## [1.0.1] - 2025-10-07

- Fix: corrección del error al procesar operaciones con cantidades iguales a 0.

## [1.0.0] - 2025-10-01

- Versión inicial pública del procesador de opciones.
