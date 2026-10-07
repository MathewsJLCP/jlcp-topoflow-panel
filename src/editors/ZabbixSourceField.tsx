import React, { useMemo } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2, StandardEditorProps } from '@grafana/data';
import { DataSourcePicker } from '@grafana/runtime';
import { Alert, useStyles2 } from '@grafana/ui';

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
  const styles = useStyles2(getStyles);
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
        Substitui o interruptor "Buscar dados direto do Zabbix", que existia aqui
        e virou redundante: ligar a secao ja e pedir isto. O texto fica porque a
        consequencia — o painel dispensar a query do dashboard — precisa estar
        escrita em algum lugar da tela.
      */}
      {zabbix.length > 0 && (
        <div className={styles.nota}>
          O painel executa a própria query de Problems para os hosts vinculados, sem depender das queries do dashboard.
        </div>
      )}

      {/*
        As duas mensagens abaixo sao os estados em que o campo vazio precisa se
        explicar. Sem elas, "vazio" quer dizer coisas diferentes e nenhuma
        aparece na tela.
      */}
      {zabbix.length === 0 && (
        <Alert severity="info" title="Nenhum datasource Zabbix nesta instância">
          Sem um datasource do Zabbix instalado e configurado, esta seção não tem a quem perguntar: os combos de host e
          trigger continuam listando o que estiver nas queries do painel.
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

const getStyles = (theme: GrafanaTheme2) => ({
  nota: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    marginTop: theme.spacing(1),
  }),
});
