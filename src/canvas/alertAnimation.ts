import { css, keyframes } from '@emotion/css';

import { ElementColor } from '../data/elementColor';
import { AlertAnimation, ElementAlert } from '../model/types';
import { motionOnly } from './tokens';

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

const pulse = keyframes({
  '0%, 100%': { transform: 'scale(1)' },
  '50%': { transform: 'scale(1.04)' },
});

const blink = keyframes({
  '0%, 100%': { opacity: 1 },
  '50%': { opacity: 0.45 },
});

/** A aresta e um `<path>`: escalar deformaria o traco, entao ela so respira. */
const strokePulse = keyframes({
  '0%, 100%': { opacity: 1 },
  '50%': { opacity: 0.35 },
});

/**
 * Onda unica; duas delas, defasadas, viram o radar.
 *
 * Comeca no tamanho do elemento e cresce ate 1,7x, sumindo no caminho. Ja foi
 * 2,6x, e num card largo isso virava um circulo de meio milhar de pixels que
 * tomava a cena e cruzava os elementos vizinhos — o alcance da onda e
 * proporcional a **largura** do elemento, entao o mesmo numero que fica discreto
 * num point de 14px fica enorme num card de 200px.
 *
 * O `translate(-50%, -50%)` tem de aparecer em todos os passos porque ele e
 * parte do mesmo `transform` que a animacao substitui — omitir num passo faria a
 * onda saltar para o canto do elemento no meio do ciclo.
 */
const radarWave = keyframes({
  '0%': { transform: 'translate(-50%, -50%) scale(1)', opacity: 0.55 },
  '100%': { transform: 'translate(-50%, -50%) scale(1.7)', opacity: 0 },
});

/**
 * Encurtou junto com o alcance: mantendo os 2,4s originais sobre um trajeto 45%
 * menor, a onda passaria a rastejar. O que se quer preservar e a velocidade
 * aparente, nao a duracao.
 */
const RADAR_DURATION = '1.6s';

/**
 * Aneis do radar, desenhados em `::before` e `::after` do proprio elemento.
 *
 * Sem DOM extra: dois pseudo-elementos bastam, e o segundo entra na metade do
 * ciclo — uma onda so parece falha de render, duas leem como emissao continua.
 *
 * `aspect-ratio: 1` e o que os mantem **circulares** sobre um card retangular
 * (a decisao foi testar circular primeiro): a largura vem do elemento e a altura
 * a acompanha, em vez de virar uma elipse achatada de 200x60. `pointerEvents:
 * none` impede que os aneis roubem o clique do elemento que eles anunciam.
 */
const radar = css({
  '&::before, &::after': {
    content: '""',
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: '100%',
    aspectRatio: '1',
    border: '2px solid currentColor',
    borderRadius: '50%',
    opacity: 0,
    pointerEvents: 'none',
  },
  '@media (prefers-reduced-motion: no-preference)': {
    '&::before': { animation: `${radarWave} ${RADAR_DURATION} ease-out infinite` },
    '&::after': { animation: `${radarWave} ${RADAR_DURATION} ease-out infinite ${parseFloat(RADAR_DURATION) / 2}s` },
  },
});

const ELEMENT_CLASS: Record<AlertAnimation, string> = {
  pulse: motionOnly(`${pulse} 1.4s ease-in-out infinite`),
  blink: motionOnly(`${blink} 1.6s ease-in-out infinite`),
  radar,
};

/**
 * A aresta nao escala nem recebe anel: `pulse` e `radar` caem na respiracao do
 * traco. Nao e substituicao silenciosa — o editor so oferece `radar` para no e
 * point, e este mapa existe para o caso de uma topologia salva trazer a
 * combinacao mesmo assim.
 */
const EDGE_CLASS: Record<AlertAnimation, string> = {
  pulse: motionOnly(`${strokePulse} 1.4s ease-in-out infinite`),
  blink: motionOnly(`${blink} 1.6s ease-in-out infinite`),
  radar: motionOnly(`${strokePulse} 1.4s ease-in-out infinite`),
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
