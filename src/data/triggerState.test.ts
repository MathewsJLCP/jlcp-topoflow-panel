import { DataFrame, Field, FieldType, createTheme, toDataFrame } from '@grafana/data';

import { TriggerBinding } from '../model/types';
import { ZabbixProblem } from './problems';
import { UNNAMED_TRIGGER, resolveTriggerState, severityColor } from './triggerState';
import { resolveTfColor } from '../theme/palette';
import { severityTfColor } from '../theme/severity';

const theme = createTheme();

function problemsFrame(values: ZabbixProblem[], refId = 'A'): DataFrame {
  const field: Field = {
    name: 'Problems',
    type: FieldType.other,
    values,
    config: { custom: { type: 'problems' } },
  };

  return { name: 'problems', refId, length: values.length, fields: [field] };
}

const HOST = 'AGLIN-FW-STARTI';

/** Trigger em PROBLEM, severidade High — a linha real da FABRAWEB. */
const ICMP: ZabbixProblem = {
  hosts: [{ name: HOST, host: 'AGLIN-FW-STARTI-aglin.stsec.com.br' }],
  name: 'Unavailable by ICMP ping',
  severity: '4',
  value: '1',
};

const binding = (overrides: Partial<TriggerBinding> = {}): TriggerBinding => ({
  enabled: true,
  host: HOST,
  names: [],
  showActive: true,
  ...overrides,
});

describe('severityColor', () => {
  it('segue a paleta do mockup: Disaster e High no vermelho', () => {
    expect(severityColor(5, theme)).toBe(severityTfColor(5, theme));
    expect(severityColor(4, theme)).toBe(severityTfColor(4, theme));
    expect(severityColor(3, theme)).toBe(resolveTfColor('orange', theme));
    expect(severityColor(1, theme)).toBe(resolveTfColor('blue', theme));
  });

  /** Not classified e o cinza apagado, nunca o branco de `text`. */
  it('severidade 0 usa o cinza da paleta', () => {
    expect(severityColor(0, theme)).toBe(resolveTfColor('gray', theme));
  });
});

describe('resolveTriggerState — trigger alarmando', () => {
  it('acende com a cor e o rotulo da severidade', () => {
    expect(resolveTriggerState(binding(), [problemsFrame([ICMP])], theme)).toEqual({
      color: resolveTfColor('red', theme),
      severity: 4,
      label: 'High',
      problems: [
        {
          name: 'Unavailable by ICMP ping',
          severity: 4,
          label: 'High',
          color: resolveTfColor('red', theme),
          since: undefined,
        },
      ],
    });
  });

  it('casa tambem pelo nome tecnico do host', () => {
    const byTechName = binding({ host: 'AGLIN-FW-STARTI-aglin.stsec.com.br' });

    expect(resolveTriggerState(byTechName, [problemsFrame([ICMP])], theme)?.severity).toBe(4);
  });

  it('encontra o problema entre frames de metrica e outras queries de Problems', () => {
    const metric = toDataFrame({ fields: [{ name: 'cpu', type: FieldType.number, values: [92] }] });
    const outro: ZabbixProblem = { hosts: [{ name: 'OUTRO-HOST' }], name: 'x', severity: '5', value: '1' };
    const frames = [metric, problemsFrame([outro], 'A'), problemsFrame([ICMP], 'B')];

    expect(resolveTriggerState(binding(), frames, theme)?.severity).toBe(4);
  });
});

/**
 * Decisao D4: a cor e do problema mais grave. Um elemento que agrega varias
 * triggers nao pode reportar a menor delas — seria esconder o pior caso.
 */
describe('resolveTriggerState — multiplas triggers ativas', () => {
  const problems: ZabbixProblem[] = [
    { hosts: [{ name: HOST }], name: 'Warning qualquer', severity: '2', value: '1' },
    { hosts: [{ name: HOST }], name: 'Disaster', severity: '5', value: '1' },
    { hosts: [{ name: HOST }], name: 'Average', severity: '3', value: '1' },
  ];

  it('usa a severidade maxima, independente da ordem no frame', () => {
    const accent = resolveTriggerState(binding(), [problemsFrame(problems)], theme);

    expect(accent).toMatchObject({
      color: resolveTfColor('dark-red', theme),
      severity: 5,
      label: 'Disaster',
    });
  });

  it('a mais grave nao conta se ja estiver resolvida', () => {
    // Warning(2) e Average(3) ativas; a Disaster(5) ja voltou ao normal.
    const comResolvida: ZabbixProblem[] = [
      { hosts: [{ name: HOST }], name: 'Warning qualquer', severity: '2', value: '1' },
      { hosts: [{ name: HOST }], name: 'Average', severity: '3', value: '1' },
      { hosts: [{ name: HOST }], name: 'Disaster', severity: '5', value: '0' },
    ];

    expect(resolveTriggerState(binding(), [problemsFrame(comResolvida)], theme)?.severity).toBe(3);
  });
});

