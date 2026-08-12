import { ElementRule, ElementThresholds, Severity } from '../model/types';
import {
  hasOwnThresholds,
  hasSpecialRule,
  metricRules,
  resolveOwnThreshold,
  resolveSeverityRule,
  severityRules,
  sortRules,
} from './thresholds';

const rules = (...steps: ElementRule[]): ElementThresholds => ({ steps });

const ESCALA = rules(
  { type: 'threshold', value: 90, color: 'red', label: 'crítico' },
  { type: 'threshold', value: 70, color: 'orange' }
);

describe('hasOwnThresholds', () => {
  it('distingue regra própria de ausência de regra', () => {
    expect(hasOwnThresholds(ESCALA)).toBe(true);
    expect(hasOwnThresholds(rules())).toBe(false);
    expect(hasOwnThresholds(undefined)).toBe(false);
  });
});

describe('resolveOwnThreshold — thresholds', () => {
  it('devolve o step de maior valor que o dado alcança', () => {
    expect(resolveOwnThreshold(ESCALA, 95)?.color).toBe('red');
    expect(resolveOwnThreshold(ESCALA, 75)?.color).toBe('orange');
  });

  it('o piso do step é inclusivo', () => {
    expect(resolveOwnThreshold(ESCALA, 90)?.color).toBe('red');
    expect(resolveOwnThreshold(ESCALA, 69.9)).toBeUndefined();
  });

  /**
   * O ponto de não usar `getActiveThreshold`: lá o step base em `-Infinity`
   * sempre casa, e um valor abaixo de todas as regras sairia colorido. Verde
   * por omissão é mentira operacional num NOC.
   */
  it('abaixo de todas as regras não há estado', () => {
    expect(resolveOwnThreshold(ESCALA, 10)).toBeUndefined();
    expect(resolveOwnThreshold(ESCALA, -5)).toBeUndefined();
  });

  it('não depende da ordem em que as regras foram salvas', () => {
    const invertido = rules(...[...ESCALA.steps].reverse());

    expect(resolveOwnThreshold(invertido, 95)?.color).toBe('red');
  });

  it('threshold não casa com valor que não é número finito', () => {
    expect(resolveOwnThreshold(ESCALA, '95')).toBeUndefined();
    expect(resolveOwnThreshold(ESCALA, null)).toBeUndefined();
    expect(resolveOwnThreshold(ESCALA, NaN)).toBeUndefined();
    expect(resolveOwnThreshold(ESCALA, Infinity)).toBeUndefined();
  });
});

