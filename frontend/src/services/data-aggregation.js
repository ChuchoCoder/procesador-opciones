/**
 * Data Aggregation Service for Arbitrage Operations
 * Groups operations and cauciones by instrument and plazo
 */

import { createGrupoInstrumentoPlazo, VENUES, LADOS } from './arbitrage-types.js';
import { calculateCIto24hsPlazo, calculateCalendarDays } from './business-days.js';

/**
 * Aggregate operations and cauciones by instrument and plazo
 * Calculates plazo based on CI and 24hs settlement dates (accounting for weekends/holidays)
 * 
 * @param {import('./arbitrage-types.js').Operacion[]} operations - All operations
 * @param {import('./arbitrage-types.js').Caucion[]} cauciones - All cauciones  
 * @param {Date} jornada - Trading day
 * @returns {Map<string, import('./arbitrage-types.js').GrupoInstrumentoPlazo>} Map keyed by "instrumento:plazo"
 */
export function aggregateByInstrumentoPlazo(operations, cauciones, jornada) {
  const grupos = new Map();
  
  // First pass: group operations by instrument and detect plazo
  const instrumentMap = new Map(); // instrumento -> { ciDates: [], h24Dates: [] }
  
  operations.forEach((op) => {
    if (!instrumentMap.has(op.instrumento)) {
      instrumentMap.set(op.instrumento, { ciDates: [], h24Dates: [] });
    }
    
    const instData = instrumentMap.get(op.instrumento);
    
    // Store timestamps (not Date objects) for proper Math.min comparison
    const timestamp = op.fechaHora instanceof Date ? op.fechaHora.getTime() : new Date(op.fechaHora).getTime();
    
    // Debug: Log first operation to see what date we're getting
    if (instData.ciDates.length === 0 && instData.h24Dates.length === 0) {
      console.log(`First ${op.instrumento} operation:`, {
        fechaHora: op.fechaHora,
        timestamp,
        date: new Date(timestamp).toISOString(),
        venue: op.venue,
      });
    }
    
    if (op.venue === VENUES.CI) {
      instData.ciDates.push(timestamp);
    } else if (op.venue === VENUES.H24) {
      instData.h24Dates.push(timestamp);
    }
  });
  
  // Calculate plazo for each instrument based on actual operation dates
  const instrumentPlazos = new Map();
  
  instrumentMap.forEach((dates, instrumento) => {
    let plazo = 0;
    
    if (dates.ciDates.length > 0 && dates.h24Dates.length > 0) {
      // Use earliest timestamp from both CI and 24hs operations
      const allTimestamps = [...dates.ciDates, ...dates.h24Dates];
      const earliestTimestamp = Math.min(...allTimestamps);
      const earliestDate = new Date(earliestTimestamp);
      plazo = calculateCIto24hsPlazo(earliestDate);
      console.log(`Plazo calculation for ${instrumento}:`, {
        earliestDate: earliestDate.toISOString(),
        plazo,
        ciDates: dates.ciDates.length,
        h24Dates: dates.h24Dates.length,
      });
    } else if (dates.ciDates.length > 0) {
      // Only CI operations
      const earliestDate = new Date(Math.min(...dates.ciDates));
      plazo = calculateCIto24hsPlazo(earliestDate);
      console.log(`Plazo calculation for ${instrumento} (CI only):`, {
        earliestDate: earliestDate.toISOString(),
        plazo,
      });
    } else if (dates.h24Dates.length > 0) {
      // Only 24hs operations
      const earliestDate = new Date(Math.min(...dates.h24Dates));
      plazo = calculateCIto24hsPlazo(earliestDate);
      console.log(`Plazo calculation for ${instrumento} (24h only):`, {
        earliestDate: earliestDate.toISOString(),
        plazo,
      });
    }
    
    instrumentPlazos.set(instrumento, plazo);
  });

  // Group operations by instrument and calculated plazo
  operations.forEach((op) => {
    const plazo = instrumentPlazos.get(op.instrumento) || 0;
    const key = `${op.instrumento}:${plazo}`;

    if (!grupos.has(key)) {
      grupos.set(key, createGrupoInstrumentoPlazo(op.instrumento, plazo, jornada));
    }

    const grupo = grupos.get(key);

    // Classify by venue and side
    if (op.venue === VENUES.CI && op.lado === LADOS.VENTA) {
      grupo.ventasCI.push(op);
    } else if (op.venue === VENUES.H24 && op.lado === LADOS.COMPRA) {
      grupo.compras24h.push(op);
    } else if (op.venue === VENUES.CI && op.lado === LADOS.COMPRA) {
      grupo.comprasCI.push(op);
    } else if (op.venue === VENUES.H24 && op.lado === LADOS.VENTA) {
      grupo.ventas24h.push(op);
    }
  });

  // Add cauciones to matching grupos
  // Note: PESOS cauciones create separate grupos and won't be automatically
  // linked to instrument operations without additional correlation data
  cauciones.forEach((caucion) => {
    const plazo = calculatePlazoFromDates(caucion.inicio, caucion.fin);
    const key = `${caucion.instrumento}:${plazo}`;

    if (!grupos.has(key)) {
      grupos.set(key, createGrupoInstrumentoPlazo(caucion.instrumento, plazo, jornada));
    }

    const grupo = grupos.get(key);
    grupo.cauciones.push(caucion);
  });
  
  // Calculate weighted average TNA from ALL cauciones for use in P&L calculations
  const avgTNA = calculateWeightedAverageTNA(cauciones);
  
  // Add avgTNA to all grupos that have operations (not just PESOS grupos)
  grupos.forEach((grupo) => {
    if (grupo.ventasCI.length > 0 || grupo.compras24h.length > 0 ||
        grupo.comprasCI.length > 0 || grupo.ventas24h.length > 0) {
      grupo.avgTNA = avgTNA;
    }
  });

  return grupos;
}

