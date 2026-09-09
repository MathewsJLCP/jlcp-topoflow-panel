import { DataFrame, DisplayValue, Field, FieldType, getFieldDisplayName } from '@grafana/data';

import { ColorDimension, TextDimension } from '../model/types';

/**
 * Quais fields um seletor deve oferecer.
 *
 * Existem aqui, e nao soltos em cada formulario, porque a pergunta e a mesma em
 * todos: **o que este campo consegue exibir**. Enquanto cada tela filtrava por
 * conta propria, o seletor de "Exibir valor" mostrava so numeros e o de inserir
 * metrica no texto mostrava tudo — inclusive o field `Problems`, que e um array
 * de objetos e nunca produziu texto nenhum. O usuario inseria, nao aparecia
 * nada, e o painel nao tinha como explicar por que.
 */

/**
 * Estado e "Exibir valor" leem grandeza: so numero serve.
 *
 * `type` entra opcional porque o filtro do seletor recebe o que estiver no
 * frame, e nada garante que um datasource preencheu o campo — o tipo do
 * `@grafana/data` promete mais do que o runtime cumpre.
 */
export function isNumericField(field: { type?: FieldType }): boolean {
  return field.type === FieldType.number;
}

/**
 * Um template de texto interpola o **ultimo valor** do field, entao serve
 * qualquer tipo que vire texto legivel — numero, palavra, booleano, enum.
 *
 * Ficam de fora `other` (objeto ou array, como o `Problems` das queries de
 * Problems), `time` (um instante cru num rotulo e ruido, e todo frame de
 * metrica tem um), e os tipos estruturados que nem sequer tem valor escalar.
 */
export function isDisplayableField(field: { type?: FieldType }): boolean {
  return (
    field.type === FieldType.number ||
    field.type === FieldType.string ||
    field.type === FieldType.boolean ||
    field.type === FieldType.enum
  );
}

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

/**
 * Qual serie o vinculo de estado observa, ja como **nome de field**.
 *
 * Existem duas formas de nomear a mesma serie, e esta funcao e o unico lugar que
 * conhece as duas: `field` (o display name do frame, o formato de tudo que ja
 * esta salvo) e `metric` (host + item, escolhidos no catalogo do Zabbix).
 *
 * **`metric` vence** quando os dois existem: e o mais especifico e o mais
 * recente. O editor nunca grava os dois juntos — se aparecerem, veio de JSON
 * editado a mao.
 *
 * A traducao de host+item para nome de serie e o pulo do gato, e ela tem duas
 * respostas possiveis porque o datasource nomeia a serie com o nome do item e
 * so prefixa `"<host>: "` quando **aquela query casou mais de um host**
 * (`responseHandler.ts` do grafana-zabbix). Ou seja: o mesmo item muda de nome
 * conforme a query cresce. Tentamos as duas, na ordem em que sao mais
 * especificas.
 *
 * Nao achar nenhuma **nao e** o mesmo que nao ter vinculo: devolve o nome
 * qualificado assim mesmo, para que a cadeia de cor caia em `nodata` — o
 * elemento tem metrica escolhida, ela e que nao esta nas queries do painel.
 * Devolver `undefined` ali faria o elemento exibir a Base, dizendo "nada
 * acontecendo" sobre algo que ninguem esta medindo.
 */
export function stateFieldName(dim: ColorDimension, frames: DataFrame[]): string | undefined {
  const host = dim.metric?.host.trim();
  const item = dim.metric?.item.trim();

  if (!host || !item) {
    return dim.field || undefined;
  }

  const qualificado = `${host}: ${item}`;

  for (const candidato of [qualificado, item]) {
    if (getLastNotNullValue(frames, candidato)) {
      return candidato;
    }
  }

  return qualificado;
}

/**
 * Ha metrica escolhida? Nao pergunta aos frames — a resposta e sobre a
 * **configuracao**, e e usada para avisar quem ligou uma regra ou um grafico sem
 * escolher o que observar. Perguntar aos dados faria o aviso aparecer e sumir
 * conforme o Zabbix, que e o oposto do que um aviso de configuracao deve fazer.
 */
export function hasStateBinding(dim: ColorDimension): boolean {
  return Boolean(dim.field || (dim.metric?.host.trim() && dim.metric?.item.trim()));
}

/**
 * O field **e o frame em que ele vive**.
 *
 * `getLastNotNullValue` devolve so o field, que basta para ler um valor. O
 * grafico precisa de mais: a serie temporal e o par (tempo, valor), e a coluna
 * de tempo esta no frame irmao — sem ele, so daria para desenhar os valores sem
 * saber quando aconteceram.
 */
