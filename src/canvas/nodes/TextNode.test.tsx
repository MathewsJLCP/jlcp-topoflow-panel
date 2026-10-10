import React from 'react';
import { render } from '@testing-library/react';
import { createTheme } from '@grafana/data';
import { NodeProps } from '@xyflow/react';

import { TopoText } from '../../model/types';
import { TextFlowNode } from '../flowTypes';
import { TextNode, textBackground } from './TextNode';
import { resolveTfColor } from '../../theme/palette';

/**
 * O `TextNode` nao usa hook nenhum do React Flow — sem `Handle`, sem
 * `useConnection` —, entao renderiza fora do `ReactFlowProvider` com um objeto
 * de props cru. E o unico no da cena em que isso vale, e por isso o teste existe
 * so aqui.
 */

const text: TopoText = {
  id: 'titulo',
  position: { x: 0, y: 0 },
  content: { mode: 'fixed', fixed: 'Núcleo' },
  color: {},
  fontSize: 16,
  zIndex: 0,
};

function renderText(overrides: Partial<TopoText> = {}, editable = false) {
  const props = {
    data: { element: { ...text, ...overrides }, frames: [], editable },
    selected: false,
  } as unknown as NodeProps<TextFlowNode>;

  const { container } = render(<TextNode {...props} />);

  return container.firstElementChild as HTMLElement;
}

describe('TextNode — background', () => {
  it('sem background, o fundo continua transparente', () => {
    const el = renderText({ background: undefined });

    expect(el).toHaveTextContent('Núcleo');
    // Nada de `background` inline: o elemento não ganhou superfície nenhuma.
    expect(el.style.background).toBe('');
  });

  it('com background, o elemento não recebe `opacity` — o glifo não pode apagar', () => {
    const el = renderText({ background: { color: 'blue', opacity: 0.4 } });

    expect(el.style.opacity).toBe('');
  });
});

/**
 * O valor da placa e verificado aqui, e nao no DOM: o `color-mix` que `alpha`
 * produz e invalido para o parser de CSS do jsdom, que descarta o estilo inline
 * inteiro. No browser ele vale — e o mesmo helper que o `PointNode` ja usa.
 */
describe('textBackground', () => {
  const theme = createTheme();

  it('sem placa, não devolve cor nenhuma', () => {
    expect(textBackground(undefined, theme)).toBeUndefined();
  });

  it('a opacidade entra dentro da cor', () => {
    const fundo = textBackground({ color: 'blue', opacity: 0.4 }, theme);

    expect(fundo).toContain('color-mix');
    expect(fundo).toContain('40%');
  });

  /** O nome é resolvido pelo tema a cada render — é o que segue claro/escuro. */
  it('resolve o nome de cor do tema, não o guarda cru', () => {
    const fundo = textBackground({ color: 'blue', opacity: 1 }, theme);

    expect(fundo).not.toContain('blue');
    expect(fundo).toContain(resolveTfColor('blue', theme));
  });
});

/**
 * Decisao D5 + (a): o Texto perdeu a trigger **e** o vinculo de cor por field.
 * Uma topologia antiga pode ter `color.field` salvo; ele nao pode voltar a
 * pintar nada.
 */
describe('TextNode — sem fonte de estado', () => {
  it('usa a cor fixa', () => {
    const el = renderText({ color: { fixed: 'red' } });

    expect(el.style.color).toBeTruthy();
  });

  it('`color.field` remanescente de uma topologia antiga fica inerte', () => {
    const comField = renderText({ color: { field: 'cpu_usage' } });
    const semNada = renderText({ color: {} });

    // Sem `fixed`, os dois caem no mesmo neutro do tema — o field não desvia
    // a cor para lugar nenhum.
    expect(comField.style.color).toBe(semNada.style.color);
  });
});

/**
 * O Texto e o unico dos tres elementos com drill-down que renderiza fora do
 * `ReactFlowProvider`, entao e aqui que a ligacao entre o modelo e a tag de fato
 * se verifica ponta a ponta. A mecanica do `<a>` em si esta em
 * `DrilldownSurface.test.tsx`; o que se fixa aqui e que o campo do elemento
 * chega la.
 */
describe('TextNode — drill-down', () => {
  it('sem link, o texto continua um div', () => {
    expect(renderText().tagName).toBe('DIV');
  });

  it('com link, o próprio glifo vira a âncora', () => {
    const el = renderText({ drilldown: { url: '/d/uid/detalhe' } });

    expect(el.tagName).toBe('A');
    expect(el).toHaveAttribute('href', '/d/uid/detalhe');
    expect(el).toHaveTextContent('Núcleo');
  });

  /** No editor o clique seleciona o elemento; navegar tiraria o usuário dali. */
  it('em modo de edição o link não existe', () => {
    expect(renderText({ drilldown: { url: '/d/uid/detalhe' } }, true).tagName).toBe('DIV');
  });

  /** A cor do texto continua sendo a do elemento, não o azul de link do browser. */
  it('a âncora não repinta o texto', () => {
    const el = renderText({ drilldown: { url: '/d/uid' }, color: { fixed: 'red' } });

    expect(el.style.color).not.toBe('');
  });
});
