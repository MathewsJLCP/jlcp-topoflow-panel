import {
  ZABBIX_DS_TYPE,
  clearZabbixCache,
  expandItemName,
  listItems,
  listTriggers,
  resolveZabbixUid,
  searchHosts,
} from './zabbixApi';

/**
 * O modulo nunca conversa com o Zabbix direto: fala com o **resource endpoint**
 * do datasource. O que estes testes fixam e o contrato dessa conversa — qual
 * metodo, com quais parametros, e quantas vezes.
 *
 * O `postResource` mockado e o ponto de corte certo: e a fronteira publica que
 * usamos, e testar acima dela (no `fetch`) seria testar o Grafana.
 */

const postResource = jest.fn();
const getInstanceSettings = jest.fn();
const getList = jest.fn();

jest.mock('@grafana/runtime', () => ({
  getDataSourceSrv: () => ({
    get: async () => ({ postResource: (...args: unknown[]) => postResource(...args) }),
    getInstanceSettings: (...args: unknown[]) => getInstanceSettings(...args),
    getList: (...args: unknown[]) => getList(...args),
  }),
  getTemplateSrv: () => ({ replace: (texto: string) => texto.replace('${zbx}', 'uid-var') }),
}));

/**
 * O endpoint responde com o **envelope** `{ result }`, e nao com a lista. O
 * helper existe para que nenhum teste volte a escrever a suposicao errada — foi
 * exatamente ela que passou pelo jest e quebrou no browser.
 */
function responde(result: unknown) {
  return Promise.resolve({ result });
}

/** O que `postResource` recebeu na chamada `n`, ja desempacotado. */
function chamada(n = 0): { method: string; params: Record<string, unknown> } {
  return postResource.mock.calls[n][1];
}

beforeEach(() => {
  clearZabbixCache();
  postResource.mockReset();
  getInstanceSettings.mockReset();
  getList.mockReset();
});

describe('resolveZabbixUid', () => {
  it('aceita o uid escolhido quando ele e mesmo um Zabbix', () => {
    getInstanceSettings.mockReturnValue({ uid: 'zbx1', type: ZABBIX_DS_TYPE });

    expect(resolveZabbixUid('zbx1')).toBe('zbx1');
  });

  /**
   * O uid salvo pode ter virado outra coisa: datasource removido e recriado com
   * outro tipo, dashboard exportado para outra instancia. Perguntar `host.get` a
   * um Prometheus daria erro dentro do combo, sem nada explicando.
   */
  it('recusa um uid que aponta para outro tipo de datasource', () => {
    getInstanceSettings.mockReturnValue({ uid: 'prom', type: 'prometheus' });

    expect(resolveZabbixUid('prom')).toBeUndefined();
  });

  it('interpola variavel de datasource', () => {
    getInstanceSettings.mockReturnValue({ uid: 'uid-var', type: ZABBIX_DS_TYPE });

    expect(resolveZabbixUid('${zbx}')).toBe('uid-var');
    expect(getInstanceSettings).toHaveBeenCalledWith('uid-var');
  });

  it('sem escolha, adota o unico Zabbix da instancia', () => {
    getList.mockReturnValue([{ uid: 'unico', type: ZABBIX_DS_TYPE }]);

    expect(resolveZabbixUid()).toBe('unico');
    // `pluginId`, e nao `type`: e a condicao que faz o `getList` parar de
    // acrescentar os datasources embutidos do Grafana ao resultado.
    expect(getList).toHaveBeenCalledWith({ pluginId: ZABBIX_DS_TYPE });
  });

  /**
   * `getList` acrescenta `-- Grafana --` ao resultado **depois** de filtrar. Sem
   * a nossa peneira por `type`, uma instancia sem Zabbix nenhum pareceria ter
   * exatamente um — e todo `host.get` iria parar no datasource embutido do
   * Grafana, em silencio. Foi o e2e no browser que exibiu o sintoma.
   */
  it('descarta o que o getList acrescenta por conta propria', () => {
    getList.mockReturnValue([{ uid: 'grafana', type: 'datasource', name: '-- Grafana --' }]);

    expect(resolveZabbixUid()).toBeUndefined();
  });

  /**
   * Chutar o primeiro faria o combo listar hosts de outro ambiente — pior que
   * nao listar nada, porque parece certo.
   */
  it('com dois Zabbix e nenhuma escolha, nao adivinha', () => {
    getList.mockReturnValue([
      { uid: 'a', type: ZABBIX_DS_TYPE },
      { uid: 'b', type: ZABBIX_DS_TYPE },
    ]);

    expect(resolveZabbixUid()).toBeUndefined();
  });

  it('fora de um Grafana, nao ha catalogo — e nao ha excecao', () => {
    getList.mockImplementation(() => {
      throw new Error('sem singleton');
    });

    expect(resolveZabbixUid()).toBeUndefined();
  });
});

