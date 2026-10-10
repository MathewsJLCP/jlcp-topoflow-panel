import React from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, useTheme2 } from '@grafana/ui';
import { NodeProps } from '@xyflow/react';

import { resolveText } from '../../data/dimensions';
import { accentColor, resolveElementColor } from '../../data/elementColor';
import { TextBackground } from '../../model/types';
import { DrilldownSurface } from '../DrilldownSurface';
import { TextFlowNode } from '../flowTypes';
import { hasDrilldown } from '../drilldown';
import { FONT_SANS, TfPalette, resolveTfColor, tfMix, tfPalette } from '../../theme/palette';

/**
 * Texto livre, no desenho do mockup: 500 no tamanho escolhido, cor fixa,
 * espacos preservados. Com fundo, ganha 4x8px de respiro e cantos de 6px. Com
 * drill-down, sublinhado.
 */
export function TextNode({ data, selected }: NodeProps<TextFlowNode>) {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const p = tfPalette(theme);
  const { element, frames, editable } = data;

  const accent = resolveElementColor({ fixed: element.color.fixed }, frames, theme);
  const color = accentColor(accent) ?? p.tx2;
  const background = textBackground(element.background, theme);

  return (
    /* O proprio glifo e a superficie do drill-down: o Texto nao tem card nem
       caixa, e envolve-lo numa so para receber o clique mudaria o elemento. */
    <DrilldownSurface
      drilldown={element.drilldown}
      editable={editable}
      className={styles.text}
      data-selected={selected || undefined}
      style={{
        color,
        fontSize: element.fontSize,
        background,
        padding: background ? '4px 8px' : 0,
        textDecoration: hasDrilldown(element.drilldown) ? 'underline' : 'none',
      }}
    >
      {resolveText(element.content, frames)}
    </DrilldownSurface>
  );
}

export function textBackground(background: TextBackground | undefined, theme: GrafanaTheme2): string | undefined {
  return background ? tfMix(resolveTfColor(background.color, theme), Math.round(background.opacity * 100)) : undefined;
}

const getStyles = (theme: GrafanaTheme2) => {
  const p: TfPalette = tfPalette(theme);
  return {
    text: css({
      display: 'block',
      borderRadius: 6,
      fontFamily: FONT_SANS,
      fontWeight: 500,
      lineHeight: 1.35,
      minWidth: 24,
      minHeight: '1.35em',
      whiteSpace: 'pre',
      cursor: 'default',
      textUnderlineOffset: 3,
      '&[data-selected]': { outline: `2px solid ${p.ac}`, outlineOffset: 3 },
    }),
  };
};
