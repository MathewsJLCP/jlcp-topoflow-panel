import { z } from 'zod';

/**
 * Fonte da verdade do modelo do TopoFlow.
 *
 * Os tipos TypeScript sao derivados destes schemas em `./types.ts` via `z.infer`.
 * Nunca declarar um tipo do modelo a mao — declare o schema aqui.
 */

/** Versao do formato serializado em `panel.options`. Incrementar exige um migrador. */
export const SCHEMA_VERSION = 1;

/**
 * Propriedade que pode ser fixa ou dirigida por um field do DataFrame (ADR-P04).
 *
 * `fixed` e opcional de proposito: o veneer do core (`@grafana/schema`) o torna
 * obrigatorio, mas nao importamos aquele tipo — nunca passamos estes objetos
 * para uma API do Grafana, entao o acoplamento so custaria (Addendum A §2.1).
 */
export const colorDimensionSchema = z.object({
  /** Nome de cor do tema (ex.: 'green', 'text') ou hex. */
  fixed: z.string().optional(),
  /** Display name do field, obtido com `getFieldDisplayName`. */
  field: z.string().optional(),
});

/**
 * O core tem um terceiro modo, `template`, que interpola variaveis. Nao
 * implementamos agora; ampliar um enum depois e retrocompativel com dados ja
 * salvos, entao isso nao gera migracao.
 */
export const textDimensionSchema = z.object({
  mode: z.enum(['fixed', 'field']),
  fixed: z.string().optional(),
  field: z.string().optional(),
});

/** Metrica exibida dentro do no. Sem `field`, o no nao exibe metrica. */
export const valueDimensionSchema = z.object({
  field: z.string().optional(),
});

/**
 * Regras de estado por elemento, sobre o valor do field em `color.field`.
 *
 * **Coexiste** com o pipeline nativo do Grafana (decisao D8): um elemento sem
 * regra propria continua sendo pintado pelos thresholds do field, exatamente
 * como antes. Quem define regra aqui passa a mandar, e o nativo sai de cena
 * para aquele elemento — misturar os dois daria uma cor que ninguem consegue
 * explicar olhando so para um lugar.
 *
 * Duas diferencas deliberadas em relacao ao `ThresholdsConfig` do core:
 *
 *   - **Nao existe step base dentro da lista.** No core o base e o `-Infinity`,
 *     que pinta tudo abaixo da primeira regra — e a fonte do "verde por
 *     omissao". Aqui, valor abaixo de todas as regras significa "sem estado", e
 *     a cadeia de cor segue para `color.fixed`, que o editor apresenta como a
 *     linha **Base** ao pe da lista. E o mesmo dado de sempre, no lugar onde o
 *     usuario do Grafana espera encontra-lo.
 *   - **So modo absoluto.** O modo percentual do core depende de min/max do
 *     field, que nem sempre existe; um seletor de modo que so funciona as vezes
 *     e pior do que nao ter seletor. `mode` pode entrar depois como campo
 *     opcional, sem migracao.
 */
/** Casos que o valor sozinho nao expressa — os "Special" do Value mappings. */
export const specialMatchSchema = z.enum(['null', 'nan', 'null+nan', 'true', 'false', 'empty']);

/**
 * Severidade de trigger do Zabbix, de *Not classified* (0) a *Disaster* (5).
 *
 * Vive aqui, e nao em `data/problems.ts`, desde que virou dado **persistido**:
 * uma regra de severidade fica salva em `panel.options`, e a regra do projeto e
 * que todo tipo do modelo nasce do Zod. O `problems.ts` importa este tipo em vez
 * de manter a sua propria copia — enquanto eram duas listas escritas a mao, nada
 * impedia uma ganhar um nivel e a outra nao.
 *
 * Uniao de literais, e nao `z.number().min(0).max(5)`, porque so a primeira
 * forma faz o `z.infer` devolver `0 | 1 | 2 | 3 | 4 | 5` — o que permite ao
 * compilador cobrar os seis casos de todo `Record<Severity, ...>`.
 */
