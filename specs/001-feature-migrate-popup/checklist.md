# Checklist Smoke Test (es-AR)

Use este checklist para validar rápidamente una build local de la SPA.

## 1. Inicio

- [ ] `npm run dev` levanta sin errores
- [ ] La app carga en el navegador (título visible)

## 2. Configuración inicial

- [ ] Lista de símbolos por defecto se muestra
- [ ] Lista de vencimientos por defecto se muestra
- [ ] Agregar símbolo nuevo funciona (aparece en lista)
- [ ] Eliminar símbolo lo quita de la lista
- [ ] Agregar vencimiento con sufijo funciona
- [ ] Marcar símbolo y vencimiento activos persiste tras recargar

## 3. Procesamiento CSV (pequeño ~10 filas)

- [ ] Archivo procesa sin advertencias
- [ ] Tabla CALLS con filas esperadas
- [ ] Tabla PUTS con filas esperadas (o vacía si no hay)
- [ ] Resumen muestra totales consistentes

## 4. Toggle promedios

- [ ] Activar "Promediar por strike" reduce cantidad de filas cuando hay múltiples fills mismo strike
- [ ] Desactivar vuelve a mostrar filas originales
- [ ] Totales (suma de cantidades) se mantienen lógicamente consistentes tras cambio

## 5. Exportaciones / Copia

- [ ] Copiar vista actual genera contenido en portapapeles (verificar pegando en editor)
- [ ] Descargar vista actual genera CSV válido
- [ ] Descargar CALLS / PUTS generan archivos separados
- [ ] Descargar combinado incluye ambas secciones

## 6. Advertencias grandes volúmenes

- [ ] CSV >25.000 filas muestra advertencia de “archivo grande”
- [ ] Procesamiento no bloquea UI > (esperar feedback visual de progreso si aplica)
- [ ] Corte duro a 50.000 filas respeta límite (validar conteo)

## 7. Persistencia

- [ ] Refrescar conserva símbolo activo
- [ ] Refrescar conserva vencimiento activo
- [ ] Refrescar conserva estado del switch de promedios

## 8. Limpieza / Reset

- [ ] Restaurar valores por defecto repone símbolos y vencimientos originales
- [ ] Limpiar datos procesados (si la acción existe) elimina tablas

## 9. Errores controlados

- [ ] CSV con columnas faltantes dispara mensaje de error
- [ ] Fila corrupta se ignora sin quebrar el procesamiento completo

## 10. Performance (orientativo)

- [ ] CSV 1.000 filas procesa < 300ms en máquina local estándar
- [ ] Toggle promedios aplica cambios < 150ms (perceptivamente instantáneo)

## 11. Accesibilidad / UX rápida

- [ ] Navegación por teclado entre controles clave funciona
- [ ] Focus visible en botones de acción

## 12. Localización

- [ ] Textos principales en español (ver `strings/es-AR.js`)
- [ ] No hay strings hardcodeadas en inglés en UI visible

## 13. Consola

- [ ] Sin errores rojos
- [ ] Logs `PO:` sólo en modo desarrollo

---
_Actualizar este checklist conforme se agreguen nuevas capacidades._
