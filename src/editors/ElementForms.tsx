import React from 'react';
import { css } from '@emotion/css';
import { DataFrame, GrafanaTheme2 } from '@grafana/data';
import { Field, Input, useStyles2 } from '@grafana/ui';

import { isNumericField } from '../data/dimensions';
import { STARTER_ICON_REF, isKnownIcon } from '../icons';
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
import { FONT_SANS, tfPalette } from '../theme/palette';
import { TextDimensionField } from './DimensionFields';
import { DrilldownField } from './DrilldownField';
import { FieldLabel } from './FieldLabel';
import { IconPicker } from './IconPicker';
import { ImageUploadField } from './ImageUploadField';
import { NumberField } from './NumberField';
import { StateSection } from './StateSection';
import { TemplateTextField } from './TemplateTextField';
import { ToggleField } from './ToggleField';
import { TopoFieldPicker } from './TopoFieldPicker';
import { useZabbixItemCatalog, useZabbixMetricNames } from './zabbixSource';
import { DashedButton, Note, SectionHead, TextLink } from './ui/Section';
import { Segmented } from './ui/Segmented';
import { TfColorRow, TfRange } from './ui/TfRange';
import { TfSelect } from './ui/TfSelect';

/**
 * Os formularios de cada tipo de elemento, no desenho do mockup: secoes com
 * titulo mono (Conteudo, Estado, Exibicao, Drill-down; Trajeto e Linha na
 * conexao; Figura na imagem), segmentados, chaves e faixas.
 */
