import React from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { ViewportPortal, XYPosition } from '@xyflow/react';

import { DEFAULT_EDGE_WIDTH } from '../model/sizes';

interface Props {
  from: XYPosition;
  to: XYPosition;
}

/**
 * Linha tracejada do elemento de origem ate o cursor, durante o modo Linkar.
 *
 * Vai dentro de `<ViewportPortal>` para herdar a transformacao de pan e zoom —
 * assim as coordenadas sao as mesmas do fluxo (as que `screenToFlowPosition`
 * devolve) e a linha nao descola dos nos quando o usuario navega no canvas.
 *
 * O SVG e `pointer-events: none` de proposito: ele cobre a cena inteira, e
 * qualquer captura de ponteiro aqui impediria o clique de chegar ao no alvo.
 */
export function GhostConnection({ from, to }: Props) {
  const styles = useStyles2(getStyles);

  return (
    <ViewportPortal>
      <svg className={styles.svg} aria-hidden>
        <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} className={styles.line} />
      </svg>
    </ViewportPortal>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  svg: css({
    position: 'absolute',
    top: 0,
    left: 0,
    // O portal nao tem dimensao propria; sem `overflow: visible` o traco seria
    // recortado assim que saisse do canto superior esquerdo do viewport.
    width: 1,
    height: 1,
    overflow: 'visible',
    pointerEvents: 'none',
  }),
  line: css({
    stroke: theme.colors.primary.main,
    strokeWidth: DEFAULT_EDGE_WIDTH,
    strokeDasharray: '6 4',
    strokeOpacity: 0.6,
  }),
});
