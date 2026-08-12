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

/**
 * Decisão D6: thresholds por elemento entraram como campo opcional, então uma
 * topologia salva antes deles carrega e continua sendo pintada pelo field.
 */
describe('parseTopoFlowOptions — thresholds do elemento', () => {
  const [node] = defaultTopology.nodes;

  it('nó salvo antes da feature carrega sem regra própria', () => {
    const { options, issues } = parseTopoFlowOptions({ topology: { nodes: [node], edges: [] } });

    expect(issues).toEqual([]);
    expect(options.topology.nodes[0].thresholds).toBeUndefined();
  });

  it('preserva as regras salvas', () => {
    const thresholds = { steps: [{ type: 'threshold', value: 90, color: 'red', label: 'crítico' }] };
    const { options, issues } = parseTopoFlowOptions({
      topology: { nodes: [{ ...node, thresholds }], edges: [] },
    });

    expect(issues).toEqual([]);
    expect(options.topology.nodes[0].thresholds).toEqual(thresholds);
  });

  /**
   * Regras salvas antes dos tipos novos não têm `type` e são todas threshold.
   * É o `z.preprocess` de `elementRuleSchema` que as resgata — um `.default()`
   * no discriminador não funcionaria, pelo mesmo motivo já documentado no
   * binding de trigger.
   */
  it('regra salva sem `type` carrega como threshold', () => {
    const { options, issues } = parseTopoFlowOptions({
      topology: {
        nodes: [{ ...node, thresholds: { steps: [{ value: 80, color: 'red', label: 'alto' }] } }],
        edges: [],
      },
    });

    expect(issues).toEqual([]);
    expect(options.topology.nodes[0].thresholds?.steps).toEqual([
      { type: 'threshold', value: 80, color: 'red', label: 'alto' },
    ]);
  });

  it('aceita os tipos vindos do Value mappings', () => {
    const steps = [
      { type: 'value', match: '200', color: 'green', label: 'UP' },
      { type: 'range', from: 1, to: 5, color: 'blue' },
      { type: 'regex', pattern: '^ERR', color: 'red' },
      { type: 'special', match: 'null', color: 'orange' },
    ];
    const { options, issues } = parseTopoFlowOptions({
      topology: { nodes: [{ ...node, thresholds: { steps } }], edges: [] },
    });

    expect(issues).toEqual([]);
    expect(options.topology.nodes[0].thresholds?.steps).toEqual(steps);
  });

  it('objeto sem `steps` vira lista vazia — que é o mesmo que não ter regra', () => {
    const { options } = parseTopoFlowOptions({
      topology: { nodes: [{ ...node, thresholds: {} }], edges: [] },
    });

    expect(options.topology.nodes[0].thresholds).toEqual({ steps: [] });
  });
});

/**
 * Bloco 3: `thresholds` chegou a arestas e points. O campo entrou `.optional()`,
 * entao `SCHEMA_VERSION` continua em 1 e nao existe migrador — o que estes casos
 * fixam e que essa aposta se sustenta nos dois sentidos: o que estava salvo
 * carrega intacto, e o que se salva agora sobrevive ao round-trip.
 */
