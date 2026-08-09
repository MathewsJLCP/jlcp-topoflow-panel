import { XYPosition } from '@xyflow/react';

import { DEFAULT_EDGE_WIDTH, DEVICE_NODE_HEIGHT, DEVICE_NODE_WIDTH, POSTIT_DEFAULT } from './sizes';
import { ELEMENT_COLLECTION, ElementKind, TopoEdge, TopoNode, TopoPoint, TopoPostit, TopoText, Topology } from './types';

/**
 * Mutacoes puras da topologia: recebem e devolvem `Topology`, sem tocar em
 * React nem em `panel.options`. Quem persiste e o painel (ADR: `options.topology`
 * e a unica fonte da verdade).
 */

const NODE_SIZE = { width: DEVICE_NODE_WIDTH, height: DEVICE_NODE_HEIGHT };
const POSTIT_SIZE = { width: POSTIT_DEFAULT.width, height: POSTIT_DEFAULT.height };

/**
 * Elemento novo nasce **sem cor**.
 *
 * `{}` percorre a cadeia do Anexo A ate o nivel 3 e renderiza neutro. O valor
 * anterior era `{ fixed: 'text' }`, e `'text'` e um nome de cor valido do
 * Grafana que resolve para `text.primary` — quase branco no dark. Um no
 * recem-arrastado nao pode parecer "OK" nem "erro" antes de ter binding.
 */
const NO_COLOR = {} as const;

/** Ids curtos e legiveis. Nao precisam ser globalmente unicos, so unicos aqui. */
function makeId(kind: ElementKind, topology: Topology): string {
  const taken = new Set(collectIds(topology));
  for (let i = 1; ; i++) {
    const id = `${kind}-${i}`;
    if (!taken.has(id)) {
      return id;
    }
  }
}

function collectIds(topology: Topology): string[] {
  return [
    ...topology.nodes.map((n) => n.id),
    ...topology.points.map((p) => p.id),
    ...topology.postits.map((p) => p.id),
    ...topology.texts.map((t) => t.id),
  ];
}

/** Maior zIndex em uso, para que o elemento novo nasca na frente. */
function topZIndex(topology: Topology): number {
  const all = [...topology.nodes, ...topology.points, ...topology.postits, ...topology.texts];
  return all.reduce((max, item) => Math.max(max, item.zIndex), 0);
}

export function addElement(topology: Topology, kind: ElementKind, position: XYPosition): Topology {
  const id = makeId(kind, topology);
  const zIndex = topZIndex(topology) + 1;

  switch (kind) {
    case 'node': {
      const node: TopoNode = {
        id,
        position,
        size: NODE_SIZE,
        presentation: { primaryText: { mode: 'fixed', fixed: id } },
        color: NO_COLOR,
        zIndex,
      };
      return { ...topology, nodes: [...topology.nodes, node] };
    }
    case 'point': {
      const point: TopoPoint = { id, position, color: NO_COLOR, zIndex };
      return { ...topology, points: [...topology.points, point] };
    }
    case 'postit': {
      // O postit e a excecao: nasce com acento explicito. Ele nao sinaliza
      // estado, agrupa — e um retangulo sem cor nenhuma some no fundo.
      const postit: TopoPostit = {
        id,
        position,
        size: POSTIT_SIZE,
        title: 'Grupo',
        color: 'blue',
        opacity: 0.12,
        borderStyle: 'solid',
        zIndex,
      };
      return { ...topology, postits: [...topology.postits, postit] };
    }
    case 'text': {
      const text: TopoText = {
        id,
        position,
        content: { mode: 'fixed', fixed: 'Texto' },
        color: NO_COLOR,
        fontSize: 14,
        zIndex,
      };
      return { ...topology, texts: [...topology.texts, text] };
    }
  }
}

/**
 * Remove elementos e as arestas que ficariam penduradas.
 *
 * O `parse.ts` ja descartaria essas arestas na proxima leitura, mas deixar
 * lixo salvo no JSON do dashboard e diferente de nunca escreve-lo.
 */
