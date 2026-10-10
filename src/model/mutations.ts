import { XYPosition } from '@xyflow/react';

import { STARTER_ICON_REF } from '../icons/registry';
import { DEFAULT_EDGE_WIDTH, DEVICE_NODE_HEIGHT, DEVICE_NODE_WIDTH, IMAGE_DEFAULT, POSTIT_DEFAULT } from './sizes';
import {
  ELEMENT_COLLECTION,
  ElementKind,
  TopoEdge,
  TopoImage,
  TopoNode,
  TopoPoint,
  TopoPostit,
  TopoText,
  Topology,
} from './types';

/**
 * Mutacoes puras da topologia: recebem e devolvem `Topology`, sem tocar em
 * React nem em `panel.options`. Quem persiste e o painel (ADR: `options.topology`
 * e a unica fonte da verdade).
 */

const NODE_SIZE = { width: DEVICE_NODE_WIDTH, height: DEVICE_NODE_HEIGHT };
const POSTIT_SIZE = { width: POSTIT_DEFAULT.width, height: POSTIT_DEFAULT.height };
const IMAGE_SIZE = { width: IMAGE_DEFAULT.width, height: IMAGE_DEFAULT.height };

/**
 * Base com que no, point, imagem e conexao nascem: o verde de "OK" do mockup
 * (`ok`, `rgb(34, 197, 94)`).
 *
 * Ate a v1.4 o elemento nascia sem cor (`{}`), para nao parecer "OK" antes de
 * ter vinculo. A decisao foi revista a pedido do cliente: a Base so vale quando
 * nenhuma regra casa, e "sem dados" continua visivelmente diferente dela — a
 * cadeia de cor cai em `nodata` antes de chegar a Base. Hex, e nao o nome
 * `green`: o seletor de cor do Grafana desenharia o nome com o verde dele
 * (`#73BF69`), e a amostra no editor discordaria do elemento no canvas.
 *
 * Nunca `{ fixed: 'text' }`: `'text'` resolve para `text.primary`, quase branco
 * no dark.
 */
export const DEFAULT_BASE_COLOR = '#22C55E';
const BASE_COLOR = { fixed: DEFAULT_BASE_COLOR };

/** O texto continua nascendo sem cor: ele tem o proprio fallback (`tx2`). */
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
    ...topology.images.map((i) => i.id),
  ];
}