describe('searchHosts', () => {
  it('busca por nome visivel e por nome tecnico', async () => {
    postResource.mockReturnValue(responde([{ hostid: '1', name: 'AGLIN-FW', host: 'aglin.fw.local' }]));

    const hosts = await searchHosts('zbx', ' aglin ');

    expect(chamada().method).toBe('host.get');
    expect(chamada().params).toMatchObject({
      search: { name: 'aglin', host: 'aglin' },
      searchByAny: true,
    });
    expect(hosts).toHaveLength(1);
  });

  /** Combo recem-aberto: a lista inicial e o comeco do catalogo, nao o vazio. */
  it('sem termo, nao manda filtro nenhum', async () => {
    postResource.mockReturnValue(responde([]));

    await searchHosts('zbx', '   ');

    expect(chamada().params).not.toHaveProperty('search');
    expect(chamada().params).toMatchObject({ sortfield: 'name' });
  });
});

describe('o envelope da resposta', () => {
  /** O sintoma real, no browser: `r.map is not a function` dentro do combo. */
  it('desembrulha o `result`', async () => {
    postResource.mockReturnValue(responde([{ hostid: '1', name: 'AGLIN-FW' }]));

    await expect(searchHosts('zbx', '')).resolves.toEqual([{ hostid: '1', name: 'AGLIN-FW' }]);
  });

  /**
   * Nem toda falha do Zabbix vira HTTP nao-2xx. Sem isto, a mensagem legivel do
   * Zabbix chegaria ao usuario como um `undefined` sem `.map`.
   */
  it('transforma o `error` do envelope em excecao legivel', async () => {
    postResource.mockResolvedValue({
      error: { message: 'Application error.', data: 'No permissions to referred object.' },
    });

    await expect(searchHosts('zbx', '')).rejects.toThrow('Application error. No permissions to referred object.');
  });
});

describe('cache', () => {
  it('duas perguntas iguais viram uma requisicao', async () => {
    postResource.mockReturnValue(responde([]));

    await searchHosts('zbx', 'a');
    await searchHosts('zbx', 'a');

    expect(postResource).toHaveBeenCalledTimes(1);
  });

  it('termos diferentes sao perguntas diferentes', async () => {
    postResource.mockReturnValue(responde([]));

    await searchHosts('zbx', 'a');
    await searchHosts('zbx', 'ab');

    expect(postResource).toHaveBeenCalledTimes(2);
  });

  /**
   * Erro cacheado deixaria o combo mudo por 30s depois de o Zabbix voltar — e o
   * usuario nao tem como saber que precisa esperar.
   */
  it('erro nao fica guardado', async () => {
    postResource.mockRejectedValueOnce(new Error('502'));
    await expect(searchHosts('zbx', 'a')).rejects.toThrow('502');

    postResource.mockReturnValue(responde([{ hostid: '1', name: 'AGLIN-FW' }]));
    await expect(searchHosts('zbx', 'a')).resolves.toHaveLength(1);
  });
});

