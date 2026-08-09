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
    /** Chave da biblioteca de icones. O PRD 1 usa um unico icone default. */
    icon: z.string().optional(),
    primaryText: textDimensionSchema,
    secondaryText: textDimensionSchema.optional(),
  }),
  value: valueDimensionSchema.optional(),
  /**
   * Cor de destaque. Pousa no icone, na capsula e no badge — nunca no card
   * (Anexo A.2). `fixed` vazio significa neutro, nao branco.
   */
  color: colorDimensionSchema,
  trigger: triggerBindingSchema.optional(),
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
  color: z.string(),
  /** Escala 0..1, nao 0..100: e o que ja esta persistido nos dashboards. */
  opacity: z.number().min(0).max(1),
  // `.default` pelo mesmo motivo dos arrays da topologia: postits salvos antes
  // deste campo continuam validando sem migracao.
  borderStyle: z.enum(['solid', 'dashed', 'dotted']).default('solid'),
  zIndex: z.number().int(),
});

/** Texto solto sobre o canvas. */
export const topoTextSchema = z.object({
  id: z.string().min(1),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  content: textDimensionSchema,
  color: colorDimensionSchema,
  trigger: triggerBindingSchema.optional(),
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
