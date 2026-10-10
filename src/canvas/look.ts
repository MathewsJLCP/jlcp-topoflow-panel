import { GrafanaTheme2 } from '@grafana/data';

import { ElementColor } from '../data/elementColor';
import { AlertAnimation, ElementAlert } from '../model/types';
import { TfPalette, tfMix, tfPalette } from '../theme/palette';
import { severityOnColor, severityTfColor } from '../theme/severity';
import { resolveAlertAnimation } from './alertAnimation';

/**
 * Como cada estado aparece, nos termos do mockup (`nodeVM`, `bdgOf`, `paint`).
 *
 * A cadeia de cor (`elementColor`) decide **qual** estado vale; aqui se decide
 * **como ele pousa** — e de um jeito so para todos os elementos, porque cada
 * divergencia entre dois elementos parecidos sempre veio de decisao duplicada.
 *
 * Os estados do mockup e os da cadeia:
 *
 *   | mockup   | cadeia      |
 *   | -------- | ----------- |
 *   | `alarm`  | `trigger`   |
 *   | `rule`   | `threshold` |
 *   | `base`   | `fixed`     |
 *   | `nodata` | `nodata`    |
 *   | neutro   | `neutral`   |
 */
export type LookKind = 'neutral' | 'nodata' | 'base' | 'alarm';

export interface StateLook {
  kind: LookKind;
  /** Cor do estado. Ausente em neutro e sem dado. */
  color?: string;
  /** Texto sobre a cor cheia (o glifo do circulo de status, a pilula). */
  on: string;
  /** Disaster tem tratamento proprio: card mais saturado, borda mais grossa, `!!`. */
  disaster: boolean;
  animation?: AlertAnimation;
}

export function stateLook(accent: ElementColor, alert: ElementAlert | undefined, theme: GrafanaTheme2): StateLook {
  const p = tfPalette(theme);
  const animation = resolveAlertAnimation(accent, alert);

  switch (accent.state) {
    case 'trigger': {
      // A cor do mapa do Zabbix leva o `on-*` da severidade; uma cor trocada pela
      // escada propria leva o escuro, como no mockup.
      const native = accent.color === severityTfColor(accent.severity, theme);
      return {
        kind: 'alarm',
        color: accent.color,
        on: native ? severityOnColor(accent.severity, theme) : p['on-cr'],
        disaster: accent.severity === 5,
        animation,
      };
    }
    case 'threshold':
      return { kind: 'alarm', color: accent.color, on: p['on-cr'], disaster: false, animation };
    case 'fixed':
      return { kind: 'base', color: accent.color, on: p['on-cr'], disaster: false };
    case 'nodata':
      return { kind: 'nodata', on: p.tx2, disaster: false };
    default:
      return { kind: 'neutral', on: p.tx2, disaster: false };
  }
}

/** O circulo de status de 20px no canto do no (e sobre o desenho da Imagem). */
export interface StatusBadge {
  background: string;
  border: string;
  glyph: string;
  color: string;
}

export function statusBadge(look: StateLook, p: TfPalette, count?: number): StatusBadge {
  switch (look.kind) {
    case 'nodata':
      return { background: p.sup, border: `1.5px dashed ${p.apa}`, glyph: '–', color: p.tx2 };
    case 'base':
      return { background: look.color!, border: `2px solid ${p.fundo}`, glyph: '✓', color: p['on-cr'] };
    case 'alarm':
      return {
        background: look.color!,
        border: `2px solid ${p.fundo}`,
        glyph: count ? String(count) : look.disaster ? '!!' : '!',
        color: look.on,
      };
    default:
      return { background: p.sup, border: `1.5px solid ${p.linha}`, glyph: '', color: p.tx2 };
  }
}

/** Borda e fundo do cartao do no. */
export interface CardSurface {
  border: string;
  background: string;
}

export function nodeSurface(look: StateLook, p: TfPalette): CardSurface {
  switch (look.kind) {
    case 'nodata':
      return {
        border: `1.5px dashed ${p.apa}`,
        background: `repeating-linear-gradient(135deg, ${p.sup} 0 7px, ${p.elev} 7px 14px)`,
      };
    case 'base':
      return { border: `1.5px solid ${look.color}`, background: p.sup };
    case 'alarm':
      return {
        border: `${look.disaster ? 2.5 : 1.5}px solid ${look.color}`,
        background: tfMix(look.color!, look.disaster ? 30 : 12, p.sup),
      };
    default:
      return { border: `1px solid ${tfMix(p.rot, 55)}`, background: p.sup };
  }
}

/**
 * Cor do traco da conexao: a do estado, cinza apagado sem dado, `rot` em
 * repouso sem Base.
 */
export function strokeColor(look: StateLook, p: TfPalette): string {
  if (look.kind === 'nodata') {
    return p.apa;
  }
  return look.color ?? p.rot;
}
