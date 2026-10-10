import React, { useContext, useRef, useState } from 'react';
import { css, cx } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, useTheme2 } from '@grafana/ui';
import { EdgeLabelRenderer, EdgeProps, InternalNode, useInternalNode, useReactFlow, useStore } from '@xyflow/react';

import { resolveTemplate } from '../../data/dimensions';
import { resolveElementColor } from '../../data/elementColor';
import { DEFAULT_EDGE_WIDTH } from '../../model/sizes';
import { TopoImage, Waypoint } from '../../model/types';
import { ResolvedIcon, isKnownIcon, resolveIcon } from '../../icons';
import { IconMask, silhouetteDistance, useIconMask } from '../../icons/iconMask';
import { ICON_FILL } from '../nodes/ImageNode';
import { FONT_MONO, TfPalette, tfPalette } from '../../theme/palette';
import { motionOnly, tfBreathe, tfDash } from '../../theme/motion';
import { TopoFlowEdge } from '../flowTypes';
import { edgeAlertClass } from '../alertAnimation';
import { stateLook, strokeColor } from '../look';
import { ElementHover } from '../ElementHover';
import { EdgeActionsContext } from './EdgeActions';
import { EndBox, Pt, arrowPath, edgeGeometry, waypointIndexAt } from './path';
import { snapPoint } from '../grouping';

/** Largura minima da faixa clicavel em volta da linha. */
const HIT_WIDTH = 14;

/** Abaixo disto, em px de tela, o segmento nao ganha o `+` de vertice. */
const MIN_SEGMENT_FOR_PLUS = 44;

/**
 * A caixa de cada ponta, no espaco do canvas.
 *
 * Da Imagem vale a caixa da figura (`size`), nao a medida do no: a legenda
 * embaixo faz parte do no, mas a linha deve parar na figura. O point recorta
 * num circulo.
 */
function endBox(node: InternalNode | undefined, fallback: Pt, mask: IconMask | undefined): EndBox {
  const { width, height } = node?.measured ?? {};
  if (!node || !width || !height) {
    return { cx: fallback.x, cy: fallback.y, w: 0, h: 0 };
  }
  const { x, y } = node.internals.positionAbsolute;
  if (node.type === 'pointNode') {
    return { cx: x + width / 2, cy: y + height / 2, w: width, h: height, round: true };
  }
  const image = imageOf(node);
  if (image) {
    const { size, background } = image;
    const box: EndBox = { cx: x + size.width / 2, cy: y + size.height / 2, w: size.width, h: size.height };
    // Sem fundo a caixa e invisivel: a linha para na tinta do desenho.
    const icon = imageIcon(node);
    if (!background && icon && mask) {
      box.silhouette = (ux, uy) => silhouetteDistance(mask, { w: size.width, h: size.height }, ICON_FILL, ux, uy);
    }
    return box;
  }
  return { cx: x + width / 2, cy: y + height / 2, w: width, h: height };
}

function imageOf(node: InternalNode | undefined): TopoImage | undefined {
  return node?.type === 'imageNode' ? (node.data as { element?: TopoImage }).element : undefined;
}

function imageIcon(node: InternalNode | undefined): ResolvedIcon | undefined {
  const src = imageOf(node)?.src;
  return src && isKnownIcon(src) ? resolveIcon(src) : undefined;
}

/**
 * Conexao, no desenho do mockup da v1.4.
 *
 * A cor e a do estado (cinza `rot` em repouso sem Base, `apa` sem dado). O traco
 * tracejado e o pontilhado sao proporcionais a espessura, e a seta no destino
 * tambem. Com vertices, a linha e uma polilinha com uma seta no meio de cada
 * segmento.
 *
 * Selecionada no editor, a conexao mostra os vertices (quadrados, arrastaveis;
 * duplo clique ou Delete remove) e um `+` em cada segmento, que cria um vertice
 * ao ser arrastado. Duplo clique na linha tambem cria.
 */
