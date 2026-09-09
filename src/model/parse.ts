import { z } from 'zod';

import { defaultCanvas, defaultTopology } from './defaults';
import { SCHEMA_VERSION, canvasSchema, topologySchema, zabbixOptionsSchema } from './schema';
import { TopoFlowOptions } from './types';

/**
 * Vive em arquivo proprio (nao em `schema.ts`) porque precisa de `defaults.ts`,
 * que por sua vez depende de `types.ts` -> `schema.ts`. Juntar tudo criaria um
 * ciclo de imports.
 */

export interface ParsedOptions {
  options: TopoFlowOptions;
  /**
   * Vazio quando nada estava corrompido. Uma entrada por secao que tinha valor
   * salvo e nao validou — secao ausente nao entra aqui, ver `parseSection`.
   */
  issues: string[];
  /**
   * A topologia salva existia e **nao validou**: `options.topology` e o default,
   * e nao o que o usuario desenhou.
   *
   * Quem escreve precisa saber disto. Sem a flag, o painel desenhava o default
   * e a primeira interacao no canvas gravava esse default por cima da topologia
   * salva — um arraste sem querer, e o trabalho do usuario ia embora porque um
   * unico campo do JSON estava fora do schema.
   */
  topologyInvalid: boolean;
}

/**
 * Le `panel.options` com validacao Zod e fallback para os defaults.
 *
 * As secoes sao validadas de forma independente. Um `topology` corrompido nao
 * pode derrubar as preferencias de canvas do usuario junto — sao dados sem
 * relacao, e o painel e o unico lugar onde o erro pode ser observado.
 */
export function parseTopoFlowOptions(raw: unknown): ParsedOptions {
  const source: Record<string, unknown> =
    typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const issues: string[] = [];

  const topology = parseSection('topology', topologySchema, source.topology, defaultTopology, issues);
  const topologyInvalid = issues.length > 0;
  const canvas = parseSection('canvas', canvasSchema, source.canvas, defaultCanvas, issues);
  /*
    Precisa passar por aqui mesmo o painel nao consultando o Zabbix: o objeto que
    sai desta funcao e o que o canvas devolve ao dashboard em `onOptionsChange`
    (ver `TopoFlowPanel`). Uma secao que o parse nao conhece simplesmente **some
    do JSON** no primeiro arraste — sem erro, sem aviso, e com o usuario
    reconfigurando o datasource achando que "nao salvou".
  */
  const zabbix = parseSection('zabbix', zabbixOptionsSchema.optional(), source.zabbix, undefined, issues);

  return {
    topologyInvalid,
    options: {
      // Carimbamos a versao corrente. Migracoes entre versoes de schema entram
      // aqui quando SCHEMA_VERSION passar de 1.
      schemaVersion: SCHEMA_VERSION,
      topology,
      canvas,
      zabbix,
    },
    issues,
  };
}

/**
 * Ausente e corrompido sao situacoes diferentes e so uma merece aviso.
 *
 * Um painel recem-adicionado nao tem `topology` salva — esse e o caminho normal
 * de entrada, e o default e a resposta certa em silencio. Ja um valor presente
 * que nao valida significa dado perdido, e o usuario precisa saber.
 */
function parseSection<T>(name: string, schema: z.ZodType<T>, value: unknown, fallback: T, issues: string[]): T {
  if (value === undefined) {
    return fallback;
  }

  const result = schema.safeParse(value);
  if (result.success) {
    return result.data;
  }

  issues.push(`${name}: ${summarize(result.error)}`);
  return fallback;
}

function summarize(error: z.ZodError): string {
  return error.issues.map((issue) => `${issue.path.join('.') || '(raiz)'}: ${issue.message}`).join('; ');
}
