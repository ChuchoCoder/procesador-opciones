/**
 * Cobertura de `OpcionesView` y del filtro de grupos.
 *
 * Es la vista por defecto del Procesador —la primera que ve el usuario— y la
 * única de las cuatro que todavía no tenía test. El filtro de grupos tampoco:
 * es el componente donde vive el sentinel `ALL_GROUP_ID`, que hasta #22 estaba
 * definido por separado en cuatro lugares.
 */
/* eslint-env node */
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material/styles';

import OpcionesView from '../../src/components/Processor/OpcionesView.jsx';
import GroupFilter from '../../src/components/Processor/GroupFilter.jsx';
import { ALL_GROUP_ID } from '../../src/services/clasificacion-instrumentos.js';
import { CLIPBOARD_SCOPES } from '../../src/services/csv/clipboard-service.js';
import { EXPORT_SCOPES } from '../../src/services/csv/export-service.js';
import strings from '../../src/strings/es-AR.js';
import theme from '../../src/app/theme.js';
import { loadReport } from './helpers/arbitrage-pipeline.js';

const processorStrings = strings.processor;
const montar = (ui) => render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

describe('OpcionesView', () => {
  let calls;
  let puts;

  beforeAll(async () => {
    // GGAL-PUTS tiene opciones de verdad, pero sólo se clasifican como tales si
    // la configuración trae la regla de prefijo GFG -> GGAL: sin ella el
    // pipeline devuelve CALLS: 0, PUTS: 0.
    const reglaGgal = { GFG: { symbol: 'GGAL', prefixes: ['GFG'], strikeDefaultDecimals: 1 } };
    const report = await loadReport('GGAL-PUTS.csv', {
      prefixRules: reglaGgal,
      prefixMap: reglaGgal,
      expirations: { Octubre: { suffixes: ['O', 'OC', 'OCT'] } },
      activeExpiration: 'Octubre',
    });
    // Las tablas consumen las operaciones CONSOLIDADAS, no las crudas.
    calls = report.calls?.operations ?? [];
    puts = report.puts?.operations ?? [];
    expect(puts.length).toBeGreaterThan(0);
  }, 60000);

  afterEach(() => cleanup());

  const props = (extra = {}) => ({
    callsOperations: calls,
    putsOperations: puts,
    groupOptions: [],
    selectedGroupId: [],
    strings: processorStrings,
    onGroupChange: () => {},
    onCopy: () => {},
    onDownload: () => {},
    averagingEnabled: false,
    onToggleAveraging: () => {},
    onStrikeExceptionSaved: () => {},
    ...extra,
  });

  it('renderiza las dos tablas, y la de PUTS con datos de verdad', () => {
    montar(<OpcionesView {...props()} />);

    expect(screen.getByTestId('processor-calls-table')).toBeTruthy();

    const puts = screen.getByTestId('processor-puts-table');
    expect(puts).toBeTruthy();
    // No alcanza con que la tabla exista: este fixture tiene PUTS, así que
    // tiene que mostrarlos.
    expect(puts.textContent).not.toContain('Sin datos');
    expect(puts.querySelectorAll('tbody tr').length).toBeGreaterThan(0);
  });

  it('no muestra el filtro cuando no hay grupos', () => {
    montar(<OpcionesView {...props()} />);
    expect(screen.queryByTestId('group-filter')).toBeNull();
  });

  it('muestra el filtro cuando hay grupos', () => {
    montar(<OpcionesView {...props({
      groupOptions: [{ id: 'GGAL::OC', label: 'GGAL Octubre' }],
      selectedGroupId: [ALL_GROUP_ID],
    })} />);

    expect(screen.getByTestId('group-filter')).toBeTruthy();
    expect(screen.getByText('GGAL Octubre')).toBeTruthy();
  });

  // GGAL-PUTS.csv trae PUTS y ninguna CALL, así que la tabla de PUTS es la que
  // tiene datos. Los controles se deshabilitan sin datos (`disabled={!hasData}`).
  it('la tabla con datos pide copiar y descargar su propio alcance', async () => {
    const usuario = userEvent.setup();
    const onCopy = vi.fn();
    const onDownload = vi.fn();
    montar(<OpcionesView {...props({ onCopy, onDownload })} />);

    await usuario.click(screen.getByTestId('processor-puts-table-copy-button'));
    expect(onCopy).toHaveBeenCalledWith(CLIPBOARD_SCOPES.PUTS);

    await usuario.click(screen.getByTestId('processor-puts-table-download-button'));
    expect(onDownload).toHaveBeenCalledWith(EXPORT_SCOPES.PUTS);
  }, 20000);

  it('deshabilita los controles de la tabla sin datos', () => {
    montar(<OpcionesView {...props()} />);

    // No hay CALLS en este fixture.
    expect(screen.getByTestId('processor-calls-table-copy-button')).toBeDisabled();
    expect(screen.getByTestId('processor-calls-table-download-button')).toBeDisabled();
    expect(screen.getByTestId('processor-puts-table-copy-button')).not.toBeDisabled();
  });

  it('no explota sin operaciones', () => {
    montar(<OpcionesView {...props({ callsOperations: [], putsOperations: [] })} />);
    expect(screen.getByTestId('processor-calls-table')).toBeTruthy();
  });
});

