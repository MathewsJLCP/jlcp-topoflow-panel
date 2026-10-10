import React, { useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, useTheme2 } from '@grafana/ui';

import { ElementColor } from '../data/elementColor';
import { ActiveProblem } from '../data/triggerState';
import { FONT_MONO, FONT_SANS, TfPalette, tfPalette } from '../theme/palette';
import { severityOnColor, severityTfColor } from '../theme/severity';
import { HoverLayerContext } from './HoverLayer';

/**
 * O popover de hover do elemento, no desenho do mockup.
 *
 * Em alarme, a lista de incidentes (severidade, nome, idade); sem alarme, o
 * grafico das metricas, quando o elemento pediu. Ele nasce **dentro do canvas**,
 * a direita do elemento — ou a esquerda, perto da borda —, e se encolhe para
 * caber.
 *
 * No dashboard, clicar num elemento em alarme **fixa** o popover (o operador
 * pode ler com calma); Esc ou um clique fora soltam. No editor o clique
 * seleciona, e com drill-down o clique navega — nos dois casos nao ha fixar.
 */
interface ElementHoverProps {
  accent: ElementColor;
  /** Cabecalho da lista: o nome do elemento (ou do host). */
  title?: string;
  editable?: boolean;
  /** Elemento com drill-down: o clique navega, nao fixa. */
  linked?: boolean;
  dragging?: boolean;
  chart?: React.ReactElement;
  children: React.ReactElement<{
    onClick?: React.MouseEventHandler;
    onMouseEnter?: React.MouseEventHandler;
    onMouseLeave?: React.MouseEventHandler;
  }>;
}

const GAP = 14;
const EDGE = 8;

export function ElementHover({ accent, title, editable, linked, dragging, chart, children }: ElementHoverProps) {
  const styles = useStyles2(getStyles);
  const layer = useContext(HoverLayerContext);
  const [hover, setHover] = useState(false);
  const [pinned, setPinned] = useState(false);
  const anchorRef = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | undefined>();

  const problems = accent.state === 'trigger' ? accent.problems : EMPTY;
  const kind = problems.length > 0 ? 'inc' : chart ? 'chart' : undefined;
  const pinnable = kind === 'inc' && !editable && !linked;

  if (!pinnable && pinned) {
    setPinned(false);
  }

  const visible = Boolean(kind) && !dragging && (hover || pinned);

  useEffect(() => {
    if (!pinned) {
      return;
    }
    const soltar = (event: Event) => {
      const target = event.target as Node | null;
      if (!target || anchorRef.current?.contains(target) || panelRef.current?.contains(target)) {
        return;
      }
      setPinned(false);
    };
    // O Grafana consome o Esc antes do bubbling: listener de captura.
    const tecla = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPinned(false);
        event.stopPropagation();
      }
    };
    document.addEventListener('pointerdown', soltar, true);
    document.addEventListener('keydown', tecla, true);
    return () => {
      document.removeEventListener('pointerdown', soltar, true);
      document.removeEventListener('keydown', tecla, true);
    };
  }, [pinned]);

  // Posicao: ao lado do elemento, dentro do canvas.
  useLayoutEffect(() => {
    if (!visible || !anchorRef.current) {
      return;
    }
    const host = layer ?? document.body;
    const L = host.getBoundingClientRect();
    const r = anchorRef.current.getBoundingClientRect();
    const width = kind === 'chart' ? 470 : 300;
    const height = panelRef.current?.offsetHeight ?? 0;
    let x = r.right - L.left + GAP;
    if (x + width > L.width - EDGE) {
      x = Math.max(EDGE, r.left - L.left - GAP - width);
    }
    const y = Math.max(EDGE, Math.min(r.top - L.top, L.height - height - EDGE));
    if (!pos || pos.x !== x || pos.y !== y) {
      setPos({ x, y });
    }
  }, [visible, layer, kind, pos]);

  const onClick = useCallback(
    (event: React.MouseEvent) => {
      children.props.onClick?.(event);
      if (pinnable) {
        setPinned((atual) => !atual);
      }
    },
    [children, pinnable]
  );

  if (!kind) {
    return children;
  }

  const anchor = React.cloneElement(children, {
    ref: (node: HTMLElement | null) => {
      anchorRef.current = node;
    },
    onMouseEnter: (event: React.MouseEvent) => {
      children.props.onMouseEnter?.(event);
      setHover(true);
    },
    onMouseLeave: (event: React.MouseEvent) => {
      children.props.onMouseLeave?.(event);
      setHover(false);
    },
    // Teclado: o foco abre o mesmo popover que o ponteiro.
    onFocus: () => setHover(true),
    onBlur: () => setHover(false),
    onClick,
  } as Partial<typeof children.props> & { ref: React.Ref<HTMLElement> });

  const host = layer ?? (typeof document !== 'undefined' ? document.body : null);

  return (
    <>
      {anchor}
      {visible &&
        host &&
        createPortal(
          <div
            ref={panelRef}
            className={styles.panel}
            style={{
              left: pos?.x ?? -9999,
              top: pos?.y ?? -9999,
              width: kind === 'chart' ? 470 : 300,
              position: layer ? 'absolute' : 'fixed',
            }}
            onMouseDown={(event) => event.stopPropagation()}
            role="tooltip"
          >
            {kind === 'inc' ? <ProblemList title={title} problems={problems} pinned={pinned} /> : chart}
          </div>,
          host
        )}
    </>
  );
}

