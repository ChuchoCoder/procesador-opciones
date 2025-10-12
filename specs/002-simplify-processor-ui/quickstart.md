# Quickstart (Simplified Processor UI)

Guía rápida para validar la nueva experiencia de filtrado por grupos posterior al procesamiento.

## 1. Preparación

- Node.js 18+ y npm instalados.
- Repositorio clonado localmente.
- CSV de prueba, por ejemplo `frontend/tests/integration/data/GGAL-PUTS.csv`.

## 2. Ejecutar la SPA

```cmd
cd C:\git\procesador-opciones-2\frontend
npm install
npm run dev
```

Abrí `http://localhost:5173` en el navegador.

## 3. Procesar un archivo

1. Entrá a la pestaña "Procesador" (se abre por defecto).
2. Arrastrá o seleccioná el CSV de prueba.
3. Hacé clic en **Procesar**.
4. Observá que los grupos detectados aparecen como chips arriba de la tabla.

## 4. Filtrar por grupo

- Seleccioná un chip (por ejemplo `GFG O`) para aplicar el filtro.
- El panel de resumen actualiza los totales CALLS / PUTS en base al filtro activo.
- Si solo existe un grupo, queda seleccionado automáticamente y no se muestra la opción "All".

## 5. Exportar resultados

- Usá los botones "Descargar CALLS", "Descargar PUTs" o "Descargar todo" según la necesidad.
- El CSV generado respeta el filtro vigente (verificado por la prueba `processor-puts.spec.jsx`).

## 6. Cambiar promedios

- Activá o desactivá el switch **Promediar por strike**.
- Confirmá que la tabla y el resumen reflejan la vista seleccionada sin reprocesar el archivo.

## 7. Checklist rápida

- [ ] El filtro de grupos aparece tras procesar un CSV con múltiples símbolos/vencimientos.
- [ ] Seleccionar un grupo cambia los totales en el resumen y limita las acciones de copia/exportación.
- [ ] Las acciones "Descargar" generan CSVs alineados con la vista actual.
- [ ] El switch de promedios mantiene el grupo seleccionado.

---
_Quickstart creado para la iteración 002-simplify-processor-ui (es-AR)._ 
