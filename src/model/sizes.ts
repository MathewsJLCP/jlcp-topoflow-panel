/**
 * Geometria canonica dos elementos.
 *
 * Vive na camada de modelo, e nao no componente que desenha, porque estes
 * numeros sao lidos em dois lugares: pelo canvas (que renderiza) e pelas
 * mutacoes (que criam o elemento ja com `size` preenchido). Enquanto estavam
 * duplicados, o postit chegou a divergir — 240x180 em `mutations.ts` contra
 * 240x280 em `defaults.ts`.
 */

export const DEVICE_NODE_WIDTH = 184;

/**
 * Piso, nao teto. O card cresce quando o titulo quebra em varias linhas; o que
 * `size.height` define e a altura minima (`minHeight`), para que um nome longo
 * nunca seja truncado.
 */
export const DEVICE_NODE_HEIGHT = 64;

/** O point nao persiste `size`: e sempre este diametro. */
export const POINT_NODE_SIZE = 16;

export const POSTIT_DEFAULT = { width: 250, height: 170, minWidth: 160, minHeight: 100 };

/**
 * Espessura do traco da aresta. Selecionada desenha com `+ 0.5`.
 *
 * Era 1.5, para que dezenas de conexoes na cena nao virassem um emaranhado. Na
 * pratica o traco sumia sobre o fundo do canvas antes de a densidade virar
 * problema, entao 2 passou a ser o padrao. Continua configuravel por aresta:
 * este e so o ponto de partida.
 *
 * Arestas ja salvas guardam a propria espessura e nao mudam sozinhas.
 */
export const DEFAULT_EDGE_WIDTH = 2;

/**
 * Caixa da imagem. Quadrada por padrao porque o caso dominante e icone de
 * fabricante ou logo — e um retangulo largo obrigaria a redimensionar toda vez.
 *
 * O minimo e pequeno de proposito: 24px ainda e um alvo clicavel, e ha topologia
 * que usa a imagem como marcador ao lado do no, nao como figura.
 */
export const IMAGE_DEFAULT = {
  width: 96,
  height: 96,
  minWidth: 24,
  minHeight: 24,
  /**
   * A legenda nasce menor que o texto do no (14px): ela acompanha a figura, nao
   * a substitui. Configuravel por elemento — este e so o ponto de partida.
   */
  fontSize: 12,
};
