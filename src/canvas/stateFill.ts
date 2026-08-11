import { GrafanaTheme2, colorManipulator } from '@grafana/data';

import { ElementColor, accentColor } from '../data/elementColor';

/**
 * Superficie de estado de um elemento: o fundo e a cor de texto que o acompanha.
 *
 * As duas andam juntas de proposito. Escolher o fundo sem escolher o texto foi o
 * que tornou a regra anterior (A.2) necessaria: com o card preenchido e o texto
 * preso a `text.primary`, um no amarelo ficava com texto quase branco sobre
 * fundo claro — ilegivel. Quem pinta o fundo tem que responder pelo contraste no
 * mesmo lugar.
 */
export interface StateFill {
  /** A propria cor do estado, sem diluicao. */
  background: string;
  /** Cor de texto que o tema garante legivel sobre `background`. */
  text: string;
}

/**
 * Limiares que forcam cada um dos dois candidatos de `getContrastText`.
 *
 * A funcao devolve o texto claro quando o contraste dele contra o fundo alcanca
 * o limiar, e o escuro caso contrario. Como nenhuma razao de contraste e menor
 * que 1 nem maior que 21, `1` sempre entrega o claro e `22` sempre o escuro —
 * e o jeito de obter os dois tokens de texto do tema sem escrever `#fff` e
 * `#000` aqui, o que a regra 1 do doc de estilo proibe.
 */
const SEMPRE = 1;
const NUNCA = 22;

/** WCAG AA para corpo de texto. O `body` do no e 14px e o secundario, 12px. */
const AA_NORMAL = 4.5;

/**
 * Preenchimento do elemento a partir do estado resolvido.
 *
 * `undefined` para `nodata` e `neutral`: nao sao cor clara nem escura, sao
 * **ausencia de estado**, e o elemento continua com o fundo neutro do tema. E o
 * que preserva A.4 — um painel mudo precisa continuar visivelmente distinto de
 * um painel saudavel, e preenche-lo com qualquer cor apagaria a diferenca.
 *
 * ## Por que nao basta `theme.colors.getContrastText(background)`
 *
 * O helper do tema usa `contrastThreshold`, que vale **3** — o criterio de WCAG
 * AA para *texto grande* (24px, ou 18.66px em negrito). O texto do no e 14px e
 * 12px, entao o criterio aplicavel e 4.5.
 *
 * A diferenca nao e academica: sobre o `red` da paleta do Grafana (`#F2495C`) o
 * helper escolhe branco, que da **3.57** — reprovado —, quando o preto no mesmo
 * fundo da 5.88. Sobre `blue` sao 3.03 contra 6.92. Sao justamente as duas cores
 * mais frequentes num NOC: o vermelho de severidade alta e o azul de mapeamento.
 *
 * Entao aqui os dois candidatos sao medidos e vence o de maior contraste, em vez
 * de aceitar o primeiro que passe de 3. Nas cores que o produto alcanca — o mapa
 * de severidade e a paleta do editor de regras — isso leva **todas** acima de
 * 4.5 nos dois temas; `stateFill.test.ts` e a prova.
 *
 * A alternativa seria escurecer o fundo ate o branco alcancar 4.5, mas ai a cor
 * do card deixaria de ser a cor que o usuario escolheu e que o badge e o swatch
 * do editor mostram. Preferir o texto escuro mantem a cor de estado intacta.
 */
export function stateFill(accent: ElementColor, theme: GrafanaTheme2): StateFill | undefined {
  const background = accentColor(accent);
  if (!background) {
    return undefined;
  }

  const claro = theme.colors.getContrastText(background, SEMPRE);
  const escuro = theme.colors.getContrastText(background, NUNCA);

  return {
    background,
    text: contrast(claro, background, theme) >= contrast(escuro, background, theme) ? claro : escuro,
  };
}

function contrast(text: string, background: string, theme: GrafanaTheme2): number {
  return colorManipulator.getContrastRatio(text, background, theme.colors.background.primary);
}

/**
 * Exposto para o teste de contraste, que precisa do mesmo criterio que o fill
 * usa — repetir o numero la deixaria os dois livres para divergir.
 */
export { AA_NORMAL, contrast };
