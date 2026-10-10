import { injectGlobal } from '@emotion/css';

import sans400 from '@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff2';
import sans500 from '@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-500-normal.woff2';
import sans600 from '@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-600-normal.woff2';
import sans700 from '@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-700-normal.woff2';
import sans400ext from '@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-ext-400-normal.woff2';
import sans500ext from '@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-ext-500-normal.woff2';
import sans600ext from '@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-ext-600-normal.woff2';
import sans700ext from '@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-ext-700-normal.woff2';
import mono400 from '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2';
import mono500 from '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2';
import mono600 from '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-600-normal.woff2';
import mono400ext from '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-ext-400-normal.woff2';
import mono500ext from '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-ext-500-normal.woff2';
import mono600ext from '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-ext-600-normal.woff2';

/**
 * IBM Plex Sans e Mono **embutidas no plugin** (licenca OFL, via `@fontsource`).
 *
 * Embutidas, e nao do Google Fonts como no mockup: Grafana de NOC costuma rodar
 * sem saida para a internet, e la uma fonte remota simplesmente nao carrega — o
 * painel cairia no `system-ui` sem aviso. Vao so os subconjuntos `latin` e
 * `latin-ext` (o portugues inteiro cabe neles) e so `woff2`, que todo navegador
 * suportado pelo Grafana le.
 *
 * `font-display: swap` deixa o texto aparecer na fonte do sistema enquanto o
 * arquivo chega, em vez de um canvas sem rotulos no primeiro quadro.
 */
const LATIN =
  'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD';
const LATIN_EXT =
  'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF';

function face(family: string, weight: number, src: string, range: string): string {
  return `@font-face{font-family:'${family}';font-style:normal;font-display:swap;font-weight:${weight};src:url(${src}) format('woff2');unicode-range:${range};}`;
}

let injected = false;

/** Registra as fontes uma vez por pagina. Chamado na carga do modulo. */
export function injectTopoFlowFonts(): void {
  if (injected) {
    return;
  }
  injected = true;

  const sans: Array<[number, string, string]> = [
    [400, sans400, sans400ext],
    [500, sans500, sans500ext],
    [600, sans600, sans600ext],
    [700, sans700, sans700ext],
  ];
  const mono: Array<[number, string, string]> = [
    [400, mono400, mono400ext],
    [500, mono500, mono500ext],
    [600, mono600, mono600ext],
  ];

  injectGlobal(
    [
      ...sans.flatMap(([w, l, e]) => [face('IBM Plex Sans', w, e, LATIN_EXT), face('IBM Plex Sans', w, l, LATIN)]),
      ...mono.flatMap(([w, l, e]) => [face('IBM Plex Mono', w, e, LATIN_EXT), face('IBM Plex Mono', w, l, LATIN)]),
    ].join('\n')
  );
}
