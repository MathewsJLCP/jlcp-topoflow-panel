import React from 'react';
import { css, cx } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, useTheme2 } from '@grafana/ui';
import { Handle, HandleType, NodeProps, Position } from '@xyflow/react';

import { resolveText } from '../../data/dimensions';
import { resolveElementColor, stateMetrics } from '../../data/elementColor';
import { DeviceFlowNode } from '../flowTypes';
import { TopoIcon, resolveIcon } from '../../icons';
import { FONT_SANS, TfPalette, tfMix, tfPalette } from '../../theme/palette';
import { alertClass } from '../alertAnimation';
import { iconColor as resolveIconColor } from '../iconTone';
import { nodeSurface, stateLook, statusBadge } from '../look';
import { StatRow, nodeStats } from '../nodeStats';
import {
  CounterProblems,
  HangingList,
  InsideProblems,
  StripProblems,
  TotalProblems,
  problemFormat,
  problemRows,
  useNow,
} from '../Problems';
import { activeProblems } from '../ActiveTriggers';
import { RadarRings } from '../RadarRings';
import { DrilldownSurface } from '../DrilldownSurface';
import { MetricChart } from '../MetricChart';
import { hasDrilldown } from '../drilldown';
import { ElementHover } from '../ElementHover';

/** Ganchos estaveis para os seletores: o nome do Emotion muda entre builds. */
const HANDLE_CLASS = 'topo-handle';
const CARD_CLASS = 'topo-card';

const HANDLES: Array<{ position: Position; type: HandleType }> = [
  { position: Position.Top, type: 'target' },
  { position: Position.Right, type: 'source' },
  { position: Position.Bottom, type: 'target' },
  { position: Position.Left, type: 'source' },
];

const RADIUS = 16;

/**
 * No de dispositivo, no desenho do mockup da v1.4.
 *
 * Cartao de cantos 16px com o **circulo de status** no canto superior esquerdo
 * (`✓` na Base, `!` no alarme, `!!` no Disaster, `–` sem dados, o numero de
 * problemas no formato Contador). Abaixo do nome, o bloco de valores e, no modo
 * trigger, os problemas no formato escolhido.
 *
 * O estado pinta a borda e tinge o fundo (12%, 30% no Disaster); o texto fica
 * sempre no `tf` da paleta. Quem decide as cores e `look.ts` — o mesmo para
 * todos os elementos.
 */
