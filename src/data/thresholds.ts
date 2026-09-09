import { AlertAnimation, ElementAlert, ElementRule, ElementThresholds, Severity, SpecialMatch } from '../model/types';
import { SEVERITY_COLOR } from './problems';

/**
 * Avaliacao das regras de estado do elemento (decisoes D8 e a fusao do Bloco
 * 4a.1: Thresholds e Value mappings num bloco so).
 *
 * Nao usa `getActiveThreshold` do `@grafana/data` de proposito: aquela funcao
 * assume o step base em `-Infinity` e sempre devolve **algum** step, o que
 * significa que um valor abaixo de todas as regras ainda sai colorido. E de
 * onde vinha o "verde por omissao" que a cadeia de cor existe para evitar.
 * Aqui, abaixo de tudo devolve `undefined` e o elemento segue para a sua cor de
 * repouso.
 */

const isThreshold = (rule: ElementRule): rule is Extract<ElementRule, { type: 'threshold' }> =>
  rule.type === 'threshold';

const isSeverity = (rule: ElementRule): rule is SeverityRule => rule.type === 'severity';

type SeverityRule = Extract<ElementRule, { type: 'severity' }>;

/** Tudo que nao e severidade: as regras avaliadas contra o valor de um field. */
export type MetricRule = Exclude<ElementRule, { type: 'severity' }>;

/**
 * A lista guarda regras de **dois eixos** que nunca competem.
 *
 * As de metrica sao avaliadas contra o valor de um field; a de severidade,
 * contra a severidade de um alarme de trigger. As duas convivem no mesmo array
 * porque alternar Metrica <-> Trigger no editor jamais descartou configuracao —
 * e a resolucao consulta so o eixo que esta valendo naquele momento.
 *
 * Sem essa separacao, uma regra `>= 90` casaria com uma severidade 5 e um
 * elemento em Disaster sairia pintado por uma regra de CPU.
 */
export function metricRules(thresholds: ElementThresholds | undefined): MetricRule[] {
  return (thresholds?.steps ?? []).filter((rule): rule is MetricRule => !isSeverity(rule));
}

export function severityRules(thresholds: ElementThresholds | undefined): SeverityRule[] {
  return (thresholds?.steps ?? []).filter(isSeverity);
}

/**
 * True quando o usuario definiu ao menos uma regra **de metrica**.
 *
 * Conta so o eixo de metrica de proposito: e este booleano que decide se o
 * elemento tem estado por metrica. Contando tambem as de severidade, um
 * elemento que so configurou cores de trigger nasceria com "regra de metrica"
 * ao voltar para o modo Metrica — e a primeira regra de severidade acabaria
 * decidindo o que acontece num eixo onde ela nao e avaliada.
 */
export function hasOwnThresholds(thresholds: ElementThresholds | undefined): boolean {
  return metricRules(thresholds).length > 0;
}

/**
 * Ordem de leitura e de avaliacao, dentro de cada eixo:
 *
 *   1. mapeamentos (valor, faixa, regex, especial), na ordem em que o usuario
 *      os criou — o primeiro que casar vence;
 *   2. thresholds, do maior para o menor;
 *   3. severidades, da mais grave para a mais branda.
 *
 * Nos dois primeiros e a mesma precedencia do Grafana, onde value mappings sao
 * aplicados antes dos thresholds. Mantê-la visivel na propria ordem da lista
 * evita a pergunta "qual ganha?", que no core so se responde lendo a
 * documentacao.
 */
export function sortRules(rules: ElementRule[]): ElementRule[] {
  const mappings = rules.filter((rule) => !isThreshold(rule) && !isSeverity(rule));
  const thresholds = rules.filter(isThreshold).sort((a, b) => b.value - a.value);
  const severities = rules.filter(isSeverity).sort((a, b) => b.atLeast - a.atLeast);

  return [...mappings, ...thresholds, ...severities];
}

function matchesSpecial(match: SpecialMatch, value: unknown): boolean {
  const isNull = value === null || value === undefined;
  const isNan = typeof value === 'number' && Number.isNaN(value);

  switch (match) {
    case 'null':
      return isNull;
    case 'nan':
      return isNan;
    case 'null+nan':
      return isNull || isNan;
    case 'true':
      return value === true || value === 'true' || value === 1;
    case 'false':
      return value === false || value === 'false' || value === 0;
    case 'empty':
      return value === '';
  }
}

