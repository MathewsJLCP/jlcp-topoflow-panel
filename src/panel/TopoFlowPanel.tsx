import React, { useCallback, useMemo } from 'react';
import { PanelProps, cacheFieldDisplayNames } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { Alert } from '@grafana/ui';

import { TopologyCanvas } from '../canvas/TopologyCanvas';
import { metricBindings, panelSeries, triggerHosts } from '../data/zabbixQuery';
import { parseTopoFlowOptions } from '../model/parse';
import { TopoFlowOptions, Topology } from '../model/types';
import { useZabbixData } from './useZabbixData';

export function TopoFlowPanel({
  id,
  options,
  data,
  width,
  height,
  title,
  timeRange,
  timeZone,
  eventBus,
  fieldConfig,
  replaceVariables,
  onOptionsChange,
}: PanelProps<TopoFlowOptions>) {
  const { options: parsed, issues, topologyInvalid } = useMemo(() => parseTopoFlowOptions(options), [options]);

  /**
   * Com a secao Zabbix ligada, o painel executa a propria query de Problems —
   * ver `./useZabbixProblems.ts` e o bloco 3 do PRD. Desligada (o padrao),
   * `frames` volta vazio e nada aqui muda.
   */
  const zabbixLigado = parsed.zabbix?.enabled === true;
  const hosts = useMemo(() => triggerHosts(parsed.topology), [parsed.topology]);
  const metrics = useMemo(() => metricBindings(parsed.topology), [parsed.topology]);
  const zabbix = useZabbixData({
    enabled: zabbixLigado,
    datasource: parsed.zabbix?.datasource,
    hosts,
    metrics,
    range: timeRange,
    timeZone,
    panelId: id,
    eventBus,
    fieldConfig,
    replaceVariables,
  });

  /**
   * `getFieldDisplayName` recalcula a cada chamada e pode desambiguar diferente
   * entre chamadas. Aquecer o cache uma vez, no ponto mais alto que consome as
   * series, e o padrao do core — e e o que faz dois hosts na mesma query
   * receberem nomes estaveis.
   *
   * Quem junta as duas fontes e `panelSeries` — inclusive a regra de que, com o
   * Zabbix ligado, os problemas do dashboard cedem lugar aos nossos.
   */
  const series = useMemo(() => {
    const todos = panelSeries(data.series, zabbix.frames, zabbixLigado);
    cacheFieldDisplayNames(todos);
    return todos;
  }, [data.series, zabbix.frames, zabbixLigado]);

  /**
   * O canvas so escreve quando o que ele desenha **e** o que esta salvo.
   *
   * Com a topologia corrompida, `parsed.topology` e o default vazio: gravar a
   * partir dele apagaria o desenho do usuario por causa de um campo fora do
   * schema, e sem aviso nenhum — o dashboard nao sabe distinguir esta escrita de
   * qualquer outra. Melhor um painel que mostra o erro e nao deixa mexer.
   */
  const handleTopologyChange = useCallback(
    (topology: Topology) => {
      if (topologyInvalid) {
        return;
      }
      onOptionsChange({ ...parsed, topology });
    },
    [onOptionsChange, parsed, topologyInvalid]
  );

  /**
   * No editor de painel a edicao vem ligada; no dashboard depende do toggle.
   * Assim quem so visualiza nao arrasta a topologia por acidente.
   *
   * A URL, e nao `usePanelContext().app`, porque no Grafana 13 esse campo nao e
   * confiavel: o `VizPanel` do `@grafana/scenes` constroi o panel context uma
   * unica vez com `app: CoreApp.Unknown`, e o `setDashboardPanelContext` do core
   * **muta** `context.app` dentro de um `subscribeToState` — mutacao de objeto,
   * sem re-render e sem propagacao garantida ate aqui.
   *
   * O efeito era o canvas inteiro nascer inerte quando se chegava ao editor
   * navegando (dashboard -> Edit -> menu do painel -> Edit): sem menu de
   * contexto, sem selecao e sem arraste, enquanto o mesmo editor alcancado por
   * URL direta (F5, deep link) funcionava. Uma so entrada errada desligava as
   * sete props de interacao do `<ReactFlow>` de uma vez.
   *
   * E o que o canvas nativo do Grafana faz, pelo mesmo motivo:
   * `public/app/plugins/panel/canvas/CanvasPanel.tsx` le `editPanel` do
   * `locationService`. Ler a cada render (e nao uma vez, como o core) e de
   * graca e dispensa qualquer sincronia: entrar e sair do editor sempre
   * re-renderiza o painel.
   */
  const editable =
    !topologyInvalid && (locationService.getSearchObject().editPanel !== undefined || parsed.canvas.inlineEditing);

  return (
    <>
      {issues.length > 0 && (
        <Alert severity="warning" title="Opções inválidas, usando defaults">
          {topologyInvalid && (
            <p>
              A topologia salva continua no JSON do painel e <strong>não será sobrescrita</strong>: a edição fica
              desligada até o problema abaixo ser corrigido em <em>Panel JSON</em>.
            </p>
          )}
          <ul>
            {issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </Alert>
      )}

      {zabbix.error && (
        <Alert severity="warning" title="Não foi possível atualizar os problemas do Zabbix">
          {zabbix.error} O mapa continua mostrando o último estado recebido.
        </Alert>
      )}

      <TopologyCanvas
        topology={parsed.topology}
        frames={series}
        canvas={parsed.canvas}
        editable={editable}
        width={width}
        height={height}
        // So o screenshot usa: e o nome do arquivo baixado.
        title={title}
        // O grafico de hover desenha nesta janela — a mesma do dashboard.
        timeRange={timeRange}
        timeZone={timeZone}
        onChange={handleTopologyChange}
      />
    </>
  );
}