export function removeElements(topology: Topology, ids: string[]): Topology {
  const doomed = new Set(ids);
  const keep = <T extends { id: string }>(items: T[]) => items.filter((item) => !doomed.has(item.id));

  return {
    nodes: keep(topology.nodes),
    points: keep(topology.points),
    postits: keep(topology.postits),
    texts: keep(topology.texts),
    edges: topology.edges.filter(
      (edge) => !doomed.has(edge.id) && !doomed.has(edge.source) && !doomed.has(edge.target)
    ),
  };
}

const DUPLICATE_OFFSET = 24;

export function duplicateElement(topology: Topology, id: string): Topology {
  const found = findElement(topology, id);
  if (!found) {
    return topology;
  }

  const { kind, element } = found;
  const collection = ELEMENT_COLLECTION[kind];
  const copy = {
    ...element,
    id: makeId(kind, topology),
    position: { x: element.position.x + DUPLICATE_OFFSET, y: element.position.y + DUPLICATE_OFFSET },
    zIndex: topZIndex(topology) + 1,
  };

  // A copia nao herda arestas: ligar o clone as mesmas pontas quase nunca e o
  // que se quer, e desfazer isso da mais trabalho do que refazer as conexoes.
  return { ...topology, [collection]: [...topology[collection], copy] } as Topology;
}

export type PositionUpdate = { id: string; position: XYPosition };

export function moveElements(topology: Topology, updates: PositionUpdate[]): Topology {
  if (updates.length === 0) {
    return topology;
  }

  const byId = new Map(updates.map((update) => [update.id, update.position]));
  const move = <T extends { id: string; position: XYPosition }>(items: T[]) =>
    items.map((item) => {
      const position = byId.get(item.id);
      return position ? { ...item, position } : item;
    });

  return {
    ...topology,
    nodes: move(topology.nodes),
    points: move(topology.points),
    postits: move(topology.postits),
    texts: move(topology.texts),
  };
}

export function resizeElement(topology: Topology, id: string, size: { width: number; height: number }): Topology {
  const found = findElement(topology, id);
  if (!found || (found.kind !== 'node' && found.kind !== 'postit')) {
    return topology;
  }

  const collection = ELEMENT_COLLECTION[found.kind];
  return {
    ...topology,
    [collection]: topology[collection].map((item) => (item.id === id ? { ...item, size } : item)),
  } as Topology;
}

/**
 * Um helper por tipo em vez de um generico sobre `ElementKind`: assim o `patch`
 * e checado contra o tipo certo, e um campo de no nao entra num postit.
 */
function patch<T extends { id: string }>(items: T[], id: string, changes: Partial<T>): T[] {
  return items.map((item) => (item.id === id ? { ...item, ...changes } : item));
}

export function updateNode(topology: Topology, id: string, changes: Partial<TopoNode>): Topology {
  return { ...topology, nodes: patch(topology.nodes, id, changes) };
}

export function updatePoint(topology: Topology, id: string, changes: Partial<TopoPoint>): Topology {
  return { ...topology, points: patch(topology.points, id, changes) };
}

export function updatePostit(topology: Topology, id: string, changes: Partial<TopoPostit>): Topology {
  return { ...topology, postits: patch(topology.postits, id, changes) };
}

export function updateText(topology: Topology, id: string, changes: Partial<TopoText>): Topology {
  return { ...topology, texts: patch(topology.texts, id, changes) };
}

export function updateEdge(topology: Topology, id: string, changes: Partial<TopoEdge>): Topology {
  return { ...topology, edges: patch(topology.edges, id, changes) };
}

/**
 * Troca as pontas da aresta.
 *
 * Sem seta o efeito e invisivel hoje, mas o sentido ja e o que decide qual
 * ponta e origem quando a aresta ganhar `markerEnd` — e e o que o Inspector
 * mostra. Inverter aqui evita ter de apagar e recriar a conexao.
 */
export function reverseEdge(topology: Topology, id: string): Topology {
  const edge = topology.edges.find((item) => item.id === id);
  if (!edge) {
    return topology;
  }

  return updateEdge(topology, id, { source: edge.target, target: edge.source });
}

/**
 * True quando `source` e `target` podem ser ligados.
 *
 * Exportado porque o modo Linkar precisa da mesma resposta ANTES do clique,
 * para realcar alvos validos e marcar os invalidos com `not-allowed`.
 * Duplicar a regra na camada de UI seria a forma mais rapida de a validacao e o
 * realce discordarem.
 */
