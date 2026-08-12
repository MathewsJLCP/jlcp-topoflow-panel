import React from 'react';
import { DataFrame } from '@grafana/data';

import { ColorDimension, ElementAlert, ElementThresholds, TriggerBinding } from '../model/types';
import { AlertAnimationField } from './AlertAnimationField';
import { StateFieldPicker } from './StateFieldPicker';
import { ThresholdsEditor } from './ThresholdsEditor';
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
  onTriggerChange,
  onColorChange,
  onThresholdsChange,
  onAlertChange,
}: StateSectionProps) {
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
        so quais tipos de regra sao oferecidos — e a linha Base, que significa a
        mesma coisa nos dois (a cor quando nada esta acontecendo) e grava no
        mesmo `color.fixed` de sempre.

        Isso tambem dispensa o campo "Cor" que vivia solto aqui no modo Trigger:
        a Base cobre o mesmo dado, no mesmo lugar em que o modo Metrica ja o
        mostrava.
      */}
      <ThresholdsEditor
        axis={byMetric ? 'metric' : 'trigger'}
        color={color}
        thresholds={thresholds}
        onColorChange={onColorChange}
        onThresholdsChange={onThresholdsChange}
      />

      {/*
        So em modo Trigger nesta rodada. Em Metrica a pergunta "quando animar"
        ainda nao tem resposta: nem toda regra que casa e problema — uma regra
        `>= 0 -> verde` casa igual —, e animar "esta tudo bem" seria ruido.
      */}
      {!byMetric && <AlertAnimationField value={alert} onChange={onAlertChange} allowRadar={allowRadar} />}
    </>
  );
}

