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
export function centerOf(
  node: InternalNode | undefined,
  fallbackX: number,
  fallbackY: number
): [number, number] {
  const { width, height } = node?.measured ?? {};
  if (!node || !width || !height) {
    return [fallbackX, fallbackY];
  }

  return [node.internals.positionAbsolute.x + width / 2, node.internals.positionAbsolute.y + height / 2];
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
