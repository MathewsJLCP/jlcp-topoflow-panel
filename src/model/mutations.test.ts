import { defaultTopology } from './defaults';
import {
  addElement,
  canConnect,
  connect,
  duplicateElement,
  findEdgeBetween,
  moveElements,
  removeElements,
  reorderElement,
  reverseEdge,
  updateEdge,
} from './mutations';
import { topologySchema } from './schema';
import { ElementKind, Topology } from './types';

const kinds: ElementKind[] = ['node', 'point', 'postit', 'text'];

describe('addElement', () => {
  it.each(kinds)('cria um %s na posicao pedida', (kind) => {
    const next = addElement(defaultTopology, kind, { x: 10, y: 20 });
    const created = allElements(next).find((item) => !allElements(defaultTopology).some((old) => old.id === item.id));

    expect(created?.position).toEqual({ x: 10, y: 20 });
  });

  it('nasce na frente dos existentes', () => {
    const next = addElement(defaultTopology, 'node', { x: 0, y: 0 });
    const zIndexes = allElements(next).map((item) => item.zIndex);

    expect(Math.max(...zIndexes)).toBe(next.nodes[next.nodes.length - 1].zIndex);
  });

  it('nao reaproveita id de elemento existente, mesmo de outro tipo', () => {
    let topology = defaultTopology;
    for (let i = 0; i < 5; i++) {
      topology = addElement(topology, 'node', { x: i, y: i });
    }

    const ids = allElements(topology).map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('produz uma topologia que passa pelo schema', () => {
    const next = kinds.reduce((acc, kind) => addElement(acc, kind, { x: 0, y: 0 }), defaultTopology);
    expect(topologySchema.safeParse(next).success).toBe(true);
  });
});

describe('removeElements', () => {
  it('remove o elemento e as arestas que dependiam dele', () => {
    // 'edge-router' e origem das duas arestas do exemplo.
    const next = removeElements(defaultTopology, ['edge-router']);

    expect(next.nodes.map((n) => n.id)).not.toContain('edge-router');
    expect(next.edges).toHaveLength(0);
  });

  it('preserva arestas nao relacionadas', () => {
    const next = removeElements(defaultTopology, ['app-server']);
    expect(next.edges.map((e) => e.id)).toEqual(['edge-router__db-server']);
  });
});

describe('duplicateElement', () => {
  it('copia com id novo e deslocamento', () => {
    const next = duplicateElement(defaultTopology, 'app-server');
    const original = defaultTopology.nodes.find((n) => n.id === 'app-server')!;
    const copy = next.nodes[next.nodes.length - 1];

    expect(copy.id).not.toBe(original.id);
    expect(copy.position.x).toBeGreaterThan(original.position.x);
    expect(copy.presentation).toEqual(original.presentation);
  });

  it('nao herda as arestas do original', () => {
    const next = duplicateElement(defaultTopology, 'app-server');
    expect(next.edges).toEqual(defaultTopology.edges);
  });

  it('ignora id inexistente', () => {
    expect(duplicateElement(defaultTopology, 'nao-existe')).toBe(defaultTopology);
  });
});

describe('moveElements', () => {
  it('atualiza posicoes de tipos diferentes de uma vez', () => {
    const next = moveElements(defaultTopology, [
      { id: 'app-server', position: { x: 1, y: 2 } },
      { id: 'datacenter', position: { x: 3, y: 4 } },
      { id: 'titulo', position: { x: 5, y: 6 } },
    ]);

    expect(next.nodes.find((n) => n.id === 'app-server')?.position).toEqual({ x: 1, y: 2 });
    expect(next.postits.find((p) => p.id === 'datacenter')?.position).toEqual({ x: 3, y: 4 });
    expect(next.texts.find((t) => t.id === 'titulo')?.position).toEqual({ x: 5, y: 6 });
  });

  it('devolve a mesma referencia quando nao ha o que mover', () => {
    expect(moveElements(defaultTopology, [])).toBe(defaultTopology);
  });
});

describe('reorderElement', () => {
  it('trazer para frente deixa o elemento com o maior zIndex', () => {
    const next = reorderElement(defaultTopology, 'datacenter', 'front');
    const target = next.postits.find((p) => p.id === 'datacenter')!;
    const others = allElements(next).filter((item) => item.id !== 'datacenter');

    expect(Math.max(...others.map((o) => o.zIndex))).toBeLessThan(target.zIndex);
  });

  it('enviar para tras deixa o elemento com o menor zIndex', () => {
    const next = reorderElement(defaultTopology, 'app-server', 'back');
    const target = next.nodes.find((n) => n.id === 'app-server')!;
    const others = allElements(next).filter((item) => item.id !== 'app-server');

    expect(Math.min(...others.map((o) => o.zIndex))).toBeGreaterThan(target.zIndex);
  });

  it('mantem os zIndex sem empate e sem buraco', () => {
    // Os defaults nascem todos com zIndex 0; a primeira reordenacao normaliza.
    const next = reorderElement(defaultTopology, 'edge-router', 'front');
    const zIndexes = allElements(next)
      .map((item) => item.zIndex)
      .sort((a, b) => a - b);

    expect(zIndexes).toEqual(zIndexes.map((_, index) => index));
  });

  it('nao mexe em nada quando o elemento ja esta na ponta', () => {
    // 'titulo' e o ultimo na ordem de desempate, entao 'front' e no-op.
    expect(reorderElement(defaultTopology, 'titulo', 'front')).toBe(defaultTopology);
  });

  it('avancar move exatamente uma posicao', () => {
    const before = ordered(defaultTopology);
    const target = before[1];
    const after = ordered(reorderElement(defaultTopology, target, 'forward'));

    expect(after[2]).toBe(target);
  });
});

describe('connect', () => {
  const semArestas: Topology = { ...defaultTopology, edges: [] };

  it('cria a aresta entre dois nós', () => {
    const next = connect(semArestas, 'edge-router', 'app-server');

    expect(next.edges).toHaveLength(1);
    expect(next.edges[0]).toMatchObject({ source: 'edge-router', target: 'app-server', animation: 'none' });
  });

  it('a aresta nova nasce reta, fina e sem cor', () => {
    const next = connect(semArestas, 'edge-router', 'app-server');

    // `straight` e o padrao do projeto; `curved` e opcao. E `color: {}` percorre
    // a cadeia ate o neutro — aresta nova nunca nasce branca.
    expect(next.edges[0]).toMatchObject({ shape: 'straight', width: 1.5, color: {} });
  });

  it('rejeita auto-conexão em silêncio', () => {
    expect(connect(semArestas, 'app-server', 'app-server')).toBe(semArestas);
  });

  it('rejeita par já conectado, em qualquer sentido', () => {
    expect(connect(defaultTopology, 'edge-router', 'app-server')).toBe(defaultTopology);
    expect(connect(defaultTopology, 'app-server', 'edge-router')).toBe(defaultTopology);
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

  it('canConnect recusa par já ligado em qualquer sentido', () => {
    expect(canConnect(defaultTopology, 'edge-router', 'app-server')).toBe(false);
    expect(canConnect(defaultTopology, 'app-server', 'edge-router')).toBe(false);
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
    const next = updateEdge(defaultTopology, 'edge-router__app-server', { style: 'dashed', animation: 'dash-flow' });

    expect(next.edges[0]).toMatchObject({ style: 'dashed', animation: 'dash-flow' });
    expect(next.edges[1]).toEqual(defaultTopology.edges[1]);
  });
});

describe('animation nos dados antigos', () => {
  it('aresta salva sem `animation` continua validando', () => {
    // Retrocompatibilidade de `schemaVersion: 1`: o `.default` do schema cobre.
    const { animation, ...semAnimacao } = defaultTopology.edges[0];
    const parsed = topologySchema.safeParse({ ...defaultTopology, edges: [semAnimacao] });

    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.edges[0].animation).toBe('none');
  });
});

function allElements(topology: Topology) {
  return [...topology.nodes, ...topology.points, ...topology.postits, ...topology.texts];
}

function ordered(topology: Topology): string[] {
  return allElements(topology)
    .sort((a, b) => a.zIndex - b.zIndex)
    .map((item) => item.id);
}

describe('reverseEdge e findEdgeBetween', () => {
  const id = defaultTopology.edges[0].id;

  it('troca as pontas preservando o resto da aresta', () => {
    const antes = defaultTopology.edges[0];
    const depois = reverseEdge(defaultTopology, id).edges[0];

    expect(depois).toMatchObject({ source: antes.target, target: antes.source, id: antes.id });
    expect(depois.shape).toBe(antes.shape);
    expect(depois.width).toBe(antes.width);
  });

  it('inverter duas vezes volta ao original', () => {
    expect(reverseEdge(reverseEdge(defaultTopology, id), id)).toEqual(defaultTopology);
  });

  it('id inexistente não altera nada', () => {
    expect(reverseEdge(defaultTopology, 'nao-existe')).toBe(defaultTopology);
  });

  it('findEdgeBetween acha o par nos dois sentidos', () => {
    expect(findEdgeBetween(defaultTopology, 'edge-router', 'app-server')?.id).toBe(id);
    expect(findEdgeBetween(defaultTopology, 'app-server', 'edge-router')?.id).toBe(id);
    expect(findEdgeBetween(defaultTopology, 'app-server', 'db-server')).toBeUndefined();
  });
});
