import React from 'react';
import { DataFrame, FieldType, SelectableValue } from '@grafana/data';
import { ColorPicker, Combobox, Field, Input, RadioButtonGroup, Slider } from '@grafana/ui';

import { updateEdge, updateNode, updatePoint, updatePostit, updateText } from '../model/mutations';
import { TopoEdge, TopoNode, TopoPoint, TopoPostit, TopoText, Topology } from '../model/types';
import { ColorDimensionField, TextDimensionField } from './DimensionFields';
import { TopoFieldPicker } from './TopoFieldPicker';
import { TriggerBindingField } from './TriggerBindingFields';

interface FormProps<T> {
  element: T;
  topology: Topology;
  frames: DataFrame[];
  onChange: (next: Topology) => void;
}

/** Metricas so fazem sentido sobre numeros. */
const numericOnly = (field: { type?: FieldType }) => field.type === FieldType.number;

export function NodeForm({ element, topology, frames, onChange }: FormProps<TopoNode>) {
  const patch = (changes: Partial<TopoNode>) => onChange(updateNode(topology, element.id, changes));

  return (
    <>
      <TextDimensionField
        label="Texto primário"
        frames={frames}
        value={element.presentation.primaryText}
        onChange={(primaryText) => patch({ presentation: { ...element.presentation, primaryText } })}
      />
      <TextDimensionField
        label="Texto secundário"
        frames={frames}
        value={element.presentation.secondaryText ?? { mode: 'fixed', fixed: '' }}
        onChange={(secondaryText) => patch({ presentation: { ...element.presentation, secondaryText } })}
      />

      <TriggerBindingField frames={frames} value={element.trigger} onChange={(trigger) => patch({ trigger })} />

      <Field label="Valor exibido" description="Field cujo último valor aparece dentro do nó.">
        <TopoFieldPicker
          frames={frames}
          value={element.value?.field}
          onChange={(field) => patch({ value: { field } })}
          placeholder="Sem métrica"
          filter={numericOnly}
        />
      </Field>

      <ColorDimensionField
        label="Cor"
        frames={frames}
        value={element.color}
        onChange={(color) => patch({ color })}
      />

      <Field label="Largura">
        <Input
          type="number"
          value={element.size.width}
          onChange={(event) => patch({ size: { ...element.size, width: toSize(event.currentTarget.value, element.size.width) } })}
        />
      </Field>
      <Field label="Altura">
        <Input
          type="number"
          value={element.size.height}
          onChange={(event) => patch({ size: { ...element.size, height: toSize(event.currentTarget.value, element.size.height) } })}
        />
      </Field>
    </>
  );
}

export function PointForm({ element, topology, frames, onChange }: FormProps<TopoPoint>) {
  const patch = (changes: Partial<TopoPoint>) => onChange(updatePoint(topology, element.id, changes));

  return (
    <>
      <TriggerBindingField frames={frames} value={element.trigger} onChange={(trigger) => patch({ trigger })} />
      <ColorDimensionField label="Cor" frames={frames} value={element.color} onChange={(color) => patch({ color })} />
    </>
  );
}

export function PostitForm({ element, topology, onChange }: FormProps<TopoPostit>) {
  const patch = (changes: Partial<TopoPostit>) => onChange(updatePostit(topology, element.id, changes));

  return (
    <>
      <Field label="Título">
        <Input value={element.title ?? ''} onChange={(event) => patch({ title: event.currentTarget.value })} />
      </Field>

      {/* Sem seletor de field: postit e estatico por decisao do PRD, e o schema
          guarda a cor como string simples justamente para impedir o contrario. */}
      <Field label="Cor">
        <div>
          <ColorPicker color={element.color} onChange={(color) => patch({ color })} />
        </div>
      </Field>

      <Field label="Opacidade">
        <Slider min={0} max={1} step={0.05} value={element.opacity} onChange={(opacity) => patch({ opacity })} />
      </Field>

      <Field label="Borda">
        <RadioButtonGroup
          options={BORDER_STYLE_OPTIONS}
          value={element.borderStyle}
          onChange={(borderStyle) => patch({ borderStyle })}
        />
      </Field>
    </>
  );
}

