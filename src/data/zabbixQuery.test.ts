import { DataFrame, FieldType, dateTime, toDataFrame } from '@grafana/data';

import { sampleTopology } from '../model/sampleTopology';
import { Topology, TriggerBinding } from '../model/types';
import {
  PROBLEMS_REF_ID,
  filterRegex,
  metricBindings,
  metricTargets,
  nameMetricFields,
  panelSeries,
  problemsRequest,
  problemsTarget,
  triggerHosts,
} from './zabbixQuery';

/**
 * O alvo que o painel monta quando busca os proprios problemas.
 *
 * O que estes testes fixam e o **contrato com o datasource Zabbix**, que nao e
 * tipado do nosso lado: os campos que `queryProblems` e `getProblems` leem sem
 * optional chaining, e o formato do filtro de host. Errar aqui e um TypeError
 * dentro do datasource, longe da causa.
 */

const ligado = (host: string): TriggerBinding => ({ enabled: true, host, names: [], showActive: true });

function topologia(overrides: Partial<Topology>): Topology {
  return { ...sampleTopology, ...overrides };
}

describe('triggerHosts', () => {
  it('colhe host dos quatro tipos que têm vínculo', () => {
    const [no] = sampleTopology.nodes;
    const [aresta] = sampleTopology.edges;

    const hosts = triggerHosts(
      topologia({
        nodes: [{ ...no, trigger: ligado('host-no') }],
        edges: [{ ...aresta, trigger: ligado('host-aresta') }],
        points: [{ id: 'p1', position: { x: 0, y: 0 }, color: {}, zIndex: 0, trigger: ligado('host-point') }],
        images: [
          {
            id: 'i1',
            position: { x: 0, y: 0 },
            size: { width: 10, height: 10 },
            src: 'classic/router',
            fit: 'contain',
            fontSize: 12,
            zIndex: 0,
            color: {},
            trigger: ligado('host-imagem'),
          },
        ],
      })
    );

    expect(hosts.sort()).toEqual(['host-aresta', 'host-imagem', 'host-no', 'host-point']);
  });

  /** Um vínculo desligado não observa nada — não pode alargar a query. */
  it('ignora vínculo desligado, host vazio e rascunho em branco', () => {
    const [a, b, c] = sampleTopology.nodes;

    const hosts = triggerHosts(
      topologia({
        nodes: [
          { ...a, trigger: { ...ligado('desligado'), enabled: false } },
          { ...b, trigger: ligado('   ') },
          { ...c, trigger: undefined },
        ],
        edges: [],
      })
    );

    expect(hosts).toEqual([]);
  });

  it('não repete host usado por vários elementos', () => {
    const [a, b] = sampleTopology.nodes;

    const hosts = triggerHosts(
      topologia({
        nodes: [
          { ...a, trigger: ligado('mesmo') },
          { ...b, trigger: ligado('mesmo') },
        ],
        edges: [],
      })
    );

    expect(hosts).toEqual(['mesmo']);
  });
});

describe('filterRegex', () => {
  /**
   * Sem âncora, `MMV-FW-01` casaria com `MMV-FW-011` — o mesmo motivo pelo qual
   * `matchesHost` nunca usa `contains`.
   */
  it('ancora nas duas pontas', () => {
    expect(filterRegex(['a', 'b'])).toBe('/^(a|b)$/');
  });

  it('escapa metacaractere no nome do host', () => {
    expect(filterRegex(['srv.app-01'])).toBe('/^(srv\\.app-01)$/');
  });
});

describe('problemsTarget', () => {
  const alvo = problemsTarget(['AGLIN-FW'], { uid: 'zbx', type: 'alexanderzobnin-zabbix-datasource' }) as Record<
    string,
    any
  >;

  it('é uma query de Problems, com o refId do painel', () => {
    expect(alvo.queryType).toBe('5');
    expect(alvo.refId).toBe(PROBLEMS_REF_ID);
    expect(alvo.datasource).toEqual({ uid: 'zbx', type: 'alexanderzobnin-zabbix-datasource' });
  });

  /**
   * `queryProblems` lê `target.tags.filter` e `target.options.hostProxy` sem
   * optional chaining, e `getProblems` recebe group/host/application/proxy
   * posicionalmente. Faltar um é TypeError dentro do datasource.
   */
  it('traz todos os campos que o datasource lê sem proteção', () => {
    for (const campo of ['group', 'host', 'application', 'proxy', 'tags', 'trigger', 'item', 'itemTag', 'macro']) {
      expect(alvo[campo]).toHaveProperty('filter');
    }

    expect(alvo.options).toEqual({});
  });

  /**
   * Com filtro de grupo vazio o datasource cai no `findByName`, não acha grupo
   * nenhum e manda `groupids: []` — que em Zabbix significa "nenhum grupo", não
   * "todos". A query voltaria sempre vazia.
   */
  it('filtra grupo por regex-tudo, e não por vazio', () => {
    expect(alvo.group.filter).toBe('/.*/');
    expect(alvo.host.filter).toBe('/^(AGLIN-FW)$/');
  });

  /**
   * Sem `useTimeRange`, o datasource devolve todo problema aberto agora. É o que
   * um telão de NOC precisa: um alarme aberto há oito horas não pode sumir
   * porque o dashboard está em "últimas 6 horas".
   */
  it('não amarra os problemas à janela de tempo do dashboard', () => {
    expect(alvo.options.useTimeRange).toBeUndefined();
  });
});

