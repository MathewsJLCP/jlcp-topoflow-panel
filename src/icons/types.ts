import { ReactNode } from 'react';

/**
 * Vocabulario da biblioteca de icones.
 *
 * Um icone tem **natureza**, e ela nao e um rotulo: e o que decide se ele pode
 * acender junto com o estado do elemento.
 *
 *   - **glifo** — desenhado inline num `<svg>` que herda `currentColor`. Fica
 *     vermelho no alarme, cinza no repouso, sempre legivel sobre o card
 *     preenchido porque a cor vem de quem o renderiza.
 *   - **figura** — arte com cores proprias (SVG colorido, PNG, upload do
 *     usuario). Nao ha como tingi-la, entao ela nunca anuncia estado; quem
 *     anuncia e a superficie atras dela.
 *
 * Nao existe campo `tint` separado de proposito. Ele seria derivavel de `kind`
 * nos dois sentidos — uma `<img>` nao aceita `currentColor`, e um glifo nao tem
 * cor propria para preservar — e um campo derivavel e um convite a duas fontes
 * de verdade discordando.
 */
export type IconArt =
  /** Shapes de um `viewBox` 24x24, sem cor propria. Ver as regras em `packs/classic`. */
  | { kind: 'glyph'; shape: ReactNode }
  /** URL do asset ou data URI. */
  | { kind: 'image'; src: string }
  /**
   * A mesma figura em varias cores, uma por arquivo.
   *
   * E a terceira natureza, e ela desfaz a oposicao entre as duas primeiras: a
   * arte continua sem poder ser tingida, mas **passa a anunciar estado** —
   * trocando o arquivo, e nao a cor. E como os mapas do Zabbix sempre
   * funcionaram, e o que permite a um PNG de 96px acompanhar um alarme.
   */
  | { kind: 'variants'; tones: Partial<Record<IconTone, string>>; base: IconTone };

/**
 * Os tons em que uma figura pode existir.
 *
 * Deliberadamente curto e ligado ao **material disponivel**, nao a escala de
 * severidade do Zabbix: nao adianta um tom `orange` se nenhum pack traz o
 * arquivo. Quem traduz severidade (ou cor de threshold) para um destes e o
 * canvas, em `canvas/iconTone.ts`, onde a cadeia de cor ja e conhecida.
 */
export type IconTone = 'gray' | 'blue' | 'green' | 'yellow' | 'orange' | 'red';

export interface IconEntry {
  /** Chave dentro do pack, estavel para sempre: e o que fica salvo. */
  name: string;
  /** Nome exibido no seletor. */
  label: string;
  art: IconArt;
  /** Termos extras de busca — sinonimos e o nome em ingles. */
  keywords?: string[];
}

/**
 * Uma "pasta" de icones. O `id` entra na chave salva (`zabbix/router`), entao
 * renomea-lo quebra topologias — trate-o como parte do formato, nao como texto.
 */
export interface IconPack {
  id: string;
  label: string;
  icons: IconEntry[];
}

/** Um icone ja localizado no registry, com a chave canonica que o enderaca. */
export interface ResolvedIcon extends IconEntry {
  /** `pack/nome` — a forma que o editor grava. */
  ref: string;
  pack: string;
  packLabel: string;
}
