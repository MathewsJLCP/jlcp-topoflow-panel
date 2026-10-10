import { createContext } from 'react';

/**
 * O elemento do canvas onde os popovers de hover sao desenhados.
 *
 * No mockup o popover vive **dentro** do canvas, ao lado do elemento, e se
 * encolhe para caber nele. Sem o canvas (testes, editor), o popover cai no
 * `document.body`.
 */
export const HoverLayerContext = createContext<HTMLElement | null>(null);
