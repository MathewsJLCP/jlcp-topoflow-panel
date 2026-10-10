import React from 'react';
import { DataFrame } from '@grafana/data';
import { Field, Input, Stack } from '@grafana/ui';

import { TextDimension } from '../model/types';
import { isDisplayableField } from '../data/dimensions';
import { FieldLabel } from './FieldLabel';
import { TemplateTextField } from './TemplateTextField';
import { TopoFieldPicker } from './TopoFieldPicker';
import { useZabbixItemCatalog, useZabbixMetricNames } from './zabbixSource';
import { Segmented } from './ui/Segmented';

/**
 * Controles do padrao "Dimension" (ADR-P04): um seletor fixo/field e o controle
 * de valor correspondente. Reaproveitados por todos os formularios do layer.
 */

const MODE_OPTIONS = [
  { label: 'Fixo', value: 'fixed' as const },
  { label: 'Field', value: 'field' as const },
];

interface TextDimensionFieldProps {
  /**
   * Omitido quando quem envolve o campo ja o rotulou — o `ToggleField`, por
   * exemplo, poe o nome na linha do switch. Repetir ali embaixo so ocupava
   * espaco dizendo a mesma coisa duas vezes.
   */
  label?: string;
  /** Dica do "i" ao lado do rotulo. */
  info?: string;
  /** Placeholder do modo Fixo. */
  placeholder?: string;
  frames: DataFrame[];
  value: TextDimension;
  /**
   * Troca o campo de uma linha pelo editor de template — texto de varias linhas
   * com `${nome do field}` e seletor de metrica.
   *
   * E opcional, e nao o padrao, porque nem todo texto do painel quer isso: o
   * texto do no e o nome do equipamento, e um textarea de tres linhas ali seria
   * espaco gasto para dizer uma palavra. A **resolucao** e a mesma nos dois
   * casos (`resolveText` interpola sempre); o que este sinalizador liga e a
   * ferramenta para escrever o template, nao a capacidade de ter um.
   */
  template?: boolean;
  onChange: (next: TextDimension) => void;
}

export function TextDimensionField({
  label,
  info,
  placeholder,
  frames,
  value,
  template,
  onChange,
}: TextDimensionFieldProps) {
  const doZabbix = useZabbixMetricNames();
  const catalogo = useZabbixItemCatalog();

  return (
    <Field label={label && <FieldLabel info={info}>{label}</FieldLabel>}>
      <Stack direction="column" gap={1}>
        <Segmented
          options={MODE_OPTIONS}
          value={value.mode}
          onChange={(mode) => onChange({ ...value, mode })}
          size="sm"
          fullWidth
        />
        {value.mode === 'fixed' ? (
          template ? (
            <TemplateTextField
              frames={frames}
              value={value.fixed ?? ''}
              placeholder={'Texto. Ex.: Status: ${oper status}'}
              aria-label="Texto"
              onChange={(fixed) => onChange({ ...value, fixed })}
            />
          ) : (
            <Input
              value={value.fixed ?? ''}
              onChange={(event) => onChange({ ...value, fixed: event.currentTarget.value })}
              placeholder={placeholder ?? 'Texto'}
            />
          )
        ) : (
          <TopoFieldPicker
            frames={frames}
            extras={doZabbix}
            loadExtras={catalogo}
            value={value.field}
            onChange={(field) => onChange({ ...value, field })}
            placeholder="Escolha um field"
            filter={isDisplayableField}
          />
        )}
      </Stack>
    </Field>
  );
}
