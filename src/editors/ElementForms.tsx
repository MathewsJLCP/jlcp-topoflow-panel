import React from 'react';
import { css } from '@emotion/css';
import { DataFrame, FieldType, GrafanaTheme2, SelectableValue } from '@grafana/data';
import { ColorPicker, Combobox, Field, Input, RadioButtonGroup, Slider, Switch, useStyles2 } from '@grafana/ui';

import { TOPO_ICONS, TopoIcon, TopoIconName, resolveTopoIcon } from '../canvas/icons';

import { updateEdge, updateNode, updatePoint, updatePostit, updateText } from '../model/mutations';
import { TopoEdge, TopoNode, TopoPoint, TopoPostit, TopoText, Topology } from '../model/types';
import { ColorDimensionField, TextDimensionField } from './DimensionFields';
import { ThresholdsField } from './ThresholdsField';
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
  const patchPresentation = (changes: Partial<TopoNode['presentation']>) =>
    patch({ presentation: { ...element.presentation, ...changes } });

  const { presentation } = element;

  return (
    <>
      <TextDimensionField
        label="Texto primário"
        frames={frames}
        value={presentation.primaryText}
        onChange={(primaryText) => patchPresentation({ primaryText })}
      />

      {/*
        Os campos opcionais do no sao governados pela **presenca do valor**, nao
        por uma flag separada: `secondaryText` e `value` ausentes ja significavam
        "desligado" no schema. Desligar o toggle apaga o campo — e o preco de nao
        ter um segundo estado para manter em sincronia. O que se perde e o texto
        digitado antes, nao a configuracao do no.
      */}
      <ToggleField
        label="Texto secundário"
        enabled={presentation.secondaryText !== undefined}
        onToggle={(on) => patchPresentation({ secondaryText: on ? { mode: 'fixed', fixed: '' } : undefined })}
      >
        <TextDimensionField
          label="Texto secundário"
          frames={frames}
          value={presentation.secondaryText ?? { mode: 'fixed', fixed: '' }}
          onChange={(secondaryText) => patchPresentation({ secondaryText })}
        />
      </ToggleField>

      <TriggerBindingField frames={frames} value={element.trigger} onChange={(trigger) => patch({ trigger })} />

      <ToggleField
        label="Valor exibido"
        enabled={element.value !== undefined}
        onToggle={(on) => patch({ value: on ? {} : undefined })}
      >
        <Field label="Valor exibido" description="Field cujo último valor aparece dentro do nó.">
          <TopoFieldPicker
            frames={frames}
            value={element.value?.field}
            onChange={(field) => patch({ value: { field } })}
            placeholder="Sem métrica"
            filter={numericOnly}
          />
        </Field>
      </ToggleField>

      <ToggleField
        label="Exibir ícone"
        enabled={presentation.showIcon}
        onToggle={(showIcon) => patchPresentation({ showIcon })}
      >
        <IconPicker value={presentation.icon} onChange={(icon) => patchPresentation({ icon })} />
      </ToggleField>

      {/*
        Decisao D5: com a fonte em Trigger, o bloco de estado por metrica sai da
        tela em vez de ficar desabilitado. A cor vem do mapa de severidade e
        nenhum controle daqui teria efeito — e um bloco inteiro acinzentado
        ocuparia mais espaco do que a informacao "nao se aplica" merece. A
        descricao do radio "Fonte de estado" ja explica a troca.
      */}
      {!element.trigger?.enabled && (
        <ThresholdsField
          frames={frames}
          color={element.color}
          thresholds={element.thresholds}
          onColorChange={(color) => patch({ color })}
          onThresholdsChange={(thresholds) => patch({ thresholds })}
        />
      )}

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

interface ToggleFieldProps {
  label: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  children: React.ReactNode;
}

/**
 * Campo opcional: um `Switch` com rotulo e, quando ligado, o controle de fato.
 *
 * O formulario do no acumulou campos que nem todo no usa. Todos visiveis o tempo
 * todo, o que e opcional fica indistinguivel do que e essencial — e o nome do no
 * (o unico campo obrigatorio) some no meio da lista. Com o toggle, o formulario
 * de um no simples ocupa quatro linhas.
 */
function ToggleField({ label, enabled, onToggle, children }: ToggleFieldProps) {
  const styles = useStyles2(getFormStyles);
  const id = React.useId();

  return (
    <div className={styles.toggleField}>
      <div className={styles.toggleRow}>
        <label className={styles.toggleLabel} htmlFor={id}>
          {label}
        </label>
        <Switch id={id} value={enabled} onChange={(event) => onToggle(event.currentTarget.checked)} />
      </div>

      {/* O rotulo ja esta na linha do switch; o do controle interno seria uma
          repeticao, entao ele e escondido do olho e mantido para o leitor de
          tela, que precisa do vinculo entre rotulo e campo. */}
      {enabled && <div className={styles.toggleBody}>{children}</div>}
    </div>
  );
}

interface IconPickerProps {
  value: string | undefined;
  onChange: (icon: TopoIconName) => void;
}

/**
 * Grade de icones em vez de um `Select` com nomes: escolher icone e uma decisao
 * visual, e ler "load-balancer" numa lista nao diz como o glifo se parece ao
 * lado dos outros nos da topologia.
 */
function IconPicker({ value, onChange }: IconPickerProps) {
  const styles = useStyles2(getFormStyles);
  const selected = resolveTopoIcon(value);

  return (
    <Field label="Ícone">
      <div className={styles.iconGrid}>
        {TOPO_ICONS.map(({ name, label }) => (
          <button
            key={name}
            type="button"
            className={styles.iconButton}
            data-selected={name === selected || undefined}
            title={label}
            aria-label={label}
            aria-pressed={name === selected}
            onClick={() => onChange(name)}
          >
            <TopoIcon name={name} size={20} />
          </button>
        ))}
      </div>
    </Field>
  );
}

const getFormStyles = (theme: GrafanaTheme2) => ({
  toggleField: css({
    marginBottom: theme.spacing(2),
  }),
  toggleRow: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
  }),
  toggleLabel: css({
    color: theme.colors.text.primary,
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
    cursor: 'pointer',
  }),
  toggleBody: css({
    marginTop: theme.spacing(1),
    // O rotulo do controle interno repete o do switch: fica so para o leitor de
    // tela. `label:first-of-type` nao serve — o `Field` do Grafana envolve o
    // rotulo numa `div`, entao o alvo e o primeiro filho.
    '& > div > label:first-of-type > div:first-of-type': {
      display: 'none',
    },
  }),
  iconGrid: css({
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(40px, 1fr))',
    gap: theme.spacing(0.5),
  }),
  iconButton: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: 36,
    padding: 0,
    background: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    color: theme.colors.text.secondary,
    cursor: 'pointer',

    '&:hover': {
      borderColor: theme.colors.border.medium,
      color: theme.colors.text.primary,
    },

    // Mesma leitura da selecao no canvas: 2px de `primary.main` (§7 do doc de
    // estilo). Aqui como borda, porque o botao ja tem uma para engrossar.
    '&[data-selected]': {
      borderColor: theme.colors.primary.main,
      boxShadow: `inset 0 0 0 1px ${theme.colors.primary.main}`,
      color: theme.colors.primary.main,
    },
  }),
});

/** Campos numericos vazios ou fora de faixa nao podem quebrar a validacao Zod. */
function toSize(raw: string, fallback: number): number {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function toFontSize(raw: string, fallback: number): number {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 8 && parsed <= 72 ? parsed : fallback;
}
