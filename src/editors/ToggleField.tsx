import React from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { PopoverContent, Switch, useStyles2 } from '@grafana/ui';

import { FieldLabel } from './FieldLabel';

interface ToggleFieldProps {
  label: string;
  /** Mesma regra do `FieldLabel`: explicacao atras do icone, nunca no corpo. */
  info?: PopoverContent;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  children: React.ReactNode;
}

/**
 * Campo opcional: um `Switch` com rotulo e, quando ligado, o controle de fato.
 *
 * O formulario do no acumulou campos que nem todo no usa. Todos visiveis o tempo
 * todo, o que e opcional fica indistinguivel do que e essencial — e o nome do no
 * (o unico campo obrigatorio) some no meio da lista. Com o toggle, o formulario
 * de um no simples ocupa quatro linhas.
 */
export function ToggleField({ label, info, enabled, onToggle, children }: ToggleFieldProps) {
  const styles = useStyles2(getStyles);
  const id = React.useId();

  return (
    <div className={styles.toggleField}>
      <div className={styles.toggleRow}>
        <label className={styles.toggleLabel} htmlFor={id}>
          <FieldLabel info={info}>{label}</FieldLabel>
        </label>
        <Switch id={id} value={enabled} onChange={(event) => onToggle(event.currentTarget.checked)} />
      </div>

      {/* Os controles internos nao repetem o rotulo: quem esta dentro de um
          `ToggleField` ja foi nomeado na linha do switch. */}
      {enabled && <div className={styles.toggleBody}>{children}</div>}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  toggleField: css({
    marginBottom: theme.spacing(2),
  }),
  toggleRow: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
  }),
  toggleLabel: css({
    color: theme.colors.text.primary,
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
    cursor: 'pointer',
  }),
  toggleBody: css({
    marginTop: theme.spacing(1),
  }),
});