/**
 * Filter grupos by instrument
 * @param {Map<string, import('./arbitrage-types.js').GrupoInstrumentoPlazo>} grupos
 * @param {string|null} instrumento - Instrument to filter by, or null for all
 * @returns {import('./arbitrage-types.js').GrupoInstrumentoPlazo[]}
 */
export function filterGruposByInstrument(grupos, instrumento) {
  const gruposArray = Array.from(grupos.values());

  if (!instrumento || instrumento === 'all') {
    return gruposArray;
  }

  return gruposArray.filter((g) => g.instrumento === instrumento);
}

/**
 * Get unique instruments from grupos
 * @param {Map<string, import('./arbitrage-types.js').GrupoInstrumentoPlazo>} grupos
 * @returns {string[]} Sorted array of unique instruments
 */
export function getUniqueInstruments(grupos) {
  const instruments = new Set();
  grupos.forEach((grupo) => {
    instruments.add(grupo.instrumento);
  });
  return Array.from(instruments).sort();
}

/**
 * Calculate plazo from caución dates
 * @param {Date} inicio - Start date
 * @param {Date} fin - End date
 * @returns {number} Days between dates
 */
function calculatePlazoFromDates(inicio, fin) {
  return calculateCalendarDays(inicio, fin);
}

/**
 * Calculate weighted average TNA (Tasa Nominal Anual) from cauciones
 * Used when cauciones cannot be directly linked to specific operations
 * 
 * @param {import('./arbitrage-types.js').Caucion[]} cauciones - All cauciones
 * @returns {number} Weighted average TNA (annual rate as percentage)
 */
function calculateWeightedAverageTNA(cauciones) {
  if (!cauciones || cauciones.length === 0) {
    return 0;
  }
  
  let totalMonto = 0;
  let weightedSum = 0;
  
  cauciones.forEach((caucion) => {
    totalMonto += caucion.monto;
    weightedSum += caucion.tasa * caucion.monto;
  });
  
  if (totalMonto === 0) {
    return 0;
  }
  
  return weightedSum / totalMonto;
}

// Debug flag for logging first operation
let parseOperationsFirstLog = true;

/**
 * Parse operations from raw data
 * Converts raw CSV/API data into typed Operacion objects
 * Extracts instrument and venue from symbol (e.g., "MERV - XMEV - S31O5 - CI")
 * Skips caución operations (PESOS with plazo)
 * 
 * @param {any[]} rawOperations - Raw operation data
 * @returns {import('./arbitrage-types.js').Operacion[]}
 */