export const severitySchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);

/**
 * Movimento que o elemento ganha enquanto esta em alerta.
 *
 * Cor sozinha nao chama atencao num telao: um elemento vermelho parado ao lado
 * de outro vermelho parado nao diz qual acabou de cair. O movimento e o que
 * separa "esta ruim" de "acabou de ficar ruim".
 *
 * Onde a animacao e configurada difere entre os dois eixos, e a diferenca tem
 * motivo:
 *
 *   - **Metrica**: campo opcional de cada regra. Quem usa metrica ja escreve as
 *     regras, entao a animacao e so mais uma coluna da linha — e assim cada
 *     faixa anima do seu jeito (`>= 75` pulsa, `> 90` faz radar).
 *   - **Trigger**: campo do elemento (`elementAlertSchema`). Ali existe um
 *     default que vale a pena preservar — o mapa de cores de severidade do
 *     Zabbix —, e amarrar a animacao a uma regra obrigaria a definir uma cor
 *     para poder animar, sobrescrevendo aquele mapa sem querer.
 */
export const alertAnimationSchema = z.enum(['pulse', 'blink', 'radar']);

export const elementAlertSchema = z.object({
  animation: alertAnimationSchema,
  /**
   * A partir desta severidade, inclusive. `0` (*Not classified*) faz qualquer
   * alarme animar, que e o default de quem so quer ver o elemento se mexer.
   */
  fromSeverity: severitySchema.default(0),
});

/**
 * Uma regra do bloco Thresholds.
 *
 * Junta num modelo so os dois mecanismos que o Grafana mantem separados: o
 * **Thresholds** (faixa aberta, "a partir de X") e o **Value mappings** (valor
 * exato, faixa fechada, regex e casos especiais). Separados, configurar um
 * elemento exigia visitar dois lugares que produzem a mesma coisa — uma cor e
 * um texto — com precedencias que so quem conhece o core sabe prever.
 *
 * **Cor e obrigatoria em toda regra**, e e o desvio deliberado em relacao ao
 * Value mappings do core, onde ela e opcional. Uma regra sem cor so produziria
 * texto, e num elemento de topologia o texto e o acessorio: quem carrega o
 * estado e a cor. Deixar a cor opcional obrigaria a cadeia de cor a devolver
 * "sem estado, mas com texto", um quarto caso que nenhum consumidor sabe pintar.
 */
export const elementRuleSchema = z.preprocess(
  // Regras salvas antes dos tipos novos nao tem `type` e sao todas threshold.
  // Um `.default()` no discriminador nao resolveria: o zod 4 aplica o default
  // *depois* de rotear, entao o objeto legado falharia antes de chegar la — a
  // mesma armadilha ja documentada em `triggerBindingSchema`.
  (raw) => (typeof raw === 'object' && raw !== null && !('type' in raw) ? { ...raw, type: 'threshold' } : raw),
  z.discriminatedUnion('type', [
    /** A partir deste valor, inclusive. */
    z.object({
      type: z.literal('threshold'),
      value: z.number(),
      color: z.string(),
      label: z.string().optional(),
      animation: alertAnimationSchema.optional(),
    }),
    /** Valor exato, comparado como texto. */
    z.object({
      type: z.literal('value'),
      match: z.string(),
      color: z.string(),
      label: z.string().optional(),
      animation: alertAnimationSchema.optional(),
    }),
    /** Faixa fechada: `from <= valor <= to`. */
    z.object({
      type: z.literal('range'),
      from: z.number(),
      to: z.number(),
      color: z.string(),
      label: z.string().optional(),
      animation: alertAnimationSchema.optional(),
    }),
    z.object({
      type: z.literal('regex'),
      pattern: z.string(),
      color: z.string(),
      label: z.string().optional(),
      animation: alertAnimationSchema.optional(),
    }),
    z.object({
      type: z.literal('special'),
      match: specialMatchSchema,
      color: z.string(),
      label: z.string().optional(),
      animation: alertAnimationSchema.optional(),
    }),
    /**
     * A partir desta severidade de trigger, inclusive.
     *
     * E a unica regra que **nao** olha para o valor de um field: ela e avaliada
     * contra a severidade do alarme, no nivel 0 da cadeia de cor. Sem nenhuma
     * regra deste tipo, o alarme continua pintado pelo mapa de severidade do
     * Zabbix — que e o comportamento de sempre e o default de quem nao configura
     * nada.
     *
     * Convive na mesma lista com as regras de metrica de proposito: alternar
     * Metrica <-> Trigger no editor nunca descartou configuracao, e nao seria
     * agora que passaria a descartar. Quem separa as duas e a resolucao, em
     * `data/thresholds.ts`.
     */
    z.object({
      type: z.literal('severity'),
      atLeast: severitySchema,
      color: z.string(),
      label: z.string().optional(),
    }),
  ])
);

