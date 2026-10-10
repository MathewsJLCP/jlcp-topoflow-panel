import React, { useId, useMemo } from 'react';
import { css } from '@emotion/css';
import { DataFrame, Field, FieldType, GrafanaTheme2, dateTimeFormat } from '@grafana/data';
import { useStyles2, useTheme2 } from '@grafana/ui';

import { findFieldFrame, formatDisplayValue, stateFieldName } from '../data/dimensions';
import { StateMetric } from '../data/elementColor';
import { metricRules } from '../data/thresholds';
import { FONT_SANS, TfPalette, resolveTfColor, tfPalette } from '../theme/palette';
import { useTopoTime } from './timeContext';

/**
 * O grafico do hover, no desenho do mockup.
 *
 * Uma serie por metrica de estado, na janela de tempo do dashboard: area com
 * gradiente no violeta de acento, linha de 1.6px, as regras de threshold da
 * metrica em linhas tracejadas com o rotulo `>= valor`. Um bloco por metrica,
 * cada um com o nome e o ultimo valor no topo.
 *
 * **O mesmo desenho com uma metrica ou com varias.** Ate a v1.4 uma metrica so
 * ganhava outro layout — grafico alto e a legenda Name / Last / Max / Mean
 * embaixo —, e como a Imagem e o Point quase sempre tem uma metrica so, o hover
 * deles parecia de outro produto ao lado do hover do No. O do No (o do mockup,
 * com varias metricas) virou a referencia para todos.
 *
 * Os valores passam pelo `field.display` do Grafana: unidade, casas e value
 * mappings do painel valem aqui tambem.
 */
interface MetricChartProps {
  frames: DataFrame[];
  metrics: StateMetric[];
}

const W = 444;
const L = 38;
const R = 438;
const T = 8;

interface Series {
  name: string;
  field?: Field;
  times?: number[];
  values?: number[];
  message?: string;
  thresholds: Array<{ value: number; color: string }>;
}

function seriesOf(frames: DataFrame[], metric: StateMetric, theme: GrafanaTheme2): Series | undefined {
  const name = stateFieldName(metric.dim, frames);
  if (!name) {
    return undefined;
  }
  const thresholds = metricRules(metric.thresholds).flatMap((rule) =>
    rule.type === 'threshold' ? [{ value: rule.value, color: resolveTfColor(rule.color, theme) }] : []
  );
  const hit = findFieldFrame(frames, name);
  if (!hit) {
    return { name, thresholds, message: 'A métrica não está nas séries deste painel.' };
  }
  if (hit.field.type !== FieldType.number) {
    return { name, field: hit.field, thresholds, message: 'Métrica de texto: não há gráfico para desenhar.' };
  }
  const time = hit.frame.fields.find((f) => f.type === FieldType.time);
  if (!time) {
    return {
      name,
      field: hit.field,
      thresholds,
      message: 'A série não tem coluna de tempo — o gráfico precisa de uma.',
    };
  }
  const times: number[] = [];
  const values: number[] = [];
  for (let i = 0; i < hit.field.values.length; i++) {
    const v = hit.field.values[i];
    const t = time.values[i];
    if (typeof v === 'number' && Number.isFinite(v) && t != null) {
      times.push(Number(t));
      values.push(v);
    }
  }
  if (!values.length) {
    return { name, field: hit.field, thresholds, message: 'A métrica não tem valores nesta janela.' };
  }
  return { name, field: hit.field, times, values, thresholds };
}

export function MetricChart({ frames, metrics }: MetricChartProps) {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();

  const series = useMemo(
    () => metrics.map((m) => seriesOf(frames, m, theme)).filter((s): s is Series => Boolean(s)),
    [frames, metrics, theme]
  );

  if (!series.length) {
    return (
      <div className={styles.wrap}>
        <div className={styles.message}>Nenhuma métrica vinculada a este elemento.</div>
      </div>
    );
  }

  const fmt = (s: Series, v: number) => (s.field?.display ? formatDisplayValue(s.field.display(v)) : String(v));

  return (
    <div className={styles.wrap}>
      {series.map((s) => (
        <div key={s.name} className={styles.block}>
          <div className={styles.head}>
            <span className={styles.headName}>{s.name}</span>
            <span className={styles.headLast}>{s.values ? fmt(s, s.values[s.values.length - 1]) : '—'}</span>
          </div>
          {s.message ? <div className={styles.messageSmall}>{s.message}</div> : <Plot series={s} fmt={fmt} />}
        </div>
      ))}
    </div>
  );
}

/**
 * Rotulo do eixo: o numero com no maximo uma casa (o passo do eixo e "redondo",
 * as casas do campo nao se aplicam) e a unidade do campo — colada no `%`,
 * separada por espaco nas demais. E o que o mockup faz.
 */
function tickLabel(series: Series, v: number): string {
  const unit = (series.field?.display?.(v).suffix ?? '').trim();
  const number = Number.isInteger(v) ? String(v) : String(+v.toFixed(1));
  return number + (unit === '%' ? '%' : unit ? ` ${unit}` : '');
}

/** Rotulos de threshold acima da linha, empurrados para baixo quando se encostariam. */
function stackLabels<T extends { y: number }>(lines: T[]): Array<T & { ly: number }> {
  const out: Array<T & { ly: number }> = [];
  for (const line of lines) {
    const prev = out.length ? out[out.length - 1].ly : -99;
    out.push({ ...line, ly: Math.max(line.y - 12, prev + 13) });
  }
  return out;
}

const TIME_STEPS = [60, 120, 300, 600, 900, 1800, 3600, 7200, 10800, 21600, 43200, 86400].map((s) => s * 1000);

