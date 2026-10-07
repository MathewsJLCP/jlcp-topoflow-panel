import { DataFrame, DataQueryRequest, TimeRange } from '@grafana/data';
// `DataQuery` daqui, e nao de `@grafana/data`: la ele e um reexport depreciado,
// e este pacote e a casa dele — e a mesma origem de onde o proprio datasource
// Zabbix tipa as suas queries.
import { DataQuery } from '@grafana/schema';

import { Topology } from '../model/types';
import { templateFields } from './dimensions';
import { isProblemsFrame } from './problems';

/**
 * A query que o painel monta sozinho, quando o usuario liga "Buscar dados
 * direto do Zabbix".
 *
 * Existe porque **nao ha API publica para um painel escrever nas queries do
 * dashboard** — foi apurado contra o `@grafana/runtime` 13.1.0 e esta registrado
 * em `docs/prd-zabbix-direto.md`. Se a query nao pode vir ate o painel, o painel
 * vai ate o dado: `DataSourceApi.query()` e publico e chamavel daqui.
 *
 * Este modulo e **puro**: monta alvo e request, sem tocar em React nem no
 * datasource. Quem executa e `panel/useZabbixProblems.ts`.
 */

/** Query Mode *Problems* do datasource Zabbix (`MODE_PROBLEMS`). */
const QUERY_TYPE_PROBLEMS = '5';

/** Query Mode *Metrics* (`MODE_METRICS`). Diferente do de Problems, roda no backend. */
const QUERY_TYPE_METRICS = '0';

/**
 * Versao do modelo de query do datasource (`DS_QUERY_SCHEMA`).
 *
 * Carimbada para que os migradores dele tratem o alvo como atual. Todos sao
 * defensivos (`target.schema >= 12` e optional chaining), entao um numero
 * defasado nao quebraria — apenas rodaria migracao a toa sobre campos que nunca
 * existiram aqui.
 */
const DS_QUERY_SCHEMA = 12;

/** `refId` do alvo de Problems. Fixo: e um alvo so, para o mapa inteiro. */
export const PROBLEMS_REF_ID = 'topoflow-problems';

/** Prefixo dos alvos de metrica, um por host. */
export const METRICS_REF_PREFIX = 'topoflow-metrics-';

/**
 * Todos os hosts que a topologia observa por trigger, sem repetir.
 *
 * Varre os quatro tipos que tem vinculo — no, conexao, point e imagem. O texto
 * nao tem (decisao D5 do PRD anterior: o vinculo por trigger saiu dele).
 *
 * So conta vinculo **ligado e com host preenchido**: um rascunho no editor nao
 * pode alargar a query, e um vinculo desligado nao observa nada.
 */
export function triggerHosts(topology: Topology): string[] {
  const hosts = new Set<string>();

  for (const element of [...topology.nodes, ...topology.edges, ...topology.points, ...topology.images]) {
    const host = element.trigger?.enabled ? element.trigger.host.trim() : '';

    if (host) {
      hosts.add(host);
    }
  }

  return [...hosts];
}

/** Um vinculo por metrica: o par host + item que o elemento observa. */
export interface MetricBinding {
  host: string;
  item: string;
}

/**
 * Todos os pares host + item que a topologia observa, sem repetir.
 *
 * Varre os mesmos quatro tipos de `triggerHosts` — o texto nao tem vinculo de
 * estado. Elemento em **modo Trigger fica de fora**: com o vinculo de trigger
 * ligado, o nivel 1 da cadeia de cor e pulado por inteiro (ver
 * `resolveElementColor`), entao buscar a metrica dele seria pagar por um dado
 * que ninguem le.
 *
 * Rascunho pela metade (so host, ou so item) tambem fica de fora: nao e vinculo,
 * e viraria um filtro que casa o host inteiro.
 */
