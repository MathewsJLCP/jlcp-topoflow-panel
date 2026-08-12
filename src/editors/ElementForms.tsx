import React from 'react';
import { css } from '@emotion/css';
import { DataFrame, FieldType, GrafanaTheme2, SelectableValue } from '@grafana/data';
import {
  ColorPicker,
  Combobox,
  Field,
  Input,
  RadioButtonGroup,
  Select,
  Slider,
  Stack,
  useStyles2,
} from '@grafana/ui';

import { TOPO_ICONS, TopoIcon, TopoIconName, resolveTopoIcon } from '../canvas/icons';

import { updateEdge, updateNode, updatePoint, updatePostit, updateText } from '../model/mutations';
import { TextBackground, TopoEdge, TopoNode, TopoPoint, TopoPostit, TopoText, Topology } from '../model/types';
import { TextDimensionField } from './DimensionFields';
import { FieldLabel } from './FieldLabel';
import { FixedColorField } from './FixedColorField';
import { NumberField } from './NumberField';
import { StateSection } from './StateSection';
import { ToggleField } from './ToggleField';
import { TopoFieldPicker } from './TopoFieldPicker';

interface FormProps<T> {
  element: T;
  topology: Topology;
  frames: DataFrame[];
  onChange: (next: Topology) => void;
}

/** Metricas so fazem sentido sobre numeros. */
const numericOnly = (field: { type?: FieldType }) => field.type === FieldType.number;

export function NodeForm({ element, topology, frames, onChange }: FormProps<TopoNode>) {
  const styles = useStyles2(getFormStyles);
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
          frames={frames}
          value={presentation.secondaryText ?? { mode: 'fixed', fixed: '' }}
          onChange={(secondaryText) => patchPresentation({ secondaryText })}
        />
      </ToggleField>

      {/* As regras de estado sobem para junto do radio que as governa: com o
          bloco unico, "Estado" deixou de ficar numa ponta do formulario e os
          thresholds na outra, separados por campos que nao tem relacao com cor. */}
      <StateSection
        frames={frames}
        trigger={element.trigger}
        color={element.color}
        thresholds={element.thresholds}
        alert={element.alert}
        onTriggerChange={(trigger) => patch({ trigger })}
        onColorChange={(color) => patch({ color })}
        onThresholdsChange={(thresholds) => patch({ thresholds })}
        onAlertChange={(alert) => patch({ alert })}
      />

      <ToggleField
        label="Valor exibido"
        info="O último valor da métrica aparece dentro do nó."
        enabled={element.value !== undefined}
        onToggle={(on) => patch({ value: on ? {} : undefined })}
      >
        <TopoFieldPicker
          frames={frames}
          value={element.value?.field}
          onChange={(field) => patch({ value: { field } })}
          placeholder="Sem métrica"
          filter={numericOnly}
        />
      </ToggleField>

      <ToggleField
        label="Exibir ícone"
        enabled={presentation.showIcon}
        onToggle={(showIcon) => patchPresentation({ showIcon })}
      >
        <IconPicker value={presentation.icon} onChange={(icon) => patchPresentation({ icon })} />
      </ToggleField>

      {/* Largura e altura sao um par: lidas juntas, editadas juntas. Em linhas
          separadas gastavam duas alturas de campo para dizer o tamanho de uma
          caixa. `flex: 1` nos dois mantem as larguras iguais em qualquer painel,
          e `minWidth: 0` impede que o `Input` numerico se recuse a encolher. */}
      <Stack direction="row" gap={1}>
        <div className={styles.halfField}>
          <NumberField
            label="Largura"
            value={element.size.width}
            min={1}
            onChange={(width) => patch({ size: { ...element.size, width } })}
          />
        </div>
        <div className={styles.halfField}>
          <NumberField
            label="Altura"
            value={element.size.height}
            min={1}
            onChange={(height) => patch({ size: { ...element.size, height } })}
          />
        </div>
      </Stack>
    </>
  );
}