/** Maior zIndex em uso, para que o elemento novo nasca na frente. */
function topZIndex(topology: Topology): number {
  const all = [...topology.nodes, ...topology.points, ...topology.postits, ...topology.texts, ...topology.images];
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
        // O Roteador do pack Padrao: no sem icone nascia com o "desconhecido".
        presentation: { showIcon: true, icon: STARTER_ICON_REF, primaryText: { mode: 'fixed', fixed: id } },
        color: BASE_COLOR,
        zIndex,
      };
      return { ...topology, nodes: [...topology.nodes, node] };
    }
    case 'point': {
      const point: TopoPoint = { id, position, color: BASE_COLOR, zIndex };
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
        titlePosition: 'top-left',
        color: 'blue',
        opacity: 0.12,
        borderStyle: 'solid',
        borderWidth: 2,
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
    case 'image': {
      // Nasce com a Figura na **Biblioteca** (o Roteador): era o caso dominante,
      // e um placeholder vazio obrigava a trocar de modo toda vez. Nasce sem
      // fundo — o toggle desligado e o pedido, e uma placa por padrao
      // esconderia a transparencia que a maioria dos icones usa.
      const image: TopoImage = {
        id,
        position,
        size: IMAGE_SIZE,
        src: STARTER_ICON_REF,
        fit: 'contain',
        fontSize: IMAGE_DEFAULT.fontSize,
        color: BASE_COLOR,
        zIndex,
      };
      return { ...topology, images: [...topology.images, image] };
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
    images: keep(topology.images),
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
  // A copia nasce fora do grupo: entrar nele sozinha faria o original e o clone
  // andarem juntos sem ninguem ter pedido.
  //
  // Copia **profunda**: o espalhamento raso deixava a copia compartilhando com o
  // original cada objeto aninhado (vinculo, regras, metricas extras). Nenhuma
  // escrita do plugin altera objeto no lugar, mas uma copia que aponta para os
  // mesmos objetos e uma configuracao so com dois nomes — basta uma mutacao em
  // qualquer ponto do caminho para editar um mexer no outro. O modelo e JSON por
  // construcao (vive em `panel.options`), entao o ida-e-volta e exato.
  const { groupId: _group, ...rest } = JSON.parse(JSON.stringify(element)) as typeof element;
  const copy = {
    ...rest,
    id: makeId(kind, topology),
    position: { x: element.position.x + DUPLICATE_OFFSET, y: element.position.y + DUPLICATE_OFFSET },
    zIndex: topZIndex(topology) + 1,
  };

  // A copia nao herda arestas: ligar o clone as mesmas pontas quase nunca e o
  // que se quer, e desfazer isso da mais trabalho do que refazer as conexoes.
  return { ...topology, [collection]: [...topology[collection], copy] } as Topology;
}

/**
 * O id do elemento que `after` tem e `before` nao tinha — o recem-criado por
 * `addElement` ou `duplicateElement`. Quem duplica precisa dele para selecionar
 * a copia: deixar a selecao no original fazia o usuario editar o original
 * achando que editava a copia, que nasce por cima dele.
 */
export function addedElementId(before: Topology, after: Topology): string | undefined {
  const known = new Set(collectIds(before));
  return collectIds(after).find((id) => !known.has(id));
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

  const next = {
    ...topology,
    nodes: move(topology.nodes),
    points: move(topology.points),
    postits: move(topology.postits),
    texts: move(topology.texts),
    images: move(topology.images),
  };

  return { ...next, edges: carryWaypoints(topology, next) };
}

/**
 * Vertices acompanham a conexao quando as **duas** pontas andam juntas, pelo
 * mesmo deslocamento — arrastar um grupo inteiro nao pode deixar o trajeto para
 * tras. Com uma ponta so se movendo, o trajeto fica: e ele que o usuario
 * desenhou para contornar alguma coisa.
 */
function carryWaypoints(before: Topology, after: Topology): Topology['edges'] {
  const where = (topology: Topology) => {
    const map = new Map<string, XYPosition>();
    for (const items of [topology.nodes, topology.points, topology.images]) {
      for (const item of items) {
        map.set(item.id, item.position);
      }
    }
    return map;
  };
  const was = where(before);
  const is = where(after);

  return after.edges.map((edge) => {
    if (!edge.waypoints?.length) {
      return edge;
    }
    const [s0, s1, t0, t1] = [was.get(edge.source), is.get(edge.source), was.get(edge.target), is.get(edge.target)];
    if (!s0 || !s1 || !t0 || !t1) {
      return edge;
    }
    const dx = s1.x - s0.x;
    const dy = s1.y - s0.y;
    if ((!dx && !dy) || t1.x - t0.x !== dx || t1.y - t0.y !== dy) {
      return edge;
    }
    return { ...edge, waypoints: edge.waypoints.map((w) => ({ x: w.x + dx, y: w.y + dy })) };
  });
}

/**
 * Quem tem alca de redimensionamento. O point e sempre do mesmo diametro e o
 * texto e dimensionado pelo `fontSize` — arrastar alca neles nao teria onde
 * gravar.
 */
const RESIZABLE = new Set<ElementKind>(['node', 'postit', 'image']);

export function resizeElement(topology: Topology, id: string, size: { width: number; height: number }): Topology {
  const found = findElement(topology, id);
  if (!found || !RESIZABLE.has(found.kind)) {
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

export function updateImage(topology: Topology, id: string, changes: Partial<TopoImage>): Topology {
  return { ...topology, images: patch(topology.images, id, changes) };
}

export function updateEdge(topology: Topology, id: string, changes: Partial<TopoEdge>): Topology {
  return { ...topology, edges: patch(topology.edges, id, changes) };
}

/**
 * O mesmo `changes` em varios elementos de uma vez.
 *
 * Existe para o caminho por points: ligar A a B passando por tres ancoras cria
 * quatro conexoes **e** tres ancoras, e todas precisam da mesma configuracao —
 * mesma trigger, mesmos thresholds. Configura-las uma a uma nao e so
 * trabalhoso, e uma fonte de divergencia: basta esquecer um segmento para o
 * caminho acender pela metade, e o mapa passa a mentir.
 *
 * `changes` carrega **so os campos que o usuario mexeu**, e nao o elemento
 * inteiro. E o que permite alterar a espessura de quatro conexoes sem achatar
 * os rotulos, que sao diferentes em cada uma — ver `BulkForms`.
 */
function patchMany<T extends { id: string }>(items: T[], ids: string[], changes: Partial<T>): T[] {
  const alvos = new Set(ids);
  return items.map((item) => (alvos.has(item.id) ? { ...item, ...changes } : item));
}

export function updateEdges(topology: Topology, ids: string[], changes: Partial<TopoEdge>): Topology {
  return { ...topology, edges: patchMany(topology.edges, ids, changes) };
}

export function updatePoints(topology: Topology, ids: string[], changes: Partial<TopoPoint>): Topology {
  return { ...topology, points: patchMany(topology.points, ids, changes) };
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

  return updateEdge(topology, id, {
    source: edge.target,
    target: edge.source,
    // O trajeto vai da origem ao destino: invertido o sentido, inverte a ordem.
    ...(edge.waypoints?.length ? { waypoints: [...edge.waypoints].reverse() } : {}),
  });
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
  const connectable = new Set([...topology.nodes, ...topology.points, ...topology.images].map((item) => item.id));
  if (!connectable.has(source) || !connectable.has(target)) {
    return false;
  }

  // So o **mesmo sentido** e repetido: A -> B e B -> A sao duas conexoes (dois
  // enlaces, ou o caminho de ida e o de volta), e desenham como paralelas.
  return findEdge(topology, source, target) === undefined;
}

/** Aresta que liga o par **neste sentido**, da origem ao destino. */
export function findEdge(topology: Topology, source: string, target: string): TopoEdge | undefined {
  return topology.edges.find((edge) => edge.source === source && edge.target === target);
}

/** Aresta que ja liga o par, em qualquer sentido. */
export function findEdgeBetween(topology: Topology, a: string, b: string): TopoEdge | undefined {
  return topology.edges.find(
    (edge) => (edge.source === a && edge.target === b) || (edge.source === b && edge.target === a)
  );
}

/**
 * Cria uma conexao. Devolve a topologia inalterada quando a conexao nao faz
 * sentido — auto-conexao ou par ja ligado no mesmo sentido. Rejeitar em silencio (e nao com
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
    color: BASE_COLOR,
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
  const ordered = [
    ...topology.nodes,
    ...topology.points,
    ...topology.postits,
    ...topology.texts,
    ...topology.images,
  ].sort((a, b) => a.zIndex - b.zIndex);

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
    images: restamp(topology.images),
  };
}

export type FoundElement =
  | { kind: 'node'; element: TopoNode }
  | { kind: 'point'; element: TopoPoint }
  | { kind: 'postit'; element: TopoPostit }
  | { kind: 'text'; element: TopoText }
  | { kind: 'image'; element: TopoImage };

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
  const image = topology.images.find((item) => item.id === id);
  if (image) {
    return { kind: 'image', element: image };
  }
  return undefined;
}

/* --- Grupos ------------------------------------------------------------------ */

type Groupable = { id: string; groupId?: string };

function groupables(topology: Topology): Groupable[] {
  return [...topology.nodes, ...topology.points, ...topology.postits, ...topology.texts, ...topology.images];
}

/** O grupo de cada elemento agrupado, por id. */
export function groupOf(topology: Topology): Map<string, string> {
  const map = new Map<string, string>();
  for (const item of groupables(topology)) {
    if (item.groupId) {
      map.set(item.id, item.groupId);
    }
  }
  return map;
}

/** Ids dos elementos do grupo, na ordem da topologia. */
export function groupMembers(topology: Topology, groupId: string): string[] {
  return groupables(topology)
    .filter((item) => item.groupId === groupId)
    .map((item) => item.id);
}

function makeGroupId(topology: Topology): string {
  const taken = new Set(groupOf(topology).values());
  for (let i = 1; ; i++) {
    const id = `group-${i}`;
    if (!taken.has(id)) {
      return id;
    }
  }
}

function stampGroup(topology: Topology, ids: Set<string>, groupId: string | undefined): Topology {
  const stamp = <T extends Groupable>(items: T[]) =>
    items.map((item) => {
      if (!ids.has(item.id)) {
        return item;
      }
      // Desagrupar **apaga** o campo, e nao grava `undefined`: ausente e o
      // estado de quem nunca foi agrupado, e o JSON salvo continua igual ao de
      // antes do grupo.
      const next: T = { ...item };
      delete next.groupId;
      return groupId ? { ...next, groupId } : next;
    });

  return {
    ...topology,
    nodes: stamp(topology.nodes),
    points: stamp(topology.points),
    postits: stamp(topology.postits),
    texts: stamp(topology.texts),
    images: stamp(topology.images),
  };
}

/**
 * Junta os elementos num grupo novo.
 *
 * Quem ja estava num grupo **sai dele** para o novo, e o grupo antigo inteiro
 * vem junto: agrupar um elemento de um grupo com outro solto e, para quem
 * selecionou, juntar o que esta na tela — e o grupo antigo esta inteiro na tela,
 * porque o clique seleciona o grupo todo. Conexoes nao tem grupo: elas ja andam
 * com as pontas.
 *
 * Menos de dois elementos nao forma grupo, e a topologia volta inalterada.
 */
export function groupElements(topology: Topology, ids: string[]): Topology {
  const groups = groupOf(topology);
  const known = new Set(groupables(topology).map((item) => item.id));
  const members = new Set(ids.filter((id) => known.has(id)));

  for (const id of [...members]) {
    const groupId = groups.get(id);
    if (groupId) {
      groupMembers(topology, groupId).forEach((member) => members.add(member));
    }
  }

  if (members.size < 2) {
    return topology;
  }

  return stampGroup(topology, members, makeGroupId(topology));
}

/** Desfaz o grupo inteiro de cada elemento informado. */
export function ungroupElements(topology: Topology, ids: string[]): Topology {
  const groups = groupOf(topology);
  const doomed = new Set(ids.map((id) => groups.get(id)).filter((g): g is string => Boolean(g)));
  if (doomed.size === 0) {
    return topology;
  }

  const members = new Set<string>();
  for (const groupId of doomed) {
    groupMembers(topology, groupId).forEach((member) => members.add(member));
  }

  return stampGroup(topology, members, undefined);
}
