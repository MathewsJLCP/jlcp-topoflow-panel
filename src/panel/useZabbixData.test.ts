import { EventBusSrv, dateTime } from '@grafana/data';
import { RefreshEvent } from '@grafana/runtime';
import { act, renderHook, waitFor } from '@testing-library/react';

import { useZabbixData } from './useZabbixData';

/**
 * O painel buscando os proprios problemas.
 *
 * O `ds.query` mockado e o ponto de corte: e a fronteira publica que usamos, e
 * o que esta em teste aqui e **quando** perguntamos, nao o que o datasource
 * responde. O formato do alvo esta fixado em `data/zabbixQuery.test.ts`.
 */

const query = jest.fn();

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => ({
    get: async () => ({ type: 'alexanderzobnin-zabbix-datasource', query: (...args: unknown[]) => query(...args) }),
  }),
}));

jest.mock('../data/zabbixApi', () => ({
  resolveZabbixUid: (configurado?: string) => (configurado === 'nenhum' ? undefined : 'zbx'),
  // O hook traduz os nomes salvos para os nomes visiveis antes de montar o
  // filtro; aqui o nome tecnico vira o visivel, que e o caso que importa.
  resolveHostNames: async (_uid: string, hosts: string[]) =>
    new Map(hosts.map((host) => [host, host === 'sysConcilia' ? 'AGLIN-SRV-CONCILIACAO' : host])),
}));

const frame = { refId: 'topoflow-problems', fields: [{ name: 'Problems', values: [] }], length: 0 };

/** `ds.query` devolve observable — e o hook aceita promise tambem. */
function responde(frames: unknown[]) {
  return {
    subscribe: (obs: { next: (v: unknown) => void; complete: () => void }) => {
      obs.next({ data: frames });
      obs.complete();
      return { unsubscribe: () => undefined };
    },
  };
}

const range = { from: dateTime(1000), to: dateTime(2000), raw: { from: 'now-6h', to: 'now' } };

function montar(overrides: Record<string, unknown> = {}) {
  const eventBus = new EventBusSrv();
  const props = {
    enabled: true,
    datasource: 'zbx',
    hosts: ['AGLIN-FW'],
    metrics: [],
    range,
    timeZone: 'utc',
    panelId: 1,
    eventBus,
    fieldConfig: { defaults: {}, overrides: [] },
    replaceVariables: (texto: string) => texto,
    ...overrides,
  };

  const view = renderHook((p: typeof props) => useZabbixData(p), { initialProps: props });
  return { ...view, eventBus };
}

beforeEach(() => {
  query.mockReset();
  query.mockImplementation(() => responde([frame]));
});