/**
 * A lista e a resposta a "qual trigger caiu?". Ate aqui o dado existia no frame
 * e morria dentro do `maxSeverity`: o elemento sabia dizer o quao ruim estava,
 * nunca o que estava ruim.
 */
describe('resolveTriggerState — lista de problemas ativos', () => {
  const problems: ZabbixProblem[] = [
    { hosts: [{ name: HOST }], name: 'Warning qualquer', severity: '2', value: '1' },
    { hosts: [{ name: HOST }], name: 'Disaster', severity: '5', value: '1' },
    { hosts: [{ name: HOST }], name: 'Average', severity: '3', value: '1' },
  ];

  it('traz todas as triggers em PROBLEM, da mais grave para a mais branda', () => {
    const accent = resolveTriggerState(binding(), [problemsFrame(problems)], theme);

    expect(accent?.problems.map((problem) => [problem.name, problem.severity])).toEqual([
      ['Disaster', 5],
      ['Average', 3],
      ['Warning qualquer', 2],
    ]);
  });

  /**
   * Desempate estatico de proposito: por horario, a lista se reorganizaria a
   * cada refresh do painel, debaixo do olho de quem esta lendo.
   */
  it('empate de severidade desempata pelo nome', () => {
    const empate: ZabbixProblem[] = [
      { hosts: [{ name: HOST }], name: 'Memory usage', severity: '4', value: '1' },
      { hosts: [{ name: HOST }], name: 'CPU load', severity: '4', value: '1' },
    ];

    const accent = resolveTriggerState(binding(), [problemsFrame(empate)], theme);

    expect(accent?.problems.map((problem) => problem.name)).toEqual(['CPU load', 'Memory usage']);
  });

  it('cada linha ja vem com a cor e o nome da severidade resolvidos', () => {
    const accent = resolveTriggerState(binding(), [problemsFrame([ICMP])], theme);

    expect(accent?.problems[0]).toMatchObject({
      label: 'High',
      color: resolveTfColor('red', theme),
    });
  });

  /** Um problema sem descricao continua sendo um problema — nao pode sair em branco. */
  it('trigger sem descrição ganha um nome legível', () => {
    const anonima: ZabbixProblem = { hosts: [{ name: HOST }], name: '  ', severity: '4', value: '1' };

    expect(resolveTriggerState(binding(), [problemsFrame([anonima])], theme)?.problems[0].name).toBe(UNNAMED_TRIGGER);
  });

  it('o `timestamp` do frame vira o instante de abertura, quando existe', () => {
    const comTempo: ZabbixProblem = { ...ICMP, timestamp: 1_700_000_000 };

    const accent = resolveTriggerState(binding(), [problemsFrame([comTempo, ICMP])], theme);

    expect(accent?.problems.map((problem) => problem.since)).toEqual([1_700_000_000, undefined]);
  });

  /**
   * A lista e o mesmo conjunto que decide a cor: o que o filtro de nome ou o
   * `value: '0'` tira do calculo tem de sair tambem da tela, senao o painel
   * mostraria uma trigger que nao esta pintando nada.
   */
  it('respeita os mesmos filtros que decidem a cor', () => {
    const comResolvida: ZabbixProblem[] = [
      ...problems,
      { hosts: [{ name: HOST }], name: 'Ja normalizou', severity: '5', value: '0' },
      { hosts: [{ name: 'OUTRO-HOST' }], name: 'De outro host', severity: '5', value: '1' },
    ];

    const todas = resolveTriggerState(binding(), [problemsFrame(comResolvida)], theme);
    expect(todas?.problems).toHaveLength(3);

    const so = resolveTriggerState(binding({ names: ['Average'] }), [problemsFrame(comResolvida)], theme);
    expect(so?.problems.map((problem) => problem.name)).toEqual(['Average']);
  });
});

describe('resolveTriggerState — filtro por nome de trigger', () => {
  const problems: ZabbixProblem[] = [
    ICMP,
    { hosts: [{ name: HOST }], name: 'Zabbix agent is not available', severity: '5', value: '1' },
  ];

  it('restringe a trigger escolhida', () => {
    const so = binding({ names: ['Unavailable by ICMP ping'] });

    expect(resolveTriggerState(so, [problemsFrame(problems)], theme)?.severity).toBe(4);
  });

  it('lista vazia, ou so com branco, significa qualquer trigger do host', () => {
    expect(resolveTriggerState(binding({ names: [] }), [problemsFrame(problems)], theme)?.severity).toBe(5);
    expect(resolveTriggerState(binding({ names: [''] }), [problemsFrame(problems)], theme)?.severity).toBe(5);
    expect(resolveTriggerState(binding({ names: ['   '] }), [problemsFrame(problems)], theme)?.severity).toBe(5);
  });

  it('nome sem correspondencia nao acende', () => {
    const nenhuma = binding({ names: ['trigger que nao existe'] });

    expect(resolveTriggerState(nenhuma, [problemsFrame(problems)], theme)).toBeUndefined();
  });
});

