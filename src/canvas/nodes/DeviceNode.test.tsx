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
      undefined,
      undefined
    );

    // O CSS do badge aplica `text-transform: uppercase`; o modelo guarda o nome.
    expect(badge).toEqual({ color: '#f00', label: 'Disaster' });
  });

  /**
   * Com a trigger no comando, o numero da metrica sairia ao lado da severidade
   * e sugeriria que as duas pintam o no. So uma fonte de estado por vez.
   */
  it('a trigger substitui a métrica no badge, não divide espaço', () => {
    const display = { text: '92', numeric: 92, color: '#0f0' };
    const badge = resolveBadge({ state: 'trigger', color: '#f00', severity: 4, label: 'High' }, theme, 'cpu', display);

    expect(badge?.label).toBe('High');
  });

  it('mantém `NO DATA`, o nome do step e o valor da métrica', () => {
    const display = { text: '92', numeric: 92 };

    expect(resolveBadge({ state: 'nodata' }, theme, undefined, undefined)).toEqual({
      color: theme.colors.text.disabled,
      label: 'no data',
    });
    expect(resolveBadge({ state: 'threshold', color: '#f00', label: 'crítico' }, theme, 'cpu', display)).toEqual({
      color: '#f00',
      label: 'crítico',
    });
    expect(resolveBadge({ state: 'neutral' }, theme, 'cpu', display)?.label).toBe('92');
  });

  it('sem estado e sem métrica, não há badge', () => {
    expect(resolveBadge({ state: 'neutral' }, theme, undefined, undefined)).toBeUndefined();
  });
});
