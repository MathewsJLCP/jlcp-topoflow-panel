import { createTheme } from '@grafana/data';

import { SEVERITY_COLOR } from '../data/problems';
import { AA_NORMAL, contrast, stateFill } from './stateFill';

const theme = createTheme();

describe('stateFill', () => {
  it('preenche os estados que carregam cor', () => {
    const red = theme.visualization.getColorByName('red');

    expect(stateFill({ state: 'trigger', color: red, severity: 4, label: 'High' }, theme)?.background).toBe(red);
    expect(stateFill({ state: 'threshold', color: red }, theme)?.background).toBe(red);
    expect(stateFill({ state: 'fixed', color: red }, theme)?.background).toBe(red);
  });

  /**
   * `nodata` preenchido de qualquer cor passaria a mensagem de que o elemento
   * tem estado. A ausencia de fundo e o proprio sinal (A.4).
   */
  it('nao preenche ausencia de estado', () => {
    expect(stateFill({ state: 'nodata' }, theme)).toBeUndefined();
    expect(stateFill({ state: 'neutral' }, theme)).toBeUndefined();
  });
});

/**
 * O criterio do PRD: texto legivel sobre **cada** cor de estado (WCAG AA, 4.5:1
 * para corpo de texto). O teste roda sobre as cores que o produto realmente
 * alcanca — o mapa de severidade da trigger e a paleta que o editor de regras
 * oferece — nos dois temas.
 *
 * Nao e um teste de implementacao do Grafana: e o contrato do fill. Se um dia a
 * paleta ganhar um tom cuja luminancia caia na zona morta do limiar, e aqui que
 * isso aparece, e nao no painel de um operador as tres da manha.
 */
describe('stateFill — contraste', () => {
  const severidades = Object.values(SEVERITY_COLOR).filter((color): color is string => color !== undefined);
  const paletaDoEditor = ['yellow', 'orange', 'red', 'dark-red', 'blue'];
  const cores = [...new Set([...severidades, ...paletaDoEditor])];

  describe.each(['dark', 'light'] as const)('tema %s', (mode) => {
    const tema = createTheme({ colors: { mode } });

    it.each(cores)('%s tem contraste AA', (name) => {
      const color = tema.visualization.getColorByName(name);
      const fill = stateFill({ state: 'threshold', color }, tema)!;

      expect(contrast(fill.text, fill.background, tema)).toBeGreaterThanOrEqual(AA_NORMAL);
    });
  });

  /** O par claro/escuro nao e teorico: e a diferenca entre `yellow` e `dark-red`. */
  it('inverte o texto conforme a luminancia do fundo', () => {
    const claro = stateFill({ state: 'threshold', color: theme.visualization.getColorByName('yellow') }, theme);
    const escuro = stateFill({ state: 'threshold', color: theme.visualization.getColorByName('dark-red') }, theme);

    expect(claro?.text).not.toBe(escuro?.text);
  });

  /**
   * Regressao da razao de existir do helper: `getContrastText` sozinho aprova o
   * branco sobre `red` com 3.57. Se alguem simplificar o `stateFill` de volta
   * para uma chamada direta, e este teste que acusa.
   */
  it('escolhe o texto de maior contraste, não o primeiro que passa de 3', () => {
    const red = theme.visualization.getColorByName('red');
    const fill = stateFill({ state: 'threshold', color: red }, theme)!;

    expect(fill.text).not.toBe(theme.colors.getContrastText(red));
    expect(contrast(fill.text, red, theme)).toBeGreaterThan(contrast(theme.colors.getContrastText(red), red, theme));
  });
});