export const elementThresholdsSchema = z.object({
  // O nome `steps` fica por retrocompatibilidade: renomear exigiria migrador
  // para ganhar nada — a lista sempre foi a lista de regras.
  steps: z.array(elementRuleSchema).default([]),
});

/**
 * Vinculo a uma trigger do Zabbix, lida dos frames de uma query em Query Mode
 * *Problems*. O plugin nunca chama a API do Zabbix: os dados entram pelo Query
 * Editor nativo do painel e nos so lemos o `DataFrame`.
 *
 * E um campo **opcional e paralelo** ao binding de metrica, e nao um
 * `discriminatedUnion` sobre um `mode`. Duas razoes:
 *
 *   1. Retrocompatibilidade sai de graca — uma topologia salva antes desta
 *      feature nao tem `trigger` e carrega identica, sem migrador. A alternativa
 *      obvia nao funciona: um `z.literal('metric').default('metric')` dentro de
 *      `discriminatedUnion` nao salva o objeto legado, porque o zod 4 aplica o
 *      default *depois* de rotear pelo discriminador — o parse falha com "No
 *      matching discriminator" antes de chegar la.
 *   2. As duas configuracoes coexistem no JSON, entao alternar Metrica <->
 *      Trigger no editor nao descarta nada — nem depois de salvar e recarregar.
 *
 * Por isso `enabled` e persistido em vez de a precedencia sair da presenca do
 * objeto: e a flag que decide quem manda em runtime, e ela pode voltar a `false`
 * sem levar a configuracao da trigger junto.
 */
export const triggerBindingSchema = z.object({
  // `.default` porque o editor escreve o objeto no instante em que o usuario
  // abre o modo trigger, antes de existir host escolhido.
  enabled: z.boolean().default(false),
  /**
   * `hosts[].name` (o nome que o operador ve) ou `hosts[].host` (o nome
   * tecnico). O match aceita os dois — ver `matchesHost` em `data/problems.ts`.
   */
  host: z.string(),
  /** Descricao da trigger. Ausente significa qualquer trigger do host. */
  name: z.string().optional(),
  /**
   * Query de Problems especifica. Reservado: esta versao varre todos os frames
   * de Problems e nao expoe a escolha na UI. Fica declarado para que expor
   * depois nao custe uma migracao.
   */
  refId: z.string().optional(),
});

export const topoNodeSchema = z.object({
  id: z.string().min(1),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  size: z.object({
    width: z.number().positive(),
    height: z.number().positive(),
  }),
  presentation: z.object({
    /**
     * Chave da biblioteca em `canvas/icons`. String livre, e nao enum, para que
     * remover ou renomear um icone nao invalide topologias salvas — quem nao for
     * reconhecido cai no `generic`.
     */
    icon: z.string().optional(),
    // `.default(true)` e o que faz um no salvo antes deste campo continuar
    // exibindo o icone, que era o unico comportamento possivel ate aqui.
    showIcon: z.boolean().default(true),
    primaryText: textDimensionSchema,
    /** Ausente significa desligado — nao ha flag separada. */
    secondaryText: textDimensionSchema.optional(),
  }),
  value: valueDimensionSchema.optional(),
  /**
   * Cor de destaque. Pousa no icone, na capsula e no badge — nunca no card
   * (Anexo A.2). `fixed` vazio significa neutro, nao branco.
   */
  color: colorDimensionSchema,
  trigger: triggerBindingSchema.optional(),
  /** Ausente = o elemento usa os thresholds do field (pipeline nativo). */
  thresholds: elementThresholdsSchema.optional(),
  /** Ausente = o elemento nao se move em alerta. */
  alert: elementAlertSchema.optional(),
  zIndex: z.number().int(),
});

