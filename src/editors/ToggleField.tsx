import React from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { PopoverContent, useStyles2 } from '@grafana/ui';

import { FONT_SANS, TfPalette, tfPalette } from '../theme/palette';
import { FieldLabel } from './FieldLabel';
import { TfSwitch } from './ui/TfSwitch';

/**
 * Linha com chave, no desenho do mockup: rotulo (12.5px, `tx`) com a descricao
 * opcional embaixo, e a chave a direita. Ligada, o conteudo aparece logo abaixo.
 *
 * Os campos opcionais sao governados pela **presenca do valor** — desligar apaga
 * o campo; nao ha segundo estado para manter em sincronia.
 */
interface ToggleFieldProps {
  label: string;
  info?: PopoverContent;
  /** Texto curto sob o rotulo (o `desc` do mockup). */
  description?: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  children?: React.ReactNode;
}

export function ToggleField({ label, info, description, enabled, onToggle, children }: ToggleFieldProps) {
  const styles = useStyles2(getStyles);
  const id = React.useId();

  return (
    <div className={styles.toggleField}>
      <div className={styles.toggleRow}>
        <div className={styles.text}>
          <label className={styles.toggleLabel} htmlFor={id}>
            <FieldLabel info={info}>{label}</FieldLabel>
          </label>
          {description && <span className={styles.description}>{description}</span>}
        </div>
        <TfSwitch id={id} checked={enabled} onChange={onToggle} />
      </div>

      {/* Os controles internos nao repetem o rotulo: quem esta dentro de um
          `ToggleField` ja foi nomeado na linha da chave. */}
      {enabled && children && <div className={styles.toggleBody}>{children}</div>}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  const p: TfPalette = tfPalette(theme);
  return {
    toggleField: css({ display: 'flex', flexDirection: 'column', gap: 12 }),
    toggleRow: css({ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }),
    text: css({ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }),
    toggleLabel: css({
      '&&': { font: `500 12.5px/1.35 ${FONT_SANS}`, color: p.tx },
      cursor: 'pointer',
    }),
    description: css({ font: `11.5px/1.4 ${FONT_SANS}`, color: p.apa }),
    toggleBody: css({ display: 'flex', flexDirection: 'column', gap: 12 }),
  };
};
