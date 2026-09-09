import { TextDimension } from '../model/types';

/**
 * Resolucao de apresentacao do Bloco 2: so o lado `fixed`.
 *
 * O modo `field` existe no schema desde o Bloco 1 mas so ganha significado no
 * Bloco 3, quando `src/data/dimensions.ts` entra. Ate la um elemento em modo
 * `field` renderiza vazio — e o que se espera de um vinculo ainda nao ligado.
 */
export function fixedText(dim: TextDimension): string {
  return dim.mode === 'fixed' ? (dim.fixed ?? '') : '';
}