describe('resolveOwnThreshold — mapeamentos', () => {
  it('valor exato compara como texto e ignora espaço em volta', () => {
    const mapa = rules({ type: 'value', match: ' 200 ', color: 'green', label: 'UP' });

    expect(resolveOwnThreshold(mapa, 200)?.label).toBe('UP');
    expect(resolveOwnThreshold(mapa, '200')?.label).toBe('UP');
    expect(resolveOwnThreshold(mapa, 201)).toBeUndefined();
  });

  it('faixa é fechada nos dois extremos', () => {
    const mapa = rules({ type: 'range', from: 10, to: 20, color: 'blue' });

    expect(resolveOwnThreshold(mapa, 10)?.color).toBe('blue');
    expect(resolveOwnThreshold(mapa, 20)?.color).toBe('blue');
    expect(resolveOwnThreshold(mapa, 9.9)).toBeUndefined();
    expect(resolveOwnThreshold(mapa, 20.1)).toBeUndefined();
  });

  it('regex casa sobre o texto do valor', () => {
    const mapa = rules({ type: 'regex', pattern: '^ERR', color: 'red' });

    expect(resolveOwnThreshold(mapa, 'ERRO 500')?.color).toBe('red');
    expect(resolveOwnThreshold(mapa, 'OK')).toBeUndefined();
  });

  /** O campo é editado caractere a caractere: `[` no meio da digitação. */
  it('regex inválida não casa e não explode', () => {
    const mapa = rules({ type: 'regex', pattern: '[', color: 'red' });

    expect(() => resolveOwnThreshold(mapa, 'qualquer')).not.toThrow();
    expect(resolveOwnThreshold(mapa, 'qualquer')).toBeUndefined();
  });

  it('especiais cobrem nulo, NaN e booleanos', () => {
    expect(resolveOwnThreshold(rules({ type: 'special', match: 'null', color: 'red' }), null)?.color).toBe('red');
    expect(resolveOwnThreshold(rules({ type: 'special', match: 'null', color: 'red' }), undefined)?.color).toBe('red');
    expect(resolveOwnThreshold(rules({ type: 'special', match: 'nan', color: 'red' }), NaN)?.color).toBe('red');
    expect(resolveOwnThreshold(rules({ type: 'special', match: 'null+nan', color: 'red' }), NaN)?.color).toBe('red');
    expect(resolveOwnThreshold(rules({ type: 'special', match: 'true', color: 'red' }), 1)?.color).toBe('red');
    expect(resolveOwnThreshold(rules({ type: 'special', match: 'false', color: 'red' }), false)?.color).toBe('red');
    expect(resolveOwnThreshold(rules({ type: 'special', match: 'empty', color: 'red' }), '')?.color).toBe('red');
  });

  it('nulo não casa com valor exato nem com regex', () => {
    expect(resolveOwnThreshold(rules({ type: 'value', match: 'null', color: 'red' }), null)).toBeUndefined();
    expect(resolveOwnThreshold(rules({ type: 'regex', pattern: '.*', color: 'red' }), null)).toBeUndefined();
  });
});

/**
 * A precedência é a mesma do Grafana — mapeamentos antes de thresholds —, mas
 * aqui ela fica visível na própria ordem da lista, em vez de escrita na
 * documentação.
 */
describe('precedência entre mapeamento e threshold', () => {
  const misto = rules(
    { type: 'threshold', value: 50, color: 'red', label: 'alto' },
    { type: 'value', match: '80', color: 'green', label: 'esperado' }
  );

  it('o mapeamento vence o threshold que também casaria', () => {
    expect(resolveOwnThreshold(misto, 80)?.label).toBe('esperado');
  });

  it('sem mapeamento correspondente, o threshold decide', () => {
    expect(resolveOwnThreshold(misto, 90)?.label).toBe('alto');
  });

  it('o primeiro mapeamento criado vence os seguintes', () => {
    const dois = rules(
      { type: 'range', from: 0, to: 100, color: 'blue', label: 'primeiro' },
      { type: 'value', match: '50', color: 'green', label: 'segundo' }
    );

    expect(resolveOwnThreshold(dois, 50)?.label).toBe('primeiro');
  });
});

describe('sortRules', () => {
  it('mapeamentos na ordem de criação, thresholds do maior para o menor', () => {
    const entrada: ElementRule[] = [
      { type: 'threshold', value: 10, color: 'a' },
      { type: 'value', match: 'x', color: 'b' },
      { type: 'threshold', value: 90, color: 'c' },
      { type: 'regex', pattern: 'y', color: 'd' },
    ];

    expect(sortRules(entrada).map((rule) => rule.color)).toEqual(['b', 'd', 'c', 'a']);
  });

  it('não muta a entrada', () => {
    const entrada: ElementRule[] = [
      { type: 'threshold', value: 1, color: 'a' },
      { type: 'threshold', value: 9, color: 'b' },
    ];
    sortRules(entrada);

    expect(entrada.map((rule) => rule.color)).toEqual(['a', 'b']);
  });
});

