import { ElementThresholdStep, ElementThresholds } from '../model/types';

/**
 * Avaliacao dos thresholds proprios do elemento (decisao D8).
 *
 * Nao usa `getActiveThreshold` do `@grafana/data` de proposito: aquela funcao
 * assume o step base em `-Infinity` e sempre devolve **algum** step, o que
 * significa que um valor abaixo de todas as regras ainda sai colorido. E de
 * onde vinha o "verde por omissao" que a cadeia de cor existe para evitar.
 * Aqui, abaixo de tudo devolve `undefined` e o elemento segue para a sua cor de
 * identidade.
 */

/** True quando o usuario definiu ao menos uma regra propria. */
export function hasOwnThresholds(thresholds: ElementThresholds | undefined): boolean {
  return (thresholds?.steps.length ?? 0) > 0;
}

/**
 * Step ativo: o de maior `value` que ainda seja <= ao valor medido.
 *
 * `undefined` quando nao ha regra, quando o valor nao e numero utilizavel, ou
 * quando ele esta abaixo de todos os steps — os tres casos em que o elemento
 * nao tem estado a exibir.
 */
export function resolveOwnThreshold(
  thresholds: ElementThresholds | undefined,
  value: unknown
): ElementThresholdStep | undefined {
  if (!hasOwnThresholds(thresholds) || typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }

  let active: ElementThresholdStep | undefined;
  for (const step of thresholds!.steps) {
    if (value >= step.value && (active === undefined || step.value > active.value)) {
      active = step;
    }
  }

  return active;
}

/** Maior primeiro — a ordem em que as regras sao lidas e editadas. */
export function sortStepsDesc(steps: ElementThresholdStep[]): ElementThresholdStep[] {
  return [...steps].sort((a, b) => b.value - a.value);
}
