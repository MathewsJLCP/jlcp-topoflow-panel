import React from 'react';
import { render } from '@testing-library/react';

import { TopoIcon, listIcons, resolveIcon } from './index';
import { imageSrc } from './TopoIcon';
import { IconTone, ResolvedIcon } from './types';

const figura: ResolvedIcon = {
  name: 'logo',
  label: 'Logo',
  pack: 'user',
  packLabel: 'Meus ícones',
  ref: 'user/logo',
  art: { kind: 'image', src: 'data:image/png;base64,AAA' },
};

describe('TopoIcon — catálogo', () => {
  /** Nenhum ícone pode renderizar vazio, seja qual for a sua natureza. */
  it('todo ícone do catálogo desenha alguma coisa', () => {
    for (const icon of listIcons()) {
      const { container, unmount } = render(<TopoIcon icon={icon} />);

      if (icon.art.kind === 'glyph') {
        const svg = container.querySelector('svg');
        expect(svg?.getAttribute('viewBox')).toBe('0 0 24 24');
        // Um glifo vazio passaria em qualquer asserção de "renderizou".
        expect(svg?.children.length).toBeGreaterThan(0);
      } else {
        expect(container.querySelector('img')?.getAttribute('src')).toBeTruthy();
      }

      unmount();
    }
  });
});

describe('TopoIcon — glifo', () => {
  /**
   * A cor do ícone vem da cadeia de cor do elemento, aplicada por quem
   * renderiza. Um `stroke` fixo aqui romperia isso em silêncio.
   */
  it('o traço herda a cor de quem renderiza', () => {
    const { container } = render(<TopoIcon icon={resolveIcon('server')} />);
    const svg = container.querySelector('svg');

    expect(svg?.getAttribute('stroke')).toBe('currentColor');
    expect(svg?.getAttribute('fill')).toBe('none');
  });

  it('respeita o tamanho pedido', () => {
    const { container } = render(<TopoIcon icon={resolveIcon('router')} size={32} />);

    expect(container.querySelector('svg')?.getAttribute('width')).toBe('32');
  });
});

describe('TopoIcon — figura', () => {
  it('arte colorida sai numa imagem, não num SVG', () => {
    const { container } = render(<TopoIcon icon={figura} size={24} />);
    const img = container.querySelector('img');

    expect(img?.getAttribute('src')).toBe('data:image/png;base64,AAA');
    expect(img?.getAttribute('width')).toBe('24');
    expect(container.querySelector('svg')).toBeNull();
  });

  /** Sem `contain`, um logo retangular sairia esticado dentro da cápsula. */
  it('a figura cabe na caixa sem distorcer', () => {
    const { container } = render(<TopoIcon icon={figura} />);

    expect(container.querySelector('img')).toHaveStyle({ objectFit: 'contain' });
  });

  /** Decorativa nos dois casos: o nome do ativo já está no texto do elemento. */
  it('não é anunciada pelo leitor de tela', () => {
    const { container } = render(<TopoIcon icon={figura} />);

    expect(container.querySelector('img')?.getAttribute('alt')).toBe('');
    expect(container.querySelector('img')?.getAttribute('aria-hidden')).toBe('true');
  });
});

/**
 * A terceira natureza: a figura nao pode ser tingida, mas **pode trocar de
 * arquivo**. E o que faz um PNG acompanhar um alarme, como nos mapas do Zabbix.
 */
describe('TopoIcon — variantes', () => {
  const router = resolveIcon('topoflow/router');

  const arquivo = (tone?: IconTone) => {
    const { container, unmount } = render(<TopoIcon icon={router} tone={tone} />);
    const src = container.querySelector('img')?.getAttribute('src');
    unmount();
    return src;
  };

  it('cada tom escolhe o seu arquivo', () => {
    expect(arquivo('red')).toBe('router-red-96.png');
    expect(arquivo('yellow')).toBe('router-yellow-96.png');
    expect(arquivo('blue')).toBe('router-blue-96.png');
    expect(arquivo('gray')).toBe('router-gray-96.png');
  });

  it('sem tom pedido, vale o tom de repouso do ícone', () => {
    expect(arquivo()).toBe('router-gray-96.png');
  });

  it('cada família do pack Padrão tem os seis tons', () => {
    expect(arquivo('green')).toBe('router-green-96.png');
    expect(arquivo('orange')).toBe('router-orange-96.png');
    expect(imageSrc(resolveIcon('topoflow/circle'), 'green')).toBe('circle-green-96.png');
  });

  /**
   * Um pack futuro pode não trazer todas as cores. Mostrar amarelo onde se pediu
   * verde diria algo errado sobre o estado; o tom base apenas não diz nada.
   */
  it('tom que o ícone não tem cai no base, não numa cor aproximada', () => {
    const incompleto: ResolvedIcon = {
      name: 'parcial',
      label: 'Parcial',
      pack: 'teste',
      packLabel: 'Teste',
      ref: 'teste/parcial',
      art: { kind: 'variants', base: 'gray', tones: { gray: 'p-gray.png', red: 'p-red.png' } },
    };

    expect(imageSrc(incompleto, 'green')).toBe('p-gray.png');
    expect(imageSrc(incompleto, 'red')).toBe('p-red.png');
  });

  it('imageSrc devolve undefined para glifo', () => {
    expect(imageSrc(resolveIcon('classic/server'))).toBeUndefined();
  });
});