describe('problemsRequest', () => {
  it('leva alvos, janela e painel', () => {
    const range = { from: dateTime(1000), to: dateTime(2000), raw: { from: 'now-6h', to: 'now' } };
    const request = problemsRequest([{ refId: 'A' }], range, 'utc', 7, 'pedido-1');

    expect(request).toMatchObject({
      requestId: 'pedido-1',
      targets: [{ refId: 'A' }],
      range,
      rangeRaw: range.raw,
      timezone: 'utc',
      panelId: 7,
    });
    expect(request.startTime).toBeGreaterThan(0);
  });
});

/**
 * Juntar as duas fontes tem uma regra que so aparece quando as duas existem: com
 * o Zabbix ligado, quem responde por trigger e ele, e nao a query do dashboard.
 */
describe('panelSeries', () => {
  const problemas = (refId: string): DataFrame => ({
    refId,
    name: 'problems',
    length: 0,
    fields: [{ name: 'Problems', type: FieldType.other, values: [], config: { custom: { type: 'problems' } } }],
  });

  const metrica = toDataFrame({ refId: 'M', fields: [{ name: 'cpu', type: FieldType.number, values: [1] }] });

  it('desligado, entrega o que o dashboard trouxe, sem tocar em nada', () => {
    const dashboard = [problemas('A'), metrica];

    expect(panelSeries(dashboard, [problemas('nossa')], false)).toBe(dashboard);
  });

  /**
   * As duas fontes trazem os mesmos problemas: somadas, cada alarme contaria
   * duas vezes e "4 incidentes ativos" viraria 8.
   */
  it('ligado, os problemas do dashboard cedem lugar aos nossos', () => {
    const nossos = problemas('nossa');
    const juntas = panelSeries([problemas('A'), metrica], [nossos], true);

    expect(juntas).toEqual([metrica, nossos]);
  });

  /** A métrica continua vindo das queries — derrubá-la quebraria metade do painel. */
  it('ligado, preserva os frames de métrica do dashboard', () => {
    expect(panelSeries([metrica], [], true)).toEqual([metrica]);
  });

  /**
   * Identidade preservada quando nada muda: quem chama guarda o resultado num
   * `useMemo`, e um array novo a cada render refaria o cache de display names.
   */
  it('sem nada a mudar, devolve o mesmo array', () => {
    const dashboard = [metrica];

    expect(panelSeries(dashboard, [], true)).toBe(dashboard);
  });
});

/**
 * O vinculo por metrica: quais pares host+item o painel vai buscar, e como as
 * series voltam nomeadas.
 */
