import { createTheme } from '@grafana/data';

import { resolveBadge } from './DeviceNode';

const theme = createTheme();

/**
 * O badge e o unico lugar do no onde o estado vira texto. Renderizar o
 * componente exigiria o contexto do React Flow para os `Handle`s e testaria
 * layout, nao decisao — a decisao esta toda aqui.
 */
describe('resolveBadge', () => {
  it('trigger alarmando exibe o nome da severidade', () => {
    const badge = resolveBadge(
      { state: 'trigger', color: '#f00', severity: 5, label: 'Disaster' },
      theme,
      false,
      undefined
    );

    // O CSS do badge aplica `text-transform: uppercase`; o modelo guarda o nome.
    expect(badge).toEqual({ color: '#f00', label: 'Disaster' });
  });

  /**
   * Com a trigger no comando, o numero da metrica sairia ao lado da severidade
   * e sugeriria que as duas pintam o no. O estado vem de uma fonte so.
   */
  it('a trigger substitui a métrica no badge, não divide espaço', () => {
    const display = { text: '92', numeric: 92, color: '#0f0' };
    const badge = resolveBadge({ state: 'trigger', color: '#f00', severity: 4, label: 'High' }, theme, true, display);

    expect(badge?.label).toBe('High');
  });

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
 * A correção pedida na rodada: com "Valor exibido" desligado, o texto da regra
 * não aparece. Ele é o *display text* do valor — sem valor na tela, não há o
 * que substituir. A cor continua sinalizando o estado no ícone e na cápsula.
 */
describe('resolveBadge — governado pelo toggle "Valor exibido"', () => {
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

  /** Nenhum dos dois é o valor da métrica: são avisos sobre o próprio vínculo. */
  it('trigger e `no data` não são silenciados pelo toggle', () => {
    expect(resolveBadge({ state: 'trigger', color: '#f00', severity: 4, label: 'High' }, theme, false, undefined)?.label).toBe('High');
    expect(resolveBadge({ state: 'nodata' }, theme, false, undefined)?.label).toBe('no data');
  });
});
