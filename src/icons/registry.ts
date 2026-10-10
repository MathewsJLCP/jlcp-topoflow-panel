import { IconPack, ResolvedIcon } from './types';
import { SVG_FALLBACK, SVG_PACKS } from './svg';

/**
 * O catalogo de icones do plugin, e a traducao entre a chave salva e a arte.
 *
 * ## A chave
 *
 * O modelo guarda `pack/nome` (`padrao/roteador`, `infra/switch`). Tres formas
 * continuam validas de proposito:
 *
 *   - **sem pack** (`router`) ou **dos Clássicos** (`classic/router`) — os
 *     glifos de traco com que o TopoFlow nasceu. O pack saiu na v1.4; `LEGACY`
 *     leva cada um ao desenho equivalente do catalogo.
 *   - **anterior a v1.4** (`topoflow/router`, `zabbix/rack-42`) — os packs em
 *     PNG sairam quando o mockup redesenhou tudo em SVG. `LEGACY` leva cada
 *     chave ao desenho equivalente, e nada salvo precisa ser editado. O pack
 *     Zabbix virou **Infra**: `zabbix/<nome>` sem entrada na tabela resolve em
 *     `infra/<nome>`.
 *   - **desconhecida** — pack removido, icone renomeado, JSON editado a mao.
 *     Cai no generico em vez de sumir: um icone que nao existe mais nao pode
 *     fazer o no desaparecer da topologia.
 *
 * ## Por que uma lista de packs, e nao um objeto so
 *
 * A ordem importa na tela (o pack padrao vem primeiro) e um `Record` nao a
 * garante. E packs sao dados: adicionar um deve custar uma entrada nesta lista,
 * nao uma mudanca em quem resolve.
 */

const svgPack = (id: string) => SVG_PACKS.find((pack) => pack.id === id)!;

/** Ordem das pastas no seletor — a do mockup. */
export const ICON_PACKS: IconPack[] = [
  svgPack('padrao'),
  svgPack('infra'),
  svgPack('petro'),
  svgPack('formas'),
  svgPack('planos'),
];

const PACKS_BY_ID = new Map(ICON_PACKS.map((pack) => [pack.id, pack]));

/** Pack de quem gravou a chave sem pack nenhum: os Clássicos, que sairam. */
const LEGACY_PACK = 'classic';

/** O fallback de tudo: chave vazia, desconhecida ou de um pack que sumiu. */
export const DEFAULT_ICON_REF = `${SVG_FALLBACK.pack}/${SVG_FALLBACK.name}`;

/**
 * Chaves dos packs em PNG (ate a v1.3) -> desenho do catalogo SVG.
 *
 * Exportado para o teste que garante que todo destino existe: uma entrada
 * apontando para um icone renomeado cairia no generico em silencio.
 */