describe('quando o painel pergunta ao Zabbix', () => {
  it('desligado, não consulta nada', async () => {
    const { result } = montar({ enabled: false });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(query).not.toHaveBeenCalled();
    expect(result.current.frames).toEqual([]);
  });

  /** Sem vínculo nenhum não há o que perguntar — e a regex vazia não casaria nada. */
  it('sem hosts vinculados, não consulta nada', async () => {
    const { result } = montar({ hosts: [] });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(query).not.toHaveBeenCalled();
  });

  it('sem datasource resolvido, não consulta nada', async () => {
    montar({ datasource: 'nenhum' });

    await waitFor(() => expect(query).not.toHaveBeenCalled());
  });

  it('ligado, consulta uma vez e entrega os frames', async () => {
    const { result } = montar();

    await waitFor(() => expect(result.current.frames).toEqual([frame]));
    expect(query).toHaveBeenCalledTimes(1);
  });

  /**
   * Um alvo só para o mapa inteiro, com os nomes já traduzidos para os visíveis
   * — o único campo que o filtro de host do datasource testa.
   */
  it('monta um alvo só, com os hosts traduzidos', async () => {
    const { result } = montar({ hosts: ['AGLIN-FW', 'sysConcilia'] });

    await waitFor(() => expect(query).toHaveBeenCalledTimes(1));
    const request = query.mock.calls[0][0];

    expect(request.targets).toHaveLength(1);
    expect(request.targets[0].host.filter).toBe('/^(AGLIN-FW|AGLIN-SRV-CONCILIACAO)$/');
    expect(result.current.error).toBeUndefined();
  });

  /** Sem isto o mapa só se atualizaria ao mudar a janela de tempo. */
  it('o refresh do dashboard dispara nova consulta', async () => {
    const { eventBus } = montar();

    await waitFor(() => expect(query).toHaveBeenCalledTimes(1));

    await act(async () => {
      eventBus.publish(new RefreshEvent());
    });

    await waitFor(() => expect(query).toHaveBeenCalledTimes(2));
  });

  it('mudar de host refaz a consulta; render sem mudança, não', async () => {
    const { rerender, eventBus } = montar();
    const props = (hosts: string[]) => ({
      enabled: true,
      datasource: 'zbx',
      hosts,
      metrics: [],
      range,
      timeZone: 'utc',
      panelId: 1,
      eventBus,
      fieldConfig: { defaults: {}, overrides: [] },
      replaceVariables: (texto: string) => texto,
    });

    await waitFor(() => expect(query).toHaveBeenCalledTimes(1));

    /*
      Mesma lista, array novo: é o que acontece a cada render do painel, porque
      `triggerHosts` varre a topologia e devolve um array novo toda vez. Como
      dependência crua, isso seria uma consulta ao Zabbix **por render**.
    */
    rerender(props(['AGLIN-FW']));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(query).toHaveBeenCalledTimes(1);

    // Vincular outro elemento a outro host, esse sim, muda a pergunta.
    rerender(props(['AGLIN-FW', 'MMV-FW']));
    await waitFor(() => expect(query).toHaveBeenCalledTimes(2));
  });

  /**
   * Num telão, apagar o mapa porque uma atualização falhou é pior que mostrar o
   * estado de um minuto atrás — com o erro à vista, para ninguém ler dado velho
   * achando que é novo.
   */
  it('falha preserva os frames anteriores e reporta', async () => {
    const { result, eventBus } = montar();

    await waitFor(() => expect(result.current.frames).toEqual([frame]));

    query.mockImplementation(() => {
      throw new Error('502 Bad Gateway');
    });

    await act(async () => {
      eventBus.publish(new RefreshEvent());
    });

    await waitFor(() => expect(result.current.error).toBe('502 Bad Gateway'));
    expect(result.current.frames).toEqual([frame]);
  });
});

describe('vínculo por métrica', () => {
  const metrics = [
    { host: 'AGLIN-FW', item: 'CPU Usage' },
    { host: 'sysConcilia', item: 'Memória' },
  ];

  it('um alvo por host, além do de problemas', async () => {
    montar({ metrics });

    await waitFor(() => expect(query).toHaveBeenCalledTimes(1));
    const { targets } = query.mock.calls[0][0];

    // Problems + (Metrics, Text) por host.
    expect(targets).toHaveLength(5);
    expect(targets[0].queryType).toBe('5');
    expect(targets.slice(1).map((t: { queryType: string }) => t.queryType)).toEqual(['0', '2', '0', '2']);
    // O host técnico entra na query já traduzido para o nome visível.
    expect(targets[3].host.filter).toBe('/^(AGLIN-SRV-CONCILIACAO)$/');
    expect(targets[1].item.filter).toBe('/^(CPU Usage)$/');
  });

  it('só métrica, sem trigger, não pede problemas', async () => {
    montar({ hosts: [], metrics });

    await waitFor(() => expect(query).toHaveBeenCalledTimes(1));
    const { targets } = query.mock.calls[0][0];

    expect(targets.map((t: { queryType: string }) => t.queryType)).toEqual(['0', '2', '0', '2']);
  });

  /** A série volta nomeada como o vínculo a procura — ver `nameMetricFields`. */
  it('nomeia a série com a grafia salva no vínculo', async () => {
    const serie = {
      refId: 'topoflow-metrics-0',
      length: 1,
      fields: [
        {
          name: 'Value',
          type: 'number',
          values: [92],
          config: {},
          labels: { host: 'AGLIN-SRV-CONCILIACAO', item: 'Memória' },
        },
      ],
    };
    query.mockImplementation(() => responde([serie]));

    const { result } = montar({ hosts: [], metrics: [{ host: 'sysConcilia', item: 'Memória' }] });

    await waitFor(() => expect(result.current.frames).toHaveLength(1));
    expect(result.current.frames[0].fields[0].config.displayNameFromDS).toBe('sysConcilia: Memória');
  });
});