export function metricBindings(topology: Topology): MetricBinding[] {
  const vistos = new Map<string, MetricBinding>();

  const guardar = (binding: MetricBinding | undefined) => {
    if (binding) {
      vistos.set(`${binding.host}\n${binding.item}`, binding);
    }
  };

  for (const element of [...topology.nodes, ...topology.edges, ...topology.points, ...topology.images]) {
    if (element.trigger?.enabled) {
      continue;
    }

    const host = element.color.metric?.host.trim();
    const item = element.color.metric?.item.trim();

    if (host && item) {
      guardar({ host, item });
    }
  }

  /*
    Alem do vinculo de estado, entra **todo nome de serie referenciado** na
    topologia que tenha a forma `"<host>: <item>"`: o `${AGLIN-FW: CPU}` de um
    rotulo, o field escolhido em "Exibir valor", o texto de uma imagem.

    Sem isso, inserir uma metrica num texto so funcionaria se algum elemento ja a
    observasse como estado — e o campo "Inserir metrica" prometeria o que nao
    entrega.

    Palpite errado nao custa nada: um nome que nao seja de host some na traducao
    de nomes (`resolveHostNames` simplesmente nao o encontra) e nenhum alvo e
    montado por ele.
  */
  for (const nome of referencedFieldNames(topology)) {
    guardar(splitMetricName(nome));
  }

  return [...vistos.values()];
}

/** Nome da serie de um vinculo, como o painel a nomeia e o elemento a procura. */
export function metricFieldName({ host, item }: MetricBinding): string {
  return `${host}: ${item}`;
}

/**
 * O caminho inverso de `metricFieldName`.
 *
 * Corta no **primeiro** `": "`: nome de item costuma ter dois-pontos
 * (`Interface eth3: Bits received`), nome de host nao.
 */
function splitMetricName(nome: string): MetricBinding | undefined {
  const corte = nome.indexOf(': ');

  if (corte <= 0) {
    return undefined;
  }

  const host = nome.slice(0, corte).trim();
  const item = nome.slice(corte + 2).trim();

  return host && item ? { host, item } : undefined;
}

/**
 * Todo nome de serie que a topologia menciona, venha de onde vier: os campos que
 * apontam para um field direto e os `${...}` dentro dos textos.
 *
 * A lista de lugares e escrita a mao, e nao varrida do JSON, porque um
 * `JSON.stringify` pegaria junto os `${__value.raw}` de um drill-down e outros
 * templates do Grafana que nao sao serie nenhuma.
 */
function referencedFieldNames(topology: Topology): string[] {
  const nomes: Array<string | undefined> = [];
  const doTexto = (dim: { mode?: string; fixed?: string; field?: string } | undefined) => {
    if (!dim) {
      return;
    }
    nomes.push(dim.field);
    nomes.push(...templateFields(dim.fixed ?? ''));
  };

  for (const node of topology.nodes) {
    doTexto(node.presentation.primaryText);
    doTexto(node.presentation.secondaryText);
    nomes.push(node.value?.field);
  }

  for (const edge of topology.edges) {
    nomes.push(...templateFields(edge.label ?? ''));
  }

  for (const image of topology.images) {
    nomes.push(...templateFields(image.text ?? ''));
  }

  for (const text of topology.texts) {
    doTexto(text.content);
  }

  return nomes.filter((nome): nome is string => Boolean(nome?.trim()));
}

/**
 * Um alvo de metrica **por host**, com os itens daquele host em regex.
 *
 * Por host, e nao um so para tudo, porque o filtro do datasource e produto
 * cartesiano — host x item. Um alvo unico com dois hosts e dois itens buscaria
 * quatro series, tres delas para jogar fora. Agrupar por host mantem o produto
 * dentro do host, onde ele costuma ser o que se quer mesmo.
 *
 * Diferente do alvo de Problems, este roda no **backend** do datasource
 * (`isBackendTarget`), e o `refId` de cada um e o que permite acompanhar quem e
 * quem na resposta.
 */
