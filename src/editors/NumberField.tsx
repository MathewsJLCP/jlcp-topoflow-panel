import React from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { Field, Input, PopoverContent, useStyles2 } from '@grafana/ui';

import { FONT_MONO, FONT_SANS, TfPalette, tfPalette } from '../theme/palette';
import { FieldLabel } from './FieldLabel';

/**
 * Campo numerico com rascunho: o texto digitado fica na tela enquanto nao
 * forma um numero valido (apagar para redigitar nao grava zero), e so numeros
 * dentro da faixa sao gravados.
 *
 * `inline` e o formato do mockup: o rotulo dentro da caixa, a esquerda, e o
 * numero a direita — como o par Largura/Altura e a espessura da borda.
 */
interface NumberFieldProps {
  label: string;
  info?: PopoverContent;
  value: number;
  min: number;
  max?: number;
  suffix?: string;
  inline?: boolean;
  onChange: (value: number) => void;
}

export function NumberField({ label, info, value, min, max, suffix, inline, onChange }: NumberFieldProps) {
  const styles = useStyles2(getStyles);
  const id = React.useId();
  const [raw, setRaw] = React.useState(() => String(value));

  const [lastValue, setLastValue] = React.useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setRaw(String(value));
  }

  const handleChange = (next: string) => {
    setRaw(next);
    const parsed = Number(next.replace(',', '.'));
    const dentroDaFaixa = parsed >= min && (max === undefined || parsed <= max);
    if (next.trim() !== '' && Number.isFinite(parsed) && dentroDaFaixa) {
      onChange(parsed);
    }
  };

  if (inline) {
    return (
      <label className={styles.box} htmlFor={id}>
        <span className={styles.boxLabel}>{label}</span>
        <input
          id={id}
          className={styles.boxInput}
          inputMode="decimal"
          value={raw}
          aria-label={label}
          onChange={(event) => handleChange(event.currentTarget.value)}
          onBlur={() => setRaw(String(value))}
        />
        {suffix && <span className={styles.boxLabel}>{suffix}</span>}
      </label>
    );
  }

  return (
    <Field label={<FieldLabel info={info}>{label}</FieldLabel>}>
      <Input
        type="number"
        min={min}
        max={max}
        value={raw}
        suffix={suffix}
        onChange={(event) => handleChange(event.currentTarget.value)}
        onBlur={() => setRaw(String(value))}
      />
    </Field>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  const p: TfPalette = tfPalette(theme);
  return {
    box: css({
      '&&': {
        minWidth: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        background: p.elev,
        border: `1px solid ${p.borda}`,
        borderRadius: 6,
        padding: '0 8px',
        cursor: 'text',
      },
      '&:focus-within': { borderColor: p.ac },
    }),
    boxLabel: css({ flex: 'none', font: `11px ${FONT_SANS}`, color: p.apa }),
    boxInput: css({
      '&&': {
        width: 0,
        flex: 1,
        minWidth: 0,
        border: 0,
        background: 'transparent',
        padding: '7px 0',
        font: `13px ${FONT_MONO}`,
        color: p.tx,
        outline: 'none',
        textAlign: 'right',
        boxShadow: 'none',
      },
    }),
  };
};
