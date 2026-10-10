import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { css } from '@emotion/css';
import { DataFrame, GrafanaTheme2, TimeRange } from '@grafana/data';
import { TimeZone } from '@grafana/schema';
import { useStyles2, useTheme2, usePanelContext } from '@grafana/ui';
import {
  Background,
  BackgroundVariant,
  Connection,
  ConnectionMode,
  EdgeChange,
  NodeChange,
  ReactFlow,
  ReactFlowProvider,
  XYPosition,
  applyEdgeChanges,
  applyNodeChanges,
  useOnViewportChange,
  useReactFlow,
} from '@xyflow/react';

import {
  OrderCommand,
  addElement,
  canConnect,
  connect,
  duplicateElement,
  findEdgeBetween,
  findElement,
  moveElements,
  removeElements,
  resizeElement,
  reorderElement,
  reverseEdge,
  updateEdge,
} from '../model/mutations';
import { CanvasOptions, ElementKind, Topology, Waypoint } from '../model/types';
import { TopoInstanceState } from '../panel/instanceState';
import { CanvasContextMenu, MenuState } from './CanvasContextMenu';
import { GhostConnection } from './GhostConnection';
import { CanvasControls } from './CanvasControls';
import { HoverLayerContext } from './HoverLayer';
import { ShotResult } from './ScreenshotButton';
import { EdgeActions, EdgeActionsContext, SelectedVertex } from './edges/EdgeActions';
import { edgeGeometry, waypointIndexAt } from './edges/path';
import { FONT_MONO, FONT_SANS, tfPalette } from '../theme/palette';
import { TopoTime, TopoTimeContext } from './timeContext';
import { edgeTypes } from './edges';
import { LinkRole, TopoFlowEdge, TopoFlowNode } from './flowTypes';
import { nodeTypes } from './nodes';
import { toFlowEdges, toFlowNodes } from './useFlowElements';

import '@xyflow/react/dist/style.css';

/**
 * Escrita em `panel.options` so depois que o gesto de arraste esfria.
 *
 * O numero e um equilibrio entre duas perdas. Curto demais e cada gesto vira
 * varias escritas em `options` — o que o debounce existe para evitar, ja que a
 * alca de resize emite dezenas de mudancas por arraste. Longo demais e a janela
 * em que o commit ainda nao aconteceu: se o painel desmontar dentro dela
 * (fechar o editor, salvar o dashboard, trocar de painel), o `clearTimeout` do
 * cleanup descarta o gesto e o elemento volta para onde estava.
 *
 * 80ms fecha essa janela para algo que o usuario nao alcanca entre soltar o
 * mouse e clicar em outra coisa, e continua muito acima da cadencia de um
 * gesto continuo — os eventos de arraste chegam a cada frame (~16ms), entao o
 * timer so dispara depois que o movimento de fato parou. Era 200ms.
 *
 * A janela nao fecha por completo: o commit e assincrono por construcao. O que
 * some no cleanup do unmount e sempre no maximo este intervalo.
 */
const POSITION_COMMIT_DELAY_MS = 80;

/**
 * Tipos de no cujo tamanho e um atributo salvo. Os demais tem tamanho derivado
 * (o texto, do `fontSize`; o point, da constante) e persistir a medicao do
 * navegador neles gravaria em `options` um numero que ninguem pediu.
 */
const RESIZABLE_TYPES = new Set(['postitNode', 'imageNode']);

/** Referencia estavel: um array novo a cada render reiniciaria a publicacao. */
const EMPTY_SELECTION: string[] = [];

/** Aviso no topo do canvas (opcoes invalidas, falha do Zabbix). */
export interface CanvasBanner {
  title: string;
  body: string;
}

export interface TopologyCanvasProps {
  banners?: CanvasBanner[];
  topology: Topology;
  frames: DataFrame[];
  canvas: CanvasOptions;
  editable: boolean;
  width: number;
  height: number;
  /** Titulo do painel. So o screenshot usa: e o nome do arquivo baixado. */
  title?: string;
  /** Janela de tempo do dashboard, para o grafico de hover. Ver `timeContext`. */
  timeRange: TimeRange;
  timeZone: TimeZone;
  onChange: (next: Topology) => void;
}

export function TopologyCanvas(props: TopologyCanvasProps) {
  // `screenToFlowPosition` (usado para nascer elemento no ponto do clique) so
  // existe dentro do provider.
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}