export function TopoEdge({
  id,
  data,
  selected,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
}: EdgeProps<TopoFlowEdge>) {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const p = tfPalette(theme);
  const actions = useContext(EdgeActionsContext);
  const zoom = useStore((s) => s.transform[2]);
  const { screenToFlowPosition } = useReactFlow();

  const element = data?.element;
  const frames = data?.frames ?? [];
  const editable = Boolean(data?.editable);

  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);

  /** Trajeto durante o arraste de um vertice, antes de ser gravado. */
  const [draft, setDraft] = useState<Waypoint[] | undefined>();
  const waypoints = draft ?? element?.waypoints;

  const sourceMask = useIconMask(imageIcon(sourceNode));
  const targetMask = useIconMask(imageIcon(targetNode));

  const geometry = edgeGeometry(
    endBox(sourceNode, { x: sourceX, y: sourceY }, sourceMask),
    endBox(targetNode, { x: targetX, y: targetY }, targetMask),
    element?.shape ?? 'curved',
    waypoints,
    data?.parallel
  );

  const accent = element
    ? resolveElementColor(element.color, frames, theme, {
        trigger: element.trigger,
        thresholds: element.thresholds,
        extraMetrics: element.extraMetrics,
      })
    : { state: 'neutral' as const };
  const look = stateLook(accent, element?.alert, theme);
  const color = strokeColor(look, p);

  const width = element?.width ?? DEFAULT_EDGE_WIDTH;
  const alertClass = edgeAlertClass(accent, element?.alert);
  const flow = alertClass ? 'none' : (element?.animation ?? 'none');

  let dash: string | undefined =
    element?.style === 'dashed'
      ? `${width * 4} ${width * 2.5}`
      : element?.style === 'dotted'
        ? `0.01 ${width * 2.4}`
        : undefined;
  if (flow === 'dash-flow') {
    dash = `${Math.max(8, width * 4)} ${Math.max(6, width * 3)}`;
  }
  const lineClass = alertClass ?? FLOW_CLASS[flow];
  const arrowClass = alertClass ?? (flow === 'pulse' ? FLOW_CLASS.pulse : undefined);

  const labelText = element?.label ? resolveTemplate(element.label, frames) : '';
  const labelLines = labelText ? labelText.split('\n') : [];
  const labelAt = labelText ? geometry.label(labelLines) : undefined;

  const editing = editable && selected && !actions?.linking;
  const vertex = actions?.vertex?.edgeId === id ? actions.vertex.index : undefined;

  // --- edicao do trajeto --------------------------------------------------
  const dragRef = useRef<{ index: number; list: Waypoint[] } | undefined>();

  // O trajeto gravado chegou de volta: o rascunho ja nao tem o que dizer.
  // Ajuste durante o render, e nao em efeito, como no resto do plugin.
  const [savedWaypoints, setSavedWaypoints] = useState(element?.waypoints);
  if (savedWaypoints !== element?.waypoints) {
    setSavedWaypoints(element?.waypoints);
    setDraft(undefined);
  }

  const toFlow = (event: { clientX: number; clientY: number }): Waypoint => {
    const point = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    // Com o grid ligado, o vertice encaixa nele como os elementos: e o que deixa
    // o trajeto em angulos retos sem precisar acertar o pixel.
    return snapPoint({ x: Math.round(point.x), y: Math.round(point.y) }, actions?.grid);
  };

  const startDrag = (event: React.PointerEvent, index: number, list: Waypoint[]) => {
    event.stopPropagation();
    event.preventDefault();
    dragRef.current = { index, list };
    setDraft(list);
    actions?.selectVertex({ edgeId: id, index });

    const move = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) {
        return;
      }
      const next = drag.list.map((w, i) => (i === drag.index ? toFlow(e) : w));
      drag.list = next;
      setDraft(next);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      const drag = dragRef.current;
      dragRef.current = undefined;
      if (drag) {
        actions?.setWaypoints(id, drag.list);
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const insertAt = (event: React.PointerEvent, segment: number) => {
    const list = [...(waypoints ?? [])];
    list.splice(segment, 0, toFlow(event));
    startDrag(event, segment, list);
  };

  const onLineDoubleClick = (event: React.MouseEvent) => {
    if (!editable) {
      return;
    }
    event.stopPropagation();
    const point = toFlow(event);
    const index = waypointIndexAt(point, geometry.points);
    const list = [...(waypoints ?? [])];
    list.splice(index, 0, point);
    actions?.setWaypoints(id, list);
    actions?.selectVertex({ edgeId: id, index });
  };

  const removeVertex = (index: number) => {
    const list = (waypoints ?? []).filter((_, i) => i !== index);
    actions?.setWaypoints(id, list.length ? list : undefined);
    actions?.selectVertex(undefined);
  };

  const alarm = accent.state === 'trigger' ? accent : undefined;

  return (
    <>
      {selected && (
        <path
          d={geometry.d}
          fill="none"
          stroke={p.ac}
          strokeOpacity={0.4}
          strokeWidth={width + 8}
          strokeLinecap="round"
        />
      )}

      <path
        d={geometry.d}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeDasharray={dash}
        strokeLinecap={element?.style === 'dotted' ? 'round' : 'butt'}
        className={cx(lineClass, 'topo-edge-line')}
      />

      {geometry.arrows.map((arrow, i) => (
        <path
          key={i}
          d={arrowPath(width)}
          transform={`translate(${arrow.x},${arrow.y}) rotate(${arrow.angle})`}
          fill={color}
          stroke={p.fundo}
          strokeWidth={1}
          strokeLinejoin="round"
          className={arrowClass}
        />
      ))}

      {flow === 'flow' && (
        <g className={styles.flowDots}>
          {[0, 1, 2].map((i) => (
            <circle key={i} r={Math.max(2.5, width * 0.85)} fill={color}>
              <animateMotion dur="2.4s" repeatCount="indefinite" begin={`${i * 0.8}s`} path={geometry.d} />
            </circle>
          ))}
        </g>
      )}

      {/* A faixa clicavel: transparente, mais larga que o traco. */}
      <path
        d={geometry.d}
        fill="none"
        stroke="transparent"
        strokeWidth={Math.max(HIT_WIDTH, width + 10)}
        className="react-flow__edge-interaction"
        style={{ pointerEvents: actions?.linking ? 'none' : 'stroke', cursor: editable ? 'pointer' : 'default' }}
        onDoubleClick={onLineDoubleClick}
      />

      {editing && (
        <g className="nodrag nopan">
          {geometry.points.slice(0, -1).map((a, i) => {
            const b = geometry.points[i + 1];
            if (Math.hypot(b.x - a.x, b.y - a.y) * zoom < MIN_SEGMENT_FOR_PLUS) {
              return null;
            }
            const mx = a.x + (b.x - a.x) * 0.3;
            const my = a.y + (b.y - a.y) * 0.3;
            const q = 3.5 / zoom;
            return (
              <g
                key={`plus-${i}`}
                style={{ cursor: 'copy', pointerEvents: 'all' }}
                onPointerDown={(e) => insertAt(e, i)}
              >
                <title>Arraste para criar um vértice</title>
                <circle cx={mx} cy={my} r={7 / zoom} fill={p.sup} stroke={p.ac} strokeWidth={1.5 / zoom} />
                <path
                  d={`M${mx - q},${my} H${mx + q} M${mx},${my - q} V${my + q}`}
                  stroke={p.ac}
                  strokeWidth={1.5 / zoom}
                  strokeLinecap="round"
                />
              </g>
            );
          })}
          {(waypoints ?? []).map((w, i) => (
            <rect
              key={`v-${i}`}
              x={w.x - 5 / zoom}
              y={w.y - 5 / zoom}
              width={10 / zoom}
              height={10 / zoom}
              rx={2 / zoom}
              fill={vertex === i ? p.ac : p.sup}
              stroke={p.ac}
              strokeWidth={1.5 / zoom}
              style={{ cursor: 'move', pointerEvents: 'all' }}
              onPointerDown={(e) => startDrag(e, i, [...(waypoints ?? [])])}
              onDoubleClick={(e) => {
                e.stopPropagation();
                removeVertex(i);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                actions?.openVertexMenu(e, { edgeId: id, index: i });
              }}
            />
          ))}
        </g>
      )}

      {labelAt && (
        <EdgeLabelRenderer>
          <div
            className={cx(styles.label, 'nodrag', 'nopan')}
            style={{
              transform: `translate(-50%, -50%) translate(${labelAt.x}px, ${labelAt.y}px)`,
              borderColor: selected ? p.ac : p.borda,
            }}
          >
            {labelText}
          </div>
        </EdgeLabelRenderer>
      )}

      {/* No alarme, o meio da linha abre a lista de incidentes no hover. */}
      {alarm && (
        <EdgeLabelRenderer>
          <ElementHover accent={accent} title={element?.trigger?.host} editable={editable}>
            <div
              className={cx(styles.hotspot, 'nodrag', 'nopan')}
              style={{ transform: `translate(-50%, -50%) translate(${geometry.mid.x}px, ${geometry.mid.y}px)` }}
            />
          </ElementHover>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

const FLOW_CLASS: Record<string, string | undefined> = {
  none: undefined,
  flow: undefined,
  'dash-flow': motionOnly(`${tfDash} 1.4s linear infinite`),
  pulse: motionOnly(`${tfBreathe} 3s ease-in-out infinite`),
};

const getStyles = (theme: GrafanaTheme2) => {
  const p: TfPalette = tfPalette(theme);
  return {
    flowDots: css({
      '@media (prefers-reduced-motion: reduce)': { display: 'none' },
    }),
    label: css({
      position: 'absolute',
      font: `500 11px/1.35 ${FONT_MONO}`,
      whiteSpace: 'pre',
      color: p.tx,
      background: p.sup,
      border: '1px solid',
      borderRadius: 5,
      padding: '3px 7px',
      pointerEvents: 'none',
    }),
    hotspot: css({
      position: 'absolute',
      width: 28,
      height: 28,
      borderRadius: '50%',
      pointerEvents: 'all',
    }),
  };
};