function matchesRule(rule: ElementRule, value: unknown): boolean {
  switch (rule.type) {
    case 'threshold':
      return typeof value === 'number' && Number.isFinite(value) && value >= rule.value;

    case 'value':
      // Comparacao como texto, igual ao core: o campo aceita `200`, `OK` ou
      // qualquer coisa, e o valor medido nem sempre e numero.
      return value !== null && value !== undefined && String(value) === rule.match.trim();

    case 'range':
      return typeof value === 'number' && Number.isFinite(value) && value >= rule.from && value <= rule.to;

    case 'regex':
      return matchesRegex(rule.pattern, value);

    case 'special':
      return matchesSpecial(rule.match, value);

    // Nao pertence a este eixo. `resolveOwnThreshold` ja filtra as regras de
    // severidade antes de chegar aqui; o caso existe para o compilador cobrar
    // uma decisao explicita quando a uniao ganhar mais um tipo.
    case 'severity':
      return false;
  }
}

/**
 * Regex invalida nao casa e nao explode: o campo e editado caractere a
 * caractere, e `new RegExp('[')` no meio da digitacao derrubaria o painel.
 */
function matchesRegex(pattern: string, value: unknown): boolean {
  if (!pattern || value === null || value === undefined) {
    return false;
  }

  try {
    return new RegExp(pattern).test(String(value));
  } catch {
    return false;
  }
}

/**
 * Regra ativa: o primeiro mapeamento que casar ou, na falta deles, o threshold
 * de maior piso que o valor alcance.
 *
 * `undefined` quando nao ha regra ou nada casa — os casos em que o elemento
 * nao tem estado a exibir e segue para a cor de repouso.
 */
export function resolveOwnThreshold(
  thresholds: ElementThresholds | undefined,
  value: unknown
): ElementRule | undefined {
  return sortRules(metricRules(thresholds)).find((rule) => matchesRule(rule, value));
}

/**
 * Cor propria para um alarme de trigger: a regra de maior severidade que o
 * alarme alcance.
 *
 * `undefined` quando nao ha regra de severidade ou quando o alarme e mais brando
 * que todas — e ai o alarme volta a ser pintado pelo mapa de severidade do
 * Zabbix, que e o comportamento de quem nunca configurou nada.
 *
 * A comparacao e "a partir de", igual a do threshold: uma unica regra em *Not
 * classified* pinta qualquer alarme, que e como se obtem a cor unica sem
 * precisar de um modo separado no editor.
 */
export function resolveSeverityRule(
  thresholds: ElementThresholds | undefined,
  severity: Severity
): SeverityRule | undefined {
  return sortRules(severityRules(thresholds))
    .filter(isSeverity)
    .find((rule) => severity >= rule.atLeast);
}

/**
 * A escada de severidades, da mais grave para a mais branda.
 *
 * A ordem e a mesma da tela e a mesma da avaliacao (`sortRules`), e nao por
 * coincidencia: e a unica ordem em que a lista se le como "quem ganha primeiro".
 */
export const SEVERITY_LADDER: Severity[] = [5, 4, 3, 2, 1, 0];

export interface SeverityLadderRow {
  severity: Severity;
  /**
   * Cor que aquele nivel exibe hoje — de uma regra propria ou, na falta dela, do
   * mapa do Zabbix. `undefined` so acontece em *Not classified*, cujo padrao e
   * `text.secondary`: um token do tema, e nao um nome de cor do Grafana, entao
   * quem tem o tema em maos e que o traduz (ver `SEVERITY_COLOR`).
   */
  color?: string;
  animation?: AlertAnimation;
  /**
   * Nao ha mais campo para edita-lo — o badge mostra o nome da severidade —, mas
   * o que ja foi salvo continua valendo e viaja junto nas reescritas.
   */
  label?: string;
  /** Ligada, o nivel acende o elemento; desligada, ele fica na Base. */
  enabled: boolean;
}