interface FormProps<T> {
  element: T;
  topology: Topology;
  frames: DataFrame[];
  onChange: (next: Topology) => void;
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

export function NodeForm({ element, topology, frames, onChange }: FormProps<TopoNode>) {
  const styles = useStyles2(getFormStyles);
  const metricasDoZabbix = useZabbixMetricNames();
  const catalogoDoZabbix = useZabbixItemCatalog();
  const patch = (changes: Partial<TopoNode>) => onChange(updateNode(topology, element.id, changes));
  const patchPresentation = (changes: Partial<TopoNode['presentation']>) =>
    patch({ presentation: { ...element.presentation, ...changes } });

  const { presentation } = element;
  const value = element.value;
  const metricMode = !element.trigger?.enabled;
  // `fromState` ausente: ligado, a menos que haja o `field` unico de antes da v1.4.
  const fromState = value ? (value.fromState ?? !value.field) : false;
  const extras = value ? [...(value.field ? [value.field] : []), ...(value.fields ?? [])] : [];
  const writeExtras = (fields: string[]) => patch({ value: { ...value, field: undefined, fromState, fields } });

  return (
    <>
      <SectionHead>Conteúdo</SectionHead>
      <TextDimensionField
        label="Texto primário"
        info="Fixo ou o valor de um field. Nome nunca é truncado."
        frames={frames}
        value={presentation.primaryText}
        placeholder="Nome do equipamento"
        onChange={(primaryText) => patchPresentation({ primaryText })}
      />

      <ToggleField
        label="Texto secundário"
        description="Ex.: IP. Desligar apaga o conteúdo."
        enabled={presentation.secondaryText !== undefined}
        onToggle={(on) => patchPresentation({ secondaryText: on ? { mode: 'fixed', fixed: '' } : undefined })}
      >
        <TextDimensionField
          frames={frames}
          value={presentation.secondaryText ?? { mode: 'fixed', fixed: '' }}
          placeholder="Ex.: 10.0.0.1"
          onChange={(secondaryText) => patchPresentation({ secondaryText })}
        />
      </ToggleField>

      <StateSection
        frames={frames}
        trigger={element.trigger}
        color={element.color}
        thresholds={element.thresholds}
        extraMetrics={element.extraMetrics}
        alert={element.alert}
        isNode
        chart={element.chart}
        onChartChange={(chart) => patch({ chart })}
        onTriggerChange={(trigger) => patch({ trigger })}
        onColorChange={(color) => patch({ color })}
        onThresholdsChange={(thresholds) => patch({ thresholds })}
        onExtraMetricsChange={(extraMetrics) => patch({ extraMetrics })}
        onMetricsChange={(next) => patch(next)}
        onAlertChange={(alert) => patch({ alert })}
      />

      <SectionHead>Exibição</SectionHead>
      <ToggleField
        label="Exibir valor"
        description="Mostra o último valor das métricas no nó."
        enabled={value !== undefined}
        onToggle={(on) => patch({ value: on ? { fromState: true, fields: [] } : undefined })}
      >
        {metricMode && (
          <ToggleField
            label="Métricas do estado"
            description="Exibe as métricas configuradas em Estado."
            enabled={fromState}
            onToggle={(on) => patch({ value: { ...value, fromState: on } })}
          />
        )}

        {extras.map((field, index) => (
          <div key={index} className={styles.svRow}>
            <TopoFieldPicker
              frames={frames}
              extras={metricasDoZabbix}
              loadExtras={catalogoDoZabbix}
              value={field || undefined}
              onChange={(next) => writeExtras(extras.map((f, i) => (i === index ? (next ?? '') : f)))}
              placeholder="Escolha uma métrica"
              filter={isNumericField}
            />
            <button
              type="button"
              className={styles.x}
              title="Remover"
              aria-label={`Remover a métrica ${index + 1}`}
              onClick={() => writeExtras(extras.filter((_, i) => i !== index))}
            >
              ×
            </button>
          </div>
        ))}
        <DashedButton onClick={() => writeExtras([...extras, ''])}>+ Adicionar métrica</DashedButton>
        {!(fromState && metricMode) && extras.filter(Boolean).length === 0 && <Note>Nenhuma métrica para exibir.</Note>}
      </ToggleField>

      <ToggleField
        label="Exibir ícone"
        enabled={presentation.showIcon}
        onToggle={(showIcon) => patchPresentation({ showIcon })}
      >
        <IconPicker label="" value={presentation.icon} onChange={(icon) => patchPresentation({ icon })} />
      </ToggleField>

      <div className={styles.sizeBlock}>
        <span className={styles.sizeLabel}>
          <FieldLabel info="A altura é um mínimo: o nó cresce se o nome quebrar linha.">Tamanho</FieldLabel>
        </span>
        <div className={styles.pair}>
          <NumberField
            label="Largura"
            inline
            value={element.size.width}
            min={1}
            onChange={(width) => patch({ size: { ...element.size, width } })}
          />
          <NumberField
            label="Altura"
            inline
            value={element.size.height}
            min={1}
            onChange={(height) => patch({ size: { ...element.size, height } })}
          />
        </div>
      </div>

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
      extraMetrics={element.extraMetrics}
      alert={element.alert}
      chart={element.chart}
      onChartChange={(chart) => patch({ chart })}
      onTriggerChange={(trigger) => patch({ trigger })}
      onColorChange={(color) => patch({ color })}
      onThresholdsChange={(thresholds) => patch({ thresholds })}
      onExtraMetricsChange={(extraMetrics) => patch({ extraMetrics })}
      onMetricsChange={(next) => patch(next)}
      onAlertChange={(alert) => patch({ alert })}
    />
  );
}

const TITLE_POSITION_OPTIONS = [
  { value: 'top-left' as const, label: '↖ Sup.' },
  { value: 'top-right' as const, label: 'Sup. ↗' },
  { value: 'bottom-left' as const, label: '↙ Inf.' },
  { value: 'bottom-right' as const, label: 'Inf. ↘' },
];

export const STYLE_OPTIONS = [
  { label: 'Sólida', value: 'solid' as const },
  { label: 'Tracejada', value: 'dashed' as const },
  { label: 'Pontilhada', value: 'dotted' as const },
];

export function PostitForm({ element, topology, onChange }: FormProps<TopoPostit>) {
  const patch = (changes: Partial<TopoPostit>) => onChange(updatePostit(topology, element.id, changes));

  return (
    <>
      <Field label="Título">
        <Input
          value={element.title ?? ''}
          placeholder="Ex.: Filial Norte"
          onChange={(event) => patch({ title: event.currentTarget.value })}
        />
      </Field>

      {element.title && (
        <Field label="Posição do título">
          <Segmented
            options={TITLE_POSITION_OPTIONS}
            value={element.titlePosition}
            onChange={(titlePosition) => patch({ titlePosition })}
          />
        </Field>
      )}

      <TfColorRow label="Cor" color={element.color} onChange={(color) => patch({ color })} />

      <TfRange
        label="Opacidade"
        value={element.opacity}
        min={0}
        max={1}
        step={0.05}
        show={pct(element.opacity)}
        onChange={(opacity) => patch({ opacity })}
      />

      <Field label="Borda">
        <Segmented
          options={STYLE_OPTIONS}
          value={element.borderStyle}
          onChange={(borderStyle) => patch({ borderStyle })}
        />
      </Field>

      <NumberField
        label="Espessura da borda"
        inline
        value={element.borderWidth}
        min={0}
        max={10}
        suffix="px"
        onChange={(borderWidth) => patch({ borderWidth })}
      />
    </>
  );
}

/** A placa do texto, no mockup: escura e quase opaca, para separar o texto do canvas. */
const NEW_TEXT_BACKGROUND: TextBackground = { color: '#14141C', opacity: 0.8 };

export function TextForm({ element, topology, frames, onChange }: FormProps<TopoText>) {
  const patch = (changes: Partial<TopoText>) => onChange(updateText(topology, element.id, changes));
  const patchBackground = (changes: Partial<TextBackground>) =>
    patch({ background: { ...(element.background ?? NEW_TEXT_BACKGROUND), ...changes } });

  return (
    <>
      <TextDimensionField
        label="Conteúdo"
        info="Aceita ${field}."
        frames={frames}
        value={element.content}
        template
        onChange={(content) => patch({ content })}
      />

      <TfColorRow
        label="Cor"
        info="Cor fixa; nunca vem de dado."
        color={element.color.fixed ?? '#A8A8B3'}
        onChange={(fixed) => patch({ color: { ...element.color, fixed } })}
      />

      <ToggleField
        label="Background"
        description="Fundo para separar o texto de um canvas carregado."
        enabled={element.background !== undefined}
        onToggle={(on) => patch({ background: on ? NEW_TEXT_BACKGROUND : undefined })}
      >
        <TfColorRow
          label="Cor do fundo"
          color={element.background?.color ?? NEW_TEXT_BACKGROUND.color}
          onChange={(color) => patchBackground({ color })}
        />
        <TfRange
          label="Opacidade"
          value={element.background?.opacity ?? NEW_TEXT_BACKGROUND.opacity}
          min={0}
          max={1}
          step={0.05}
          show={pct(element.background?.opacity ?? NEW_TEXT_BACKGROUND.opacity)}
          onChange={(opacity) => patchBackground({ opacity })}
        />
      </ToggleField>

      <TfRange
        label="Tamanho da fonte"
        value={element.fontSize}
        min={8}
        max={72}
        step={1}
        show={`${element.fontSize} px`}
        onChange={(fontSize) => patch({ fontSize })}
      />

      <DrilldownField value={element.drilldown} onChange={(drilldown) => patch({ drilldown })} />
    </>
  );
}

/** O fundo do mockup: pela cor do estado, 22% de opacidade. */
const NEW_IMAGE_BACKGROUND: ImageBackground = { mode: 'state', color: '', opacity: 0.22 };

const FIT_OPTIONS = [
  { label: 'Conter', value: 'contain' as const },
  { label: 'Cobrir', value: 'cover' as const },
  { label: 'Esticar', value: 'fill' as const },
];

export function ImageForm({ element, topology, frames, onChange }: FormProps<TopoImage>) {
  const patch = (changes: Partial<TopoImage>) => onChange(updateImage(topology, element.id, changes));
  const patchBackground = (changes: Partial<ImageBackground>) =>
    patch({ background: { ...(element.background ?? NEW_IMAGE_BACKGROUND), ...changes } });

  const background = element.background;
  const library = isKnownIcon(element.src);

  return (
    <>
      <SectionHead>Figura</SectionHead>
      <ImageSourceField value={element.src} onChange={(src) => patch({ src })} />

      {!library && (
        <Field label="Ajuste">
          <Segmented options={FIT_OPTIONS} value={element.fit} onChange={(fit) => patch({ fit })} />
        </Field>
      )}

      <Field label={<FieldLabel info="Legenda abaixo da figura.">Texto</FieldLabel>}>
        <TemplateTextField
          frames={frames}
          value={element.text ?? ''}
          placeholder={'Sem texto. Ex.: ${traffic in}'}
          aria-label="Texto"
          onChange={(text) => patch({ text: text || undefined })}
        />
      </Field>

      <TfRange
        label="Tamanho da fonte"
        value={element.fontSize}
        min={8}
        max={72}
        step={1}
        show={`${element.fontSize} px`}
        onChange={(fontSize) => patch({ fontSize })}
      />

      <StateSection
        frames={frames}
        trigger={element.trigger}
        color={element.color}
        thresholds={element.thresholds}
        extraMetrics={element.extraMetrics}
        alert={element.alert}
        chart={element.chart}
        onChartChange={(chart) => patch({ chart })}
        onTriggerChange={(trigger) => patch({ trigger })}
        onColorChange={(color) => patch({ color })}
        onThresholdsChange={(thresholds) => patch({ thresholds })}
        onExtraMetricsChange={(extraMetrics) => patch({ extraMetrics })}
        onMetricsChange={(next) => patch(next)}
        onAlertChange={(alert) => patch({ alert })}
      />

      <ToggleField
        label="Background"
        description="Adiciona um fundo em volta da figura. A cor herda o estado."
        enabled={background !== undefined}
        onToggle={(on) => patch({ background: on ? NEW_IMAGE_BACKGROUND : undefined })}
      >
        {/* O modo solido e de antes da v1.4: quem o tem salvo continua podendo
            ajustar a cor, ou passar para o fundo pelo estado. */}
        {background?.mode === 'fixed' && (
          <>
            <TfColorRow
              label="Cor do fundo"
              color={background.color}
              onChange={(color) => patchBackground({ color })}
            />
            <TextLink onClick={() => patchBackground({ mode: 'state' })}>Usar a cor do estado</TextLink>
          </>
        )}
        <TfRange
          label="Opacidade do fundo"
          value={background?.opacity ?? NEW_IMAGE_BACKGROUND.opacity}
          min={0}
          max={1}
          step={0.05}
          show={pct(background?.opacity ?? NEW_IMAGE_BACKGROUND.opacity)}
          onChange={(opacity) => patchBackground({ opacity })}
        />
      </ToggleField>

      <DrilldownField value={element.drilldown} onChange={(drilldown) => patch({ drilldown })} />
    </>
  );
}

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
  const vertices = element.waypoints?.length ?? 0;

