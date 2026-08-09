import { defaultCanvas, defaultTopology } from './defaults';
import { parseTopoFlowOptions } from './parse';

describe('parseTopoFlowOptions', () => {
  it('aceita opcoes validas sem reclamar', () => {
    const { options, issues } = parseTopoFlowOptions({
      schemaVersion: 1,
      topology: defaultTopology,
      canvas: { showGrid: false, snapToGrid: false, gridSize: 8 },
    });

    expect(issues).toEqual([]);
    expect(options.canvas.gridSize).toBe(8);
    expect(options.topology.nodes).toHaveLength(3);
  });

  it('usa os defaults em silencio quando as secoes estao ausentes', () => {
    // Estado de um painel recem-adicionado ao dashboard.
    const { options, issues } = parseTopoFlowOptions({});

    expect(issues).toEqual([]);
    expect(options.topology).toEqual(defaultTopology);
    expect(options.canvas).toEqual(defaultCanvas);
  });

  it('aceita options nao-objeto sem explodir', () => {
    expect(parseTopoFlowOptions(undefined).options.topology).toEqual(defaultTopology);
    expect(parseTopoFlowOptions(null).options.topology).toEqual(defaultTopology);
    expect(parseTopoFlowOptions('lixo').options.topology).toEqual(defaultTopology);
  });

  it('reporta e isola uma secao corrompida sem derrubar a outra', () => {
    const { options, issues } = parseTopoFlowOptions({
      topology: { nodes: 'nao é uma lista', edges: [] },
      canvas: { showGrid: false, snapToGrid: false, gridSize: 8 },
    });

    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain('topology');
    expect(options.topology).toEqual(defaultTopology);
    // A preferencia de canvas do usuario sobrevive ao erro na topologia.
    expect(options.canvas.gridSize).toBe(8);
  });

  it('descarta arestas penduradas em vez de rejeitar a topologia inteira', () => {
    const [node] = defaultTopology.nodes;
    const { options, issues } = parseTopoFlowOptions({
      topology: {
        nodes: [node],
        edges: [
          { ...defaultTopology.edges[0], target: 'no-que-nao-existe' },
          { ...defaultTopology.edges[1], source: node.id, target: node.id },
        ],
      },
    });

    expect(issues).toEqual([]);
    expect(options.topology.nodes).toHaveLength(1);
    expect(options.topology.edges).toHaveLength(1);
    expect(options.topology.edges[0].id).toBe(defaultTopology.edges[1].id);
  });

  it('descarta ids duplicados de no e de aresta', () => {
    const [node] = defaultTopology.nodes;
    const { options } = parseTopoFlowOptions({
      topology: {
        nodes: [node, { ...node, position: { x: 999, y: 999 } }],
        edges: [],
      },
    });

    expect(options.topology.nodes).toHaveLength(1);
    expect(options.topology.nodes[0].position).toEqual(node.position);
  });

  it('carimba a versao corrente do schema', () => {
    const { options } = parseTopoFlowOptions({ schemaVersion: 99 });
    expect(options.schemaVersion).toBe(1);
  });
});

describe('parseTopoFlowOptions — ícone do nó', () => {
  /** Ate o Bloco 3 exibir o icone era o unico comportamento possivel. */
  it('nó salvo antes do toggle continua exibindo o ícone', () => {
    const [node] = defaultTopology.nodes;
    const { showIcon, ...semFlag } = node.presentation;
    const { options, issues } = parseTopoFlowOptions({
      topology: { nodes: [{ ...node, presentation: semFlag }], edges: [] },
    });

    expect(issues).toEqual([]);
    expect(options.topology.nodes[0].presentation.showIcon).toBe(true);
  });

  it('respeita o toggle desligado', () => {
    const [node] = defaultTopology.nodes;
    const { options } = parseTopoFlowOptions({
      topology: { nodes: [{ ...node, presentation: { ...node.presentation, showIcon: false } }], edges: [] },
    });

    expect(options.topology.nodes[0].presentation.showIcon).toBe(false);
  });

  /**
   * A chave e string livre no schema: um icone que deixe de existir nao pode
   * invalidar a topologia inteira. Quem resolve o fallback e `resolveTopoIcon`.
   */
  it('aceita chave de ícone desconhecida sem reclamar', () => {
    const [node] = defaultTopology.nodes;
    const { options, issues } = parseTopoFlowOptions({
      topology: { nodes: [{ ...node, presentation: { ...node.presentation, icon: 'sitemap' } }], edges: [] },
    });

    expect(issues).toEqual([]);
    expect(options.topology.nodes[0].presentation.icon).toBe('sitemap');
  });
});

/**
 * O binding de trigger entrou como campo opcional justamente para nao precisar
 * de migrador. Estes testes sao o que prova isso — se um dia alguem trocar por
 * um `discriminatedUnion`, e aqui que a topologia salva quebra.
 */
describe('parseTopoFlowOptions — binding de trigger', () => {
  it('carrega topologia salva antes da feature sem tocar em nada', () => {
    const { options, issues } = parseTopoFlowOptions({ topology: defaultTopology });

    expect(issues).toEqual([]);
    expect(options.topology).toEqual(defaultTopology);
    expect(options.topology.nodes[0]).not.toHaveProperty('trigger');
  });

  it('aceita o vinculo e assume `enabled: false` quando a flag falta', () => {
    const [node] = defaultTopology.nodes;
    const { options, issues } = parseTopoFlowOptions({
      topology: { nodes: [{ ...node, trigger: { host: 'AGLIN-FW-STARTI' } }], edges: [] },
    });

    expect(issues).toEqual([]);
    expect(options.topology.nodes[0].trigger).toEqual({ enabled: false, host: 'AGLIN-FW-STARTI' });
  });

  it('preserva o vinculo completo, inclusive o `refId` ainda nao exposto na UI', () => {
    const [node] = defaultTopology.nodes;
    const trigger = { enabled: true, host: 'AGLIN-FW-STARTI', name: 'Unavailable by ICMP ping', refId: 'B' };
    const { options } = parseTopoFlowOptions({
      topology: { nodes: [{ ...node, trigger }], edges: [] },
    });

    expect(options.topology.nodes[0].trigger).toEqual(trigger);
  });

  /**
   * Modo trigger desligado nao pode levar a configuracao junto: e o que faz
   * alternar Metrica <-> Trigger sobreviver a um save (criterio de aceite 1).
   */
  it('mantem a config de metrica e a de trigger lado a lado', () => {
    const [node] = defaultTopology.nodes;
    const { options } = parseTopoFlowOptions({
      topology: {
        nodes: [
          {
            ...node,
            color: { field: 'cpu' },
            value: { field: 'cpu' },
            trigger: { enabled: false, host: 'AGLIN-FW-STARTI' },
          },
        ],
        edges: [],
      },
    });

    const parsed = options.topology.nodes[0];
    expect(parsed.color).toEqual({ field: 'cpu' });
    expect(parsed.value).toEqual({ field: 'cpu' });
    expect(parsed.trigger).toEqual({ enabled: false, host: 'AGLIN-FW-STARTI' });
  });
});
