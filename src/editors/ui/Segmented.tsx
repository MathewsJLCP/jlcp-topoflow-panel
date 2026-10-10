import React from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { FONT_SANS, TfPalette, tfPalette } from '../../theme/palette';

/**
 * Controle segmentado do mockup: trilho `elev` com os botoes colados, o
 * escolhido cheio no violeta de acento.
 *
 * Substitui o `RadioButtonGroup` do Grafana no editor com a mesma forma de uso
 * (`options`, `value`, `onChange`) e a mesma semantica para leitor de tela e
 * testes: um `radiogroup` de botoes `radio` com `aria-checked`.
 */
export interface SegmentedOption<T> {
  value?: T;
  label?: string;
  /** Vira `title` — a dica de quem so tem um glifo como rotulo. */
  description?: string;
}

interface SegmentedProps<T> {
  options: Array<SegmentedOption<T>>;
  value: T | undefined;
  onChange: (value: T) => void;
  /** Nome do grupo para leitor de tela, quando nao ha rotulo visivel ligado. */
  'aria-label'?: string;
  /** Compatibilidade com o `RadioButtonGroup`; o segmentado ja ocupa a largura toda. */
  fullWidth?: boolean;
  size?: 'sm' | 'md';
  disabled?: boolean;
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  disabled,
  ...rest
}: SegmentedProps<T>) {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.track} role="radiogroup" aria-label={rest['aria-label']}>
      {options.map((option) => {
        const on = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={option.label}
            title={option.description}
            data-on={on || undefined}
            disabled={disabled}
            className={styles.button}
            onClick={() => option.value !== undefined && onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  const p: TfPalette = tfPalette(theme);
  return {
    track: css({
      display: 'flex',
      gap: 2,
      padding: 2,
      background: p.elev,
      border: `1px solid ${p.borda}`,
      borderRadius: 7,
    }),
    button: css({
      flex: 1,
      minWidth: 0,
      border: 0,
      borderRadius: 5,
      padding: '5px 4px',
      font: `500 12px ${FONT_SANS}`,
      cursor: 'pointer',
      background: 'transparent',
      color: p.tx2,
      whiteSpace: 'nowrap',
      '&[data-on]': { background: p.ac, color: p['on-ac'] },
      '&:not([data-on]):hover': { color: p.tx },
      '&:focus-visible': { outline: `2px solid ${p['ac-t']}`, outlineOffset: 1 },
      '&:disabled': { cursor: 'default', opacity: 0.6 },
    }),
  };
};
