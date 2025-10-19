/**
 * Business Days Calculator for Argentina
 * Handles weekends and public holidays
 */

/**
 * Argentina public holidays 2025
 * Source: https://www.argentina.gob.ar/interior/feriados
 */
const ARGENTINA_HOLIDAYS_2025 = [
  '2025-01-01', // Año Nuevo
  '2025-02-24', // Carnaval
  '2025-02-25', // Carnaval
  '2025-03-24', // Día Nacional de la Memoria por la Verdad y la Justicia
  '2025-04-02', // Día del Veterano y de los Caídos en la Guerra de Malvinas
  '2025-04-17', // Jueves Santo (Turismo)
  '2025-04-18', // Viernes Santo
  '2025-05-01', // Día del Trabajador
  '2025-05-25', // Día de la Revolución de Mayo
  '2025-06-16', // Paso a la Inmortalidad del General Don Martín Miguel de Güemes
  '2025-06-20', // Paso a la Inmortalidad del General Don Manuel Belgrano
  '2025-07-09', // Día de la Independencia
  '2025-08-17', // Paso a la Inmortalidad del General Don José de San Martín
  '2025-10-12', // Día del Respeto a la Diversidad Cultural
  '2025-11-20', // Día de la Soberanía Nacional
  '2025-12-08', // Inmaculada Concepción de María
  '2025-12-25', // Navidad
];

/**
 * Convert date to YYYY-MM-DD string for comparison
 * @param {Date} date
 * @returns {string}
 */
function toDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Check if a date is a weekend (Saturday or Sunday)
 * @param {Date} date
 * @returns {boolean}
 */
function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6; // 0 = Sunday, 6 = Saturday
}

/**
 * Check if a date is an Argentina public holiday
 * @param {Date} date
 * @returns {boolean}
 */
function isHoliday(date) {
  const dateStr = toDateString(date);
  return ARGENTINA_HOLIDAYS_2025.includes(dateStr);
}

/**
 * Check if a date is a business day (not weekend, not holiday)
 * @param {Date} date
 * @returns {boolean}
 */
export function isBusinessDay(date) {
  return !isWeekend(date) && !isHoliday(date);
}

/**
 * Add business days to a date
 * @param {Date} startDate - Starting date
 * @param {number} businessDays - Number of business days to add
 * @returns {Date} Resulting date after adding business days
 */
export function addBusinessDays(startDate, businessDays) {
  let currentDate = new Date(startDate);
  let daysAdded = 0;

  while (daysAdded < businessDays) {
    currentDate.setDate(currentDate.getDate() + 1);
    
    if (isBusinessDay(currentDate)) {
      daysAdded++;
    }
  }

  return currentDate;
}

/**
 * Calculate calendar days between two dates (including weekends/holidays)
 * @param {Date} fromDate - Start date (inclusive)
 * @param {Date} toDate - End date (inclusive)
 * @returns {number} Number of calendar days
 */
export function calculateCalendarDays(fromDate, toDate) {
  const msPerDay = 24 * 60 * 60 * 1000;
  const from = new Date(fromDate);
  const to = new Date(toDate);
  
  // Reset time to midnight for accurate day calculation
  from.setHours(0, 0, 0, 0);
  to.setHours(0, 0, 0, 0);
  
  const diffMs = to.getTime() - from.getTime();
  return Math.round(diffMs / msPerDay);
}

/**
 * Calculate plazo for CI to 24hs operations
 * CI = Contado Inmediato (T+0)
 * 24hs = Settlement next business day (T+1)
 * 
 * Example: If CI is on Friday, 24hs settles on Monday (3 calendar days due to weekend)
 * 
 * @param {Date} ciDate - Date of CI operation
 * @returns {number} Calendar days until 24hs settlement
 */
export function calculateCIto24hsPlazo(ciDate) {
  // 24hs means next business day
  const settlement24hs = addBusinessDays(ciDate, 1);
  
  // Calculate calendar days difference
  return calculateCalendarDays(ciDate, settlement24hs);
}

/**
 * Get settlement date for CI operation (same day)
 * @param {Date} operationDate
 * @returns {Date}
 */
export function getCISettlementDate(operationDate) {
  return new Date(operationDate);
}

/**
 * Get settlement date for 24hs operation (next business day)
 * @param {Date} operationDate
 * @returns {Date}
 */
export function get24hsSettlementDate(operationDate) {
  return addBusinessDays(operationDate, 1);
}

/**
 * Calculate plazo between two settlement dates
 * Used for arbitrage P&L calculation
 * 
 * @param {Date} ciDate - CI operation date (T+0 settlement)
 * @param {Date} h24Date - 24hs operation date
 * @returns {number} Calendar days for financing
 */
export function calculateArbitragePlazo(ciDate, h24Date) {
  const ciSettlement = getCISettlementDate(ciDate);
  const h24Settlement = get24hsSettlementDate(h24Date);
  
  return calculateCalendarDays(ciSettlement, h24Settlement);
}
