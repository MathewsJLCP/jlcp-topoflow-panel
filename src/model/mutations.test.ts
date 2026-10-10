import { STARTER_ICON_REF } from '../icons/registry';
import { sampleTopology } from './sampleTopology';
import {
  DEFAULT_BASE_COLOR,
  addElement,
  canConnect,
  connect,
  duplicateElement,
  findEdgeBetween,
  groupElements,
  groupMembers,
  groupOf,
  ungroupElements,
  moveElements,
  removeElements,
  resizeElement,
  reorderElement,
  reverseEdge,
  updateEdge,
  updateEdges,
  updatePoints,
} from './mutations';
import { topologySchema } from './schema';
import { ElementKind, TopoEdge, TopoPoint, Topology } from './types';
import { DEFAULT_EDGE_WIDTH, IMAGE_DEFAULT } from './sizes';

const kinds: ElementKind[] = ['node', 'point', 'postit', 'text', 'image'];

describe('addElement', () => {
  it.each(kinds)('cria um %s na posicao pedida', (kind) => {
    const next = addElement(sampleTopology, kind, { x: 10, y: 20 });
    const created = allElements(next).find((item) => !allElements(sampleTopology).some((old) => old.id === item.id));

    expect(created?.position).toEqual({ x: 10, y: 20 });
  });

  it('nasce na frente dos existentes', () => {
    const next = addElement(sampleTopology, 'node', { x: 0, y: 0 });
    const zIndexes = allElements(next).map((item) => item.zIndex);

    expect(Math.max(...zIndexes)).toBe(next.nodes[next.nodes.length - 1].zIndex);
  });

  it('nao reaproveita id de elemento existente, mesmo de outro tipo', () => {
    let topology = sampleTopology;
    for (let i = 0; i < 5; i++) {
      topology = addElement(topology, 'node', { x: i, y: i });
    }

    const ids = allElements(topology).map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('produz uma topologia que passa pelo schema', () => {
    const next = kinds.reduce((acc, kind) => addElement(acc, kind, { x: 0, y: 0 }), sampleTopology);
    expect(topologySchema.safeParse(next).success).toBe(true);
  });

  it('o nó nasce com o ícone Roteador e a Base verde', () => {
    const node = addElement(sampleTopology, 'node', { x: 0, y: 0 }).nodes.at(-1)!;

    expect(STARTER_ICON_REF).toBe('padrao/roteador');
    expect(node.presentation.icon).toBe(STARTER_ICON_REF);
    expect(node.color).toEqual({ fixed: DEFAULT_BASE_COLOR });
  });

  it('o point nasce com a Base verde; o texto, sem cor', () => {
    const next = addElement(addElement(sampleTopology, 'point', { x: 0, y: 0 }), 'text', { x: 0, y: 0 });

    expect(next.points.at(-1)!.color).toEqual({ fixed: DEFAULT_BASE_COLOR });
    expect(next.texts.at(-1)!.color).toEqual({});
  });
});

describe('groupElements e ungroupElements', () => {
  const [a, b, c] = sampleTopology.nodes.map((node) => node.id);

  it('junta os elementos num grupo novo', () => {
    const next = groupElements(sampleTopology, [a, b]);
    const groupId = groupOf(next).get(a)!;

    expect(groupId).toBe('group-1');
    expect(groupMembers(next, groupId)).toEqual([a, b]);
    expect(topologySchema.safeParse(next).success).toBe(true);
  });

  it('menos de dois elementos não forma grupo', () => {
    expect(groupElements(sampleTopology, [a])).toBe(sampleTopology);
    expect(groupElements(sampleTopology, [a, 'nao-existe'])).toBe(sampleTopology);
  });

  it('agrupar um membro com outro elemento traz o grupo antigo inteiro', () => {
    const once = groupElements(sampleTopology, [a, b]);
    const twice = groupElements(once, [b, c]);
    const groupId = groupOf(twice).get(c)!;

    expect(groupMembers(twice, groupId)).toEqual([a, b, c]);
    expect(new Set(groupOf(twice).values()).size).toBe(1);
  });

  it('desagrupar desfaz o grupo inteiro e apaga o campo', () => {
    const grouped = groupElements(sampleTopology, [a, b]);
    const next = ungroupElements(grouped, [b]);

    expect(groupOf(next).size).toBe(0);
    expect(next.nodes.every((node) => !('groupId' in node))).toBe(true);
  });

  it('desagrupar elemento sem grupo não muda nada', () => {
    expect(ungroupElements(sampleTopology, [a])).toBe(sampleTopology);
  });

  /** O bug relatado: editar a cópia não pode mexer no original. */
  it('a cópia não compartilha nenhum objeto com o original', () => {
    const original = sampleTopology.nodes[0];
    const copy = duplicateElement(sampleTopology, original.id).nodes.at(-1)!;

    expect(copy.presentation).toEqual(original.presentation);
    expect(copy.presentation).not.toBe(original.presentation);
    expect(copy.color).not.toBe(original.color);
    expect(copy.size).not.toBe(original.size);
  });

  it('a cópia de um membro nasce fora do grupo', () => {
    const grouped = groupElements(sampleTopology, [a, b]);
    const next = duplicateElement(grouped, a);

    expect(next.nodes.at(-1)!.groupId).toBeUndefined();
  });

  /** Retrocompatibilidade: elemento salvo antes do grupo nao tem o campo. */
  it('topologia sem groupId continua validando', () => {
    expect(topologySchema.safeParse(sampleTopology).success).toBe(true);
    expect(groupOf(sampleTopology).size).toBe(0);
  });
});

describe('removeElements', () => {
  it('remove o elemento e as arestas que dependiam dele', () => {
    // 'edge-router' e origem das duas arestas do exemplo.
    const next = removeElements(sampleTopology, ['edge-router']);

    expect(next.nodes.map((n) => n.id)).not.toContain('edge-router');
    expect(next.edges).toHaveLength(0);
  });

  it('preserva arestas nao relacionadas', () => {
    const next = removeElements(sampleTopology, ['app-server']);
    expect(next.edges.map((e) => e.id)).toEqual(['edge-router__db-server']);
  });
});

describe('duplicateElement', () => {
  it('copia com id novo e deslocamento', () => {
    const next = duplicateElement(sampleTopology, 'app-server');
    const original = sampleTopology.nodes.find((n) => n.id === 'app-server')!;
    const copy = next.nodes[next.nodes.length - 1];

    expect(copy.id).not.toBe(original.id);
    expect(copy.position.x).toBeGreaterThan(original.position.x);
    expect(copy.presentation).toEqual(original.presentation);
  });

  it('nao herda as arestas do original', () => {
    const next = duplicateElement(sampleTopology, 'app-server');
    expect(next.edges).toEqual(sampleTopology.edges);
  });

  it('ignora id inexistente', () => {
    expect(duplicateElement(sampleTopology, 'nao-existe')).toBe(sampleTopology);
  });
});

describe('moveElements', () => {
  it('atualiza posicoes de tipos diferentes de uma vez', () => {
    const next = moveElements(sampleTopology, [
      { id: 'app-server', position: { x: 1, y: 2 } },
      { id: 'datacenter', position: { x: 3, y: 4 } },
      { id: 'titulo', position: { x: 5, y: 6 } },
    ]);

    expect(next.nodes.find((n) => n.id === 'app-server')?.position).toEqual({ x: 1, y: 2 });
    expect(next.postits.find((p) => p.id === 'datacenter')?.position).toEqual({ x: 3, y: 4 });
    expect(next.texts.find((t) => t.id === 'titulo')?.position).toEqual({ x: 5, y: 6 });
  });

  it('devolve a mesma referencia quando nao ha o que mover', () => {
    expect(moveElements(sampleTopology, [])).toBe(sampleTopology);
  });
});

/**
 * `resizeElement` existia desde o commit inicial sem nunca ser chamado: a alca
 * de redimensionamento do postit nao estava ligada ao canvas. Estes casos fixam
 * o contrato agora que o `NodeResizer` a alimenta.
 */
describe('resizeElement', () => {
  const [postit] = sampleTopology.postits;

  it('grava o tamanho novo no postit', () => {
    const next = resizeElement(sampleTopology, postit.id, { width: 400, height: 300 });

    expect(next.postits[0].size).toEqual({ width: 400, height: 300 });
  });

  it('não toca nos demais campos do elemento', () => {
    const next = resizeElement(sampleTopology, postit.id, { width: 400, height: 300 });

    expect(next.postits[0]).toMatchObject({
      title: postit.title,
      color: postit.color,
      borderWidth: postit.borderWidth,
      position: postit.position,
    });
  });

  /** Point e texto não têm `size` no schema; pedir resize neles é no-op. */
  it('ignora elemento sem tamanho, devolvendo a topologia intacta', () => {
    const [text] = sampleTopology.texts;

    expect(resizeElement(sampleTopology, text.id, { width: 400, height: 300 })).toBe(sampleTopology);
  });

  it('ignora id inexistente', () => {
    expect(resizeElement(sampleTopology, 'fantasma', { width: 400, height: 300 })).toBe(sampleTopology);
  });

  /** O resultado precisa continuar validando: é ele que vai para `options`. */
  it('o resultado passa no schema', () => {
    const next = resizeElement(sampleTopology, postit.id, { width: 400, height: 300 });

    expect(topologySchema.safeParse(next).success).toBe(true);
  });
});

describe('reorderElement', () => {
  it('trazer para frente deixa o elemento com o maior zIndex', () => {
    const next = reorderElement(sampleTopology, 'datacenter', 'front');
    const target = next.postits.find((p) => p.id === 'datacenter')!;
    const others = allElements(next).filter((item) => item.id !== 'datacenter');

    expect(Math.max(...others.map((o) => o.zIndex))).toBeLessThan(target.zIndex);
  });

  it('enviar para tras deixa o elemento com o menor zIndex', () => {
    const next = reorderElement(sampleTopology, 'app-server', 'back');
    const target = next.nodes.find((n) => n.id === 'app-server')!;
    const others = allElements(next).filter((item) => item.id !== 'app-server');

    expect(Math.min(...others.map((o) => o.zIndex))).toBeGreaterThan(target.zIndex);
  });

  it('mantem os zIndex sem empate e sem buraco', () => {
    // Os defaults nascem todos com zIndex 0; a primeira reordenacao normaliza.
    const next = reorderElement(sampleTopology, 'edge-router', 'front');
    const zIndexes = allElements(next)
      .map((item) => item.zIndex)
      .sort((a, b) => a - b);

    expect(zIndexes).toEqual(zIndexes.map((_, index) => index));
  });

  it('nao mexe em nada quando o elemento ja esta na ponta', () => {
    // 'titulo' e o ultimo na ordem de desempate, entao 'front' e no-op.
    expect(reorderElement(sampleTopology, 'titulo', 'front')).toBe(sampleTopology);
  });

  it('avancar move exatamente uma posicao', () => {
    const before = ordered(sampleTopology);
    const target = before[1];
    const after = ordered(reorderElement(sampleTopology, target, 'forward'));

    expect(after[2]).toBe(target);
  });
});

describe('connect', () => {
  const semArestas: Topology = { ...sampleTopology, edges: [] };

  it('cria a aresta entre dois nós', () => {
    const next = connect(semArestas, 'edge-router', 'app-server');

    expect(next.edges).toHaveLength(1);
    expect(next.edges[0]).toMatchObject({ source: 'edge-router', target: 'app-server', animation: 'none' });
  });

  it('a aresta nova nasce reta, na espessura padrão e sem cor', () => {
    const next = connect(semArestas, 'edge-router', 'app-server');

    // `straight` e o padrao do projeto; `curved` e opcao. E `color: {}` percorre
    // a cadeia ate o neutro — aresta nova nunca nasce branca.
    expect(next.edges[0]).toMatchObject({ shape: 'straight', width: DEFAULT_EDGE_WIDTH, color: {} });
  });

  it('rejeita auto-conexão em silêncio', () => {
    expect(connect(semArestas, 'app-server', 'app-server')).toBe(semArestas);
  });

  it('rejeita par já conectado no mesmo sentido', () => {
    expect(connect(sampleTopology, 'edge-router', 'app-server')).toBe(sampleTopology);
  });

  /** A -> B e B -> A sao duas conexoes: dois enlaces, ou ida e volta. */
  it('aceita o sentido inverso de um par já conectado', () => {
    const next = connect(sampleTopology, 'app-server', 'edge-router');

    expect(next.edges).toHaveLength(sampleTopology.edges.length + 1);
    expect(next.edges.at(-1)).toMatchObject({ source: 'app-server', target: 'edge-router' });
    // E o inverso do inverso volta a ser recusado.
    expect(connect(next, 'app-server', 'edge-router')).toBe(next);
  });

  it('a conexão nova nasce com a Base verde', () => {
    const next = connect(semArestas, 'edge-router', 'app-server');

    expect(next.edges[0].color).toEqual({ fixed: DEFAULT_BASE_COLOR });
  });

  it('rejeita pontas que não aceitam conexão', () => {
    // Postits e textos nunca conectam.
    expect(connect(semArestas, 'edge-router', 'datacenter')).toBe(semArestas);
    expect(connect(semArestas, 'edge-router', 'titulo')).toBe(semArestas);
    expect(connect(semArestas, 'edge-router', 'nao-existe')).toBe(semArestas);
  });

  /**
   * `canConnect` é o que o modo Linkar consulta para realçar alvos. Se ele e o
   * `connect` discordarem, o usuário vê um alvo aceso que recusa o clique.
   */
  it('canConnect concorda com connect em todos os casos', () => {
    const casos: Array<[string, string]> = [
      ['edge-router', 'app-server'], // válido em `semArestas`
      ['app-server', 'app-server'], // self-link
      ['edge-router', 'datacenter'], // postit
      ['edge-router', 'titulo'], // texto
      ['edge-router', 'nao-existe'], // inexistente
    ];

    for (const [source, target] of casos) {
      const permitido = canConnect(semArestas, source, target);
      const mudou = connect(semArestas, source, target) !== semArestas;
      expect([source, target, permitido]).toEqual([source, target, mudou]);
    }
  });

  it('canConnect recusa par já ligado no mesmo sentido, e aceita o inverso', () => {
    expect(canConnect(sampleTopology, 'edge-router', 'app-server')).toBe(false);
    expect(canConnect(sampleTopology, 'app-server', 'edge-router')).toBe(true);
  });

  it('conecta point a nó', () => {
    const comPoint = addElement(semArestas, 'point', { x: 0, y: 0 });
    const pointId = comPoint.points[0].id;

    expect(connect(comPoint, pointId, 'app-server').edges).toHaveLength(1);
  });

  it('gera ids únicos entre arestas', () => {
    let topology = semArestas;
    topology = connect(topology, 'edge-router', 'app-server');
    topology = connect(topology, 'edge-router', 'db-server');
    topology = connect(topology, 'app-server', 'db-server');

    const ids = topology.edges.map((edge) => edge.id);
    expect(new Set(ids).size).toBe(3);
  });

  it('produz aresta que passa pelo schema', () => {
    const next = connect(semArestas, 'edge-router', 'app-server');
    expect(topologySchema.safeParse(next).success).toBe(true);
  });
});

describe('updateEdge', () => {
  it('altera estilo e animação sem tocar nas outras arestas', () => {
    const next = updateEdge(sampleTopology, 'edge-router__app-server', { style: 'dashed', animation: 'dash-flow' });

    expect(next.edges[0]).toMatchObject({ style: 'dashed', animation: 'dash-flow' });
    expect(next.edges[1]).toEqual(sampleTopology.edges[1]);
  });
});

describe('animation nos dados antigos', () => {
  it('aresta salva sem `animation` continua validando', () => {
    // Retrocompatibilidade de `schemaVersion: 1`: o `.default` do schema cobre.
    const { animation, ...semAnimacao } = sampleTopology.edges[0];
    const parsed = topologySchema.safeParse({ ...sampleTopology, edges: [semAnimacao] });

    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.edges[0].animation).toBe('none');
  });
});

function allElements(topology: Topology) {
  return [...topology.nodes, ...topology.points, ...topology.postits, ...topology.texts, ...topology.images];
}

function ordered(topology: Topology): string[] {
  return allElements(topology)
    .sort((a, b) => a.zIndex - b.zIndex)
    .map((item) => item.id);
}

/**
 * A imagem e o unico elemento que nasce **vazio** de proposito: o conteudo dela
 * e um arquivo, e o arquivo se escolhe no editor. O que estes casos protegem e
 * que ela nasce utilizavel mesmo assim — com tamanho, sem fundo e sem estado.
 */
describe('addElement — imagem', () => {
  const criada = (topology: Topology) => addElement(topology, 'image', { x: 10, y: 20 }).images.at(-1)!;

  it('nasce com a Figura na Biblioteca, no Roteador', () => {
    expect(criada(sampleTopology).src).toBe(STARTER_ICON_REF);
  });

  it('nasce com a Base verde', () => {
    expect(criada(sampleTopology).color).toEqual({ fixed: DEFAULT_BASE_COLOR });
  });

  /** O toggle desligado é o pedido: uma placa por padrão esconderia o PNG transparente. */
  it('nasce sem fundo e sem estado', () => {
    const image = criada(sampleTopology);

    expect(image.background).toBeUndefined();
    expect(image.trigger).toBeUndefined();
    expect(image.thresholds).toBeUndefined();
  });

  it('nasce com tamanho e proporção preservada', () => {
    const image = criada(sampleTopology);

    expect(image.size).toEqual({ width: IMAGE_DEFAULT.width, height: IMAGE_DEFAULT.height });
    expect(image.fit).toBe('contain');
  });

  it('o resultado passa no schema', () => {
    const next = addElement(sampleTopology, 'image', { x: 10, y: 20 });

    expect(topologySchema.safeParse(next).success).toBe(true);
  });
});

/** O pedido do cliente: a conexão tem de funcionar para a imagem também. */
describe('imagem conecta como nó e point', () => {
  const comImagem = addElement({ ...sampleTopology, edges: [] }, 'image', { x: 0, y: 0 });
  const imageId = comImagem.images[0].id;

  it('liga imagem a nó', () => {
    const next = connect(comImagem, 'edge-router', imageId);

    expect(next.edges).toHaveLength(1);
    expect(next.edges[0]).toMatchObject({ source: 'edge-router', target: imageId });
  });

  it('liga imagem a imagem', () => {
    const duas = addElement(comImagem, 'image', { x: 50, y: 0 });
    const outra = duas.images[1].id;

    expect(connect(duas, imageId, outra).edges).toHaveLength(1);
  });

  it('canConnect concorda com connect', () => {
    expect(canConnect(comImagem, 'edge-router', imageId)).toBe(true);
    // Postit continua fora, com imagem na outra ponta ou não.
    expect(canConnect(comImagem, imageId, 'datacenter')).toBe(false);
  });

  /** Apagar a imagem não pode deixar aresta pendurada no JSON salvo. */
  it('remover a imagem leva junto as arestas dela', () => {
    const ligada = connect(comImagem, 'edge-router', imageId);
    const next = removeElements(ligada, [imageId]);

    expect(next.images).toHaveLength(0);
    expect(next.edges).toHaveLength(0);
  });
});

describe('resizeElement — imagem', () => {
  const comImagem = addElement(sampleTopology, 'image', { x: 0, y: 0 });
  const imageId = comImagem.images[0].id;

  it('grava o tamanho novo', () => {
    const next = resizeElement(comImagem, imageId, { width: 200, height: 120 });

    expect(next.images[0].size).toEqual({ width: 200, height: 120 });
  });

  it('não toca no resto do elemento', () => {
    const next = resizeElement(comImagem, imageId, { width: 200, height: 120 });

    expect(next.images[0]).toMatchObject({ src: STARTER_ICON_REF, fit: 'contain', position: { x: 0, y: 0 } });
  });
});

describe('reverseEdge e findEdgeBetween', () => {
  const id = sampleTopology.edges[0].id;

  it('troca as pontas preservando o resto da aresta', () => {
    const antes = sampleTopology.edges[0];
    const depois = reverseEdge(sampleTopology, id).edges[0];

    expect(depois).toMatchObject({ source: antes.target, target: antes.source, id: antes.id });
    expect(depois.shape).toBe(antes.shape);
    expect(depois.width).toBe(antes.width);
  });

  it('inverter duas vezes volta ao original', () => {
    expect(reverseEdge(reverseEdge(sampleTopology, id), id)).toEqual(sampleTopology);
  });

  it('id inexistente não altera nada', () => {
    expect(reverseEdge(sampleTopology, 'nao-existe')).toBe(sampleTopology);
  });

  it('findEdgeBetween acha o par nos dois sentidos', () => {
    expect(findEdgeBetween(sampleTopology, 'edge-router', 'app-server')?.id).toBe(id);
    expect(findEdgeBetween(sampleTopology, 'app-server', 'edge-router')?.id).toBe(id);
    expect(findEdgeBetween(sampleTopology, 'app-server', 'db-server')).toBeUndefined();
  });
});

/**
 * O caminho por points cria uma aresta por segmento, e as quatro representam um
 * enlace so. `updateEdges` e o que permite configura-las juntas — e o `Partial`
 * e o que impede que isso vire "sobrescreva tudo com o retrato de uma delas".
 */
describe('updateEdges', () => {
  const base = (id: string, extras: Partial<TopoEdge> = {}): TopoEdge => ({
    ...sampleTopology.edges[0],
    id,
    ...extras,
  });

  const topology: Topology = {
    ...sampleTopology,
    edges: [base('a', { label: 'IN', width: 2 }), base('b', { label: 'OUT', width: 5 }), base('c')],
  };

  it('aplica a mesma mudanca as arestas pedidas', () => {
    const next = updateEdges(topology, ['a', 'b'], { style: 'dashed' });

    expect(next.edges.map((edge) => edge.style)).toEqual(['dashed', 'dashed', 'solid']);
  });

  it('nao toca no que nao foi pedido', () => {
    const next = updateEdges(topology, ['a', 'b'], { style: 'dashed' });

    // Rotulo e espessura sao de cada segmento; a edicao em massa nao os achata.
    expect(next.edges[0]).toMatchObject({ label: 'IN', width: 2 });
    expect(next.edges[1]).toMatchObject({ label: 'OUT', width: 5 });
  });

  it('ignora id que nao existe, em vez de criar aresta', () => {
    const next = updateEdges(topology, ['a', 'fantasma'], { style: 'dotted' });

    expect(next.edges).toHaveLength(3);
    expect(next.edges[0].style).toBe('dotted');
  });

  it('lista vazia nao muda nada', () => {
    expect(updateEdges(topology, [], { style: 'dotted' }).edges).toEqual(topology.edges);
  });
});

/** O outro lado do caminho: as ancoras entre os segmentos. */
describe('updatePoints', () => {
  const ponto = (id: string, extras: Partial<TopoPoint> = {}): TopoPoint => ({
    id,
    position: { x: 0, y: 0 },
    color: {},
    zIndex: 0,
    ...extras,
  });

  const topology: Topology = {
    ...sampleTopology,
    points: [ponto('p1', { color: { field: 'cpu' } }), ponto('p2'), ponto('p3')],
  };

  it('aplica a mesma mudanca aos points pedidos', () => {
    const next = updatePoints(topology, ['p1', 'p2'], { chart: true });

    expect(next.points.map((point) => point.chart)).toEqual([true, true, undefined]);
  });

  it('nao toca no que nao foi pedido', () => {
    const next = updatePoints(topology, ['p1', 'p2'], { chart: true });

    // O vinculo de metrica do primeiro sobrevive: so `chart` foi escrito.
    expect(next.points[0].color).toEqual({ field: 'cpu' });
  });

  /** Arestas e points sao colecoes distintas: mexer numa nao mexe na outra. */
  it('nao mexe nas arestas', () => {
    expect(updatePoints(topology, ['p1'], { chart: true }).edges).toEqual(topology.edges);
  });
});
