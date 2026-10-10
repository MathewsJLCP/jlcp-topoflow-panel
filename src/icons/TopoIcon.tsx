import React from 'react';

import { svgIconUri } from './svg';
import { ResolvedIcon } from './types';

/**
 * Desenha um icone da biblioteca: um `<img>` com data URI e os seis tons
 * derivados de `color` — sem cor, no azul padrao dos desenhos. `<img>`, e nao
 * inline, porque varios desenhos declaram `id` internos que colidiriam entre si
 * na pagina.
 *
 * `aria-hidden`: o nome do ativo ja esta no texto do elemento, e anunciar o
 * desenho de novo so encheria o leitor de tela de ruido.
 */

interface TopoIconProps {
  icon: ResolvedIcon;
  /** Cor do estado, em hex. Deriva os tons do desenho. */
  color?: string;
  /**
   * Numero de px, ou qualquer medida CSS. O `'100%'` e o que permite a um icone
   * da biblioteca preencher a caixa do elemento Imagem, que tem tamanho proprio.
   */
  size?: number | string;
  className?: string;
  style?: React.CSSProperties;
}

export function TopoIcon({ icon, color, size = 20, className, style }: TopoIconProps) {
  return (
    <img
      className={className}
      style={{ objectFit: 'contain', ...style }}
      src={svgIconUri(icon.ref, icon.art.viewBox, icon.art.body, color)}
      width={size}
      height={size}
      alt=""
      draggable={false}
      aria-hidden
      data-icon={icon.ref}
    />
  );
}
