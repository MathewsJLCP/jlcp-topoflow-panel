import { DataFrame, GrafanaTheme2 } from '@grafana/data';

import { TriggerBinding } from '../model/types';
import {
  SEVERITY_COLOR,
  SEVERITY_LABEL,
  Severity,
  ZabbixProblem,
  extractProblems,
  isActiveProblem,
  matchesHost,
  matchesName,
  problemSeverity,
} from './problems';

/**
 * Estado de um elemento vinculado a uma trigger do Zabbix.
 *
 * Fica separado de `./elementColor.ts` pelo mesmo motivo que `./problems.ts`
 * fica separado daqui: um modulo le o frame, este decide o estado, e
 * `elementColor` so arbitra a precedencia entre as fontes de cor.
 */

/**
 * Severidade -> cor resolvida do tema.
 *
 * Passa por `getColorByName` (nomes, nunca hex) — a mesma via do acento fixo no
 * nivel 2 da cadeia, entao severidade e acento saem da mesma paleta e o tema
 * continua no controle em dark e light.
 *
 * *Not classified* e o unico caso fora dessa via: `SEVERITY_COLOR[0]` e
 * `undefined` porque o neutro certo e `text.secondary`, que nao e nome de cor
 * do Grafana. O nome que existiria, `'text'`, resolve para `text.primary` —
 * quase branco no dark, o bug que a cadeia de cor existiu para matar.
 */
export function severityColor(severity: Severity, theme: GrafanaTheme2): string {
  const name = SEVERITY_COLOR[severity];
  return name ? theme.visualization.getColorByName(name) : theme.colors.text.secondary;
}

/**
 * Problemas do frame que pertencem a este vinculo **e estao em PROBLEM**.
 *
 * `name` vazio (ou so espaco) significa "qualquer trigger do host" — por isso o
 * filtro de nome e condicional em vez de delegado ao `matchesName`, que trata
 * string vazia como "nao casa com nada".
 */
function matchingProblems(binding: TriggerBinding, frames: DataFrame[]): ZabbixProblem[] {
  const name = binding.name?.trim();

  return extractProblems(frames).filter(
    (problem) =>
      matchesHost(problem, binding.host) && (!name || matchesName(problem, name)) && isActiveProblem(problem)
  );
}

/** Severidade maxima entre os problemas correspondentes (decisao D4). */
function maxSeverity(problems: ZabbixProblem[]): Severity {
  return problems.reduce<Severity>(
    (max, problem) => (problemSeverity(problem) > max ? problemSeverity(problem) : max),
    0
  );
}

export interface TriggerAccent {
  color: string;
  severity: Severity;
  /** Nome da severidade (`High`, `Disaster`...). O badge o exibe em caixa alta. */
  label: string;
}

/**
 * Acento de uma trigger alarmando, ou `undefined` quando o elemento nao esta em
 * estado de problema.
 *
 * `undefined` cobre **quatro** situacoes de proposito, porque todas levam ao
 * mesmo lugar — o elemento segue a cadeia de cor normal e mostra sua identidade:
 *
 *   1. vinculo desligado;
 *   2. nenhuma query de Problems no painel;
 *   3. host sem correspondencia nos frames;
 *   4. host correspondente, mas sem nenhuma trigger em PROBLEM (o caso saudavel).
 *
 * (2) e (3) sao ambiguos por natureza: com `showProblems: problems`, um host
 * saudavel e um host digitado errado produzem exatamente o mesmo frame — nenhuma
 * linha. Nao da para distingui-los no canvas sem inventar estado, entao o aviso
 * vive no editor, onde o usuario pode agir sobre ele (criterios 6 e 7). Aqui
 * eles caem no caso saudavel, que e a leitura correta na maioria esmagadora das
 * vezes.
 */
export function resolveTriggerState(
  binding: TriggerBinding | undefined,
  frames: DataFrame[],
  theme: GrafanaTheme2
): TriggerAccent | undefined {
  if (!binding?.enabled) {
    return undefined;
  }

  const problems = matchingProblems(binding, frames);
  if (problems.length === 0) {
    return undefined;
  }

  const severity = maxSeverity(problems);

  return { color: severityColor(severity, theme), severity, label: SEVERITY_LABEL[severity] };
}
