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
  problemSince,
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
 * As triggers escolhidas no vinculo, sem branco e sem repeticao.
 *
 * **Lista vazia significa "qualquer trigger do host"** — nao "nenhuma". E por
 * isso que o filtro de nome e condicional la embaixo, em vez de delegado ao
 * `matchesName`, que trata string vazia como "nao casa com nada".
 *
 * O branco cai fora aqui: uma linha ainda nao preenchida no editor abrangeria
 * todo o host, e um rascunho nao pode alargar em silencio o que o elemento
 * observa. Exportada para o editor mostrar exatamente as linhas que valem.
 */
export function triggerNames(binding: Pick<TriggerBinding, 'names'>): string[] {
  return [...new Set((binding.names ?? []).map((name) => name.trim()).filter(Boolean))];
}

/**
 * Problemas do frame que pertencem a este vinculo **e estao em PROBLEM**.
 *
 * Varias triggers no mesmo vinculo sao **OU**: basta uma em PROBLEM para o
 * elemento acender, e as que estiverem alarmando juntas entram todas na lista e
 * no contador — a severidade que pinta o elemento e a maior delas.
 */
function matchingProblems(
  binding: TriggerBinding,
  frames: DataFrame[],
  accepts: SeverityFilter | undefined
): ZabbixProblem[] {
  const names = triggerNames(binding);

  return extractProblems(frames).filter(
    (problem) =>
      matchesHost(problem, binding.host) &&
      (names.length === 0 || names.some((name) => matchesName(problem, name))) &&
      isActiveProblem(problem) &&
      (!accepts || accepts(problemSeverity(problem)))
  );
}

/**
 * Quais severidades o elemento atende. `undefined` significa todas.
 *
 * Entra aqui, e nao depois na cadeia de cor, porque o descarte precisa acontecer
 * **antes** da severidade maxima: filtrar so a cor deixaria um alarme desligado
 * contando no badge e aparecendo na lista, com o card na cor Base — dois lugares
 * contando historias diferentes sobre o mesmo elemento.
 */
export type SeverityFilter = (severity: Severity) => boolean;

/** Descricao vazia: o frame traz o problema, mas nada para nomea-lo. */
export const UNNAMED_TRIGGER = 'Trigger sem descricao';

/**
 * Uma trigger em PROBLEM, ja pronta para ser exibida.
 *
 * Existe porque a severidade maxima sozinha nao responde a pergunta do
 * operador: um elemento vermelho com `DISASTER` diz que algo caiu, nao **o
 * que** caiu. O dado sempre esteve no frame — era `resolveTriggerState` que o
 * reduzia a um numero e jogava o resto fora.
 *
 * Guarda `color` e `label` ja resolvidos, e nao so a severidade, pelo mesmo
 * motivo que `TriggerAccent`: quem desenha a lista nao deveria precisar do
 * tema nem do mapa de severidade para pintar seis bolinhas.
 */
export interface ActiveProblem {
  /** Descricao da trigger. Nunca vazia — ver `UNNAMED_TRIGGER`. */
  name: string;
  severity: Severity;
  /** Nome da severidade (`High`, `Disaster`...). */
  label: string;
  color: string;
  /** Segundos unix da ultima mudanca de estado, quando o frame o informa. */
  since?: number;
}

/**
 * Ordem de leitura: mais grave primeiro, depois alfabetica.
 *
 * O desempate por nome e deliberadamente **estatico**. Ordenar por horario
 * dentro da severidade seria mais informativo por um instante e pior no uso: a
 * lista se reorganizaria a cada refresh do painel, debaixo do olho de quem esta
 * lendo. Com o nome, uma trigger so muda de lugar quando abre ou fecha.
 */
function toActiveProblems(problems: ZabbixProblem[], theme: GrafanaTheme2): ActiveProblem[] {
  return problems
    .map((problem) => {
      const severity = problemSeverity(problem);

      return {
        name: problem.name?.trim() || UNNAMED_TRIGGER,
        severity,
        label: SEVERITY_LABEL[severity],
        color: severityColor(severity, theme),
        since: problemSince(problem),
      };
    })
    .sort((a, b) => b.severity - a.severity || a.name.localeCompare(b.name));
}

export interface TriggerAccent {
  color: string;
  severity: Severity;
  /** Nome da severidade (`High`, `Disaster`...). O badge o exibe em caixa alta. */
  label: string;
  /**
   * Todas as triggers em PROBLEM deste vinculo, da mais grave para a mais
   * branda. Nunca vazia — sem problema nenhum nao ha acento.
   *
   * A cor e a severidade acima continuam sendo as do **pior** caso (decisao
   * D4): a lista informa, ela nao arbitra. Um elemento com um Disaster e tres
   * Warnings tem de continuar vermelho.
   */
  problems: ActiveProblem[];
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
 *   4. host correspondente, mas sem nenhuma trigger em PROBLEM (o caso saudavel);
 *   5. so ha alarmes de severidade que o elemento desligou.
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
  theme: GrafanaTheme2,
  accepts?: SeverityFilter
): TriggerAccent | undefined {
  if (!binding?.enabled) {
    return undefined;
  }

  const matched = matchingProblems(binding, frames, accepts);
  if (matched.length === 0) {
    return undefined;
  }

  // Ja ordenada da mais grave para a mais branda, entao a primeira linha e o
  // pior caso — nao ha um segundo criterio de "maximo" que possa divergir dela.
  const problems = toActiveProblems(matched, theme);
  const { severity, label, color } = problems[0];

  return { color, severity, label, problems };
}
