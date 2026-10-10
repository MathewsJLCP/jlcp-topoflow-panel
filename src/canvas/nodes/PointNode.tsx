import React from 'react';
import { css, cx } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, useTheme2 } from '@grafana/ui';
import { Handle, NodeProps, Position, useConnection } from '@xyflow/react';

import { resolveElementColor, stateMetrics } from '../../data/elementColor';
import { POINT_NODE_SIZE } from '../../model/sizes';
import { TfPalette, tfMix, tfPalette } from '../../theme/palette';
import { HangingList, problemFormat, problemRows, useNow } from '../Problems';
import { activeProblems } from '../ActiveTriggers';
import { alertClass } from '../alertAnimation';
import { PointFlowNode } from '../flowTypes';
import { StateLook, stateLook } from '../look';
import { RadarRings } from '../RadarRings';
import { ElementHover } from '../ElementHover';
import { MetricChart } from '../MetricChart';

const HANDLE_CLASS = 'topo-point-handle';

/** O ponto em si, por estado — `pointVM` do mockup. */
export function pointDot(look: StateLook, p: TfPalette): { size: number; background: string; border: string } {
  switch (look.kind) {
    case 'nodata':
      return { size: 14, background: p.elev, border: `2px dashed ${p.apa}` };
    case 'base':
      return { size: 14, background: look.color!, border: `2px solid ${look.color}` };
    case 'alarm':
      return { size: look.disaster ? 20 : 16, background: look.color!, border: `3px solid ${tfMix(look.color!, 40)}` };
    default:
      return { size: 14, background: p.sup, border: `2px solid ${p.rot}` };
  }
}

/**
 * Point: a ancora pequena, sem texto. E o unico elemento em que a lista de
 * problemas e a **unica** forma de saber o que alarmou — o titulo do hover vem
 * do host, porque nao ha nome de elemento.
 */
export function PointNode({ data, selected, dragging }: NodeProps<PointFlowNode>) {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const p = tfPalette(theme);
  const now = useNow();

  // Durante um arraste de conexao, a alca vira um alvo do tamanho do ponto.
  const connecting = useConnection((connection) => connection.inProgress);

  const accent = resolveElementColor(data.element.color, data.frames, theme, {
    trigger: data.element.trigger,
    thresholds: data.element.thresholds,
    extraMetrics: data.element.extraMetrics,
  });
  const look = stateLook(accent, data.element.alert, theme);
  const dot = pointDot(look, p);
  const offset = (POINT_NODE_SIZE - dot.size) / 2;
  const rows = problemRows(activeProblems(accent, data.element.trigger), theme, now);

  return (
    <ElementHover
      accent={accent}
      title={data.element.trigger?.host}
      editable={data.editable}
      dragging={dragging}
      chart={
        data.element.chart ? (
          <MetricChart
            frames={data.frames}
            metrics={stateMetrics(data.element.color, {
              thresholds: data.element.thresholds,
              extraMetrics: data.element.extraMetrics,
            })}
          />
        ) : undefined
      }
    >
      <div
        className={styles.root}
        data-selected={selected || data.link === 'source' || undefined}
        data-editable={data.editable || undefined}
        data-connecting={connecting || undefined}
        data-link={data.link}
      >
        {look.animation === 'radar' && look.color && <RadarRings color={look.color} radius="50%" variant="point" />}

        <span
          className={cx(styles.dot, alertClass(accent, data.element.alert))}
          style={{
            left: offset,
            top: offset,
            width: dot.size,
            height: dot.size,
            background: dot.background,
            border: dot.border,
          }}
        />

        <Handle type="source" position={Position.Top} className={cx(styles.handle, HANDLE_CLASS)} />

        <HangingList
          rows={rows}
          position={data.element.trigger?.activePosition}
          format={problemFormat(data.element.trigger, false)}
          connector={false}
          width={232}
        />
      </div>
    </ElementHover>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  const p: TfPalette = tfPalette(theme);
  return {
    root: css({
      position: 'relative',
      width: POINT_NODE_SIZE,
      height: POINT_NODE_SIZE,
      borderRadius: '50%',
      cursor: 'default',
      '&[data-selected]': { outline: `2px solid ${p.ac}`, outlineOffset: 5 },
      [`&[data-editable]:hover .${HANDLE_CLASS}`]: { opacity: 1, pointerEvents: 'auto' },
      // Arrastando uma conexao, a alca cobre o ponto inteiro: o alvo e o ponto.
      [`&[data-connecting] .${HANDLE_CLASS}`]: {
        top: '50%',
        width: POINT_NODE_SIZE + 8,
        height: POINT_NODE_SIZE + 8,
        minWidth: POINT_NODE_SIZE + 8,
        minHeight: POINT_NODE_SIZE + 8,
        opacity: 0,
        pointerEvents: 'auto',
        border: 'none',
        background: 'transparent',
      },
      '&&[data-link="valid"]': {
        cursor: 'crosshair',
        outline: `2px dashed ${p.ac}`,
        outlineOffset: 5,
        '&:hover': { outlineStyle: 'solid' },
      },
      '&[data-link="invalid"]': { opacity: 0.32 },
    }),
    dot: css({
      position: 'absolute',
      boxSizing: 'border-box',
      borderRadius: '50%',
      backgroundClip: 'padding-box',
    }),
    handle: css({
      '&&': {
        top: -12,
        width: 10,
        height: 10,
        minWidth: 10,
        minHeight: 10,
        background: p.sup,
        border: `2px solid ${p.ac}`,
        borderRadius: '50%',
        cursor: 'crosshair',
        opacity: 0,
        pointerEvents: 'none',
      },
    }),
  };
};