describe('hasSpecialRule', () => {
  /** A cadeia de cor usa isto para decidir se `nodata` ainda se aplica. */
  it('acusa só quando há regra capaz de tratar ausência de dado', () => {
    expect(hasSpecialRule(rules({ type: 'special', match: 'null', color: 'red' }))).toBe(true);
    expect(hasSpecialRule(ESCALA)).toBe(false);
    expect(hasSpecialRule(undefined)).toBe(false);
  });
});

/**
 * Bloco A: a severidade entrou como sexto tipo de regra, na mesma lista. O que
 * estes casos protegem e a separacao dos dois eixos — sem ela, uma regra `>= 90`
 * de CPU casaria com uma severidade 5 e pintaria o alarme errado.
 */
describe('resolveSeverityRule', () => {
  const regra = (atLeast: Severity, color: string) => ({ type: 'severity' as const, atLeast, color });

  it('sem regra de severidade, não decide nada — o mapa do Zabbix continua valendo', () => {
    expect(resolveSeverityRule(undefined, 5)).toBeUndefined();
    expect(resolveSeverityRule({ steps: [] }, 5)).toBeUndefined();
  });

  it('vence a regra de maior severidade que o alarme alcança', () => {
    const steps = [regra(2, 'yellow'), regra(4, 'red'), regra(5, 'dark-red')];

    expect(resolveSeverityRule({ steps }, 5)?.color).toBe('dark-red');
    expect(resolveSeverityRule({ steps }, 4)?.color).toBe('red');
    expect(resolveSeverityRule({ steps }, 3)?.color).toBe('yellow');
  });

  it('alarme mais brando que todas as regras não casa', () => {
    expect(resolveSeverityRule({ steps: [regra(4, 'red')] }, 2)).toBeUndefined();
  });

  /** É assim que se obtém "uma cor para qualquer alarme", sem modo separado. */
  it('uma regra em Not classified pinta qualquer alarme', () => {
    const steps = [regra(0, 'purple')];

    expect(resolveSeverityRule({ steps }, 0)?.color).toBe('purple');
    expect(resolveSeverityRule({ steps }, 5)?.color).toBe('purple');
  });

  it('ignora as regras de métrica que dividem a lista', () => {
    const steps = [
      { type: 'threshold' as const, value: 90, color: 'orange' },
      { type: 'value' as const, match: '5', color: 'green' },
      regra(4, 'red'),
    ];

    expect(resolveSeverityRule({ steps }, 5)?.color).toBe('red');
  });
});

describe('separação dos dois eixos', () => {
  const severidade = { type: 'severity' as const, atLeast: 4 as Severity, color: 'red' };
  const metrica = { type: 'threshold' as const, value: 90, color: 'orange' };

  /** Uma severidade 5 não pode casar com uma regra numérica `>= 90`. */
  it('a resolução por métrica ignora regras de severidade', () => {
    expect(resolveOwnThreshold({ steps: [severidade] }, 5)).toBeUndefined();
    expect(resolveOwnThreshold({ steps: [severidade] }, 95)).toBeUndefined();
  });

  /**
   * Um elemento que só configurou cores de trigger não pode perder o pipeline
   * nativo do Grafana ao voltar para o modo Métrica.
   */
  it('só regras de severidade não contam como regra própria de métrica', () => {
    expect(hasOwnThresholds({ steps: [severidade] })).toBe(false);
    expect(hasOwnThresholds({ steps: [severidade, metrica] })).toBe(true);
  });

  it('as duas listas convivem sem se ver', () => {
    const steps = [severidade, metrica];

    expect(metricRules({ steps })).toEqual([metrica]);
    expect(severityRules({ steps })).toEqual([severidade]);
  });

  it('a ordenação põe severidades da mais grave para a mais branda', () => {
    const baixa = { type: 'severity' as const, atLeast: 1 as Severity, color: 'blue' };
    const alta = { type: 'severity' as const, atLeast: 5 as Severity, color: 'dark-red' };

    expect(sortRules([baixa, alta])).toEqual([alta, baixa]);
  });
});
