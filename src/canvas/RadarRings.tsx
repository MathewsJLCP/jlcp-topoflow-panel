import React from 'react';
import { css } from '@emotion/css';

import { tfRadar, tfRadarPoint } from '../theme/motion';

/**
 * Os aneis do radar, na forma do elemento — o cartao arredondado do no, a caixa
 * da Imagem, o circulo do point.
 *
 * Irmaos do cartao, e nao filhos: o cartao pode estar pulsando, e o anel nao
 * deve escalar junto. O no tem dois aneis defasados de 1s; a Imagem e o point,
 * um so — como no mockup.
 */
interface RadarRingsProps {
  color: string;
  radius: number | string;
  rings?: 1 | 2;
  /** `point` usa a onda circular que vai mais longe. */
  variant?: 'box' | 'point';
  /** Caixa do anel; por padrao, o elemento inteiro. */
  style?: React.CSSProperties;
}

export function RadarRings({ color, radius, rings = 1, variant = 'box', style }: RadarRingsProps) {
  const cls = variant === 'point' ? styles.point : styles.box;
  return (
    <>
      {Array.from({ length: rings }, (_, i) => (
        <span
          key={i}
          aria-hidden
          className={cls}
          style={{ borderColor: color, borderRadius: radius, animationDelay: i ? '1s' : undefined, ...style }}
        />
      ))}
    </>
  );
}

const ring = {
  position: 'absolute' as const,
  inset: 0,
  border: '2px solid',
  pointerEvents: 'none' as const,
  opacity: 0,
};

const styles = {
  box: css({
    ...ring,
    '@media (prefers-reduced-motion: no-preference)': { animation: `${tfRadar} 2s ease-out infinite` },
  }),
  point: css({
    ...ring,
    '@media (prefers-reduced-motion: no-preference)': { animation: `${tfRadarPoint} 2s ease-out infinite` },
  }),
};
