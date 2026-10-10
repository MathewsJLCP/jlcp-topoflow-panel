import React from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { PopoverContent, useStyles2 } from '@grafana/ui';

import { FONT_SANS, TfPalette, tfPalette } from '../../theme/palette';
import { FieldLabel } from '../FieldLabel';

/**
 * O select nativo do mockup, para listas curtas e fechadas (formato,
 * animacao). Listas longas ou com valor digitado continuam no `Combobox`.
 */
interface TfSelectProps<T extends string> {
  label?: string;
  info?: PopoverContent;
  value: T | undefined;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  placeholder?: string;
  'aria-label'?: string;
  compact?: boolean;
}

export function TfSelect<T extends string>({
  label,
  info,
  value,
  options,
  onChange,
  placeholder,
  compact,
  ...rest
}: TfSelectProps<T>) {
  const styles = useStyles2(getStyles);
  const id = React.useId();
  const select = (
    <select
      id={id}
      className={compact ? styles.compact : styles.select}
      value={value ?? ''}
      aria-label={label ? undefined : rest['aria-label']}
      onChange={(event) => onChange(event.currentTarget.value as T)}
    >
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );

  if (!label) {
    return select;
  }

  return (
    <div className={styles.field}>
      <label htmlFor={id}>
        <FieldLabel info={info}>{label}</FieldLabel>
      </label>
      {select}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  const p: TfPalette = tfPalette(theme);
  const base = {
    width: '100%',
    boxSizing: 'border-box' as const,
    background: p.elev,
    border: `1px solid ${p.borda}`,
    color: p.tx,
    outline: 'none',
    '&:focus': { borderColor: p.ac },
    '& option': { background: p.sup, color: p.tx },
  };
  return {
    field: css({ display: 'flex', flexDirection: 'column', gap: 6 }),
    select: css({ ...base, height: 32, borderRadius: 6, padding: '0 8px', font: `13px/1 ${FONT_SANS}` }),
    compact: css({ ...base, height: 26, borderRadius: 6, padding: '0 3px', font: `12px/1 ${FONT_SANS}` }),
  };
};
