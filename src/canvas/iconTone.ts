import { GrafanaTheme2 } from '@grafana/data';

import { ElementColor, accentColor } from '../data/elementColor';
import { IconTone } from '../icons';
import { TfToken, tfPalette } from '../theme/palette';

/**
 * A cor com que o icone de um elemento e pintado.
 *
 * No mockup o icone **sempre** acompanha o estado: verde na Base, vermelho no
 * alarme, o azul padrao do desenho quando nao ha estado (neutro, sem dado).
 * `choice` e o `iconTone` salvo antes da v1.4 — o editor nao oferece mais a
 * escolha, mas quem fixou um icone cinza continua vendo cinza.
 */
export type IconToneChoice = 'state' | IconTone;

const TONE_TOKEN: Record<IconTone, TfToken> = {
  gray: 'apa',
  blue: 'in',
  green: 'ok',
  yellow: 'at',
  orange: 'la',
  red: 'cr',
};

export function iconColor(
  accent: ElementColor,
  choice: IconToneChoice | undefined,
  theme: GrafanaTheme2
): string | undefined {
  if (choice && choice !== 'state') {
    return tfPalette(theme)[TONE_TOKEN[choice]];
  }

  return accentColor(accent);
}