export function metricTargets(bindings: MetricBinding[], datasource: { uid: string; type: string }): DataQuery[] {
  const porHost = new Map<string, string[]>();

  for (const { host, item } of bindings) {
    porHost.set(host, [...(porHost.get(host) ?? []), item]);
  }

  return [...porHost.entries()].map(([host, items], indice) => ({
    ...baseTarget(datasource),
    refId: `${METRICS_REF_PREFIX}${indice}`,
    queryType: QUERY_TYPE_METRICS,
    host: { filter: filterRegex([host]) },
    item: { filter: filterRegex(items) },
    // O backend le `functions` e `options` do alvo; sem a lista, a resposta vem
    // sem processamento nenhum, que e exatamente o que queremos.
    functions: [],
    resultFormat: 'time_series',
  })) as DataQuery[];
}

/**
 * Da a cada serie de metrica um nome **deterministico**: `"<host>: <item>"`.
 *
 * Sem isto, o nome da serie e o nome do item puro — e dois hosts com
 * `CPU Usage` produziriam duas series homonimas, com `getLastNotNullValue`
 * devolvendo sempre a primeira. O elemento do segundo host exibiria, em
 * silencio, o valor do primeiro. E o pior tipo de bug possivel num painel de
 * NOC: plausivel e errado.
 *
 * O par (host, item) vem dos **labels** que o backend do Zabbix poe em cada
 * field (`{host, item, item_key}`), e nao do nome da serie: labels sao dado
 * estruturado, nome e texto que a versao seguinte do datasource pode formatar
 * diferente.
 *
 * `displayNameFromDS` e onde o Grafana ja procura o nome vindo do datasource, e
 * `getFieldDisplayName` o respeita — e a forma menos invasiva de renomear, sem
 * tocar em `config.displayName`, que pertence ao usuario.
 */
export function nameMetricFields(frames: DataFrame[], comoSalvo: Map<string, string>): DataFrame[] {
  return frames.map((frame) => ({
    ...frame,
    fields: frame.fields.map((field) => {
      const host = field.labels?.host;
      const item = field.labels?.item;

      if (!host || !item) {
        return field;
      }

      /*
        O nome usa o host **como o vinculo o guardou**, e nao como o Zabbix o
        exibe: `stateFieldName` monta o candidato a partir do que esta salvo, e
        um elemento vinculado pelo nome tecnico procuraria `sysConcilia: CPU`
        enquanto o label traz `AGLIN-SRV-CONCILIACAO`.

        Vinculos do mesmo host com grafias diferentes no mesmo painel sao o unico
        caso que isto nao cobre: prevalece a primeira grafia, e o outro elemento
        fica em NO DATA. Sem dado e visivelmente diferente de errado, que e o que
        importa aqui.
      */
      const nome = comoSalvo.get(host) ?? host;

      return { ...field, config: { ...field.config, displayNameFromDS: `${nome}: ${item}` } };
    }),
  }));
}

/**
 * Filtro do datasource: uma regex ancorada com todos os nomes.
 *
 * Vale para host e para item — e o mesmo formato de filtro nos dois campos.
 *
 * **Um alvo so para o mapa inteiro** (ou um por host, no caso das metricas):
 * quarenta elementos nao viram quarenta queries. O datasource resolve a regex
 * contra a lista e manda os ids resultantes numa unica chamada.
 *
 * Ancorada nas duas pontas pelo mesmo motivo que `matchesHost` nunca usa
 * `contains`: sem `^...$`, `MMV-FW-01` casaria com `MMV-FW-011` e o elemento
 * receberia problema que nao e dele.
 */
export function filterRegex(nomes: string[]): string {
  return `/^(${nomes.map(escapeRegex).join('|')})$/`;
}