export function findFieldFrame(
  frames: DataFrame[],
  fieldName?: string
): { frame: DataFrame; field: Field } | undefined {
  if (!fieldName) {
    return undefined;
  }

  for (const frame of frames) {
    for (const field of frame.fields) {
      if (getFieldDisplayName(field, frame, frames) === fieldName) {
        return { frame, field };
      }
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

  return resolveTemplate(dim.fixed ?? '', frames);
}

/**
 * Placeholder de metrica dentro de um texto: `${nome do field}`.
 *
 * As chaves sao obrigatorias, e nao opcionais como no `$var` do Grafana, porque
 * o nome de exibicao de um field tem espaco e dois-pontos
 * (`ACRILICO-SRV-AD: ICMP ping`) — sem delimitador de fim nao ha como saber onde
 * o nome termina e o texto do usuario recomeca.
 */
const PLACEHOLDER = /\$\{([^}]*)\}/g;

/**
 * Texto com as metricas interpoladas: e o que permite um rotulo de conexao
 * combinar palavra e valor, como nos mapas do Zabbix.
 *
 *     IN: ${AGLIN-FW: traffic in}   ->   IN: 1.24 Mb/s
 *     Status: ${AGLIN-FW: oper}     ->   Status: Operacional
 *
 * O valor sai de `field.display()`, o mesmo pipeline do resto do painel, entao
 * unidade, casas decimais e **value mappings** ja vem aplicados. E o que faz
 * `Status: Operacional` funcionar sem nenhuma traducao nossa: quem mapeia `1` em
 * `Operacional` e o field, exatamente como o value map do Zabbix.
 *
 * Duas ausencias, dois resultados diferentes de proposito:
 *
 *   - **field que nao existe nas series** devolve o proprio `${...}` na tela. Um
 *     travessao ali diria "sem dado agora", e o problema e outro: o nome esta
 *     errado ou a query saiu do painel. Deixar o texto cru na tela e o que torna
 *     o erro obvio — e o que protege quem digitou `${}` sem querer dizer nada.
 *   - **field que existe e esta sem valor** devolve `NO_VALUE`, que e o que
 *     "sem dado" significa em todo o resto do painel.
 */
export function resolveTemplate(text: string, frames: DataFrame[]): string {
  if (!text.includes('${')) {
    return text;
  }

  return text.replace(PLACEHOLDER, (raw, name: string) => {
    const fieldName = name.trim();
    if (!fieldName) {
      return raw;
    }

    const hit = getLastNotNullValue(frames, fieldName);
    if (!hit) {
      return raw;
    }

    return hit.value == null || !hit.field.display ? NO_VALUE : formatDisplayValue(hit.field.display(hit.value));
  });
}

/** Nomes de field citados no texto, na ordem em que aparecem, sem repetir. */
export function templateFields(text: string): string[] {
  const names = new Set<string>();

  for (const [, name] of text.matchAll(PLACEHOLDER)) {
    const fieldName = name.trim();
    if (fieldName) {
      names.add(fieldName);
    }
  }

  return [...names];
}

/**
 * Texto com `${field}` inserido na posicao `at`.
 *
 * Vive aqui, e nao dentro do componente, porque o que ela resolve e a gramatica
 * do template — as chaves, e onde elas entram —, e nao o comportamento de um
 * controle. Tambem e o unico jeito de testa-la: o menu do seletor de field e
 * virtualizado e nao renderiza opcao nenhuma no jsdom.
 *
 * `at` fora do texto e tratado como o fim dele: e o caso de quem nunca clicou
 * dentro do campo, e inserir no comeco ali seria uma surpresa.
 */
export function insertTemplateField(text: string, at: number, fieldName: string): string {
  const position = Number.isFinite(at) ? Math.min(Math.max(at, 0), text.length) : text.length;
  return `${text.slice(0, position)}\${${fieldName}}${text.slice(position)}`;
}

/**
 * Os citados que nenhuma serie tem — os que apareceriam crus no canvas.
 *
 * O aviso vive no editor, e nao no canvas, pelo mesmo motivo do vinculo de
 * trigger: e la que quem pode corrigir esta olhando.
 */
export function missingTemplateFields(text: string, frames: DataFrame[]): string[] {
  return templateFields(text).filter((name) => isFieldMissing(frames, name));
}

/** True quando o vinculo aponta para um field que nao existe nas series. */
export function isFieldMissing(frames: DataFrame[], fieldName?: string): boolean {
  return Boolean(fieldName) && getLastNotNullValue(frames, fieldName!) === undefined;
}