  return (
    <>
      <SectionHead>Trajeto</SectionHead>
      <Note>
        {vertices
          ? `${vertices} ${vertices > 1 ? 'vértices' : 'vértice'}. Arraste para mover. Duplo clique ou Delete remove.`
          : 'Linha direta. Arraste o + sobre a linha selecionada ou dê duplo clique nela para criar um vértice.'}
      </Note>
      {vertices > 0 && <TextLink onClick={() => patch({ waypoints: undefined })}>Limpar trajeto</TextLink>}

      <SectionHead>Linha</SectionHead>
      <Field label="Estilo">
        <Segmented options={STYLE_OPTIONS} value={element.style} onChange={(style) => patch({ style })} />
      </Field>
      {/* Com vertices a linha e uma polilinha: a forma nao se aplica. */}
      {vertices === 0 && (
        <Field label="Forma">
          <Segmented options={SHAPE_OPTIONS} value={element.shape} onChange={(shape) => patch({ shape })} />
        </Field>
      )}
      <TfRange
        label="Espessura"
        value={element.width}
        min={1}
        max={10}
        step={0.5}
        show={`${element.width} px`}
        onChange={(width) => patch({ width })}
      />
      <Field label={<FieldLabel info="Aceita várias linhas e preserva espaços.">Rótulo</FieldLabel>}>
        <TemplateTextField
          frames={frames}
          value={element.label ?? ''}
          placeholder={'Sem rótulo. Ex.: IN: ${traffic in}'}
          aria-label="Rótulo"
          onChange={(label) => patch({ label: label || undefined })}
        />
      </Field>
      <TfSelect
        label="Animação"
        info="Em alerta, a animação da regra substitui a de fluxo."
        value={element.animation}
        options={ANIMATION_OPTIONS}
        onChange={(animation) => patch({ animation })}
      />

      <StateSection
        frames={frames}
        trigger={element.trigger}
        color={element.color}
        thresholds={element.thresholds}
        extraMetrics={element.extraMetrics}
        alert={element.alert}
        allowRadar={false}
        showList={false}
        onTriggerChange={(trigger) => patch({ trigger })}
        onColorChange={(color) => patch({ color })}
        onThresholdsChange={(thresholds) => patch({ thresholds })}
        onExtraMetricsChange={(extraMetrics) => patch({ extraMetrics })}
        onMetricsChange={(next) => patch(next)}
        onAlertChange={(alert) => patch({ alert })}
      />
    </>
  );
}

