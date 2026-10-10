import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';

import { FONT_SANS, tfPalette } from '../../theme/palette';

/**
 * A pele do editor: os campos do `@grafana/ui` que continuam no formulario
 * (inputs, combos, slider) vestidos com a paleta e a tipografia do mockup.
 *
 * Os controles que definem a cara do mockup — segmentado, chave, cartoes, botoes
 * tracejados — sao componentes proprios (`ui/`). Os que ficam do Grafana sao os
 * que carregam comportamento que nao vale reescrever (o `Combobox`, com busca e
 * valor digitado); estes ganham so a aparencia, por seletor de elemento, escopo
 * restrito a raiz do editor.
 */
export function editorSkin(theme: GrafanaTheme2): string {
  const p = tfPalette(theme);
  return css({
    fontFamily: FONT_SANS,
    color: p.tx,

    // Rotulo de campo: 500 11.5px no `rot`.
    '& label': {
      font: `500 11.5px/1.35 ${FONT_SANS}`,
      color: p.rot,
    },

    // Campos de texto, numero e os combos (que sao um Input por baixo).
    [`& input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]):not([type="file"]),
      & textarea`]: {
      background: p.elev,
      border: `1px solid ${p.borda}`,
      borderRadius: 6,
      color: p.tx,
      font: `13px ${FONT_SANS}`,
      boxShadow: 'none',
      '&:focus, &:focus-visible': { borderColor: p.ac, outline: 'none', boxShadow: 'none' },
      '&::placeholder': { color: p.apa },
    },
    '& textarea': { font: `12.5px/1.45 'IBM Plex Mono', ui-monospace, monospace` },

    // Slider (rc-slider) no violeta.
    '& .rc-slider-rail': { background: p.linha },
    '& .rc-slider-track': { background: p.ac },
    '& .rc-slider-handle': { borderColor: p.ac, background: p.sup, boxShadow: 'none', opacity: 1 },
    '& .rc-slider-handle:hover, & .rc-slider-handle:active, & .rc-slider-handle:focus': {
      borderColor: p['ac-t'],
      boxShadow: 'none',
    },

    '& input[type="checkbox"]': { accentColor: p.ac },
  });
}
