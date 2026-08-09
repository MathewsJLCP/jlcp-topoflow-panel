import { DataFrame } from '@grafana/data';
import { Edge, Node } from '@xyflow/react';

import { TopoEdge, TopoNode, TopoPoint, TopoPostit, TopoText } from '../model/types';

/**
 * Ponte entre o modelo e o React Flow.
 *
 * Cada elemento vira um `Node` do React Flow carregando o objeto do modelo
 * inteiro em `data`. Os componentes de no leem dali em vez de receberem props
 * espalhadas — isso mantem a conversao em um lugar so (`useFlowElements`).
 */

/**
 * `frames` viaja no `data` de cada no, e nao numa closure dentro de
 * `nodeTypes`: recriar `nodeTypes` a cada render remonta todos os nos do canvas
 * — bug de performance classico do React Flow.
 */
/**
 * Papel do elemento enquanto o modo Linkar esta ativo.
 *
 * Chega pelo `data` do no, e nao por CSS no container, porque so o canvas sabe
 * quais alvos sao validos — a regra vive em `canConnect`, sobre a topologia.
 * `undefined` significa que nao ha linkagem em curso.
 */
export type LinkRole = 'source' | 'valid' | 'invalid';

export type DeviceNodeData = {
  element: TopoNode;
  frames: DataFrame[];
  editable: boolean;
  link?: LinkRole;
};
export type PointNodeData = {
  element: TopoPoint;
  frames: DataFrame[];
  editable: boolean;
  link?: LinkRole;
};
export type TextNodeData = { element: TopoText; frames: DataFrame[] };
/** Postit nao recebe `frames`: e estatico por decisao do PRD. */
export type PostitNodeData = { element: TopoPostit };

export type DeviceFlowNode = Node<DeviceNodeData, 'deviceNode'>;
export type PointFlowNode = Node<PointNodeData, 'pointNode'>;
export type PostitFlowNode = Node<PostitNodeData, 'postitNode'>;
export type TextFlowNode = Node<TextNodeData, 'textNode'>;

export type TopoFlowNode = DeviceFlowNode | PointFlowNode | PostitFlowNode | TextFlowNode;

export type TopoFlowEdgeData = { element: TopoEdge; frames: DataFrame[] };
export type TopoFlowEdge = Edge<TopoFlowEdgeData, 'topoEdge'>;

/**
 * Ordem de camadas da cena, de baixo para cima:
 *
 *   grade  <  postits  <  arestas  <  nos/points/textos  <  rotulos de aresta
 *
 * A grade e garantida pelo proprio React Flow (`.react-flow__background` tem
 * `z-index: -1` e vive fora do viewport), e os rotulos idem — o
 * `EdgeLabelRenderer` portaliza para um container acima de tudo. As tres
 * camadas do meio sao nossas, e precisam de valores explicitos: sem eles as
 * arestas caem no default e empatam com os nos, deixando o desempate para a
 * ordem do DOM.
 */

/**
 * Postits ficam sempre atras de tudo (decisao do PRD).
 *
 * O deslocamento e maior que qualquer zIndex que o reordenador possa produzir
 * (ele numera 0..N sobre o total de elementos), entao nem "trazer para frente"
 * em um postit consegue passar na frente de um no.
 */
export const POSTIT_Z_OFFSET = -100_000;

/** Acima dos postits, abaixo de qualquer no. */
export const EDGE_Z_INDEX = 0;

/**
 * Nos, points e textos comecam em 1. O reordenador numera a partir de 0, entao
 * sem este deslocamento o elemento mais ao fundo empataria com as arestas.
 */
export const NODE_Z_OFFSET = 1;