export const topoEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  style: z.enum(['solid', 'dashed', 'dotted']),
  shape: z.enum(['curved', 'straight']),
  color: colorDimensionSchema,
  trigger: triggerBindingSchema.optional(),
  /** Ausente = a aresta usa os thresholds do field (pipeline nativo). */
  thresholds: elementThresholdsSchema.optional(),
  /** Ausente = a aresta nao se move em alerta. */
  alert: elementAlertSchema.optional(),
  width: z.number().min(1).max(10),
  /**
   * Rotulo estatico. Texto interpolado com valor de metrica e um recurso de
   * binding, nao de geometria, e fica para depois — por isso `string` simples e
   * nao uma `TextDimension`.
   */
  label: z.string().optional(),
  // `.default` pelo mesmo motivo dos arrays da topologia: arestas salvas antes
  // do Bloco 4 continuam validando sem migracao.
  animation: z.enum(['none', 'dash-flow', 'flow', 'pulse']).default('none'),
});

/** No simplificado: ancora de roteamento. Sem texto, sem icone, sem valor. */
export const topoPointSchema = z.object({
  id: z.string().min(1),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  color: colorDimensionSchema,
  trigger: triggerBindingSchema.optional(),
  /** Ausente = o point usa os thresholds do field (pipeline nativo). */
  thresholds: elementThresholdsSchema.optional(),
  /** Ausente = o point nao se move em alerta. */
  alert: elementAlertSchema.optional(),
  zIndex: z.number().int(),
});

/**
 * Retangulo de agrupamento. Sempre atras dos demais elementos.
 *
 * `color` e uma string simples, nao uma `ColorDimension`: o postit e estatico
 * por decisao do PRD, e um tipo que nao aceita `field` torna isso impossivel de
 * violar por engano no editor.
 */
export const topoPostitSchema = z.object({
  id: z.string().min(1),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  size: z.object({
    width: z.number().positive(),
    height: z.number().positive(),
  }),
  title: z.string().optional(),
  /**
   * Canto em que a tag de titulo pousa sobre a borda.
   *
   * `.default` mantem o postit salvo antes deste campo exatamente onde estava —
   * o titulo sempre viveu no canto superior esquerdo.
   */
  titlePosition: z.enum(['top-left', 'top-right', 'bottom-left', 'bottom-right']).default('top-left'),
  color: z.string(),
  /** Escala 0..1, nao 0..100: e o que ja esta persistido nos dashboards. */
  opacity: z.number().min(0).max(1),
  // `.default` pelo mesmo motivo dos arrays da topologia: postits salvos antes
  // deste campo continuam validando sem migracao.
  borderStyle: z.enum(['solid', 'dashed', 'dotted']).default('solid'),
  /**
   * Espessura da borda em px. Era fixa em 1.5 e passou a 2, que e a espessura
   * em que o traco se sustenta sobre o fundo do canvas nos dois temas.
   */
  borderWidth: z.number().min(0).max(10).default(2),
  zIndex: z.number().int(),
});

/**
 * Placa de fundo do texto. **Ausente significa transparente** — nao existe flag
 * separada, pelo mesmo motivo do `secondaryText` do no.
 *
 * Objeto aninhado, e nao dois campos soltos ao lado de `fontSize`: cor e
 * opacidade so fazem sentido juntas, e separadas abririam dois estados
 * invalidos que alguem teria de tratar em runtime — cor sem opacidade e
 * opacidade sem cor.
 *
 * `color` guarda **nome de cor do tema** (ou hex), nunca o valor resolvido:
 * resolver na hora de salvar congelaria o tema vigente no momento da edicao, e a
 * placa ficaria clara num dashboard escuro.
 */
