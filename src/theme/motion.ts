import { css, keyframes } from '@emotion/css';

/**
 * As animacoes do mockup, com os mesmos nomes e tempos.
 *
 *   - `pulse` (Pulsar) — o elemento cresce 5% e volta, 1.4s;
 *   - `breathe` (Piscar) — a opacidade cai a 40% e volta, 2.6s;
 *   - `radar` — um anel na forma do elemento se expande e some, 2s;
 *   - `radarPoint` — o mesmo, circular e mais longe, para o point;
 *   - `dash` — o tracejado correndo na aresta (Dash-flow);
 *   - `spin` — o indicador de "gerando imagem".
 *
 * Toda animacao passa por `motionOnly`: quem pediu menos movimento ao sistema
 * nao ve nenhuma. Num NOC o painel fica aberto o dia inteiro, e o custo de
 * esquecer seria pago pela pessoa errada.
 */
export const tfPulse = keyframes({
  '0%, 100%': { transform: 'scale(1)' },
  '50%': { transform: 'scale(1.05)' },
});

export const tfBreathe = keyframes({
  '0%, 100%': { opacity: 1 },
  '50%': { opacity: 0.4 },
});

export const tfRadar = keyframes({
  '0%': { transform: 'scale(1)', opacity: 0.75 },
  '100%': { transform: 'scale(1.35, 1.7)', opacity: 0 },
});

export const tfRadarPoint = keyframes({
  '0%': { transform: 'scale(1)', opacity: 0.8 },
  '100%': { transform: 'scale(3.2)', opacity: 0 },
});

export const tfDash = keyframes({
  to: { strokeDashoffset: -40 },
});

export const tfSpin = keyframes({
  to: { transform: 'rotate(360deg)' },
});

export function motionOnly(animation: string): string {
  return css({ '@media (prefers-reduced-motion: no-preference)': { animation } });
}
