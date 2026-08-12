import React from 'react';
import { SelectableValue } from '@grafana/data';
import { Combobox, ComboboxOption, Field, Stack } from '@grafana/ui';

import { SEVERITY_LABEL } from '../data/problems';
import { AlertAnimation, ElementAlert, Severity } from '../model/types';
import { FieldLabel } from './FieldLabel';
import { ToggleField } from './ToggleField';

/**
 * Movimento do elemento enquanto o alarme durar.
 *
 * Segue o padrao dos campos opcionais do painel: a **presenca do valor** e o
 * liga-desliga, sem flag separada. Desligar apaga o objeto, e o elemento volta a
 * ficar parado.
 */

const ANIMATION_OPTIONS: Array<ComboboxOption<AlertAnimation>> = [
  { value: 'pulse', label: 'Pulsar', description: 'Cresce e volta, discreto' },
  { value: 'blink', label: 'Piscar', description: 'Respiração lenta de opacidade' },
  { value: 'radar', label: 'Radar', description: 'Ondas circulares saindo do elemento' },
];

const SEVERITY_OPTIONS: Array<SelectableValue<Severity>> = ([0, 1, 2, 3, 4, 5] as Severity[]).map((severity) => ({
  value: severity,
  label: SEVERITY_LABEL[severity],
}));

/** Alarme novo anima em qualquer severidade e pulsa: o efeito mais discreto. */
const NEW_ALERT: ElementAlert = { animation: 'pulse', fromSeverity: 0 };

interface AlertAnimationFieldProps {
  value: ElementAlert | undefined;
  allowRadar?: boolean;
  onChange: (next: ElementAlert | undefined) => void;
}

export function AlertAnimationField({ value, allowRadar = true, onChange }: AlertAnimationFieldProps) {
  const patch = (changes: Partial<ElementAlert>) => onChange({ ...(value ?? NEW_ALERT), ...changes });

  const options = allowRadar ? ANIMATION_OPTIONS : ANIMATION_OPTIONS.filter((option) => option.value !== 'radar');

  return (
    <ToggleField
      label="Animação de alerta"
      info="O elemento se mexe enquanto o alarme durar. Respeita a preferência do sistema por menos movimento."
      enabled={value !== undefined}
      onToggle={(on) => onChange(on ? NEW_ALERT : undefined)}
    >
      <Stack direction="column" gap={1}>
        <Combobox
          options={options}
          value={value?.animation ?? NEW_ALERT.animation}
          onChange={(option) => patch({ animation: option.value })}
        />

        <Field
          label={
            <FieldLabel info="Alarmes mais brandos que este não animam. Deixe em Not classified para animar qualquer um.">
              A partir de
            </FieldLabel>
          }
        >
          <Combobox
            options={SEVERITY_OPTIONS as Array<ComboboxOption<Severity>>}
            value={value?.fromSeverity ?? NEW_ALERT.fromSeverity}
            onChange={(option) => patch({ fromSeverity: option.value })}
          />
        </Field>
      </Stack>
    </ToggleField>
  );
}