export const LEGACY: Record<string, string> = {
  'classic/server': 'padrao/servidor',
  'classic/switch': 'padrao/switch',
  'classic/router': 'padrao/roteador',
  'classic/firewall': 'padrao/firewall',
  'classic/load-balancer': 'planos/load-balancer',
  'classic/access-point': 'padrao/unifi',
  'classic/database': 'padrao/banco-de-dados',
  'classic/storage': 'infra/array-discos-3d',
  'classic/cloud': 'padrao/nuvem',
  'classic/generic': 'padrao/desconhecido',

  'topoflow/router': 'padrao/roteador',
  'topoflow/server': 'padrao/servidor',
  'topoflow/firewall': 'padrao/firewall',
  'topoflow/layer-switch': 'padrao/switch',
  'topoflow/hub': 'padrao/hub',
  'topoflow/wifi': 'padrao/wifi',
  'topoflow/world': 'padrao/internet',
  'topoflow/database': 'padrao/banco-de-dados',
  'topoflow/printer': 'padrao/impressora',
  'topoflow/bullet-camera': 'padrao/camera-bullet',
  'topoflow/circle': 'formas/circulo',

  'zabbix/router': 'infra/roteador',
  'zabbix/router-symbol': 'infra/roteador-simbolo',
  'zabbix/crypto-router': 'infra/roteador-cripto',
  'zabbix/crypto-router-symbol': 'infra/roteador-cripto-simbolo',
  'zabbix/ap': 'padrao/unifi',
  'zabbix/network-adapter': 'infra/placa-de-rede',
  'zabbix/network': 'infra/rede',
  'zabbix/cloud': 'infra/nuvem',
  'zabbix/satellite': 'infra/satelite',
  'zabbix/satellite-antenna': 'infra/antena-satelite',
  'zabbix/server': 'infra/servidor',
  'zabbix/zabbix-server-2d': 'infra/servidor-zabbix-2d',
  'zabbix/zabbix-server-3d': 'infra/servidor-zabbix-3d',
  'zabbix/disk-array-2d': 'infra/array-discos-2d',
  'zabbix/disk-array-3d': 'infra/array-discos-3d',
  'zabbix/rack-42': 'infra/rack-42u',
  'zabbix/rack-42-with-door': 'infra/rack-42u-porta',
  'zabbix/server-1u-2d': 'infra/rack-1u-2d',
  'zabbix/server-1u-3d': 'infra/rack-1u-3d',
  'zabbix/server-2u-2d': 'infra/rack-2u-2d',
  'zabbix/server-2u-3d': 'infra/rack-2u-3d',
  'zabbix/server-3u-2d': 'infra/rack-3u-2d',
  'zabbix/server-3u-3d': 'infra/rack-3u-3d',
  'zabbix/server-4u-2d': 'infra/rack-4u-2d',
  'zabbix/server-4u-3d': 'infra/rack-4u-3d',
  'zabbix/server-5u-2d': 'infra/rack-5u-2d',
  'zabbix/server-5u-3d': 'infra/rack-5u-3d',
  'zabbix/ups': 'infra/no-break',
  'zabbix/ups-rack-2d': 'infra/no-break-rack-2d',
  'zabbix/ups-rack-3d': 'infra/no-break-rack-3d',
  'zabbix/workstation': 'infra/estacao-de-trabalho',
  'zabbix/video-terminal': 'infra/terminal-de-video',
  'zabbix/printer': 'infra/impressora',
  'zabbix/phone': 'infra/telefone',
  'zabbix/ip-pbx': 'infra/pabx-ip',
  'zabbix/ip-pbx-symbol': 'infra/pabx-ip-simbolo',
  'zabbix/pbx': 'infra/pabx',
  'zabbix/house': 'infra/casa',

  'petrolifera/sonda': 'petro/sonda',
  'petrolifera/sonda-frac': 'petro/sonda-fraturamento',
  'petrolifera/estacao': 'petro/estacao',
  'petrolifera/religador': 'petro/religador',
  'petrolifera/sensor-temperatura': 'petro/sensor-temperatura',
  'petrolifera/torre': 'petro/torre',
  'petrolifera/radio-cambium': 'petro/radio-cambium',
  'petrolifera/unifi-ac-lite': 'petro/unifi',
  'petrolifera/unifi-ac-pro': 'petro/unifi',
  'petrolifera/unifi-ac-mesh': 'petro/unifi',
  'petrolifera/unifi-ac-mesh-pro': 'petro/unifi',
};

/**
 * Icone com que a biblioteca **comeca**, quando quem escolheu foi o produto e
 * nao o usuario — um no novo, ou a Figura trocada de "Arquivo" para
 * "Biblioteca". E o Roteador do pack Padrao, como no mockup.
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

function find(ref: string | undefined): ResolvedIcon | undefined {
  const [pack, name] = splitRef(ref);
  const found = PACKS_BY_ID.get(pack);
  return found && locate(found, name);
}

/**
 * A chave salva -> o icone a desenhar. **Nunca falha**: sem correspondencia,
 * devolve o generico.
 */
export function resolveIcon(ref: string | undefined): ResolvedIcon {
  return known(ref) ?? find(DEFAULT_ICON_REF)!;
}

/** A chave direto no catalogo, ou pela traducao das chaves antigas. */
function known(ref: string | undefined): ResolvedIcon | undefined {
  const [pack, name] = splitRef(ref);
  return (
    find(ref) ?? find(LEGACY[iconRef(pack, name)]) ?? (pack === 'zabbix' ? find(iconRef('infra', name)) : undefined)
  );
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

/**
 * True quando a chave aponta para um icone do catalogo — inclusive pelas chaves
 * antigas. E o que separa, no `src` da Imagem, um icone de uma URL.
 */
export function isKnownIcon(ref: string | undefined): boolean {
  return Boolean(known(ref));
}

/** Todos os icones, na ordem dos packs. Para o seletor. */
export function listIcons(): ResolvedIcon[] {
  return ICON_PACKS.flatMap((pack) =>
    pack.icons.map((icon) => ({ ...icon, ref: iconRef(pack.id, icon.name), pack: pack.id, packLabel: pack.label }))
  );
}
