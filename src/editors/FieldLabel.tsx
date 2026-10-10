import React from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { PopoverContent, Tooltip, useStyles2 } from '@grafana/ui';

import { FONT_SANS, TfPalette, tfPalette } from '../theme/palette';

/**
 * Rotulo de campo com o "i" do mockup: um circulo de 14px que mostra a
 * explicacao no hover. A dica vive no `Tooltip` do Grafana (posicionamento e
 * acessibilidade de graca); o desenho do gatilho e o do mockup.
 */
interface FieldLabelProps {
  children: React.ReactNode;
  info?: PopoverContent;
}

export function FieldLabel({ children, info }: FieldLabelProps) {
  const styles = useStyles2(getStyles);

  if (!info) {
    return <>{children}</>;
  }

  return (
    <span className={styles.label}>
      <span className={styles.text}>{children}</span>
      <Tooltip content={info} placement="top">
        <button
          type="button"
          className={styles.trigger}
          aria-label="Mais informações"
          onClick={(event) => event.preventDefault()}
        >
          <span aria-hidden>i</span>
        </button>
      </Tooltip>
    </span>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  const p: TfPalette = tfPalette(theme);
  return {
    label: css({ display: 'inline-flex', alignItems: 'center', gap: 6 }),
    text: css({ whiteSpace: 'nowrap' }),
    trigger: css({
      flex: 'none',
      width: 14,
      height: 14,
      padding: 0,
      borderRadius: '50%',
      border: `1px solid ${p.apa}`,
      background: 'none',
      color: p.apa,
      font: `600 9px/12px ${FONT_SANS}`,
      textAlign: 'center',
      cursor: 'help',
      '&:hover': { borderColor: p.tx2, color: p.tx2 },
      '&:focus-visible': { outline: `2px solid ${p.ac}`, outlineOffset: 2 },
    }),
  };
};
