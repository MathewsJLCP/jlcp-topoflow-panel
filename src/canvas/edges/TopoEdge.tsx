import React from 'react';
import { css, cx, keyframes } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, useTheme2 } from '@grafana/ui';
import { BaseEdge, EdgeLabelRenderer, EdgeProps, getBezierPath, getStraightPath, useInternalNode } from '@xyflow/react';

import { resolveTemplate } from '../../data/dimensions';
import { accentColor, resolveElementColor } from '../../data/elementColor';
import { DEFAULT_EDGE_WIDTH } from '../../model/sizes';
import { TopoFlowEdge } from '../flowTypes';
import { edgeAlertClass } from '../alertAnimation';
import { stateFill } from '../stateFill';
import { ElementHover, alarmLabel } from '../ElementHover';
import { alpha, motionOnly } from '../tokens';
import { autoPositions, centerOf, endpointOf, trimToBoundaries } from './geometry';

/** Aresta fina e dificil de acertar com o ponteiro; isto amplia o alvo. */
const INTERACTION_WIDTH = 20;

/**
 * Quanto o chip de alarme desce quando a aresta ja tem rotulo.
 *
 * Os dois nascem no mesmo `labelX/labelY` — o meio do vao visivel — e sem o
 * deslocamento um cobriria o outro. O chip vai para baixo, e nao para cima,
 * porque o rotulo e o dado permanente da aresta: quem esta acostumado a le-lo
 * nao deveria ve-lo saltar de lugar toda vez que um alarme abre.
 */
const CHIP_OFFSET = 20;

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

  // Os lados da curva saem dos **centros**: quem decide para onde a aresta
  // aponta e a direcao entre os elementos, e recortar as pontas nao muda isso.
  const [sourcePosition, targetPosition] = autoPositions(sourceX, sourceY, targetX, targetY);

  /**
   * O caminho e desenhado so no trecho visivel, entre as bordas dos dois
   * elementos. Onde o card e opaco o traco fica identico ao de antes — o que se
   * perde e o pedaco que ja estava escondido —, e em troca `labelX/labelY`
   * passam a ser o meio do vao que o usuario ve, em vez do meio de um caminho
   * cuja metade estava enterrada.
   */
  const [fromX, fromY, toX, toY] = trimToBoundaries(
    sourceX,
    sourceY,
    targetX,
    targetY,
    endpointOf(sourceNode),
    endpointOf(targetNode)
  );

  const [path, labelX, labelY] =
    element?.shape === 'curved'
      ? getBezierPath({
          sourceX: fromX,
          sourceY: fromY,
          sourcePosition,
          targetX: toX,
          targetY: toY,
          targetPosition,
        })
      : getStraightPath({ sourceX: fromX, sourceY: fromY, targetX: toX, targetY: toY });

  const accent = element
    ? resolveElementColor(element.color, frames, theme, {
        trigger: element.trigger,
        thresholds: element.thresholds,
      })
    : undefined;
  const stateColor = accent
    ? (accentColor(accent) ?? (accent.state === 'nodata' ? theme.colors.text.disabled : undefined))
    : undefined;

  const color = stateColor ?? theme.colors.border.medium;
  const fill = accent ? stateFill(accent, theme) : undefined;
  const stroke = selected ? theme.colors.primary.main : color;

  const animation = element?.animation ?? 'none';
  const width = element?.width ?? DEFAULT_EDGE_WIDTH;

  /**
   * O alerta tem precedencia sobre a animacao permanente.
   *
   * As duas dizem coisas diferentes: `flow` e `dash-flow` significam "aqui passa
   * trafego" e valem o tempo todo; o alerta significa "isto caiu agora". Rodando
   * juntas na mesma linha o resultado e borrao, e o operador perde as duas
   * informacoes. Enquanto durar o alarme manda o alerta; normalizou, a
   * permanente volta sozinha.
   */
  const alerting = edgeAlertClass(accent, element?.alert);

  /**
   * A aresta nao tem badge nem texto proprio: sem isto, uma conexao vermelha nao
   * diz nem a severidade nem quantas triggers cairam — so que algo caiu.
   *
   * O chip so existe durante o alarme. Fora dele a aresta volta a ser um traco,
   * que e o que ela deve ser: uma topologia com uma pilula em cada linha e um
   * diagrama ilegivel.
   */
  const alarm = accent?.state === 'trigger' ? accent : undefined;

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
        className={alerting ?? animationClass[animation]}
        style={{
          stroke,
          strokeWidth: selected ? width + 0.5 : width,
          strokeDasharray: dashArray,
          strokeOpacity: animation === 'flow' ? 0.35 : undefined,
          filter: selected ? `drop-shadow(0 0 5px ${alpha(theme.colors.primary.main, 0.6)})` : undefined,
          transition: 'stroke 120ms ease, stroke-width 120ms ease',
        }}
      />

      {animation === 'flow' && !alerting && (
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
              borderColor: selected ? theme.colors.primary.main : (stateColor ?? theme.colors.border.weak),
              // O rotulo se pinta como o card do no: `stateFill` devolve o fundo
              // **e** a cor de texto que o tema garante legivel sobre ele. Sem
              // isso, um rotulo com fundo vermelho herdaria `text.primary` e
              // ficaria branco sobre vermelho, que reprova em contraste.
              ...(fill && { background: fill.background, color: fill.text }),
            }}
          >
            {resolveTemplate(element.label, frames)}
          </div>
        </EdgeLabelRenderer>
      )}

      {alarm && accent && (
        <EdgeLabelRenderer>
          <ElementHover accent={accent} title={element?.trigger?.host} editable={data?.editable}>
            <div
              className={cx(styles.alarmChip, 'nodrag', 'nopan')}
              style={{
                transform: `translate(-50%, -50%) translate(${labelX}px, ${
                  labelY + (element?.label ? CHIP_OFFSET : 0)
                }px)`,
                // Mesmo tratamento do rotulo: o fundo e a cor do estado e o
                // texto vem do token que o tema garante legivel sobre ele.
                ...(fill ? { background: fill.background, color: fill.text } : { color: stateColor }),
                borderColor: alpha(fill?.text ?? stateColor ?? theme.colors.border.weak, 0.35),
              }}
            >
              {alarmLabel(alarm.label, alarm.problems.length)}
            </div>
          </ElementHover>
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
    /**
     * `pre`, e nao `nowrap`: o rotulo virou multi-linha (`IN:` / `OUT:` /
     * `Status:`), e as quebras que o usuario digitou sao a estrutura da leitura.
     *
     * `pre` e nao `pre-line` porque a fonte aqui e monoespacada e o alinhamento
     * em coluna (`IN: ` com dois espacos, `OUT:` com um) e a forma obvia de
     * emparelhar os valores — `pre-line` colapsaria justamente esses espacos.
     * Continua sem quebra automatica: partir `1.24 Mb/s` no meio seria pior que
     * um rotulo largo.
     */
    whiteSpace: 'pre',
    textAlign: 'left',
    // O container do renderer e `pointer-events: none`; o rotulo precisa
    // reativar para ser clicavel e selecionar a aresta.
    pointerEvents: 'all',
  }),
  /**
   * Mesma pilula do badge do no, e de proposito: o operador aprende um formato
   * de rotulo de estado, nao um por tipo de elemento.
   */
  alarmChip: css({
    position: 'absolute',
    padding: '1px 6px',
    border: '1px solid',
    borderRadius: theme.shape.radius.sm,
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: 10,
    fontWeight: theme.typography.fontWeightMedium,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    lineHeight: 1.4,
    whiteSpace: 'nowrap',
    pointerEvents: 'all',
  }),
});
