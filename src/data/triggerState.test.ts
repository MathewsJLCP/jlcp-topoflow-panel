import { DataFrame, Field, FieldType, createTheme, toDataFrame } from '@grafana/data';

import { TriggerBinding } from '../model/types';
import { ZabbixProblem } from './problems';
import { resolveTriggerState, severityColor } from './triggerState';

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
  ...overrides,
});

describe('severityColor', () => {
  it('resolve 1..5 por nome de cor do tema', () => {
    expect(severityColor(4, theme)).toBe(theme.visualization.getColorByName('red'));
    expect(severityColor(5, theme)).toBe(theme.visualization.getColorByName('dark-red'));
  });

  /** Regressao: `'text'` resolveria para `text.primary`, quase branco no dark. */
  it('severidade 0 usa `text.secondary`, nao um nome de cor', () => {
    expect(severityColor(0, theme)).toBe(theme.colors.text.secondary);
    expect(severityColor(0, theme)).not.toBe(theme.visualization.getColorByName('text'));
  });
});

describe('resolveTriggerState — trigger alarmando', () => {
  it('acende com a cor e o rotulo da severidade', () => {
    expect(resolveTriggerState(binding(), [problemsFrame([ICMP])], theme)).toEqual({
      color: theme.visualization.getColorByName('red'),
      severity: 4,
      label: 'High',
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
    expect(resolveTriggerState(binding(), [problemsFrame(problems)], theme)).toEqual({
      color: theme.visualization.getColorByName('dark-red'),
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

describe('resolveTriggerState — filtro por nome de trigger', () => {
  const problems: ZabbixProblem[] = [
    ICMP,
    { hosts: [{ name: HOST }], name: 'Zabbix agent is not available', severity: '5', value: '1' },
  ];

  it('restringe a trigger escolhida', () => {
    const so = binding({ name: 'Unavailable by ICMP ping' });

    expect(resolveTriggerState(so, [problemsFrame(problems)], theme)?.severity).toBe(4);
  });

  it('nome vazio ou so espaco significa qualquer trigger do host', () => {
    expect(resolveTriggerState(binding({ name: '' }), [problemsFrame(problems)], theme)?.severity).toBe(5);
    expect(resolveTriggerState(binding({ name: '   ' }), [problemsFrame(problems)], theme)?.severity).toBe(5);
  });

  it('nome sem correspondencia nao acende', () => {
    const nenhuma = binding({ name: 'trigger que nao existe' });

    expect(resolveTriggerState(nenhuma, [problemsFrame(problems)], theme)).toBeUndefined();
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