const BORDER_STYLE_OPTIONS: Array<SelectableValue<TopoPostit['borderStyle']>> = [
  { value: 'solid', label: 'Sólida' },
  { value: 'dashed', label: 'Tracejada' },
  { value: 'dotted', label: 'Pontilhada' },
];

export function TextForm({ element, topology, frames, onChange }: FormProps<TopoText>) {
  const patch = (changes: Partial<TopoText>) => onChange(updateText(topology, element.id, changes));

  return (
    <>
      <TextDimensionField
        label="Conteúdo"
        frames={frames}
        value={element.content}
        onChange={(content) => patch({ content })}
      />
      <TriggerBindingField frames={frames} value={element.trigger} onChange={(trigger) => patch({ trigger })} />
      <ColorDimensionField label="Cor" frames={frames} value={element.color} onChange={(color) => patch({ color })} />
      <Field label="Tamanho da fonte">
        <Input
          type="number"
          value={element.fontSize}
          onChange={(event) => patch({ fontSize: toFontSize(event.currentTarget.value, element.fontSize) })}
        />
      </Field>
    </>
  );
}

const STYLE_OPTIONS = [
  { label: 'Sólida', value: 'solid' as const },
  { label: 'Tracejada', value: 'dashed' as const },
  { label: 'Pontilhada', value: 'dotted' as const },
];

const SHAPE_OPTIONS = [
  { label: 'Curva', value: 'curved' as const },
  { label: 'Reta', value: 'straight' as const },
];

const ANIMATION_OPTIONS = [
  { label: 'Nenhuma', value: 'none' as const },
  { label: 'Dash-flow', value: 'dash-flow' as const },
  { label: 'Flow', value: 'flow' as const },
  { label: 'Pulse', value: 'pulse' as const },
];

export function EdgeForm({ element, topology, frames, onChange }: FormProps<TopoEdge>) {
  const patch = (changes: Partial<TopoEdge>) => onChange(updateEdge(topology, element.id, changes));

  return (
    <>
      <Field label="Estilo">
        <RadioButtonGroup options={STYLE_OPTIONS} value={element.style} onChange={(style) => patch({ style })} fullWidth />
      </Field>
      <Field label="Forma">
        <RadioButtonGroup options={SHAPE_OPTIONS} value={element.shape} onChange={(shape) => patch({ shape })} fullWidth />
      </Field>
      {/* Passo de 0.5 para que a espessura padrao (1.5) seja alcancavel. */}
      <Field label="Espessura">
        <Slider min={1} max={10} step={0.5} value={element.width} onChange={(width) => patch({ width })} />
      </Field>
      <Field label="Rótulo" description="Texto fixo exibido sobre a conexão.">
        <Input
          value={element.label ?? ''}
          placeholder="Sem rótulo"
          onChange={(event) => patch({ label: event.currentTarget.value || undefined })}
        />
      </Field>
      <Field label="Animação">
        <Combobox
          options={ANIMATION_OPTIONS}
          value={element.animation}
          onChange={(selected) => patch({ animation: selected?.value ?? 'none' })}
        />
      </Field>
      <TriggerBindingField frames={frames} value={element.trigger} onChange={(trigger) => patch({ trigger })} />
      <ColorDimensionField label="Cor" frames={frames} value={element.color} onChange={(color) => patch({ color })} />
    </>
  );
}

/** Campos numericos vazios ou fora de faixa nao podem quebrar a validacao Zod. */
function toSize(raw: string, fallback: number): number {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function toFontSize(raw: string, fallback: number): number {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 8 && parsed <= 72 ? parsed : fallback;
}
