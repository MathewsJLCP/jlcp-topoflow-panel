import React from 'react';
import { DataFrame, Field as DataField, FieldType } from '@grafana/data';
import { Field } from '@grafana/ui';

import { ColorDimension } from '../model/types';
import { FieldLabel } from './FieldLabel';
import { TopoFieldPicker } from './TopoFieldPicker';

/**
 * Metrica que alimenta o estado do elemento.
 *
 * Vive num componente proprio, e nao dentro do `ThresholdsEditor`, por causa de um
 * bug: era ali que ele morava, e o `ThresholdsEditor` so e renderizado pelo
 * formulario do no. Em Conexao e Point, escolher `Metrica` em **Estado** nao
 * trazia seletor nenhum a tela — o unico caminho para vincular o field era o
 * segundo radio, escondido dentro de "Cor", que grava neste mesmo `color.field`
 * mas se apresenta como escolha de cor.
 *
 * Grava em `color.field` (`colorDimensionSchema`), o campo de sempre. Nada foi
 * migrado: so passou a existir um controle unico para ele nos tres formularios.
 */

/** Metricas so fazem sentido sobre numeros. */
const numericOnly = (field: DataField) => field.type === FieldType.number;

interface StateFieldPickerProps {
  frames: DataFrame[];
  value: ColorDimension;
  onChange: (next: ColorDimension) => void;
}

export function StateFieldPicker({ frames, value, onChange }: StateFieldPickerProps) {
  return (
    <Field
      label={
        <FieldLabel info="Métrica que alimenta as regras de estado. Sem ela, o elemento não exibe estado.">
          Campo
        </FieldLabel>
      }
    >
      <TopoFieldPicker
        frames={frames}
        // String vazia e o que o radio de modo escreve ao trocar para "Field"
        // sem escolher nada; para o seletor isso e ausencia de valor.
        value={value.field || undefined}
        onChange={(field) => onChange({ ...value, field })}
        placeholder="Sem vínculo"
        filter={numericOnly}
      />
    </Field>
  );
}
