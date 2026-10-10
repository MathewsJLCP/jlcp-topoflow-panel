import { NodeChange } from '@xyflow/react';

import { TopoFlowNode } from './flowTypes';
import { groupChanges, snapPoint, snapPosition } from './grouping';

const device = (id: string, x: number, y: number): TopoFlowNode =>
  ({
    id,
    type: 'deviceNode',
    position: { x, y },
    measured: { width: 184, height: 64 },
    data: {},
  }) as unknown as TopoFlowNode;

const postit = (id: string, x: number, y: number): TopoFlowNode =>
  ({
    id,
    type: 'postitNode',
    position: { x, y },
    measured: { width: 250, height: 170 },
    data: {},
  }) as unknown as TopoFlowNode;

const image = (id: string, x: number, y: number): TopoFlowNode =>
  ({
    id,
    type: 'imageNode',
    position: { x, y },
    // A medida inclui a legenda; o encaixe usa a caixa da figura.
    measured: { width: 96, height: 130 },
    data: { element: { size: { width: 96, height: 96 } } },
  }) as unknown as TopoFlowNode;

describe('snapPosition', () => {
  it('o nó encaixa pelo centro, que é de onde a conexão sai', () => {
    const at = snapPosition(device('a', 0, 0), { x: 3, y: 5 }, 16);

    expect((at.x + 92) % 16).toBe(0);
    expect((at.y + 32) % 16).toBe(0);
  });

  it('a imagem encaixa pelo centro da figura, não da legenda', () => {
    const at = snapPosition(image('i', 0, 0), { x: 10, y: 10 }, 16);

    expect((at.x + 48) % 16).toBe(0);
    expect((at.y + 48) % 16).toBe(0);
  });

  it('postit encaixa pelo canto, como sempre', () => {
    expect(snapPosition(postit('p', 0, 0), { x: 9, y: 23 }, 16)).toEqual({ x: 16, y: 16 });
  });

  /** O caso relatado: centros no mesmo eixo do grid dão uma conexão reta. */
  it('nó e imagem na mesma linha do grid ficam com os centros alinhados', () => {
    // Centros soltos a 132 e 130: os dois pousam na linha 128 do grid.
    const a = snapPosition(device('a', 0, 0), { x: 0, y: 100 }, 16);
    const b = snapPosition(image('i', 0, 0), { x: 300, y: 82 }, 16);

    expect(a.y + 32).toBe(b.y + 48);
  });
});

describe('snapPoint', () => {
  it('encaixa o vértice no grid', () => {
    expect(snapPoint({ x: 37, y: 9 }, 16)).toEqual({ x: 32, y: 16 });
  });

  it('sem grid, fica onde foi solto', () => {
    expect(snapPoint({ x: 37, y: 9 }, undefined)).toEqual({ x: 37, y: 9 });
  });
});

describe('groupChanges', () => {
  const nodes = [device('a', 0, 0), device('b', 200, 0), device('c', 400, 0)];
  const groups = new Map([
    ['a', 'group-1'],
    ['b', 'group-1'],
  ]);

  const positions = (changes: Array<NodeChange<TopoFlowNode>>) =>
    Object.fromEntries(
      changes.flatMap((change) => (change.type === 'position' && change.position ? [[change.id, change.position]] : []))
    );

  it('selecionar um membro seleciona o grupo inteiro', () => {
    const out = groupChanges([{ type: 'select', id: 'a', selected: true }], nodes, groups, undefined);

    expect(out).toEqual(
      expect.arrayContaining([
        { type: 'select', id: 'a', selected: true },
        { type: 'select', id: 'b', selected: true },
      ])
    );
    expect(out.some((change) => 'id' in change && change.id === 'c')).toBe(false);
  });

  it('no mesmo lote, a seleção vence a desseleção', () => {
    const out = groupChanges(
      [
        { type: 'select', id: 'a', selected: false },
        { type: 'select', id: 'b', selected: true },
      ],
      nodes,
      groups,
      undefined
    );

    expect(out.filter((change) => change.type === 'select')).toEqual([
      { type: 'select', id: 'a', selected: true },
      { type: 'select', id: 'b', selected: true },
    ]);
  });

  /** Primeiro arraste: o React Flow só arrasta quem está sob o ponteiro. */
  it('arrastar um membro move os outros pelo mesmo deslocamento', () => {
    const out = groupChanges(
      [{ type: 'position', id: 'a', position: { x: 30, y: 40 }, dragging: true }],
      nodes,
      groups,
      undefined
    );

    expect(positions(out)).toEqual({ a: { x: 30, y: 40 }, b: { x: 230, y: 40 } });
  });

  it('com o grid, o líder encaixa e o grupo segue rígido', () => {
    const out = groupChanges(
      [
        { type: 'position', id: 'a', position: { x: 31, y: 41 }, dragging: true },
        { type: 'position', id: 'b', position: { x: 233, y: 39 }, dragging: true },
      ],
      nodes,
      groups,
      16
    );
    const moved = positions(out);

    expect(moved.b.x - moved.a.x).toBe(200);
    expect(moved.b.y - moved.a.y).toBe(0);
    expect((moved.a.x + 92) % 16).toBe(0);
  });

  it('elemento fora de grupo só encaixa no grid', () => {
    const out = groupChanges(
      [{ type: 'position', id: 'c', position: { x: 403, y: 7 }, dragging: true }],
      nodes,
      groups,
      16
    );

    expect(Object.keys(positions(out))).toEqual(['c']);
    expect((positions(out).c.x + 92) % 16).toBe(0);
  });

  it('mudanças que não são de seleção nem de posição passam intactas', () => {
    const change: NodeChange<TopoFlowNode> = { type: 'remove', id: 'a' };

    expect(groupChanges([change], nodes, groups, 16)).toEqual([change]);
  });
});