export function parseOperations(rawOperations) {
  return rawOperations
    .map((raw) => {
      try {
        // Extract instrument, venue, and plazo from symbol
        const symbolStr = raw.symbol || raw.instrumento || '';
        const { instrument, venue, isCaucion } = parseSymbol(symbolStr);
        
        // Skip cauciones - they'll be parsed separately
        if (isCaucion) {
          return null;
        }
        
        // Parse quantity and price from various field names
        const cantidad = parseFloat(
          raw.cantidad || raw.quantity || raw.last_qty || 0
        );
        const precio = parseFloat(
          raw.precio || raw.price || raw.last_price || 0
        );
        
        // Debug: Log first operation to see raw date fields
        if (parseOperationsFirstLog) {
          console.log('parseOperations - First operation raw data:', {
            symbol: raw.symbol,
            fechaHora: raw.fechaHora,
            date: raw.date,
            transact_time: raw.transact_time,
            allRawKeys: Object.keys(raw),
            rawDataSample: raw,
            rawRaw: raw.raw,
            rawRawKeys: raw.raw ? Object.keys(raw.raw) : [],
          });
          parseOperationsFirstLog = false;
        }

        // Extract date/time from nested raw object if available
        const rawData = raw.raw || raw;
        const dateField = rawData.transact_time || rawData.fechaHora || rawData.date || raw.transact_time || raw.fechaHora || raw.date;
        
        console.log('parseOperations - Date extraction:', {
          instrument,
          dateField,
          parsed: parseDate(dateField),
        });

        return {
          id: raw.id || `op-${Date.now()}-${Math.random()}`,
          order_id: raw.order_id || raw.orderId || raw.id || `op-${Date.now()}-${Math.random()}`,
          instrumento: instrument,
          lado: parseLado(raw.lado || raw.side),
          fechaHora: parseDate(dateField),
          cantidad,
          precio,
          comisiones: parseFloat(raw.feeAmount || 0), // feeAmount is added by enrichArbitrageOperations
          total: parseFloat(raw.total || cantidad * precio),
          venue,
          feeBreakdown: raw.feeBreakdown || null, // Keep fee breakdown for detailed info
        };
      } catch (error) {
        console.warn('Failed to parse operation:', raw, error);
        return null;
      }
    })
    .filter((op) => op !== null && op.cantidad > 0 && op.precio > 0);
}

/**
 * Parse cauciones from raw data
 * Handles both dedicated caución data and PESOS operations from CSV
 * For PESOS operations, calculates tasa from price spread
 * 
 * @param {any[]} rawCauciones - Raw caución data (can include CSV operations)
 * @returns {import('./arbitrage-types.js').Caucion[]}
 */
export function parseCauciones(rawCauciones) {
  return rawCauciones
    .map((raw) => {
      try {
        // Check if this is a PESOS operation from CSV
        const symbolStr = raw.symbol || raw.instrumento || '';
        const { instrument, plazo, isCaucion } = parseSymbol(symbolStr);
        
        if (isCaucion && plazo) {
          // This is a PESOS operation - convert to caución format
          const fechaOperacion = parseDate(raw.transact_time || raw.fechaHora || raw.date);
          const inicio = fechaOperacion;
          const fin = new Date(inicio);
          fin.setDate(fin.getDate() + plazo);
          
          const cantidad = parseFloat(raw.last_qty || raw.cantidad || raw.quantity || 0);
          const precio = parseFloat(raw.last_price || raw.precio || raw.price || 0);
          const monto = cantidad * precio;
          
          // Calculate tasa from price (simplified - assumes price represents tasa%)
          // In real implementation, tasa would be calculated from price spread or explicit field
          const tasa = precio; // Placeholder: assumes price field contains tasa
          const interes = monto * (tasa / 100) * (plazo / 365);
          
          // Determine tipo based on side (BUY = colocadora, SELL = tomadora)
          const lado = parseLado(raw.lado || raw.side);
          const tipo = lado === LADOS.COMPRA ? 'colocadora' : 'tomadora';
          
          // Link to underlying instrument (extract from other operations)
          // For now, use generic reference
          const referencia = raw.id || `cau-${Date.now()}-${Math.random()}`;
          
          return {
            id: raw.id || `cau-${Date.now()}-${Math.random()}`,
            instrumento: instrument,
            tipo,
            inicio,
            fin,
            monto,
            tasa,
            interes,
            tenorDias: plazo,
            referencia,
            currency: 'ARS',
            feeAmount: parseFloat(raw.feeAmount || 0), // Preserve calculated fees
            feeBreakdown: raw.feeBreakdown || null,
          };
        }
        
        // Handle dedicated caución data format
        const inicio = parseDate(raw.inicio || raw.startDate);
        const fin = parseDate(raw.fin || raw.endDate);
        const tenorDias = calculatePlazoFromDates(inicio, fin);

        return {
          id: raw.id || `cau-${Date.now()}-${Math.random()}`,
          instrumento: raw.instrumento || raw.instrument || '',
          tipo: raw.tipo || raw.type || 'colocadora',
          inicio,
          fin,
          monto: parseFloat(raw.monto || raw.amount || 0),
          tasa: parseFloat(raw.tasa || raw.rate || 0),
          interes: parseFloat(raw.interes || raw.interest || 0),
          tenorDias,
          referencia: raw.referencia || raw.reference,
          currency: raw.currency || raw.moneda || 'ARS',
        };
      } catch (error) {
        console.warn('Failed to parse caución:', raw, error);
        return null;
      }
    })
    .filter((cau) => cau !== null && cau.monto > 0 && cau.tenorDias > 0);
}

