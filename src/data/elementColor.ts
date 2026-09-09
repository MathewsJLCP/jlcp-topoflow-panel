import { DataFrame, GrafanaTheme2 } from '@grafana/data';

import { AlertAnimation, ColorDimension, ElementThresholds, TriggerBinding } from '../model/types';
import { getLastNotNullValue, stateFieldName } from './dimensions';
import { Severity } from './problems';
import {
  hasDisabledSeverity,
  hasOwnThresholds,
  hasSpecialRule,
  isSeverityEnabled,
  resolveOwnThreshold,
  resolveSeverityRule,
} from './thresholds';
import { ActiveProblem, resolveTriggerState } from './triggerState';

/**
 * Cadeia de precedencia de cor (Anexo A do briefing do Bloco 1).
 *
 *   0. trigger do Zabbix alarmando  -> estado
 *   1. threshold proprio do elemento -> estado
 *   2. `color.fixed` (a linha Base)  -> identidade visual
 *   3. neutro do tema                -> fallback
 *
 * Nao existe quinto nivel, e **branco nao e fallback de nada**. Antes deste
 * helper o fallback era `getColorByName('text')`, que resolve para
 * `text.primary` — quase branco no dark. Era essa a causa de todo elemento novo
 * (no, point, texto e aresta) nascer branco.
 *
 * O nivel 0 nao concorre com o 1: com o vinculo de trigger **ligado**, o nivel 1
 * e pulado por inteiro. Sao duas fontes de estado, e deixar as duas ativas
 * significaria um elemento vermelho por CPU e verde por trigger ao mesmo tempo —
 * o operador nao teria como saber qual esta lendo. Nada e perdido: as duas
 * configuracoes continuam no JSON e voltam a valer ao desligar a flag.
 *
 * ## O pipeline nativo do Grafana nao pinta elemento (2026-09-02)
 *
 * Havia um nivel entre 1 e 2: sem regra propria, o elemento consultava os
 * thresholds do proprio field — os do painel de opcoes do Grafana. Ele existia
 * de quando o elemento **nao tinha** bloco de Thresholds proprio, e virou a
 * armadilha que a propria cadeia dizia querer evitar: a cor vinha de dois
 * lugares, e o bloco na tela do elemento perdia para uma configuracao que so
 * aparece em outro painel. Na pratica, uma Base laranja escolhida no elemento
 * era ignorada em favor do azul do step base do field.
 *
 * Hoje o que pinta um elemento e o que esta no bloco dele. Os thresholds do
 * field seguem valendo para o que sempre foram: **formatar o valor** e colorir o
 * grafico da metrica (`MetricChart` monta um timeseries nativo, com o pipeline
 * nativo inteiro). O que eles nao fazem mais e decidir a cor do elemento pelas
 * costas do editor.
 *
 * A consequencia a conhecer: um elemento que dependia do threshold do field para
 * acender passa a exibir a Base ate ganhar a regra equivalente no proprio bloco.
 *
 * Helper unico de proposito: cada elemento decide apenas em QUAL superficie a
 * cor pousa (A.2), nunca como ela e escolhida. Duplicar a decisao por
 * componente foi o que permitiu a divergencia original.
 */
export type ElementColor =
  /**
   * Trigger do Zabbix em PROBLEM. `label` e o nome da severidade, e `animation`
   * so existe quando a linha da escada que casou pediu movimento.
   *
   * `problems` traz **todas** as triggers alarmando, e nao so a que definiu a
   * cor: cor e severidade respondem "o quao ruim esta", a lista responde "o que
   * esta ruim". Sem ela, um elemento vermelho e um elemento vermelho por quinze
   * motivos sao indistinguiveis na tela.
   */
  | {
      state: 'trigger';
      color: string;
      severity: Severity;
      label: string;
      problems: ActiveProblem[];
      animation?: AlertAnimation;
    }
  /**
   * Threshold resolveu. `label` so existe quando a regra foi nomeada, e
   * `animation` so quando ela pediu movimento.
   */
  | { state: 'threshold'; color: string; label?: string; animation?: AlertAnimation }
  /** Binding configurado, sem dado que sirva. Distinto de saudavel (A.4). */
  | { state: 'nodata' }
  /** Acento estatico escolhido no editor. */
  | { state: 'fixed'; color: string }
  /** Sem binding e sem acento: o elemento nao exibe cor nenhuma. */
  | { state: 'neutral' };

/**
 * Cor a exibir, quando o estado carrega uma.
 *
 * `nodata` e `neutral` devolvem `undefined`: nao sao ausencia de cor por
 * descuido, sao estados cujo tratamento visual e decisao de cada elemento — o
 * point cai em `primary.main`, o texto em `text.primary`, a aresta em
 * `border.medium`. Um `??` no ponto de uso resolve isso sem esconder a regra.
 *
 * Existe para que os quatro consumidores nao repitam a lista de estados que
 * carregam cor. Era exatamente essa duplicacao que permitia a um elemento
 * reconhecer um estado novo e outro nao — o motivo de a decisao de cor ter sido
 * centralizada aqui desde o inicio.
 */
