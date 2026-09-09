import { SCHEMA_VERSION } from './schema';
import { CanvasOptions, TopoFlowOptions, Topology } from './types';

/**
 * A topologia com que um painel novo nasce: **vazia**.
 *
 * Serve a dois propositos, e os dois pedem o mesmo objeto:
 *
 *   - e o `defaultValue` do editor de topologia, ou seja, o que o usuario ve ao
 *     adicionar o painel ao dashboard;
 *   - e o fallback de `parseTopoFlowOptions` quando `panel.options` esta ausente
 *     ou nao valida.
 *
 * Ate a v1.0 os dois caminhos caiam numa topologia de exemplo — tres nos, duas
 * arestas, um postit e um titulo. Ela ajudava a entender o painel na primeira
 * vez e atrapalhava em todas as outras: quem adiciona o painel para desenhar a
 * sua rede comeca apagando a rede de outra pessoa, e o exemplo tambem chegava
 * pelo caminho de erro — topologia corrompida desenhava tres nos que nunca
 * existiram, sugerindo que o trabalho tinha sido substituido por um mapa
 * qualquer. O exemplo continua vivo como fixture de teste em
 * `./sampleTopology.ts`.
 *
 * As seis colecoes ficam declaradas explicitamente, e nao delegadas aos
 * `.default([])` do schema: este objeto e comparado com `toEqual` nos testes e
 * entregue direto ao editor, sem passar pelo Zod nos dois casos.
 */
export const defaultTopology: Topology = {
  nodes: [],
  edges: [],
  points: [],
  postits: [],
  texts: [],
  images: [],
};

export const defaultCanvas: CanvasOptions = {
  showGrid: true,
  snapToGrid: true,
  gridSize: 16,
  inlineEditing: false,
};

export const defaultOptions: TopoFlowOptions = {
  schemaVersion: SCHEMA_VERSION,
  topology: defaultTopology,
  canvas: defaultCanvas,
};
