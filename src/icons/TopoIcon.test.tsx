import React from 'react';
import { render } from '@testing-library/react';

import { TopoIcon, listIcons, resolveIcon } from './index';
import { DEFAULT_TONES, iconTones } from './svg/tones';

function decoded(container: HTMLElement): string {
  return decodeURIComponent(container.querySelector('img')?.getAttribute('src') ?? '');
}

describe('TopoIcon — catálogo', () => {
  /** Nenhum ícone pode renderizar vazio, seja qual for a sua natureza. */
  it('todo ícone do catálogo desenha alguma coisa', () => {
    for (const icon of listIcons()) {
      const { container, unmount } = render(<TopoIcon icon={icon} />);

      const src = decoded(container);
      expect(src.startsWith('data:image/svg+xml,<svg')).toBe(true);
      expect(src.length).toBeGreaterThan(200);

      unmount();
    }
  });
});

describe('TopoIcon — svg do catálogo', () => {
  /**
   * O mesmo desenho acompanha o estado: os seis tons saem da cor do elemento.
   * Um roteador que não mudasse de cor no alarme seria informação errada.
   */
  it('injeta os tons derivados da cor do estado', () => {
    const { container } = render(<TopoIcon icon={resolveIcon('padrao/roteador')} color="#EF4444" />);
    const src = decoded(container);
    const tones = iconTones('#EF4444');

    expect(src).toContain(`--tf-t2:${tones.t2}`);
    expect(src).toContain(`--tf-t3:${tones.t3}`);
    expect(tones.t2).toBe('#EF4444');
  });

  /** Sem estado (neutro, sem dado), o desenho sai no azul original dele. */
  it('sem cor usa os tons padrão do desenho', () => {
    const { container } = render(<TopoIcon icon={resolveIcon('infra/switch')} />);

    expect(decoded(container)).toContain(`--tf-t1:${DEFAULT_TONES.t1}`);
  });

  /** Cores diferentes não podem compartilhar o cache. */
  it('cores diferentes produzem desenhos diferentes', () => {
    const icon = resolveIcon('padrao/servidor');
    const a = render(<TopoIcon icon={icon} color="#22C55E" />);
    const b = render(<TopoIcon icon={icon} color="#F59E0B" />);

    expect(decoded(a.container)).not.toBe(decoded(b.container));
  });
});
