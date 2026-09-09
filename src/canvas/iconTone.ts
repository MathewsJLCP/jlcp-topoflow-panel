import { GrafanaTheme2, colorManipulator } from '@grafana/data';

import { ElementColor, accentColor } from '../data/elementColor';
import { IconTone } from '../icons';

/**
 * Qual variante de um icone de figura desenhar.
 *
 * Vive no canvas, e nao em `src/icons`, de proposito: a biblioteca e um
 * catalogo e nao deve conhecer a cadeia de cor. Aqui e onde as duas se
 * encontram — e onde a traducao fica visivel em um lugar so, em vez de
 * espalhada por cada elemento que desenha icone.
 */

/** O que o usuario escolheu no campo "Cor do ícone". */
export type IconToneChoice = 'state' | IconTone;

/**
 * Cor do estado -> tom, por **matiz**.
 *
 * Escolher pela matiz, e nao pela severidade da trigger, e o que faz a regra
 * valer nos dois modos: a cor ja chega resolvida pela cadeia — trigger, regra
 * propria de severidade ou threshold de metrica —, entao o icone acompanha
 * **exatamente a cor que a regra pintou**, sem que esta funcao precise saber de
 * onde ela veio. Uma severidade que o usuario deixou laranja produz icone
 * laranja; se ele trocar aquela linha para verde, o icone vira verde junto.
 *
 * As faixas cobrem a paleta que o Grafana oferece no editor de regras, e cada
 * cor nomeada cai no seu tom homonimo. Fora dela:
 *
 *   - **roxo e violeta** vao para azul, que e o vizinho cromatico;
 *   - **magenta e rosa** vao para vermelho, pelo mesmo motivo;
 *   - **cor dessaturada** vai para cinza — sem matiz nao ha o que classificar, e
 *     qualquer faixa seria sorte.
 */
export function toneForColor(color: string, theme: GrafanaTheme2): IconTone {
  const { hue, saturation } = hsl(color, theme);

  if (saturation < 0.15) {
    return 'gray';
  }

  if (hue >= 345 || hue < 15) {
    return 'red';
  }
  if (hue < 45) {
    return 'orange';
  }
  if (hue < 70) {
    return 'yellow';
  }
  if (hue < 170) {
    return 'green';
  }
  if (hue < 310) {
    return 'blue';
  }

  return 'red';
}

/**
 * O tom de um elemento: a escolha do usuario, ou o estado quando ele deixou em
 * automatico.
 *
 * Sem estado — `neutral` e `nodata` — o resultado e `gray`. E o mesmo criterio
 * do resto do painel: ausencia de dado nao pode passar por saudavel, e um icone
 * colorido "por padrao" seria exatamente isso.
 */
export function iconTone(accent: ElementColor, choice: IconToneChoice | undefined, theme: GrafanaTheme2): IconTone {
  if (choice && choice !== 'state') {
    return choice;
  }

  const color = accentColor(accent);
  return color ? toneForColor(color, theme) : 'gray';
}

/** Matiz (0..360) e saturacao (0..1) de uma cor do tema, hex ou nome. */
function hsl(color: string, theme: GrafanaTheme2): { hue: number; saturation: number } {
  const resolved = theme.visualization.getColorByName(color);
  const [r, g, b] = colorManipulator.decomposeColor(resolved).values.map((value: number) => value / 255);

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  if (delta === 0) {
    return { hue: 0, saturation: 0 };
  }

  const hue =
    max === r ? 60 * (((g - b) / delta + 6) % 6) : max === g ? 60 * ((b - r) / delta + 2) : 60 * ((r - g) / delta + 4);

  // Saturacao HSV, e nao HSL: e a que responde "quanta cor ha aqui" sem que um
  // vermelho escuro (dark-red, a severidade Disaster) despenque para perto de
  // zero e seja tratado como cinza.
  return { hue, saturation: max === 0 ? 0 : delta / max };
}
