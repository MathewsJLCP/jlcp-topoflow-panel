import { DataFrame, Field, GrafanaTheme2, ThresholdsMode, getActiveThreshold } from '@grafana/data';

import { AlertAnimation, ColorDimension, ElementThresholds, TriggerBinding } from '../model/types';
import { getLastNotNullValue } from './dimensions';
import { Severity } from './problems';
import { hasOwnThresholds, hasSpecialRule, resolveOwnThreshold, resolveSeverityRule } from './thresholds';
import { resolveTriggerState } from './triggerState';

/**
 * Cadeia de precedencia de cor (Anexo A do briefing do Bloco 1).
 *
 *   0.  trigger do Zabbix alarmando              -> estado
 *   1a. threshold proprio do elemento            -> estado
 *   1b. threshold do pipeline nativo do Grafana  -> estado
 *   2.  `color.fixed`                            -> identidade visual
 *   3.  neutro do tema                           -> fallback
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
 * Entre 1a e 1b vale a mesma logica de exclusao: o elemento que define regra
 * propria nao consulta mais o field. Sem isso, a cor viria de dois lugares e
 * descobrir de onde exigiria abrir o painel de opcoes do field.
 *
 * Helper unico de proposito: cada elemento decide apenas em QUAL superficie a
 * cor pousa (A.2), nunca como ela e escolhida. Duplicar a decisao por
 * componente foi o que permitiu a divergencia original.
 */
export type ElementColor =
  /** Trigger do Zabbix em PROBLEM. `label` e o nome da severidade. */
  | { state: 'trigger'; color: string; severity: Severity; label: string }
  /**
   * Threshold resolveu. `label` so existe quando o step foi nomeado, e
   * `animation` so quando a regra do elemento pediu movimento — o pipeline
   * nativo do Grafana nao tem esse campo, entao a cor vinda dele nunca anima.
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

  const alarm = resolveTriggerState(trigger, frames, theme);
  if (alarm) {
    /**
     * Regra propria de severidade vence o mapa do Zabbix — mesma logica do
     * nivel 1a em relacao ao 1b: quem escreveu regra para aquele elemento tem
     * autoridade sobre ele.
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
      };
    }

    return { state: 'trigger', ...alarm };
  }

  // Vinculo de trigger ligado desliga o nivel 1: sem isto, um elemento com
  // trigger OK voltaria a ser pintado pela metrica e a precedencia so valeria
  // durante o alarme — comportamento que muda sozinho conforme o Zabbix.
  if (dim.field && !trigger?.enabled) {
    const hit = getLastNotNullValue(frames, dim.field);

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
      // 1a. Regra do elemento. Nenhuma regra ativa significa "nao casou com
      // nada" — sem estado —, e nao "consulte o field": a regra propria e a
      // autoridade sobre aquele elemento.
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
    } else if (hit.field.display && hasCustomThresholds(hit.field)) {
      // 1b. Pipeline nativo, para quem nao definiu regra propria. O guard em
      // `display` e o que prova ao compilador que o caminho de "sem dado" ja
      // saiu daqui — so uma regra `special` chega ate aqui sem valor util, e
      // ela implica regra propria, tratada no ramo acima.
      const display = hit.field.display(hit.value);
      if (display.color) {
        return { state: 'threshold', color: display.color, label: thresholdLabel(hit.field, hit.value) };
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

/**
 * True quando o usuario definiu pelo menos um step alem do base.
 *
 * O step base e o unico com `value === -Infinity` (o Grafana o injeta em
 * `applyFieldOverrides` quando falta), entao contar os steps de valor finito
 * separa "tem regra" de "so tem o default".
 *
 * Sem esse corte, um field vinculado herdaria a cor do step base — verde — e
 * todo no com binding nasceria verde sem regra nenhuma configurada. Num NOC
 * verde significa "verificado OK"; verde por omissao e mentira operacional. No
 * instante em que o usuario cria o primeiro step, o comportamento volta a ser
 * 100% nativo do Grafana.
 */
function hasCustomThresholds(field: Field): boolean {
  return Boolean(field.config.thresholds?.steps.some((step) => Number.isFinite(step.value)));
}

/**
 * Rotulo do badge: so existe se o usuario nomeou o step (campo `state`).
 *
 * Restrito ao modo absoluto porque no modo percentual o step ativo depende do
 * min/max do field, que `getActiveThreshold` nao recebe. A cor continua certa
 * nos dois modos — ela vem de `field.display`, nao daqui.
 */
function thresholdLabel(field: Field, value: unknown): string | undefined {
  const thresholds = field.config.thresholds;
  if (typeof value !== 'number' || thresholds?.mode !== ThresholdsMode.Absolute) {
    return undefined;
  }
  return getActiveThreshold(value, thresholds.steps).state;
}
