import React from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, useTheme2 } from '@grafana/ui';
import { NodeProps, NodeResizeControl, ResizeControlVariant } from '@xyflow/react';

import { POSTIT_DEFAULT } from '../../model/sizes';
import { TopoPostit } from '../../model/types';
import { PostitFlowNode } from '../flowTypes';
import { FONT_SANS, TfPalette, resolveTfColor, tfMix, tfPalette } from '../../theme/palette';

/**
 * Postit: a area de agrupamento, no desenho do mockup.
 *
 * Retangulo de cantos 14px tingido pela cor (na opacidade escolhida), borda
 * solida, tracejada ou pontilhada, e o titulo numa etiqueta com um quadradinho
 * da cor — assentada **sobre** a borda, no canto escolhido. Selecionado no
 * editor, ganha as quatro alcas de canto.
 */
const CORNERS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const;

export function PostitNode({ data, selected }: NodeProps<PostitFlowNode>) {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const p = tfPalette(theme);
  const { element, editable } = data;

  const color = resolveTfColor(element.color, theme);

  return (
    <>
      {editable &&
        selected &&
        CORNERS.map((corner) => (
          <NodeResizeControl
            key={corner}
            position={corner}
            variant={ResizeControlVariant.Handle}
            minWidth={POSTIT_DEFAULT.minWidth}
            minHeight={POSTIT_DEFAULT.minHeight}
            className={styles.handle}
            style={{ background: p.ac, borderColor: p.fundo }}
          />
        ))}

      <div
        className={styles.wrapper}
        data-selected={selected || undefined}
        style={{
          background: tfMix(color, Math.round(element.opacity * 100)),
          border: `${element.borderWidth}px ${element.borderStyle} ${color}`,
        }}
      >
        {element.title && (
          <div className={styles.title} style={TITLE_POSITION[element.titlePosition]}>
            <span className={styles.swatch} style={{ background: color }} />
            <span className={styles.titleText}>{element.title}</span>
          </div>
        )}
      </div>
    </>
  );
}

const TITLE_POSITION: Record<TopoPostit['titlePosition'], React.CSSProperties> = {
  'top-left': { top: 0, left: 12, transform: 'translate(0, -50%)' },
  'top-right': { top: 0, right: 12, transform: 'translate(0, -50%)' },
  'bottom-left': { top: '100%', left: 12, transform: 'translate(0, -50%)' },
  'bottom-right': { top: '100%', right: 12, transform: 'translate(0, -50%)' },
};

const getStyles = (theme: GrafanaTheme2) => {
  const p: TfPalette = tfPalette(theme);
  return {
    wrapper: css({
      position: 'relative',
      width: '100%',
      height: '100%',
      minWidth: POSTIT_DEFAULT.minWidth,
      minHeight: POSTIT_DEFAULT.minHeight,
      borderRadius: 14,
      fontFamily: FONT_SANS,
      '&[data-selected]': { outline: `2px solid ${p.ac}`, outlineOffset: 3 },
    }),
    title: css({
      position: 'absolute',
      maxWidth: 'calc(100% - 24px)',
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '3px 9px',
      background: p.fundo,
      border: `1px solid ${p.borda}`,
      borderRadius: 6,
      whiteSpace: 'nowrap',
    }),
    swatch: css({ flex: 'none', width: 8, height: 8, borderRadius: 2 }),
    titleText: css({
      font: `600 12px ${FONT_SANS}`,
      color: p.tx,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    }),
    handle: css({
      '&&': {
        width: 12,
        height: 12,
        border: '2px solid',
        borderRadius: 3,
        zIndex: 2,
      },
    }),
  };
};
