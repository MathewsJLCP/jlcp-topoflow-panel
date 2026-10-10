/**
 * Os seis tons de um icone SVG, derivados da cor do estado.
 *
 * Porte direto de `TFIcons.tones` do mockup. Cada desenho do catalogo pinta suas
 * faces com `var(--tf-t1..t4)`, o detalhe com `--tf-ink` e o brilho com
 * `--tf-hl`; aqui saem os seis valores a partir de **uma** cor, em OKLCH, para
 * que o volume do desenho (topo claro, lateral escura) sobreviva a qualquer
 * matiz — vermelho de Disaster, ambar de Warning ou a Base que o usuario
 * escolheu.
 *
 * Sem cor (elemento neutro, sem dado), vale o azul padrao dos desenhos.
 */
export interface IconTones {
  t1: string;
  t2: string;
  t3: string;
  t4: string;
  ink: string;
  hl: string;
}

export const DEFAULT_TONES: IconTones = {
  t1: '#3ED6FF',
  t2: '#37BBEF',
  t3: '#2481BA',
  t4: '#1A6D96',
  ink: '#113B42',
  hl: '#D4F7FF',
};

const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const gam = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

function toLch(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const r = lin(((n >> 16) & 255) / 255);
  const g = lin(((n >> 8) & 255) / 255);
  const b = lin((n & 255) / 255);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return [L, Math.hypot(A, B), ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360];
}

function rgb(L: number, C: number, H: number): [number, number, number] {
  const a = C * Math.cos((H * Math.PI) / 180);
  const b = C * Math.sin((H * Math.PI) / 180);
  const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
  const m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
  const s = Math.pow(L - 0.0894841775 * a - 1.291485548 * b, 3);
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

/** Reduz o croma ate o tom caber no sRGB, em vez de saturar um canal. */
function fromLch(L: number, C: number, H: number): string {
  L = Math.max(0, Math.min(1, L));
  let c = C;
  let v = rgb(L, c, H);
  for (let i = 0; i < 24; i++) {
    v = rgb(L, c, H);
    if (v.every((x) => x >= -0.001 && x <= 1.001)) {
      break;
    }
    c *= 0.92;
  }
  return (
    '#' +
    v
      .map((x) =>
        Math.round(Math.max(0, Math.min(1, gam(Math.max(0, x)))) * 255)
          .toString(16)
          .padStart(2, '0')
      )
      .join('')
      .toUpperCase()
  );
}

/** `#RGB`/`#RRGGBB`/`#RRGGBBAA` -> `#RRGGBB`; qualquer outra coisa -> `undefined`. */
export function normalizeHex(color: string | undefined): string | undefined {
  const raw = color?.trim();
  if (!raw || raw[0] !== '#') {
    return undefined;
  }
  if (/^#[0-9a-f]{3}$/i.test(raw)) {
    return '#' + [1, 2, 3].map((i) => raw[i] + raw[i]).join('');
  }
  if (/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(raw)) {
    return raw.slice(0, 7);
  }
  return undefined;
}

const cache = new Map<string, IconTones>();

export function iconTones(color: string | undefined): IconTones {
  const hex = normalizeHex(color)?.toUpperCase();
  if (!hex || hex === DEFAULT_TONES.t2) {
    return DEFAULT_TONES;
  }

  const hit = cache.get(hex);
  if (hit) {
    return hit;
  }

  const [L, C, H] = toLch(hex);
  const tones: IconTones = {
    t1: fromLch(Math.min(0.94, L + 0.07), C, H),
    t2: hex,
    t3: fromLch(L - 0.17, C * 0.92, H + 5),
    t4: fromLch(L - 0.245, C * 0.8, H + 5),
    ink: fromLch(Math.min(0.32, L - 0.4), C * 0.4, H),
    hl: fromLch(0.955, Math.min(C * 0.3, 0.05), H),
  };
  cache.set(hex, tones);
  return tones;
}
