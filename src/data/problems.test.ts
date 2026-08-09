import { DataFrame, Field, FieldType, toDataFrame } from '@grafana/data';

import {
  SEVERITY_COLOR,
  ZabbixProblem,
  extractProblems,
  hasProblemsFrame,
  isActiveProblem,
  isProblemsFrame,
  listHosts,
  listTriggers,
  matchesHost,
  matchesName,
  problemSeverity,
} from './problems';

/**
 * Reproduz o frame do datasource literalmente, como `problemsHandler.toDataFrame`
 * o monta — e nao via `toDataFrame`, que normalizaria o field e apagaria
 * justamente o que estamos testando reconhecer.
 */
function problemsFrame(values: unknown[], refId = 'A'): DataFrame {
  const field: Field = {
    name: 'Problems',
    type: FieldType.other,
    values,
    config: { custom: { type: 'problems' } },
  };

  return { name: 'problems', refId, length: values.length, fields: [field] };
}

/** Frame de metrica comum, do jeito que uma query de itens chega ao painel. */
function metricFrame(): DataFrame {
  return toDataFrame({
    fields: [
      { name: 'time', type: FieldType.time, values: [1, 2] },
      { name: 'cpu', type: FieldType.number, values: [10, 92] },
    ],
  });
}

/** Linha real da FABRAWEB, reduzida aos campos que lemos. */
const ICMP: ZabbixProblem = {
  hosts: [{ name: 'AGLIN-FW-STARTI', host: 'AGLIN-FW-STARTI-aglin.stsec.com.br' }],
  name: 'Unavailable by ICMP ping',
  severity: '4',
  value: '1',
};

const SLA: ZabbixProblem = {
  hosts: [{ name: 'MMV-FW-STARTI-01', host: 'MMV-FW-STARTI-01-mmvpneus.stsec.com.br' }],
  name: 'SLA do mes corrente abaixo do SLO (98.5%)',
  severity: '2',
  value: '1',
};

describe('isProblemsFrame', () => {
  it('reconhece o frame de uma query em Query Mode Problems', () => {
    expect(isProblemsFrame(problemsFrame([ICMP]))).toBe(true);
  });

  it('ignora um frame de metrica', () => {
    expect(isProblemsFrame(metricFrame())).toBe(false);
  });

  it('ignora um frame sem fields', () => {
    expect(isProblemsFrame({ length: 0, fields: [] })).toBe(false);
  });

  /**
   * O `isProblemsDataFrame` original do grafana-zabbix indexa `config.custom`
   * sem guard. Qualquer frame de outro datasource sem `custom` explodiria.
   */
  it('nao explode em field sem `config.custom`', () => {
    const frame: DataFrame = {
      length: 1,
      fields: [{ name: 'qualquer', type: FieldType.other, values: [{}], config: {} }],
    };

    expect(isProblemsFrame(frame)).toBe(false);
  });

  it('um frame de Problems vazio continua sendo um frame de Problems', () => {
    // Distingue "sem query de Problems" de "query sem problema ativo": a
    // primeira e erro de configuracao, a segunda e a topologia saudavel.
    expect(isProblemsFrame(problemsFrame([]))).toBe(true);
    expect(hasProblemsFrame([metricFrame(), problemsFrame([])])).toBe(true);
    expect(hasProblemsFrame([metricFrame()])).toBe(false);
  });
});

describe('extractProblems', () => {
  it('achata todos os frames de Problems e ignora o resto', () => {
    const frames = [metricFrame(), problemsFrame([ICMP], 'A'), problemsFrame([SLA], 'B')];

    expect(extractProblems(frames)).toEqual([ICMP, SLA]);
  });

  it('devolve lista vazia quando nao ha query de Problems', () => {
    expect(extractProblems([metricFrame()])).toEqual([]);
    expect(extractProblems([])).toEqual([]);
  });

  it('descarta valores que nao sao objeto', () => {
    // `FieldType.other` nao garante nada sobre o conteudo.
    expect(extractProblems([problemsFrame([null, undefined, 'lixo', 42, ICMP])])).toEqual([ICMP]);
  });
});

describe('problemSeverity', () => {
  it('le a escala 0..5 do Zabbix', () => {
    expect(problemSeverity({ severity: '0' })).toBe(0);
    expect(problemSeverity(ICMP)).toBe(4);
    expect(problemSeverity({ severity: '5' })).toBe(5);
  });

  it('cai para 0 quando a severidade esta ausente ou fora da escala', () => {
    expect(problemSeverity({})).toBe(0);
    expect(problemSeverity({ severity: 'alta' })).toBe(0);
    expect(problemSeverity({ severity: '9' })).toBe(0);
    expect(problemSeverity({ severity: '-1' })).toBe(0);
  });
});

