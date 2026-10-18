/**
 * Alcance del reporte: proyecta el reporte procesado al subconjunto de grupos
 * que el usuario tiene seleccionado, y reconstruye las vistas y el resumen
 * para ese alcance.
 *
 * Era la pieza más densa de la capa de UI (~140 líneas sin exportar dentro de
 * `ProcessorScreen`), así que no se podía ejercitar desde un test.
 */

import { buildConsolidatedViews } from './csv/consolidator.js';
import { ALL_GROUP_ID, extractBaseSymbol } from './clasificacion-instrumentos.js';

export const computeScopedData = ({
  report,
  groups,
  selectedGroupId,
  useAveraging,
  groupedOperations,
  cache,
}) => {
  if (!report) {
    return {
      scopedReport: null,
      activeView: null,
      summary: null,
      selectedGroup: null,
      filteredOperations: [],
      allSelected: true,
    };
  }

  const operations = Array.isArray(report.operations) ? report.operations : [];
  
  // Support both single selection (string) and multi-selection (array)
  const selectedIds = Array.isArray(selectedGroupId) 
    ? selectedGroupId 
    : selectedGroupId 
      ? [selectedGroupId] 
      : [];
  
  const allSelected = selectedIds.length === 0 || 
                      selectedIds.includes(ALL_GROUP_ID) ||
                      !selectedGroupId || 
                      selectedGroupId === ALL_GROUP_ID;
  
  const selectedGroup = allSelected
    ? null
    : groups.find((group) => selectedIds.includes(group.id)) ?? null;

  // Create a unique cache key for multi-selection
  const groupKey = allSelected 
    ? ALL_GROUP_ID 
    : selectedIds.sort().join(',');
  
  // For multi-select, combine operations from all selected groups
  let filteredOperations;
  if (allSelected) {
    filteredOperations = operations;
  } else if (selectedIds.length === 1) {
    filteredOperations = groupedOperations.get(selectedIds[0]) ?? [];
  } else {
    // Merge operations from multiple selected groups
    const operationSet = new Set();
    selectedIds.forEach(id => {
      const groupOps = groupedOperations.get(id) ?? [];
      groupOps.forEach(op => operationSet.add(op));
    });
    filteredOperations = Array.from(operationSet);
  }

  let cachedEntry = cache.get(groupKey);
  if (!cachedEntry || cachedEntry.reportToken !== report) {
    const optionOperations = filteredOperations.filter(
      (operation) => operation.optionType === 'CALL' || operation.optionType === 'PUT',
    );
    cachedEntry = {
      reportToken: report,
      optionOperations,
      consolidatedViews: buildConsolidatedViews(optionOperations),
    };
    cache.set(groupKey, cachedEntry);
  }

  const { consolidatedViews } = cachedEntry;

  const buildView = (key) => {
    const consolidated = consolidatedViews[key] ?? { calls: [], puts: [], exclusions: {} };
    const originalView = report.views?.[key] ?? null;
    const callsOperations = Array.isArray(consolidated.calls) ? consolidated.calls : [];
    const putsOperations = Array.isArray(consolidated.puts) ? consolidated.puts : [];

    const summarySource = originalView?.summary ?? report.summary ?? {};
    const summary = {
      ...summarySource,
      callsRows: callsOperations.length,
      putsRows: putsOperations.length,
      totalRows: callsOperations.length + putsOperations.length,
      groups,
    };

    if (selectedGroup && !allSelected) {
      summary.activeSymbol = extractBaseSymbol(selectedGroup.symbol);
      summary.activeExpiration = selectedGroup.expiration;
    }

    return {
      key,
      averagingEnabled:
        consolidated.useAveraging
        ?? originalView?.averagingEnabled
        ?? (key === 'averaged'),
      calls: {
        operations: callsOperations,
        stats: originalView?.calls?.stats ?? {},
      },
      puts: {
        operations: putsOperations,
        stats: originalView?.puts?.stats ?? {},
      },
      summary,
      exclusions: originalView?.exclusions ?? { combined: {}, validation: {}, consolidation: {} },
    };
  };

  const scopedViews = {
    raw: buildView('raw'),
    averaged: buildView('averaged'),
  };

  const activeKey = useAveraging ? 'averaged' : 'raw';
  const activeView = scopedViews[activeKey];

  return {
    scopedReport: {
      ...report,
      operations: filteredOperations,
      summary: activeView.summary,
      calls: activeView.calls,
      puts: activeView.puts,
      views: {
        ...(report.views ?? {}),
        raw: scopedViews.raw,
        averaged: scopedViews.averaged,
      },
      groups,
    },
    activeView,
    summary: activeView.summary,
    selectedGroup,
    filteredOperations,
    allSelected,
  };
};

