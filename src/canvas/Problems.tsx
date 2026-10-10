import React, { useEffect, useState } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, useTheme2 } from '@grafana/ui';

import { ActiveProblem } from '../data/triggerState';
import { TriggerBinding } from '../model/types';
import { FONT_MONO, FONT_SANS, TfPalette, tfMix, tfPalette } from '../theme/palette';
import { SEVERITY_SHORT, severityOnColor, severityTfColor } from '../theme/severity';
import { formatAge } from './ElementHover';

/**
 * Os problemas ativos junto do elemento, nos cinco formatos do mockup:
 *
 *   - **Dentro do nó** (`inside`) — uma secao no cartao, ate tres linhas;
 *   - **Faixa** (`strip`) — barra segmentada por severidade + o pior problema;
 *   - **Contador** (`counter`) — o numero vai para o circulo de status, e o
 *     cartao mostra o pior problema;
 *   - **Lista** (`list`) — cartao preso ao elemento por um conector;
 *   - **Total** (`total`) — uma linha com a contagem.
 *
 * Os tres primeiros so existem no no, que tem cartao onde caber. Imagem e point
 * so tem Lista e Total — um formato de no salvo neles cai na Lista.
 */
export type ProblemFormat = 'inside' | 'strip' | 'counter' | 'list' | 'total';

const NODE_ONLY: ProblemFormat[] = ['inside', 'strip', 'counter'];

export function problemFormat(binding: TriggerBinding | undefined, isNode: boolean): ProblemFormat {
  const raw = binding?.activeDisplay;
  // `count` e o "Total" de antes da v1.4.
  const format: ProblemFormat = raw === 'count' ? 'total' : (raw ?? 'list');
  return !isNode && NODE_ONLY.includes(format) ? 'list' : format;
}

export interface ProblemRow {
  short: string;
  name: string;
  age: string;
  color: string;
  on: string;
}

/** Relogio para as idades ("há 4m"), a cada 30s — o suficiente para minutos. */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function problemRows(problems: ActiveProblem[], theme: GrafanaTheme2, now: number): ProblemRow[] {
  return problems.map((problem) => ({
    short: SEVERITY_SHORT[problem.severity],
    name: problem.name,
    age: problem.since === undefined ? '' : formatAge(problem.since, now),
    color: problem.color,
    on:
      problem.color === severityTfColor(problem.severity, theme)
        ? severityOnColor(problem.severity, theme)
        : tfPalette(theme)['on-cr'],
  }));
}

export const activeLabel = (n: number) => `${n} incidente${n > 1 ? 's' : ''} ativo${n > 1 ? 's' : ''}`;
const moreLabel = (n: number) => `+${n} outra${n > 1 ? 's' : ''}`;

function Pill({ row, wide }: { row: ProblemRow; wide?: boolean }) {
  const styles = useStyles2(getStyles);
  return (
    <span className={wide ? styles.pillWide : styles.pill} style={{ background: row.color, color: row.on }}>
      {row.short}
    </span>
  );
}

/** Secao do cartao: barra de cor, sigla, nome, idade. */
export function InsideProblems({ rows }: { rows: ProblemRow[] }) {
  const styles = useStyles2(getStyles);
  return (
    <>
      <div className={styles.divider} />
      <div className={styles.insideList}>
        {rows.slice(0, 3).map((row, i) => (
          <div key={i} className={styles.insideRow} title={row.name}>
            <span className={styles.insideBar} style={{ background: row.color }} />
            <span className={styles.insideShort}>{row.short}</span>
            <span className={styles.insideName}>{row.name}</span>
            <span className={styles.age}>{row.age}</span>
          </div>
        ))}
        {rows.length > 3 && <span className={styles.insideMore}>{moreLabel(rows.length - 3)}</span>}
      </div>
    </>
  );
}

/** Barra segmentada, um segmento por problema, e o pior deles por extenso. */
export function StripProblems({ rows }: { rows: ProblemRow[] }) {
  const styles = useStyles2(getStyles);
  const top = rows[0];
  return (
    <div className={styles.strip}>
      <div className={styles.segments}>
        {rows.map((row, i) => (
          <span key={i} className={styles.segment} style={{ background: row.color }} />
        ))}
      </div>
      <div className={styles.stripRow}>
        <span className={styles.stripCount}>{rows.length}</span>
        <span className={styles.stripName}>{top.name}</span>
        <span className={styles.age}>{top.age}</span>
      </div>
    </div>
  );
}

/** Uma linha: a sigla do pior e "N incidentes ativos". */
export function TotalProblems({ rows }: { rows: ProblemRow[] }) {
  const styles = useStyles2(getStyles);
  return (
    <>
      <div className={styles.divider} />
      <div className={styles.totalRow} title={rows.map((r) => r.name).join('\n')}>
        <Pill row={rows[0]} />
        <span className={styles.totalText}>{activeLabel(rows.length)}</span>
      </div>
    </>
  );
}

/** O numero esta no circulo de status; aqui vai o pior problema. */
export function CounterProblems({ rows }: { rows: ProblemRow[] }) {
  const styles = useStyles2(getStyles);
  const top = rows[0];
  return (
    <div className={styles.counterRow}>
      <Pill row={top} />
      <span className={styles.counterName}>{top.name}</span>
      {rows.length > 1 && <span className={styles.counterRest}>{`+${rows.length - 1} no hover`}</span>}
    </div>
  );
}

export type ListPosition = NonNullable<TriggerBinding['activePosition']>;

