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

import { ElementThresholds, TriggerBinding } from '../model/types';
import { accentColor, resolveElementColor } from './elementColor';
import { writeSeverityLadder } from './thresholds';
import { ZabbixProblem } from './problems';

const theme = createTheme();

/** Só o step base — o que o Grafana injeta quando ninguém configurou regra. */
const BASE_ONLY: Threshold[] = [{ value: -Infinity, color: 'green' }];

/** Regra própria equivalente ao `WITH_RULE` do field, para os testes de vínculo. */
const REGRA_METRICA = { steps: [{ type: 'threshold' as const, value: 85, color: 'red', label: 'crítico' }] };

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

describe('resolveElementColor — nível 1 (threshold do elemento)', () => {
  /** A regra que o usuário escreve no bloco do elemento — a única que pinta. */
  const CRITICO = { steps: [{ type: 'threshold' as const, value: 85, color: 'red', label: 'crítico' }] };

  it('threshold vence o acento estático', () => {
    const frames = buildFrames('cpu', [92]);

    expect(resolveElementColor({ fixed: 'blue', field: 'cpu' }, frames, theme, { thresholds: CRITICO })).toEqual({
      state: 'threshold',
      color: theme.visualization.getColorByName('red'),
      label: 'crítico',
      animation: undefined,
    });
  });

  it('sem rótulo na regra, o badge fica livre para a métrica', () => {
    const frames = buildFrames('cpu', [92]);
    const semRotulo = { steps: [{ type: 'threshold' as const, value: 85, color: 'red' }] };

    expect(resolveElementColor({ field: 'cpu' }, frames, theme, { thresholds: semRotulo })).toEqual({
      state: 'threshold',
      color: theme.visualization.getColorByName('red'),
      label: undefined,
      animation: undefined,
    });
  });
});

/**
 * O nível que saiu da cadeia em 2026-09-02.
 *
 * Enquanto existia, o bloco de Thresholds do elemento perdia para uma
 * configuração de **outra tela**: sem regra própria, a cor vinha do step do
 * field, e a Base escolhida no elemento nunca era alcançada. O sintoma que
 * levou à decisão foi exatamente este — Base laranja no elemento, azul do step
 * base do field na topologia.
 */
