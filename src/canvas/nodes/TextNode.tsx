import React from 'react';
import { css, cx } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, useTheme2 } from '@grafana/ui';
import { NodeProps } from '@xyflow/react';

import { resolveText } from '../../data/dimensions';
import { accentColor, resolveElementColor } from '../../data/elementColor';
import { TextBackground } from '../../model/types';
import { DrilldownSurface } from '../DrilldownSurface';
import { TextFlowNode } from '../flowTypes';
import { alpha, selectionRing } from '../tokens';

/**
 * Texto solto sobre o canvas. Sem handles: nao participa de conexao.
 *
 * Unico elemento em que a cor pousa no proprio glifo (A.2) — nao ha card nem
 * capsula onde ela pudesse pousar sem virar preenchimento.
 *
 * **Sem estado.** O Texto nao tem trigger nem thresholds (decisao D5), entao a
 * cadeia de cor comeca ja no nivel 2: so `color.fixed` e o neutro do tema. O
 * `field` que uma topologia antiga possa carregar em `color` fica inerte de
 * proposito — nao ha migrador, e repintar texto por metrica era exatamente o
 * comportamento que saiu.
 */
export function TextNode({ data, selected }: NodeProps<TextFlowNode>) {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const { element, frames, editable } = data;

  const accent = resolveElementColor({ fixed: element.color.fixed }, frames, theme);
  const color = accentColor(accent) ?? theme.colors.text.primary;

  const background = textBackground(element.background, theme);

  return (
    /* O proprio glifo e a superficie do drill-down: o Texto nao tem card nem
       caixa, e envolve-lo numa so para receber o clique mudaria o elemento. */
    <DrilldownSurface
      drilldown={element.drilldown}
      editable={editable}
      className={cx(styles.text, selected && styles.selected)}
      style={{ color, fontSize: element.fontSize, background }}
    >
      {resolveText(element.content, frames)}
    </DrilldownSurface>
  );
}

/**
 * Cor de fundo da placa, ou `undefined` para "sem placa" — o transparente que o
 * Texto sempre teve.
 *
 * Funcao propria, e exportada, por dois motivos. A opacidade precisa viver
 * **dentro da cor**: num `opacity` do elemento ela apagaria o glifo junto, e a
 * placa existe justamente para o contrario. E o `color-mix` que `alpha` produz e
 * invalido para o parser de CSS do jsdom, que descarta o estilo inline inteiro —
 * entao o valor so e verificavel aqui, e nao pelo DOM renderizado.
 *
 * O nome da cor e resolvido pelo tema a cada render, nunca no que fica salvo:
 * e o que faz a mesma topologia acompanhar claro e escuro.
 */
export function textBackground(background: TextBackground | undefined, theme: GrafanaTheme2): string | undefined {
  return background ? alpha(theme.visualization.getColorByName(background.color), background.opacity) : undefined;
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
