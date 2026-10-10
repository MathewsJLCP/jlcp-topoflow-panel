import { GrafanaTheme2 } from '@grafana/data';

/**
 * A paleta do TopoFlow, copiada do mockup da v1.4 (`TopoFlow v2 Figma`).
 *
 * **Este e o unico arquivo com cor literal do plugin.** A regra antiga ("zero
 * cor literal, so `theme.colors.*`") virou "cor literal so aqui": o desenho dos
 * elementos tem de sair identico ao mockup, e os tokens do Grafana nao chegam
 * nesses valores. O que continua vindo do Grafana e **qual** das duas paletas
 * vale — o painel acompanha o tema do usuario, nunca escolhe um proprio.
 *
 * Os nomes sao os do mockup, para que portar um trecho dele seja trocar
 * `var(--sup)` por `tfVar('sup')` e nada mais:
 *
 *   - `fundo`, `sup`, `elev` — as tres superficies, da mais funda para a mais alta;
 *   - `borda`, `linha` — contorno de superficie e divisoria interna;
 *   - `tf`, `tx`, `tx2`, `rot`, `apa` — texto, do titulo ao apagado;
 *   - `ok`, `at`, `la`, `cr`, `in`, `ac` — verde, ambar, laranja, vermelho, azul
 *     e o violeta de acento (selecao, foco, botao primario). O sufixo `-t` e a
 *     versao para **texto**, com contraste sobre `sup`;
 *   - `on-*` — texto sobre a cor cheia.
 */
export const TF_TOKEN_NAMES = [
  'fundo',
  'sup',
  'elev',
  'borda',
  'linha',
  'tf',
  'tx',
  'tx2',
  'rot',
  'apa',
  'apa-t',
  'ok',
  'ok-t',
  'at',
  'at-t',
  'la',
  'la-t',
  'cr',
  'cr-t',
  'in',
  'in-t',
  'ac',
  'ac-t',
  'ameixa',
  'on-cr',
  'on-la',
  'on-at',
  'on-in',
  'on-apa',
  'on-ac',
  'shadow',
  'grid',
] as const;

export type TfToken = (typeof TF_TOKEN_NAMES)[number];
export type TfPalette = Record<TfToken, string>;

export const TF_DARK: TfPalette = {
  fundo: '#0A0A0F',
  sup: '#14141C',
  elev: '#1A1A22',
  borda: '#2C2C36',
  linha: '#3D3D48',
  tf: '#EDEDF2',
  tx: '#E2E2E8',
  tx2: '#A8A8B3',
  rot: '#8D8D98',
  apa: '#6F6F7B',
  'apa-t': '#8D8D98',
  ok: '#22C55E',
  'ok-t': '#4ADE80',
  at: '#F59E0B',
  'at-t': '#FBBF24',
  la: '#F97316',
  'la-t': '#FB923C',
  cr: '#EF4444',
  'cr-t': '#F87171',
  in: '#3B82F6',
  'in-t': '#60A5FA',
  ac: '#8B7CF6',
  'ac-t': '#A99BFA',
  ameixa: '#33295C',
  'on-cr': '#0A0A0F',
  'on-la': '#0A0A0F',
  'on-at': '#0A0A0F',
  'on-in': '#0A0A0F',
  'on-apa': '#FFFFFF',
  'on-ac': '#0A0A0F',
  shadow: 'rgba(0,0,0,.5)',
  grid: 'rgba(255,255,255,.08)',
};

/** O claro so redefine o que muda; o resto (`on-cr`, `on-la`...) herda do escuro, como no mockup. */
export const TF_LIGHT: TfPalette = {
  ...TF_DARK,
  fundo: '#F6F7FB',
  sup: '#FFFFFF',
  elev: '#EEF0F8',
  borda: '#DCDFEE',
  linha: '#E4E6F1',
  tf: '#25255A',
  tx: '#383874',
  tx2: '#5A5C90',
  rot: '#6F71A2',
  apa: '#7B7DA8',
  'apa-t': '#6F71A2',
  ok: '#00B929',
  'ok-t': '#00841D',
  at: '#F2A000',
  'at-t': '#A86400',
  la: '#F26A12',
  'la-t': '#BF4A00',
  cr: '#FF2D2E',
  'cr-t': '#D0182A',
  in: '#023AFF',
  'in-t': '#023AFF',
  ac: '#6E3AD8',
  'ac-t': '#5A2BC2',
  ameixa: '#F1E4EE',
  'on-in': '#FFFFFF',
  'on-ac': '#FFFFFF',
  shadow: 'rgba(56,56,116,.18)',
  grid: 'rgba(56,56,116,.13)',
};

export function tfPalette(theme: Pick<GrafanaTheme2, 'isDark'>): TfPalette {
  return theme.isDark ? TF_DARK : TF_LIGHT;
}

/** Leitura de um token pelo nome da custom property, para usar em CSS. */
export function tfVar(token: TfToken): string {
  return `var(--tf-${token})`;
}

/**
 * As custom properties da paleta vigente, para o `style` da raiz de cada arvore
 * React do plugin (o painel e o editor de opcoes sao arvores separadas — cada
 * uma precisa das suas).
 */
export function tfCssVars(theme: Pick<GrafanaTheme2, 'isDark'>): Record<string, string> {
  const palette = tfPalette(theme);
  return Object.fromEntries(TF_TOKEN_NAMES.map((token) => [`--tf-${token}`, palette[token]]));
}

/**
 * `color-mix` em oklab, como o mockup inteiro faz: `tfMix(c, 16, base)` e
 * "16% de `c` sobre `base`". Sem `base`, mistura com transparente.
 */
export function tfMix(color: string, percent: number, base = 'transparent'): string {
  return `color-mix(in oklab, ${color} ${percent}%, ${base})`;
}

export const FONT_SANS = "'IBM Plex Sans', system-ui, sans-serif";
export const FONT_MONO = "'IBM Plex Mono', ui-monospace, monospace";

/**
 * As cores que o editor oferece e o que o Grafana salvou como nome.
 *
 * Elementos antigos guardam nomes da paleta do Grafana (`red`, `orange`...). Os
 * cinco nomes que tem par direto no mockup resolvem para o token dele; o resto
 * (as variacoes `semi-dark-*`, `light-*`...) segue no `getColorByName` do tema.
 * Assim um elemento salvo antes da v1.4 adota a cor nova sem ninguem editar.
 */
const NAMED: Record<string, TfToken> = {
  red: 'cr',
  'dark-red': 'cr',
  orange: 'la',
  'dark-orange': 'la',
  yellow: 'at',
  'dark-yellow': 'at',
  blue: 'in',
  'dark-blue': 'in',
  green: 'ok',
  'dark-green': 'ok',
  purple: 'ac',
  'dark-purple': 'ac',
  gray: 'apa',
  grey: 'apa',
};

export function resolveTfColor(name: string, theme: GrafanaTheme2): string {
  const token = NAMED[name.trim().toLowerCase()];
  return token ? tfPalette(theme)[token] : theme.visualization.getColorByName(name);
}