const EMPTY: ActiveProblem[] = [];

function ProblemList({ title, problems, pinned }: { title?: string; problems: ActiveProblem[]; pinned: boolean }) {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const [now] = useState(() => Date.now());

  return (
    <>
      <div className={styles.header}>
        <span className={styles.title}>{title}</span>
        <span className={styles.count}>{countLabel(problems.length)}</span>
      </div>
      <div className={styles.list}>
        {problems.map((problem, index) => {
          const native = problem.color === severityTfColor(problem.severity, theme);
          return (
            <div className={styles.row} key={`${problem.name}-${index}`}>
              <span
                className={styles.pill}
                style={{
                  background: problem.color,
                  color: native ? severityOnColor(problem.severity, theme) : tfPalette(theme)['on-cr'],
                }}
              >
                {problem.label}
              </span>
              <span className={styles.name}>{problem.name}</span>
              <span className={styles.age}>{problem.since === undefined ? '' : formatAge(problem.since, now)}</span>
            </div>
          );
        })}
      </div>
      {pinned && <div className={styles.pinned}>Fixado · Esc ou clique fora para soltar</div>}
    </>
  );
}

export function alarmLabel(label: string, count: number): string {
  return count > 1 ? `${label} ·${count}` : label;
}

export function countLabel(count: number): string {
  return count === 1 ? '1 problema ativo' : `${count} problemas ativos`;
}

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Idade de um problema, para quem esta de pe na frente do telao: `há 4m`,
 * `há 2h`, `há 3d`. Abaixo de um minuto vira `agora`.
 */
export function formatAge(since: number, now: number): string {
  const elapsed = Math.floor(now / 1000) - since;

  if (elapsed < MINUTE) {
    return 'agora';
  }
  if (elapsed < HOUR) {
    return `há ${Math.floor(elapsed / MINUTE)}m`;
  }
  if (elapsed < DAY) {
    return `há ${Math.floor(elapsed / HOUR)}h`;
  }

  return `há ${Math.floor(elapsed / DAY)}d`;
}

const getStyles = (theme: GrafanaTheme2) => {
  const p: TfPalette = tfPalette(theme);
  return {
    panel: css({
      maxHeight: 'calc(100% - 16px)',
      background: p.sup,
      border: `1px solid ${p.borda}`,
      borderRadius: 10,
      boxShadow: `0 10px 30px ${p.shadow}`,
      zIndex: 7,
      overflowX: 'hidden',
      overflowY: 'auto',
      fontFamily: FONT_SANS,
      color: p.tx,
      textAlign: 'left',
    }),
    header: css({
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: 8,
      padding: '10px 12px 8px',
      borderBottom: `1px solid ${p.linha}`,
    }),
    title: css({
      font: `600 13px ${FONT_SANS}`,
      color: p.tf,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }),
    count: css({ flex: 'none', font: `12px ${FONT_SANS}`, color: p.tx2 }),
    list: css({ display: 'flex', flexDirection: 'column', padding: '4px 0' }),
    row: css({
      display: 'grid',
      gridTemplateColumns: 'auto minmax(0,1fr) auto',
      gap: 8,
      alignItems: 'center',
      padding: '6px 12px',
    }),
    pill: css({ font: `600 10px ${FONT_MONO}`, padding: '2px 6px', borderRadius: 3 }),
    name: css({ font: `12.5px ${FONT_SANS}`, color: p.tx, overflowWrap: 'anywhere' }),
    age: css({ font: `11.5px ${FONT_MONO}`, color: p.tx2, whiteSpace: 'nowrap' }),
    pinned: css({
      padding: '6px 12px 9px',
      font: `11px ${FONT_SANS}`,
      color: p.apa,
      borderTop: `1px solid ${p.linha}`,
    }),
  };
};
