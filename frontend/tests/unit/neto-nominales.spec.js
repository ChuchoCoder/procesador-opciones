import { describe, it, expect } from 'vitest';

import {
  aplicarTenencias,
  calcularNetoNominales,
  claveNeto,
  filtrarPorPlazo,
  listarPlazos,
  parsearNominales,
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

const fila = (symbol, settlement, comprado, vendido) => ({
  key: claveNeto(symbol, settlement),
  symbol,
  settlement,
  comprado,
  vendido,
  neto: comprado - vendido,
});

describe('neto de nominales', () => {
  it('resta lo vendido a lo comprado por símbolo y plazo, con CI antes que 24HS', () => {
    expect(calcularNetoNominales(compras, ventas)).toEqual([
      fila('AL30', 'CI', 0, 1_106_267),
      fila('AL30', '24HS', 1_100_006, 50),
      fila('AL30C', 'CI', 0, 914_554),
      fila('AL30C', '24HS', 914_554, 0),
      fila('AL30D', 'CI', 245_763, 0),
      fila('AL30D', '24HS', 600_050, 300_000),
    ]);
  });

  it('respeta el filtro de plazo', () => {
    const neto = calcularNetoNominales(
      filtrarPorPlazo(compras, ['CI']),
      filtrarPorPlazo(ventas, ['CI']),
    );
    expect(neto).toEqual([
      fila('AL30', 'CI', 0, 1_106_267),
      fila('AL30C', 'CI', 0, 914_554),
      fila('AL30D', 'CI', 245_763, 0),
    ]);
  });

  it('totaliza lo que se ve: comprado, vendido y su diferencia', () => {
    expect(totalizarNetoNominales(calcularNetoNominales(compras, ventas))).toEqual({
      tenencia: 0,
      comprado: 2_860_373,
      vendido: 2_320_871,
      neto: 539_502,
      disponible: 539_502,
    });
    // Con el filtro de instrumento y de plazo, sólo suma los símbolos que quedan.
    const soloCi = calcularNetoNominales(
      filtrarPorPlazo(compras, ['CI']),
      filtrarPorPlazo(ventas, ['CI']),
    ).filter((f) => f.symbol !== 'AL30C');
    expect(totalizarNetoNominales(soloCi)).toEqual({
      tenencia: 0,
      comprado: 245_763,
      vendido: 1_106_267,
      neto: -860_504,
      disponible: -860_504,
    });
  });

  it('el total de nada es cero', () => {
    expect(totalizarNetoNominales([])).toEqual({
      tenencia: 0, comprado: 0, vendido: 0, neto: 0, disponible: 0,
    });
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

describe('tenencia y disponible', () => {
  const neto = calcularNetoNominales(compras, ventas);
  const de = (filas, symbol, settlement) => filas.find((f) => f.key === claveNeto(symbol, settlement));

  it('lo disponible en un plazo es la tenencia de ese plazo más su neto', () => {
    // Tenía 1.200.000 AL30 en CI y vendí 1.106.267 en CI: quedan 93.733.
    const filas = aplicarTenencias(neto, { [claveNeto('AL30', 'CI')]: 1_200_000 });
    expect(de(filas, 'AL30', 'CI')).toMatchObject({ tenencia: 1_200_000, disponible: 93_733 });
    // La tenencia de CI no se mezcla con 24HS.
    expect(de(filas, 'AL30', '24HS')).toMatchObject({ tenencia: null, disponible: 1_099_956 });
  });

  it('sin tenencia ingresada, lo disponible es el neto', () => {
    aplicarTenencias(neto, {}).forEach((f) => {
      expect(f.tenencia).toBeNull();
      expect(f.disponible).toBe(f.neto);
    });
  });

  it('el total suma tenencias y disponible de lo que se ve', () => {
    const filas = aplicarTenencias(neto, {
      [claveNeto('AL30', 'CI')]: 1_200_000,
      [claveNeto('AL30D', 'CI')]: 10_000,
    });
    expect(totalizarNetoNominales(filas)).toMatchObject({
      tenencia: 1_210_000,
      neto: 539_502,
      disponible: 1_749_502,
    });
  });

  it('lee los nominales con puntos, comas o espacios como separador de miles', () => {
    expect(parsearNominales('1.200.000')).toBe(1_200_000);
    expect(parsearNominales('1,200,000')).toBe(1_200_000);
    expect(parsearNominales(' 1 200 000 ')).toBe(1_200_000);
    expect(parsearNominales('-500')).toBe(-500);
    expect(parsearNominales('0')).toBe(0);
    expect(Object.is(parsearNominales('-0'), 0)).toBe(true);
  });

  it('vacío es sin tenencia; lo que no es un número, inválido', () => {
    expect(parsearNominales('')).toBeNull();
    expect(parsearNominales('   ')).toBeNull();
    expect(parsearNominales(null)).toBeNull();
    expect(parsearNominales('12a')).toBeUndefined();
    expect(parsearNominales('--5')).toBeUndefined();
  });
});
