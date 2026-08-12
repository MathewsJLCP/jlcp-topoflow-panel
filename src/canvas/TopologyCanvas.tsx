import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { css } from '@emotion/css';
import { DataFrame, GrafanaTheme2 } from '@grafana/data';
import { useStyles2, useTheme2, usePanelContext } from '@grafana/ui';
import {
  Background,
  BackgroundVariant,
  Connection,
  ConnectionMode,
  Controls,
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
} from '../model/mutations';
import { CanvasOptions, ElementKind, Topology } from '../model/types';
import { TopoInstanceState } from '../panel/instanceState';
import { CanvasContextMenu, MenuState } from './CanvasContextMenu';
import { GhostConnection } from './GhostConnection';
import { edgeTypes } from './edges';
import { LinkRole, TopoFlowEdge, TopoFlowNode } from './flowTypes';
import { nodeTypes } from './nodes';
import { toFlowEdges, toFlowNodes } from './useFlowElements';

import '@xyflow/react/dist/style.css';

/** Escrita em `panel.options` so depois que o gesto de arraste esfria. */
const POSITION_COMMIT_DELAY_MS = 200;

export interface TopologyCanvasProps {
  topology: Topology;
  frames: DataFrame[];
  canvas: CanvasOptions;
  editable: boolean;
  width: number;
  height: number;
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

function CanvasInner({ topology, frames, canvas, editable, width, height, onChange }: TopologyCanvasProps) {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const { screenToFlowPosition, getInternalNode, setCenter, getZoom } = useReactFlow();
  const { onInstanceStateChange } = usePanelContext();

  const [menu, setMenu] = useState<MenuState | undefined>();

  /**
   * Modo Linkar. Vive no estado local, e nao na topologia, porque um gesto pela
   * metade nao e um fato do documento — so o `connect` final vai para
   * `panel.options`, e por isso o undo do dashboard nao ve nenhum passo
   * intermediario.
   */
  const [linking, setLinking] = useState<{ sourceId: string } | undefined>();
  const [cursor, setCursor] = useState<XYPosition | undefined>();

  const [nodes, setNodes] = useState<TopoFlowNode[]>(() => toFlowNodes(topology, frames, editable));
  const [edges, setEdges] = useState<TopoFlowEdge[]>(() => toFlowEdges(topology, frames));

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
    setNodes(toFlowNodes(topology, frames, editable));

    // A selecao e aplicada aqui, e nao logo apos o `connect`, porque este
    // efeito reconstroi as arestas do zero e apagaria qualquer selecao posta
    // antes dele.
    const selectedId = pendingEdgeSelection.current;
    pendingEdgeSelection.current = undefined;
    setEdges(
      toFlowEdges(topology, frames).map((edge) => (edge.id === selectedId ? { ...edge, selected: true } : edge))
    );
  }, [revision, topology, frames, editable]);

  /**
   * Series novas nao mudam a topologia, so o que os nos exibem. Injetar os
   * frames no render (em vez de guardar no estado e sincronizar por efeito)
   * evita a cascata de renders e mantem selecao e posicao em voo intactas.
   */
  const nodesWithFrames = useMemo(
    () => withNodeData(nodes, frames, editable, linking?.sourceId, topology),
    [nodes, frames, editable, linking, topology]
  );
  const edgesWithFrames = useMemo(
    () => edges.map((edge) => (edge.data ? { ...edge, data: { ...edge.data, frames } } : edge)),
    [edges, frames]
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
   * Arraste: o React Flow ja esta desenhando o resultado, entao marcamos a
   * revisao como aplicada para o efeito acima nao reconstruir os nos no meio do
   * gesto — o que faria o elemento pular de volta.
   */
  const schedulePositionCommit = useCallback(() => {
    clearTimeout(commitTimer.current);
    commitTimer.current = setTimeout(() => {
      const updates = nodesRef.current.map((node) => ({ id: node.id, position: node.position }));
      const next = moveElements(topologyRef.current, updates);
      appliedRevision.current = JSON.stringify(next);
      onChange(next);
    }, POSITION_COMMIT_DELAY_MS);
  }, [onChange]);

  /**
   * Redimensionamento do postit. Mesmo debounce do arraste, e pelo mesmo motivo:
   * a alca emite dezenas de mudancas por gesto e cada uma reescreveria `options`.
   *
   * Grava posicao junto porque arrastar a alca da esquerda ou do topo **move** o
   * no: so o tamanho deixaria o retangulo saltando de volta ao soltar.
   */
  const scheduleSizeCommit = useCallback(() => {
    clearTimeout(commitTimer.current);
    commitTimer.current = setTimeout(() => {
      let next = topologyRef.current;

      for (const node of nodesRef.current) {
        if (node.type !== 'postitNode' || !node.width || !node.height) {
          continue;
        }
        next = resizeElement(next, node.id, { width: node.width, height: node.height });
      }

      next = moveElements(
        next,
        nodesRef.current.map((node) => ({ id: node.id, position: node.position }))
      );

      appliedRevision.current = JSON.stringify(next);
      onChange(next);
    }, POSITION_COMMIT_DELAY_MS);
  }, [onChange]);

  const onNodesChange = useCallback(
    (changes: Array<NodeChange<TopoFlowNode>>) => {
      setNodes((current) => applyNodeChanges(changes, current));

      // Selecao nao vai para `options`: e estado de UI.
      if (changes.some((change) => change.type === 'position')) {
        schedulePositionCommit();
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
        scheduleSizeCommit();
      }
    },
    [schedulePositionCommit, scheduleSizeCommit]
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
      clearTimeout(commitTimer.current);
      onChange(fn(topologyRef.current));
    },
    [onChange]
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
    (deleted: TopoFlowNode[]) => mutate((current) => removeElements(current, deleted.map((node) => node.id))),
    [mutate]
  );

  const onEdgesDelete = useCallback(
    (deleted: TopoFlowEdge[]) => mutate((current) => removeElements(current, deleted.map((edge) => edge.id))),
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
        label: `${edge.source} → ${edge.target}`,
      });
    },
    [linking, cancelLinking]
  );

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

  const selectedId = useMemo(
    () => nodes.find((node) => node.selected)?.id ?? edges.find((edge) => edge.selected)?.id,
    [nodes, edges]
  );

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
      const target =
        centerOfNode(getInternalNode(id)) ?? edgeMidpoint(topologyRef.current, id, getInternalNode);

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
    const state: TopoInstanceState = { selected: selectedId, select: selectFromLayer };
    publishRef.current?.(state);
  }, [selectedId, selectFromLayer]);

  return (
    <div
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
        {canvas.showGrid && <Background variant={BackgroundVariant.Dots} gap={canvas.gridSize} size={1} />}
        <Controls showInteractive={false} />

        {ghostFrom && cursor && <GhostConnection from={ghostFrom} to={cursor} />}
      </ReactFlow>

      {menu && (
        <CanvasContextMenu
          state={menu}
          onClose={() => setMenu(undefined)}
          onAdd={handleAdd}
          onLink={handleLink}
          onDuplicate={handleDuplicate}
          onDelete={handleDelete}
          onReorder={handleReorder}
          onReverse={handleReverse}
        />
      )}
    </div>
  );
}

/** Em modo View nao ha menu, mas o do browser tambem nao deve aparecer. */
function preventNativeMenu(event: React.MouseEvent | MouseEvent) {
  event.preventDefault();
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
function withNodeData(
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
        return { ...node, data: { ...node.data, frames } };
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

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    // O React Flow mede o container; `100%` dentro de um painel redimensionavel
    // rende zero na primeira medicao (risco listado no §10 do PRD).
    position: 'relative',
    overflow: 'hidden',
    borderRadius: theme.shape.radius.default,
    background: theme.colors.background.canvas,

    // O `Background` do React Flow desenha os pontos com a cor herdada; sem
    // isto ele usa a propria (#91919a no claro, #333 no escuro) e a grade
    // destoa do resto do painel.
    '& .react-flow__background': {
      color: theme.colors.border.weak,
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
});
