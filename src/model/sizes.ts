/**
 * Geometria canonica dos elementos.
 *
 * Vive na camada de modelo, e nao no componente que desenha, porque estes
 * numeros sao lidos em dois lugares: pelo canvas (que renderiza) e pelas
 * mutacoes (que criam o elemento ja com `size` preenchido). Enquanto estavam
 * duplicados, o postit chegou a divergir — 240x180 em `mutations.ts` contra
 * 240x280 em `defaults.ts`.
 */

export const DEVICE_NODE_WIDTH = 180;

/**
 * Piso, nao teto. O card cresce quando o titulo quebra em varias linhas; o que
 * `size.height` define e a altura minima (`minHeight`), para que um nome longo
 * nunca seja truncado.
 */
export const DEVICE_NODE_HEIGHT = 60;

/** O point nao persiste `size`: e sempre este diametro. */
export const POINT_NODE_SIZE = 14;

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
