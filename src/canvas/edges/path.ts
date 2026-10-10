/**
 * Geometria da conexao, no desenho do mockup (`connGeo`, `clip`, `labelPos`).
 *
 * Funcoes puras sobre caixas no espaco do canvas — nada de React Flow aqui, para
 * que o desenho seja testavel sem o contexto dele.
 *
 *   - a linha sai do **centro** de cada elemento e e recortada na borda dele,
 *     1.5px para fora (o point, num circulo de 9px);
 *   - **curva** e uma quadratica cujo controle fica a 20% do comprimento, para a
 *     esquerda do sentido origem -> destino;
 *   - **paralelas** (mais de uma conexao entre o mesmo par) se afastam 20px uma
 *     da outra, e o rotulo de cada uma vai para o lado de fora do par;
 *   - com **vertices**, a linha e uma polilinha: seta no fim e uma no meio de
 *     cada segmento (no segmento mais longo ela vai a 80%, para nao cair em cima
 *     do rotulo, que fica no meio dele).
 */
export interface Pt {
  x: number;
  y: number;
}

/** O que a linha precisa saber de cada ponta. */
export interface EndBox {
  cx: number;
  cy: number;
  w: number;
  h: number;
  /** Point: recorte circular de 9px. */
  round?: boolean;
  /**
   * Imagem sem fundo: distancia do centro ate 4px alem da tinta do desenho, na
   * direcao `(ux, uy)`. `undefined` cai na caixa.
   */
  silhouette?: (ux: number, uy: number) => number | undefined;
}

export interface Arrow extends Pt {
  /** Graus. */
  angle: number;
}

export interface Parallel {
  index: number;
  count: number;
  /** True quando o sentido da conexao e o canonico do par (id menor -> id maior). */
  canonical: boolean;
}

export interface EdgeGeometry {
  d: string;
  /** Setas: a do fim primeiro. */
  arrows: Arrow[];
  /** Pontos da polilinha (ou so as duas pontas, na linha direta), para os `+` de vertice. */
  points: Pt[];
  /** Meio da linha: onde o rotulo e o hover se ancoram. */
  mid: Pt;
  /** Posicao do rotulo (o meio, ou fora do par nas paralelas). */
  label: (lines: string[]) => Pt;
}

const MARGIN = 1.5;
const POINT_CLIP = 9;
export const PARALLEL_GAP = 20;
const CURVE_BEND = 0.2;

/** A ponta da linha: do centro de `a` em direcao a `toward`, recortada na borda de `a`. */
export function clip(a: EndBox, toward: Pt): Pt {
  const dx = toward.x - a.cx;
  const dy = toward.y - a.cy;
  if (!dx && !dy) {
    return { x: a.cx, y: a.cy };
  }
  if (a.round) {
    const len = Math.hypot(dx, dy);
    return { x: a.cx + (dx / len) * POINT_CLIP, y: a.cy + (dy / len) * POINT_CLIP };
  }
  if (a.silhouette) {
    const len = Math.hypot(dx, dy);
    const dist = a.silhouette(dx / len, dy / len);
    if (dist !== undefined) {
      return { x: a.cx + (dx / len) * dist, y: a.cy + (dy / len) * dist };
    }
  }
  const s = Math.min((a.w / 2 + MARGIN) / Math.abs(dx || 1e-9), (a.h / 2 + MARGIN) / Math.abs(dy || 1e-9));
  return { x: a.cx + dx * s, y: a.cy + dy * s };
}

const deg = (dy: number, dx: number) => (Math.atan2(dy, dx) * 180) / Math.PI;

