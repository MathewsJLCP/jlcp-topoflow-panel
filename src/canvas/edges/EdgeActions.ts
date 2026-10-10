import React from 'react';

import { Waypoint } from '../../model/types';

/**
 * O que a conexao precisa do canvas para editar o proprio trajeto.
 *
 * Context, e nao `data` da aresta: o React Flow guarda as arestas em estado
 * local e o `data` congela entre reconstrucoes (ver a skill do projeto). O
 * contexto chega sempre atual, e nao existe tipo de aresta para esquecer de
 * reinjetar.
 */
export interface SelectedVertex {
  edgeId: string;
  index: number;
}

export interface EdgeActions {
  /** Grava o trajeto. `undefined` (ou vazio) volta a linha direta. */
  setWaypoints: (edgeId: string, waypoints: Waypoint[] | undefined) => void;
  vertex?: SelectedVertex;
  selectVertex: (vertex: SelectedVertex | undefined) => void;
  openVertexMenu: (event: React.MouseEvent, vertex: SelectedVertex) => void;
  linking: boolean;
  /** Grid do encaixe, para os vertices; `undefined` com o encaixe desligado. */
  grid?: number;
}

export const EdgeActionsContext = React.createContext<EdgeActions | undefined>(undefined);