export function accentColor(accent: ElementColor): string | undefined {
  return accent.state === 'trigger' || accent.state === 'threshold' || accent.state === 'fixed'
    ? accent.color
    : undefined;
}

/**
 * As fontes de estado entram num objeto, e nao dentro de `ColorDimension`, nem
 * como parametros posicionais: nenhuma delas e uma forma de escolher cor — sao
 * regras com vida e persistencia proprias, e a lista tende a crescer. Opcional
 * para que todo elemento sem regra (e todo teste ja escrito) siga chamando com
 * tres argumentos.
 */
export interface ElementStateSources {
  trigger?: TriggerBinding;
  thresholds?: ElementThresholds;
}

export function resolveElementColor(
  dim: ColorDimension,
  frames: DataFrame[],
  theme: GrafanaTheme2,
  sources: ElementStateSources = {}
): ElementColor {
  const { trigger, thresholds } = sources;

  /**
   * O filtro so e montado quando ha o que filtrar: sem severidade desligada, a
   * escada inteira aceita e um predicado a mais so custaria uma chamada por
   * problema, em todo elemento de toda topologia.
   */
  const accepts = hasDisabledSeverity(thresholds) ? (s: Severity) => isSeverityEnabled(thresholds, s) : undefined;
  const alarm = resolveTriggerState(trigger, frames, theme, accepts);
  if (alarm) {
    /**
     * Regra propria de severidade vence o mapa do Zabbix — a mesma logica que
     * tirou o pipeline nativo da cadeia: quem escreveu regra para aquele
     * elemento tem autoridade sobre ele.
     *
     * O rotulo da regra e opcional; sem ele fica o nome da severidade, que e o
     * que o badge sempre mostrou. Trocar a cor nao deveria custar o nome do
     * estado.
     */
    const rule = resolveSeverityRule(thresholds, alarm.severity);
    if (rule) {
      return {
        state: 'trigger',
        color: theme.visualization.getColorByName(rule.color),
        severity: alarm.severity,
        label: rule.label || alarm.label,
        // A regra propria manda na cor e no rotulo do estado; ela nao tem
        // opiniao sobre quais triggers estao abertas.
        problems: alarm.problems,
        animation: rule.animation,
      };
    }

    return { state: 'trigger', ...alarm };
  }

  // Vinculo de trigger ligado desliga o nivel 1: sem isto, um elemento com
  // trigger OK voltaria a ser pintado pela metrica e a precedencia so valeria
  // durante o alarme — comportamento que muda sozinho conforme o Zabbix.
  // `stateFieldName` e nao `dim.field`: a serie pode ter sido escolhida por
  // host+item no catalogo do Zabbix, e so ele sabe traduzir isso para o nome que
  // o frame usa.
  const fieldName = stateFieldName(dim, frames);

  if (fieldName && !trigger?.enabled) {
    const hit = getLastNotNullValue(frames, fieldName);

    // Field ausente das series: nao ha valor nenhum a avaliar. Nao cai para
    // `fixed` nem para verde — sem dado precisa ser visivelmente diferente de
    // saudavel, senao um painel mudo passa por painel saudavel.
    if (!hit) {
      return { state: 'nodata' };
    }

    // Field presente, sem valor util. A excecao e a regra `special`: quem
    // configurou um mapeamento para nulo ou NaN pediu explicitamente para
    // tratar a ausencia de dado, e o `nodata` generico atropelaria a escolha.
    const semDado = hit.value == null || !hit.field.display;
    if (semDado && !hasSpecialRule(thresholds)) {
      return { state: 'nodata' };
    }

    if (hasOwnThresholds(thresholds)) {
      // 1. Regra do elemento — a unica fonte de estado por metrica. Nenhuma
      // regra ativa significa "nao casou com nada", e nao "consulte o field":
      // abaixo de todas as regras o elemento esta em repouso, e repouso e a
      // Base.
      const rule = resolveOwnThreshold(thresholds, hit.value);
      if (rule) {
        return {
          state: 'threshold',
          color: theme.visualization.getColorByName(rule.color),
          label: rule.label || undefined,
          // `severity` nao chega aqui — este ramo so ve regras de metrica —,
          // entao o acesso e seguro para todos os tipos que restam.
          animation: 'animation' in rule ? rule.animation : undefined,
        };
      }

      // Nenhuma regra casou e nao ha dado: o estado volta a ser ausencia.
      if (semDado) {
        return { state: 'nodata' };
      }
    }

    // Binding resolve mas nao ha regra de threshold definida: o elemento nao
    // exibe estado e a cadeia continua nos niveis 2 e 3.
  }

  if (dim.fixed) {
    return { state: 'fixed', color: theme.visualization.getColorByName(dim.fixed) };
  }

  return { state: 'neutral' };
}
