import React, { useCallback, useState } from 'react';
import { cx } from '@emotion/css';
import { useTheme2 } from '@grafana/ui';
import { getNodesBounds, getViewportForBounds, useReactFlow } from '@xyflow/react';
import { toPng } from 'html-to-image';

import { tfPalette } from '../theme/palette';
import { SCREENSHOT_PADDING, downloadImage, screenshotFilename, screenshotFrame } from './screenshot';

/**
 * "Baixar imagem da topologia": o ultimo botao da pilha de controles.
 *
 * Enquadra a topologia inteira (nao o que esta visivel), congela as animacoes
 * durante a captura — um elemento no meio do pulso sairia borrado — e entrega o
 * PNG nomeado pelo titulo do painel. O resultado vira o toast do canvas
 * (`onResult`), como no mockup.
 */
export interface ShotResult {
  ok: boolean;
  title: string;
  body: string;
}

interface ScreenshotButtonProps {
  wrapperRef: React.RefObject<HTMLDivElement>;
  title?: string;
  className?: string;
  onResult?: (result: ShotResult) => void;
}

export function ScreenshotButton({ wrapperRef, title, className, onResult }: ScreenshotButtonProps) {
  const theme = useTheme2();
  const p = tfPalette(theme);
  const { getNodes } = useReactFlow();
  const [capturando, setCapturando] = useState(false);

  const vazio = getNodes().length === 0;

  const capturar = useCallback(async () => {
    const wrapper = wrapperRef.current;
    const viewport = wrapper?.querySelector<HTMLElement>('.react-flow__viewport');
    const frame = screenshotFrame(getNodesBounds(getNodes()));

    if (!wrapper || !viewport || !frame) {
      return;
    }

    const { x, y } = getViewportForBounds(
      getNodesBounds(getNodes()),
      frame.width,
      frame.height,
      frame.zoom,
      frame.zoom,
      SCREENSHOT_PADDING * frame.zoom
    );

    setCapturando(true);
    wrapper.dataset.capturing = 'true';

    try {
      const png = await toPng(viewport, {
        backgroundColor: p.sup,
        width: frame.width,
        height: frame.height,
        pixelRatio: 1,
        style: {
          width: `${frame.width}px`,
          height: `${frame.height}px`,
          transform: `translate(${x}px, ${y}px) scale(${frame.zoom})`,
        },
      });

      const filename = screenshotFilename(title);
      downloadImage(png, filename);
      onResult?.({ ok: true, title: 'Imagem da topologia baixada', body: filename });
    } catch (error) {
      console.error('TopoFlow: falha ao gerar screenshot', error);
      onResult?.({
        ok: false,
        title: 'Não foi possível gerar a imagem da topologia',
        body: 'Causa provável: uma imagem hospedada em outro domínio bloqueou a captura.',
      });
    } finally {
      delete wrapper.dataset.capturing;
      setCapturando(false);
    }
  }, [wrapperRef, getNodes, p.sup, title, onResult]);

  return (
    <button
      type="button"
      className={cx(className, 'nodrag', 'nopan')}
      onClick={capturar}
      disabled={vazio || capturando}
      title={vazio ? 'Nada para capturar' : 'Baixar imagem da topologia'}
      aria-label="Baixar imagem da topologia"
      style={{ opacity: vazio ? 0.4 : 1 }}
      data-busy={capturando || undefined}
    >
      {capturando ? <span className="tf-shot-spin" /> : <span className="tf-shot-camera" />}
    </button>
  );
}
