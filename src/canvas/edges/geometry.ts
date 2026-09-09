import { InternalNode, Position } from '@xyflow/react';

/**
 * Geometria da aresta, separada do componente para poder ser testada sem
 * montar o React Flow inteiro. As duas funcoes daqui sao o que corrige os
 * desvios E3/E4 (linha saindo do vazio) e E5 (curvatura invertendo).
 */

/**
 * Centro do no em coordenadas do fluxo.
 *
 * `positionAbsolute` em vez de `node.position` porque o segundo e relativo ao
 * pai quando o no esta aninhado. Sem `measured` (primeiro render, antes do
 * ResizeObserver medir) cai para a coordenada do handle, que e o que o React
 * Flow ja tinha calculado — a aresta nasce no lugar aproximado e se acerta no
 * frame seguinte, em vez de saltar do canto (0,0).
 */
export function centerOf(node: InternalNode | undefined, fallbackX: number, fallbackY: number): [number, number] {
  const { width, height } = node?.measured ?? {};
  if (!node || !width || !height) {
    return [fallbackX, fallbackY];
  }

  return [node.internals.positionAbsolute.x + width / 2, node.internals.positionAbsolute.y + height / 2];
}

/**
 * Forma do elemento vista pela aresta. E tudo o que ela precisa saber para
 * descobrir onde o proprio traco deixa de ser visivel.
 */
export type EdgeEndpoint =
  { shape: 'rect'; halfWidth: number; halfHeight: number } | { shape: 'circle'; radius: number };

/**
 * O point e recortado como circulo porque **e** um circulo.
 *
 * Trata-lo como caixa deixaria ate 2,9px de fresta na diagonal (`r * (raiz(2) -
 * 1)` sobre um raio de 7), que num alvo de 14px e um quinto do diametro. Nos
 * cards a caixa serve: o raio do tema e 6px e o `autoPositions` faz a aresta
 * chegar quase perpendicular a uma face, nunca na diagonal de um canto.
 */
export function endpointOf(node: InternalNode | undefined): EdgeEndpoint | undefined {
  const { width, height } = node?.measured ?? {};
  if (!node || !width || !height) {
    return undefined;
  }

  return node.type === 'pointNode'
    ? { shape: 'circle', radius: width / 2 }
    : { shape: 'rect', halfWidth: width / 2, halfHeight: height / 2 };
}

/**
 * Distancia do centro do elemento ate a borda, na direcao dada.
 *
 * As duas formas sao centralmente simetricas, entao o sentido do vetor nao
 * importa — dai os modulos. Para o retangulo e o corte classico de raio contra
 * caixa: a face que limita e a que o raio alcanca primeiro.
 */
export function boundaryDistance(endpoint: EdgeEndpoint, ux: number, uy: number): number {
  if (endpoint.shape === 'circle') {
    return endpoint.radius;
  }

  const x = Math.abs(ux);
  const y = Math.abs(uy);

  // Direcao puramente vertical ou horizontal: a outra face nunca e alcancada, e
  // a divisao por zero viraria `Infinity` no `Math.min`.
  if (x === 0) {
    return endpoint.halfHeight;
  }
  if (y === 0) {
    return endpoint.halfWidth;
  }

  return Math.min(endpoint.halfWidth / x, endpoint.halfHeight / y);
}

/**
 * Recorta o segmento centro-a-centro no trecho que de fato se ve.
 *
 * A aresta e desenhada de centro a centro (ver `TopoEdge`), entao um pedaco dela
 * fica enterrado sob cada elemento. Quando os dois pedacos sao **desiguais** — um
 * card de 180px ligado a um point de 14px — o meio do caminho inteiro nao e o
 * meio do vao visivel: ele erra por `(origem - destino) / 2`, ou 41px nesse
 * exemplo, sempre empurrando o rotulo para perto do elemento maior.
 *
 * Recortar resolve na origem, em vez de compensar depois: o `labelX/labelY` que
 * o React Flow devolve junto com o path passa a ser do caminho visivel, e vale
 * igual para reta e para curva. De brinde, as particulas da animacao `flow`
 * deixam de viajar por baixo dos cards.
 *
 * Elementos sobrepostos (ou perto demais) fazem as duas bordas se cruzarem, e o
 * trecho visivel seria negativo — a aresta inverteria e desenharia lixo. Nesse
 * caso devolve o segmento inteiro, que e exatamente o comportamento anterior.
 */
export function trimToBoundaries(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  source: EdgeEndpoint | undefined,
  target: EdgeEndpoint | undefined
): [number, number, number, number] {
  const dx = tx - sx;
  const dy = ty - sy;
  const length = Math.hypot(dx, dy);

  if (length === 0) {
    return [sx, sy, tx, ty];
  }

  const ux = dx / length;
  const uy = dy / length;

  const fromStart = source ? boundaryDistance(source, ux, uy) : 0;
  const fromEnd = target ? boundaryDistance(target, ux, uy) : 0;

  if (fromStart + fromEnd >= length) {
    return [sx, sy, tx, ty];
  }

  return [sx + ux * fromStart, sy + uy * fromStart, tx - ux * fromEnd, ty - uy * fromEnd];
}

/**
 * Lados de saida e entrada da curva, derivados do eixo dominante.
 *
 * Posicoes fixas fariam a curvatura inverter quando o alvo passasse para o
 * outro lado do no de origem — a alca sairia para a direita e voltaria por
 * tras, cruzando o canvas. Escolher o eixo de maior deslocamento mantem a
 * curva sempre "para frente", em qualquer direcao de arraste.
 *
 * O empate (`>=`) resolve no eixo horizontal por ser o sentido em que os cards
 * de 180x60 mais se afastam.
 */
export function autoPositions(sx: number, sy: number, tx: number, ty: number): [Position, Position] {
  const dx = tx - sx;
  const dy = ty - sy;

  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? [Position.Right, Position.Left] : [Position.Left, Position.Right];
  }
  return dy >= 0 ? [Position.Bottom, Position.Top] : [Position.Top, Position.Bottom];
}
