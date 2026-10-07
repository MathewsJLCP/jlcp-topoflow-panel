import React from 'react';
import { css } from '@emotion/css';
import { DataFrame, GrafanaTheme2, SelectableValue } from '@grafana/data';
import { ColorPicker, Combobox, Field, Input, RadioButtonGroup, Slider, Stack, useStyles2 } from '@grafana/ui';

import { isNumericField } from '../data/dimensions';
import { STARTER_ICON_REF, isKnownIcon } from '../icons';
import { IconToneChoice } from '../canvas/iconTone';
import { IconPicker } from './IconPicker';

import { updateEdge, updateImage, updateNode, updatePoint, updatePostit, updateText } from '../model/mutations';
import {
  ImageBackground,
  TextBackground,
  TopoEdge,
  TopoImage,
  TopoNode,
  TopoPoint,
  TopoPostit,
  TopoText,
  Topology,
} from '../model/types';
import { TextDimensionField } from './DimensionFields';
import { DrilldownField } from './DrilldownField';
import { FieldLabel } from './FieldLabel';
import { FixedColorField } from './FixedColorField';
import { ImageUploadField } from './ImageUploadField';
import { NumberField } from './NumberField';
import { StateSection } from './StateSection';
import { TemplateTextField } from './TemplateTextField';
import { ToggleField } from './ToggleField';
import { TopoFieldPicker } from './TopoFieldPicker';
import { useZabbixItemCatalog, useZabbixMetricNames } from './zabbixSource';

interface FormProps<T> {
  element: T;
  topology: Topology;
  frames: DataFrame[];
  onChange: (next: Topology) => void;
}

/** Metricas so fazem sentido sobre numeros. */

export function NodeForm({ element, topology, frames, onChange }: FormProps<TopoNode>) {
  const styles = useStyles2(getFormStyles);
  const metricasDoZabbix = useZabbixMetricNames();
  const catalogoDoZabbix = useZabbixItemCatalog();
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
        chart={element.chart}
        onChartChange={(chart) => patch({ chart })}
        onTriggerChange={(trigger) => patch({ trigger })}
        onColorChange={(color) => patch({ color })}
        onThresholdsChange={(thresholds) => patch({ thresholds })}
        onAlertChange={(alert) => patch({ alert })}
      />

      <ToggleField
        label="Exibir valor"
        info="O último valor da métrica aparece dentro do nó."
        enabled={element.value !== undefined}
        onToggle={(on) => patch({ value: on ? {} : undefined })}
      >
        <TopoFieldPicker
          frames={frames}
          extras={metricasDoZabbix}
          loadExtras={catalogoDoZabbix}
          value={element.value?.field}
          onChange={(field) => patch({ value: { field } })}
          placeholder="Sem métrica"
          filter={isNumericField}
        />
      </ToggleField>

      <ToggleField
        label="Exibir ícone"
        enabled={presentation.showIcon}
        onToggle={(showIcon) => patchPresentation({ showIcon })}
      >
        <IconPicker
          value={presentation.icon}
          onChange={(icon) => patchPresentation({ icon })}
          tone={presentation.iconTone}
          onToneChange={(iconTone) => patchPresentation({ iconTone })}
        />
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

      {/* Por ultimo, e nao junto do texto: o drill-down nao e uma propriedade do
          no, e o que acontece **depois** de ele estar pronto. */}
      <DrilldownField value={element.drilldown} onChange={(drilldown) => patch({ drilldown })} />
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
      chart={element.chart}
      onChartChange={(chart) => patch({ chart })}
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
        // O Texto e o outro lugar onde combinar palavra e metrica foi pedido.
        // O no ainda nao: la o texto e o nome do equipamento, e o campo curto de
        // uma linha continua sendo o certo para isso.
        template
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

      <DrilldownField value={element.drilldown} onChange={(drilldown) => patch({ drilldown })} />
    </>
  );
}

/**
 * Placa nova nasce ligada no modo solido e opaca: quem acabou de ligar o toggle
 * quer **ver** a placa. Um fundo a 12% num logo escuro nao se distingue de fundo
 * nenhum, e o usuario concluiria que o toggle nao funciona.
 */
const NEW_IMAGE_BACKGROUND: ImageBackground = { mode: 'fixed', color: 'text', opacity: 1 };

const BACKGROUND_MODE_OPTIONS = [
  { label: 'Sólido', value: 'fixed' as const },
  { label: 'Estado', value: 'state' as const },
];

const FIT_OPTIONS = [
  { label: 'Conter', value: 'contain' as const },
  { label: 'Cobrir', value: 'cover' as const },
  { label: 'Esticar', value: 'fill' as const },
];

