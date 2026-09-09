import React from 'react';

import { IconTone, ResolvedIcon } from './types';

/**
 * Desenha um icone da biblioteca, nas duas naturezas.
 *
 * O **glifo** sai num `<svg>` com `stroke="currentColor"`: a cor vem de quem
 * renderiza, e e assim que o icone acompanha a cadeia de cor do elemento sem
 * saber nada sobre ela.
 *
 * A **figura** sai num `<img>` com `object-fit: contain`, e nao herda cor
 * nenhuma — nao existe como tingir arte colorida. Quem a usa precisa dar a ela
 * uma superficie legivel; no no, isso e a placa da capsula (ver `DeviceNode`).
 *
 * `aria-hidden` nos dois casos: o nome do ativo ja esta no texto do elemento, e
 * anunciar o glifo de novo so encheria o leitor de tela de ruido.
 */

interface TopoIconProps {
  icon: ResolvedIcon;
  /**
   * Qual variante desenhar, quando o icone tem varias. Ignorado pelas outras
   * naturezas — um glifo ja acompanha o estado pela cor herdada.
   */
  tone?: IconTone;
  /**
   * Numero de px, ou qualquer medida CSS. O `'100%'` e o que permite a um icone
   * da biblioteca preencher a caixa do elemento Imagem, que tem tamanho proprio.
   */
  size?: number | string;
  className?: string;
  style?: React.CSSProperties;
}

export function TopoIcon({ icon, tone, size = 20, className, style }: TopoIconProps) {
  const src = imageSrc(icon, tone);

  if (src !== undefined) {
    return (
      <img
        className={className}
        style={{ objectFit: 'contain', ...style }}
        src={src}
        width={size}
        height={size}
        alt=""
        draggable={false}
        aria-hidden
      />
    );
  }

  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      {icon.art.kind === 'glyph' ? icon.art.shape : null}
    </svg>
  );
}

/**
 * Arquivo a exibir, ou `undefined` quando a arte nao e figura.
 *
 * O tom pedido pode nao existir no icone — nem toda familia tem verde, por
 * exemplo. Nesse caso vale o tom base do proprio icone, e nao uma cor
 * aproximada: mostrar amarelo onde se pediu verde diria algo errado sobre o
 * estado, enquanto o base apenas nao diz nada.
 */
export function imageSrc(icon: ResolvedIcon, tone?: IconTone): string | undefined {
  if (icon.art.kind === 'image') {
    return icon.art.src;
  }

  if (icon.art.kind === 'variants') {
    const { tones, base } = icon.art;
    return (tone && tones[tone]) ?? tones[base] ?? Object.values(tones)[0];
  }

  return undefined;
}
