import React from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2, colorManipulator } from '@grafana/data';
import { PopoverContent, useStyles2, useTheme2 } from '@grafana/ui';

import { FONT_MONO, TfPalette, resolveTfColor, tfPalette } from '../../theme/palette';
import { FieldLabel } from '../FieldLabel';

/**
 * Faixa do mockup: rotulo a esquerda, o valor formatado a direita (mono), e o
 * slider nativo no violeta de acento.
 */
interface TfRangeProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  /** O texto do valor ("12 px", "22%"). */
  show: string;
  onChange: (value: number) => void;
  /** "valores diferentes", na edicao em massa. */
  mixed?: boolean;
}

export function TfRange({ label, value, min, max, step, show, onChange, mixed }: TfRangeProps) {
  const styles = useStyles2(getStyles);
  const id = React.useId();
  return (
    <div className={styles.field}>
      <div className={styles.row}>
        <label htmlFor={id} className={styles.label}>
          {label}
          {mixed && <span className={styles.mixed}>valores diferentes</span>}
        </label>
        <span className={styles.value}>{show}</span>
      </div>
      <input
        id={id}
        type="range"
        className={styles.range}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
      />
    </div>
  );
}

/** Linha de cor do mockup: rotulo a esquerda; o hex e o quadrado de cor a direita. */
interface TfColorRowProps {
  label: string;
  info?: PopoverContent;
  color: string;
  onChange: (hex: string) => void;
}

export function TfColorRow({ label, info, color, onChange }: TfColorRowProps) {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const id = React.useId();
  let hex = '#000000';
  try {
    hex = colorManipulator.asHexString(resolveTfColor(color, theme)).slice(0, 7).toUpperCase();
  } catch {
    // cor ilegivel salva a mao: o quadrado mostra preto, o salvo fica intacto
  }
  return (
    <div className={styles.colorRow}>
      <label htmlFor={id} className={styles.label}>
        <FieldLabel info={info}>{label}</FieldLabel>
      </label>
      <div className={styles.colorRight}>
        <span className={styles.hex}>{hex}</span>
        <input
          id={id}
          type="color"
          className={styles.swatch}
          value={hex}
          onChange={(event) => onChange(event.currentTarget.value.toUpperCase())}
        />
      </div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  const p: TfPalette = tfPalette(theme);
  return {
    field: css({ display: 'flex', flexDirection: 'column', gap: 6 }),
    row: css({ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }),
    label: css({ display: 'flex', alignItems: 'center', gap: 6 }),
    mixed: css({ font: `italic 11px 'IBM Plex Sans', sans-serif`, color: p.apa }),
    value: css({ font: `12px ${FONT_MONO}`, color: p.tx }),
    range: css({ width: '100%', accentColor: p.ac }),
    colorRow: css({ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }),
    colorRight: css({ display: 'flex', alignItems: 'center', gap: 8 }),
    hex: css({ font: `12px ${FONT_MONO}`, color: p.tx2 }),
    swatch: css({
      width: 28,
      height: 24,
      padding: 0,
      border: `1px solid ${p.borda}`,
      borderRadius: 5,
      background: 'none',
      cursor: 'pointer',
    }),
  };
};