/**
 * Imagem: arquivo, legenda com metrica e a placa opcional atras dela.
 *
 * A ordem dos campos e a da leitura — o que a imagem **e**, o que ela **diz**, e
 * so entao como ela **acende**. O bloco de estado inteiro (Metrica|Trigger,
 * campo, thresholds) vive dentro do modo `Estado` da placa, e nao solto no
 * formulario, porque fora dali ele nao teria onde pousar: sem placa, nao ha
 * superficie que possa mudar de cor.
 */
export function ImageForm({ element, topology, frames, onChange }: FormProps<TopoImage>) {
  const patch = (changes: Partial<TopoImage>) => onChange(updateImage(topology, element.id, changes));
  const patchBackground = (changes: Partial<ImageBackground>) =>
    patch({ background: { ...(element.background ?? NEW_IMAGE_BACKGROUND), ...changes } });

  const background = element.background;

  return (
    <>
      <ImageSourceField
        value={element.src}
        tone={element.iconTone}
        onChange={(src) => patch({ src })}
        onToneChange={(iconTone) => patch({ iconTone })}
      />

      <Field label={<FieldLabel info="Como a figura ocupa a caixa. Conter preserva a proporção.">Ajuste</FieldLabel>}>
        <RadioButtonGroup options={FIT_OPTIONS} value={element.fit} onChange={(fit) => patch({ fit })} fullWidth />
      </Field>

      <Field
        label={
          <FieldLabel info="Texto abaixo da imagem. Use ${nome do field} para exibir o valor de uma métrica.">
            Texto
          </FieldLabel>
        }
      >
        <TemplateTextField
          frames={frames}
          value={element.text ?? ''}
          placeholder={'Sem texto. Ex.: ${traffic in}'}
          aria-label="Texto"
          onChange={(text) => patch({ text: text || undefined })}
        />
      </Field>

      {/* Junto do campo que ele dimensiona, e nao no fim do formulario: a
          legenda e o tamanho dela sao a mesma decisao. */}
      <NumberField
        label="Tamanho da fonte"
        value={element.fontSize}
        min={8}
        max={72}
        suffix="px"
        onChange={(fontSize) => patch({ fontSize })}
      />

      {/* Ausencia do valor e o desligado, como nos demais campos opcionais. */}
      <ToggleField
        label="Background"
        info="Placa atrás da imagem. Sólida para identidade visual, ou pintada pelo estado da métrica/trigger."
        enabled={background !== undefined}
        onToggle={(on) => patch({ background: on ? NEW_IMAGE_BACKGROUND : undefined })}
      >
        <Stack direction="column" gap={1}>
          <RadioButtonGroup
            options={BACKGROUND_MODE_OPTIONS}
            value={background?.mode ?? NEW_IMAGE_BACKGROUND.mode}
            onChange={(mode) => patchBackground({ mode })}
            size="sm"
            fullWidth
          />

          {/*
            A cor solida so aparece no modo dela. No modo Estado quem escolhe a
            cor sao as regras — um seletor de cor ali ao lado sugeriria uma
            terceira fonte, que nao existe.
          */}
          {background?.mode !== 'state' && (
            <div>
              <ColorPicker
                enableNamedColors
                color={background?.color ?? NEW_IMAGE_BACKGROUND.color}
                onChange={(color) => patchBackground({ color })}
              />
            </div>
          )}

          <Field label="Opacidade">
            <Slider
              min={0}
              max={1}
              step={0.05}
              value={background?.opacity ?? NEW_IMAGE_BACKGROUND.opacity}
              onChange={(opacity) => patchBackground({ opacity })}
            />
          </Field>

          {background?.mode === 'state' && (
            <StateSection
              frames={frames}
              trigger={element.trigger}
              color={element.color}
              thresholds={element.thresholds}
              alert={element.alert}
              chart={element.chart}
              onChartChange={(chart) => patch({ chart })}
              onTriggerChange={(trigger) => patch({ trigger })}
              onColorChange={(color) => patch({ color })}
              onThresholdsChange={(thresholds) => patch({ thresholds })}
              onAlertChange={(alert) => patch({ alert })}
            />
          )}
        </Stack>
      </ToggleField>

      <DrilldownField value={element.drilldown} onChange={(drilldown) => patch({ drilldown })} />
    </>
  );
}

export const STYLE_OPTIONS = [
  { label: 'Sólida', value: 'solid' as const },
  { label: 'Tracejada', value: 'dashed' as const },
  { label: 'Pontilhada', value: 'dotted' as const },
];

export const SHAPE_OPTIONS = [
  { label: 'Curva', value: 'curved' as const },
  { label: 'Reta', value: 'straight' as const },
];

