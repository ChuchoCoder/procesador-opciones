import { describe, it, expect } from 'vitest';

import {
  calcularNetoNominales,
  filtrarPorPlazo,
  listarPlazos,
  plazosEfectivos,
  totalizarNetoNominales,
} from '../../src/services/neto-nominales.js';

// Filas como las arma CompraVentaView: compras positivas, ventas negativas.
const compras = [
  { symbol: 'AL30', settlement: '24HS', quantity: 1_100_006 },
  { symbol: 'AL30C', settlement: '24HS', quantity: 914_554 },
  { symbol: 'AL30D', settlement: '24HS', quantity: 600_050 },
  { symbol: 'AL30D', settlement: 'CI', quantity: 245_763 },
];
const ventas = [
  { symbol: 'AL30', settlement: '24HS', quantity: -50 },
  { symbol: 'AL30', settlement: 'CI', quantity: -1_106_267 },
  { symbol: 'AL30C', settlement: 'CI', quantity: -914_554 },
  { symbol: 'AL30D', settlement: '24HS', quantity: -300_000 },
];

describe('neto de nominales', () => {
  it('resta lo vendido a lo comprado por símbolo, sumando todos los plazos', () => {
    expect(calcularNetoNominales(compras, ventas)).toEqual([
      { symbol: 'AL30', comprado: 1_100_006, vendido: 1_106_317, neto: -6_311 },
      { symbol: 'AL30C', comprado: 914_554, vendido: 914_554, neto: 0 },
      { symbol: 'AL30D', comprado: 845_813, vendido: 300_000, neto: 545_813 },
    ]);
  });

  it('respeta el filtro de plazo', () => {
    const neto = calcularNetoNominales(
      filtrarPorPlazo(compras, ['CI']),
      filtrarPorPlazo(ventas, ['CI']),
    );
    expect(neto).toEqual([
      { symbol: 'AL30', comprado: 0, vendido: 1_106_267, neto: -1_106_267 },
      { symbol: 'AL30C', comprado: 0, vendido: 914_554, neto: -914_554 },
      { symbol: 'AL30D', comprado: 245_763, vendido: 0, neto: 245_763 },
    ]);
  });

  it('totaliza lo que se ve: comprado, vendido y su diferencia', () => {
    expect(totalizarNetoNominales(calcularNetoNominales(compras, ventas))).toEqual({
      comprado: 2_860_373,
      vendido: 2_320_871,
      neto: 539_502,
    });
    // Con el filtro de instrumento y de plazo, sólo suma los símbolos que quedan.
    const soloCi = calcularNetoNominales(
      filtrarPorPlazo(compras, ['CI']),
      filtrarPorPlazo(ventas, ['CI']),
    ).filter((fila) => fila.symbol !== 'AL30C');
    expect(totalizarNetoNominales(soloCi)).toEqual({
      comprado: 245_763,
      vendido: 1_106_267,
      neto: -860_504,
    });
  });

  it('el total de nada es cero', () => {
    expect(totalizarNetoNominales([])).toEqual({ comprado: 0, vendido: 0, neto: 0 });
  });

  it('una selección vacía no filtra', () => {
    expect(filtrarPorPlazo(compras, [])).toBe(compras);
  });

  it('lista los plazos con CI primero', () => {
    expect(listarPlazos(compras, ventas)).toEqual(['CI', '24HS']);
    expect(listarPlazos([{ settlement: 'T+3' }, { settlement: '24HS' }])).toEqual(['24HS', 'T+3']);
  });

  it('ignora plazos elegidos que ya no están disponibles', () => {
    expect(plazosEfectivos(['CI', '24HS'], ['24HS'])).toEqual(['24HS']);
    expect(plazosEfectivos(['CI'], ['24HS'])).toEqual([]);
  });
});