export function edgeGeometry(
  source: EndBox,
  target: EndBox,
  shape: 'curved' | 'straight',
  waypoints: Pt[] | undefined,
  parallel: Parallel = { index: 0, count: 1, canonical: true }
): EdgeGeometry {
  const wps = (waypoints ?? []).filter(Boolean);

  if (wps.length) {
    const p1 = clip(source, wps[0]);
    const p2 = clip(target, wps[wps.length - 1]);
    const P = [p1, ...wps, p2];
    let longest = 0;
    let longestLen = -1;
    for (let i = 0; i < P.length - 1; i++) {
      const len = Math.hypot(P[i + 1].x - P[i].x, P[i + 1].y - P[i].y);
      if (len > longestLen) {
        longestLen = len;
        longest = i;
      }
    }
    const seg = (i: number) => ({ a: P[i], b: P[i + 1], angle: deg(P[i + 1].y - P[i].y, P[i + 1].x - P[i].x) });
    const last = seg(P.length - 2);
    const mids: Arrow[] = [];
    for (let i = 0; i < P.length - 2; i++) {
      const s = seg(i);
      const t = i === longest ? 0.8 : 0.5;
      mids.push({ x: s.a.x + (s.b.x - s.a.x) * t, y: s.a.y + (s.b.y - s.a.y) * t, angle: s.angle });
    }
    const ls = seg(longest);
    const mid = { x: (ls.a.x + ls.b.x) / 2, y: (ls.a.y + ls.b.y) / 2 };
    return {
      d: 'M' + P.map((p) => `${p.x},${p.y}`).join(' L'),
      arrows: [{ x: p2.x, y: p2.y, angle: last.angle }, ...mids],
      points: P,
      mid,
      label: () => mid,
    };
  }

  // Paralelas: as duas pontas andam juntas sobre a normal do sentido canonico.
  const A = { ...source };
  const B = { ...target };
  let normal = { x: 0, y: 0 };
  let side = 0;
  if (parallel.count > 1) {
    const ca = parallel.canonical ? source : target;
    const cb = parallel.canonical ? target : source;
    const ddx = cb.cx - ca.cx;
    const ddy = cb.cy - ca.cy;
    const len = Math.hypot(ddx, ddy) || 1;
    side = parallel.index - (parallel.count - 1) / 2;
    const off = side * PARALLEL_GAP;
    normal = { x: -ddy / len, y: ddx / len };
    A.cx += normal.x * off;
    A.cy += normal.y * off;
    B.cx += normal.x * off;
    B.cy += normal.y * off;
  }

  const p1 = clip(A, { x: B.cx, y: B.cy });
  const p2 = clip(B, { x: A.cx, y: A.cy });

  let d: string;
  let arrow: Arrow;
  let mid: Pt;
  if (shape === 'curved') {
    const mx = (p1.x + p2.x) / 2;
    const my = (p1.y + p2.y) / 2;
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy) || 1;
    const k = len * CURVE_BEND;
    const cx = mx - (dy / len) * k;
    const cy = my + (dx / len) * k;
    d = `M${p1.x},${p1.y} Q${cx},${cy} ${p2.x},${p2.y}`;
    arrow = { x: p2.x, y: p2.y, angle: deg(p2.y - cy, p2.x - cx) };
    mid = { x: 0.25 * p1.x + 0.5 * cx + 0.25 * p2.x, y: 0.25 * p1.y + 0.5 * cy + 0.25 * p2.y };
  } else {
    d = `M${p1.x},${p1.y} L${p2.x},${p2.y}`;
    arrow = { x: p2.x, y: p2.y, angle: deg(p2.y - p1.y, p2.x - p1.x) };
    mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
  }

  return {
    d,
    arrows: [arrow],
    points: [p1, p2],
    mid,
    label: (lines) => {
      if (parallel.count < 2 || !side) {
        return mid;
      }
      // Para fora do par: rotulo de linha quase vertical vai para o lado por
      // metade da largura do texto; de linha quase horizontal, por metade da altura.
      const h = lines.length * 15 + 8;
      const sg = Math.sign(side);
      const vertical = Math.abs(normal.x) > Math.abs(normal.y);
      const dd = vertical ? Math.max(...lines.map((l) => l.length)) * 3.4 + 16 : h / 2 + 12;
      return { x: mid.x + normal.x * sg * dd, y: mid.y + normal.y * sg * dd };
    },
  };
}

/** Distancia de `p` ao segmento `a`-`b`. Para achar onde um vertice novo entra. */
export function segmentDistance(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len));
  return Math.hypot(p.x - a.x - dx * t, p.y - a.y - dy * t);
}

/**
 * Onde um vertice clicado em `p` entra na lista: no segmento mais proximo da
 * polilinha `points` (pontas incluidas).
 */
export function waypointIndexAt(p: Pt, points: Pt[]): number {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < points.length - 1; i++) {
    const dist = segmentDistance(p, points[i], points[i + 1]);
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }
  return best;
}

/** Ponta de seta do mockup, com a ponta na origem, apontando para +x. */
export function arrowPath(width: number): string {
  const z = Math.max(5, width * 2.2);
  return `M${-z * 1.7},${-z * 0.75} L0,0 L${-z * 1.7},${z * 0.75} Z`;
}