/**
 * O que cada severidade exibe hoje, nivel a nivel.
 *
 * Passa por `resolveSeverityRule` em vez de procurar a regra de `atLeast` exato
 * porque a lista pode ter vindo do editor antigo, onde uma regra so — `a partir
 * de High` — pintava High **e** Disaster. A escada precisa mostrar a cor que o
 * elemento realmente teria em cada nivel, e nao so as linhas que existem no
 * JSON; senao configuracao salva apareceria como "sem cor" na tela nova.
 *
 * `alert` e o campo aposentado do elemento (ver `elementAlertSchema`). Pelo mesmo
 * motivo ele entra aqui: um elemento salvo com "Pulsar a partir de High" tem de
 * aparecer como *Pulsar* nas linhas High e Disaster, e nao como escada parada —
 * a animacao esta configurada, so nao mais naquele lugar.
 */
export function severityLadder(thresholds: ElementThresholds | undefined, alert?: ElementAlert): SeverityLadderRow[] {
  return SEVERITY_LADDER.map((severity) => {
    const rule = resolveSeverityRule(thresholds, severity);
    const legacy = alert && severity >= alert.fromSeverity ? alert.animation : undefined;

    return {
      severity,
      color: rule?.color ?? SEVERITY_COLOR[severity],
      animation: rule?.animation ?? legacy,
      label: rule?.label,
      // Ausente e ligada: e o que faz toda escada ja salva continuar acendendo.
      enabled: rule?.enabled !== false,
    };
  });
}

/**
 * Edita **um** nivel da escada e devolve a escada inteira como regras.
 *
 * Materializar os seis niveis a cada escrita nao e desperdicio, e o que da a
 * escada a semantica que ela aparenta ter. As regras sao "a partir de", e uma
 * lista esparsa mente: com so `Average = roxo` salvo, um alarme *Disaster*
 * casaria com ela (5 >= 3) e sairia roxo, embora a linha *Disaster* na tela
 * mostrasse vermelho. Com os seis niveis presentes, o mais alto sempre casa
 * primeiro e cada linha passa a valer exatamente para a sua severidade.
 *
 * `fallback` e a cor a gravar quando o nivel editado ainda nao tem nenhuma — de
 * novo, so *Not classified*, e so quando o usuario mexe nele de proposito.
 * Nenhum outro nivel entra sem cor: sem regra, e o mapa do Zabbix que vale.
 */
export function writeSeverityLadder(
  thresholds: ElementThresholds | undefined,
  severity: Severity,
  changes: Partial<Omit<SeverityLadderRow, 'severity'>>,
  fallback: string,
  alert?: ElementAlert
): SeverityRule[] {
  return severityLadder(thresholds, alert)
    .map((row) =>
      row.severity === severity ? { ...row, ...changes, color: changes.color ?? row.color ?? fallback } : row
    )
    .filter((row): row is SeverityLadderRow & { color: string } => row.color !== undefined)
    .map(({ severity: atLeast, color, animation, label, enabled }) => ({
      type: 'severity',
      atLeast,
      color,
      ...(animation ? { animation } : {}),
      ...(label ? { label } : {}),
      // So grava o que foge do padrao: uma escada inteira com `enabled: true`
      // encheria o JSON do dashboard para dizer o que o silencio ja diz.
      ...(enabled ? {} : { enabled: false }),
    }));
}

/**
 * True quando ha regra capaz de casar com valor ausente ou NaN.
 *
 * A cadeia de cor precisa saber disto **antes** de decidir por `nodata`: um
 * elemento que configurou um mapeamento para nulo pediu explicitamente para
 * tratar a ausencia de dado, e o `nodata` generico passaria por cima disso.
 */
export function hasSpecialRule(thresholds: ElementThresholds | undefined): boolean {
  return (thresholds?.steps ?? []).some((rule) => rule.type === 'special');
}

/**
 * As severidades que o elemento **atende**.
 *
 * Consultada antes de a cor ser decidida, e nao depois: um alarme de severidade
 * desligada nao pode acender o elemento nem entrar na contagem, senao o card
 * ficaria na Base enquanto a lista embaixo dele anunciaria tres problemas — dois
 * lugares contando historias diferentes sobre o mesmo elemento.
 */
export function isSeverityEnabled(thresholds: ElementThresholds | undefined, severity: Severity): boolean {
  return resolveSeverityRule(thresholds, severity)?.enabled !== false;
}

/** True quando alguma severidade foi desligada — evita filtrar a toa. */
export function hasDisabledSeverity(thresholds: ElementThresholds | undefined): boolean {
  return severityRules(thresholds).some((rule) => rule.enabled === false);
}