export const ANIMATION_OPTIONS = [
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
        <RadioButtonGroup
          options={STYLE_OPTIONS}
          value={element.style}
          onChange={(style) => patch({ style })}
          fullWidth
        />
      </Field>
      <Field label="Forma">
        <RadioButtonGroup
          options={SHAPE_OPTIONS}
          value={element.shape}
          onChange={(shape) => patch({ shape })}
          fullWidth
        />
      </Field>
      {/* Passo de 0.5 para que a espessura padrao (1.5) seja alcancavel. */}
      <Field label="Espessura">
        <Slider min={1} max={10} step={0.5} value={element.width} onChange={(width) => patch({ width })} />
      </Field>
      <Field
        label={
          <FieldLabel info="Texto sobre a conexão. Use ${nome do field} para exibir o valor de uma métrica, ou escolha uma no seletor abaixo.">
            Rótulo
          </FieldLabel>
        }
      >
        <TemplateTextField
          frames={frames}
          value={element.label ?? ''}
          placeholder={'Sem rótulo. Ex.: IN: ${traffic in}'}
          aria-label="Rótulo"
          onChange={(label) => patch({ label: label || undefined })}
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

/** Da biblioteca do plugin, ou um arquivo seu. */
const IMAGE_SOURCE_OPTIONS = [
  { label: 'Biblioteca', value: 'library' as const },
  { label: 'Arquivo ou URL', value: 'file' as const },
];

interface ImageSourceFieldProps {
  value: string;
  tone: IconToneChoice | undefined;
  onChange: (src: string) => void;
  onToneChange: (tone: IconToneChoice | undefined) => void;
}

/**
 * De onde vem a figura da Imagem: a biblioteca de icones ou um arquivo.
 *
 * O modo nao e campo do schema — o proprio `src` ja diz o que ele e (chave
 * conhecida do catalogo ou nao), e um campo separado seria uma segunda fonte de
 * verdade para a mesma pergunta, livre para discordar. O estado local aqui e so
 * o desempate do `src` vazio, que nao pertence a modo nenhum.
 *
 * **Trocar de modo escreve na hora.** A versao anterior so escrevia quando o
 * usuario escolhia algo, e o resultado era o radio dizendo "Biblioteca" com o
 * canvas ainda exibindo o upload — o modo e o desenho discordando ate o proximo
 * clique. Agora a troca leva o `src` junto: para a biblioteca vai o icone
 * padrao, e o desenho muda no mesmo instante em que o radio muda.
 *
 * Nada e perdido: o valor do modo que se abandona fica guardado em `parked`, e
 * voltar para ele o restaura. E a mesma garantia de alternar Metrica <->
 * Trigger, so que paga com memoria de sessao em vez de silencio.
 */
function ImageSourceField({ value, tone, onChange, onToneChange }: ImageSourceFieldProps) {
  const library = isKnownIcon(value);
  const [mode, setMode] = React.useState<'library' | 'file'>(library ? 'library' : 'file');

  /**
   * Ressincroniza quando o `src` muda por fora — undo do dashboard, Panel JSON,
   * ou o mesmo formulario reaproveitado para outro elemento. Sem isto o modo
   * ficava congelado na primeira montagem: era estado local respondendo a uma
   * pergunta cuja resposta esta nos dados. Ajuste durante o render, como no
   * `NumberField` e no `ElementsEditor`.
   */
  const [lastValue, setLastValue] = React.useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setMode(library ? 'library' : 'file');
  }

  /** O `src` do modo abandonado, para que ir e voltar nao custe o upload. */
  const parked = React.useRef<{ library?: string; file?: string }>({});

  const handleMode = (next: 'library' | 'file') => {
    if (next === mode) {
      return;
    }

    parked.current[mode] = value;
    const nextValue = next === 'library' ? (parked.current.library ?? STARTER_ICON_REF) : (parked.current.file ?? '');

    setMode(next);
    // Adianta o que o `onChange` vai trazer de volta: sem isto a ressincronia
    // acima dispararia um segundo `setMode` com o mesmo valor no proximo render.
    setLastValue(nextValue);
    onChange(nextValue);
  };

  return (
    <>
      <Field label={<FieldLabel info="Um ícone da biblioteca do plugin, ou uma imagem sua.">Figura</FieldLabel>}>
        <RadioButtonGroup options={IMAGE_SOURCE_OPTIONS} value={mode} onChange={handleMode} size="sm" fullWidth />
      </Field>

      {mode === 'library' ? (
        <IconPicker
          label="Ícone"
          value={isKnownIcon(value) ? value : undefined}
          onChange={onChange}
          tone={tone}
          onToneChange={onToneChange}
        />
      ) : (
        <ImageUploadField value={isKnownIcon(value) ? '' : value} onChange={onChange} />
      )}
    </>
  );
}

const getFormStyles = (theme: GrafanaTheme2) => ({
  /** Metade de uma linha de dois campos, em qualquer largura de painel. */
  halfField: css({
    flex: 1,
    minWidth: 0,
  }),
});