/** Metacaracteres de regex viram literais — nome de host pode conter ponto. */
function escapeRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * O alvo em Query Mode *Problems*.
 *
 * Os campos vazios **nao sao enfeite**: `queryProblems` do datasource le
 * `target.tags.filter` e `target.options.hostProxy` sem optional chaining, e
 * `getProblems` recebe `group`, `host`, `application` e `proxy` posicionalmente.
 * Faltar um deles e um TypeError dentro do datasource.
 *
 * O grupo vai na regex que casa tudo, e nao em vazio: com string vazia o
 * `findByFilter` do
 * datasource cai no `findByName`, nao acha grupo nenhum, e manda
 * `groupids: []` para a API — que em Zabbix significa "nenhum grupo", e nao
 * "todos". A query voltaria sempre vazia.
 *
 * `options` fica vazio de proposito: sem `useTimeRange`, o datasource chama
 * `getProblems` e devolve **todo problema aberto agora**, independentemente da
 * janela de tempo do dashboard. E o que um telao de NOC precisa — um alarme
 * aberto ha oito horas nao pode sumir porque alguem deixou o dashboard em
 * "ultimas 6 horas".
 */
export function problemsTarget(hosts: string[], datasource: { uid: string; type: string }): DataQuery {
  return {
    ...baseTarget(datasource),
    refId: PROBLEMS_REF_ID,
    queryType: QUERY_TYPE_PROBLEMS,
    host: { filter: filterRegex(hosts) },
  } as DataQuery;
}

/**
 * Os campos que **todo** alvo do datasource precisa ter, com ou sem uso.
 *
 * Nao sao enfeite: `queryProblems` le `target.tags.filter` e
 * `target.options.hostProxy` sem optional chaining, e `getProblems` recebe
 * `group`, `host`, `application` e `proxy` posicionalmente. Faltar um deles e um
 * TypeError dentro do datasource, longe da causa.
 */
function baseTarget(datasource: { uid: string; type: string }) {
  return {
    datasource,
    schema: DS_QUERY_SCHEMA,
    group: { filter: '/.*/' },
    application: { filter: '' },
    itemTag: { filter: '' },
    item: { filter: '' },
    macro: { filter: '' },
    proxy: { filter: '' },
    tags: { filter: '' },
    trigger: { filter: '' },
    options: {},
  };
}

/**
 * As series que o canvas enxerga, juntando as duas fontes.
 *
 * Com a secao Zabbix ligada, os frames de **Problems** do dashboard saem e
 * entram os nossos. Nao e capricho: as duas fontes trazem os mesmos problemas, e
 * somadas fariam cada alarme contar duas vezes — "4 incidentes ativos" viraria
 * 8, e a lista repetiria cada linha. Ligar a secao e dizer quem responde por
 * trigger.
 *
 * O resto dos frames do dashboard fica intacto: o vinculo por **metrica**
 * continua vindo das queries, e derruba-los junto quebraria metade do painel.
 */
export function panelSeries(dashboard: DataFrame[], zabbix: DataFrame[], zabbixLigado: boolean): DataFrame[] {
  if (!zabbixLigado) {
    return dashboard;
  }

  const proprios = dashboard.filter((frame) => !isProblemsFrame(frame));

  // Identidade preservada quando nada muda: o `useMemo` de quem chama depende
  // dela, e um array novo a cada render refaria o cache de display names.
  if (zabbix.length === 0) {
    return proprios.length === dashboard.length ? dashboard : proprios;
  }

  return [...proprios, ...zabbix];
}

/**
 * O `DataQueryRequest` que o query runner do painel montaria.
 *
 * Nao ha atalho: `ds.query()` e uma API publica, mas espera o objeto inteiro. Os
 * campos que o caminho de Problems de fato le sao `range`, `targets` e
 * `scopedVars`; o resto existe porque o datasource repassa a request adiante e
 * um `undefined` no meio do caminho vira excecao longe da causa.
 */
export function problemsRequest(
  targets: DataQuery[],
  range: TimeRange,
  timeZone: string,
  panelId: number,
  requestId: string
): DataQueryRequest {
  return {
    requestId,
    interval: '1m',
    intervalMs: 60_000,
    maxDataPoints: 100,
    range,
    rangeRaw: range.raw,
    scopedVars: {},
    targets,
    timezone: timeZone,
    app: 'dashboard',
    startTime: Date.now(),
    panelId,
  };
}