interface ImageSourceFieldProps {
  value: string;
  onChange: (src: string) => void;
}

const IMAGE_SOURCE_OPTIONS = [
  { label: 'Biblioteca', value: 'library' as const },
  { label: 'Arquivo ou URL', value: 'file' as const },
];

/**
 * De onde vem a figura da Imagem: a biblioteca de icones ou um arquivo.
 *
 * O modo nao e campo do schema — o proprio `src` ja diz o que ele e. **Trocar
 * de modo escreve na hora**, e o valor do modo abandonado fica guardado em
 * `parked`: voltar para ele o restaura.
 */
function ImageSourceField({ value, onChange }: ImageSourceFieldProps) {
  const library = isKnownIcon(value);
  const [mode, setMode] = React.useState<'library' | 'file'>(library ? 'library' : 'file');

  // Ressincroniza quando o `src` muda por fora (undo, Panel JSON, outro elemento).
  const [lastValue, setLastValue] = React.useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setMode(library ? 'library' : 'file');
  }

  const parked = React.useRef<{ library?: string; file?: string }>({});

  const handleMode = (next: 'library' | 'file') => {
    if (next === mode) {
      return;
    }
    parked.current[mode] = value;
    const nextValue = next === 'library' ? (parked.current.library ?? STARTER_ICON_REF) : (parked.current.file ?? '');
    setMode(next);
    setLastValue(nextValue);
    onChange(nextValue);
  };

  return (
    <>
      <Field label={<FieldLabel info="Trocar de modo guarda o valor do outro.">Figura</FieldLabel>}>
        <Segmented options={IMAGE_SOURCE_OPTIONS} value={mode} onChange={handleMode} />
      </Field>

      {mode === 'library' ? (
        <IconPicker label="Ícone" value={isKnownIcon(value) ? value : undefined} onChange={onChange} />
      ) : (
        <ImageUploadField value={isKnownIcon(value) ? '' : value} onChange={onChange} />
      )}
    </>
  );
}

const getFormStyles = (theme: GrafanaTheme2) => {
  const p = tfPalette(theme);
  return {
    svRow: css({ display: 'flex', gap: 6, alignItems: 'center', '& > div': { flex: 1, minWidth: 0 } }),
    x: css({
      border: 0,
      background: 'transparent',
      color: p.apa,
      font: `15px ${FONT_SANS}`,
      cursor: 'pointer',
      padding: '0 2px',
    }),
    sizeBlock: css({ display: 'flex', flexDirection: 'column', gap: 6 }),
    sizeLabel: css({ font: `500 11.5px/1.35 ${FONT_SANS}`, color: p.rot }),
    pair: css({ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 8 }),
  };
};
