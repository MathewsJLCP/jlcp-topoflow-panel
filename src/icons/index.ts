/**
 * Porta de entrada da biblioteca de icones.
 *
 * Quem consome icone importa daqui e nao precisa saber em que pack ele mora —
 * era esse acoplamento que fazia o editor conhecer a lista fechada de chaves.
 */
export { TopoIcon } from './TopoIcon';
export {
  DEFAULT_ICON_REF,
  STARTER_ICON_REF,
  ICON_PACKS,
  iconRef,
  isKnownIcon,
  listIcons,
  resolveIcon,
  splitRef,
} from './registry';
export type { IconArt, IconEntry, IconPack, IconTone, ResolvedIcon } from './types';