describe('metricBindings', () => {
  const comMetrica = (id: string, host: string, item: string) => ({
    ...sampleTopology.nodes[0],
    id,
    color: { metric: { host, item } },
  });

  it('colhe os pares host + item, sem repetir', () => {
    const bindings = metricBindings(
      topologia({
        nodes: [comMetrica('a', 'H1', 'CPU'), comMetrica('b', 'H1', 'CPU'), comMetrica('c', 'H2', 'Memória')],
        edges: [],
      })
    );

    expect(bindings).toEqual([
      { host: 'H1', item: 'CPU' },
      { host: 'H2', item: 'Memória' },
    ]);
  });

  /**
   * Com o vínculo de trigger ligado, o nível 1 da cadeia de cor é pulado por
   * inteiro: buscar a métrica desse elemento seria pagar por um dado que
   * ninguém lê.
   */
  it('ignora elemento em modo Trigger', () => {
    const no = { ...comMetrica('a', 'H1', 'CPU'), trigger: ligado('H1') };

    expect(metricBindings(topologia({ nodes: [no], edges: [] }))).toEqual([]);
  });

  /**
   * Inserir uma métrica num texto só funcionaria se algum elemento já a
   * observasse como estado — e o campo "Inserir métrica" prometeria o que não
   * entrega. Palpite errado não custa nada: um nome que não seja de host some na
   * tradução de nomes e nenhum alvo é montado por ele.
   */
  it('colhe também o que os textos e o badge referenciam', () => {
    const no = {
      ...sampleTopology.nodes[0],
      color: {},
      value: { field: 'H2: Disco' },
      presentation: {
        ...sampleTopology.nodes[0].presentation,
        primaryText: { mode: 'fixed' as const, fixed: 'IN ${H1: traffic in} / OUT ${H1: traffic out}' },
        secondaryText: { mode: 'field' as const, field: 'H3: uptime' },
      },
    };

    expect(metricBindings(topologia({ nodes: [no], edges: [] }))).toEqual([
      { host: 'H1', item: 'traffic in' },
      { host: 'H1', item: 'traffic out' },
      { host: 'H3', item: 'uptime' },
      { host: 'H2', item: 'Disco' },
    ]);
  });

  /** Nome de item costuma ter dois-pontos; nome de host, não. */
  it('corta no primeiro dois-pontos', () => {
    const no = {
      ...sampleTopology.nodes[0],
      color: {},
      value: { field: 'H1: Interface eth3: Bits received' },
    };

    expect(metricBindings(topologia({ nodes: [no], edges: [] }))).toEqual([
      { host: 'H1', item: 'Interface eth3: Bits received' },
    ]);
  });

  /** Nome de field comum não vira vínculo — não tem a forma `host: item`. */
  it('ignora nome sem dois-pontos', () => {
    const no = { ...sampleTopology.nodes[0], color: {}, value: { field: 'cpu' } };

    expect(metricBindings(topologia({ nodes: [no], edges: [] }))).toEqual([]);
  });

  it('ignora rascunho pela metade', () => {
    const bindings = metricBindings(
      topologia({ nodes: [comMetrica('a', 'H1', '  '), comMetrica('b', '', 'CPU')], edges: [] })
    );

    expect(bindings).toEqual([]);
  });
});

describe('metricTargets', () => {
  const ds = { uid: 'zbx', type: 'alexanderzobnin-zabbix-datasource' };

  /**
   * Um alvo por host: o filtro do datasource é produto cartesiano (host × item),
   * e um alvo único com dois hosts e dois itens buscaria quatro séries, três
   * delas para jogar fora.
   */
  it('agrupa por host, com os itens daquele host', () => {
    const alvos = metricTargets(
      [
        { host: 'H1', item: 'CPU' },
        { host: 'H2', item: 'Memória' },
        { host: 'H1', item: 'Disco' },
      ],
      ds
    ) as Array<Record<string, any>>;

    expect(alvos).toHaveLength(2);
    expect(alvos[0].host.filter).toBe('/^(H1)$/');
    expect(alvos[0].item.filter).toBe('/^(CPU|Disco)$/');
    expect(alvos[1].host.filter).toBe('/^(H2)$/');
    expect(alvos[0].queryType).toBe('0');
    // refIds distintos: é por eles que a resposta é reconhecida depois.
    expect(alvos[0].refId).not.toBe(alvos[1].refId);
  });

  it('traz os campos que o datasource lê sem proteção', () => {
    const [alvo] = metricTargets([{ host: 'H1', item: 'CPU' }], ds) as Array<Record<string, any>>;

    for (const campo of ['group', 'host', 'application', 'proxy', 'tags', 'trigger', 'item', 'itemTag', 'macro']) {
      expect(alvo[campo]).toHaveProperty('filter');
    }
  });
});

/**
 * Dois hosts com `CPU Usage` produziriam duas séries homônimas, e
 * `getLastNotNullValue` devolveria sempre a primeira: o elemento do segundo host
 * exibiria, em silêncio, o valor do primeiro. O pior tipo de bug num painel de
 * NOC — plausível e errado.
 */
describe('nameMetricFields', () => {
  const serie = (host: string, item: string): DataFrame => ({
    refId: 'topoflow-metrics-0',
    length: 1,
    fields: [
      { name: 'Time', type: FieldType.time, values: [1], config: {} },
      { name: 'Value', type: FieldType.number, values: [92], config: {}, labels: { host, item } },
    ],
  });

  it('nomeia a série com host e item', () => {
    const [frame] = nameMetricFields([serie('AGLIN-FW', 'CPU Usage')], new Map());

    expect(frame.fields[1].config.displayNameFromDS).toBe('AGLIN-FW: CPU Usage');
  });

  /** O elemento procura pelo nome como o vínculo o guardou, não como o Zabbix o exibe. */
  it('usa a grafia salva no vínculo quando ela difere da visível', () => {
    const mapa = new Map([['AGLIN-SRV-CONCILIACAO', 'sysConcilia']]);
    const [frame] = nameMetricFields([serie('AGLIN-SRV-CONCILIACAO', 'CPU')], mapa);

    expect(frame.fields[1].config.displayNameFromDS).toBe('sysConcilia: CPU');
  });

  it('field sem labels fica como está', () => {
    const [frame] = nameMetricFields([serie('H', 'I')], new Map());

    expect(frame.fields[0].config.displayNameFromDS).toBeUndefined();
  });
});
