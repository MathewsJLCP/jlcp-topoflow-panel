import { Rect } from '@xyflow/react';

/**
 * Screenshot da topologia: as decisoes de enquadramento e nome do arquivo.
 *
 * A captura em si e do `html-to-image` (ver `ScreenshotButton`), que serializa o
 * DOM dentro de um `<foreignObject>` e o desenha num canvas. Nao ha API de
 * browser para "renderize esta arvore como imagem", entao a alternativa a
 * biblioteca seria reimplementar a mesma tecnica — com os mesmos casos de borda,
 * sem os anos de correcao.
 *
 * O que **nao** e da biblioteca esta aqui, isolado do DOM para poder ser testado:
 * qual retangulo cabe na imagem, em que resolucao, e como o arquivo se chama.
 */

/**
 * Margem em volta da topologia, em pixels do canvas.
 *
 * Sem ela, o elemento mais a esquerda encosta na borda da imagem e a legenda
 * abaixo do ultimo no fica cortada — a caixa que o React Flow mede e a do no, e
 * legenda e lista de triggers vivem **fora** dela, em `position: absolute`.
 */
export const SCREENSHOT_PADDING = 48;

/**
 * Teto do lado maior da imagem.
 *
 * Um PNG de 8000px de largura nao serve para o que este botao existe — colar num
 * chamado, num relatorio, numa conversa — e o `foreignObject` que o produz custa
 * memoria proporcional a area. 4096 cobre uma topologia grande com folga e
 * continua abrindo em qualquer visualizador.
 */
export const SCREENSHOT_MAX_SIDE = 4096;

/**
 * Densidade da imagem. 2x e o que faz o texto do no sair nitido numa tela retina
 * e ao dar zoom no arquivo; 1x devolveria uma imagem que parece borrada
 * exatamente onde ela precisa ser lida.
 */
export const SCREENSHOT_SCALE = 2;

export interface ScreenshotFrame {
  /** Tamanho do PNG, em pixels. */
  width: number;
  height: number;
  /**
   * Zoom a aplicar no viewport ao desenhar. Sai de `SCREENSHOT_SCALE`, reduzido
   * quando a topologia e grande demais para o teto de tamanho.
   */
  zoom: number;
}

/**
 * O enquadramento da imagem, a partir da caixa que envolve todos os elementos.
 *
 * A conta e direta — a topologia mais a margem, vezes a densidade — com um unico
 * ajuste: quando o resultado passa do teto, a densidade cai o quanto for preciso
 * em vez de a imagem ser cortada. Uma topologia grande sai menos nitida; nenhuma
 * topologia sai pela metade, que e o que o usuario nao teria como perceber
 * olhando so para o arquivo.
 *
 * Caixa vazia (topologia sem elementos) devolve `undefined`: nao ha o que
 * enquadrar, e o botao fica desabilitado em vez de gerar um PNG em branco.
 */
export function screenshotFrame(
  bounds: Rect,
  padding = SCREENSHOT_PADDING,
  maxSide = SCREENSHOT_MAX_SIDE,
  scale = SCREENSHOT_SCALE
): ScreenshotFrame | undefined {
  if (!Number.isFinite(bounds.width) || !Number.isFinite(bounds.height)) {
    return undefined;
  }

  // Um elemento so tem area zero em um dos eixos (um texto de uma linha, um
  // point). A margem sozinha ja da a imagem um tamanho utilizavel.
  const naturalWidth = bounds.width + padding * 2;
  const naturalHeight = bounds.height + padding * 2;
  if (naturalWidth <= 0 || naturalHeight <= 0) {
    return undefined;
  }

  const zoom = Math.min(scale, maxSide / naturalWidth, maxSide / naturalHeight);

  return {
    width: Math.round(naturalWidth * zoom),
    height: Math.round(naturalHeight * zoom),
    zoom,
  };
}

/**
 * Nome do arquivo: o titulo do painel e o instante da captura.
 *
 * O instante entra porque o screenshot de uma topologia e uma foto de **agora** —
 * duas capturas do mesmo painel com dez minutos de diferenca sao dois documentos
 * distintos, e sem o carimbo a segunda chegaria como `arquivo (1).png` na pasta
 * de downloads, sem dizer qual e qual.
 *
 * O formato do carimbo e `AAAA-MM-DD-HHMM` em hora local, e nao ISO com fuso: o
 * arquivo e lido por quem esta no mesmo fuso do NOC, e a ordenacao alfabetica da
 * pasta continua sendo a cronologica.
 */
export function screenshotFilename(title: string | undefined, now = new Date()): string {
  const nome = slug(title ?? '') || 'topoflow';

  const p = (n: number) => String(n).padStart(2, '0');
  const carimbo = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}-${p(now.getHours())}${p(
    now.getMinutes()
  )}`;

  return `${nome}-${carimbo}.png`;
}

/**
 * Titulo de painel -> pedaco de nome de arquivo.
 *
 * Acentos viram a letra base em vez de sumirem: "Topologia — Núcleo" tem de
 * chegar como `topologia-nucleo`, e nao como `topologia-ncleo`. O resto do que
 * nao for letra, digito ou hifen colapsa num hifen so — inclui a barra, que em
 * nome de arquivo nao e um caractere, e um separador de diretorio.
 */
function slug(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/**
 * Entrega o PNG ao usuario.
 *
 * `<a download>` criado e clicado por codigo e o unico caminho que nomeia o
 * arquivo: abrir a data URI numa aba nova mostra a imagem, mas o "salvar como"
 * do browser chega sem nome nenhum.
 */
export function downloadImage(dataUrl: string, filename: string): void {
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  link.click();
}
