import { DataFrame, DisplayValue, Field, getFieldDisplayName } from '@grafana/data';

import { TextDimension } from '../model/types';

/**
 * Resolucao de dimensoes (ADR-P04): uma propriedade e fixa ou vem de um field.
 *
 * Nenhuma logica de threshold vive aqui. `field.display()` — instalado pelo
 * Grafana em `applyFieldOverrides`, que so roda porque `module.ts` chama
 * `.useFieldConfig()` — ja devolve texto, unidade, prefixo, sufixo e cor com
 * thresholds E value mappings aplicados (ADR-P03).
 *
 * Pre-condicao: quem monta as series deve ter chamado `cacheFieldDisplayNames`
 * uma vez. Sem isso `getFieldDisplayName` pode desambiguar diferente entre
 * chamadas — exatamente o cenario de dois hosts na mesma query.
 */

export interface FieldHit {
  field: Field;
  value: unknown;
}

/** Localiza um field pelo display name e devolve o ultimo valor nao-nulo. */
export function getLastNotNullValue(frames: DataFrame[], fieldName: string): FieldHit | undefined {
  for (const frame of frames) {
    for (const field of frame.fields) {
      if (getFieldDisplayName(field, frame, frames) !== fieldName) {
        continue;
      }

      for (let i = field.values.length - 1; i >= 0; i--) {
        const value = field.values[i];
        if (value != null) {
          return { field, value };
        }
      }

      // Field existe mas nao tem nenhum valor util. Devolver o hit (em vez de
      // `undefined`) distingue "field ausente" de "field sem dado" para quem
      // chama — sao dois dos tres estados de ausencia previstos no PRD.
      return { field, value: null };
    }
  }

  return undefined;
}

/** `DisplayValue` completo: texto formatado, unidade e cor ja resolvidas. */
export function resolveDisplayValue(frames: DataFrame[], fieldName?: string): DisplayValue | undefined {
  if (!fieldName) {
    return undefined;
  }

  const hit = getLastNotNullValue(frames, fieldName);
  if (!hit?.field.display || hit.value == null) {
    return undefined;
  }

  return hit.field.display(hit.value);
}

/** Texto pronto para exibir, com prefixo e sufixo do `DisplayValue`. */
export function formatDisplayValue(display: DisplayValue | undefined): string {
  if (!display) {
    return NO_VALUE;
  }
  return `${display.prefix ?? ''}${display.text}${display.suffix ?? ''}`;
}

export const NO_VALUE = '—';

/**
 * Resolucao de cor NAO fica aqui: veja `resolveElementColor` em
 * `./elementColor.ts`. A versao antiga deste modulo caia em
 * `getColorByName(dim.fixed ?? 'text')`, e `'text'` e um nome de cor valido do
 * Grafana que resolve para `text.primary` — quase branco no dark. Era a causa
 * de todo elemento novo nascer branco.
 */

/**
 * Texto de uma `TextDimension`, com unidade.
 *
 * No modo field passa por `formatDisplayValue`, e nao por `display.text` cru: e
 * o prefixo e o sufixo que carregam a unidade configurada no field (o `%` de um
 * "Percent (0-100)", o `ms`, o `B/s`). Lendo so `.text`, um texto vinculado a
 * uma metrica em porcentagem aparecia como `92` — o numero certo sem a unidade
 * que o torna legivel, e sem nenhum sinal de que faltava algo.
 *
 * Field ausente continua devolvendo string vazia, e nao o `NO_VALUE` que
 * `formatDisplayValue` usa: aqui o texto **e** o elemento, e um travessao
 * solto no canvas se le como sujeira, nao como ausencia de dado.
 */
export function resolveText(dim: TextDimension, frames: DataFrame[]): string {
  if (dim.mode === 'field') {
    const display = resolveDisplayValue(frames, dim.field);
    return display ? formatDisplayValue(display) : '';
  }

  return dim.fixed ?? '';
}

/** True quando o vinculo aponta para um field que nao existe nas series. */
export function isFieldMissing(frames: DataFrame[], fieldName?: string): boolean {
  return Boolean(fieldName) && getLastNotNullValue(frames, fieldName!) === undefined;
}