/** Onde o cartao pendurado fica, relativo ao elemento. */
const PLACEMENT: Record<ListPosition, React.CSSProperties> = {
  bottom: { top: '100%', left: 0, transform: 'translate(0, 8px)' },
  top: { top: 0, left: 0, transform: 'translate(0, calc(-100% - 8px))' },
  left: { top: 0, left: 0, transform: 'translate(calc(-100% - 10px), 0)' },
  right: { top: 0, left: '100%', transform: 'translate(10px, 0)' },
};

/** O conector curto entre o cartao pendurado e o elemento. */
const CONNECTOR: Record<ListPosition, React.CSSProperties> = {
  bottom: { left: 22, top: -11, width: 2, height: 10 },
  top: { left: 22, top: '100%', width: 2, height: 10 },
  left: { left: '100%', top: 14, width: 10, height: 2 },
  right: { left: -11, top: 14, width: 10, height: 2 },
};

interface HangingListProps {
  rows: ProblemRow[];
  position?: ListPosition;
  format: ProblemFormat;
  /** Cor do estado: borda e conector. Sem ela (point), borda neutra e sem conector. */
  color?: string;
  connector?: boolean;
  width?: number;
}

/**
 * O cartao de problemas preso ao elemento (formato Lista, e o Total fora do no).
 * Ate tres linhas com pilula, nome e idade; no Total, uma linha com a contagem.
 */
export function HangingList({
  rows,
  position = 'bottom',
  format,
  color,
  connector = true,
  width = 236,
}: HangingListProps) {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const p = tfPalette(theme);

  if (rows.length === 0) {
    return null;
  }

  const visible = format === 'total' ? [{ ...rows[0], name: activeLabel(rows.length) }] : rows.slice(0, 3);

  return (
    <div
      className={styles.hang}
      style={{
        ...PLACEMENT[position],
        width,
        border: color ? `1.5px solid ${color}` : `1px solid ${p.borda}`,
      }}
      title={format === 'total' ? rows.map((r) => `${r.short}: ${r.name}`).join('\n') : undefined}
    >
      {connector && color && (
        <span className={styles.connector} style={{ ...CONNECTOR[position], background: color }} />
      )}
      {visible.map((row, i) => (
        <div key={i} className={styles.hangRow}>
          <Pill row={row} wide />
          <span className={styles.hangName}>{row.name}</span>
          {format !== 'total' && row.age && <span className={styles.age}>{row.age}</span>}
        </div>
      ))}
      {format !== 'total' && rows.length > 3 && <div className={styles.hangMore}>{moreLabel(rows.length - 3)}</div>}
    </div>
  );
}

const ellipsis = { whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' };

const getStyles = (theme: GrafanaTheme2) => {
  const p: TfPalette = tfPalette(theme);
  return {
    divider: css({ height: 1, background: tfMix(p.rot, 22) }),
    pill: css({
      flex: 'none',
      font: `600 9.5px ${FONT_MONO}`,
      padding: '2px 5px',
      borderRadius: 3,
    }),
    pillWide: css({
      flex: 'none',
      minWidth: 38,
      textAlign: 'center',
      font: `600 9.5px ${FONT_MONO}`,
      padding: '2px 5px',
      borderRadius: 3,
    }),
    age: css({ flex: 'none', font: `10.5px ${FONT_MONO}`, color: p.tx2 }),
    insideList: css({ display: 'flex', flexDirection: 'column', gap: 5 }),
    insideRow: css({
      display: 'grid',
      gridTemplateColumns: '3px 34px minmax(0,1fr) auto',
      gap: 7,
      alignItems: 'center',
    }),
    insideBar: css({ width: 3, height: 14, borderRadius: 2 }),
    insideShort: css({ font: `600 9.5px ${FONT_MONO}`, color: p.tx2 }),
    insideName: css({ font: `12px ${FONT_SANS}`, color: p.tf, ...ellipsis }),
    insideMore: css({ font: `11px ${FONT_SANS}`, color: p.tx2, paddingLeft: 10 }),
    strip: css({ display: 'flex', flexDirection: 'column', gap: 6 }),
    segments: css({ display: 'flex', gap: 2, height: 5 }),
    segment: css({ flex: 1, borderRadius: 2 }),
    stripRow: css({ display: 'flex', alignItems: 'baseline', gap: 6, minWidth: 0 }),
    stripCount: css({ font: `700 12px ${FONT_SANS}`, color: p.tf }),
    stripName: css({ font: `12px ${FONT_SANS}`, color: p.tx, flex: 1, minWidth: 0, ...ellipsis }),
    totalRow: css({ display: 'flex', alignItems: 'center', gap: 7 }),
    totalText: css({ font: `500 12.5px ${FONT_SANS}`, color: p.tf }),
    counterRow: css({ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }),
    counterName: css({ flex: 1, minWidth: 0, font: `12px ${FONT_SANS}`, color: p.tf, ...ellipsis }),
    counterRest: css({ flex: 'none', font: `10.5px ${FONT_SANS}`, color: p.tx2 }),
    hang: css({
      position: 'absolute',
      pointerEvents: 'none',
      background: p.sup,
      borderRadius: 8,
      padding: 6,
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      boxShadow: `0 6px 18px ${p.shadow}`,
      zIndex: 3,
      fontFamily: FONT_SANS,
    }),
    connector: css({ position: 'absolute' }),
    hangRow: css({ display: 'flex', gap: 6, alignItems: 'center', minWidth: 0 }),
    hangName: css({ font: `12px ${FONT_SANS}`, color: p.tx, flex: 1, minWidth: 0, ...ellipsis }),
    hangMore: css({ font: `11px ${FONT_SANS}`, color: p.tx2, paddingLeft: 2 }),
  };
};
