import React, { useCallback, useState } from 'react';
import { AppEvents } from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';
import { Icon, Spinner, useTheme2 } from '@grafana/ui';
import { ControlButton, getNodesBounds, getViewportForBounds, useReactFlow } from '@xyflow/react';
import { toPng } from 'html-to-image';

import { SCREENSHOT_PADDING, downloadImage, screenshotFilename, screenshotFrame } from './screenshot';

/**
 * Botao de screenshot, logo abaixo do *Fit view*.
 *
 * ## O que a imagem contem
 *
 * A **topologia inteira**, e nao o que esta na area visivel. Quem pede o
 * screenshot de um mapa quer o mapa; enquadrar pela viewport devolveria um
 * recorte que depende de onde o usuario tinha rolado, e a parte que faltou nao
 * se percebe olhando so para o arquivo.
 *
 * O elemento capturado e o `.react-flow__viewport`, que contem nos e arestas e
 * **nao** contem a grade de pontos nem estes proprios controles — sao irmaos
 * dele na arvore. O fundo entra pelo `backgroundColor`, do tema: um PNG
 * transparente de uma topologia em tema escuro fica ilegivel ao ser colado num
 * documento branco.
 *
 * ## As animacoes param durante a captura
 *
 * `blink` desce ate opacidade 0.45 e o radar comeca em 0.55 e termina em 0. Uma
 * foto tirada no instante errado sairia com o elemento alarmado quase invisivel
 * — exatamente o elemento por causa do qual alguem tira o screenshot. O
 * `data-capturing` no container congela tudo no estado de repouso.
 */

interface ScreenshotButtonProps {
  /**
   * O container do canvas **deste** painel. A busca pelo viewport parte dele, e
   * nao do documento: um dashboard com dois TopoFlow tem dois
   * `.react-flow__viewport`, e `document.querySelector` acharia sempre o
   * primeiro — o painel de baixo exportaria a imagem do de cima.
   */
  wrapperRef: React.RefObject<HTMLDivElement>;
  /** Titulo do painel, que vira o nome do arquivo. */
  title?: string;
}

export function ScreenshotButton({ wrapperRef, title }: ScreenshotButtonProps) {
  const theme = useTheme2();
  const { getNodes } = useReactFlow();
  const [capturando, setCapturando] = useState(false);

  const nodes = getNodes();
  const vazio = nodes.length === 0;

  const capturar = useCallback(async () => {
    const wrapper = wrapperRef.current;
    const viewport = wrapper?.querySelector<HTMLElement>('.react-flow__viewport');
    const frame = screenshotFrame(getNodesBounds(getNodes()));

    if (!wrapper || !viewport || !frame) {
      return;
    }

    // Zoom fixo: passando o mesmo valor como minimo e maximo, o
    // `getViewportForBounds` deixa de escolher a escala e so calcula a
    // translacao que centra a topologia na imagem. O tamanho ja foi decidido em
    // `screenshotFrame`, e deixar os dois lados decidirem escala daria duas
    // respostas para a mesma pergunta.
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
        backgroundColor: theme.colors.background.canvas,
        width: frame.width,
        height: frame.height,
        // A densidade ja esta no `transform`. Sem fixar em 1, o
        // `devicePixelRatio` do monitor a multiplicaria de novo e a imagem sairia
        // com o dobro do tamanho pedido numa tela retina e o tamanho certo numa
        // comum — o mesmo painel produzindo arquivos diferentes por maquina.
        pixelRatio: 1,
        style: {
          width: `${frame.width}px`,
          height: `${frame.height}px`,
          transform: `translate(${x}px, ${y}px) scale(${frame.zoom})`,
        },
      });

      downloadImage(png, screenshotFilename(title));
    } catch (error) {
      /**
       * O modo de falha real e imagem de outro dominio: o `<foreignObject>` so
       * desenha o que ele consegue embutir, e um logo servido por um host sem
       * CORS derruba a conversao inteira. Falhar calado devolveria um clique que
       * nao faz nada — e o usuario nao teria como saber que o problema esta numa
       * imagem, muito menos em qual.
       */
      notifyError(error);
    } finally {
      delete wrapper.dataset.capturing;
      setCapturando(false);
    }
  }, [wrapperRef, getNodes, theme, title]);

  return (
    <ControlButton
      onClick={capturar}
      // Sem elemento nao ha o que enquadrar, e o arquivo sairia em branco.
      disabled={vazio || capturando}
      title={vazio ? 'Nada para capturar' : 'Baixar imagem da topologia'}
      aria-label="Baixar imagem da topologia"
    >
      {capturando ? <Spinner /> : <Icon name="camera" />}
    </ControlButton>
  );
}

/**
 * O barramento de eventos do Grafana e o unico lugar onde um aviso deste painel
 * alcanca o usuario: o canvas nao tem area de mensagem, e o erro acontece depois
 * do clique, quando ja nao ha formulario aberto.
 *
 * Sob `try` porque `getAppEvents()` devolve o singleton que o Grafana instala no
 * boot — fora dele (jest) nao existe, e um screenshot que falha nao pode levar o
 * painel junto.
 */
function notifyError(error: unknown): void {
  const detalhe = error instanceof Error ? error.message : String(error);

  try {
    getAppEvents().publish({
      type: AppEvents.alertError.name,
      payload: [
        'Não foi possível gerar a imagem da topologia',
        `${detalhe}. Imagens hospedadas em outro domínio costumam ser a causa: o navegador não deixa desenhá-las na captura.`,
      ],
    });
  } catch {
    console.error('TopoFlow: falha ao gerar screenshot', error);
  }
}
