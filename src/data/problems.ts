import { DataFrame, FieldType } from '@grafana/data';

import { Severity } from '../model/types';

/**
 * Leitura dos frames de uma query Zabbix em Query Mode *Problems*.
 *
 * Este modulo sabe apenas **como ler o frame**; quem decide a cor de um elemento
 * a partir dele e `./triggerState.ts`. Por isso aqui nao entra `GrafanaTheme2`
 * nem nada de apresentacao.
 *
 * O frame de Problems **nao e colunar** — nao existem colunas `Host`,
 * `Severity` ou `Status`. O datasource devolve um unico field de objetos:
 *
 *     { name: 'problems', refId, length: N,
 *       fields: [{ name: 'Problems', type: FieldType.other,
 *                  config: { custom: { type: 'problems' } },
 *                  values: ProblemDTO[] }] }
 *
 * A consequencia que importa: `applyFieldOverrides`, `field.display`,
 * thresholds e value mappings **nao se aplicam** a este field. Nada do pipeline
 * nativo de cor passa por aqui — o mapa de severidade abaixo e nosso.
 */

/**
 * Forma minima do `ProblemDTO` do grafana-zabbix — so o que de fato lemos.
 *
 * Declarada aqui em vez de importada porque o plugin do Zabbix nao e
 * dependencia deste repo: os dados chegam por `DataFrame`, nunca por import.
 * Copiar o DTO inteiro acoplaria a um tipo que nao controlamos.
 *
 * `host` e `hostTechName` existem no DTO original e estao **ausentes de
 * proposito** desta interface: `joinTriggersWithProblems` nunca os preenche no
 * caminho de Problems, entao declara-los seria um convite a ler o campo errado
 * e nao encontrar host nenhum. O nome do host so existe em `hosts[]`.
 */
export interface ZabbixProblem {
  hosts?: Array<{ name?: string; host?: string } | undefined>;
  /** Descricao da trigger. */
  name?: string;
  /** Severidade Zabbix, como string: `'0'` a `'5'`. */
  severity?: string;
  /** Valor atual da trigger: `'1'` = PROBLEM, `'0'` = OK. */
  value?: string;
}

/**
 * Espelha o `isProblemsDataFrame` de `datasource/utils.ts` do grafana-zabbix —
 * e o mesmo criterio que o painel oficial de Problems usa, entao seguimos o
 * contrato de fato em vez de inventar uma heuristica por nome de field.
 *
 * A diferenca e o `?.` em `config.custom`: o original assume que `custom`
 * existe, o que e verdade nos frames do proprio Zabbix mas nao em qualquer
 * outro frame do painel.
 */
export function isProblemsFrame(frame: DataFrame): boolean {
  const [field] = frame.fields;

  return (
    field !== undefined && field.type === FieldType.other && field.config.custom?.['type'] === 'problems'
  );
}

/** True quando o painel tem ao menos uma query em Query Mode *Problems*. */
export function hasProblemsFrame(frames: DataFrame[]): boolean {
  return frames.some(isProblemsFrame);
}

/**
 * Achata todos os frames de Problems do painel numa lista unica.
 *
 * Varre todos em vez de exigir um `refId`: um painel pode ter varias queries de
 * Problems (por grupo, por severidade) e o elemento nao deveria precisar saber
 * de qual delas seu host vem.
 */
export function extractProblems(frames: DataFrame[]): ZabbixProblem[] {
  const problems: ZabbixProblem[] = [];

  for (const frame of frames) {
    if (!isProblemsFrame(frame)) {
      continue;
    }

    for (const value of frame.fields[0].values) {
      // O field e `FieldType.other`: nada garante que o conteudo seja objeto.
      if (value && typeof value === 'object') {
        problems.push(value as ZabbixProblem);
      }
    }
  }

  return problems;
}

/** Escala de severidade do Zabbix. */
/**
 * Reexportado do modelo, e nao declarado aqui: severidade virou dado persistido
 * (regra de severidade em `panel.options`), entao o Zod passou a ser a fonte.
 * Enquanto eram duas listas escritas a mao, nada impedia uma ganhar um nivel e a
 * outra nao.
 */
export type { Severity };

export const SEVERITY_LABEL: Record<Severity, string> = {
  0: 'Not classified',
  1: 'Information',
  2: 'Warning',
  3: 'Average',
  4: 'High',
  5: 'Disaster',
};

