import { InternalNode, Position } from '@xyflow/react';

import { EdgeEndpoint, autoPositions, boundaryDistance, centerOf, endpointOf, trimToBoundaries } from './geometry';

/** Só os campos que a geometria lê; o resto do `InternalNode` não importa aqui. */
function fakeNode(x: number, y: number, width?: number, height?: number): InternalNode {
  return {
    measured: { width, height },
    internals: { positionAbsolute: { x, y } },
  } as InternalNode;
}

/** O point tem 14px de diâmetro e é o único nó recortado como círculo. */
function pointNode(x: number, y: number): InternalNode {
  return { ...fakeNode(x, y, 14, 14), type: 'pointNode' } as InternalNode;
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

describe('endpointOf', () => {
  it('o point vira círculo, com raio de metade do diâmetro', () => {
    expect(endpointOf(pointNode(0, 0))).toEqual({ shape: 'circle', radius: 7 });
  });

  it('o card vira retângulo, com as duas meias-extensões', () => {
    expect(endpointOf(fakeNode(0, 0, 180, 60))).toEqual({ shape: 'rect', halfWidth: 90, halfHeight: 30 });
  });

  /** Sem medida não há borda a calcular, e a aresta usa o caminho inteiro. */
  it('nó ainda não medido não tem forma', () => {
    expect(endpointOf(fakeNode(0, 0))).toBeUndefined();
    expect(endpointOf(undefined)).toBeUndefined();
  });
});

describe('boundaryDistance', () => {
  const card: EdgeEndpoint = { shape: 'rect', halfWidth: 90, halfHeight: 30 };

  it('no círculo é sempre o raio, em qualquer direção', () => {
    const point: EdgeEndpoint = { shape: 'circle', radius: 7 };

    expect(boundaryDistance(point, 1, 0)).toBe(7);
    expect(boundaryDistance(point, 0.6, 0.8)).toBe(7);
  });

  it('no retângulo, a face limitante é a que o raio alcança primeiro', () => {
    // Na horizontal manda a largura; na vertical, a altura.
    expect(boundaryDistance(card, 1, 0)).toBe(90);
    expect(boundaryDistance(card, 0, 1)).toBe(30);
  });

  /** Sentido não importa: as duas formas são centralmente simétricas. */
  it('é indiferente ao sentido do vetor', () => {
    expect(boundaryDistance(card, -1, 0)).toBe(90);
    expect(boundaryDistance(card, 0, -1)).toBe(30);
  });

  it('na diagonal de 45° o limite é a altura, que é a menor', () => {
    const meio = Math.SQRT1_2;

    expect(boundaryDistance(card, meio, meio)).toBeCloseTo(30 / meio);
  });
});

/**
 * O bug do rótulo colado: a aresta vai de centro a centro, então um pedaço dela
 * fica enterrado sob cada elemento. Com pedaços desiguais, o meio do caminho
 * inteiro não é o meio do vão visível.
 */
describe('trimToBoundaries', () => {
  const card: EdgeEndpoint = { shape: 'rect', halfWidth: 90, halfHeight: 30 };
  const point: EdgeEndpoint = { shape: 'circle', radius: 7 };

  it('recorta cada ponta na borda do seu elemento', () => {
    // Card em x=0, point em x=400, na horizontal.
    expect(trimToBoundaries(0, 0, 400, 0, card, point)).toEqual([90, 0, 393, 0]);
  });

  /**
   * O caso da imagem: card de 180 ligado a um point de 14. O meio do caminho
   * inteiro fica em 200; o meio do vão visível, em 241,5 — os 41,5px de erro
   * que empurravam o rótulo para cima do card.
   */
  it('move o meio para longe do elemento maior', () => {
    const [fromX, , toX] = trimToBoundaries(0, 0, 400, 0, card, point);

    expect((fromX + toX) / 2).toBeCloseTo(241.5);
    expect((0 + 400) / 2).toBe(200);
  });

  it('com elementos do mesmo tamanho, o meio não se move', () => {
    const [fromX, , toX] = trimToBoundaries(0, 0, 400, 0, card, card);

    expect((fromX + toX) / 2).toBe(200);
  });

  it('recorta na diagonal seguindo a direção, não os eixos', () => {
    const [fromX, fromY] = trimToBoundaries(0, 0, 300, 400, point, point);

    // Direção (0.6, 0.8) a partir da origem, deslocada pelo raio de 7.
    expect(fromX).toBeCloseTo(4.2);
    expect(fromY).toBeCloseTo(5.6);
  });

  /**
   * A guarda. Elementos sobrepostos fariam as bordas se cruzarem e o trecho
   * visível ser negativo, invertendo a aresta. Devolver o segmento inteiro faz
   * o pior caso voltar a ser o comportamento anterior.
   */
  it('elementos sobrepostos devolvem o segmento inteiro', () => {
    expect(trimToBoundaries(0, 0, 100, 0, card, card)).toEqual([0, 0, 100, 0]);
  });

  it('elementos exatamente encostados também devolvem o inteiro', () => {
    // 90 + 90 = 180: as bordas se tocam, e não sobra vão nenhum.
    expect(trimToBoundaries(0, 0, 180, 0, card, card)).toEqual([0, 0, 180, 0]);
  });

  it('sobrepostos no mesmo ponto não dividem por zero', () => {
    expect(trimToBoundaries(50, 50, 50, 50, card, point)).toEqual([50, 50, 50, 50]);
  });

  /** Enquanto um dos nós não foi medido, aquela ponta não é recortada. */
  it('ponta sem forma fica no centro', () => {
    expect(trimToBoundaries(0, 0, 400, 0, undefined, point)).toEqual([0, 0, 393, 0]);
    expect(trimToBoundaries(0, 0, 400, 0, card, undefined)).toEqual([90, 0, 400, 0]);
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
