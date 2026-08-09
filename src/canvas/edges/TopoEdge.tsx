import React from 'react';
import { css, cx, keyframes } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, useTheme2 } from '@grafana/ui';
import {
  BaseEdge,
  EdgeLabelRenderer,
  EdgeProps,
  getBezierPath,
  getStraightPath,
  useInternalNode,
} from '@xyflow/react';

import { accentColor, resolveElementColor } from '../../data/elementColor';
import { DEFAULT_EDGE_WIDTH } from '../../model/sizes';
import { TopoFlowEdge } from '../flowTypes';
import { alpha } from '../tokens';
import { autoPositions, centerOf } from './geometry';

/** Aresta fina e dificil de acertar com o ponteiro; isto amplia o alvo. */
const INTERACTION_WIDTH = 20;

const DASH_ARRAY: Record<string, string | undefined> = {
  solid: undefined,
  dashed: '6 4',
  dotted: '2 4',
};

/**
 * Aresta ligando **centro a centro** dos nos, nao handle a handle.
 *
 * E o detalhe que da o visual limpo: a linha aponta para o miolo do card e
 * desaparece por baixo dele, em vez de sair pela lateral e cruzar o canvas com
 * um gancho. As coordenadas do React Flow (`sourceX/Y`, `targetX/Y`) descrevem
 * a posicao do handle e ficam so como fallback, para o intervalo entre o
 * primeiro render e a medicao do no.
 */
export function TopoEdge({ data, selected, ...props }: EdgeProps<TopoFlowEdge>) {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const element = data?.element;
  const frames = data?.frames ?? [];

  const sourceNode = useInternalNode(props.source);
  const targetNode = useInternalNode(props.target);

  const [sourceX, sourceY] = centerOf(sourceNode, props.sourceX, props.sourceY);
  const [targetX, targetY] = centerOf(targetNode, props.targetX, props.targetY);

  const [sourcePosition, targetPosition] = autoPositions(sourceX, sourceY, targetX, targetY);

  const [path, labelX, labelY] =
    element?.shape === 'curved'
      ? getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition })
      : getStraightPath({ sourceX, sourceY, targetX, targetY });

  const accent = element ? resolveElementColor(element.color, frames, theme, { trigger: element.trigger }) : undefined;
  const stateColor = accent
    ? (accentColor(accent) ?? (accent.state === 'nodata' ? theme.colors.text.disabled : undefined))
    : undefined;

  const color = stateColor ?? theme.colors.border.medium;
  const stroke = selected ? theme.colors.primary.main : color;

  const animation = element?.animation ?? 'none';
  const width = element?.width ?? DEFAULT_EDGE_WIDTH;

  // O dash da animacao `dash-flow` precisa vencer o `style`, senao uma aresta
  // solida animada nao teria tracos para deslocar.
  const dashArray = animation === 'dash-flow' ? '7 5' : DASH_ARRAY[element?.style ?? 'solid'];

  return (
    <>
      <BaseEdge
        id={props.id}
        path={path}
        // Nunca definimos `markerEnd` na aresta, entao isto fica `undefined`:
        // sem seta por padrao, e o campo continua disponivel se um dia a
        // direcao virar configuravel.
        markerEnd={props.markerEnd}
        interactionWidth={INTERACTION_WIDTH}
        className={animationClass[animation]}
        style={{
          stroke,
          strokeWidth: selected ? width + 0.5 : width,
          strokeDasharray: dashArray,
          strokeOpacity: animation === 'flow' ? 0.35 : undefined,
          filter: selected ? `drop-shadow(0 0 5px ${alpha(theme.colors.primary.main, 0.6)})` : undefined,
          transition: 'stroke 120ms ease, stroke-width 120ms ease',
        }}
      />

      {animation === 'flow' && (
        <g className={styles.flowDots}>
          <circle r={3} fill={stroke}>
            <animateMotion dur="1.6s" repeatCount="indefinite" path={path} />
          </circle>
          {/* A segunda particula entra na metade do ciclo: uma so parece um
              erro de render, duas leem como fluxo continuo. */}
          <circle r={3} fill={stroke} opacity={0.6}>
            <animateMotion dur="1.6s" begin="0.8s" repeatCount="indefinite" path={path} />
          </circle>
        </g>
      )}

      {element?.label && (
        <EdgeLabelRenderer>
          <div
            // `nodrag nopan` impede que arrastar o rotulo mova ou desloque o
            // canvas — sem isso o label vira uma alca de pan acidental.
            className={cx(styles.label, 'nodrag', 'nopan')}
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              // Fundo sempre neutro (A.2): so a borda recebe cor.
              borderColor: selected ? theme.colors.primary.main : (stateColor ?? theme.colors.border.weak),
            }}
          >
            {element.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

const dashFlow = keyframes({
  to: { strokeDashoffset: -24 },
});

const pulse = keyframes({
  '0%, 100%': { opacity: 0.35 },
  '50%': { opacity: 1 },
});

/**
 * Todas as animacoes ficam dentro de `prefers-reduced-motion: no-preference`.
 * Quem pediu menos movimento ve a aresta parada, com o estilo de traco intacto.
 */
const motionOnly = (animation: string) =>
  css({ '@media (prefers-reduced-motion: no-preference)': { animation } });

const animationClass: Record<string, string | undefined> = {
  none: undefined,
  'dash-flow': motionOnly(`${dashFlow} 0.9s linear infinite`),
  pulse: motionOnly(`${pulse} 1.2s ease-in-out infinite`),
  // O movimento do `flow` vive no <animateMotion>; a aresta em si fica parada.
  flow: undefined,
};

const getStyles = (theme: GrafanaTheme2) => ({
  flowDots: css({
    '@media (prefers-reduced-motion: reduce)': { display: 'none' },
  }),
  label: css({
    position: 'absolute',
    padding: theme.spacing(0.5, 1.125),
    background: theme.colors.background.secondary,
    border: '1px solid',
    borderRadius: theme.shape.radius.default,
    boxShadow: theme.shadows.z2,
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.bodySmall.fontSize,
    lineHeight: 1.4,
    whiteSpace: 'nowrap',
    // O container do renderer e `pointer-events: none`; o rotulo precisa
    // reativar para ser clicavel e selecionar a aresta.
    pointerEvents: 'all',
  }),
});
