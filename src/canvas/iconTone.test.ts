import { createTheme } from '@grafana/data';

import { ElementColor } from '../data/elementColor';
import { TF_DARK, TF_LIGHT } from '../theme/palette';
import { iconColor } from './iconTone';

const dark = createTheme();
const light = createTheme({ colors: { mode: 'light' } });

/**
 * A cor com que o ícone é pintado. No mockup ele sempre acompanha o estado;
 * errar aqui é cor errada num NOC, que é informação errada.
 */
describe('iconColor', () => {
  it('acompanha a cor do estado', () => {
    const alarme: ElementColor = { state: 'threshold', color: '#EF4444' };
    const base: ElementColor = { state: 'fixed', color: '#22C55E' };

    expect(iconColor(alarme, undefined, dark)).toBe('#EF4444');
    expect(iconColor(base, 'state', dark)).toBe('#22C55E');
  });

  /** Neutro e sem dado não têm cor: o desenho fica no azul original. */
  it('sem estado devolve undefined', () => {
    expect(iconColor({ state: 'neutral' }, undefined, dark)).toBeUndefined();
    expect(iconColor({ state: 'nodata' }, undefined, dark)).toBeUndefined();
  });

  /** Cor fixada antes da v1.4 continua valendo, na paleta do tema vigente. */
  it('respeita o tom fixo salvo, pela paleta do tema', () => {
    const alarme: ElementColor = { state: 'threshold', color: '#EF4444' };

    expect(iconColor(alarme, 'gray', dark)).toBe(TF_DARK.apa);
    expect(iconColor(alarme, 'green', light)).toBe(TF_LIGHT.ok);
  });
});
