import { useMemo } from 'react';
import { DataFrame } from '@grafana/data';

import { Topology } from '../model/types';
import { EDGE_Z_INDEX, NODE_Z_OFFSET, POSTIT_Z_OFFSET, TopoFlowEdge, TopoFlowNode } from './flowTypes';
import { Parallel } from './edges/path';

/** Converte a topologia do modelo nos arrays que o React Flow consome. */
export function useFlowElements(
  topology: Topology,
  frames: DataFrame[],
  editable: boolean
): { nodes: TopoFlowNode[]; edges: TopoFlowEdge[] } {
  return useMemo(
    () => ({ nodes: toFlowNodes(topology, frames, editable), edges: toFlowEdges(topology, frames, editable) }),
    [topology, frames, editable]
  );
}

export function toFlowNodes(topology: Topology, frames: DataFrame[], editable: boolean): TopoFlowNode[] {
  return [
    ...topology.postits.map((element): TopoFlowNode => ({
      id: element.id,
      type: 'postitNode',
      position: element.position,
      data: { element, editable },
      zIndex: POSTIT_Z_OFFSET + element.zIndex,
      // `width`/`height` do no, e nao `style`: sao os atributos que o
      // `NodeResizer` escreve ao arrastar a alca. Em `style` a dimensao
      // inline venceria a do resize e o postit nao mudaria de tamanho.
      width: element.size.width,
      height: element.size.height,
    })),
    ...topology.nodes.map((element): TopoFlowNode => ({
      id: element.id,
      type: 'deviceNode',
      position: element.position,
      data: { element, frames, editable },
      zIndex: element.zIndex + NODE_Z_OFFSET,
      // `minHeight`, nao `height`: `size.height` e piso, e o card cresce
      // quando o titulo quebra em varias linhas. Com altura fixa o nome
      // seria truncado, que era o desvio N4.
      style: { width: element.size.width, minHeight: element.size.height },
    })),
    ...topology.points.map((element): TopoFlowNode => ({
      id: element.id,
      type: 'pointNode',
      position: element.position,
      data: { element, frames, editable },
      zIndex: element.zIndex + NODE_Z_OFFSET,
    })),
    ...topology.texts.map((element): TopoFlowNode => ({
      id: element.id,
      type: 'textNode',
      position: element.position,
      data: { element, frames, editable },
      zIndex: element.zIndex + NODE_Z_OFFSET,
    })),
    ...topology.images.map((element): TopoFlowNode => ({
      id: element.id,
      type: 'imageNode',
      position: element.position,
      data: { element, frames, editable },
      zIndex: element.zIndex + NODE_Z_OFFSET,
      // `width`/`height` como no postit, e nao `style`: sao os atributos que o
      // `NodeResizer` escreve ao arrastar a alca.
      width: element.size.width,
      height: element.size.height,
    })),
  ];
}

export function toFlowEdges(topology: Topology, frames: DataFrame[], editable: boolean): TopoFlowEdge[] {
  const parallels = parallelIndex(topology.edges);
  return topology.edges.map((element) => ({
    id: element.id,
    type: 'topoEdge',
    source: element.source,
    target: element.target,
    data: { element, frames, editable, parallel: parallels.get(element.id) },
    zIndex: EDGE_Z_INDEX,
  }));
}

/**
 * Conexoes entre o mesmo par de elementos, em qualquer sentido, se afastam umas
 * das outras (`edges/path.ts`). Aqui cada uma ganha a posicao dela no grupo, na
 * ordem da topologia, e o sentido em relacao ao canonico do par (id menor ->
 * id maior) — assim o afastamento nao inverte quando uma delas e invertida.
 */
export function parallelIndex(edges: Topology['edges']): Map<string, Parallel> {
  const keyOf = (edge: Topology['edges'][number]) => [edge.source, edge.target].sort().join('\u0000');
  const groups = new Map<string, string[]>();
  for (const edge of edges) {
    groups.set(keyOf(edge), [...(groups.get(keyOf(edge)) ?? []), edge.id]);
  }

  const out = new Map<string, Parallel>();
  for (const edge of edges) {
    const ids = groups.get(keyOf(edge))!;
    out.set(edge.id, { index: ids.indexOf(edge.id), count: ids.length, canonical: edge.source < edge.target });
  }
  return out;
}
