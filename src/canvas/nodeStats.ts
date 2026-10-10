import { DataFrame, GrafanaTheme2 } from '@grafana/data';

import { getLastNotNullValue, stateFieldName } from '../data/dimensions';
import { ElementColor, StateMetric, evaluateMetric, stateMetrics } from '../data/elementColor';
import { metricRules } from '../data/thresholds';
import { TopoNode } from '../model/types';
import { resolveTfColor, tfMix, tfPalette } from '../theme/palette';

/**
 * As linhas de valor do no — o bloco abaixo do nome no mockup (`nodeVM`).
 *
 * Com uma metrica so, sai o numero grande (22px) com barra; com varias, uma
 * linha compacta por metrica. A barra aparece quando ha onde ancora-la: unidade
 * em `%` (vai de 0 a 100) ou regras de threshold (as marcas mostram onde cada
 * regra comeca).
 */
export interface StatTick {
  pct: number;
  color: string;
}

export interface StatRow {
  label: string;
  value: string;
  unit: string;
  /** Cor do numero: a da regra que casou, ou o texto. */
  color: string;
  bar: boolean;
  pct: number;
  fill: string;
  track: string;
  ticks: StatTick[];
}

const NO_DATA = 'sem dados';

/** `Host: item` -> `item`. O host ja esta no nome do no. */
export function statLabel(fieldName: string): string {
  const cut = fieldName.indexOf(': ');
  return cut === -1 ? fieldName : fieldName.slice(cut + 2);
}

/**
 * Quais metricas o no exibe.
 *
 * Com "Exibir valor" ligado: as do estado (se `fromState`, e so no modo
 * metrica), as extras e a metrica unica de antes da v1.4. Desligado, so quando a
 * metrica esta **sem dados** — "sem dados" e um aviso sobre o vinculo, e some-lo
 * junto com o numero esconderia o que o operador precisa ver.
 */
export function statFields(element: TopoNode, frames: DataFrame[], accent: ElementColor): string[] {
  const metricMode = !element.trigger?.enabled;
  const metrics = stateMetrics(element.color, { thresholds: element.thresholds, extraMetrics: element.extraMetrics });
  const stateNames = metrics.map((m) => stateFieldName(m.dim, frames)).filter((n): n is string => Boolean(n));
  const value = element.value;

  if (value) {
    const fromState = value.fromState ?? !value.field;
    const names = [
      ...(fromState && metricMode ? stateNames : []),
      ...(value.fields ?? []),
      ...(value.field ? [value.field] : []),
    ].filter(Boolean);
    return [...new Set(names)];
  }

  return metricMode && accent.state === 'nodata' ? stateNames : [];
}

export function nodeStats(
  element: TopoNode,
  frames: DataFrame[],
  accent: ElementColor,
  theme: GrafanaTheme2
): StatRow[] {
  const p = tfPalette(theme);
  const metrics = stateMetrics(element.color, { thresholds: element.thresholds, extraMetrics: element.extraMetrics });
  const byName = new Map<string, StateMetric>();
  for (const metric of metrics) {
    const name = stateFieldName(metric.dim, frames);
    if (name && !byName.has(name)) {
      byName.set(name, metric);
    }
  }
  const base = element.color.fixed ? resolveTfColor(element.color.fixed, theme) : undefined;

  return statFields(element, frames, accent).map((name) => {
    const label = statLabel(name);
    const metric = byName.get(name);
    const outcome = metric && !element.trigger?.enabled ? evaluateMetric(metric, frames, theme) : undefined;
    const ruleColor = outcome?.kind === 'hit' ? outcome.color : undefined;
    const hit = getLastNotNullValue(frames, name);
    const display = hit && hit.value != null ? hit.field.display?.(hit.value) : undefined;

    if (!hit || hit.value == null || !display) {
      return {
        label,
        value: NO_DATA,
        unit: '',
        color: p.tx2,
        bar: false,
        pct: 0,
        fill: 'transparent',
        track: p.elev,
        ticks: [],
      };
    }

    const text = `${display.prefix ?? ''}${display.text}`;
    const unit = (display.suffix ?? '').trim();
    const color = ruleColor ?? p.tf;

    if (typeof hit.value !== 'number' || !Number.isFinite(display.numeric)) {
      return {
        label,
        value: text,
        unit,
        color,
        bar: false,
        pct: 0,
        fill: 'transparent',
        track: 'transparent',
        ticks: [],
      };
    }

    const percent = unit === '%';
    // Em `%` vale o numero exibido (`percentunit` guarda 0..1 e exibe 0..100).
    const number = percent ? parseFloat(display.text) : hit.value;
    const thresholds = metric
      ? metricRules(metric.thresholds).flatMap((rule) =>
          rule.type === 'threshold' ? [{ value: rule.value, color: resolveTfColor(rule.color, theme) }] : []
        )
      : [];
    const max = percent ? 100 : Math.max(number * 1.5, ...thresholds.map((t) => t.value * 1.25), 1);
    const scale = (v: number) => Math.max(0, Math.min(100, (v / max) * 100));
    const barColor = ruleColor ?? base ?? p.rot;

    return {
      label,
      value: text,
      unit,
      color,
      bar: percent || thresholds.length > 0,
      pct: scale(number),
      fill: `linear-gradient(90deg, ${tfMix(barColor, 45)}, ${barColor})`,
      track: tfMix(p.ac, 16, p.elev),
      ticks: thresholds.map((t) => ({ pct: scale(t.value), color: t.color })),
    };
  });
}
