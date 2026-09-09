import React from 'react';
import { css } from '@emotion/css';
import { DataFrame, GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { hasStateBinding } from '../data/dimensions';
import { ColorDimension, ElementAlert, ElementThresholds, TriggerBinding } from '../model/types';
import { StateFieldPicker } from './StateFieldPicker';
import { ThresholdsEditor } from './ThresholdsEditor';
import { ToggleField } from './ToggleField';
import { TriggerBindingField } from './TriggerBindingFields';

/**
 * Como o elemento decide a propria cor: a fonte do estado, a metrica observada e
 * as regras sobre ela.
 *
 * E um bloco so, e nao tres campos que cada formulario monta a seu gosto, porque
 * as tres pecas so fazem sentido juntas — foi montando-as separadamente que No,
 * Conexao e Point acabaram com tres comportamentos diferentes para a mesma
 * pergunta. Nó, Conexao e Point renderizam isto e mais nada sobre cor.
 */

interface StateSectionProps {
  frames: DataFrame[];
  trigger: TriggerBinding | undefined;
  color: ColorDimension;
  thresholds: ElementThresholds | undefined;
  alert: ElementAlert | undefined;
  /**
   * A aresta e um traco: nao ha superficie de onde emitir onda, e o radar cairia
   * na mesma respiracao do `pulse`. Melhor nao oferecer do que oferecer e
   * entregar outra coisa.
   */
  allowRadar?: boolean;
  /**
   * Grafico da metrica no hover. Ausente no elemento onde o toggle nao e
   * oferecido — hoje so a Conexao (ver o comentario no corpo).
   */
  chart?: boolean;
  onChartChange?: (next: boolean | undefined) => void;
  onTriggerChange: (next: TriggerBinding) => void;
  onColorChange: (next: ColorDimension) => void;
  onThresholdsChange: (next: ElementThresholds | undefined) => void;
  onAlertChange: (next: ElementAlert | undefined) => void;
}

export function StateSection({
  frames,
  trigger,
  color,
  thresholds,
  alert,
  allowRadar = true,
  chart,
  onChartChange,
  onTriggerChange,
  onColorChange,
  onThresholdsChange,
  onAlertChange,
}: StateSectionProps) {
  const styles = useStyles2(getStyles);
  const byMetric = !trigger?.enabled;

  return (
    <>
      <TriggerBindingField frames={frames} value={trigger} onChange={onTriggerChange} />

      {/* So o modo Metrica precisa saber qual field observar. */}
      {byMetric && <StateFieldPicker frames={frames} value={color} onChange={onColorChange} />}

      {/*
        O bloco de regras vale para os dois modos.

        Ele ja saiu da tela em modo Trigger, quando nao havia nada configuravel
        ali e a cor vinha inteira do mapa de severidade do Zabbix. Agora ha: uma
        regra de severidade sobrescreve aquele mapa. O que muda entre os modos e
        so a forma da lista — em Metrica o usuario inventa as regras, em Trigger
        elas sao as seis severidades do Zabbix — e a linha Base, que significa a
        mesma coisa nos dois (a cor quando nada esta acontecendo) e grava no
        mesmo `color.fixed` de sempre.

        Isso tambem dispensa o campo "Cor" que vivia solto aqui no modo Trigger:
        a Base cobre o mesmo dado, no mesmo lugar em que o modo Metrica ja o
        mostrava.

        E, desde que a escada de severidades ganhou coluna de animacao, dispensa
        tambem o "Animação de alerta" do elemento: ele perguntava "qual animacao,
        a partir de qual severidade", que e exatamente o que a escada responde
        linha a linha. O `alert` salvo entra aqui so para ser exibido e dobrado
        para dentro das regras na primeira edicao.
      */}
      <ThresholdsEditor
        axis={byMetric ? 'metric' : 'trigger'}
        color={color}
        thresholds={thresholds}
        alert={alert}
        allowRadar={allowRadar}
        onColorChange={onColorChange}
        onThresholdsChange={onThresholdsChange}
        onAlertChange={onAlertChange}
      />

      {/*
        O grafico e do modo Metrica e so dele.

        No modo Trigger nao existe field escolhido — nao ha serie para desenhar —
        e o hover do elemento ja tem dono: a lista de triggers em PROBLEM. Um
        toggle visivel ali prometeria um grafico que nunca apareceria.

        Fica por ultimo, depois das regras: ele nao participa da decisao de cor,
        e sim do que o operador ve ao se aproximar do elemento.

        `onChartChange` ausente e o que tira o toggle da Conexao — a aresta nao
        tem superficie de hover propria (o painel dela pendura no chip de alarme,
        que so existe alarmando), entao o grafico nao teria onde abrir.
      */}
      {byMetric && onChartChange && (
        <ToggleField
          label="Gráfico"
          info="Ao passar o mouse pelo elemento, mostra a série desta métrica na janela de tempo do dashboard."
          enabled={chart === true}
          // `undefined` e nao `false`: ausente ja significa desligado, e gravar
          // o valor explicito so encheria o JSON do dashboard.
          onToggle={(on) => onChartChange(on || undefined)}
        >
          {/* O toggle ligado sem field prometeria um grafico que nao vem. O
              aviso e do mesmo tipo do `hint` das regras de threshold. */}
          {!hasStateBinding(color) && (
            <div className={styles.hint}>Sem métrica escolhida, não há série para desenhar.</div>
          )}
        </ToggleField>
      )}
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  hint: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
});