describe('GroupFilter', () => {
  afterEach(() => cleanup());

  const opciones = [
    { id: ALL_GROUP_ID, label: 'Todos' },
    { id: 'GGAL::OC', label: 'GGAL Octubre' },
    { id: 'YPFD::NV', label: 'YPFD Noviembre' },
  ];

  it('no renderiza nada sin opciones', () => {
    const { container } = montar(
      <GroupFilter options={[]} selectedGroupId={[]} onChange={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('muestra un chip por grupo', () => {
    montar(
      <GroupFilter
        options={opciones}
        selectedGroupId={[]}
        onChange={() => {}}
        strings={processorStrings.filters}
      />,
    );

    expect(screen.getByTestId('group-filter')).toBeTruthy();
    expect(screen.getByText('Todos')).toBeTruthy();
    expect(screen.getByText('GGAL Octubre')).toBeTruthy();
    expect(screen.getByText('YPFD Noviembre')).toBeTruthy();
  });

  it('al elegir un grupo avisa con ese id', async () => {
    const usuario = userEvent.setup();
    const onChange = vi.fn();
    montar(
      <GroupFilter
        options={opciones}
        selectedGroupId={[]}
        onChange={onChange}
        strings={processorStrings.filters}
      />,
    );

    await usuario.click(screen.getByText('GGAL Octubre'));

    expect(onChange).toHaveBeenCalledWith(['GGAL::OC']);
  }, 20000);

  it('al clickear "Todos" vuelve a sin filtro', async () => {
    const usuario = userEvent.setup();
    const onChange = vi.fn();
    montar(
      <GroupFilter
        options={opciones}
        selectedGroupId={['GGAL::OC']}
        onChange={onChange}
        strings={processorStrings.filters}
      />,
    );

    await usuario.click(screen.getByText('Todos'));

    // Lista vacía significa "todos", no "ninguno".
    expect(onChange).toHaveBeenCalledWith([]);
  }, 20000);

  it('deselecciona un grupo ya seleccionado', async () => {
    const usuario = userEvent.setup();
    const onChange = vi.fn();
    montar(
      <GroupFilter
        options={opciones}
        selectedGroupId={['GGAL::OC', 'YPFD::NV']}
        onChange={onChange}
        strings={processorStrings.filters}
      />,
    );

    await usuario.click(screen.getByText('GGAL Octubre'));

    expect(onChange).toHaveBeenCalledWith(['YPFD::NV']);
  }, 20000);

  it('acepta selección simple (string) además de múltiple (array)', () => {
    // El componente soporta las dos formas; un snapshot viejo restaura un string.
    expect(() => montar(
      <GroupFilter options={opciones} selectedGroupId="GGAL::OC" onChange={() => {}} />,
    )).not.toThrow();
  });
});

describe('OpcionesView: comportamiento', () => {
  let puts;

  beforeAll(async () => {
    const reglaGgal = { GFG: { symbol: 'GGAL', prefixes: ['GFG'], strikeDefaultDecimals: 1 } };
    const report = await loadReport('GGAL-PUTS.csv', {
      prefixRules: reglaGgal,
      prefixMap: reglaGgal,
      expirations: { Octubre: { suffixes: ['O', 'OC', 'OCT'] } },
      activeExpiration: 'Octubre',
    });
    puts = report.puts?.operations ?? [];
  }, 60000);

  afterEach(() => cleanup());

  const base = (extra = {}) => ({
    callsOperations: [],
    putsOperations: puts,
    groupOptions: [],
    selectedGroupId: [],
    strings: processorStrings,
    onGroupChange: () => {},
    onCopy: () => {},
    onDownload: () => {},
    averagingEnabled: false,
    onToggleAveraging: () => {},
    onStrikeExceptionSaved: () => {},
    ...extra,
  });

  it('muestra valores reales en la tabla, no el estado vacío', () => {
    montar(<OpcionesView {...base()} />);

    const tabla = screen.getByTestId('processor-puts-table');
    const texto = tabla.textContent;

    // El bug que esto atrapa: pasarle operaciones crudas en vez de
    // consolidadas hace que la tabla renderice "Sin datos para mostrar".
    expect(texto).not.toContain('Sin datos');

    // Y los valores salen formateados: strike con separador y neto con signo.
    expect(texto).toMatch(/\d{1,3}[.,]\d{3}/);
    expect(texto).toMatch(/[+-]/);
  });

  it('pide promediar al accionar el switch', async () => {
    const usuario = userEvent.setup();
    const onToggleAveraging = vi.fn();
    montar(<OpcionesView {...base({ onToggleAveraging })} />);

    const vista = screen.getByTestId('processor-puts-table-averaging-switch');
    await usuario.click(vista.querySelector('input'));

    expect(onToggleAveraging).toHaveBeenCalledWith(true);
  }, 20000);

  it('refleja el estado de promediado que recibe', () => {
    montar(<OpcionesView {...base({ averagingEnabled: true })} />);

    const vista = screen.getByTestId('processor-puts-table-averaging-switch');
    expect(vista.querySelector('input')).toBeChecked();
  });

  it('avisa el grupo elegido al filtrar', async () => {
    const usuario = userEvent.setup();
    const onGroupChange = vi.fn();
    montar(<OpcionesView {...base({
      groupOptions: [
        { id: ALL_GROUP_ID, label: 'Todos' },
        { id: 'GGAL::OC', label: 'GGAL Octubre' },
      ],
      onGroupChange,
    })} />);

    await usuario.click(screen.getByText('GGAL Octubre'));

    expect(onGroupChange).toHaveBeenCalledWith(['GGAL::OC']);
  }, 20000);
});
