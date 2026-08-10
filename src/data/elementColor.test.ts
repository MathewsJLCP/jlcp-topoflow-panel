import {
  DataFrame,
  Field,
  FieldType,
  Threshold,
  ThresholdsMode,
  cacheFieldDisplayNames,
  createTheme,
  getDisplayProcessor,
  toDataFrame,
} from '@grafana/data';

import { TriggerBinding } from '../model/types';
import { accentColor, resolveElementColor } from './elementColor';
import { ZabbixProblem } from './problems';

const theme = createTheme();

/** Só o step base — o que o Grafana injeta quando ninguém configurou regra. */
const BASE_ONLY: Threshold[] = [{ value: -Infinity, color: 'green' }];

const WITH_RULE: Threshold[] = [
  { value: -Infinity, color: 'green' },
  { value: 85, color: 'red', state: 'crítico' },
];

function buildFrames(
  name: string,
  values: unknown[],
  steps: Threshold[] = WITH_RULE,
  mode = ThresholdsMode.Absolute
): DataFrame[] {
  const frame = toDataFrame({
    fields: [
      {
        name,
        type: FieldType.number,
        values,
        config: { unit: 'percent', thresholds: { mode, steps } },
      },
    ],
  });

  for (const field of frame.fields) {
    field.display = getDisplayProcessor({ field, theme });
  }

  cacheFieldDisplayNames([frame]);
  return [frame];
}

describe('resolveElementColor — nível 1 (threshold)', () => {
  it('threshold vence o acento estático', () => {
    const frames = buildFrames('cpu', [92]);

    expect(resolveElementColor({ fixed: 'blue', field: 'cpu' }, frames, theme)).toEqual({
      state: 'threshold',
      color: theme.visualization.getColorByName('red'),
      label: 'crítico',
    });
  });

  it('sem `state` no step, o badge fica sem rótulo', () => {
    const frames = buildFrames('cpu', [92], [
      { value: -Infinity, color: 'green' },
      { value: 85, color: 'red' },
    ]);

    expect(resolveElementColor({ field: 'cpu' }, frames, theme)).toEqual({
      state: 'threshold',
      color: theme.visualization.getColorByName('red'),
      label: undefined,
    });
  });

  it('no modo percentual a cor resolve, mas o rótulo não', () => {
    const frames = buildFrames('cpu', [92], WITH_RULE, ThresholdsMode.Percentage);
    const result = resolveElementColor({ field: 'cpu' }, frames, theme);

    expect(result.state).toBe('threshold');
    expect(result).not.toHaveProperty('label', 'crítico');
  });
});

/**
 * O ponto da decisão (b): sem step customizado o Grafana devolveria a cor do
 * step base — verde. Verde por omissão é mentira operacional num NOC, então a
 * cadeia ignora o threshold e segue para os níveis 2 e 3.
 */
describe('resolveElementColor — binding sem regra de threshold', () => {
  it('cai para o acento estático quando só existe o step base', () => {
    const frames = buildFrames('cpu', [92], BASE_ONLY);

    expect(resolveElementColor({ fixed: 'blue', field: 'cpu' }, frames, theme)).toEqual({
      state: 'fixed',
      color: theme.visualization.getColorByName('blue'),
    });
  });

  it('cai para neutro quando não há acento nenhum', () => {
    const frames = buildFrames('cpu', [92], BASE_ONLY);

    expect(resolveElementColor({ field: 'cpu' }, frames, theme)).toEqual({ state: 'neutral' });
  });
});

/**
 * Sem dado tem que ser visualmente distinto de saudável: não cai para `fixed`
 * nem para verde. Um painel mudo não pode passar por painel saudável.
 */
describe('resolveElementColor — nodata (A.4)', () => {
  it('field ausente das séries não cai para o acento estático', () => {
    const frames = buildFrames('cpu', [92]);

    expect(resolveElementColor({ fixed: 'blue', field: 'nao-existe' }, frames, theme)).toEqual({
      state: 'nodata',
    });
  });

  it('field presente com último valor nulo também é nodata', () => {
    const frames = buildFrames('cpu', [null]);

    expect(resolveElementColor({ fixed: 'blue', field: 'cpu' }, frames, theme)).toEqual({
      state: 'nodata',
    });
  });
});

