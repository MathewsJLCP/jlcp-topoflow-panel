import { IconPack } from '../types';
import { CATALOG } from './catalog.generated';
import { iconTones } from './tones';

/**
 * Os packs SVG da v1.4 — o catalogo do mockup, desenho por desenho.
 *
 * `catalog.generated.ts` sai de `scripts/gen-icon-catalog.js`, a partir do `topoflow-icons.js` do mockup (ids de
 * pack e de icone sao os mesmos de la). Cada icone e um `<svg>` cujas faces
 * leem `var(--tf-t1..t4/ink/hl)`; quem desenha injeta os seis tons derivados da
 * cor do estado (`tones.ts`), e o mesmo roteador sai azul, verde ou vermelho sem
 * existir um arquivo por cor.
 */
const data = CATALOG;

/** Sinonimos de busca do mockup, pelo nome exibido. */
const SYNONYMS: Record<string, string[]> = {
  Círculo: ['circle', 'bola'],
  Quadrado: ['square'],
  Retângulo: ['rectangle'],
  Triângulo: ['triangle'],
  Losango: ['diamond'],
  Estrela: ['star'],
  Seta: ['arrow'],
  Cruz: ['plus', 'cross'],
  Hexágono: ['hexagon'],
  Elipse: ['ellipse', 'oval'],
  'Servidor rack': ['server', 'rack'],
  'Host físico': ['host', 'hardware', 'bare metal'],
  Computador: ['pc', 'desktop', 'workstation'],
  Monitor: ['tela', 'display'],
  'Banco em nuvem': ['cloud', 'database', 'db'],
  'Nuvem (frontal)': ['cloud', 'frente'],
  UniFi: ['ubiquiti', 'ap', 'access point', 'wifi'],
  'Câmera bullet': ['camera', 'cctv'],
  'Câmera dome': ['camera', 'cctv'],
  'Antena de rádio': ['radio', 'wireless'],
  'Antena parabólica': ['dish', 'satellite'],
  Serviço: ['service'],
  'Serviço de negócio': ['business service'],
  Edifício: ['building', 'site', 'predio'],
  Desconhecido: ['unknown', 'generico'],
  'Switch L3': ['layer 3'],
  'Firewall em ataque': ['fire'],
  Roteador: ['router'],
  Servidor: ['server'],
  'Wi-Fi': ['wifi', 'wireless', 'ap'],
  Internet: ['web', 'cloud', 'wan'],
  'Banco de dados': ['database', 'db', 'sql'],
  Impressora: ['printer'],
  Nuvem: ['cloud'],
  'No-break': ['ups', 'nobreak'],
  Notebook: ['laptop'],
  Telefone: ['phone'],
};

/**
 * Pastas renomeadas em relacao ao mockup. O pack Zabbix virou **Infra** (os
 * desenhos sao genericos de infraestrutura); as chaves `zabbix/...` salvas
 * continuam resolvendo, ver `registry.ts`.
 */
const RENAMED: Record<string, { id: string; label: string }> = {
  zabbix: { id: 'infra', label: 'Infra' },
};

export const SVG_PACKS: IconPack[] = data.packs.map(({ id, label }) => ({
  ...(RENAMED[id] ?? { id, label }),
  icons: data.icons
    .filter((icon) => icon.pack === id)
    .map((icon) => ({
      name: icon.key,
      label: icon.name,
      group: data.groups[icon.grp] ?? icon.grp,
      keywords: SYNONYMS[icon.name],
      art: { kind: 'svg' as const, viewBox: icon.vb, body: icon.body },
    })),
}));

/** O desenho dos icones desconhecidos, como no mockup. */
export const SVG_FALLBACK = { pack: 'padrao', name: 'desconhecido' };

/**
 * Data URI do icone pintado com a cor dada. `<img>` e nao SVG inline: varios
 * desenhos declaram `id` internos (filtros, gradientes), e dois deles na mesma
 * pagina colidiriam. Dentro de um data URI cada um e um documento proprio.
 */
const uriCache = new Map<string, string>();

export function svgIconUri(ref: string, viewBox: string, body: string, color?: string): string {
  const tones = iconTones(color);
  const key = `${ref}|${tones.t2}`;
  const hit = uriCache.get(key);
  if (hit) {
    return hit;
  }

  const style = Object.entries(tones)
    .map(([k, v]) => `--tf-${k}:${v}`)
    .join(';');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="128" height="128" style="${style}">${body}</svg>`;
  const uri = 'data:image/svg+xml,' + encodeURIComponent(svg);
  uriCache.set(key, uri);
  return uri;
}
