/*
  eslint-disable @typescript-eslint/no-deprecated --
  `getDataSourceSrv` esta depreciado em favor de `@grafana/runtime/unstable`, que
  proibe plugins da comunidade. Ver a explicacao completa em `data/zabbixApi.ts`.
*/
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DataFrame,
  DataQuery,
  EventBus,
  FieldConfigSource,
  GrafanaTheme2,
  InterpolateFunction,
  TimeRange,
  applyFieldOverrides,
} from '@grafana/data';
import { RefreshEvent, getDataSourceSrv } from '@grafana/runtime';
import { useTheme2 } from '@grafana/ui';

import { resolveHostNames, resolveZabbixUid } from '../data/zabbixApi';
import {
  METRICS_REF_PREFIX,
  MetricBinding,
  metricTargets,
  nameMetricFields,
  problemsRequest,
  problemsTarget,
} from '../data/zabbixQuery';

/**
 * O painel buscando os proprios dados no Zabbix — problemas e metricas.
 *
 * E a inversao que o bloco 3 do PRD descreve: como nenhum painel pode escrever
 * nas queries do dashboard, o painel vai ate o dado. Os frames que voltam sao
 * **os mesmos** que chegariam por uma query de Problems no editor — mesmo
 * `config.custom.type === 'problems'` —, entao `extractProblems`,
 * `resolveTriggerState` e a cadeia de cor nao sabem a diferenca.
 *
 * O que se perde, e esta dito na opcao do painel: transformacoes, alerting e o
 * Query Inspector nao alcancam estes dados, e um snapshot do dashboard nao os
 * congela junto.
 *
 * Desligado, o hook nao consulta nada e devolve lista vazia — o painel volta a
 * depender so das queries do dashboard, que segue sendo o padrao.
 */

export interface ZabbixDataState {
  /** Frames (Problems e metricas) para concatenar aos do painel. */
  frames: DataFrame[];
  /** Mensagem da ultima falha. Os frames anteriores continuam valendo. */
  error?: string;
  loading: boolean;
}

interface Options {
  enabled: boolean;
  /** Uid escolhido nas opcoes do painel; ausente = detectar o unico da instancia. */
  datasource?: string;
  /** Hosts observados por trigger, de `triggerHosts`. */
  hosts: string[];
  /** Pares host + item observados por metrica, de `metricBindings`. */
  metrics: MetricBinding[];
  range: TimeRange;
  timeZone: string;
  panelId: number;
  eventBus: EventBus;
  /**
   * Config de field do painel e interpolador, para o `applyFieldOverrides` das
   * series de metrica — ver o comentario em `aplicarConfig`.
   */
  fieldConfig: FieldConfigSource;
  replaceVariables: InterpolateFunction;
}

const VAZIO: DataFrame[] = [];

