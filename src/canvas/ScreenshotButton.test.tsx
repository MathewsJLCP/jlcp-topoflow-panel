import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ReactFlow, ReactFlowProvider } from '@xyflow/react';
import { toPng } from 'html-to-image';

import { ScreenshotButton } from './ScreenshotButton';

/**
 * A conversao para PNG e do `html-to-image` e do canvas do browser — o jsdom nao
 * desenha nada, entao ela e substituida. O que se verifica aqui e o contorno
 * dela, que **e** nosso: quando o botao pode ser clicado, o que ele entrega, e o
 * congelamento das animacoes em volta da captura.
 *
 * O enquadramento e o nome do arquivo tem testes proprios em `screenshot.test.ts`.
 */

jest.mock('html-to-image', () => ({ toPng: jest.fn() }));

const toPngMock = toPng as jest.MockedFunction<typeof toPng>;

/**
 * O componente vive dentro do `<Controls>`, que vive dentro do `<ReactFlow>` —
 * ele precisa do store para saber quais nos existem. O `wrapperRef` imita o
 * container do canvas, com o viewport que a captura procura dentro dele.
 */
function setup(nodes: Array<{ id: string }> = [{ id: 'node-1' }]) {
  function Harness() {
    const wrapperRef = React.useRef<HTMLDivElement>(null);

    return (
      <div ref={wrapperRef}>
        <ReactFlowProvider>
          <ReactFlow nodes={nodes.map((node) => ({ ...node, position: { x: 0, y: 0 }, data: {} }))} edges={[]}>
            <ScreenshotButton wrapperRef={wrapperRef} title="Topologia Núcleo" />
          </ReactFlow>
        </ReactFlowProvider>
      </div>
    );
  }

  const { container } = render(<Harness />);

  return {
    wrapper: container.firstElementChild as HTMLElement,
    botao: screen.getByRole('button', { name: 'Baixar imagem da topologia' }),
  };
}

describe('ScreenshotButton', () => {
  beforeEach(() => {
    toPngMock.mockReset();
    toPngMock.mockResolvedValue('data:image/png;base64,AAA');
  });

  /** Sem elemento não há o que enquadrar, e o arquivo sairia em branco. */
  it('fica desabilitado numa topologia vazia', () => {
    const { botao } = setup([]);

    expect(botao).toBeDisabled();
  });

  it('com elementos, o botão está disponível', () => {
    expect(setup().botao).toBeEnabled();
  });

  it('captura e entrega o arquivo já nomeado pelo painel', async () => {
    const link = document.createElement('a');
    const click = jest.spyOn(link, 'click').mockImplementation(() => {});
    const create = jest.spyOn(document, 'createElement');

    const { botao } = setup();
    // Só o `<a>` do download é interceptado: o React ainda cria elementos.
    create.mockImplementation((tag: string) =>
      tag === 'a' ? link : (Object.getPrototypeOf(document).createElement.call(document, tag) as HTMLElement)
    );

    fireEvent.click(botao);

    await waitFor(() => expect(click).toHaveBeenCalled());
    expect(link.download).toMatch(/^topologia-nucleo-.*\.png$/);
    expect(link.href).toBe('data:image/png;base64,AAA');

    create.mockRestore();
  });

  /**
   * `blink` desce ate opacidade 0.45 e o radar termina em 0. A captura serializa
   * o estilo **computado** do instante, entao sem congelar a foto sairia com o
   * elemento alarmado meio apagado — justamente o elemento por causa do qual
   * alguem tira o screenshot.
   */
  it('congela as animações durante a captura e solta depois', async () => {
    let durante: string | undefined;
    const { wrapper, botao } = setup();

    toPngMock.mockImplementation(async () => {
      durante = wrapper.dataset.capturing;
      return 'data:image/png;base64,AAA';
    });

    fireEvent.click(botao);

    await waitFor(() => expect(toPngMock).toHaveBeenCalled());
    expect(durante).toBe('true');
    await waitFor(() => expect(wrapper.dataset.capturing).toBeUndefined());
  });

  /**
   * O modo de falha real e imagem de outro dominio, que o `<foreignObject>` nao
   * consegue embutir. O painel avisa e segue de pe — um screenshot que falha nao
   * pode levar a topologia junto.
   */
  it('uma captura que falha não derruba o painel nem deixa tudo congelado', async () => {
    // Fora do Grafana nao ha barramento de eventos, entao o aviso cai no
    // `console.error` do fallback. E o comportamento esperado aqui, nao ruido a
    // ser investigado — silenciado para nao poluir a saida da suite.
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { wrapper, botao } = setup();
    toPngMock.mockRejectedValue(new Error('CORS'));

    fireEvent.click(botao);

    await waitFor(() => expect(wrapper.dataset.capturing).toBeUndefined());
    expect(botao).toBeEnabled();
    expect(log).toHaveBeenCalled();

    log.mockRestore();
  });
});
