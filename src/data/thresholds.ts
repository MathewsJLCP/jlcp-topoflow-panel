import { ElementRule, ElementThresholds, SpecialMatch } from '../model/types';

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

/** True quando o usuario definiu ao menos uma regra propria. */
export function hasOwnThresholds(thresholds: ElementThresholds | undefined): boolean {
  return (thresholds?.steps.length ?? 0) > 0;
}

const isThreshold = (rule: ElementRule): rule is Extract<ElementRule, { type: 'threshold' }> =>
  rule.type === 'threshold';

/**
 * Ordem de leitura e de avaliacao, na mesma lista:
 *
 *   1. mapeamentos (valor, faixa, regex, especial), na ordem em que o usuario
 *      os criou — o primeiro que casar vence;
 *   2. thresholds, do maior para o menor.
 *
 * E a mesma precedencia do Grafana, onde value mappings sao aplicados antes dos
 * thresholds. Mantê-la visivel na propria ordem da lista evita a pergunta "qual
 * ganha?", que no core so se responde lendo a documentacao.
 */
export function sortRules(rules: ElementRule[]): ElementRule[] {
  const mappings = rules.filter((rule) => !isThreshold(rule));
  const thresholds = rules.filter(isThreshold).sort((a, b) => b.value - a.value);

  return [...mappings, ...thresholds];
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
  if (!hasOwnThresholds(thresholds)) {
    return undefined;
  }

  return sortRules(thresholds!.steps).find((rule) => matchesRule(rule, value));
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
