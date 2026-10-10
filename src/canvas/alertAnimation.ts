import { ElementColor } from '../data/elementColor';
import { AlertAnimation, ElementAlert } from '../model/types';
import { motionOnly, tfBreathe, tfPulse } from '../theme/motion';

/**
 * Movimento do elemento em alerta.
 *
 * Cor sozinha nao chama atencao num telao: dez elementos vermelhos parados nao
 * dizem qual acabou de cair. O movimento e o que separa "esta ruim" de "acabou
 * de ficar ruim".
 *
 * Duas restricoes moldaram tudo o que ha aqui:
 *
 *   - **So `transform` e `opacity`.** Sao as duas propriedades que o compositor
 *     resolve sozinho, sem recalculo de layout nem repintura. Animar `width`,
 *     `box-shadow` ou `background` seria mais facil de escrever e derrubaria o
 *     quadro numa topologia com dezenas de elementos alarmados ao mesmo tempo —
 *     que e exatamente o momento em que o painel precisa continuar fluido.
 *   - **Tudo sob `prefers-reduced-motion`**, via `motionOnly`.
 *
 * O `blink` nao pisca de verdade. Liga-desliga duro, repetido em varios
 * elementos num telao que fica aberto o dia inteiro, cansa e acaba fazendo o
 * operador desligar o painel — o oposto do objetivo. E uma respiracao lenta de
 * opacidade, que chama atencao sem irritar.
 */

/**
 * Pulsar e Piscar com os tempos do mockup. O **radar** nao e classe: e um anel
 * com a forma do elemento (cartao arredondado no no, circulo no point), entao
 * cada elemento desenha os proprios aneis com `RadarRings` — ver `radarColor`.
 */
const ELEMENT_CLASS: Partial<Record<AlertAnimation, string>> = {
  pulse: motionOnly(`${tfPulse} 1.4s ease-in-out infinite`),
  blink: motionOnly(`${tfBreathe} 2.6s ease-in-out infinite`),
};

/**
 * A aresta e um `<path>`: escalar deformaria o traco, entao ela so respira — mais
 * rapido no Pulsar, mais lento no Piscar, como no mockup. `radar` nao e oferecido
 * para conexao; o mapa existe para o caso de uma topologia salva trazer a
 * combinacao mesmo assim.
 */
const EDGE_CLASS: Record<AlertAnimation, string> = {
  pulse: motionOnly(`${tfBreathe} 1.1s ease-in-out infinite`),
  blink: motionOnly(`${tfBreathe} 2.6s ease-in-out infinite`),
  radar: motionOnly(`${tfBreathe} 1.1s ease-in-out infinite`),
};

/**
 * Qual animacao o elemento deve rodar, se alguma.
 *
 * Nos dois eixos ela vem da **regra que casou** — a faixa de metrica ou a linha
 * da escada de severidades —, entao cada uma anima do seu jeito: `>= 75` pulsa e
 * `> 90` faz radar, *High* pulsa e *Disaster* faz radar. Regra sem animacao nao
 * mexe nada, que e o default.
 *
 * Isso tambem responde sozinho a pergunta "quando animar", que e o que travava a
 * animacao no eixo de metrica: nem toda regra que casa e problema, e quem separa
 * as que sao e o usuario, marcando so as que importam.
 *
 * O `alert` e o campo aposentado do elemento (ver `elementAlertSchema`) e so
 * entra como ultimo recurso: uma topologia salva antes da escada continua
 * animando exatamente como animava, ate a primeira edicao da escada, que dobra o
 * campo para dentro das regras e o apaga.
 */
export function resolveAlertAnimation(
  accent: ElementColor,
  alert: ElementAlert | undefined
): AlertAnimation | undefined {
  if (accent.state === 'trigger') {
    return accent.animation ?? (alert && accent.severity >= alert.fromSeverity ? alert.animation : undefined);
  }

  return accent.state === 'threshold' ? accent.animation : undefined;
}

/** True quando o elemento deve se mexer, seja qual for a fonte. */
export function isAlerting(accent: ElementColor, alert: ElementAlert | undefined): boolean {
  return resolveAlertAnimation(accent, alert) !== undefined;
}

export function alertClass(accent: ElementColor, alert: ElementAlert | undefined): string | undefined {
  const animation = resolveAlertAnimation(accent, alert);
  return animation && ELEMENT_CLASS[animation];
}

export function edgeAlertClass(accent: ElementColor | undefined, alert: ElementAlert | undefined): string | undefined {
  const animation = accent && resolveAlertAnimation(accent, alert);
  return animation ? EDGE_CLASS[animation] : undefined;
}

/** True quando o elemento deve desenhar anéis de radar. */
export function isRadar(accent: ElementColor, alert: ElementAlert | undefined): boolean {
  return resolveAlertAnimation(accent, alert) === 'radar';
}
