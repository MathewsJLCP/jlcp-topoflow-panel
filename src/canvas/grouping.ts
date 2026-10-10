import { NodeChange, NodePositionChange, NodeSelectionChange, XYPosition } from '@xyflow/react';

import { TopoFlowNode } from './flowTypes';

/**
 * O que o canvas faz com as mudancas do React Flow antes de aplica-las: grupos
 * (selecao e arraste juntos) e o encaixe no grid.
 *
 * Funcoes puras sobre `NodeChange`, sem React — o jsdom nao faz hit-testing, e
 * esta e a parte do gesto que da para testar sem browser.
 */

/** Tipos que aceitam conexao: encaixam pelo **centro**, que e de onde a linha sai. */
const CENTER_SNAPPED = new Set(['deviceNode', 'pointNode', 'imageNode']);

/**
 * Onde o elemento pousa, com o grid ligado.
 *
 * Os conectaveis (no, point, imagem) encaixam pelo **centro**: a conexao sai do
 * centro de cada ponta, e encaixar o canto deixava dois elementos de tamanhos
 * diferentes "alinhados" no grid com a linha entre eles torta — um card de 184px
 * e um point de 16px, lado a lado na mesma linha do grid, tinham os centros 24px
 * fora de prumo. Com o centro no grid, duas pontas na mesma linha dele sempre
 * produzem uma conexao reta.
 *
 * Postit e texto nao conectam, e encaixam pelo canto, como sempre.
 *
 * Da Imagem vale a caixa da figura (`size`), e nao a medida do no: a legenda faz
 * parte do no, mas a linha sai do centro da figura.
 */
export function snapPosition(node: TopoFlowNode | undefined, position: XYPosition, grid: number): XYPosition {
  const snap = (v: number) => Math.round(v / grid) * grid;

  if (!node || !CENTER_SNAPPED.has(node.type ?? '')) {
    return { x: snap(position.x), y: snap(position.y) };
  }

  const { width, height } = boxOf(node);
  if (!width || !height) {
    return { x: snap(position.x), y: snap(position.y) };
  }

  return {
    x: snap(position.x + width / 2) - width / 2,
    y: snap(position.y + height / 2) - height / 2,
  };
}

function boxOf(node: TopoFlowNode): { width?: number; height?: number } {
  if (node.type === 'imageNode') {
    return node.data.element.size;
  }
  return { width: node.measured?.width ?? node.width, height: node.measured?.height ?? node.height };
}

/** Encaixa um ponto solto (vertice de conexao) no grid. */
export function snapPoint(point: XYPosition, grid: number | undefined): XYPosition {
  if (!grid) {
    return point;
  }
  return { x: Math.round(point.x / grid) * grid, y: Math.round(point.y / grid) * grid };
}

const isPosition = (change: NodeChange<TopoFlowNode>): change is NodePositionChange => change.type === 'position';
const isSelect = (change: NodeChange<TopoFlowNode>): change is NodeSelectionChange => change.type === 'select';

/**
 * Reescreve as mudancas para que **o grupo se comporte como um elemento so**.
 *
 *   - **Selecao**: selecionar qualquer membro seleciona o grupo inteiro; tirar a
 *     selecao de um tira de todos. Quando um mesmo lote seleciona e desseleciona
 *     membros (clicar num membro enquanto outro estava selecionado sozinho),
 *     vence a selecao — e o que o clique pediu.
 *   - **Arraste**: o primeiro membro do lote e o lider; ele encaixa no grid, e
 *     todos os membros andam o mesmo deslocamento dele. Encaixar cada um por
 *     conta propria desmontaria o arranjo do grupo aos poucos. O lote pode trazer
 *     so o membro arrastado — no primeiro arraste o React Flow ainda nao viu a
 *     selecao do grupo e so arrasta quem esta sob o ponteiro —, e por isso os
 *     demais sao movidos aqui, e nao deixados para ele.
 *
 * Elemento fora de grupo so encaixa no grid (`grid` ausente = grid desligado).
 */
export function groupChanges(
  changes: Array<NodeChange<TopoFlowNode>>,
  current: TopoFlowNode[],
  groups: Map<string, string>,
  grid: number | undefined
): Array<NodeChange<TopoFlowNode>> {
  const byId = new Map(current.map((node) => [node.id, node]));
  const members = new Map<string, string[]>();
  for (const [id, groupId] of groups) {
    if (byId.has(id)) {
      members.set(groupId, [...(members.get(groupId) ?? []), id]);
    }
  }

  // --- selecao ---
  const selecting = new Set<string>();
  const deselecting = new Set<string>();
  for (const change of changes) {
    if (!isSelect(change)) {
      continue;
    }
    const groupId = groups.get(change.id);
    if (groupId) {
      (change.selected ? selecting : deselecting).add(groupId);
    }
  }
  const selectionGroups = new Set([...selecting, ...deselecting]);

  // --- arraste ---
  const leaders = new Map<string, NodePositionChange>();
  for (const change of changes) {
    const groupId = isPosition(change) && change.position ? groups.get(change.id) : undefined;
    if (groupId && !leaders.has(groupId)) {
      leaders.set(groupId, change as NodePositionChange);
    }
  }

  const out: Array<NodeChange<TopoFlowNode>> = [];

  for (const change of changes) {
    const groupId = 'id' in change ? groups.get(change.id) : undefined;

    if (isSelect(change) && groupId && selectionGroups.has(groupId)) {
      continue;
    }
    if (isPosition(change) && change.position && groupId && leaders.has(groupId)) {
      continue;
    }
    if (isPosition(change) && change.position && grid) {
      out.push({ ...change, position: snapPosition(byId.get(change.id), change.position, grid) });
      continue;
    }
    out.push(change);
  }

  for (const groupId of selectionGroups) {
    const selected = selecting.has(groupId);
    for (const id of members.get(groupId) ?? []) {
      out.push({ type: 'select', id, selected });
    }
  }

  for (const [groupId, leader] of leaders) {
    const node = byId.get(leader.id);
    if (!node || !leader.position) {
      continue;
    }
    const target = grid ? snapPosition(node, leader.position, grid) : leader.position;
    const dx = target.x - node.position.x;
    const dy = target.y - node.position.y;
    for (const id of members.get(groupId) ?? []) {
      const member = byId.get(id);
      if (!member) {
        continue;
      }
      out.push({
        type: 'position',
        id,
        position: { x: member.position.x + dx, y: member.position.y + dy },
        dragging: leader.dragging,
      });
    }
  }

  return out;
}
