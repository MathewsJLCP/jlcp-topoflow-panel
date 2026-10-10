import { DataFrame, GrafanaTheme2, colorManipulator } from '@grafana/data';

import { AlertAnimation, ColorDimension, ElementThresholds, MetricBinding, TriggerBinding } from '../model/types';
import { resolveTfColor } from '../theme/palette';
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
  | { state: 'threshold'; color: string; label?: string; animation?: AlertAnimation; field?: string }
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
  /** Metricas de estado alem da primeira (v1.4). */
  extraMetrics?: MetricBinding[];
}

/** Uma metrica de estado: o vinculo dela e as regras que valem sobre ele. */
export interface StateMetric {
  dim: ColorDimension;
  thresholds?: ElementThresholds;
}

/**
 * As metricas que definem o estado, na ordem do editor: a primeira e a de
 * sempre (`color` + `thresholds`), as demais vem de `extraMetrics`.
 */
export function stateMetrics(dim: ColorDimension, sources: ElementStateSources = {}): StateMetric[] {
  return [
    { dim, thresholds: sources.thresholds },
    ...(sources.extraMetrics ?? []).map((metric) => ({
      dim: { field: metric.field, metric: metric.metric },
      thresholds: { steps: metric.steps },
    })),
  ];
}

export type MetricOutcome =
  | { kind: 'hit'; color: string; label?: string; animation?: AlertAnimation; field: string }
  | { kind: 'nodata' }
  | { kind: 'rest' };

/**
 * Uma metrica, sozinha — a mesma avaliacao que a cadeia sempre fez quando so
 * havia uma. `undefined` quando ela nem tem vinculo.
 */
export function evaluateMetric(
  metric: StateMetric,
  frames: DataFrame[],
  theme: GrafanaTheme2
): MetricOutcome | undefined {
  const { dim, thresholds } = metric;
  // `stateFieldName` e nao `dim.field`: a serie pode ter sido escolhida por
  // host+item no catalogo do Zabbix, e so ele sabe traduzir isso para o nome que
  // o frame usa.
  const fieldName = stateFieldName(dim, frames);
  if (!fieldName) {
    return undefined;
  }

  const hit = getLastNotNullValue(frames, fieldName);

  // Field ausente das series: nao ha valor nenhum a avaliar. Nao cai para
  // `fixed` nem para verde — sem dado precisa ser visivelmente diferente de
  // saudavel, senao um painel mudo passa por painel saudavel.
  if (!hit) {
    return { kind: 'nodata' };
  }

  // Field presente, sem valor util. A excecao e a regra `special`: quem
  // configurou um mapeamento para nulo ou NaN pediu explicitamente para
  // tratar a ausencia de dado, e o `nodata` generico atropelaria a escolha.
  const semDado = hit.value == null || !hit.field.display;
  if (semDado && !hasSpecialRule(thresholds)) {
    return { kind: 'nodata' };
  }

  if (hasOwnThresholds(thresholds)) {
    // Regra do elemento — a unica fonte de estado por metrica. Nenhuma regra
    // ativa significa "nao casou com nada", e nao "consulte o field": abaixo de
    // todas as regras o elemento esta em repouso, e repouso e a Base.
    const rule = resolveOwnThreshold(thresholds, hit.value);
    if (rule) {
      return {
        kind: 'hit',
        color: resolveTfColor(rule.color, theme),
        label: rule.label || undefined,
        // `severity` nao chega aqui — este ramo so ve regras de metrica —,
        // entao o acesso e seguro para todos os tipos que restam.
        animation: 'animation' in rule ? rule.animation : undefined,
        field: fieldName,
      };
    }

    // Nenhuma regra casou e nao ha dado: o estado volta a ser ausencia.
    if (semDado) {
      return { kind: 'nodata' };
    }
  }

  // Binding resolve mas nao ha regra que case: a metrica nao exibe estado.
  return { kind: 'rest' };
}

/**
 * Gravidade de uma cor de regra, pelo matiz — a ordem do mockup: vermelho ›
 * laranja › ambar › (sem dados) › azul › verde. Cinza e cores fora da escala
 * ficam junto do azul.
 *
 * E pelo matiz, e nao pela posicao da regra, porque com varias metricas as
 * regras de uma nao sabem das outras: "CPU >= 90 vermelho" e "Ping = 1 verde"
 * so se comparam pela cor que pedem.
 */
export function colorGravity(color: string): number {
  let rgb: number[];
  try {
    rgb = colorManipulator
      .decomposeColor(color)
      .values.slice(0, 3)
      .map((v: number) => v / 255);
  } catch {
    return 1.5;
  }
  const [r, g, b] = rgb;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d < 0.15) {
    return 1.5;
  }
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  if (h < 15 || h >= 330) {
    return 5;
  }
  if (h < 32) {
    return 4;
  }
  if (h < 62) {
    return 3;
  }
  if (h >= 75 && h < 175) {
    return 1;
  }
  if (h >= 185 && h < 265) {
    return 2;
  }
  return 1.5;
}

/** Abaixo disto a regra perde para "sem dados" de outra metrica. */
const NODATA_GRAVITY = 2.5;

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
        color: resolveTfColor(rule.color, theme),
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
  if (!trigger?.enabled) {
    let best: Extract<MetricOutcome, { kind: 'hit' }> | undefined;
    let nodata = false;

    for (const metric of stateMetrics(dim, sources)) {
      const outcome = evaluateMetric(metric, frames, theme);
      if (outcome?.kind === 'hit') {
        if (!best || colorGravity(outcome.color) > colorGravity(best.color)) {
          best = outcome;
        }
      } else if (outcome?.kind === 'nodata') {
        nodata = true;
      }
    }

    // Com varias metricas, vence a regra mais grave — mas uma metrica muda nao
    // pode ser escondida por um verde de outra: abaixo do ambar, "sem dados"
    // ganha. Com uma metrica so, isto e exatamente a cadeia de sempre.
    if (best && !(nodata && colorGravity(best.color) < NODATA_GRAVITY)) {
      return {
        state: 'threshold',
        color: best.color,
        label: best.label,
        animation: best.animation,
        field: best.field,
      };
    }

    if (nodata) {
      return { state: 'nodata' };
    }
  }

  if (dim.fixed) {
    return { state: 'fixed', color: resolveTfColor(dim.fixed, theme) };
  }

  return { state: 'neutral' };
}
