import React from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { TfPalette, tfPalette } from '../../theme/palette';

/**
 * A chave do mockup: 30x18, botao branco, trilho no violeta de acento quando
 * ligada. Um `button` com `role="switch"` e `aria-checked` — o mesmo contrato
 * de acessibilidade do `Switch` do Grafana.
 */
interface TfSwitchProps {
  id?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  'aria-label'?: string;
  disabled?: boolean;
}

export function TfSwitch({ id, checked, onChange, disabled, ...rest }: TfSwitchProps) {
  const styles = useStyles2(getStyles);
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={rest['aria-label']}
      data-on={checked || undefined}
      disabled={disabled}
      className={styles.track}
      onClick={() => onChange(!checked)}
    >
      <span className={styles.knob} />
    </button>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  const p: TfPalette = tfPalette(theme);
  return {
    track: css({
      flex: 'none',
      position: 'relative',
      width: 30,
      height: 18,
      border: 0,
      borderRadius: 9,
      padding: 0,
      background: p.linha,
      cursor: 'pointer',
      '&[data-on]': { background: p.ac },
      '&:focus-visible': { outline: `2px solid ${p['ac-t']}`, outlineOffset: 2 },
      '&:disabled': { cursor: 'default', opacity: 0.6 },
    }),
    knob: css({
      position: 'absolute',
      top: 3,
      left: 2,
      width: 12,
      height: 12,
      borderRadius: '50%',
      background: p.tx2,
      transition: 'left 120ms ease',
      '[data-on] > &': { left: 14, background: '#FFFFFF' },
    }),
  };
};
