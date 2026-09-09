import { ElementRule, ElementThresholds, Severity } from '../model/types';
import {
  hasOwnThresholds,
  hasSpecialRule,
  metricRules,
  resolveOwnThreshold,
  resolveSeverityRule,
  hasDisabledSeverity,
  isSeverityEnabled,
  severityLadder,
  severityRules,
  sortRules,
  writeSeverityLadder,
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

/**
 * A escada é a tela do modo Trigger: seis níveis, uma cor cada. O que estes
 * casos protegem é a promessa que ela faz — a linha que está na tela é a que
 * pinta aquela severidade, e nenhuma outra.
 */
describe('severityLadder', () => {
  it('sem regra, mostra o mapa padrão do Zabbix, do mais grave ao mais brando', () => {
    expect(severityLadder(undefined)).toEqual([
      { severity: 5, color: 'dark-red', label: undefined, animation: undefined, enabled: true },
      { severity: 4, color: 'red', label: undefined, animation: undefined, enabled: true },
      { severity: 3, color: 'orange', label: undefined, animation: undefined, enabled: true },
      { severity: 2, color: 'yellow', label: undefined, animation: undefined, enabled: true },
      { severity: 1, color: 'blue', label: undefined, animation: undefined, enabled: true },
      // Not classified não tem cor no mapa: o padrão dele é um token do tema.
      { severity: 0, color: undefined, label: undefined, animation: undefined, enabled: true },
    ]);
  });

  it('a regra própria substitui o padrão no nível dela', () => {
    const rows = severityLadder({ steps: [{ type: 'severity', atLeast: 5, color: 'purple', label: 'CRÍTICO' }] });

    expect(rows[0]).toMatchObject({ severity: 5, color: 'purple', label: 'CRÍTICO' });
    expect(rows[1]).toMatchObject({ severity: 4, color: 'red', label: undefined });
  });

  /**
   * Configuração feita no editor antigo, onde uma regra só cobria dela para
   * cima. A escada tem que mostrar a cor que o elemento **teria** em cada nível,
   * senão o que já está salvo apareceria como se não existisse.
   */
  it('regra `a partir de` pinta também os níveis acima dela', () => {
    const rows = severityLadder({ steps: [{ type: 'severity', atLeast: 4, color: 'purple' }] });

    expect(rows.map((row) => row.color)).toEqual(['purple', 'purple', 'orange', 'yellow', 'blue', undefined]);
  });

  it('a animação da regra aparece na linha dela', () => {
    const rows = severityLadder({ steps: [{ type: 'severity', atLeast: 5, color: 'purple', animation: 'radar' }] });

    expect(rows.map((row) => row.animation)).toEqual(['radar', undefined, undefined, undefined, undefined, undefined]);
  });

  /**
   * O campo `alert` do elemento foi aposentado, mas o que ele configurava não
   * some da tela: "Radar a partir de High" reaparece como Radar nas duas linhas
   * que ele alcançava.
   */
  it('o alerta aposentado aparece nas linhas que alcançava', () => {
    const rows = severityLadder(undefined, { animation: 'radar', fromSeverity: 4 });

    expect(rows.map((row) => row.animation)).toEqual(['radar', 'radar', undefined, undefined, undefined, undefined]);
  });

  it('a animação da regra vence o alerta aposentado', () => {
    const steps: ElementRule[] = [{ type: 'severity', atLeast: 5, color: 'purple', animation: 'pulse' }];
    const rows = severityLadder({ steps }, { animation: 'radar', fromSeverity: 0 });

    expect(rows[0].animation).toBe('pulse');
    expect(rows[1].animation).toBe('radar');
  });
});

describe('writeSeverityLadder', () => {
  const NEUTRO = '#8e8e8e';

  /**
   * O ponto inteiro da materialização: sem os níveis acima gravados, um alarme
   * *Disaster* casaria com a regra de *Average* (5 >= 3) e sairia roxo — cor que
   * nenhuma linha da tela mostra.
   */
  it('editar um nível grava a escada inteira', () => {
    const rules = writeSeverityLadder(undefined, 3, { color: 'purple' }, NEUTRO);

    expect(rules).toEqual([
      { type: 'severity', atLeast: 5, color: 'dark-red' },
      { type: 'severity', atLeast: 4, color: 'red' },
      { type: 'severity', atLeast: 3, color: 'purple' },
      { type: 'severity', atLeast: 2, color: 'yellow' },
      { type: 'severity', atLeast: 1, color: 'blue' },
    ]);
    expect(resolveSeverityRule({ steps: rules }, 5)?.color).toBe('dark-red');
    expect(resolveSeverityRule({ steps: rules }, 3)?.color).toBe('purple');
  });

  /**
   * *Not classified* não tem cor no mapa do Zabbix, e entrar sem ser chamado
   * mudaria o padrão de quem nunca olhou para aquela linha.
   */
  it('Not classified só entra quando é ele o editado', () => {
    expect(writeSeverityLadder(undefined, 5, { color: 'purple' }, NEUTRO).some((r) => r.atLeast === 0)).toBe(false);

    expect(writeSeverityLadder(undefined, 0, { color: 'purple' }, NEUTRO).at(-1)).toEqual({
      type: 'severity',
      atLeast: 0,
      color: 'purple',
    });
  });

  it('editar o rótulo de Not classified sem cor cai no neutro do tema', () => {
    expect(writeSeverityLadder(undefined, 0, { label: 'DESCONHECIDO' }, NEUTRO).at(-1)).toEqual({
      type: 'severity',
      atLeast: 0,
      color: NEUTRO,
      label: 'DESCONHECIDO',
    });
  });

  it('editar a cor preserva o rótulo, e apagar o rótulo o remove', () => {
    const steps = writeSeverityLadder(undefined, 5, { color: 'purple', label: 'CRÍTICO' }, NEUTRO);

    expect(writeSeverityLadder({ steps }, 5, { color: 'blue' }, NEUTRO)[0]).toEqual({
      type: 'severity',
      atLeast: 5,
      color: 'blue',
      label: 'CRÍTICO',
    });
    expect(writeSeverityLadder({ steps }, 5, { label: undefined }, NEUTRO)[0]).toEqual({
      type: 'severity',
      atLeast: 5,
      color: 'purple',
    });
  });

  it('a animação entra como coluna da linha, igual à cor', () => {
    const rules = writeSeverityLadder(undefined, 5, { animation: 'radar' }, NEUTRO);

    expect(rules[0]).toEqual({ type: 'severity', atLeast: 5, color: 'dark-red', animation: 'radar' });
    expect(rules[1]).toEqual({ type: 'severity', atLeast: 4, color: 'red' });
  });

  /** Editar a escada é o que dobra o campo aposentado para dentro das regras. */
  it('materializa o alerta aposentado junto, nos níveis que ele alcançava', () => {
    const rules = writeSeverityLadder(undefined, 3, { color: 'purple' }, NEUTRO, {
      animation: 'pulse',
      fromSeverity: 4,
    });

    expect(rules).toEqual([
      { type: 'severity', atLeast: 5, color: 'dark-red', animation: 'pulse' },
      { type: 'severity', atLeast: 4, color: 'red', animation: 'pulse' },
      { type: 'severity', atLeast: 3, color: 'purple' },
      { type: 'severity', atLeast: 2, color: 'yellow' },
      { type: 'severity', atLeast: 1, color: 'blue' },
    ]);
  });

  it('não devolve regra de métrica nenhuma — quem as preserva é o editor', () => {
    const steps: ElementRule[] = [{ type: 'threshold', value: 90, color: 'orange' }];

    expect(writeSeverityLadder({ steps }, 5, { color: 'purple' }, NEUTRO).every((r) => r.type === 'severity')).toBe(
      true
    );
  });
});

/**
 * Severidade desligada: o elemento ignora aquele nivel e fica na Base. Serve
 * para o ruido conhecido — um parque cheio de *Information* que ninguem atende
 * deixaria o mapa inteiro aceso, e mapa sempre aceso nao avisa nada.
 */
describe('isSeverityEnabled', () => {
  it('sem regra nenhuma, toda severidade atende', () => {
    for (const s of [0, 1, 2, 3, 4, 5] as const) {
      expect(isSeverityEnabled(undefined, s)).toBe(true);
    }
  });

  it('só o nível desligado para de atender', () => {
    const escada: ElementThresholds = {
      steps: [
        { type: 'severity', atLeast: 5, color: 'dark-red' },
        { type: 'severity', atLeast: 1, color: 'blue', enabled: false },
      ],
    };

    expect(isSeverityEnabled(escada, 1)).toBe(false);
    expect(isSeverityEnabled(escada, 5)).toBe(true);
  });

  /** `enabled` ausente é ligado: é o que faz toda escada já salva continuar acendendo. */
  it('regra sem a flag continua atendendo', () => {
    expect(isSeverityEnabled({ steps: [{ type: 'severity', atLeast: 3, color: 'orange' }] }, 3)).toBe(true);
  });
});

describe('hasDisabledSeverity', () => {
  it('distingue escada intacta de escada com nível desligado', () => {
    expect(hasDisabledSeverity(undefined)).toBe(false);
    expect(hasDisabledSeverity({ steps: [{ type: 'severity', atLeast: 3, color: 'orange' }] })).toBe(false);
    expect(hasDisabledSeverity({ steps: [{ type: 'severity', atLeast: 3, color: 'orange', enabled: false }] })).toBe(
      true
    );
  });
});

describe('writeSeverityLadder — nível desligado', () => {
  it('grava `enabled: false` só no nível desligado', () => {
    const escrita = writeSeverityLadder(undefined, 1, { enabled: false }, '#888');

    expect(escrita.find((rule) => rule.atLeast === 1)?.enabled).toBe(false);
    // Os demais não carregam a flag: o silêncio já significa ligado, e gravá-la
    // nos seis encheria o JSON do dashboard sem dizer nada novo.
    expect(escrita.filter((rule) => 'enabled' in rule)).toHaveLength(1);
  });

  it('religar apaga a flag em vez de gravar `true`', () => {
    const desligada = writeSeverityLadder(undefined, 1, { enabled: false }, '#888');
    const religada = writeSeverityLadder({ steps: desligada }, 1, { enabled: true }, '#888');

    expect(religada.some((rule) => 'enabled' in rule)).toBe(false);
  });
});
