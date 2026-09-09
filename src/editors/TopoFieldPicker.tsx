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
 */

const FIELD_NAME_EDITOR_ID = 'field-name';

export interface TopoFieldPickerProps {
  frames: DataFrame[];
  value?: string;
  onChange: (value?: string) => void;
  placeholder?: string;
  filter?: (field: Field) => boolean;
}

export function TopoFieldPicker({ frames, value, onChange, placeholder, filter }: TopoFieldPickerProps) {
  const NativePicker = useMemo(() => standardEditorsRegistry.getIfExists(FIELD_NAME_EDITOR_ID)?.editor, []);

  const fallback = (
    <FieldNameSelect frames={frames} value={value} onChange={onChange} placeholder={placeholder} filter={filter} />
  );

  if (!NativePicker) {
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
function FieldNameSelect({ frames, value, onChange, placeholder, filter }: TopoFieldPickerProps) {
  const options = useMemo(() => {
    const names: string[] = [];

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

    return names.map((name) => ({ label: name, value: name }));
  }, [frames, filter]);

  return (
    <Combobox
      options={options}
      value={value ?? null}
      onChange={(selected) => onChange(selected?.value)}
      placeholder={placeholder ?? 'Selecione um field'}
      noOptionsMessage="Nenhum field disponível"
      isClearable
    />
  );
}
