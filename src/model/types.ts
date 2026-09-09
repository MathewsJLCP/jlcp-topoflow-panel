import { z } from 'zod';

import {
  canvasSchema,
  colorDimensionSchema,
  drilldownSchema,
  elementAlertSchema,
  elementThresholdsSchema,
  imageBackgroundSchema,
  severitySchema,
  textBackgroundSchema,
  textDimensionSchema,
  topoEdgeSchema,
  topoFlowOptionsSchema,
  topoImageSchema,
  topoNodeSchema,
  topoPointSchema,
  topoPostitSchema,
  topoTextSchema,
  topologySchema,
  triggerBindingSchema,
  valueDimensionSchema,
  zabbixOptionsSchema,
} from './schema';

/**
 * Tipos do modelo. Todos derivados dos schemas Zod — nunca declarados a mao.
 * Para mudar uma forma, mude o schema em `./schema.ts`.
 */

export type ZabbixOptions = z.infer<typeof zabbixOptionsSchema>;
export type ColorDimension = z.infer<typeof colorDimensionSchema>;
export type TextDimension = z.infer<typeof textDimensionSchema>;
export type ValueDimension = z.infer<typeof valueDimensionSchema>;
export type TriggerBinding = z.infer<typeof triggerBindingSchema>;
export type TextBackground = z.infer<typeof textBackgroundSchema>;
/** Para onde o clique no elemento leva. Ausente significa desligado. */
export type Drilldown = z.infer<typeof drilldownSchema>;
/** Movimento do elemento em alerta. Ausente significa parado. */
export type ElementAlert = z.infer<typeof elementAlertSchema>;
export type AlertAnimation = ElementAlert['animation'];
export type ElementThresholds = z.infer<typeof elementThresholdsSchema>;
/** Uma regra do bloco Thresholds: threshold, valor, faixa, regex ou especial. */
export type ElementRule = ElementThresholds['steps'][number];
export type ElementRuleType = ElementRule['type'];
export type SpecialMatch = Extract<ElementRule, { type: 'special' }>['match'];
/** Severidade de trigger do Zabbix: 0 (Not classified) a 5 (Disaster). */
export type Severity = z.infer<typeof severitySchema>;

export type TopoNode = z.infer<typeof topoNodeSchema>;
export type TopoEdge = z.infer<typeof topoEdgeSchema>;
export type TopoPoint = z.infer<typeof topoPointSchema>;
export type TopoPostit = z.infer<typeof topoPostitSchema>;
export type TopoText = z.infer<typeof topoTextSchema>;
export type TopoImage = z.infer<typeof topoImageSchema>;
/** Fundo da imagem: cor solida ou a cor do estado. Ausente = desligado. */
export type ImageBackground = z.infer<typeof imageBackgroundSchema>;
export type Topology = z.infer<typeof topologySchema>;

/** Tipos de elemento posicionavel. Arestas ficam de fora: nao tem posicao. */
export type ElementKind = 'node' | 'point' | 'postit' | 'text' | 'image';

/** As chaves de `Topology` que guardam elementos posicionaveis, por tipo. */
export const ELEMENT_COLLECTION = {
  node: 'nodes',
  point: 'points',
  postit: 'postits',
  text: 'texts',
  image: 'images',
} as const satisfies Record<ElementKind, keyof Topology>;

export type CanvasOptions = z.infer<typeof canvasSchema>;
export type TopoFlowOptions = z.infer<typeof topoFlowOptionsSchema>;