describe('parseTopoFlowOptions — thresholds em aresta e point', () => {
  // As duas pontas, e nao so a origem: uma aresta sem os dois nos e descartada
  // pela integridade referencial da topologia, e o teste passaria a medir isso.
  const nodes = defaultTopology.nodes;
  const [edge] = defaultTopology.edges;
  const point = { id: 'ponto', position: { x: 0, y: 0 }, color: { fixed: 'blue' }, zIndex: 0 };

  it('aresta salva só com `color` carrega sem regra própria e sem perder a cor', () => {
    const salva = { ...edge, color: { fixed: 'purple' } };
    const { options, issues } = parseTopoFlowOptions({ topology: { nodes, edges: [salva] } });

    expect(issues).toEqual([]);
    // Sem regra propria o elemento segue o pipeline nativo, que era exatamente
    // o comportamento anterior — e `color.fixed` continua sendo o nivel 2.
    expect(options.topology.edges[0].thresholds).toBeUndefined();
    expect(options.topology.edges[0].color).toEqual({ fixed: 'purple' });
  });

  it('point salvo só com `color` carrega sem regra própria e sem perder a cor', () => {
    const { options, issues } = parseTopoFlowOptions({
      topology: { nodes: [], edges: [], points: [point] },
    });

    expect(issues).toEqual([]);
    expect(options.topology.points[0].thresholds).toBeUndefined();
    expect(options.topology.points[0].color).toEqual({ fixed: 'blue' });
  });

  it('preserva as regras de uma aresta', () => {
    const thresholds = { steps: [{ type: 'threshold', value: 1, color: 'red', label: 'down' }] };
    const { options, issues } = parseTopoFlowOptions({
      topology: { nodes, edges: [{ ...edge, thresholds }] },
    });

    expect(issues).toEqual([]);
    expect(options.topology.edges[0].thresholds).toEqual(thresholds);
  });

  it('preserva as regras de um point', () => {
    const thresholds = { steps: [{ type: 'special', match: 'null', color: 'orange' }] };
    const { options, issues } = parseTopoFlowOptions({
      topology: { nodes: [], edges: [], points: [{ ...point, thresholds }] },
    });

    expect(issues).toEqual([]);
    expect(options.topology.points[0].thresholds).toEqual(thresholds);
  });
});

/**
 * Bloco 6: o Texto perdeu a fonte de estado e ganhou background.
 *
 * A remoção do `trigger` não precisa de migrador porque o Zod descarta chave
 * desconhecida por padrão e nenhum schema daqui é `.strict()` — o texto salvo
 * carrega, e a chave só some do JSON no primeiro save seguinte.
 */
describe('parseTopoFlowOptions — texto', () => {
  const [text] = defaultTopology.texts;
  const carrega = (raw: object) =>
    parseTopoFlowOptions({ topology: { nodes: [], edges: [], texts: [raw] } });

  it('texto salvo com `trigger` carrega sem erro, e a chave é descartada', () => {
    const { options, issues } = carrega({ ...text, trigger: { enabled: true, host: 'AGLIN-FW-STARTI' } });

    expect(issues).toEqual([]);
    expect(options.topology.texts[0]).not.toHaveProperty('trigger');
    // O resto do texto atravessa intacto — é só o estado que saiu.
    expect(options.topology.texts[0].content).toEqual(text.content);
    expect(options.topology.texts[0].fontSize).toBe(text.fontSize);
  });

  it('texto salvo com `color.field` carrega — o campo fica no JSON, apenas inerte', () => {
    const { options, issues } = carrega({ ...text, color: { fixed: 'red', field: 'cpu_usage' } });

    expect(issues).toEqual([]);
    expect(options.topology.texts[0].color).toEqual({ fixed: 'red', field: 'cpu_usage' });
  });

  it('texto salvo antes do background carrega sem placa', () => {
    const { options, issues } = carrega(text);

    expect(issues).toEqual([]);
    expect(options.topology.texts[0].background).toBeUndefined();
  });

  it('preserva a placa salva', () => {
    const background = { color: 'blue', opacity: 0.3 };
    const { options, issues } = carrega({ ...text, background });

    expect(issues).toEqual([]);
    expect(options.topology.texts[0].background).toEqual(background);
  });

  it('rejeita opacidade fora da faixa em vez de gravar valor impossível', () => {
    const { issues } = carrega({ ...text, background: { color: 'blue', opacity: 4 } });

    expect(issues).toHaveLength(1);
  });
});