export function DeviceNode({ data, selected, dragging }: NodeProps<DeviceFlowNode>) {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const p = tfPalette(theme);
  const now = useNow();
  const { element, frames, editable } = data;

  const accent = resolveElementColor(element.color, frames, theme, {
    trigger: element.trigger,
    thresholds: element.thresholds,
    extraMetrics: element.extraMetrics,
  });
  const look = stateLook(accent, element.alert, theme);
  const surface = nodeSurface(look, p);

  const primary = resolveText(element.presentation.primaryText, frames);
  const secondary = element.presentation.secondaryText && resolveText(element.presentation.secondaryText, frames);

  const icon = resolveIcon(element.presentation.icon);
  const tint = resolveIconColor(accent, element.presentation.iconTone, theme);

  const stats = nodeStats(element, frames, accent, theme);

  const format = problemFormat(element.trigger, true);
  const rows = problemRows(activeProblems(accent, element.trigger), theme, now);
  const badge = statusBadge(look, p, format === 'counter' && rows.length ? rows.length : undefined);

  const linked = hasDrilldown(element.drilldown);

  return (
    <div
      className={styles.root}
      data-editable={editable || undefined}
      data-selected={selected || data.link === 'source' || undefined}
      data-link={data.link}
    >
      {look.animation === 'radar' && look.color && <RadarRings color={look.color} radius={RADIUS} rings={2} />}

      <ElementHover
        accent={accent}
        title={primary}
        editable={editable}
        linked={linked}
        dragging={dragging}
        chart={
          element.chart ? (
            <MetricChart
              frames={frames}
              metrics={stateMetrics(element.color, {
                thresholds: element.thresholds,
                extraMetrics: element.extraMetrics,
              })}
            />
          ) : undefined
        }
      >
        <DrilldownSurface
          drilldown={element.drilldown}
          editable={editable}
          className={cx(styles.card, CARD_CLASS, alertClass(accent, element.alert))}
          style={{ border: surface.border, background: surface.background }}
        >
          <span
            className={styles.badge}
            style={{ background: badge.background, border: badge.border, color: badge.color }}
          >
            {badge.glyph}
          </span>

          <div className={styles.head}>
            {element.presentation.showIcon && (
              <span className={styles.iconBox} title={icon.label}>
                <TopoIcon icon={icon} color={tint} size={34} className={styles.svgIcon} />
              </span>
            )}

            <div className={styles.text}>
              <div className={styles.primary}>{primary || element.id}</div>
              {secondary && <div className={styles.secondary}>{secondary}</div>}
            </div>

            {!editable && linked && (
              <span className={styles.arrow} title="Drill-down">
                ↗
              </span>
            )}
          </div>

          {stats.length > 0 && (
            <>
              <div className={styles.divider} />
              {stats.length === 1 ? <BigStat row={stats[0]} /> : <StatList rows={stats} />}
            </>
          )}

          {rows.length > 0 && format === 'inside' && <InsideProblems rows={rows} />}
          {rows.length > 0 && format === 'strip' && <StripProblems rows={rows} />}
          {rows.length > 0 && format === 'total' && <TotalProblems rows={rows} />}
          {rows.length > 0 && format === 'counter' && <CounterProblems rows={rows} />}
        </DrilldownSurface>
      </ElementHover>

      {format === 'list' && (
        <HangingList rows={rows} position={element.trigger?.activePosition} format="list" color={look.color} />
      )}

      {/* Fora do cartao: ele pode estar pulsando, e o alvo de conexao nao pode
          andar sob o ponteiro. */}
      {HANDLES.map(({ position, type }) => (
        <Handle
          key={position}
          id={position}
          type={type}
          position={position}
          className={cx(styles.handle, HANDLE_CLASS)}
        />
      ))}
    </div>
  );
}

function Bar({ row, height }: { row: StatRow; height: 5 | 6 }) {
  const styles = useStyles2(getStyles);
  const track = height - 2;
  return (
    <div className={styles.bar} style={{ height }}>
      <div className={styles.barTrack} style={{ height: track, background: row.track }} />
      <div className={styles.barFill} style={{ height, width: `${row.pct}%`, background: row.fill }} />
      {row.ticks.map((tick, i) => (
        <span
          key={i}
          className={styles.barTick}
          style={{ left: `${tick.pct}%`, height: height + 4, background: tick.color }}
        />
      ))}
    </div>
  );
}

/** Uma metrica: rotulo, numero de 22px e a barra. */
function BigStat({ row }: { row: StatRow }) {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.big}>
      <span className={styles.statLabel}>{row.label}</span>
      <div className={styles.valueLine}>
        <span className={styles.bigValue} style={{ color: row.color }}>
          {row.value}
        </span>
        {row.unit && <span className={styles.bigUnit}>{row.unit}</span>}
      </div>
      {row.bar && <Bar row={row} height={6} />}
    </div>
  );
}

