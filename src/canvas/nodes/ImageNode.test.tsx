import { createTheme } from '@grafana/data';

import { ImageBackground } from '../../model/types';
import { TF_DARK, tfMix } from '../../theme/palette';
import { stateLook } from '../look';
import { ICON_FILL, imageSurface } from './ImageNode';

const theme = createTheme();
const p = TF_DARK;

const estado: ImageBackground = { mode: 'state', color: '', opacity: 0.22 };
const solido: ImageBackground = { mode: 'fixed', color: 'blue', opacity: 0.5 };

const NEUTRO = stateLook({ state: 'neutral' }, undefined, theme);
const SEM_DADO = stateLook({ state: 'nodata' }, undefined, theme);
const ALARME = stateLook({ state: 'threshold', color: p.at }, undefined, theme);

describe('imageSurface', () => {
  it('sem fundo configurado, a caixa não aparece', () => {
    expect(imageSurface(undefined, ALARME, p, theme).background).toBe('transparent');
  });

  /** O fundo do mockup: borda do estado e a cor dele na opacidade escolhida. */
  it('modo estado usa a cor e a borda do estado', () => {
    expect(imageSurface(estado, ALARME, p, theme)).toEqual({
      background: tfMix(p.at, 22),
      border: `2px solid ${p.at}`,
    });
  });

  it('sem dado, hachurado e tracejado', () => {
    const surface = imageSurface(estado, SEM_DADO, p, theme);

    expect(surface.background).toContain('repeating-linear-gradient');
    expect(surface.border).toBe(`1.5px dashed ${p.apa}`);
  });

  it('sem estado, um cinza fraco com a borda da superfície', () => {
    expect(imageSurface(estado, NEUTRO, p, theme)).toEqual({
      background: tfMix(p.rot, Math.round(0.22 * 60)),
      border: `1px solid ${p.borda}`,
    });
  });

  /** O modo sólido de antes da v1.4 continua valendo, na paleta do tema. */
  it('modo sólido usa a cor escolhida e ignora o estado', () => {
    expect(imageSurface(solido, ALARME, p, theme).background).toBe(tfMix(p.in, 50));
  });

  it('o desenho ocupa 84% da caixa', () => {
    expect(ICON_FILL).toBe(0.84);
  });
});
