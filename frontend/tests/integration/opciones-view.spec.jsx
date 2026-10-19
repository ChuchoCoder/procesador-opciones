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
import { loadEnrichedOperations } from './helpers/arbitrage-pipeline.js';

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
    const operaciones = await loadEnrichedOperations('GGAL-PUTS.csv', {
      prefixRules: reglaGgal,
      prefixMap: reglaGgal,
      expirations: { Octubre: { suffixes: ['O', 'OC', 'OCT'] } },
      activeExpiration: 'Octubre',
    });
    calls = operaciones.filter((op) => op.optionType === 'CALL');
    puts = operaciones.filter((op) => op.optionType === 'PUT');
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

  it('renderiza las dos tablas, CALLS y PUTS, con opciones reales', () => {
    montar(<OpcionesView {...props()} />);

    expect(screen.getByTestId('processor-calls-table')).toBeTruthy();
    expect(screen.getByTestId('processor-puts-table')).toBeTruthy();
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
