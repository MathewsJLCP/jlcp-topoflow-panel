import React from 'react';
import { DataFrame } from '@grafana/data';
import { ColorPicker, Field, Input, RadioButtonGroup, Stack } from '@grafana/ui';

import { ColorDimension, TextDimension } from '../model/types';
import { TopoFieldPicker } from './TopoFieldPicker';

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
  frames: DataFrame[];
  value: TextDimension;
  onChange: (next: TextDimension) => void;
}

export function TextDimensionField({ label, frames, value, onChange }: TextDimensionFieldProps) {
  return (
    <Field label={label}>
      <Stack direction="column" gap={1}>
        <RadioButtonGroup
          options={MODE_OPTIONS}
          value={value.mode}
          onChange={(mode) => onChange({ ...value, mode })}
          size="sm"
          fullWidth
        />
        {value.mode === 'fixed' ? (
          <Input
            value={value.fixed ?? ''}
            onChange={(event) => onChange({ ...value, fixed: event.currentTarget.value })}
            placeholder="Texto"
          />
        ) : (
          <TopoFieldPicker
            frames={frames}
            value={value.field}
            onChange={(field) => onChange({ ...value, field })}
            placeholder="Selecione um field"
          />
        )}
      </Stack>
    </Field>
  );
}

interface ColorDimensionFieldProps {
  label: string;
  frames: DataFrame[];
  value: ColorDimension;
  onChange: (next: ColorDimension) => void;
}

export function ColorDimensionField({ label, frames, value, onChange }: ColorDimensionFieldProps) {
  // `ColorDimension` nao guarda `mode`: `field` simplesmente ganha de `fixed`
  // quando presente. O modo do radio e derivado disso, e trocar para "Fixo"
  // limpa o field — senao o valor fixo escolhido nao teria efeito nenhum.
  const mode = value.field !== undefined ? 'field' : 'fixed';

  return (
    <Field label={label}>
      <Stack direction="column" gap={1}>
        <RadioButtonGroup
          options={MODE_OPTIONS}
          value={mode}
          onChange={(next) => onChange(next === 'fixed' ? { fixed: value.fixed ?? 'text' } : { ...value, field: '' })}
          size="sm"
          fullWidth
        />
        {mode === 'fixed' ? (
          <div>
            <ColorPicker color={value.fixed ?? 'text'} onChange={(color) => onChange({ ...value, fixed: color })} />
          </div>
        ) : (
          <TopoFieldPicker
            frames={frames}
            value={value.field || undefined}
            onChange={(field) => onChange({ ...value, field })}
            placeholder="Selecione um field"
          />
        )}
      </Stack>
    </Field>
  );
}