export function PointForm({ element, topology, frames, onChange }: FormProps<TopoPoint>) {
  const patch = (changes: Partial<TopoPoint>) => onChange(updatePoint(topology, element.id, changes));

  return (
    <StateSection
      frames={frames}
      trigger={element.trigger}
      color={element.color}
      thresholds={element.thresholds}
      alert={element.alert}
      onTriggerChange={(trigger) => patch({ trigger })}
      onColorChange={(color) => patch({ color })}
      onThresholdsChange={(thresholds) => patch({ thresholds })}
      onAlertChange={(alert) => patch({ alert })}
    />
  );
}

export function PostitForm({ element, topology, onChange }: FormProps<TopoPostit>) {
  const patch = (changes: Partial<TopoPostit>) => onChange(updatePostit(topology, element.id, changes));

  return (
    <>
      <Field label="Título">
        <Input value={element.title ?? ''} onChange={(event) => patch({ title: event.currentTarget.value })} />
      </Field>

      {/* Sem título não há tag para posicionar, e o campo só ocuparia espaço. */}
      {element.title && (
        <Field label="Posição do título">
          <RadioButtonGroup
            options={TITLE_POSITION_OPTIONS}
            value={element.titlePosition}
            onChange={(titlePosition) => patch({ titlePosition })}
            size="sm"
            fullWidth
          />
        </Field>
      )}

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
          fullWidth
        />
      </Field>

      <NumberField
        label="Espessura da borda"
        value={element.borderWidth}
        min={0}
        max={10}
        suffix="px"
        onChange={(borderWidth) => patch({ borderWidth })}
      />
    </>
  );
}

const BORDER_STYLE_OPTIONS: Array<SelectableValue<TopoPostit['borderStyle']>> = [
  { value: 'solid', label: 'Sólida' },
  { value: 'dashed', label: 'Tracejada' },
  { value: 'dotted', label: 'Pontilhada' },
];

/**
 * Rotulos curtos porque sao quatro num painel estreito: o `RadioButtonGroup`
 * truncaria "Superior esquerdo" antes de a segunda opcao caber.
 */
const TITLE_POSITION_OPTIONS: Array<SelectableValue<TopoPostit['titlePosition']>> = [
  { value: 'top-left', label: '↖', description: 'Superior esquerdo' },
  { value: 'top-right', label: '↗', description: 'Superior direito' },
  { value: 'bottom-left', label: '↙', description: 'Inferior esquerdo' },
  { value: 'bottom-right', label: '↘', description: 'Inferior direito' },
];

/**
 * Placa nova ja nasce visivel, mas discreta: `'text'` e nome de cor do tema, e
 * nao um hex, entao a placa acompanha claro/escuro em vez de congelar o tema em
 * que foi criada. Em 12% ela separa o texto do fundo sem virar caixa.
 */
const NEW_TEXT_BACKGROUND: TextBackground = { color: 'text', opacity: 0.12 };

export function TextForm({ element, topology, frames, onChange }: FormProps<TopoText>) {
  const patch = (changes: Partial<TopoText>) => onChange(updateText(topology, element.id, changes));
  const patchBackground = (changes: Partial<TextBackground>) =>
    patch({ background: { ...(element.background ?? NEW_TEXT_BACKGROUND), ...changes } });

  return (
    <>
      <TextDimensionField
        label="Conteúdo"
        frames={frames}
        value={element.content}
        onChange={(content) => patch({ content })}
      />

      {/* Sem seletor de field: o Texto e decorativo por decisao, e nao tem
          fonte de estado nenhuma — ver `topoTextSchema`. */}
      <FixedColorField value={element.color} onChange={(color) => patch({ color })} />

      {/* Ausencia do valor e o desligado, como nos campos opcionais do no. */}
      <ToggleField
        label="Background"
        info="Placa atrás do texto, para separá-lo de um canvas carregado."
        enabled={element.background !== undefined}
        onToggle={(on) => patch({ background: on ? NEW_TEXT_BACKGROUND : undefined })}
      >
        <Stack direction="column" gap={1}>
          <div>
            <ColorPicker
              color={element.background?.color ?? NEW_TEXT_BACKGROUND.color}
              onChange={(color) => patchBackground({ color })}
            />
          </div>
          <Slider
            min={0}
            max={1}
            step={0.05}
            value={element.background?.opacity ?? NEW_TEXT_BACKGROUND.opacity}
            onChange={(opacity) => patchBackground({ opacity })}
          />
        </Stack>
      </ToggleField>

      <NumberField
        label="Tamanho da fonte"
        value={element.fontSize}
        min={8}
        max={72}
        suffix="px"
        onChange={(fontSize) => patch({ fontSize })}
      />
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
      <Field label={<FieldLabel info="Texto fixo sobre a conexão. Não interpola valor de métrica.">Rótulo</FieldLabel>}>
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
      <StateSection
        frames={frames}
        trigger={element.trigger}
        color={element.color}
        thresholds={element.thresholds}
        alert={element.alert}
        // A aresta e um traco: nao ha superficie de onde emitir onda, e o radar
        // cairia na mesma respiracao do `pulse`. Melhor nao oferecer do que
        // oferecer e entregar outra coisa.
        allowRadar={false}
        onTriggerChange={(trigger) => patch({ trigger })}
        onColorChange={(color) => patch({ color })}
        onThresholdsChange={(thresholds) => patch({ thresholds })}
        onAlertChange={(alert) => patch({ alert })}
      />
    </>
  );
}

