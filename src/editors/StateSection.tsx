import React from 'react';
import { css } from '@emotion/css';
import { DataFrame, GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { hasStateBinding } from '../data/dimensions';
import { severityRules } from '../data/thresholds';
import { ColorDimension, ElementAlert, ElementThresholds, MetricBinding, TriggerBinding } from '../model/types';
import { tfPalette } from '../theme/palette';
import { StateFieldPicker } from './StateFieldPicker';
import { BaseRow, ThresholdsEditor } from './ThresholdsEditor';
import { ToggleField } from './ToggleField';
import { TriggerBindingField } from './TriggerBindingFields';
import { DashedButton, Note, SectionHead } from './ui/Section';

/**
 * O bloco "Estado" do elemento, no desenho do mockup.
 *
 * Metrica | Trigger no topo. Em Metrica, uma ou mais metricas — cada uma com o
 * proprio campo e as proprias regras — e, com mais de uma, vence a regra de
 * maior gravidade. A Base vem ao pe, e o Grafico por ultimo. Em Trigger, o
 * vinculo, a escada de severidades e a Base.
 *
 * A primeira metrica e a de sempre (`color` + `thresholds`); as seguintes vivem
 * em `extraMetrics`. Alternar entre os modos nao apaga nada.
 */
interface StateSectionProps {
  frames: DataFrame[];
  trigger: TriggerBinding | undefined;
  color: ColorDimension;
  thresholds: ElementThresholds | undefined;
  extraMetrics?: MetricBinding[];
  alert: ElementAlert | undefined;
  allowRadar?: boolean;
  /** No: os formatos de problema de dentro do cartao. */
  isNode?: boolean;
  /** Conexao: sem lista de triggers ativas. */
  showList?: boolean;
  chart?: boolean;
  /** Ausente tira o toggle do Grafico (a conexao nao tem hover de grafico). */
  onChartChange?: (next: boolean | undefined) => void;
  onTriggerChange: (next: TriggerBinding) => void;
  onColorChange: (next: ColorDimension) => void;
  onThresholdsChange: (next: ElementThresholds | undefined) => void;
  /** Ausente, o elemento so tem uma metrica (edicao em massa). */
  onExtraMetricsChange?: (next: MetricBinding[] | undefined) => void;
  /**
   * Escrita atomica das tres partes das metricas — usada ao remover a primeira,
   * que reescreve `color`, `thresholds` e `extraMetrics` de uma vez (tres
   * escritas separadas partiriam todas do mesmo elemento, e so a ultima valeria).
   */
  onMetricsChange?: (next: {
    color: ColorDimension;
    thresholds: ElementThresholds | undefined;
    extraMetrics: MetricBinding[] | undefined;
  }) => void;
  onAlertChange: (next: ElementAlert | undefined) => void;
}

export function StateSection({
  frames,
  trigger,
  color,
  thresholds,
  extraMetrics = [],
  alert,
  allowRadar = true,
  isNode,
  showList = true,
  chart,
  onChartChange,
  onTriggerChange,
  onColorChange,
  onThresholdsChange,
  onExtraMetricsChange,
  onMetricsChange,
  onAlertChange,
}: StateSectionProps) {
  const styles = useStyles2(getStyles);
  const byMetric = !trigger?.enabled;
  const multi = extraMetrics.length > 0;

  const writeExtras = (next: MetricBinding[]) => onExtraMetricsChange?.(next.length ? next : undefined);

  const patchExtra = (index: number, changes: Partial<MetricBinding>) =>
    writeExtras(extraMetrics.map((metric, i) => (i === index ? { ...metric, ...changes } : metric)));

  /**
   * Remover a primeira metrica promove a segunda ao lugar dela. As regras de
   * severidade (do modo Trigger) moram no mesmo `thresholds` e ficam onde estao.
   */
  const removeFirst = () => {
    const [next, ...rest] = extraMetrics;
    const steps = [...severityRules(thresholds), ...next.steps];
    onMetricsChange?.({
      color: { fixed: color.fixed, field: next.field, metric: next.metric },
      thresholds: steps.length ? { steps } : undefined,
      extraMetrics: rest.length ? rest : undefined,
    });
  };

  return (
    <>
      <SectionHead>Estado</SectionHead>

      <TriggerBindingField
        frames={frames}
        value={trigger}
        onChange={onTriggerChange}
        isNode={isNode}
        showList={showList}
      />

      {byMetric && (
        <>
          <StateFieldPicker frames={frames} value={color} onChange={onColorChange} />
          <ThresholdsEditor
            axis="metric"
            color={color}
            thresholds={thresholds}
            alert={alert}
            allowRadar={allowRadar}
            showBase={false}
            onRemoveMetric={multi && onMetricsChange ? removeFirst : undefined}
            onColorChange={onColorChange}
            onThresholdsChange={onThresholdsChange}
            onAlertChange={onAlertChange}
          />

          {extraMetrics.map((metric, index) => {
            const dim: ColorDimension = { field: metric.field, metric: metric.metric };
            return (
              <React.Fragment key={index}>
                <div className={styles.sep} />
                <StateFieldPicker
                  frames={frames}
                  value={dim}
                  onChange={(next) => patchExtra(index, { field: next.field, metric: next.metric })}
                />
                <ThresholdsEditor
                  axis="metric"
                  color={dim}
                  thresholds={{ steps: metric.steps }}
                  allowRadar={allowRadar}
                  showBase={false}
                  onRemoveMetric={() => writeExtras(extraMetrics.filter((_, i) => i !== index))}
                  onColorChange={() => undefined}
                  onThresholdsChange={(next) => patchExtra(index, { steps: next?.steps ?? [] })}
                />
              </React.Fragment>
            );
          })}

          {onExtraMetricsChange && (
            <DashedButton wide onClick={() => writeExtras([...extraMetrics, { steps: [] }])}>
              + Adicionar métrica
            </DashedButton>
          )}

          {multi && (
            <Note>
              Com mais de uma métrica, vence a regra de maior gravidade: vermelho › laranja › âmbar › sem dados › azul ›
              verde.
            </Note>
          )}

          <BaseRow color={color} description="Cor quando nenhuma regra casa." onChange={onColorChange} />

          {onChartChange && (
            <ToggleField
              label="Gráfico"
              description="No hover, mostra as séries das métricas que definem o estado, na janela de tempo do dashboard."
              enabled={chart === true}
              onToggle={(on) => onChartChange(on || undefined)}
            >
              {!hasStateBinding(color) && !extraMetrics.some((m) => m.field || m.metric) && (
                <Note>Sem métrica escolhida, não há série para desenhar.</Note>
              )}
            </ToggleField>
          )}
        </>
      )}

      {!byMetric && (
        <ThresholdsEditor
          axis="trigger"
          color={color}
          thresholds={thresholds}
          alert={alert}
          allowRadar={allowRadar}
          onColorChange={onColorChange}
          onThresholdsChange={onThresholdsChange}
          onAlertChange={onAlertChange}
        />
      )}
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  sep: css({ height: 1, background: tfPalette(theme).linha, margin: '2px 0' }),
});