/** Varias metricas: uma linha compacta por metrica. */
function StatList({ rows }: { rows: StatRow[] }) {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.list}>
      {rows.map((row, i) => (
        <div key={i} className={styles.listItem}>
          <div className={styles.listLine}>
            <span className={styles.listLabel}>{row.label}</span>
            <span className={styles.listValue} style={{ color: row.color }}>
              {row.value}
            </span>
            {row.unit && <span className={styles.listUnit}>{row.unit}</span>}
          </div>
          {row.bar && <Bar row={row} height={5} />}
        </div>
      ))}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  const p: TfPalette = tfPalette(theme);
  return {
    root: css({
      position: 'relative',
      width: '100%',
      // `inherit` pega o `minHeight` que `useFlowElements` escreve no wrapper a
      // partir de `element.size.height`. Altura fixa aqui truncaria o titulo.
      minHeight: 'inherit',
      borderRadius: RADIUS,
      fontFamily: FONT_SANS,

      '&[data-selected]': { outline: `2px solid ${p.ac}`, outlineOffset: 4 },

      [`&[data-editable]:hover .${HANDLE_CLASS}`]: {
        opacity: 1,
        pointerEvents: 'auto',
      },

      // Linkagem: alvo valido tracejado, solido sob o ponteiro.
      '&&[data-link="valid"]': {
        cursor: 'crosshair',
        outline: `2px dashed ${p.ac}`,
        outlineOffset: 4,
        '&:hover': { outlineStyle: 'solid' },
      },
      '&[data-link="invalid"]': { opacity: 0.32 },
    }),
    card: css({
      position: 'relative',
      width: '100%',
      minHeight: 'inherit',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      padding: '16px 14px 14px',
      borderRadius: RADIUS,
      boxShadow: `0 4px 14px ${p.shadow}`,
      cursor: 'default',
      color: p.tf,
      textDecoration: 'none',
    }),
    badge: css({
      position: 'absolute',
      left: 24,
      top: 0,
      transform: 'translate(-50%, -50%)',
      width: 20,
      height: 20,
      boxSizing: 'border-box',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      font: `800 10.5px/1 ${FONT_SANS}`,
    }),
    head: css({
      display: 'flex',
      gap: 10,
      alignItems: 'flex-start',
    }),
    iconBox: css({
      flex: 'none',
      width: 30,
      height: 30,
      borderRadius: 8,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }),
    svgIcon: css({ flex: 'none', pointerEvents: 'none' }),
    text: css({
      flex: 1,
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: 3,
    }),
    primary: css({
      font: `600 14px/1.3 ${FONT_SANS}`,
      color: p.tf,
      overflowWrap: 'anywhere',
      whiteSpace: 'pre-wrap',
    }),
    secondary: css({
      font: `12px ${FONT_SANS}`,
      color: p.tx2,
      overflowWrap: 'anywhere',
      whiteSpace: 'pre-wrap',
    }),
    arrow: css({ flex: 'none', font: `600 12px ${FONT_SANS}`, color: p.rot }),
    divider: css({ height: 1, background: tfMix(p.rot, 22) }),
    big: css({ display: 'flex', flexDirection: 'column', gap: 7 }),
    statLabel: css({ font: `500 12px ${FONT_SANS}`, color: p.tx }),
    valueLine: css({ display: 'flex', alignItems: 'baseline', gap: 6 }),
    bigValue: css({ font: `700 22px/1 ${FONT_SANS}` }),
    bigUnit: css({ font: `600 11.5px ${FONT_SANS}`, color: p.tx2 }),
    list: css({ display: 'flex', flexDirection: 'column', gap: 9 }),
    listItem: css({ display: 'flex', flexDirection: 'column', gap: 5 }),
    listLine: css({ display: 'flex', alignItems: 'baseline', gap: 6 }),
    listLabel: css({
      flex: 1,
      minWidth: 0,
      font: `500 12px ${FONT_SANS}`,
      color: p.tx,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    }),
    listValue: css({ font: `700 15px/1 ${FONT_SANS}` }),
    listUnit: css({ font: `600 11px ${FONT_SANS}`, color: p.tx2 }),
    bar: css({ position: 'relative' }),
    barTrack: css({ position: 'absolute', left: 0, right: 0, top: 1, borderRadius: 2 }),
    barFill: css({ position: 'absolute', left: 0, top: 0, borderRadius: 3 }),
    barTick: css({
      position: 'absolute',
      top: -2,
      width: 2,
      borderRadius: 1,
      transform: 'translateX(-50%)',
    }),
    handle: css({
      // `&&` eleva a especificidade acima do CSS proprio do React Flow.
      '&&': {
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
