import React from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { useReactFlow } from '@xyflow/react';

import { TfPalette, tfPalette } from '../theme/palette';
import { tfSpin } from '../theme/motion';
import { ScreenshotButton, ShotResult } from './ScreenshotButton';

/**
 * A pilha de controles do canto inferior esquerdo, como no mockup: quadrados de
 * 32px colados (1px entre eles) — aproximar, afastar, enquadrar tudo e baixar a
 * imagem. Os desenhos sao de traco, em `tf`, sem icones do Grafana.
 */
interface Props {
  wrapperRef: React.RefObject<HTMLDivElement>;
  title?: string;
  onShot: (result: ShotResult) => void;
}

export function CanvasControls({ wrapperRef, title, onShot }: Props) {
  const styles = useStyles2(getStyles);
  const { zoomIn, zoomOut, fitView } = useReactFlow();

  return (
    <div className={`${styles.stack} topo-controls`} onMouseDown={(event) => event.stopPropagation()}>
      <button
        type="button"
        className={styles.button}
        title="Aproximar"
        aria-label="Aproximar"
        onClick={() => zoomIn({ duration: 350 })}
      >
        <span className={styles.plus}>
          <span />
          <span />
        </span>
      </button>
      <button
        type="button"
        className={styles.button}
        title="Afastar"
        aria-label="Afastar"
        onClick={() => zoomOut({ duration: 350 })}
      >
        <span className={styles.minus} />
      </button>
      <button
        type="button"
        className={styles.button}
        title="Enquadrar tudo"
        aria-label="Enquadrar tudo"
        onClick={() => fitView({ duration: 350, padding: 0.1 })}
      >
        <span className={styles.fit}>
          <span />
          <span />
          <span />
          <span />
        </span>
      </button>
      <ScreenshotButton wrapperRef={wrapperRef} title={title} className={styles.button} onResult={onShot} />
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  const p: TfPalette = tfPalette(theme);
  const corner = (pos: Record<string, number>, sides: string[]) => ({
    position: 'absolute' as const,
    width: 4,
    height: 4,
    ...pos,
    ...Object.fromEntries(sides.map((s) => [`border${s}`, `2px solid ${p.tf}`])),
  });
  return {
    stack: css({
      position: 'absolute',
      left: 22,
      bottom: 22,
      display: 'flex',
      flexDirection: 'column',
      gap: 1,
      zIndex: 5,
    }),
    button: css({
      width: 32,
      height: 32,
      border: 0,
      borderRadius: 2,
      background: p.elev,
      color: p.tf,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 0,
      '&:hover:not(:disabled)': { background: p.linha },
      '&:disabled': { cursor: 'default' },

      // Camera do botao de captura: corpo, visor e lente.
      '& .tf-shot-camera': {
        position: 'relative',
        display: 'block',
        width: 12,
        height: 9,
        border: `1.4px solid ${p.tx2}`,
        borderRadius: 2,
        marginTop: 2,
        '&::before': {
          content: '""',
          position: 'absolute',
          left: 2,
          top: -3.5,
          width: 4,
          height: 2,
          background: p.tx2,
          borderRadius: '1px 1px 0 0',
        },
        '&::after': {
          content: '""',
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 4,
          height: 4,
          border: `1.3px solid ${p.tx2}`,
          borderRadius: '50%',
        },
      },
      '& .tf-shot-spin': {
        width: 13,
        height: 13,
        border: `2px solid ${p.linha}`,
        borderTopColor: p.ac,
        borderRadius: '50%',
        animation: `${tfSpin} .8s linear infinite`,
      },
    }),
    plus: css({
      position: 'relative',
      width: 14,
      height: 14,
      '& > span:first-of-type': { position: 'absolute', left: 0, top: 6, width: 14, height: 2, background: p.tf },
      '& > span:last-of-type': { position: 'absolute', left: 6, top: 0, width: 2, height: 14, background: p.tf },
    }),
    minus: css({ width: 14, height: 2, background: p.tf }),
    fit: css({
      position: 'relative',
      width: 14,
      height: 14,
      '& > span:nth-of-type(1)': corner({ left: 0, top: 0 }, ['Left', 'Top']),
      '& > span:nth-of-type(2)': corner({ right: 0, top: 0 }, ['Right', 'Top']),
      '& > span:nth-of-type(3)': corner({ left: 0, bottom: 0 }, ['Left', 'Bottom']),
      '& > span:nth-of-type(4)': corner({ right: 0, bottom: 0 }, ['Right', 'Bottom']),
    }),
  };
};
