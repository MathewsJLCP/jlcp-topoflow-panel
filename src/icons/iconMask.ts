import { useEffect, useState } from 'react';

import { svgIconUri } from './svg';
import { ResolvedIcon } from './types';

/**
 * A silhueta de um icone do catalogo — onde o desenho tem tinta.
 *
 * O mockup usa isso em dois lugares da Imagem sem fundo: o circulo de status
 * pousa no canto da **silhueta** (nao da caixa, que tem folga em volta do
 * desenho), e a conexao para a 4px da tinta, em vez de parar no ar onde a caixa
 * termina.
 *
 * O desenho e rasterizado uma vez, a 160px no lado maior, e o resultado fica em
 * cache por icone. Fora do navegador (jsdom), o `Image` nunca carrega e a
 * mascara simplesmente nao existe — quem usa cai na caixa.
 */
export interface IconMask {
  /** Dimensoes da rasterizacao. */
  w: number;
  h: number;
  /** 1 onde ha tinta (alfa > 40). */
  alpha: Uint8Array;
  /** Caixa da tinta, em px da rasterizacao. */
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

const SIDE = 160;
const masks = new Map<string, IconMask | 'loading' | 'failed'>();
const listeners = new Map<string, Set<() => void>>();

function load(icon: ResolvedIcon): void {
  if (icon.art.kind !== 'svg' || masks.has(icon.ref) || typeof Image === 'undefined') {
    return;
  }
  masks.set(icon.ref, 'loading');
  const { viewBox, body } = icon.art;
  const vb = viewBox.split(/[ ,]+/).map(Number);
  const img = new Image();
  img.onload = () => {
    try {
      const scale = SIDE / Math.max(vb[2], vb[3]);
      const w = Math.max(1, Math.round(vb[2] * scale));
      const h = Math.max(1, Math.round(vb[3] * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('sem contexto 2d');
      }
      ctx.drawImage(img, 0, 0, w, h);
      const px = ctx.getImageData(0, 0, w, h).data;
      const alpha = new Uint8Array(w * h);
      let x0 = w;
      let y0 = h;
      let x1 = 0;
      let y1 = 0;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (px[(y * w + x) * 4 + 3] > 40) {
            alpha[y * w + x] = 1;
            x0 = Math.min(x0, x);
            y0 = Math.min(y0, y);
            x1 = Math.max(x1, x);
            y1 = Math.max(y1, y);
          }
        }
      }
      masks.set(icon.ref, {
        w,
        h,
        alpha,
        bbox: x1 >= x0 ? { x0, y0, x1: x1 + 1, y1: y1 + 1 } : { x0: 0, y0: 0, x1: w, y1: h },
      });
    } catch {
      masks.set(icon.ref, 'failed');
    }
    listeners.get(icon.ref)?.forEach((notify) => notify());
  };
  img.onerror = () => masks.set(icon.ref, 'failed');
  img.src = svgIconUri(icon.ref, viewBox, body);
}

export function iconMask(icon: ResolvedIcon | undefined): IconMask | undefined {
  const mask = icon && masks.get(icon.ref);
  return typeof mask === 'object' ? mask : undefined;
}

/** A mascara do icone, carregando-a se preciso; re-renderiza quando ela chega. */
export function useIconMask(icon: ResolvedIcon | undefined): IconMask | undefined {
  const [, bump] = useState(0);
  const ref = icon?.ref;

  useEffect(() => {
    if (!icon || !ref) {
      return;
    }
    const notify = () => bump((n) => n + 1);
    const set = listeners.get(ref) ?? new Set();
    set.add(notify);
    listeners.set(ref, set);
    load(icon);
    return () => {
      set.delete(notify);
    };
    // `icon` muda de identidade a cada render; o que importa e a chave.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref]);

  return iconMask(icon);
}

/**
 * Onde o desenho fica dentro de uma caixa `w`x`h`, ocupando `fill` (fracao) de
 * cada lado, centralizado e contido — o mesmo `contain` do `<img>`.
 */
export function placeMask(mask: IconMask, w: number, h: number, fill: number) {
  const scale = Math.min((w * fill) / mask.w, (h * fill) / mask.h);
  const dw = mask.w * scale;
  const dh = mask.h * scale;
  return { x: (w - dw) / 2, y: (h - dh) / 2, scale };
}

/**
 * Da borda da caixa para dentro, o primeiro ponto com tinta na direcao de
 * `(ux, uy)` a partir do centro — e 4px alem dele. `undefined` se nao achar.
 */
export function silhouetteDistance(
  mask: IconMask,
  box: { w: number; h: number },
  fill: number,
  ux: number,
  uy: number
): number | undefined {
  const { x, y, scale } = placeMask(mask, box.w, box.h, fill);
  const cx = box.w / 2;
  const cy = box.h / 2;
  const start = Math.min(box.w / 2 / Math.abs(ux || 1e-9), box.h / 2 / Math.abs(uy || 1e-9));
  for (let t = start; t >= 0; t -= 1) {
    const mx = Math.floor((cx + ux * t - x) / scale);
    const my = Math.floor((cy + uy * t - y) / scale);
    if (mx >= 0 && my >= 0 && mx < mask.w && my < mask.h && mask.alpha[my * mask.w + mx]) {
      return t + 4;
    }
  }
  return undefined;
}