/** Campos novos do postit: ambos `.default`, então nada de migrador. */
/** Bloco B: `alert` entrou opcional nos três elementos que têm trigger. */
describe('parseTopoFlowOptions — animação de alerta', () => {
  const [node] = defaultTopology.nodes;
  const carrega = (alert: object) =>
    parseTopoFlowOptions({ topology: { nodes: [{ ...node, alert }], edges: [] } });

  it('elemento salvo antes da feature carrega parado', () => {
    const { options, issues } = parseTopoFlowOptions({ topology: { nodes: [node], edges: [] } });

    expect(issues).toEqual([]);
    expect(options.topology.nodes[0].alert).toBeUndefined();
  });

  it('preserva a animação salva', () => {
    const alert = { animation: 'radar', fromSeverity: 4 };
    const { options, issues } = carrega(alert);

    expect(issues).toEqual([]);
    expect(options.topology.nodes[0].alert).toEqual(alert);
  });

  /** Sem `fromSeverity`, anima qualquer alarme — é o default de quem só quer ver mexer. */
  it('sem `fromSeverity`, assume qualquer severidade', () => {
    const { options, issues } = carrega({ animation: 'pulse' });

    expect(issues).toEqual([]);
    expect(options.topology.nodes[0].alert?.fromSeverity).toBe(0);
  });

  it('rejeita animação desconhecida em vez de aceitar valor livre', () => {
    expect(carrega({ animation: 'girar' }).issues).toHaveLength(1);
  });

  /** No eixo de métrica a animação é campo da regra, não do elemento. */
  it('preserva a animação por regra', () => {
    const steps = [{ type: 'threshold', value: 90, color: 'red', animation: 'radar' }];
    const { options, issues } = parseTopoFlowOptions({
      topology: { nodes: [{ ...node, thresholds: { steps } }], edges: [] },
    });

    expect(issues).toEqual([]);
    expect(options.topology.nodes[0].thresholds?.steps).toEqual(steps);
  });

  it('regra sem animação carrega parada', () => {
    const steps = [{ type: 'threshold', value: 90, color: 'red' }];
    const { options } = parseTopoFlowOptions({
      topology: { nodes: [{ ...node, thresholds: { steps } }], edges: [] },
    });

    expect(options.topology.nodes[0].thresholds?.steps[0]).not.toHaveProperty('animation');
  });
});

/** Bloco A: o tipo `severity` entrou na união de regras, de forma aditiva. */
describe('parseTopoFlowOptions — regra de severidade', () => {
  const [node] = defaultTopology.nodes;
  const carrega = (steps: object[]) =>
    parseTopoFlowOptions({ topology: { nodes: [{ ...node, thresholds: { steps } }], edges: [] } });

  it('preserva a regra salva', () => {
    const steps = [{ type: 'severity', atLeast: 4, color: 'purple', label: 'CAIU' }];
    const { options, issues } = carrega(steps);

    expect(issues).toEqual([]);
    expect(options.topology.nodes[0].thresholds?.steps).toEqual(steps);
  });

  /** Alternar Métrica ↔ Trigger nunca descartou configuração; nem aqui. */
  it('os dois eixos convivem na mesma lista', () => {
    const steps = [
      { type: 'threshold', value: 90, color: 'red' },
      { type: 'severity', atLeast: 2, color: 'yellow' },
    ];
    const { options, issues } = carrega(steps);

    expect(issues).toEqual([]);
    expect(options.topology.nodes[0].thresholds?.steps).toHaveLength(2);
  });

  it('rejeita severidade fora de 0..5', () => {
    expect(carrega([{ type: 'severity', atLeast: 9, color: 'red' }]).issues).toHaveLength(1);
  });
});

describe('parseTopoFlowOptions — postit', () => {
  const [postit] = defaultTopology.postits;

  const carrega = (raw: object) => parseTopoFlowOptions({ topology: { nodes: [], edges: [], postits: [raw] } });

  it('postit salvo antes dos campos novos assume o canto e a espessura padrão', () => {
    const { titlePosition, borderWidth, ...salvo } = postit;
    const { options, issues } = carrega(salvo);

    expect(issues).toEqual([]);
    // O título sempre viveu no canto superior esquerdo: o default preserva isso.
    expect(options.topology.postits[0].titlePosition).toBe('top-left');
    expect(options.topology.postits[0].borderWidth).toBe(2);
  });

  it('preserva o canto e a espessura escolhidos', () => {
    const { options, issues } = carrega({ ...postit, titlePosition: 'bottom-right', borderWidth: 4 });

    expect(issues).toEqual([]);
    expect(options.topology.postits[0].titlePosition).toBe('bottom-right');
    expect(options.topology.postits[0].borderWidth).toBe(4);
  });

  it('rejeita canto desconhecido em vez de aceitar valor livre', () => {
    const { issues } = carrega({ ...postit, titlePosition: 'meio' });

    expect(issues).toHaveLength(1);
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