function CanvasInner({
  banners = [],
  topology,
  frames,
  canvas,
  editable,
  width,
  height,
  title,
  timeRange,
  timeZone,
  onChange,
}: TopologyCanvasProps) {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const { screenToFlowPosition, getInternalNode, setCenter, getZoom } = useReactFlow();
  const { onInstanceStateChange } = usePanelContext();

  const [menu, setMenu] = useState<MenuState | undefined>();

  /**
   * O container deste painel. O screenshot procura o viewport a partir daqui, e
   * nao no documento: um dashboard com dois TopoFlow tem dois viewports.
   */
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  /** O mesmo elemento, em estado: os popovers de hover precisam dele no render. */
  const [hoverLayer, setHoverLayer] = useState<HTMLDivElement | null>(null);
  const setWrapper = useCallback((node: HTMLDivElement | null) => {
    wrapperRef.current = node;
    setHoverLayer(node);
  }, []);

  /**
   * Modo Linkar. Vive no estado local, e nao na topologia, porque um gesto pela
   * metade nao e um fato do documento — so o `connect` final vai para
   * `panel.options`, e por isso o undo do dashboard nao ve nenhum passo
   * intermediario.
   */
  const [linking, setLinking] = useState<{ sourceId: string } | undefined>();
  const [cursor, setCursor] = useState<XYPosition | undefined>();

  const [nodes, setNodes] = useState<TopoFlowNode[]>(() => toFlowNodes(topology, frames, editable));
  const [edges, setEdges] = useState<TopoFlowEdge[]>(() => toFlowEdges(topology, frames, editable));

  /**
   * `options.topology` e a fonte da verdade, mas durante um arraste o React
   * Flow precisa mandar na posicao para o movimento nao engasgar. A revisao
   * distingue "a topologia mudou por fora" (Panel JSON, undo do dashboard) de
   * "a topologia mudou porque nos acabamos de escrever" — so o primeiro caso
   * deve sobrescrever o estado local.
   */
  const revision = useMemo(() => JSON.stringify(topology), [topology]);
  const appliedRevision = useRef(revision);

  /** Aresta recem-criada pelo modo Linkar, a selecionar na proxima montagem. */
  const pendingEdgeSelection = useRef<string | undefined>();

  useEffect(() => {
    if (appliedRevision.current === revision) {
      return;
    }
    appliedRevision.current = revision;

    // A selecao e aplicada aqui, e nao logo apos o `connect`, porque este
    // efeito reconstroi as arestas do zero e apagaria qualquer selecao posta
    // antes dele.
    const selectedId = pendingEdgeSelection.current;
    pendingEdgeSelection.current = undefined;

    setNodes((current) => keepSelection(toFlowNodes(topology, frames, editable), current));
    setEdges((current) =>
      keepSelection(toFlowEdges(topology, frames, editable), current).map((edge) =>
        edge.id === selectedId ? { ...edge, selected: true } : edge
      )
    );
  }, [revision, topology, frames, editable]);

  /**
   * Series novas nao mudam a topologia, so o que os nos exibem. Injetar os
   * frames no render (em vez de guardar no estado e sincronizar por efeito)
   * evita a cascata de renders e mantem selecao e posicao em voo intactas.
   */
  /** Objeto novo a cada render reiniciaria todo consumidor do contexto. */
  const tempo = useMemo<TopoTime>(() => ({ timeRange, timeZone }), [timeRange, timeZone]);

  const nodesWithFrames = useMemo(
    () => withNodeData(nodes, frames, editable, linking?.sourceId, topology),
    [nodes, frames, editable, linking, topology]
  );
  // `editable` viaja junto com os frames pelo mesmo motivo que viaja nos nos: o
  // efeito de ressincronia nao roda quando so o modo de edicao muda, e sem isto
  // a aresta ficaria com a flag congelada na montagem.
  const edgesWithFrames = useMemo(
    () => edges.map((edge) => (edge.data ? { ...edge, data: { ...edge.data, frames, editable } } : edge)),
    [edges, frames, editable]
  );

  // Lidos dentro do timer de commit, que dispara depois do render. Sincronizar
  // em efeito (e nao durante o render) e o que a regra react-hooks/refs exige.
  const topologyRef = useRef(topology);
  const nodesRef = useRef(nodes);
  useEffect(() => {
    topologyRef.current = topology;
    nodesRef.current = nodes;
  });

  const commitTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(commitTimer.current), []);

  /**
   * Geometria que o React Flow ja esta desenhando e que ainda nao foi para
   * `options`. `'size'` implica `'position'` — arrastar a alca da esquerda ou do
   * topo **move** o no, e so o tamanho deixaria o retangulo saltando de volta.
   */
  const pending = useRef<'position' | 'size' | undefined>();

  /**
   * Aplica sobre `base` o gesto pendente e cancela o timer.
   *
   * Existe porque o commit e debounced: entre o fim do arraste e o disparo do
   * timer ha uma janela em que qualquer outra acao (excluir, duplicar,
   * conectar, criar) roda sobre `topologyRef.current`, que ainda nao conhece a
   * posicao nova. Antes, `mutate` simplesmente cancelava o timer — e o arraste
   * era **perdido**, com o elemento saltando de volta para onde estava.
   */
  const flushPending = useCallback((base: Topology): Topology => {
    const gesture = pending.current;
    if (!gesture) {
      return base;
    }

    clearTimeout(commitTimer.current);
    pending.current = undefined;

    let next = base;
    if (gesture === 'size') {
      for (const node of nodesRef.current) {
        if (!RESIZABLE_TYPES.has(node.type ?? '') || !node.width || !node.height) {
          continue;
        }
        next = resizeElement(next, node.id, { width: node.width, height: node.height });
      }
    }

    return moveElements(
      next,
      nodesRef.current.map((node) => ({ id: node.id, position: node.position }))
    );
  }, []);

  /**
   * Arraste e redimensionamento: o React Flow ja esta desenhando o resultado,
   * entao marcamos a revisao como aplicada para o efeito acima nao reconstruir
   * os nos no meio do gesto — o que faria o elemento pular de volta.
   *
   * O debounce e o que impede a alca de reescrever `options` a cada uma das
   * dezenas de mudancas que um unico gesto emite.
   */
  const scheduleCommit = useCallback(
    (gesture: 'position' | 'size') => {
      // Um arraste que chegue depois de um resize nao rebaixa o commit: as duas
      // dimensoes do mesmo gesto precisam viajar juntas.
      pending.current = pending.current === 'size' ? 'size' : gesture;

      clearTimeout(commitTimer.current);
      commitTimer.current = setTimeout(() => {
        const next = flushPending(topologyRef.current);
        appliedRevision.current = JSON.stringify(next);
        onChange(next);
      }, POSITION_COMMIT_DELAY_MS);
    },
    [flushPending, onChange]
  );

  const onNodesChange = useCallback(
    (changes: Array<NodeChange<TopoFlowNode>>) => {
      setNodes((current) => applyNodeChanges(changes, current));

      // Selecao nao vai para `options`: e estado de UI.
      if (changes.some((change) => change.type === 'position')) {
        scheduleCommit('position');
      }

      /**
       * Dimensao chega por dois caminhos e so um deve ser salvo.
       *
       * O `ResizeObserver` do React Flow emite `dimensions` a cada medicao — a
       * cada render, a cada mudanca de zoom — e persistir isso escreveria em
       * `options` o tamanho que o navegador mediu, num laco de gravacao que o
       * usuario nunca pediu. O arraste da alca do `NodeResizer` emite a mesma
       * mudanca **com `setAttributes`**, que e o pedido explicito de tornar
       * aquela dimensao um atributo do no. So esse vira topologia.
       */
      if (changes.some((change) => change.type === 'dimensions' && change.setAttributes)) {
        scheduleCommit('size');
      }
    },
    [scheduleCommit]
  );

  /**
   * Sem isto a aresta **nunca fica selecionada**.
   *
   * Em modo controlado o React Flow nao guarda selecao propria: ele emite a
   * mudanca e espera que quem tem o array a aplique. `onNodesChange` existia
   * desde sempre, `onEdgesChange` nao — por isso o realce de aresta selecionada
   * em `TopoEdge` (stroke `primary.main` + glow) estava escrito e nunca
   * aparecia. A unica aresta que chegava a acender era a recem-criada pelo modo
   * Linkar, porque ali a selecao e gravada direto no estado.
   *
   * Nao ha commit de posicao: aresta nao tem posicao, e selecao e estado de UI
   * que nao vai para `options` — a mesma regra que vale para os nos.
   */
  const onEdgesChange = useCallback(
    (changes: Array<EdgeChange<TopoFlowEdge>>) => setEdges((current) => applyEdgeChanges(changes, current)),
    []
  );

  /**
   * Mutacoes estruturais (criar, excluir, duplicar, reordenar). Ao contrario do
   * arraste, aqui a revisao NAO e marcada como aplicada: e justamente o efeito
   * de ressincronia que traz o elemento novo para o React Flow.
   */
  const mutate = useCallback(
    (fn: (current: Topology) => Topology) => {
      setMenu(undefined);
      // `flushPending` e nao `clearTimeout`: um arraste ainda nao commitado
      // entra na mesma escrita, em vez de ser descartado.
      onChange(fn(flushPending(topologyRef.current)));
    },
    [flushPending, onChange]
  );

  const cancelLinking = useCallback(() => {
    setLinking(undefined);
    setCursor(undefined);
  }, []);

  const handleAdd = useCallback(
    (kind: ElementKind) => {
      if (!menu) {
        return;
      }
      const position = screenToFlowPosition({ x: menu.x, y: menu.y });
      mutate((current) => addElement(current, kind, position));
    },
    [menu, mutate, screenToFlowPosition]
  );

  const handleDelete = useCallback((id: string) => mutate((current) => removeElements(current, [id])), [mutate]);
  const handleDuplicate = useCallback((id: string) => mutate((current) => duplicateElement(current, id)), [mutate]);
  const handleReverse = useCallback((id: string) => mutate((current) => reverseEdge(current, id)), [mutate]);
  const handleReorder = useCallback(
    (id: string, command: OrderCommand) => mutate((current) => reorderElement(current, id, command)),
    [mutate]
  );

  const handleLink = useCallback((id: string) => {
    setMenu(undefined);
    setLinking({ sourceId: id });
    setCursor(undefined);
  }, []);

  /**
   * Fecha o gesto de linkagem. O `connect` e a unica escrita: cancelar nunca
   * cria elemento, e um alvo invalido nao chega ate aqui porque o clique so e
   * despachado quando `canConnect` aprovou.
   */
  const finishLinking = useCallback(
    (targetId: string) => {
      const source = linking?.sourceId;
      if (!source || !canConnect(topologyRef.current, source, targetId)) {
        return;
      }

      cancelLinking();
      mutate((current) => {
        const next = connect(current, source, targetId);
        // O id e gerado dentro de `connect`; procurar o par de volta e o que
        // permite abrir o Inspector ja na aresta criada.
        pendingEdgeSelection.current = findEdgeBetween(next, source, targetId)?.id;
        return next;
      });
    },
    [linking, cancelLinking, mutate]
  );

  const onNodesDelete = useCallback(
    (deleted: TopoFlowNode[]) =>
      mutate((current) =>
        removeElements(
          current,
          deleted.map((node) => node.id)
        )
      ),
    [mutate]
  );

  const onEdgesDelete = useCallback(
    (deleted: TopoFlowEdge[]) =>
      mutate((current) =>
        removeElements(
          current,
          deleted.map((edge) => edge.id)
        )
      ),
    [mutate]
  );

  const openPaneMenu = useCallback(
    (event: React.MouseEvent | MouseEvent) => {
      // Suprime o menu nativo do browser mesmo quando nao abrimos o nosso: o
      // menu do navegador sobre o canvas nao serve para nada aqui.
      event.preventDefault();
      if (linking) {
        cancelLinking();
        return;
      }
      setMenu({ kind: 'pane', x: event.clientX, y: event.clientY });
    },
    [linking, cancelLinking]
  );

  const openNodeMenu = useCallback(
    (event: React.MouseEvent, node: TopoFlowNode) => {
      event.preventDefault();
      if (linking) {
        cancelLinking();
        return;
      }

      const found = findElement(topologyRef.current, node.id);
      if (!found) {
        return;
      }
      setMenu({
        kind: 'element',
        elementKind: found.kind,
        x: event.clientX,
        y: event.clientY,
        id: node.id,
        label: node.id,
      });
    },
    [linking, cancelLinking]
  );

  const openEdgeMenu = useCallback(
    (event: React.MouseEvent, edge: TopoFlowEdge) => {
      event.preventDefault();
      if (linking) {
        cancelLinking();
        return;
      }
      setMenu({
        kind: 'edge',
        x: event.clientX,
        y: event.clientY,
        id: edge.id,
        label: edge.id,
        hasWaypoints: Boolean(findEdge(topologyRef.current, edge.id)?.waypoints?.length),
      });
    },
    [linking, cancelLinking]
  );

  /* --- Trajeto das conexoes (vertices) -------------------------------------- */

  const [vertex, setVertex] = useState<SelectedVertex | undefined>();
  const vertexRef = useRef(vertex);
  useEffect(() => {
    vertexRef.current = vertex;
  });

  const setWaypoints = useCallback(
    (edgeId: string, waypoints: Waypoint[] | undefined) =>
      mutate((current) => updateEdge(current, edgeId, { waypoints: waypoints?.length ? waypoints : undefined })),
    [mutate]
  );

  const openVertexMenu = useCallback((event: React.MouseEvent, target: SelectedVertex) => {
    setVertex(target);
    setMenu({
      kind: 'vertex',
      x: event.clientX,
      y: event.clientY,
      id: target.edgeId,
      label: target.edgeId,
      index: target.index,
    });
  }, []);

  const removeVertex = useCallback(
    (edgeId: string, index: number) => {
      const list = (findEdge(topologyRef.current, edgeId)?.waypoints ?? []).filter((_, i) => i !== index);
      setWaypoints(edgeId, list);
      setVertex(undefined);
    },
    [setWaypoints]
  );

  /** "Adicionar vertice aqui": no ponto do clique direito, no segmento mais proximo. */
  const addVertexAtMenu = useCallback(
    (edgeId: string) => {
      const edge = findEdge(topologyRef.current, edgeId);
      if (!edge || !menu) {
        return;
      }
      const at = screenToFlowPosition({ x: menu.x, y: menu.y });
      const point = { x: Math.round(at.x), y: Math.round(at.y) };
      const box = (id: string) => {
        const node = getInternalNode(id);
        const { width = 0, height = 0 } = node?.measured ?? {};
        const pos = node?.internals.positionAbsolute ?? { x: 0, y: 0 };
        return { cx: pos.x + width / 2, cy: pos.y + height / 2, w: width, h: height };
      };
      const geometry = edgeGeometry(box(edge.source), box(edge.target), edge.shape, edge.waypoints);
      const index = waypointIndexAt(point, geometry.points);
      const list = [...(edge.waypoints ?? [])];
      list.splice(index, 0, point);
      setWaypoints(edgeId, list);
      setVertex({ edgeId, index });
    },
    [menu, screenToFlowPosition, getInternalNode, setWaypoints]
  );

  const edgeActions = useMemo<EdgeActions>(
    () => ({ setWaypoints, vertex, selectVertex: setVertex, openVertexMenu, linking: Boolean(linking) }),
    [setWaypoints, vertex, openVertexMenu, linking]
  );

  /**
   * Com um vertice selecionado, Delete remove o vertice — nao a conexao inteira,
   * que e o que o React Flow faria com a aresta selecionada.
   */
  const onBeforeDelete = useCallback(
    async ({ nodes: n, edges: e }: { nodes: TopoFlowNode[]; edges: TopoFlowEdge[] }) => {
      const selectedVertex = vertexRef.current;
      if (selectedVertex && e.some((edge) => edge.id === selectedVertex.edgeId)) {
        removeVertex(selectedVertex.edgeId, selectedVertex.index);
        return false;
      }
      return { nodes: n, edges: e };
    },
    [removeVertex]
  );

  const [toast, setToast] = useState<ShotResult | undefined>();
  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = setTimeout(() => setToast(undefined), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) {
        return;
      }
      mutate((current) => connect(current, connection.source, connection.target));
    },
    [mutate]
  );

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: TopoFlowNode) => {
      if (linking) {
        finishLinking(node.id);
      }
    },
    [linking, finishLinking]
  );

  const onPaneClick = useCallback(() => {
    setMenu(undefined);
    setVertex(undefined);
    cancelLinking();
  }, [cancelLinking]);

  /** Pan e zoom nao cancelam a linkagem, mas fecham o menu — que fica preso a
   *  coordenadas de tela e sairia do lugar. */
  useOnViewportChange({ onStart: () => setMenu(undefined) });

  useEffect(() => {
    if (!linking) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        cancelLinking();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [linking, cancelLinking]);

  const onMouseMove = useCallback(
    (event: React.MouseEvent) => {
      if (linking) {
        setCursor(screenToFlowPosition({ x: event.clientX, y: event.clientY }));
      }
    },
    [linking, screenToFlowPosition]
  );

  const ghostFrom = linking ? centerOfNode(getInternalNode(linking.sourceId)) : undefined;

  /* --- Sincronia com o painel de Layers (`instanceState`) ------------------ */

  /**
   * Tudo o que esta selecionado, nos e arestas.
   *
   * A chave de texto existe para dar **identidade estavel** ao array: `nodes` e
   * `edges` mudam de referencia a cada quadro de um arraste, e um array novo a
   * cada mudanca republicaria o `instanceState` o gesto inteiro — o painel de
   * opcoes re-renderizando 60 vezes por segundo para dizer a mesma coisa.
   */
  const selectedKey = useMemo(
    () =>
      [
        ...nodes.filter((node) => node.selected).map((node) => node.id),
        ...edges.filter((edge) => edge.selected).map((edge) => edge.id),
      ].join('\u0000'),
    [nodes, edges]
  );
  const selectedIds = useMemo(() => (selectedKey ? selectedKey.split('\u0000') : EMPTY_SELECTION), [selectedKey]);

  /**
   * Traz o elemento para o centro da area visivel, preservando o zoom atual.
   * `fitView` sobre um elemento so daria um salto de zoom desconcertante.
   *
   * A aresta nao tem posicao propria: o alvo e o meio do caminho entre as
   * pontas. Se o no ainda nao foi medido, nao ha para onde ir — a selecao
   * continua valendo, so nao ha movimento de camera.
   */
  const revealElement = useCallback(
    (id: string) => {
      const target = centerOfNode(getInternalNode(id)) ?? edgeMidpoint(topologyRef.current, id, getInternalNode);

      if (target) {
        setCenter(target.x, target.y, { zoom: getZoom(), duration: 300 });
      }
    },
    [getInternalNode, setCenter, getZoom]
  );

  const selectFromLayer = useCallback(
    (id: string) => {
      setNodes((current) => current.map((node) => ({ ...node, selected: node.id === id })));
      setEdges((current) => current.map((edge) => ({ ...edge, selected: edge.id === id })));
      revealElement(id);
    },
    [revealElement]
  );

  // Lido dentro do efeito de publicacao. Manter a referencia fora das deps
  // evita o laco caso o Grafana entregue uma funcao nova a cada render.
  const publishRef = useRef(onInstanceStateChange);
  useEffect(() => {
    publishRef.current = onInstanceStateChange;
  });

  useEffect(() => {
    const state: TopoInstanceState = { selected: selectedIds, select: selectFromLayer };
    publishRef.current?.(state);
  }, [selectedIds, selectFromLayer]);

  /**
   * Topologia sem nenhum elemento. Arestas nao entram na conta: elas exigem
   * duas pontas, entao nao existe topologia so de arestas.
   */
  const vazia =
    topology.nodes.length === 0 &&
    topology.points.length === 0 &&
    topology.postits.length === 0 &&
    topology.texts.length === 0 &&
    topology.images.length === 0;

  return (
    /* O provider fica **fora** do `<ReactFlow>` para alcancar tambem o que e
       portalizado a partir dos nos — o painel de hover do `Tooltip` nasce no
       final do body, mas o React o mantem nesta arvore de contexto. */
    <TopoTimeContext.Provider value={tempo}>
      <EdgeActionsContext.Provider value={edgeActions}>
        <HoverLayerContext.Provider value={hoverLayer}>
          <div
            ref={setWrapper}
            className={styles.wrapper}
            style={{ width, height }}
            data-linking={linking ? true : undefined}
            onMouseMove={onMouseMove}
          >
            <ReactFlow<TopoFlowNode, TopoFlowEdge>
              nodes={nodesWithFrames}
              edges={edgesWithFrames}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodesDelete={onNodesDelete}
              onEdgesDelete={onEdgesDelete}
              onBeforeDelete={onBeforeDelete}
              onConnect={onConnect}
              onNodeClick={onNodeClick}
              onPaneContextMenu={editable ? openPaneMenu : preventNativeMenu}
              onNodeContextMenu={editable ? openNodeMenu : preventNativeMenu}
              onEdgeContextMenu={editable ? openEdgeMenu : preventNativeMenu}
              onPaneClick={onPaneClick}
              // Durante a linkagem o arraste e a selecao por area saem do caminho: o
              // gesto em curso e apontar um alvo, nao mover a cena.
              nodesDraggable={editable && !linking}
              selectionKeyCode={linking ? null : undefined}
              nodesConnectable={editable}
              elementsSelectable={editable}
              edgesFocusable={editable}
              connectionMode={ConnectionMode.Loose}
              // Default do React Flow e `true`, o que reescreve o zIndex do no ao
              // seleciona-lo e quebra a ordem de camadas que `useFlowElements` monta.
              elevateNodesOnSelect={false}
              deleteKeyCode={editable ? ['Delete', 'Backspace'] : null}
              snapToGrid={canvas.snapToGrid}
              snapGrid={[canvas.gridSize, canvas.gridSize]}
              colorMode={theme.isDark ? 'dark' : 'light'}
              proOptions={{ hideAttribution: true }}
              fitView
            >
              {canvas.showGrid && (
                <Background
                  variant={BackgroundVariant.Dots}
                  gap={canvas.gridSize}
                  size={1.6}
                  color={tfPalette(theme).grid}
                />
              )}

              {ghostFrom && cursor && <GhostConnection from={ghostFrom} to={cursor} />}
            </ReactFlow>

            <CanvasControls wrapperRef={wrapperRef} title={title} onShot={setToast} />

            {banners.length > 0 && (
              <div className={styles.banners} onMouseDown={(event) => event.stopPropagation()}>
                {banners.map((banner) => (
                  <div key={banner.title} className={styles.banner} role="alert">
                    <span className={styles.bannerPill}>AVISO</span>
                    <div className={styles.bannerText}>
                      <span className={styles.bannerTitle}>{banner.title}</span>
                      <span className={styles.bannerBody}>{banner.body}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {linking && (
              <div className={styles.linkHint}>
                {`Linkar a partir de ${linking.sourceId} — clique num alvo válido. Esc, clique no fundo ou botão direito cancelam.`}
              </div>
            )}

            {toast && (
              <div className={styles.toast} data-error={toast.ok ? undefined : true}>
                <span className={styles.toastTitle}>{toast.title}</span>
                <span className={styles.toastBody}>{toast.body}</span>
              </div>
            )}

            {/*
          Painel recem-adicionado: a topologia nasce vazia (ver
          `model/defaults.ts`) e a tela nao tem nada que diga como comecar. O
          gesto de criar elemento e o clique direito, que ninguem descobre
          olhando para uma grade em branco.

          So em modo de edicao: em modo de visualizacao um canvas vazio e um
          canvas vazio, e a dica ensinaria um gesto que ali nao funciona. E
          `pointerEvents: 'none'` porque o alvo do clique direito e o canvas
          atras dela — a dica nao pode ficar no caminho do que ela ensina.
        */}
            {editable && vazia && (
              <div className={styles.hint}>
                <p>Clique com o botão direito no canvas para adicionar elementos.</p>
                <p>Ou use o botão “Adicionar elemento” no painel de opções, à direita.</p>
              </div>
            )}

            {menu && (
              <CanvasContextMenu
                state={relativeTo(menu, hoverLayer)}
                bounds={{ width, height }}
                onClose={() => setMenu(undefined)}
                onAdd={handleAdd}
                onLink={handleLink}
                onDuplicate={handleDuplicate}
                onDelete={handleDelete}
                onReorder={handleReorder}
                onReverse={handleReverse}
                onAddVertex={addVertexAtMenu}
                onRemoveVertex={removeVertex}
                onClearPath={(id) => setWaypoints(id, undefined)}
              />
            )}
          </div>
        </HoverLayerContext.Provider>
      </EdgeActionsContext.Provider>
    </TopoTimeContext.Provider>
  );
}

/**
 * Reconstroi a cena preservando o que estava selecionado.
 *
 * O efeito de ressincronia monta os nos e arestas do zero a partir da
 * topologia, e `toFlowNodes`/`toFlowEdges` nao conhecem selecao — ela e estado
 * de UI e nunca foi para `options`. Sem este passo, **toda escrita apagaria a
 * selecao**: o caso que expos isso foi a edicao em massa, onde mudar o estilo de
 * quatro conexoes desfazia a selecao e obrigava a refaze-la para o campo
 * seguinte. Mas o incomodo ja existia no caminho de um elemento so — editar um
 * no pelo Layer o desmarcava no canvas.
 *
 * Casa por id, e nao por posicao: entre as duas listas pode ter entrado ou
 * saido elemento, e o indice diria respeito a outro.
 */
export function keepSelection<T extends { id: string; selected?: boolean }>(next: T[], previous: T[]): T[] {
  const selected = new Set(previous.filter((item) => item.selected).map((item) => item.id));
  if (selected.size === 0) {
    return next;
  }

  return next.map((item) => (selected.has(item.id) ? { ...item, selected: true } : item));
}

/** Em modo View nao ha menu, mas o do browser tambem nao deve aparecer. */
function preventNativeMenu(event: React.MouseEvent | MouseEvent) {
  event.preventDefault();
}

function findEdge(topology: Topology, id: string) {
  return topology.edges.find((edge) => edge.id === id);
}

/** O menu guarda coordenadas de tela (o clique); ele e desenhado dentro do canvas. */
function relativeTo(menu: MenuState, wrapper: HTMLElement | null): MenuState {
  const rect = wrapper?.getBoundingClientRect();
  return rect ? { ...menu, x: menu.x - rect.left, y: menu.y - rect.top } : menu;
}

type GetInternalNode = ReturnType<typeof useReactFlow>['getInternalNode'];

/** Meio do caminho entre as pontas da aresta, quando as duas ja foram medidas. */
function edgeMidpoint(topology: Topology, id: string, getNode: GetInternalNode): XYPosition | undefined {
  const edge = topology.edges.find((item) => item.id === id);
  if (!edge) {
    return undefined;
  }

  const source = centerOfNode(getNode(edge.source));
  const target = centerOfNode(getNode(edge.target));
  if (!source || !target) {
    return undefined;
  }

  return { x: (source.x + target.x) / 2, y: (source.y + target.y) / 2 };
}

function centerOfNode(node: ReturnType<ReturnType<typeof useReactFlow>['getInternalNode']>): XYPosition | undefined {
  const { width, height } = node?.measured ?? {};
  if (!node || !width || !height) {
    return undefined;
  }
  return {
    x: node.internals.positionAbsolute.x + width / 2,
    y: node.internals.positionAbsolute.y + height / 2,
  };
}

/**
 * Reescreve o `data` de cada no. Um `switch` e nao um spread condicional:
 * so estreitando a uniao o TypeScript sabe que o `data` de cada tipo continua
 * sendo o dele. Postits ficam de fora — sao estaticos por decisao do PRD, e nao
 * sao alvo de conexao.
 */
export function withNodeData(
  nodes: TopoFlowNode[],
  frames: DataFrame[],
  editable: boolean,
  linkSourceId: string | undefined,
  topology: Topology
): TopoFlowNode[] {
  const roleOf = (id: string): LinkRole | undefined => {
    if (!linkSourceId) {
      return undefined;
    }
    if (id === linkSourceId) {
      return 'source';
    }
    // A mesma regra que valida o clique decide o realce, para que nunca
    // discordem: alvo realcado e alvo que aceita conexao.
    return canConnect(topology, linkSourceId, id) ? 'valid' : 'invalid';
  };

  return nodes.map((node): TopoFlowNode => {
    switch (node.type) {
      case 'deviceNode':
        return { ...node, data: { ...node.data, frames, editable, link: roleOf(node.id) } };
      case 'pointNode':
        return { ...node, data: { ...node.data, frames, editable, link: roleOf(node.id) } };
      case 'textNode':
        return { ...node, data: { ...node.data, frames, editable } };
      /**
       * A imagem ficou **de fora** desta funcao ate aqui, e caia no `default`
       * abaixo — que devolve o no intacto. O efeito era a imagem congelar os
       * frames da montagem: legenda com `${metrica}` e placa em modo Estado
       * paravam no tempo, e so voltavam a andar quando alguma outra coisa
       * mudava a topologia ou a pagina era recarregada.
       *
       * Era o "cache" relatado: um value mapping recem-criado (`1` -> `UP`)
       * vive em `field.display`, que chega em frames novos; sem eles, a legenda
       * continuava exibindo o valor cru de antes do mapeamento.
       *
       * `editable` e `link` vinham pelo mesmo caminho e sofriam do mesmo mal —
       * a alca de redimensionamento nao aparecia ao entrar em modo de edicao, e
       * a imagem nunca se realcava como alvo valido no modo Linkar, embora
       * `canConnect` a aceite.
       */
      case 'imageNode':
        return { ...node, data: { ...node.data, frames, editable, link: roleOf(node.id) } };
      // Postit nao recebe `frames`, mas recebe `editable`: e o que faz a alca de
      // redimensionamento aparecer e sumir ao alternar o modo de edicao. Vindo
      // so de `toFlowNodes`, a flag ficaria congelada — aquele efeito nao roda
      // quando muda apenas `editable`, porque a revisao da topologia e a mesma.
      case 'postitNode':
        return { ...node, data: { ...node.data, editable } };
      default:
        return node;
    }
  });
}

const getStyles = (theme: GrafanaTheme2) => {
  const p = tfPalette(theme);
  return {
    hint: css({
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      pointerEvents: 'none',
      textAlign: 'center',
      padding: theme.spacing(2),
      font: `14px/1.5 ${FONT_SANS}`,
      color: p.tx2,

      '& p': {
        margin: 0,
      },
    }),

    wrapper: css({
      // O React Flow mede o container; `100%` dentro de um painel redimensionavel
      // rende zero na primeira medicao (risco listado no §10 do PRD).
      position: 'relative',
      overflow: 'hidden',
      borderRadius: 8,
      background: p.sup,
      fontFamily: FONT_SANS,

      /**
       * Durante o screenshot, tudo congela no estado de repouso: a captura
       * serializa os estilos **computados** no instante em que acontece, e sem
       * isto a foto sairia com o elemento alarmado no meio do pulso ou apagado.
       */
      '&[data-capturing] *': {
        animation: 'none !important',
      },

      // Selecao por area (Shift+arrastar): borda e 10% do violeta de acento.
      '& .react-flow__selection, & .react-flow__nodesselection-rect': {
        border: `1px solid ${p.ac}`,
        background: `color-mix(in oklab, ${p.ac} 10%, transparent)`,
        borderRadius: 0,
      },

      // Enquanto se aponta um alvo, o cursor diz o que o gesto espera. Postits e
      // textos nao sao conectaveis, entao herdam `not-allowed` daqui — so nos e
      // points reescrevem para `crosshair` a partir do proprio `data.link`.
      '&[data-linking]': {
        cursor: 'crosshair',

        '& .react-flow__node': {
          cursor: 'not-allowed',
        },
      },
    }),

    banners: css({
      position: 'absolute',
      left: 12,
      right: 12,
      top: 12,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      zIndex: 6,
    }),
    banner: css({
      display: 'flex',
      gap: 10,
      padding: '10px 14px',
      background: p.sup,
      border: `1px solid color-mix(in oklab, ${p.at} 60%, transparent)`,
      borderRadius: 8,
      boxShadow: `0 6px 18px ${p.shadow}`,
    }),
    bannerPill: css({
      flex: 'none',
      height: 'fit-content',
      marginTop: 1,
      padding: '2px 6px',
      borderRadius: 4,
      background: p.at,
      color: p['on-at'],
      font: `600 10px ${FONT_MONO}`,
    }),
    bannerText: css({ display: 'flex', flexDirection: 'column', gap: 3 }),
    bannerTitle: css({ font: `600 13px ${FONT_SANS}`, color: p.tf }),
    bannerBody: css({ font: `12.5px/1.45 ${FONT_SANS}`, color: p.tx2 }),

    linkHint: css({
      position: 'absolute',
      left: '50%',
      top: 12,
      transform: 'translateX(-50%)',
      padding: '7px 12px',
      background: p.sup,
      border: `1px solid ${p.ac}`,
      borderRadius: 8,
      font: `500 12px ${FONT_SANS}`,
      color: p.tx,
      zIndex: 6,
      pointerEvents: 'none',
      whiteSpace: 'nowrap',
    }),

    toast: css({
      position: 'absolute',
      right: 14,
      bottom: 14,
      maxWidth: 380,
      padding: '10px 14px',
      background: p.sup,
      border: `1px solid ${p.borda}`,
      borderRadius: 9,
      boxShadow: `0 10px 28px ${p.shadow}`,
      display: 'flex',
      flexDirection: 'column',
      gap: 3,
      zIndex: 9,
      '&[data-error]': { borderColor: `color-mix(in oklab, ${p.cr} 60%, transparent)` },
    }),
    toastTitle: css({
      font: `600 13px ${FONT_SANS}`,
      color: p.tf,
      '[data-error] > &': { color: p['cr-t'] },
    }),
    toastBody: css({ font: `12px ${FONT_MONO}`, color: p.tx2, overflowWrap: 'anywhere' }),
  };
};