export function canConnect(topology: Topology, source: string, target: string): boolean {
  if (source === target) {
    return false;
  }

  // Postits e textos nunca conectam.
  const connectable = new Set([...topology.nodes, ...topology.points].map((item) => item.id));
  if (!connectable.has(source) || !connectable.has(target)) {
    return false;
  }

  return findEdgeBetween(topology, source, target) === undefined;
}

/** Aresta que ja liga o par, em qualquer sentido. */
export function findEdgeBetween(topology: Topology, a: string, b: string): TopoEdge | undefined {
  return topology.edges.find(
    (edge) => (edge.source === a && edge.target === b) || (edge.source === b && edge.target === a)
  );
}

/**
 * Cria uma conexao. Devolve a topologia inalterada quando a conexao nao faz
 * sentido — auto-conexao ou par ja ligado. Rejeitar em silencio (e nao com
 * erro) e o que o gesto de arrastar handle pede: o usuario ja ve que nao pegou.
 */
export function connect(topology: Topology, source: string, target: string): Topology {
  if (!canConnect(topology, source, target)) {
    return topology;
  }

  const edge: TopoEdge = {
    id: makeEdgeId(topology),
    source,
    target,
    style: 'solid',
    // `straight` e o padrao do projeto; `curved` e opcao no editor.
    shape: 'straight',
    color: NO_COLOR,
    width: DEFAULT_EDGE_WIDTH,
    animation: 'none',
  };

  return { ...topology, edges: [...topology.edges, edge] };
}

function makeEdgeId(topology: Topology): string {
  const taken = new Set(topology.edges.map((edge) => edge.id));

  // `crypto.randomUUID` exige contexto seguro; o painel roda em dashboards
  // servidos por http em ambiente interno, entao precisa de alternativa.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    const id = `edge-${crypto.randomUUID()}`;
    if (!taken.has(id)) {
      return id;
    }
  }

  for (let i = 1; ; i++) {
    const id = `edge-${i}`;
    if (!taken.has(id)) {
      return id;
    }
  }
}

export type OrderCommand = 'front' | 'back' | 'forward' | 'backward';

/**
 * Reordena reescrevendo os zIndex de todos os elementos em sequencia.
 *
 * Alternativa seria so mexer no zIndex do alvo, mas isso acumula buracos e
 * empates ao longo de varias operacoes ate a ordem virar imprevisivel.
 */
export function reorderElement(topology: Topology, id: string, command: OrderCommand): Topology {
  const ordered = [...topology.nodes, ...topology.points, ...topology.postits, ...topology.texts].sort(
    (a, b) => a.zIndex - b.zIndex
  );

  const from = ordered.findIndex((item) => item.id === id);
  if (from < 0) {
    return topology;
  }

  const to = {
    front: ordered.length - 1,
    back: 0,
    forward: Math.min(from + 1, ordered.length - 1),
    backward: Math.max(from - 1, 0),
  }[command];

  if (to === from) {
    return topology;
  }

  const [moved] = ordered.splice(from, 1);
  ordered.splice(to, 0, moved);

  const zIndexById = new Map(ordered.map((item, index) => [item.id, index]));
  const restamp = <T extends { id: string; zIndex: number }>(items: T[]) =>
    items.map((item) => ({ ...item, zIndex: zIndexById.get(item.id) ?? item.zIndex }));

  return {
    ...topology,
    nodes: restamp(topology.nodes),
    points: restamp(topology.points),
    postits: restamp(topology.postits),
    texts: restamp(topology.texts),
  };
}

export type FoundElement =
  | { kind: 'node'; element: TopoNode }
  | { kind: 'point'; element: TopoPoint }
  | { kind: 'postit'; element: TopoPostit }
  | { kind: 'text'; element: TopoText };

export function findElement(topology: Topology, id: string): FoundElement | undefined {
  const node = topology.nodes.find((item) => item.id === id);
  if (node) {
    return { kind: 'node', element: node };
  }
  const point = topology.points.find((item) => item.id === id);
  if (point) {
    return { kind: 'point', element: point };
  }
  const postit = topology.postits.find((item) => item.id === id);
  if (postit) {
    return { kind: 'postit', element: postit };
  }
  const text = topology.texts.find((item) => item.id === id);
  if (text) {
    return { kind: 'text', element: text };
  }
  return undefined;
}