describe('resolveElementColor — níveis 2 e 3', () => {
  it('sem binding, usa o acento estático', () => {
    expect(resolveElementColor({ fixed: 'blue' }, [], theme)).toEqual({
      state: 'fixed',
      color: theme.visualization.getColorByName('blue'),
    });
  });

  /**
   * Regressão do bug que motivou o Bloco 1: o fallback antigo era
   * `getColorByName('text')`, que resolve para `text.primary` — quase branco no
   * dark. Elemento sem cor não devolve cor nenhuma.
   */
  it('sem binding e sem acento, é neutro — nunca branco', () => {
    const result = resolveElementColor({}, [], theme);

    expect(result).toEqual({ state: 'neutral' });
    expect(result).not.toHaveProperty('color');
  });
});

const HOST = 'AGLIN-FW-STARTI';

function problemsFrame(values: ZabbixProblem[]): DataFrame {
  const field: Field = {
    name: 'Problems',
    type: FieldType.other,
    values,
    config: { custom: { type: 'problems' } },
  };

  return { name: 'problems', refId: 'B', length: values.length, fields: [field] };
}

const ALARMANDO: ZabbixProblem = { hosts: [{ name: HOST }], name: 'ICMP', severity: '4', value: '1' };
const RESOLVIDA: ZabbixProblem = { ...ALARMANDO, value: '0' };

const trigger: TriggerBinding = { enabled: true, host: HOST };

/**
 * Nível 0. O ponto sensível não é a trigger acender — é o que acontece quando
 * ela **não** acende: o nível 1 continua desligado. Duas fontes de estado
 * simultâneas dariam um elemento vermelho por CPU e verde por trigger, sem o
 * operador saber qual está lendo.
 */
describe('resolveElementColor — nível 0 (trigger)', () => {
  it('trigger alarmando vence threshold e acento estático', () => {
    const frames = [...buildFrames('cpu', [92]), problemsFrame([ALARMANDO])];

    expect(resolveElementColor({ fixed: 'blue', field: 'cpu' }, frames, theme, { trigger })).toEqual({
      state: 'trigger',
      color: theme.visualization.getColorByName('red'),
      severity: 4,
      label: 'High',
    });
  });

  it('com vínculo ligado e trigger ok, a métrica não volta a pintar', () => {
    // `cpu: 92` cruzaria o step `crítico` se o nível 1 estivesse ativo.
    const frames = [...buildFrames('cpu', [92]), problemsFrame([RESOLVIDA])];

    expect(resolveElementColor({ fixed: 'blue', field: 'cpu' }, frames, theme, { trigger })).toEqual({
      state: 'fixed',
      color: theme.visualization.getColorByName('blue'),
    });
  });

  it('trigger ok e sem acento estático é neutro, nunca `nodata`', () => {
    // `nodata` significa "binding sem dado que sirva". Trigger saudável tem
    // dado — o dado é justamente que está tudo bem.
    const frames = [problemsFrame([])];

    expect(resolveElementColor({}, frames, theme, { trigger })).toEqual({ state: 'neutral' });
  });

  it('vínculo desligado devolve a cadeia inteira à métrica', () => {
    const frames = [...buildFrames('cpu', [92]), problemsFrame([ALARMANDO])];
    const desligado: TriggerBinding = { ...trigger, enabled: false };

    expect(resolveElementColor({ field: 'cpu' }, frames, theme, { trigger: desligado })).toEqual({
      state: 'threshold',
      color: theme.visualization.getColorByName('red'),
      label: 'crítico',
    });
  });

  /** Regressão do critério 4: elemento salvo antes da feature não passa nada. */
  it('sem o quarto argumento, o comportamento é o de antes', () => {
    const frames = [...buildFrames('cpu', [92]), problemsFrame([ALARMANDO])];

    expect(resolveElementColor({ field: 'cpu' }, frames, theme)).toEqual({
      state: 'threshold',
      color: theme.visualization.getColorByName('red'),
      label: 'crítico',
    });
  });
});

