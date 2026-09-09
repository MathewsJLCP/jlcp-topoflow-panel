import React, { useMemo } from 'react';
import { StandardEditorProps } from '@grafana/data';
import { DataSourcePicker } from '@grafana/runtime';
import { Alert } from '@grafana/ui';

import { ZABBIX_DS_TYPE, listZabbixDatasources, resolveZabbixUid } from '../data/zabbixApi';

/**
 * Qual Zabbix o editor consulta para preencher os combos de host e trigger.
 *
 * Campo do painel, e nao do elemento: a pergunta e "qual Zabbix este mapa
 * observa", e ela e a mesma para os 40 elementos do mapa.
 *
 * Deixar vazio e o caso comum. Com exatamente um datasource Zabbix na
 * instancia, `resolveZabbixUid` o escolhe sozinho — o campo existe para o
 * ambiente com varios, e para quem usa variavel de datasource.
 */
export function ZabbixSourceField({ value, onChange }: StandardEditorProps<string | undefined>) {
  /*
    `listZabbixDatasources`, e nao `getList({ type })` na mao: aquele caminho
    devolve `-- Grafana --` junto e faria este campo anunciar Zabbix onde nao ha
    nenhum. Ver a explicacao em `data/zabbixApi.ts`.
  */
  const zabbix = useMemo(() => listZabbixDatasources(), []);

  const auto = !value ? resolveZabbixUid() : undefined;
  const autoName = zabbix.find((ds) => ds.uid === auto)?.name;

  return (
    <>
      <DataSourcePicker
        // `pluginId` e nao `type`: e o filtro que o `getList` respeita sem
        // acrescentar os datasources embutidos do Grafana no fim da lista.
        pluginId={ZABBIX_DS_TYPE}
        current={value ?? null}
        noDefault
        placeholder={autoName ?? 'Selecione o Zabbix'}
        onChange={(ds) => onChange(ds.uid)}
        onClear={() => onChange(undefined)}
      />

      {/*
        As tres mensagens sao os tres estados reais, e cada uma responde a
        pergunta que o campo vazio levanta naquele estado. Sem elas, "vazio" quer
        dizer tres coisas diferentes e nenhuma aparece na tela.
      */}
      {zabbix.length === 0 && (
        <Alert severity="info" title="Nenhum datasource Zabbix nesta instância">
          Os combos de host e trigger continuam listando o que estiver nas queries do painel.
        </Alert>
      )}

      {zabbix.length > 1 && !value && (
        <Alert severity="info" title="Há mais de um Zabbix nesta instância">
          Escolha um para o editor sugerir hosts e triggers. Sem escolha, os combos listam apenas o que estiver nas
          queries do painel.
        </Alert>
      )}
    </>
  );
}