/**
 * Parse symbol to extract instrument, venue, and plazo
 * Handles formats like:
 *   - "MERV - XMEV - S31O5 - CI" -> { instrument: "S31O5", venue: "CI", plazo: null, isCaucion: false }
 *   - "MERV - XMEV - S31O5 - 24hs" -> { instrument: "S31O5", venue: "24h", plazo: null, isCaucion: false }
 *   - "MERV - XMEV - PESOS - 3D" -> { instrument: "PESOS", venue: null, plazo: 3, isCaucion: true }
 *   - "MERV - XMEV - PESOS - 18D" -> { instrument: "PESOS", venue: null, plazo: 18, isCaucion: true }
 * 
 * @param {string} symbol - Raw symbol string
 * @returns {{ instrument: string, venue: 'CI' | '24h' | null, plazo: number | null, isCaucion: boolean }}
 */
function parseSymbol(symbol) {
  if (!symbol) {
    return { instrument: '', venue: VENUES.CI, plazo: null, isCaucion: false };
  }

  // Split by " - " delimiter
  const parts = symbol.split(' - ').map(s => s.trim());
  
  // Check last part for venue or plazo
  const lastPart = parts[parts.length - 1] || '';
  let venue = null;
  let plazo = null;
  let isCaucion = false;
  let instrumentIndex = parts.length - 1;
  
  // Detect plazo (cauciones) - format: "3D", "18D", etc.
  const plazoMatch = lastPart.match(/^(\d+)D$/i);
  if (plazoMatch) {
    plazo = parseInt(plazoMatch[1], 10);
    isCaucion = true;
    instrumentIndex = parts.length - 2; // Instrument is before plazo
  }
  // Detect venue from last part
  else if (lastPart.toUpperCase().includes('24') || lastPart.toUpperCase() === '24HS') {
    venue = VENUES.H24;
    instrumentIndex = parts.length - 2; // Instrument is before venue
  } else if (lastPart.toUpperCase() === 'CI') {
    venue = VENUES.CI;
    instrumentIndex = parts.length - 2; // Instrument is before venue
  } else {
    // No venue specified, default to CI
    venue = VENUES.CI;
  }
  
  // Extract instrument name
  // For "MERV - XMEV - S31O5 - CI", we want "S31O5" (index 2)
  // For "MERV - XMEV - PESOS - 3D", we want "PESOS" (index 2)
  let instrument = '';
  if (instrumentIndex >= 0 && parts[instrumentIndex]) {
    instrument = parts[instrumentIndex];
  } else if (parts.length > 0) {
    instrument = parts[parts.length - 1];
  }
  
  return { instrument, venue, plazo, isCaucion };
}

/**
 * Parse lado (side) from various formats
 * @param {string} lado - Raw side value
 * @returns {'C'|'V'}
 */
function parseLado(lado) {
  if (!lado) return LADOS.COMPRA;
  const normalized = lado.toString().toUpperCase().trim();
  if (normalized.startsWith('V') || normalized === 'SELL') return LADOS.VENTA;
  return LADOS.COMPRA;
}

/**
 * Parse venue from various formats
 * @param {string} venue - Raw venue value
 * @returns {'CI'|'24h'}
 */
function parseVenue(venue) {
  if (!venue) return VENUES.CI;
  const normalized = venue.toString().toUpperCase().trim();
  if (normalized.includes('24') || normalized.includes('H24')) return VENUES.H24;
  return VENUES.CI;
}

/**
 * Parse date from various formats
 * @param {string|Date} date - Raw date value
 * @returns {Date}
 */
function parseDate(date) {
  if (date instanceof Date) return date;
  if (!date) {
    console.warn('parseDate: No date provided, using current date');
    return new Date();
  }
  
  // Handle string dates (ISO format, etc.)
  const parsed = new Date(date);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }
  
  // Fallback to current date if parsing fails
  console.warn('parseDate: Failed to parse date:', date);
  return new Date();
}

/**
 * Get summary statistics for grupos
 * @param {Map<string, import('./arbitrage-types.js').GrupoInstrumentoPlazo>} grupos
 * @returns {Object} Summary statistics
 */
export function getGruposSummary(grupos) {
  const stats = {
    totalGrupos: grupos.size,
    totalInstruments: getUniqueInstruments(grupos).length,
    totalOperations: 0,
    totalCauciones: 0,
  };

  grupos.forEach((grupo) => {
    stats.totalOperations +=
      grupo.ventasCI.length +
      grupo.compras24h.length +
      grupo.comprasCI.length +
      grupo.ventas24h.length;
    stats.totalCauciones += grupo.cauciones.length;
  });

  return stats;
}