/**
 * Severidade -> nome de cor do Grafana, resolvido depois com
 * `theme.visualization.getColorByName` — a mesma via que o nivel 2 da cadeia de
 * cor ja usa para o acento fixo. Nomes, e nao hex, e o que mantem o tema no
 * controle em dark e light.
 *
 * `0` e `undefined` de proposito: *Not classified* deve cair em
 * `theme.colors.text.secondary`, que nao e um nome de cor do Grafana. E nao
 * pode virar `'text'` — esse nome resolve para `text.primary`, quase branco no
 * dark, exatamente o bug que a cadeia de cor do Bloco 1 existiu para matar.
 * Quem tem o tema em maos (`./triggerState.ts`) traduz o `undefined`.
 */
export const SEVERITY_COLOR: Record<Severity, string | undefined> = {
  0: undefined,
  1: 'blue',
  2: 'yellow',
  3: 'orange',
  4: 'red',
  5: 'dark-red',
};

function isSeverity(value: number): value is Severity {
  return Number.isInteger(value) && value >= 0 && value <= 5;
}

/** Severidade do problema. Valor ausente ou fora da escala vira `0`. */
export function problemSeverity(problem: ZabbixProblem): Severity {
  const parsed = Number(problem.severity);
  return isSeverity(parsed) ? parsed : 0;
}

/**
 * True quando a trigger esta em PROBLEM.
 *
 * A regra cobre os tres modos de `showProblems` do datasource: no default
 * (`problems`) a trigger resolvida simplesmente sai do frame; em `recent` e
 * `history` ela permanece com `value === '0'`.
 *
 * `value` ausente conta como **ativo**: um problema que chegou ate o frame sem
 * saber dizer seu estado deve acender, nao passar por saudavel em silencio.
 */
export function isActiveProblem(problem: ZabbixProblem): boolean {
  return problem.value !== '0';
}

/**
 * Match de host: exato e case-insensitive, contra `hosts[].name` **e**
 * `hosts[].host`.
 *
 * Nunca `contains`: `MMV-FW-STARTI-01` casaria com `MMV-FW-STARTI-011` e o
 * elemento acenderia por um problema que nao e dele. E aceita os dois campos
 * porque o Select lista `name` (o que o operador ve) mas a entrada livre
 * convida a digitar o nome tecnico.
 *
 * Host vazio nao casa com nada — um vinculo ainda nao configurado nao pode
 * herdar o problema do primeiro host da lista.
 */
export function matchesHost(problem: ZabbixProblem, host: string): boolean {
  const wanted = host.trim().toLowerCase();
  if (!wanted) {
    return false;
  }

  return (problem.hosts ?? []).some(
    (entry) => entry?.name?.toLowerCase() === wanted || entry?.host?.toLowerCase() === wanted
  );
}

/** Mesmo criterio de `matchesHost`, sobre a descricao da trigger. */
export function matchesName(problem: ZabbixProblem, name: string): boolean {
  const wanted = name.trim().toLowerCase();
  if (!wanted) {
    return false;
  }

  return problem.name?.trim().toLowerCase() === wanted;
}

/**
 * Hosts presentes nos frames, para popular o Select do editor.
 *
 * Lista `hosts[].name` — o nome de exibicao — e inclui hosts de problemas ja
 * resolvidos (modos `recent`/`history`): quem esta configurando o vinculo quer
 * o host, nao o estado dele agora.
 *
 * Limitacao inerente ao Query Mode *Problems*, que o editor precisa comunicar:
 * so aparece aqui quem tem problema no frame. Um host 100% saudavel nao esta
 * nesta lista, e por isso o Select do Bloco 3 aceita valor livre.
 */
export function listHosts(frames: DataFrame[]): string[] {
  const names = new Set<string>();

  for (const problem of extractProblems(frames)) {
    for (const entry of problem.hosts ?? []) {
      if (entry?.name) {
        names.add(entry.name);
      }
    }
  }

  return [...names].sort((a, b) => a.localeCompare(b));
}

/** Descricoes de trigger presentes nos frames, opcionalmente de um host so. */
export function listTriggers(frames: DataFrame[], host?: string): string[] {
  const names = new Set<string>();

  for (const problem of extractProblems(frames)) {
    if (host && !matchesHost(problem, host)) {
      continue;
    }
    if (problem.name) {
      names.add(problem.name);
    }
  }

  return [...names].sort((a, b) => a.localeCompare(b));
}
