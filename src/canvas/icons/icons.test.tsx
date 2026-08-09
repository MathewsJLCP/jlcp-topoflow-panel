import React from 'react';
import { render } from '@testing-library/react';

import { DEFAULT_ICON, TOPO_ICONS, TopoIcon, isTopoIconName, resolveTopoIcon } from './index';

describe('resolveTopoIcon', () => {
  it('aceita as chaves da biblioteca', () => {
    expect(resolveTopoIcon('firewall')).toBe('firewall');
    expect(resolveTopoIcon('load-balancer')).toBe('load-balancer');
  });

  /**
   * O schema guarda a chave como string livre justamente para tolerar isto: um
   * icone removido ou renomeado nao pode fazer o no sumir da topologia.
   */
  it('cai no genérico para chave desconhecida, vazia ou ausente', () => {
    expect(resolveTopoIcon('nao-existe')).toBe(DEFAULT_ICON);
    expect(resolveTopoIcon('')).toBe(DEFAULT_ICON);
    expect(resolveTopoIcon(undefined)).toBe(DEFAULT_ICON);
  });

  /** Regressão: as chaves antigas vinham do `@grafana/ui`, que não tem ativos de rede. */
  it('um ícone do Grafana salvo antes do Bloco 3 não quebra o nó', () => {
    expect(resolveTopoIcon('sitemap')).toBe(DEFAULT_ICON);
  });

  it('isTopoIconName rejeita o que não é chave', () => {
    expect(isTopoIconName('server')).toBe(true);
    expect(isTopoIconName('sitemap')).toBe(false);
    expect(isTopoIconName(undefined)).toBe(false);
    expect(isTopoIconName(42)).toBe(false);
  });
});

describe('biblioteca de ícones', () => {
  it('o seletor lista todos os ícones, sem repetir', () => {
    const names = TOPO_ICONS.map((icon) => icon.name);

    expect(new Set(names).size).toBe(names.length);
    expect(names).toContain(DEFAULT_ICON);
  });

  it('todo ícone do seletor renderiza um SVG com desenho', () => {
    for (const { name, label } of TOPO_ICONS) {
      const { container, unmount } = render(<TopoIcon name={name} />);
      const svg = container.querySelector('svg');

      expect(svg).not.toBeNull();
      expect(svg?.getAttribute('viewBox')).toBe('0 0 24 24');
      // Um glifo vazio passaria em qualquer asserção de "renderizou".
      expect(svg?.children.length).toBeGreaterThan(0);
      expect(label.length).toBeGreaterThan(0);

      unmount();
    }
  });

  /**
   * A cor do ícone vem da cadeia de cor do elemento, aplicada pelo `DeviceNode`
   * via `color`. Um `stroke` fixo aqui romperia isso em silêncio.
   */
  it('o traço herda a cor de quem renderiza', () => {
    const { container } = render(<TopoIcon name="server" />);
    const svg = container.querySelector('svg');

    expect(svg?.getAttribute('stroke')).toBe('currentColor');
    expect(svg?.getAttribute('fill')).toBe('none');
  });

  it('respeita o tamanho pedido', () => {
    const { container } = render(<TopoIcon name="router" size={32} />);

    expect(container.querySelector('svg')?.getAttribute('width')).toBe('32');
  });
});
