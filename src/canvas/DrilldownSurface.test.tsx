import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { locationService } from '@grafana/runtime';

import { DrilldownSurface } from './DrilldownSurface';

/**
 * A superficie decide **qual tag** sai. E o ponto inteiro do componente: com um
 * `<a>` de verdade, o ctrl+clique, o clique do meio, o foco por Tab e o anuncio
 * como link vem do browser e nao precisam de codigo nenhum — por isso os testes
 * daqui olham para a tag e para os atributos, e nao para o comportamento de
 * navegacao, que e do browser.
 */

function renderSurface(props: React.ComponentProps<typeof DrilldownSurface>) {
  const { container } = render(<DrilldownSurface {...props} />);
  return container.firstElementChild as HTMLElement;
}

describe('DrilldownSurface', () => {
  it('sem link é um div: o elemento fica como sempre foi', () => {
    const el = renderSurface({ children: 'Núcleo' });

    expect(el.tagName).toBe('DIV');
  });

  it('link vazio também é um div — um href vazio recarregaria a página', () => {
    const el = renderSurface({ drilldown: { url: '  ' }, children: 'Núcleo' });

    expect(el.tagName).toBe('DIV');
  });

  it('com link vira uma âncora de verdade', () => {
    const el = renderSurface({ drilldown: { url: '/d/uid/detalhe' }, children: 'Núcleo' });

    expect(el.tagName).toBe('A');
    expect(el).toHaveAttribute('href', '/d/uid/detalhe');
    // Sem isto, arrastar o elemento no dashboard iniciaria o arraste nativo do
    // link em vez do gesto do canvas.
    expect(el).toHaveAttribute('draggable', 'false');
  });

  /**
   * No editor o clique ja seleciona o elemento e abre o formulario dele. Um
   * segundo significado no mesmo gesto tiraria o usuario do dashboard no meio da
   * configuracao.
   */
  it('em modo de edição não há link nenhum', () => {
    const el = renderSurface({ drilldown: { url: '/d/uid/detalhe' }, editable: true, children: 'Núcleo' });

    expect(el.tagName).toBe('DIV');
  });

  it('nova aba leva `rel` junto — sem ele a página aberta controla a do dashboard', () => {
    const el = renderSurface({ drilldown: { url: 'https://x/y', targetBlank: true }, children: 'Núcleo' });

    expect(el).toHaveAttribute('target', '_blank');
    expect(el).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('mesma aba não declara `target`', () => {
    const el = renderSurface({ drilldown: { url: '/d/uid/detalhe' }, children: 'Núcleo' });

    expect(el).not.toHaveAttribute('target');
  });

  it('clique num caminho interno navega pelo app, sem recarregar', () => {
    const push = jest.spyOn(locationService, 'push').mockImplementation(() => {});
    renderSurface({ drilldown: { url: '/d/uid/detalhe' }, children: 'Núcleo' });

    fireEvent.click(screen.getByText('Núcleo'), { button: 0 });

    expect(push).toHaveBeenCalledWith('/d/uid/detalhe');
    push.mockRestore();
  });

  /** O endereco sem esquema deixa de virar caminho relativo ao dashboard. */
  it('completa o esquema de um endereço externo antes de virar href', () => {
    const el = renderSurface({ drilldown: { url: 'www.google.com' }, children: 'Núcleo' });

    expect(el).toHaveAttribute('href', 'https://www.google.com');
  });

  it('clique num endereço externo é do browser: nós não interferimos', () => {
    const push = jest.spyOn(locationService, 'push').mockImplementation(() => {});
    renderSurface({ drilldown: { url: 'https://exemplo.com' }, children: 'Núcleo' });

    fireEvent.click(screen.getByText('Núcleo'), { button: 0 });

    expect(push).not.toHaveBeenCalled();
    push.mockRestore();
  });

  /**
   * O `ElementHover` injeta o seu `onClick` por `cloneElement`. Engolir o
   * handler do pai aqui deixaria o painel de triggers mudo em todo elemento sem
   * link — que sao quase todos.
   */
  it('não engole o `onClick` de quem envolve a superfície', () => {
    const onClick = jest.fn();
    render(
      <DrilldownSurface onClick={onClick}>
        <span>Núcleo</span>
      </DrilldownSurface>
    );

    fireEvent.click(screen.getByText('Núcleo'));

    expect(onClick).toHaveBeenCalled();
  });

  /** O `Tooltip` do painel de triggers ancora nesta superfície por ref. */
  it('encaminha a ref, nas duas tags', () => {
    const semLink = React.createRef<HTMLElement>();
    const comLink = React.createRef<HTMLElement>();

    render(<DrilldownSurface ref={semLink}>a</DrilldownSurface>);
    render(
      <DrilldownSurface ref={comLink} drilldown={{ url: '/d/uid' }}>
        b
      </DrilldownSurface>
    );

    expect(semLink.current?.tagName).toBe('DIV');
    expect(comLink.current?.tagName).toBe('A');
  });
});