export function useZabbixData({
  enabled,
  datasource,
  hosts,
  metrics,
  range,
  timeZone,
  panelId,
  eventBus,
  fieldConfig,
  replaceVariables,
}: Options): ZabbixDataState {
  const [state, setState] = useState<ZabbixDataState>({ frames: VAZIO, loading: false });
  const theme = useTheme2();

  const uid = useMemo(() => (enabled ? resolveZabbixUid(datasource) : undefined), [enabled, datasource]);

  /*
    A lista de hosts vira string para servir de dependencia: o array e recriado a
    cada render (sai de uma varredura da topologia), e como dependencia crua
    dispararia uma query por render.
  */
  const hostsKey = useMemo(() => [...hosts].sort().join('\n'), [hosts]);
  const metricsKey = useMemo(
    () =>
      metrics
        .map((m) => `${m.host}\t${m.item}`)
        .sort()
        .join('\n'),
    [metrics]
  );
  const from = range.from.valueOf();
  const to = range.to.valueOf();

  /*
    Duas travas contra a corrida classica: `vivo` impede escrever estado depois
    do unmount, e `execucao` numera as chamadas para que uma resposta lenta de
    uma consulta antiga nunca sobrescreva a mais nova.
  */
  const vivo = useRef(true);
  const execucao = useRef(0);

  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);

  const buscar = useCallback(async () => {
    if (!uid || (hostsKey === '' && metricsKey === '')) {
      // Sem datasource ou sem nenhum vinculo: nao ha o que perguntar, e um alvo
      // com regex vazia casaria nada de qualquer forma.
      setState({ frames: VAZIO, loading: false });
      return;
    }

    const chamada = ++execucao.current;
    setState((anterior) => ({ ...anterior, loading: true }));

    try {
      const ds = await getDataSourceSrv().get(uid);
      const referencia = { uid, type: ds.type };

      const porTrigger = hostsKey ? hostsKey.split('\n') : [];
      const porMetrica: MetricBinding[] = metricsKey
        ? metricsKey.split('\n').map((linha) => {
            const [host, item] = linha.split('\t');
            return { host, item };
          })
        : [];

      /*
        Traduz os nomes salvos para os nomes **visiveis**, que e o unico campo
        que o filtro de host do datasource testa. Sem isto, um vinculo feito
        pelo nome tecnico nunca entraria na query. Uma chamada so cobre os dois
        tipos de vinculo.
      */
      const visivel = await resolveHostNames(uid, [...porTrigger, ...porMetrica.map((m) => m.host)]);
      const targets: DataQuery[] = [];

      const hostsDeTrigger = [...new Set(porTrigger.map((host) => visivel.get(host)).filter(Boolean))] as string[];
      if (hostsDeTrigger.length > 0) {
        targets.push(problemsTarget(hostsDeTrigger, referencia));
      }

      const metricasVisiveis = porMetrica
        .filter((binding) => visivel.has(binding.host))
        .map((binding) => ({ host: visivel.get(binding.host) as string, item: binding.item }));
      if (metricasVisiveis.length > 0) {
        targets.push(...metricTargets(metricasVisiveis, referencia));
      }

      if (targets.length === 0) {
        // Nenhum host configurado existe no Zabbix. Nao e erro — pode ser um
        // vinculo escrito antes de o host ser cadastrado.
        if (vivo.current && chamada === execucao.current) {
          setState({ frames: VAZIO, loading: false });
        }
        return;
      }

      const request = problemsRequest(targets, range, timeZone, panelId, `topoflow-${panelId}-${chamada}`);
      const resposta = await lastValue<{ data?: unknown[] }>(ds.query(request));
      const frames = (resposta?.data ?? []).filter(isFrame);

      /*
        O caminho de volta do nome: o label do frame traz o nome visivel, e o
        elemento procura pelo nome como o vinculo o guardou.
      */
      const comoSalvo = new Map<string, string>();
      for (const { host } of porMetrica) {
        const nome = visivel.get(host);
        if (nome && !comoSalvo.has(nome)) {
          comoSalvo.set(nome, host);
        }
      }

      if (vivo.current && chamada === execucao.current) {
        setState({ frames: nameMetricFields(frames, comoSalvo), loading: false, error: undefined });
      }
    } catch (err) {
      if (vivo.current && chamada === execucao.current) {
        /*
          Os frames anteriores ficam. Num telao, apagar o mapa inteiro porque uma
          atualizacao falhou e pior que mostrar o estado de um minuto atras — e o
          erro aparece no canto, entao ninguem le dado velho achando que e novo.
        */
        setState((anterior) => ({ ...anterior, loading: false, error: mensagem(err) }));
      }
    }
    // `range` entra pelas duas pontas ja desempacotadas (`from`/`to`): o objeto
    // e recriado a cada render do painel, e como dependencia crua dispararia uma
    // query por render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, hostsKey, metricsKey, from, to, timeZone, panelId]);

  useEffect(() => {
    buscar();
  }, [buscar]);

  /*
    O refresh do dashboard — o botao, o intervalo automatico, o atalho — chega
    como `RefreshEvent` no event bus do painel. Sem isto, o mapa so se
    atualizaria ao mudar a janela de tempo, e um telao de NOC ficaria parado.
  */
  useEffect(() => {
    const sub = eventBus.subscribe(RefreshEvent, () => {
      buscar();
    });

    return () => sub.unsubscribe();
  }, [eventBus, buscar]);

  /*
    A config de field entra **na leitura**, e nao na busca.

    Se `fieldConfig` e `replaceVariables` fossem dependencia de `buscar`, cada
    render que os recriasse viraria uma consulta nova ao Zabbix — foi o teste de
    "render sem mudanca nao refaz a consulta" que mostrou isso, e e o mesmo
    motivo pelo qual a lista de hosts entra serializada.

    De quebra, e o comportamento certo: mudar a unidade ou um value mapping nas
    opcoes do painel passa a valer **na hora**, sem ir buscar o dado de novo.
  */
  const frames = useMemo(
    () => aplicarConfig(state.frames, fieldConfig, replaceVariables, theme, timeZone),
    [state.frames, fieldConfig, replaceVariables, theme, timeZone]
  );

  return { ...state, frames };
}

/**
 * A ultima emissao de `ds.query()`, como promise.
 *
 * `DataSourceApi.query` pode devolver **promise ou observable** — a assinatura
 * permite os dois, e o datasource escolhe. O Zabbix devolve observable, e o
 * caminho de Problems emite uma vez so; ainda assim ficamos com a ultima
 * emissao, e nao com a primeira, para que um datasource que emita parcial nao
 * congele o mapa no resultado incompleto.
 *
 * Escrito a mao em vez de `lastValueFrom` do rxjs: sao doze linhas, e o rxjs
 * aqui entraria so por isso.
 */
function lastValue<T>(
  resultado: Promise<T> | { subscribe: (observer: Observador<T>) => unknown }
): Promise<T | undefined> {
  if (!('subscribe' in resultado)) {
    return resultado;
  }

  return new Promise<T | undefined>((resolve, reject) => {
    let ultimo: T | undefined;

    resultado.subscribe({
      next: (valor: T) => {
        ultimo = valor;
      },
      error: reject,
      complete: () => resolve(ultimo),
    });
  });
}

interface Observador<T> {
  next: (valor: T) => void;
  error: (erro: unknown) => void;
  complete: () => void;
}

/**
 * Instala `field.display` nas series que buscamos.
 *
 * Unidade, casas decimais, thresholds e **value mappings** do painel chegam aos
 * frames pelo `applyFieldOverrides`, que o Grafana roda no query runner por
 * causa do `.useFieldConfig()` em `module.ts` (ADR-P03). Dado que buscamos por
 * conta propria nao passa por la: sem esta chamada, o badge exibiria `1` no
 * lugar de `UP` e `92` no lugar de `92%`.
 *
 * So as series de **metrica** passam por aqui. O frame de Problems e um field de
 * objetos (`FieldType.other`) em que nada do pipeline nativo se aplica — o
 * `applyFieldOverrides` sobre ele so gastaria tempo e instalaria um `display`
 * que ninguem chama.
 */
function aplicarConfig(
  frames: DataFrame[],
  fieldConfig: FieldConfigSource,
  replaceVariables: InterpolateFunction,
  theme: GrafanaTheme2,
  timeZone: string
): DataFrame[] {
  const metricas = frames.filter((frame) => frame.refId?.startsWith(METRICS_REF_PREFIX));

  if (metricas.length === 0) {
    return frames;
  }

  const comConfig = applyFieldOverrides({ data: metricas, fieldConfig, replaceVariables, theme, timeZone });
  const porFrame = new Map(metricas.map((frame, indice) => [frame, comConfig[indice]]));

  return frames.map((frame) => porFrame.get(frame) ?? frame);
}

function isFrame(frame: unknown): frame is DataFrame {
  return Boolean(frame && typeof frame === 'object' && Array.isArray((frame as DataFrame).fields));
}

function mensagem(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }

  const erro = err as { data?: { message?: string }; statusText?: string };
  return erro?.data?.message || erro?.statusText || 'Falha ao consultar o Zabbix.';
}
