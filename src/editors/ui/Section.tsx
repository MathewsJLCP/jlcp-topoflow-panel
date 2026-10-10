import React from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { FONT_MONO, FONT_SANS, TfPalette, tfMix, tfPalette } from '../../theme/palette';

/** Titulo de secao do formulario: mono, maiusculo, com uma linha ate a borda. */
export function SectionHead({ children }: { children: React.ReactNode }) {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.head}>
      <span className={styles.headText}>{children}</span>
      <span className={styles.headLine} />
    </div>
  );
}

/** Aviso dentro do formulario: neutro (so texto) ou em caixa info/aviso/erro. */
export function Note({
  tone,
  title,
  children,
}: {
  tone?: 'info' | 'warn' | 'err';
  title?: string;
  children: React.ReactNode;
}) {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.note} data-tone={tone}>
      {title && <span className={styles.noteTitle}>{title}</span>}
      <span className={styles.noteBody}>{children}</span>
    </div>
  );
}

/** Botao tracejado "+ Adicionar ...". `wide` ocupa a linha, na cor de acento. */
export function DashedButton({
  children,
  onClick,
  wide,
}: {
  children: React.ReactNode;
  onClick: () => void;
  wide?: boolean;
}) {
  const styles = useStyles2(getStyles);
  return (
    <button type="button" className={wide ? styles.dashedWide : styles.dashed} onClick={onClick}>
      {children}
    </button>
  );
}

/** Link de texto sublinhado, para trocas de modo ("Usar um campo da query"). */
export function TextLink({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  const styles = useStyles2(getStyles);
  return (
    <button type="button" className={styles.link} onClick={onClick}>
      {children}
    </button>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  const p: TfPalette = tfPalette(theme);
  const tone = (color: string, text: string) => ({
    padding: '8px 10px',
    border: `1px solid ${tfMix(color, 55)}`,
    background: tfMix(color, 9),
    '& > span:first-of-type': { color: text },
  });
  return {
    head: css({ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }),
    headText: css({
      font: `600 10px ${FONT_MONO}`,
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      color: p.rot,
    }),
    headLine: css({ flex: 1, height: 1, background: p.linha }),
    note: css({
      display: 'flex',
      flexDirection: 'column',
      gap: 3,
      borderRadius: 7,
      '&[data-tone="info"]': tone(p.in, p['in-t']),
      '&[data-tone="warn"]': tone(p.at, p['at-t']),
      '&[data-tone="err"]': tone(p.cr, p['cr-t']),
    }),
    noteTitle: css({ font: `600 12px ${FONT_SANS}`, color: p.tx2 }),
    noteBody: css({ font: `11.5px/1.45 ${FONT_SANS}`, color: p.tx2, overflowWrap: 'anywhere' }),
    dashed: css({
      alignSelf: 'flex-start',
      border: `1px dashed ${p.linha}`,
      background: 'transparent',
      color: p['ac-t'],
      borderRadius: 6,
      padding: '5px 10px',
      font: `500 12px ${FONT_SANS}`,
      cursor: 'pointer',
      '&:hover': { borderColor: p.ac },
    }),
    dashedWide: css({
      width: '100%',
      border: `1px dashed ${p.ac}`,
      background: 'transparent',
      color: p['ac-t'],
      borderRadius: 7,
      padding: '7px 10px',
      font: `500 12.5px ${FONT_SANS}`,
      cursor: 'pointer',
    }),
    link: css({
      alignSelf: 'flex-start',
      border: 0,
      background: 'transparent',
      padding: 0,
      font: `500 12px ${FONT_SANS}`,
      color: p['ac-t'],
      cursor: 'pointer',
      textDecoration: 'underline',
      textUnderlineOffset: 3,
    }),
  };
};
