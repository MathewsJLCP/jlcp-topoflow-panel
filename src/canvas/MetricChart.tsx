import React, { useMemo } from 'react';
import { css } from '@emotion/css';
import { DataFrame, Field, FieldType, GrafanaTheme2, getFieldDisplayName } from '@grafana/data';
import {
  AxisPlacement,
  GraphDrawStyle,
  GraphGradientMode,
  LegendDisplayMode,
  LineInterpolation,
  VisibilityMode,
} from '@grafana/schema';
import { TimeSeries, useStyles2 } from '@grafana/ui';

import { findFieldFrame, formatDisplayValue, resolveDisplayValue } from '../data/dimensions';
import { useTopoTime } from './timeContext';

/**
 * O grafico da metrica do elemento, dentro do painel de hover.
 *
 * ## O que ele plota
 *
 * A serie de `color.field` — a **mesma** metrica que decide a cor do elemento.
 * Nao ha segundo seletor de propósito: o grafico existe para responder "de onde
 * veio essa cor", e plotar outra serie transformaria o painel em dois numeros
 * sem nada dizendo qual e qual.
 *
 * ## A janela de tempo
 *
 * E a do dashboard, lida do contexto (`useTopoTime`). O grafico nao tem seletor
 * proprio nem intervalo fixo: quem mudou o time range do Grafana espera que
 * tudo na tela acompanhe, e um popup que ignora aquele controle mostraria um
 * periodo diferente do resto do dashboard sem avisar.
 *
 * ## Por que o frame e remontado
 *
 * O `TimeSeries` recebe uma serie de duas colunas — tempo e valor — construida
 * aqui, e nao o frame original. Dois motivos:
 *
 *   - o frame da query costuma trazer varias metricas, e todas apareceriam no
 *     grafico de um elemento que se vinculou a uma so;
 *   - `field.config.custom` chega **vazio**, porque `module.ts` chama
 *     `.useFieldConfig()` sem opcoes de grafico — e o `GraphNG` le dali como
 *     desenhar a linha. Sem preencher, a linha sairia com os defaults de um
 *     campo que ninguem configurou. Preenchendo, o traco e uma decisao nossa e
 *     nao um acidente.
 *
 * O que **nao** e reescrito: `unit`, `decimals`, `min`/`max`, thresholds e value
 * mappings do field original seguem valendo. Sao a configuracao do usuario, e o
 * eixo do grafico tem de falar a mesma lingua do valor que o elemento exibe.
 */

/** Cabe ao lado de um no sem cobrir o vizinho, e ainda mostra a forma da curva. */
const CHART_WIDTH = 320;
const CHART_HEIGHT = 140;

interface MetricChartProps {
  frames: DataFrame[];
  /** Display name do field, como em `color.field`. */
  field?: string;
}

export function MetricChart({ frames, field }: MetricChartProps) {
  const styles = useStyles2(getStyles);
  const { timeRange, timeZone } = useTopoTime();

  const hit = useMemo(() => findFieldFrame(frames, field), [frames, field]);
  const serie = useMemo(() => (hit ? toChartFrame(hit.frame, hit.field, frames) : undefined), [hit, frames]);

  // O ultimo valor no cabecalho: e o numero que o elemento esta exibindo, e ve-lo
  // ao lado da curva e o que liga o estado atual ao historico que o explica.
  const atual = useMemo(() => resolveDisplayValue(frames, field), [frames, field]);

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>{field}</span>
        {atual && <span className={styles.value}>{formatDisplayValue(atual)}</span>}
      </div>

      {serie ? (
        <TimeSeries
          frames={[serie]}
          width={CHART_WIDTH}
          height={CHART_HEIGHT}
          timeRange={timeRange}
          timeZone={timeZone}
          legend={{ showLegend: false, displayMode: LegendDisplayMode.List, placement: 'bottom', calcs: [] }}
        />
      ) : (
        <div className={styles.empty}>{motivo(hit, field)}</div>
      )}
    </div>
  );
}

/**
 * Por que nao ha curva. Sao tres ausencias diferentes, e dizer qual delas e
 * evita a busca no lugar errado — o vinculo, a query ou o tipo do dado.
 */
function motivo(hit: ReturnType<typeof findFieldFrame>, field?: string): string {
  if (!field) {
    return 'Nenhuma métrica vinculada a este elemento.';
  }
  if (!hit) {
    return 'A métrica não está nas séries deste painel.';
  }
  return 'A série não tem coluna de tempo — o gráfico precisa de uma.';
}

/**
 * Monta a serie de duas colunas que o grafico consome: o tempo do frame e o
 * field escolhido, este ultimo com a configuracao de desenho preenchida.
 *
 * `undefined` quando o frame nao tem coluna de tempo. Acontece com dados
 * tabulares (uma query de instantaneo, o frame de Problems do Zabbix): ha valor,
 * mas nao ha "ao longo de", e um grafico de um ponto so nao diz nada.
 */
export function toChartFrame(frame: DataFrame, field: Field, todos: DataFrame[]): DataFrame | undefined {
  const tempo = frame.fields.find((candidate) => candidate.type === FieldType.time);
  if (!tempo || field.type !== FieldType.number) {
    return undefined;
  }

  return {
    ...frame,
    fields: [
      tempo,
      {
        ...field,
        config: {
          ...field.config,
          // O nome de exibicao ja resolvido: o `GraphNG` o usa na legenda e no
          // proprio tooltip do grafico, e recalcula-lo dentro de um frame de
          // duas colunas daria outro nome — o field perderia a desambiguacao
          // por host que so existe olhando para todas as series.
          displayName: getFieldDisplayName(field, frame, todos),
          custom: CHART_FIELD_CONFIG,
        },
      },
    ],
    length: frame.length,
  };
}

/**
 * Como a linha e desenhada.
 *
 * Explicito porque `field.config.custom` chega vazio (ver o topo do arquivo), e
 * escolhido para um grafico de 320x140 dentro de um popup: linha fina com um
 * preenchimento leve embaixo — o suficiente para a forma da curva se ler de
 * relance —, sem pontos, que num espaco desses viram ruido. O eixo Y fica a
 * esquerda e o X aparece embaixo, que e o que responde "quando".
 */
const CHART_FIELD_CONFIG = {
  drawStyle: GraphDrawStyle.Line,
  lineInterpolation: LineInterpolation.Linear,
  lineWidth: 1,
  fillOpacity: 12,
  gradientMode: GraphGradientMode.None,
  showPoints: VisibilityMode.Never,
  pointSize: 4,
  axisPlacement: AxisPlacement.Auto,
  // Buraco na serie e buraco no grafico: emendar a linha por cima de uma coleta
  // que faltou esconderia justamente o que costuma explicar o alarme.
  spanNulls: false,
};

const getStyles = (theme: GrafanaTheme2) => ({
  panel: css({
    width: CHART_WIDTH,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
  }),
  header: css({
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
  }),
  title: css({
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
  value: css({
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamilyMonospace,
    fontWeight: theme.typography.fontWeightMedium,
    whiteSpace: 'nowrap',
  }),
  empty: css({
    height: CHART_HEIGHT,
    display: 'flex',
    alignItems: 'center',
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
});
