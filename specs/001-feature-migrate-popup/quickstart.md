# Quickstart (es-AR)

Guía rápida para ejecutar y usar la nueva SPA React del Procesador de Opciones.

## 1. Requisitos

- Node.js 18+ (npm incluido)
- Git

## 2. Instalación

```cmd
cd C:\git\procesador-opciones\frontend
npm install
```

## 3. Ejecutar en desarrollo

```cmd
npm run dev
```

Abrí `http://localhost:5173`.

## 4. Probar con un CSV mínimo

Creá un archivo `sample.csv`:
```
event_subtype,ord_status,text,order_id,symbol,side,last_price,last_qty
execution_report,Ejecutada,,1,GGALC30ENE,BUY,12.5,3
execution_report,Ejecutada,,2,GGALC30ENE,SELL,13,2
```

Pasos:
1. Elegí símbolo GGAL y vencimiento ENE (si existen; agregalos en Configuración si no).
2. Activá o desactivá "Promediar por strike" para comparar.
3. Seleccioná el archivo y presioná Procesar.

## 5. Revisar tablas y acciones

- Cambiá entre CALLS / PUTS.
- Mirá el resumen para verificar totales.
- Usá las acciones para copiar o descargar la vista actual.

## 6. Configuración

En la pestaña Configuración podés:
- Agregar símbolos (ticker en mayúsculas, sin espacios)
- Agregar vencimientos (nombre + uno o más sufijos)
- Marcar símbolo y vencimiento activos
- Restaurar valores por defecto

Los cambios se guardan automáticamente (localStorage).

## 7. Scripts disponibles

```cmd
npm run dev        # Servidor desarrollo
npm run build      # Build producción (dist)
npm test           # Ejecutar pruebas
npm run test:watch # Modo watch
npm run lint       # Linter
npm run lint:fix   # Linter con autofix
```

## 8. Checklist rápida (manual)

- [ ] Procesa CSV pequeño (<500 filas) sin demoras perceptibles
- [ ] Cambiar switch de promedios actualiza tabla sin recargar página
- [ ] Advertencia visible para CSV grande (>25k filas) (usar archivo sintético)
- [ ] Persisten símbolo / vencimiento tras recargar
- [ ] Exportar (copiar y descargar) genera datos consistentes

## 9. Problemas comunes

| Situación | Posible causa | Acción |
|-----------|---------------|-------|
| No aparece nada | Error en consola | Revisar logs `PO:` y recargar |
| Copiar falla | Restricción navegador | Reintentar con foco / permitir portapapeles |
| Lento | Archivo muy grande | Considerar dividir archivo |

## 10. Próximos pasos

- Integrar build con empaquetado MV3
- Mejores mensajes de errores de parseo
- Métricas de performance

---
_Quickstart actualizado (migración React, es-AR)._ 