export const textBackgroundSchema = z.object({
  color: z.string(),
  /** Escala 0..1, como no postit. */
  opacity: z.number().min(0).max(1),
});

/**
 * Texto solto sobre o canvas. Elemento decorativo: nao tem estado.
 *
 * `trigger` viveu aqui e saiu (decisao D5). O Texto era o unico elemento em que
 * a fonte de estado nao pagava o proprio custo — o glifo e a unica superficie
 * que ele tem, entao acender significava trocar a cor da letra, e um texto que
 * muda de cor sozinho se le como erro de renderizacao, nao como alarme.
 *
 * `color` continua sendo uma `ColorDimension` por retrocompatibilidade: e o que
 * ja esta salvo. Mas o editor so escreve `fixed`, e o canvas so le `fixed` — um
 * `field` que tenha sobrado de antes fica inerte, sem migrador e sem repintar
 * texto nenhum.
 */
export const topoTextSchema = z.object({
  id: z.string().min(1),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  content: textDimensionSchema,
  color: colorDimensionSchema,
  background: textBackgroundSchema.optional(),
  fontSize: z.number().min(8).max(72),
  zIndex: z.number().int(),
});

export const canvasSchema = z.object({
  showGrid: z.boolean(),
  snapToGrid: z.boolean(),
  gridSize: z.number().int().min(4).max(64),
  // `.default` mantem `schemaVersion: 1` valido: um dashboard salvo antes deste
  // campo existir continua validando em vez de cair para os defaults inteiros.
  inlineEditing: z.boolean().default(false),
});

/**
 * A integridade referencial das arestas e resolvida por descarte, nao por erro.
 *
 * Uma aresta pendurada vem tipicamente de JSON editado a mao. Rejeitar a
 * topologia inteira faria o painel cair para os defaults e perder o trabalho do
 * usuario por causa de uma aresta; descartar a aresta perde so a aresta.
 * IDs duplicados quebram a reconciliacao do React Flow, entao caem junto.
 */
export const topologySchema = z
  .object({
    // Os `.default([])` sao o que permite manter `schemaVersion: 1` ao adicionar
    // tipos novos: uma topologia salva so com nodes/edges continua validando.
    nodes: z.array(topoNodeSchema).default([]),
    edges: z.array(topoEdgeSchema).default([]),
    points: z.array(topoPointSchema).default([]),
    postits: z.array(topoPostitSchema).default([]),
    texts: z.array(topoTextSchema).default([]),
  })
  .transform(({ nodes, edges, points, postits, texts }) => {
    // Um unico espaco de ids para todos os elementos: sao todos `Node` do React
    // Flow, e ids repetidos entre tipos quebrariam a reconciliacao igual.
    const seen = new Set<string>();
    const dedupe = <T extends { id: string }>(items: T[]) =>
      items.filter((item) => {
        if (seen.has(item.id)) {
          return false;
        }
        seen.add(item.id);
        return true;
      });

    const keptNodes = dedupe(nodes);
    const keptPoints = dedupe(points);
    const keptPostits = dedupe(postits);
    const keptTexts = dedupe(texts);

    // Só nós e points aceitam conexao (Bloco 4). Postits e textos nunca.
    const connectable = new Set([...keptNodes, ...keptPoints].map((item) => item.id));

    const edgeIds = new Set<string>();
    const keptEdges = edges.filter((edge) => {
      if (edgeIds.has(edge.id) || !connectable.has(edge.source) || !connectable.has(edge.target)) {
        return false;
      }
      edgeIds.add(edge.id);
      return true;
    });

    return {
      nodes: keptNodes,
      edges: keptEdges,
      points: keptPoints,
      postits: keptPostits,
      texts: keptTexts,
    };
  });

export const topoFlowOptionsSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  topology: topologySchema,
  canvas: canvasSchema,
});
