import React, { useMemo } from 'react';
import {
  DataFrame,
  Field,
  FieldNamePickerConfigSettings,
  StandardEditorProps,
  getFieldDisplayName,
  standardEditorsRegistry,
} from '@grafana/data';
import { Combobox, ErrorBoundary } from '@grafana/ui';

/**
 * Seletor de field. Unico ponto do codigo que toca API instavel do Grafana.
 *
 * `FieldNamePicker` nao e exportado publicamente de `@grafana/ui` (o subpath
 * `./internal` nao esta no `exports` do pacote). Mas `standardEditorsRegistry`
 * e exportado de `@grafana/data`, e `builder.addFieldNamePicker` internamente
 * faz exatamente `standardEditorsRegistry.get('field-name').editor` — entao
 * pegamos o mesmo componente por via publica.
 *
 * O id `'field-name'` e string magica e o registry e populado pelo core em
 * runtime: as duas coisas podem mudar sem aviso. Dai o guard e o fallback.
 * Recebe `frames`, nunca `StandardEditorContext`, para poder viver depois num
 * inspector inline onde nao existe contexto.
 *
 * **Com `extras`, o seletor nativo sai de cena**: ele so conhece os frames, e
 * nao ha como acrescentar uma opcao a ele. As series que o painel busca sozinho
 * nao estao nos frames do editor, entao ou o fallback assume, ou a opcao nao
 * existe para quem ligou a secao Zabbix. Os dois componentes fazem a mesma
 * coisa — listar nome de field num combo.
 */

const FIELD_NAME_EDITOR_ID = 'field-name';

export interface TopoFieldPickerProps {
  frames: DataFrame[];
  value?: string;
  onChange: (value?: string) => void;
  placeholder?: string;
  filter?: (field: Field) => boolean;
  /**
   * Nomes que nao estao nos frames mas existirao quando o painel desenhar — as
   * series que ele busca direto no Zabbix. Aparecem primeiro na lista, que e
   * onde quem ligou a secao vai procura-las.
   */
  extras?: string[];
  /**
   * O **catalogo** de metricas dos hosts da topologia, carregado sob demanda ao
   * abrir o combo.
   *
   * Existe porque `extras` so cobre o que ja esta vinculado, e escolher uma
   * metrica costuma ser justamente o ato de vincular a primeira. Quando presente,
   * a lista vira assincrona: e uma ida ao Zabbix por host, e faze-la a cada
   * render seria pagar por uma lista que ninguem abriu.
   */
  loadExtras?: () => Promise<string[]>;
}

export function TopoFieldPicker({
  frames,
  value,
  onChange,
  placeholder,
  filter,
  extras,
  loadExtras,
}: TopoFieldPickerProps) {
  const NativePicker = useMemo(() => standardEditorsRegistry.getIfExists(FIELD_NAME_EDITOR_ID)?.editor, []);

  const fallback = (
    <FieldNameSelect
      frames={frames}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      filter={filter}
      extras={extras}
      loadExtras={loadExtras}
    />
  );

  if (!NativePicker || (extras && extras.length > 0) || loadExtras) {
    return fallback;
  }

  const settings: FieldNamePickerConfigSettings = {
    filter,
    placeholderText: placeholder,
    isClearable: true,
  };

  // O contexto e o item sao sintetizados: o editor nativo so consome
  // `context.data` e `item.settings`, e nao temos um `StandardEditorContext`
  // real para oferecer.
  const props = {
    value: value ?? '',
    onChange,
    context: { data: frames },
    item: { id: FIELD_NAME_EDITOR_ID, name: '', settings },
  } as unknown as StandardEditorProps<string, FieldNamePickerConfigSettings>;

  return (
    <ErrorBoundary dependencies={[frames, value]}>
      {({ error }) => (error ? fallback : <NativePicker {...props} />)}
    </ErrorBoundary>
  );
}

/** Fallback: mesma funcao, sem depender do registry. */
function FieldNameSelect({ frames, value, onChange, placeholder, filter, extras, loadExtras }: TopoFieldPickerProps) {
  const doPainel = useMemo(() => {
    const names: string[] = [...(extras ?? [])];

    for (const frame of frames) {
      for (const field of frame.fields) {
        if (filter && !filter(field)) {
          continue;
        }
        const name = getFieldDisplayName(field, frame, frames);
        if (!names.includes(name)) {
          names.push(name);
        }
      }
    }

    return names;
  }, [frames, filter, extras]);

  /*
    Com catalogo, a lista e assincrona e **nos** filtramos: o `Combobox` so
    filtra o que recebe pronto. A ordem e deliberada — o que ja esta vinculado e
    o que veio das queries primeiro, o catalogo depois: sao dezenas de itens por
    host, e o que o usuario ja usa nao pode afundar no meio deles.
  */
  const carregar = useMemo(() => {
    if (!loadExtras) {
      return undefined;
    }

    return async (input: string) => {
      const catalogo = await loadExtras().catch(() => [] as string[]);
      const todos = [...doPainel, ...catalogo.filter((nome) => !doPainel.includes(nome))];

      return filtrar(todos, input).map((name) => ({ label: name, value: name }));
    };
  }, [loadExtras, doPainel]);

  const options = useMemo(() => doPainel.map((name) => ({ label: name, value: name })), [doPainel]);

  return (
    <Combobox
      options={carregar ?? options}
      value={value ?? null}
      onChange={(selected) => onChange(selected?.value)}
      placeholder={placeholder ?? 'Selecione um field'}
      noOptionsMessage="Nenhum field disponível"
      isClearable
    />
  );
}

/** Filtro local, sem acento e sem caixa — o mesmo criterio dos combos do Zabbix. */
function filtrar(names: string[], input: string): string[] {
  const termo = normalizar(input);

  return termo ? names.filter((name) => normalizar(name).includes(termo)) : names;
}

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}