/**
 * Varias triggers no mesmo vinculo. A relacao e **OU**: o elemento acende com
 * qualquer uma delas, e a severidade que pinta e a maior entre as que estao
 * alarmando naquele instante.
 */
describe('resolveTriggerState — mais de uma trigger no vinculo', () => {
  const problems: ZabbixProblem[] = [
    ICMP,
    { hosts: [{ name: HOST }], name: 'Zabbix agent is not available', severity: '5', value: '1' },
    { hosts: [{ name: HOST }], name: 'Fora da lista', severity: '5', value: '1' },
  ];
  const frames = [problemsFrame(problems)];

  it('acende com qualquer uma das escolhidas', () => {
    const so = binding({ names: ['Unavailable by ICMP ping', 'trigger que nao existe'] });

    expect(resolveTriggerState(so, frames, theme)?.severity).toBe(4);
  });

  it('a severidade e a maior entre as escolhidas que estao alarmando', () => {
    const duas = binding({ names: ['Unavailable by ICMP ping', 'Zabbix agent is not available'] });

    expect(resolveTriggerState(duas, frames, theme)?.severity).toBe(5);
  });

  it('lista todas as escolhidas em PROBLEM, e nenhuma de fora da lista', () => {
    const duas = binding({ names: ['Unavailable by ICMP ping', 'Zabbix agent is not available'] });

    expect(resolveTriggerState(duas, frames, theme)?.problems.map((problem) => problem.name)).toEqual([
      'Zabbix agent is not available',
      'Unavailable by ICMP ping',
    ]);
  });

  /** Rascunho do editor: a linha em branco nao pode alargar o vinculo. */
  it('linha em branco no meio da lista e ignorada, e nao abrange o host', () => {
    const comBranco = binding({ names: ['Unavailable by ICMP ping', '  '] });

    expect(resolveTriggerState(comBranco, frames, theme)?.problems).toHaveLength(1);
  });

  it('nenhuma das escolhidas alarmando deixa o elemento sem estado', () => {
    const nenhuma = binding({ names: ['nao existe', 'tambem nao'] });

    expect(resolveTriggerState(nenhuma, frames, theme)).toBeUndefined();
  });
});

/**
 * As quatro portas para `undefined`. Todas levam o elemento a seguir a cadeia
 * de cor normal e mostrar sua identidade — nunca a inventar um estado.
 */
describe('resolveTriggerState — sem alarme', () => {
  it('vinculo desligado nao le os frames', () => {
    const desligado = binding({ enabled: false });

    expect(resolveTriggerState(desligado, [problemsFrame([ICMP])], theme)).toBeUndefined();
  });

  it('sem vinculo nenhum', () => {
    expect(resolveTriggerState(undefined, [problemsFrame([ICMP])], theme)).toBeUndefined();
  });

  it('painel sem query de Problems', () => {
    const metric = toDataFrame({ fields: [{ name: 'cpu', type: FieldType.number, values: [92] }] });

    expect(resolveTriggerState(binding(), [metric], theme)).toBeUndefined();
    expect(resolveTriggerState(binding(), [], theme)).toBeUndefined();
  });

  it('host sem correspondencia nos frames', () => {
    const outro = binding({ host: 'HOST-QUE-NAO-EXISTE' });

    expect(resolveTriggerState(outro, [problemsFrame([ICMP])], theme)).toBeUndefined();
  });

  it('host vazio — vinculo aberto no editor e ainda nao configurado', () => {
    expect(resolveTriggerState(binding({ host: '' }), [problemsFrame([ICMP])], theme)).toBeUndefined();
  });

  /** Criterio de aceite 3: trigger resolvida volta ao estado ok. */
  it('trigger resolvida (`value === "0"`) nao acende', () => {
    const resolvida = { ...ICMP, value: '0' };

    expect(resolveTriggerState(binding(), [problemsFrame([resolvida])], theme)).toBeUndefined();
  });

  it('frame de Problems vazio — o host esta saudavel', () => {
    expect(resolveTriggerState(binding(), [problemsFrame([])], theme)).toBeUndefined();
  });
});
