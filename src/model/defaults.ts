import { SCHEMA_VERSION } from './schema';
import { DEFAULT_EDGE_WIDTH } from './sizes';
import { CanvasOptions, TopoFlowOptions, Topology } from './types';

/**
 * Topologia de exemplo: um roteador de borda alimentando dois servidores.
 *
 * Serve a dois propositos: e o fallback quando `panel.options` esta ausente ou
 * invalido, e e o que o usuario ve ao adicionar o painel pela primeira vez.
 *
 * Os `value.field` sao deixados vazios de proposito. O vinculo com o dado e
 * escolhido pelo usuario no Bloco 3 — chutar um nome de field aqui produziria
 * um estado de "field ausente" logo na primeira renderizacao.
 */
export const defaultTopology: Topology = {
  nodes: [
    {
      id: 'edge-router',
      position: { x: 40, y: 140 },
      size: { width: 180, height: 60 },
      presentation: {
        primaryText: { mode: 'fixed', fixed: 'rtr-borda-01' },
        secondaryText: { mode: 'fixed', fixed: '10.0.0.1' },
      },
      color: {},
      zIndex: 0,
    },
    {
      id: 'app-server',
      position: { x: 320, y: 60 },
      size: { width: 180, height: 60 },
      presentation: {
        primaryText: { mode: 'fixed', fixed: 'srv-app-01' },
        secondaryText: { mode: 'fixed', fixed: '10.0.1.10' },
      },
      color: {},
      zIndex: 0,
    },
    {
      id: 'db-server',
      position: { x: 320, y: 220 },
      size: { width: 180, height: 60 },
      presentation: {
        primaryText: { mode: 'fixed', fixed: 'srv-db-01' },
        secondaryText: { mode: 'fixed', fixed: '10.0.1.20' },
      },
      color: {},
      zIndex: 0,
    },
  ],
  edges: [
    {
      id: 'edge-router__app-server',
      source: 'edge-router',
      target: 'app-server',
      style: 'solid',
      shape: 'straight',
      color: {},
      width: DEFAULT_EDGE_WIDTH,
      animation: 'none',
    },
    {
      id: 'edge-router__db-server',
      source: 'edge-router',
      target: 'db-server',
      style: 'solid',
      shape: 'straight',
      color: {},
      width: DEFAULT_EDGE_WIDTH,
      animation: 'none',
    },
  ],
  points: [],
  postits: [
    {
      id: 'datacenter',
      position: { x: 290, y: 20 },
      size: { width: 240, height: 280 },
      title: 'Datacenter',
      // Unico elemento do exemplo com cor explicita, de proposito: ao lado dos
      // nos neutros ele mostra os dois lados da cadeia lado a lado, e serve de
      // regressao visual — se um no do exemplo voltar a nascer colorido, o
      // fallback quebrou de novo.
      color: 'blue',
      opacity: 0.12,
      borderStyle: 'solid',
      zIndex: 0,
    },
  ],
  texts: [
    {
      id: 'titulo',
      position: { x: 40, y: 60 },
      content: { mode: 'fixed', fixed: 'Topologia de exemplo' },
      color: {},
      fontSize: 16,
      zIndex: 0,
    },
  ],
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
