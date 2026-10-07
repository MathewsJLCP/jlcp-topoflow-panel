import { FieldType, createTheme, toDataFrame } from '@grafana/data';

import { ActiveProblem } from '../../data/triggerState';
import { Severity, TopoNode } from '../../model/types';
import { badgeField, resolveBadge } from './DeviceNode';

const theme = createTheme();

/**
 * Um acento de trigger sempre carrega ao menos um problema — sem problema nao
 * haveria alarme. O helper existe para que cada caso escreva so o que importa
 * nele: a severidade e **quantas** triggers estao abertas.
 */
const alarmando = (severity: Severity, label: string, count = 1): ActiveProblem[] =>
  Array.from({ length: count }, (_, index) => ({
    name: `Trigger ${index + 1}`,
    severity,
    label,
    color: '#f00',
  }));

/**
 * O badge e o unico lugar do no onde o estado vira texto. Renderizar o
 * componente exigiria o contexto do React Flow para os `Handle`s e testaria
 * layout, nao decisao — a decisao esta toda aqui.
 */
describe('resolveBadge', () => {
  it('mantém `NO DATA`, o nome do step e o valor da métrica', () => {
    const display = { text: '92', numeric: 92 };

    expect(resolveBadge({ state: 'nodata' }, theme, false, undefined)).toEqual({
      color: theme.colors.text.disabled,
      label: 'no data',
    });
    expect(resolveBadge({ state: 'threshold', color: '#f00', label: 'crítico' }, theme, true, display)).toEqual({
      color: '#f00',
      label: 'crítico',
    });
    expect(resolveBadge({ state: 'neutral' }, theme, true, display)?.label).toBe('92');
  });

  it('sem estado e sem métrica, não há badge', () => {
    expect(resolveBadge({ state: 'neutral' }, theme, false, undefined)).toBeUndefined();
  });
});

/**
 * O badge chegou a exibir a severidade por ser o único texto de estado que o nó
 * tinha. Com a lista de triggers ativas embaixo do elemento, aquilo virou um
 * segundo lugar dizendo pior a mesma coisa — e ocupava o badge, que o usuário
 * liga para ver a **métrica**.
 */
describe('resolveBadge — modo trigger', () => {
  const alarme = {
    state: 'trigger',
    color: '#f00',
    severity: 4,
    label: 'High',
    problems: alarmando(4, 'High', 3),
  } as const;

  it('com "Exibir valor" desligado, o badge não aparece', () => {
    expect(resolveBadge(alarme, theme, false, undefined)).toBeUndefined();
  });

  it('com "Exibir valor" ligado, o badge mostra a métrica — não a severidade', () => {
    const badge = resolveBadge(alarme, theme, true, { text: '4.07%', numeric: 4.07 });

    expect(badge?.label).toBe('4.07%');
  });
});

/**
 * A correção pedida na rodada: com "Exibir valor" desligado, o texto da regra
 * não aparece. Ele é o *display text* do valor — sem valor na tela, não há o
 * que substituir. A cor continua sinalizando o estado no ícone e na cápsula.
 */
describe('resolveBadge — governado pelo toggle "Exibir valor"', () => {
  const display = { text: '92', numeric: 92 };

  it('com o valor desligado, a regra pinta mas não escreve', () => {
    const badge = resolveBadge({ state: 'threshold', color: '#f00', label: 'UP' }, theme, false, display);

    // Label vazio faz o `DeviceNode` render o dot em vez da pílula.
    expect(badge).toEqual({ color: '#f00', label: '' });
  });

  it('com o valor ligado, o texto da regra aparece', () => {
    const badge = resolveBadge({ state: 'threshold', color: '#f00', label: 'UP' }, theme, true, display);

    expect(badge?.label).toBe('UP');
  });

  it('com o valor ligado e regra sem texto, aparece o número', () => {
    const badge = resolveBadge({ state: 'threshold', color: '#f00' }, theme, true, display);

    expect(badge?.label).toBe('92');
  });

  it('sem estado e com o valor desligado, não há badge', () => {
    expect(resolveBadge({ state: 'neutral' }, theme, false, display)).toBeUndefined();
  });

  /** `no data` não é o valor da métrica: é um aviso sobre o próprio vínculo. */
  it('`no data` não é silenciado pelo toggle', () => {
    expect(resolveBadge({ state: 'nodata' }, theme, false, undefined)?.label).toBe('no data');
  });
});

/**
 * O badge sem field escolhido exibia um travessao. Agora exibe a metrica do
 * estado — que e o que o toggle "Exibir valor" promete, e a unica saida quando a
 * metrica foi escolhida por host+item (nesse caso a serie so existe quando o
 * painel busca sozinho, e o seletor de field nao teria o que oferecer).
 */
describe('badgeField', () => {
  const no = (overrides: Partial<TopoNode>): TopoNode =>
    ({
      id: 'n',
      position: { x: 0, y: 0 },
      size: { width: 10, height: 10 },
      presentation: { primaryText: { mode: 'fixed', fixed: 'n' } },
      color: {},
      zIndex: 0,
      ...overrides,
    }) as TopoNode;

  const frames = [toDataFrame({ fields: [{ name: 'H: CPU', type: FieldType.number, values: [92] }] })];

  it('o field escolhido no toggle manda', () => {
    expect(badgeField(no({ value: { field: 'outro' }, color: { field: 'estado' } }), frames)).toBe('outro');
  });

  it('sem field escolhido, cai na métrica do estado', () => {
    expect(badgeField(no({ value: {}, color: { field: 'estado' } }), frames)).toBe('estado');
  });

  it('vínculo por host+item também alimenta o badge', () => {
    expect(badgeField(no({ value: {}, color: { metric: { host: 'H', item: 'CPU' } } }), frames)).toBe('H: CPU');
  });

  it('sem vínculo nenhum, não há o que exibir', () => {
    expect(badgeField(no({ value: {} }), frames)).toBeUndefined();
  });
});
