/**
 * Constantes visuais do canvas (docs/estilo-elementos-canvas.md §1).
 *
 * Só o que NAO cabe em `theme.colors.*` entra aqui: dimensoes de detalhe,
 * duracao de transicao e o helper de opacidade. Cor literal nunca — a regra 1
 * do relatorio vale para este arquivo tambem.
 */

export const ICON_BOX_SIZE = 32;

/**
 * O `Icon` do `@grafana/ui` so aceita a escala nomeada (`lg` = 18, `xl` = 24) e
 * o relatorio pede 20, entao a capsula forca o tamanho no `svg` filho.
 */
export const ICON_SIZE = 20;

export const HANDLE_SIZE = 8;

/**
 * Anel de selecao: **2px de `primary.main` em volta do elemento**, e o mesmo em
 * todo tipo que tenha superficie (point, postit, texto).
 *
 * O no fica de fora porque ja tem borda propria para recolorir: `border` de 1px
 * em `primary.main` mais o anel de 1px somam a mesma espessura, e empilhar o
 * anel de 2px por cima daria 3px de azul so nele. A aresta tambem: um anel em
 * volta de uma linha nao existe — la o sinal e o traco em `primary.main` mais o
 * glow, que ja e inequivoco.
 *
 * O que unifica os cinco tipos e a **leitura** (2px de azul de selecao), nao a
 * propriedade CSS. Registrado em `docs/estilo-elementos-canvas.md` §7.
 */
export const SELECTION_RING_WIDTH = 2;

export function selectionRing(color: string): string {
  return `0 0 0 ${SELECTION_RING_WIDTH}px ${color}`;
}

/** Unica duracao de transicao da cena (regra 3 do relatorio). */
export const TRANSITION_FAST = '150ms ease';

/**
 * A cor de acento entra como custom property para que `:hover` e
 * `[data-selected]` possam derivar opacidades dela em CSS estatico. Sem isso
 * cada nivel de halo teria de ser calculado em JS e aplicado inline, o que
 * impede o seletor de pseudo-classe.
 */
export const ACCENT_VAR = '--topo-accent';
export const accentVar = `var(${ACCENT_VAR})`;

/**
 * As cores do tema chegam como hex ou rgb; `color-mix` resolve os dois sem
 * precisar de um parser proprio, e e suportado por todos os navegadores que o
 * Grafana 13 suporta. Aceita tambem `var(--topo-accent)`.
 */
export function alpha(color: string, amount: number): string {
  return `color-mix(in srgb, ${color} ${Math.round(amount * 100)}%, transparent)`;
}