describe('SEVERITY_COLOR', () => {
  /**
   * Regressao da causa do "tudo nasce branco": `'text'` e um nome de cor valido
   * do Grafana que resolve para `text.primary`. Severidade 0 nao pode virar
   * nome nenhum — quem tem o tema resolve para `text.secondary`.
   */
  it('nao mapeia severidade 0 para um nome de cor', () => {
    expect(SEVERITY_COLOR[0]).toBeUndefined();
  });

  it('mapeia 1..5 para nomes de cor, nunca hex', () => {
    for (const severity of [1, 2, 3, 4, 5] as const) {
      expect(SEVERITY_COLOR[severity]).toEqual(expect.any(String));
      expect(SEVERITY_COLOR[severity]).not.toMatch(/^#/);
    }
  });
});

describe('isActiveProblem', () => {
  it('PROBLEM e ativo, OK nao', () => {
    expect(isActiveProblem({ value: '1' })).toBe(true);
    expect(isActiveProblem({ value: '0' })).toBe(false);
  });

  it('sem `value`, conta como ativo', () => {
    // Preferir o falso positivo ao falso negativo: um problema mudo que passa
    // por saudavel e o pior desfecho numa topologia de NOC.
    expect(isActiveProblem({})).toBe(true);
  });
});

describe('matchesHost', () => {
  it('casa pelo nome de exibicao e pelo nome tecnico', () => {
    expect(matchesHost(ICMP, 'AGLIN-FW-STARTI')).toBe(true);
    expect(matchesHost(ICMP, 'AGLIN-FW-STARTI-aglin.stsec.com.br')).toBe(true);
  });

  it('ignora caixa e espaco em volta', () => {
    expect(matchesHost(ICMP, '  aglin-fw-starti  ')).toBe(true);
  });

  /** Se fosse `contains`, o `-01` acenderia com o problema do `-011`. */
  it('e exato: prefixo nao casa', () => {
    expect(matchesHost(SLA, 'MMV-FW-STARTI')).toBe(false);
    expect(matchesHost(SLA, 'MMV-FW-STARTI-011')).toBe(false);
  });

  it('host vazio nao casa com nada', () => {
    expect(matchesHost(ICMP, '')).toBe(false);
    expect(matchesHost(ICMP, '   ')).toBe(false);
  });

  it('problema sem `hosts[]` nao casa e nao explode', () => {
    expect(matchesHost({ name: 'orfao' }, 'AGLIN-FW-STARTI')).toBe(false);
    expect(matchesHost({ hosts: [] }, 'AGLIN-FW-STARTI')).toBe(false);
    expect(matchesHost({ hosts: [undefined, {}] }, 'AGLIN-FW-STARTI')).toBe(false);
  });
});

describe('matchesName', () => {
  it('casa a descricao da trigger ignorando caixa e espaco', () => {
    expect(matchesName(ICMP, 'unavailable by icmp ping')).toBe(true);
    expect(matchesName(ICMP, ' Unavailable by ICMP ping ')).toBe(true);
  });

  it('nome parcial ou ausente nao casa', () => {
    expect(matchesName(ICMP, 'Unavailable')).toBe(false);
    expect(matchesName({}, 'Unavailable by ICMP ping')).toBe(false);
    expect(matchesName(ICMP, '')).toBe(false);
  });
});

describe('listHosts', () => {
  it('lista nomes unicos em ordem alfabetica', () => {
    const frames = [problemsFrame([SLA, ICMP, { ...ICMP, name: 'outra trigger' }])];

    expect(listHosts(frames)).toEqual(['AGLIN-FW-STARTI', 'MMV-FW-STARTI-01']);
  });

  it('ignora problema sem `hosts[]` ou com host sem nome', () => {
    const frames = [problemsFrame([{ name: 'orfao' }, { hosts: [{ host: 'so-tecnico' }] }, ICMP])];

    expect(listHosts(frames)).toEqual(['AGLIN-FW-STARTI']);
  });

  it('devolve vazio quando nao ha query de Problems', () => {
    expect(listHosts([metricFrame()])).toEqual([]);
  });
});

describe('listTriggers', () => {
  const frames = [problemsFrame([ICMP, SLA, { ...ICMP, name: 'Zabbix agent is not available' }])];

  it('sem host, lista todas as triggers em ordem', () => {
    expect(listTriggers(frames)).toEqual([
      'SLA do mes corrente abaixo do SLO (98.5%)',
      'Unavailable by ICMP ping',
      'Zabbix agent is not available',
    ]);
  });

  it('com host, lista so as triggers daquele host', () => {
    expect(listTriggers(frames, 'AGLIN-FW-STARTI')).toEqual([
      'Unavailable by ICMP ping',
      'Zabbix agent is not available',
    ]);
  });

  it('host sem correspondencia devolve vazio', () => {
    expect(listTriggers(frames, 'host-que-nao-existe')).toEqual([]);
  });
});
