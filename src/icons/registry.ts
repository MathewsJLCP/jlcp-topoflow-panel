import { IconPack, ResolvedIcon } from './types';
import { FALLBACK_ICON, classicPack } from './packs/classic';
import { petroliferaPack } from './packs/petrolifera';
import { topoflowPack } from './packs/topoflow';
import { zabbixPack } from './packs/zabbix';

/**
 * O catalogo de icones do plugin, e a traducao entre a chave salva e a arte.
 *
 * ## A chave
 *
 * O modelo guarda `pack/nome` (`classic/router`, `zabbix/switch`). Duas formas
 * continuam validas de proposito:
 *
 *   - **sem pack** (`router`) — tudo o que foi salvo antes de existirem pastas.
 *     Resolve no pack `classic`, que e onde aqueles icones estao. E o que
 *     dispensa migrador: o campo sempre foi string livre.
 *   - **desconhecida** — pack removido, icone renomeado, JSON editado a mao.
 *     Cai no generico em vez de sumir, pela mesma razao de sempre: um icone que
 *     nao existe mais nao pode fazer o no desaparecer da topologia.
 *
 * ## Por que uma lista de packs, e nao um objeto so
 *
 * A ordem importa na tela (o pack padrao vem primeiro) e um `Record` nao a
 * garante. E packs sao dados: adicionar o do Zabbix deve custar uma entrada
 * nesta lista, nao uma mudanca em quem resolve.
 */

/**
 * Ordem das pastas no seletor. O **Padrao** vem primeiro: e o pack que o produto
 * recomenda, e o primeiro item da lista e o que a maioria escolhe sem procurar.
 *
 * Packs de dominio (**Petrolífera**) vem depois dos gerais: eles atendem a um
 * ramo so, entao ficam onde quem precisa deles vai procurar, sem ocupar a
 * primeira pasta de todo mundo. **Zabbix** e geral — vale para qualquer
 * topologia de rede — entao fica entre os gerais, depois dos *Clássicos*.
 */
export const ICON_PACKS: IconPack[] = [topoflowPack, classicPack, zabbixPack, petroliferaPack];

const PACKS_BY_ID = new Map(ICON_PACKS.map((pack) => [pack.id, pack]));

/** Pack de quem gravou a chave sem pack nenhum. */
const LEGACY_PACK = classicPack.id;

export const DEFAULT_ICON_REF = `${LEGACY_PACK}/${FALLBACK_ICON}`;

/**
 * Icone com que a biblioteca **comeca**, quando quem escolheu foi o produto e
 * nao o usuario — trocar a Figura de "Arquivo" para "Biblioteca", por exemplo.
 *
 * Nao e o `DEFAULT_ICON_REF`: aquele e o fallback de chave desconhecida e vive
 * no pack legado, entao grava-lo abriria o navegador de icones na pasta
 * *Clássicos*. Aqui a escolha e deliberada, e a pasta certa para comecar e a que
 * o produto recomenda — a mesma que o navegador abre quando nao ha escolha
 * previa (ver `IconBrowser`).
 */
export const STARTER_ICON_REF = iconRef(ICON_PACKS[0].id, ICON_PACKS[0].icons[0].name);

/** Monta a chave canonica. Existe para que `${}` com barra nao se espalhe. */
export function iconRef(pack: string, name: string): string {
  return `${pack}/${name}`;
}

function locate(pack: IconPack, name: string): ResolvedIcon | undefined {
  const entry = pack.icons.find((icon) => icon.name === name);
  return entry && { ...entry, ref: iconRef(pack.id, entry.name), pack: pack.id, packLabel: pack.label };
}

/**
 * A chave salva -> o icone a desenhar. **Nunca falha**: sem correspondencia,
 * devolve o generico.
 *
 * Note que a chave de uma imagem enviada pelo usuario (`user/<id>`) nao resolve
 * aqui — a biblioteca do painel vive em `panel.options` e nao neste catalogo,
 * que e estatico. Quem junta os dois e o consumidor, que consulta a biblioteca
 * antes de cair neste resolvedor.
 */
export function resolveIcon(ref: string | undefined): ResolvedIcon {
  const [pack, name] = splitRef(ref);
  const found = PACKS_BY_ID.get(pack);

  return (found && locate(found, name)) ?? locate(classicPack, FALLBACK_ICON)!;
}

/** `'zabbix/router'` -> `['zabbix', 'router']`; `'router'` -> `['classic', 'router']`. */
export function splitRef(ref: string | undefined): [pack: string, name: string] {
  const raw = ref?.trim() ?? '';
  const barra = raw.indexOf('/');

  if (barra === -1) {
    return [LEGACY_PACK, raw];
  }

  return [raw.slice(0, barra), raw.slice(barra + 1)];
}

/** True quando a chave aponta para um icone que existe de fato neste catalogo. */
export function isKnownIcon(ref: string | undefined): boolean {
  const [pack, name] = splitRef(ref);
  const found = PACKS_BY_ID.get(pack);

  return Boolean(found && found.icons.some((icon) => icon.name === name));
}

/** Todos os icones, na ordem dos packs. Para o seletor. */
export function listIcons(): ResolvedIcon[] {
  return ICON_PACKS.flatMap((pack) =>
    pack.icons.map((icon) => ({ ...icon, ref: iconRef(pack.id, icon.name), pack: pack.id, packLabel: pack.label }))
  );
}