interface IconPickerProps {
  value: string | undefined;
  onChange: (icon: TopoIconName) => void;
}

/** Uma opcao por icone da biblioteca, na ordem de exibicao de `TOPO_ICONS`. */
const ICON_OPTIONS: Array<SelectableValue<TopoIconName>> = TOPO_ICONS.map(({ name, label }) => ({
  value: name,
  label,
}));

/**
 * Dropdown com o glifo desenhado na opcao e no valor escolhido.
 *
 * A grade de botoes que existia aqui defendia que escolher icone e uma decisao
 * visual — e e. Mas dez botoes de 36px ocupavam quatro linhas do painel para um
 * campo que se mexe uma vez na vida do elemento, e o `Select` nao abre mao do
 * glifo: `formatOptionLabel` desenha icone e nome nos dois lugares, entao a
 * comparacao visual continua possivel, so que sob demanda.
 *
 * A busca e a do proprio `Select`, que filtra por `label` — dai as opcoes
 * guardarem o nome em portugues em `label` e a chave em `value`. O que se
 * persiste continua sendo a chave (`presentation.icon`), inalterada.
 *
 * **Sobre o `Select` estar deprecado.** O substituto indicado e o `Combobox`,
 * usado em todo o resto deste painel — mas ele nao serve aqui: `ComboboxOption`
 * so aceita `icon?: IconName`, a lista fechada de icones do Grafana, e os nossos
 * sao SVGs proprios que existem exatamente porque aquela lista nao tem switch,
 * roteador nem firewall (ver `canvas/icons`). Com `Combobox` o dropdown perderia
 * o glifo e viraria uma lista de nomes — que era o argumento contra o dropdown
 * desde o inicio. Enquanto `formatOptionLabel` nao tiver equivalente no
 * `Combobox`, e `Select` ou nenhum icone.
 */
function IconPicker({ value, onChange }: IconPickerProps) {
  const inputId = React.useId();
  const selected = resolveTopoIcon(value);

  return (
    <Field label="Ícone" htmlFor={inputId}>
      {/* eslint-disable-next-line @typescript-eslint/no-deprecated -- ver o bloco acima */}
      <Select
        inputId={inputId}
        options={ICON_OPTIONS}
        value={ICON_OPTIONS.find((option) => option.value === selected)}
        onChange={(option) => onChange(resolveTopoIcon(option.value))}
        formatOptionLabel={(option) => (
          <Stack direction="row" alignItems="center" gap={1}>
            <TopoIcon name={resolveTopoIcon(option.value)} size={16} />
            <span>{option.label}</span>
          </Stack>
        )}
      />
    </Field>
  );
}

const getFormStyles = (theme: GrafanaTheme2) => ({
  /** Metade de uma linha de dois campos, em qualquer largura de painel. */
  halfField: css({
    flex: 1,
    minWidth: 0,
  }),
});

