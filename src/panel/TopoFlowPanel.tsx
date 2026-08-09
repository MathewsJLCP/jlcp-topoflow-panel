import React, { useCallback, useMemo } from 'react';
import { CoreApp, PanelProps, cacheFieldDisplayNames } from '@grafana/data';
import { Alert, usePanelContext } from '@grafana/ui';

import { TopologyCanvas } from '../canvas/TopologyCanvas';
import { parseTopoFlowOptions } from '../model/parse';
import { TopoFlowOptions, Topology } from '../model/types';

export function TopoFlowPanel({ options, data, width, height, onOptionsChange }: PanelProps<TopoFlowOptions>) {
  const { app } = usePanelContext();

  const { options: parsed, issues } = useMemo(() => parseTopoFlowOptions(options), [options]);

  /**
   * `getFieldDisplayName` recalcula a cada chamada e pode desambiguar diferente
   * entre chamadas. Aquecer o cache uma vez, no ponto mais alto que consome as
   * series, e o padrao do core — e e o que faz dois hosts na mesma query
   * receberem nomes estaveis.
   */
  const series = useMemo(() => {
    cacheFieldDisplayNames(data.series);
    return data.series;
  }, [data.series]);

  const handleTopologyChange = useCallback(
    (topology: Topology) => onOptionsChange({ ...parsed, topology }),
    [onOptionsChange, parsed]
  );

  // No editor de painel a edicao vem ligada; no dashboard depende do toggle.
  // Assim quem so visualiza nao arrasta a topologia por acidente.
  const editable = app === CoreApp.PanelEditor || parsed.canvas.inlineEditing;

  return (
    <>
      {issues.length > 0 && (
        <Alert severity="warning" title="Opções inválidas — usando defaults">
          <ul>
            {issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </Alert>
      )}

      <TopologyCanvas
        topology={parsed.topology}
        frames={series}
        canvas={parsed.canvas}
        editable={editable}
        width={width}
        height={height}
        onChange={handleTopologyChange}
      />
    </>
  );
}
