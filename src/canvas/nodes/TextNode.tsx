import React from 'react';
import { css, cx } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, useTheme2 } from '@grafana/ui';
import { NodeProps } from '@xyflow/react';

import { resolveText } from '../../data/dimensions';
import { accentColor, resolveElementColor } from '../../data/elementColor';
import { TextFlowNode } from '../flowTypes';
import { selectionRing } from '../tokens';

/**
 * Texto solto sobre o canvas. Sem handles: nao participa de conexao.
 *
 * Unico elemento em que a cor pousa no proprio glifo (A.2) — nao ha card nem
 * capsula onde ela pudesse pousar sem virar preenchimento.
 */
export function TextNode({ data, selected }: NodeProps<TextFlowNode>) {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const { element, frames } = data;

  const accent = resolveElementColor(element.color, frames, theme, { trigger: element.trigger });
  const color =
    accentColor(accent) ?? (accent.state === 'nodata' ? theme.colors.text.disabled : theme.colors.text.primary);

  return (
    <div
      className={cx(styles.text, selected && styles.selected)}
      style={{ color, fontSize: element.fontSize }}
    >
      {resolveText(element.content, frames)}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  text: css({
    display: 'block',
    padding: theme.spacing(0.25, 0.5),
    borderRadius: theme.shape.radius.default,
    fontFamily: theme.typography.fontFamily,
    fontWeight: theme.typography.fontWeightMedium,
    lineHeight: 1.4,
    minWidth: 60,
    minHeight: '1.4em',
    whiteSpace: 'pre',
    cursor: 'default',
  }),
  /**
   * Anel, nao preenchimento: o Text nao tem superficie propria, e qualquer
   * fundo de selecao o transformaria num card que ele nao e. `box-shadow` nao
   * ocupa espaco no layout, entao selecionar nao desloca o texto.
   *
   * Substitui o contorno tracejado em `border.medium`, que era discreto demais
   * para sinalizar estado — quase invisivel sobre o fundo do canvas.
   */
  selected: css({
    boxShadow: selectionRing(theme.colors.primary.main),
  }),
});