describe('resolveElementColor — o pipeline nativo não pinta elemento', () => {
  it('sem regra própria, o step do field é ignorado e vale a Base', () => {
    // O field diz `red`/`crítico` em 92 e o elemento não tem regra nenhuma.
    const frames = buildFrames('cpu', [92]);

    expect(
      resolveElementColor({ fixed: 'orange', field: 'cpu' }, frames, theme, { thresholds: { steps: [] } })
    ).toEqual({
      state: 'fixed',
      color: theme.visualization.getColorByName('orange'),
    });
  });

  it('sem regra própria e sem Base, o elemento fica neutro', () => {
    const frames = buildFrames('cpu', [92]);

    expect(resolveElementColor({ field: 'cpu' }, frames, theme)).toEqual({ state: 'neutral' });
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

const trigger: TriggerBinding = { enabled: true, host: HOST, names: [], showActive: true };

/**
 * Nível 0. O ponto sensível não é a trigger acender — é o que acontece quando
 * ela **não** acende: o nível 1 continua desligado. Duas fontes de estado
 * simultâneas dariam um elemento vermelho por CPU e verde por trigger, sem o
 * operador saber qual está lendo.
 */
describe('resolveElementColor — nível 0 (trigger)', () => {
  it('trigger alarmando vence threshold e acento estático', () => {
    const frames = [...buildFrames('cpu', [92]), problemsFrame([ALARMANDO])];

    expect(resolveElementColor({ fixed: 'blue', field: 'cpu' }, frames, theme, { trigger })).toMatchObject({
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

    expect(
      resolveElementColor({ field: 'cpu' }, frames, theme, { trigger: desligado, thresholds: REGRA_METRICA })
    ).toEqual({
      state: 'threshold',
      color: theme.visualization.getColorByName('red'),
      label: 'crítico',
      animation: undefined,
    });
  });

  /**
   * Regressão do critério 4: elemento salvo antes da feature não passa nada.
   * Sem fontes de estado não há regra própria, então ele repousa na Base — o
   * alarme no frame de problemas não pode pintá-lo por conta própria.
   */
  it('sem o quarto argumento, nenhuma fonte de estado é consultada', () => {
    const frames = [...buildFrames('cpu', [92]), problemsFrame([ALARMANDO])];

    expect(resolveElementColor({ fixed: 'blue', field: 'cpu' }, frames, theme)).toEqual({
      state: 'fixed',
      color: theme.visualization.getColorByName('blue'),
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
    const problems = [{ name: 'Unavailable by ICMP ping', severity: 4 as const, label: 'High', color: '#f00' }];

    expect(accentColor({ state: 'trigger', color: '#f00', severity: 4, label: 'High', problems })).toBe('#f00');
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
 * Nível 1. A regra do elemento é a autoridade sobre a cor dele: o pipeline
 * nativo do Grafana não concorre mais (ver o describe acima), e abaixo de todas
 * as regras o elemento repousa na Base em vez de consultar o field.
 */
describe('resolveElementColor — nível 1 (regra do elemento)', () => {
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

  /**
   * Com regra própria e valor abaixo dela, o elemento está OK — não pode cair
   * no `crítico` do field, que dispararia em 85.
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

    expect(resolveElementColor({ field: 'cpu' }, frames, theme, { trigger, thresholds: REGRAS })).toMatchObject({
      state: 'trigger',
      color: theme.visualization.getColorByName('red'),
      severity: 4,
      label: 'High',
    });
  });
});

/**
 * Bloco A: uma regra de severidade sobrescreve o mapa de cores do Zabbix, pela
 * mesma lógica que tirou o pipeline nativo da cadeia — quem escreveu regra para
 * aquele elemento manda nele.
 */
describe('resolveElementColor — regra própria de severidade', () => {
  const frames = [problemsFrame([ALARMANDO])];
  const severidade = (atLeast: 0 | 1 | 2 | 3 | 4 | 5, color: string) => ({
    steps: [{ type: 'severity' as const, atLeast, color }],
  });

  it('sem regra própria, o mapa do Zabbix continua valendo', () => {
    expect(resolveElementColor({}, frames, theme, { trigger })).toMatchObject({
      state: 'trigger',
      color: theme.visualization.getColorByName('red'),
      label: 'High',
    });
  });

  it('a regra própria troca a cor do alarme', () => {
    expect(resolveElementColor({}, frames, theme, { trigger, thresholds: severidade(4, 'purple') })).toMatchObject({
      state: 'trigger',
      color: theme.visualization.getColorByName('purple'),
      severity: 4,
    });
  });

  /** Trocar a cor não pode custar o nome do estado. */
  it('sem rótulo na regra, o nome da severidade permanece', () => {
    expect(resolveElementColor({}, frames, theme, { trigger, thresholds: severidade(4, 'purple') })).toMatchObject({
      label: 'High',
    });
  });

  it('o rótulo da regra, quando existe, substitui o nome da severidade', () => {
    const thresholds = { steps: [{ type: 'severity' as const, atLeast: 4 as const, color: 'purple', label: 'CAIU' }] };

    expect(resolveElementColor({}, frames, theme, { trigger, thresholds })).toMatchObject({ label: 'CAIU' });
  });

  it('regra mais grave que o alarme não se aplica, e o mapa volta', () => {
    expect(resolveElementColor({}, frames, theme, { trigger, thresholds: severidade(5, 'purple') })).toMatchObject({
      color: theme.visualization.getColorByName('red'),
    });
  });

  /** O elemento não está alarmando: regra de severidade nenhuma se aplica. */
  it('sem alarme, a regra de severidade não pinta nada', () => {
    const semAlarme = [problemsFrame([])];

    expect(
      resolveElementColor({ fixed: 'blue' }, semAlarme, theme, { trigger, thresholds: severidade(0, 'purple') })
    ).toEqual({ state: 'fixed', color: theme.visualization.getColorByName('blue') });
  });
});

/**
 * Severidade desligada na escada: o elemento ignora aquele alarme por completo —
 * não acende, não conta no badge e não aparece na lista. Fica na Base, como se
 * não houvesse problema.
 */
describe('resolveElementColor — severidade desligada', () => {
  /**
   * Monta a escada como o editor a grava: os seis níveis materializados. Uma
   * escada esparsa se comportaria diferente — a regra é "a partir de", então
   * `atLeast: 4` desligado apagaria também o Disaster —, e é justamente por isso
   * que `writeSeverityLadder` escreve os seis de uma vez.
   */
  const semNivel = (atLeast: 0 | 1 | 2 | 3 | 4 | 5): ElementThresholds => ({
    steps: writeSeverityLadder(undefined, atLeast, { enabled: false }, '#888'),
  });

  it('o alarme daquele nível deixa de acender e vale a Base', () => {
    const frames = [problemsFrame([ALARMANDO])];

    expect(resolveElementColor({ fixed: 'green' }, frames, theme, { trigger, thresholds: semNivel(4) })).toEqual({
      state: 'fixed',
      color: theme.visualization.getColorByName('green'),
    });
  });

  it('sem acento estático, fica neutro — não é `nodata`', () => {
    const frames = [problemsFrame([ALARMANDO])];

    expect(resolveElementColor({}, frames, theme, { trigger, thresholds: semNivel(4) })).toEqual({
      state: 'neutral',
    });
  });

  it('desligar um nível não desliga os outros', () => {
    const disaster: ZabbixProblem = { ...ALARMANDO, severity: '5' };
    const frames = [problemsFrame([ALARMANDO, disaster])];

    // High (4) desligado, Disaster (5) intacto: acende pelo pior que resta.
    expect(resolveElementColor({}, frames, theme, { trigger, thresholds: semNivel(4) })).toMatchObject({
      state: 'trigger',
      severity: 5,
    });
  });

  /** O badge e a lista contam o mesmo que a cor: o descarte é anterior a tudo. */
  it('o alarme descartado some também da contagem e da lista', () => {
    const warning: ZabbixProblem = { ...ALARMANDO, severity: '2', name: 'Memória alta' };
    const frames = [problemsFrame([ALARMANDO, warning])];

    const accent = resolveElementColor({}, frames, theme, { trigger, thresholds: semNivel(2) });

    expect(accent.state === 'trigger' && accent.problems).toHaveLength(1);
    expect(accent.state === 'trigger' && accent.problems[0].severity).toBe(4);
  });

  it('escada intacta continua acendendo em qualquer nível', () => {
    const frames = [problemsFrame([ALARMANDO])];

    expect(resolveElementColor({}, frames, theme, { trigger })).toMatchObject({ state: 'trigger', severity: 4 });
  });
});

/**
 * O vínculo por host+item passa pela mesma cadeia de cor do vínculo por field:
 * o que muda é só como a série é nomeada.
 */
describe('resolveElementColor — vínculo por host + item', () => {
  const HOST = 'AGLIN-FW-STARTI';
  const ITEM = 'CPU utilization';

  it('a regra do elemento pinta a série achada pelo nome qualificado', () => {
    const frames = buildFrames(`${HOST}: ${ITEM}`, [92], BASE_ONLY);

    const resultado = resolveElementColor({ metric: { host: HOST, item: ITEM } }, frames, theme, {
      thresholds: REGRA_METRICA,
    });

    expect(resultado).toMatchObject({ state: 'threshold', label: 'crítico' });
  });

  /**
   * É o estado que o bloco 3 existe para acabar: a métrica está escolhida e
   * nenhuma query a traz. NO DATA, e não a Base — "sem dado" tem que ser
   * visivelmente diferente de "tudo bem".
   */
  it('métrica escolhida e ausente das queries fica em NO DATA, não na Base', () => {
    const resultado = resolveElementColor(
      { fixed: 'purple', metric: { host: HOST, item: ITEM } },
      buildFrames('outra série', [1], BASE_ONLY),
      theme,
      { thresholds: REGRA_METRICA }
    );

    expect(resultado).toEqual({ state: 'nodata' });
  });
});
