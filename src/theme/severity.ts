import { GrafanaTheme2 } from '@grafana/data';

import { Severity } from '../data/problems';
import { TfToken, tfPalette } from './palette';

/**
 * Severidade do Zabbix -> token do mockup.
 *
 * Disaster e High dividem o vermelho: o que separa o Disaster na tela nao e a
 * cor, e o tratamento — card mais saturado, borda mais grossa e `!!` no lugar
 * de `!` (ver `elementLook`).
 */
const TOKEN: Record<Severity, TfToken> = {
  5: 'cr',
  4: 'cr',
  3: 'la',
  2: 'at',
  1: 'in',
  0: 'apa',
};

/** Sigla da pilula de severidade nas listas de problemas. */
export const SEVERITY_SHORT: Record<Severity, string> = {
  5: 'DIS',
  4: 'HIGH',
  3: 'AVG',
  2: 'WARN',
  1: 'INFO',
  0: 'N/C',
};

export function severityTfColor(severity: Severity, theme: Pick<GrafanaTheme2, 'isDark'>): string {
  return tfPalette(theme)[TOKEN[severity]];
}

/** Texto sobre a cor cheia da severidade (`on-cr`, `on-in`...). */
export function severityOnColor(severity: Severity, theme: Pick<GrafanaTheme2, 'isDark'>): string {
  return tfPalette(theme)[`on-${TOKEN[severity]}` as TfToken];
}