function Plot({ series, fmt }: { series: Series; fmt: (s: Series, v: number) => string }) {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const p = tfPalette(theme);
  const gid = useId().replace(/:/g, '');
  const { timeRange, timeZone } = useTopoTime();

  const H = 100;
  const B = 78;
  const values = series.values!;
  const times = series.times!;

  const raw = Math.max(...values, ...series.thresholds.map((t) => t.value)) * 1.08 || 1;
  const st0 = raw / 3;
  const mag = Math.pow(10, Math.floor(Math.log10(st0)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((m) => m >= st0) ?? mag * 10;
  const max = Math.ceil(raw / step) * step;

  const from = timeRange.from.valueOf() || times[0];
  const to = timeRange.to.valueOf() || times[times.length - 1];
  const span = Math.max(1, to - from);
  const X = (t: number) => L + ((t - from) / span) * (R - L);
  const Y = (v: number) => B - (v / max) * (B - T);

  const line = values.map((v, i) => `${X(times[i]).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
  const area = `${X(times[0]).toFixed(1)},${B} ${line} ${X(times[times.length - 1]).toFixed(1)},${B}`;
  const dots =
    values.length <= 120
      ? values.map((v, i) => ({ i, v })).filter(({ i }) => i % 3 === 2 || i === values.length - 1)
      : [];

  const yTicks: number[] = [];
  for (let v = 0; v <= max + 1e-9; v += step) {
    yTicks.push(v);
  }

  const tStep = TIME_STEPS.find((s) => span / s <= 6) ?? 86400000;
  const xTicks: number[] = [];
  for (let t = Math.ceil(from / tStep) * tStep; t <= to; t += tStep) {
    xTicks.push(t);
  }
  const timeFormat = span > 2 * 86400000 ? 'MM/DD HH:mm' : 'HH:mm';

  const ths = stackLabels(
    series.thresholds
      .filter((t) => t.value <= max)
      .map((t) => ({ ...t, y: Y(t.value) }))
      .sort((a, b) => a.y - b.y)
  );

  return (
    <div className={styles.plot} style={{ height: H }}>
      <svg width={W} height={H} style={{ display: 'block', overflow: 'visible' }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={p.ac} stopOpacity={0.28} />
            <stop offset="1" stopColor={p.ac} stopOpacity={0} />
          </linearGradient>
        </defs>
        {yTicks.map((v) => (
          <line key={`y${v}`} x1={L} x2={R} y1={Y(v)} y2={Y(v)} stroke={p.linha} strokeWidth={1} opacity={0.55} />
        ))}
        {xTicks.map((t) => (
          <line key={`x${t}`} x1={X(t)} x2={X(t)} y1={T} y2={B} stroke={p.linha} strokeWidth={1} opacity={0.55} />
        ))}
        <polygon points={area} fill={`url(#${gid})`} />
        {ths.map((t) => (
          <line
            key={`t${t.value}`}
            x1={L}
            x2={R}
            y1={t.y}
            y2={t.y}
            stroke={t.color}
            strokeWidth={1.25}
            strokeDasharray="4 3"
          />
        ))}
        <polyline points={line} fill="none" stroke={p.ac} strokeWidth={1.6} strokeLinejoin="round" />
        {dots.map(({ i, v }) => (
          <circle key={i} cx={X(times[i])} cy={Y(v)} r={2.4} fill={p.ac} />
        ))}
      </svg>
      {yTicks.map((v) => (
        <div key={`yl${v}`} className={styles.yLabel} style={{ top: Y(v) }}>
          {tickLabel(series, v)}
        </div>
      ))}
      {xTicks.map((t) => (
        <div
          key={`xl${t}`}
          className={styles.xLabel}
          style={{ left: X(t), top: B + 6, transform: `translateX(${X(t) > R - 18 ? '-100%' : '-50%'})` }}
        >
          {dateTimeFormat(t, { format: timeFormat, timeZone })}
        </div>
      ))}
      {ths.map((t) => (
        <div key={`tl${t.value}`} className={styles.thLabel} style={{ top: t.ly, color: t.color }}>
          {`≥ ${tickLabel(series, t.value)}`}
        </div>
      ))}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  const p: TfPalette = tfPalette(theme);
  const ellipsis = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const };
  return {
    wrap: css({ padding: '10px 12px 8px', display: 'flex', flexDirection: 'column', gap: 8, fontFamily: FONT_SANS }),
    block: css({ display: 'flex', flexDirection: 'column', gap: 2 }),
    head: css({ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0 2px' }),
    headName: css({ font: `500 12px ${FONT_SANS}`, color: p.tx2, ...ellipsis }),
    headLast: css({ font: `600 12.5px ${FONT_SANS}`, color: p.tf }),
    message: css({
      padding: '22px 8px',
      textAlign: 'center',
      font: `12.5px ${FONT_SANS}`,
      color: p.tx2,
      border: `1px dashed ${p.linha}`,
      borderRadius: 6,
    }),
    messageSmall: css({
      padding: '16px 8px',
      textAlign: 'center',
      font: `12px ${FONT_SANS}`,
      color: p.tx2,
      border: `1px dashed ${p.linha}`,
      borderRadius: 6,
    }),
    plot: css({ position: 'relative', width: W }),
    yLabel: css({
      position: 'absolute',
      right: W - 34,
      transform: 'translateY(-50%)',
      font: `11.5px ${FONT_SANS}`,
      color: p.tx2,
      whiteSpace: 'nowrap',
    }),
    xLabel: css({ position: 'absolute', font: `11.5px ${FONT_SANS}`, color: p.tx2, whiteSpace: 'nowrap' }),
    thLabel: css({
      position: 'absolute',
      right: 10,
      font: `600 10.5px/12px ${FONT_SANS}`,
      background: p.sup,
      padding: '0 4px',
      whiteSpace: 'nowrap',
    }),
  };
};
