import { ElementThresholds } from '../model/types';
import { hasOwnThresholds, resolveOwnThreshold, sortStepsDesc } from './thresholds';

const REGRAS: ElementThresholds = {
  steps: [
    { value: 90, color: 'red', label: 'crítico' },
    { value: 70, color: 'orange' },
  ],
};

describe('hasOwnThresholds', () => {
  it('distingue regra própria de ausência de regra', () => {
    expect(hasOwnThresholds(REGRAS)).toBe(true);
    expect(hasOwnThresholds({ steps: [] })).toBe(false);
    expect(hasOwnThresholds(undefined)).toBe(false);
  });
});

describe('resolveOwnThreshold', () => {
  it('devolve o step de maior valor que o dado alcança', () => {
    expect(resolveOwnThreshold(REGRAS, 95)?.color).toBe('red');
    expect(resolveOwnThreshold(REGRAS, 75)?.color).toBe('orange');
  });

  it('o piso do step é inclusivo', () => {
    expect(resolveOwnThreshold(REGRAS, 90)?.color).toBe('red');
    expect(resolveOwnThreshold(REGRAS, 70)?.color).toBe('orange');
    expect(resolveOwnThreshold(REGRAS, 69.9)).toBeUndefined();
  });

  /**
   * O ponto de não usar `getActiveThreshold`: lá o step base em `-Infinity`
   * sempre casa, e um valor abaixo de todas as regras sairia colorido. Verde
   * por omissão é mentira operacional num NOC.
   */
  it('abaixo de todas as regras não há estado', () => {
    expect(resolveOwnThreshold(REGRAS, 10)).toBeUndefined();
    expect(resolveOwnThreshold(REGRAS, 0)).toBeUndefined();
    expect(resolveOwnThreshold(REGRAS, -5)).toBeUndefined();
  });

  it('não depende da ordem em que os steps foram salvos', () => {
    const invertido: ElementThresholds = { steps: [...REGRAS.steps].reverse() };

    expect(resolveOwnThreshold(invertido, 95)?.color).toBe('red');
    expect(resolveOwnThreshold(invertido, 75)?.color).toBe('orange');
  });

  it('sem regra, ou com valor que não é número utilizável', () => {
    expect(resolveOwnThreshold(undefined, 95)).toBeUndefined();
    expect(resolveOwnThreshold({ steps: [] }, 95)).toBeUndefined();
    expect(resolveOwnThreshold(REGRAS, '95')).toBeUndefined();
    expect(resolveOwnThreshold(REGRAS, null)).toBeUndefined();
    expect(resolveOwnThreshold(REGRAS, NaN)).toBeUndefined();
    expect(resolveOwnThreshold(REGRAS, Infinity)).toBeUndefined();
  });

  it('aceita regra sobre valores negativos', () => {
    const frio: ElementThresholds = { steps: [{ value: -10, color: 'blue' }] };

    expect(resolveOwnThreshold(frio, -5)?.color).toBe('blue');
    expect(resolveOwnThreshold(frio, -20)).toBeUndefined();
  });
});

describe('sortStepsDesc', () => {
  it('ordena do maior para o menor sem mutar a entrada', () => {
    const entrada = [{ value: 1, color: 'a' }, { value: 9, color: 'b' }, { value: 5, color: 'c' }];
    const saida = sortStepsDesc(entrada);

    expect(saida.map((step) => step.value)).toEqual([9, 5, 1]);
    expect(entrada.map((step) => step.value)).toEqual([1, 9, 5]);
  });
});