describe('listTriggers', () => {
  it('resolve o hostid antes, e pede as triggers monitoradas com a descricao expandida', async () => {
    postResource
      .mockReturnValueOnce(responde([{ hostid: '10084', name: 'AGLIN-FW' }]))
      .mockReturnValueOnce(responde([{ triggerid: '5', description: 'Unavailable by ICMP ping', priority: '4' }]));

    const triggers = await listTriggers('zbx', 'AGLIN-FW');

    expect(chamada(0).method).toBe('host.get');
    expect(chamada(0).params).toMatchObject({ filter: { name: ['AGLIN-FW'], host: ['AGLIN-FW'] }, searchByAny: true });
    expect(chamada(1).method).toBe('trigger.get');
    expect(chamada(1).params).toMatchObject({ hostids: ['10084'], expandDescription: true, monitored: true });
    expect(triggers[0].description).toBe('Unavailable by ICMP ping');
  });

  /**
   * Quem digitou um host que ainda nao existe no Zabbix precisa continuar
   * podendo digitar a trigger — o vinculo pode ser criado antes do host.
   */
  it('host desconhecido devolve lista vazia, sem pedir triggers', async () => {
    postResource.mockReturnValueOnce(responde([]));

    await expect(listTriggers('zbx', 'nao-existe')).resolves.toEqual([]);
    expect(postResource).toHaveBeenCalledTimes(1);
  });

  it('host em branco nem chega a perguntar', async () => {
    await expect(listTriggers('zbx', '  ')).resolves.toEqual([]);
    expect(postResource).not.toHaveBeenCalled();
  });
});

describe('listItems', () => {
  it('pede so item numerico e expande o nome como o datasource faz', async () => {
    postResource
      .mockReturnValueOnce(responde([{ hostid: '10084', name: 'AGLIN-FW' }]))
      .mockReturnValueOnce(responde([{ itemid: '9', name: 'CPU $2 time', key_: 'system.cpu.util[,system,avg1]' }]));

    const items = await listItems('zbx', 'AGLIN-FW');

    expect(chamada(1).method).toBe('item.get');
    expect(chamada(1).params).toMatchObject({ hostids: ['10084'], filter: { value_type: [0, 3] } });
    expect(items[0].name).toBe('CPU system time');
  });
});

/**
 * O nome expandido e o que vira **nome da serie** no frame. Errar aqui faz o
 * vinculo apontar para um field que nao existe — falha silenciosa, com o
 * elemento em NO DATA e o combo mostrando o nome certo.
 */
describe('expandItemName', () => {
  it('troca os posicionais pelos parametros da chave', () => {
    expect(expandItemName('CPU $2 time', 'system.cpu.util[,system,avg1]')).toBe('CPU system time');
  });

  it('chave sem parametros fica como esta', () => {
    expect(expandItemName('Uptime', 'system.uptime')).toBe('Uptime');
  });

  /**
   * A virgula dentro das aspas nao separa parametro, e o colchete aninhado nao
   * separa nem aparece: os simbolos `[` e `]` internos so ligam e desligam o
   * modo "dentro de array" e sao descartados.
   *
   * Nao e capricho nosso — e exatamente o que `splitKeyParams` do grafana-zabbix
   * faz. **Fidelidade e o requisito**, e nao elegancia: o nome que sai daqui tem
   * que ser byte a byte o nome que o datasource dara a serie.
   */
  it('respeita aspas e colchetes aninhados, como o datasource', () => {
    expect(expandItemName('$1 e $2', 'k["a,b",c[1,2]]')).toBe('a,b e c1,2');
  });

  /** Com 10+ parametros, trocar `$1` antes comeria o `$1` de `$10`. */
  it('expande de tras para frente', () => {
    const key = 'k[p1,p2,p3,p4,p5,p6,p7,p8,p9,p10]';
    expect(expandItemName('$10', key)).toBe('p10');
  });
});