/**
 * O helper que os quatro consumidores usam. Sua razao de existir e impedir que
 * um elemento reconheca um estado que outro ignora — entao o teste que importa
 * e o de cobertura: todo estado do union tem resposta definida aqui.
 */
describe('accentColor', () => {
  it('devolve a cor dos estados que carregam uma', () => {
    expect(accentColor({ state: 'trigger', color: '#f00', severity: 4, label: 'High' })).toBe('#f00');
    expect(accentColor({ state: 'threshold', color: '#f00' })).toBe('#f00');
    expect(accentColor({ state: 'fixed', color: '#00f' })).toBe('#00f');
  });

  /** Cada elemento decide seu proprio fallback — o point não cai onde o texto cai. */
  it('devolve undefined nos estados sem cor própria', () => {
    expect(accentColor({ state: 'nodata' })).toBeUndefined();
    expect(accentColor({ state: 'neutral' })).toBeUndefined();
  });
});

/**
 * Nível 1a. A regra do elemento e o pipeline nativo **coexistem** (decisão D8),
 * mas nunca no mesmo elemento: quem define regra própria não consulta mais o
 * field. Misturar os dois daria uma cor cuja origem exige abrir o painel de
 * opções do field para descobrir.
 */
describe('resolveElementColor — nível 1a (threshold do elemento)', () => {
  const REGRAS = { steps: [{ type: 'threshold' as const, value: 70, color: 'orange', label: 'atenção' }] };

  it('a regra do elemento vence a do field', () => {
    // O field diz `red`/`crítico` em 92; a regra do elemento diz `orange`.
    const frames = buildFrames('cpu', [92]);

    expect(resolveElementColor({ field: 'cpu' }, frames, theme, { thresholds: REGRAS })).toEqual({
      state: 'threshold',
      color: theme.visualization.getColorByName('orange'),
      label: 'atenção',
    });
  });

  it('sem regra própria, o field continua mandando', () => {
    const frames = buildFrames('cpu', [92]);

    expect(resolveElementColor({ field: 'cpu' }, frames, theme, { thresholds: { steps: [] } })).toEqual({
      state: 'threshold',
      color: theme.visualization.getColorByName('red'),
      label: 'crítico',
    });
  });

  /**
   * O caso que a exclusão entre 1a e 1b existe para resolver: com regra própria
   * e valor abaixo dela, o elemento está OK — não pode cair no `crítico` do
   * field, que dispararia em 85.
   */
  it('abaixo da regra própria, o elemento fica em repouso — não volta ao field', () => {
    const frames = buildFrames('cpu', [92]);
    const acimaDoField = { steps: [{ type: 'threshold' as const, value: 95, color: 'red' }] };

    expect(resolveElementColor({ fixed: 'blue', field: 'cpu' }, frames, theme, { thresholds: acimaDoField })).toEqual({
      state: 'fixed',
      color: theme.visualization.getColorByName('blue'),
    });
  });

  it('step sem rótulo deixa o badge livre para a métrica', () => {
    const frames = buildFrames('cpu', [92]);
    const semRotulo = { steps: [{ type: 'threshold' as const, value: 70, color: 'orange' }] };

    expect(resolveElementColor({ field: 'cpu' }, frames, theme, { thresholds: semRotulo })).toEqual({
      state: 'threshold',
      color: theme.visualization.getColorByName('orange'),
      label: undefined,
    });
  });

  it('regra própria não salva um field sem dado', () => {
    const frames = buildFrames('cpu', [92]);

    expect(resolveElementColor({ field: 'nao-existe' }, frames, theme, { thresholds: REGRAS })).toEqual({
      state: 'nodata',
    });
  });

  /** A trigger continua sendo o nível 0: regra própria não a destrona. */
  it('a trigger alarmando vence a regra do elemento', () => {
    const frames = [...buildFrames('cpu', [92]), problemsFrame([ALARMANDO])];

    expect(resolveElementColor({ field: 'cpu' }, frames, theme, { trigger, thresholds: REGRAS })).toEqual({
      state: 'trigger',
      color: theme.visualization.getColorByName('red'),
      severity: 4,
      label: 'High',
    });
  });
});
