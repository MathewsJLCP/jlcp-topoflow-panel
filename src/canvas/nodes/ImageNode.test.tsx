import { createTheme } from '@grafana/data';

import { ElementColor } from '../../data/elementColor';
import { ImageBackground } from '../../model/types';
import { backgroundColor } from './ImageNode';

/**
 * A placa e a unica superficie da imagem que pode mudar de cor — a figura em si
 * nunca e tingida. O que se fixa aqui e de onde a cor dela vem em cada caso.
 */

const theme = createTheme();

const solido: ImageBackground = { mode: 'fixed', color: 'blue', opacity: 1 };
const estado: ImageBackground = { mode: 'state', color: 'blue', opacity: 1 };

const NEUTRO: ElementColor = { state: 'neutral' };
const SEM_DADO: ElementColor = { state: 'nodata' };

describe('backgroundColor', () => {
  it('sem fundo configurado não pinta nada', () => {
    expect(backgroundColor(undefined, NEUTRO, undefined, theme)).toBeUndefined();
  });

  it('modo sólido usa a cor escolhida, resolvida pelo tema', () => {
    const painted = backgroundColor(solido, NEUTRO, undefined, theme);

    // O nome vira a cor do tema — nunca fica salvo resolvido, para acompanhar
    // claro e escuro.
    expect(painted).toContain(theme.visualization.getColorByName('blue'));
  });

  it('modo sólido ignora o estado, mesmo havendo um', () => {
    expect(backgroundColor(solido, NEUTRO, '#ff0000', theme)).not.toContain('#ff0000');
  });

  it('modo estado usa a cor do estado resolvido', () => {
    expect(backgroundColor(estado, NEUTRO, '#ff0000', theme)).toContain('#ff0000');
  });

  /**
   * Os dois casos sem estado não podem se confundir: um painel mudo tem de
   * continuar visivelmente distinto de um saudável.
   */
  it('sem dado cai no cinza de "falta dado", não no neutro', () => {
    expect(backgroundColor(estado, SEM_DADO, undefined, theme)).toContain(theme.colors.text.disabled);
  });

  it('sem estado nenhum a placa aparece, neutra', () => {
    const painted = backgroundColor(estado, NEUTRO, undefined, theme);

    // Ligou o toggle, a placa existe: sumir com ela se leria como bug.
    expect(painted).toContain(theme.colors.background.secondary);
  });

  it('a opacidade entra na cor, e não no elemento', () => {
    // Modular o elemento apagaria a figura junto; a placa é que fica translúcida.
    expect(backgroundColor({ ...solido, opacity: 0.5 }, NEUTRO, undefined, theme)).toContain('50%');
  });
});
