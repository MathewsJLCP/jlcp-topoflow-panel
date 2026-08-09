import { InternalNode, Position } from '@xyflow/react';

import { autoPositions, centerOf } from './geometry';

/** Só os campos que `centerOf` lê; o resto do `InternalNode` não importa aqui. */
function fakeNode(x: number, y: number, width?: number, height?: number): InternalNode {
  return {
    measured: { width, height },
    internals: { positionAbsolute: { x, y } },
  } as InternalNode;
}

describe('centerOf', () => {
  it('devolve o centro do nó, não o canto', () => {
    // Card de 180x60 na origem: o centro fica no miolo, e é dali que a linha
    // sai para sumir por baixo do card.
    expect(centerOf(fakeNode(0, 0, 180, 60), 999, 999)).toEqual([90, 30]);
  });

  it('soma a posição absoluta', () => {
    expect(centerOf(fakeNode(320, 220, 180, 60), 999, 999)).toEqual([410, 250]);
  });

  it('cai para a coordenada do handle enquanto o nó não foi medido', () => {
    expect(centerOf(fakeNode(0, 0), 42, 7)).toEqual([42, 7]);
    expect(centerOf(fakeNode(0, 0, 180, undefined), 42, 7)).toEqual([42, 7]);
    expect(centerOf(undefined, 42, 7)).toEqual([42, 7]);
  });

  it('trata dimensão zero como não medido', () => {
    expect(centerOf(fakeNode(10, 10, 0, 0), 42, 7)).toEqual([42, 7]);
  });
});

/**
 * O desvio E5: com posições fixas a curva inverte quando o alvo troca de lado,
 * saindo pela direita e voltando por trás. Cada par abaixo é uma direção de
 * arraste — a saída tem que apontar sempre para o alvo.
 */
describe('autoPositions', () => {
  it('alvo à direita sai pela direita', () => {
    expect(autoPositions(0, 0, 200, 0)).toEqual([Position.Right, Position.Left]);
  });

  it('alvo à esquerda sai pela esquerda', () => {
    expect(autoPositions(200, 0, 0, 0)).toEqual([Position.Left, Position.Right]);
  });

  it('alvo abaixo sai por baixo', () => {
    expect(autoPositions(0, 0, 0, 200)).toEqual([Position.Bottom, Position.Top]);
  });

  it('alvo acima sai por cima', () => {
    expect(autoPositions(0, 200, 0, 0)).toEqual([Position.Top, Position.Bottom]);
  });

  it('escolhe o eixo de maior deslocamento na diagonal', () => {
    expect(autoPositions(0, 0, 200, 50)).toEqual([Position.Right, Position.Left]);
    expect(autoPositions(0, 0, 50, 200)).toEqual([Position.Bottom, Position.Top]);
  });

  it('empate resolve no eixo horizontal', () => {
    expect(autoPositions(0, 0, 100, 100)).toEqual([Position.Right, Position.Left]);
  });

  it('nós sobrepostos não quebram', () => {
    expect(autoPositions(0, 0, 0, 0)).toEqual([Position.Right, Position.Left]);
  });
});
