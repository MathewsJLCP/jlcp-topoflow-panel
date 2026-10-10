/**
 * Vocabulario da biblioteca de icones.
 *
 * Desde a v1.4 **todo icone acompanha o estado**: todos vem do catalogo do
 * mockup (*Padrão*, *Infra*, *Petrolífera*, *Formas*, *Planos*), desenhos com
 * volume cujas faces leem seis variaveis de tom (`--tf-t1..t4`, `--tf-ink`,
 * `--tf-hl`). Quem desenha deriva os seis da cor do estado (`svg/tones.ts`).
 *
 * As figuras de cor fixa (PNG em variantes, fotos) sairam com os packs antigos,
 * e os glifos de traco dos *Clássicos* tambem: as chaves deles resolvem no
 * desenho equivalente (`LEGACY` em `registry.ts`).
 */
export type IconArt =
  /** Corpo de um `<svg>` com o `viewBox` dele, pintado pelas variaveis de tom. */
  { kind: 'svg'; viewBox: string; body: string };

/**
 * Cor fixa que o usuario pode ter escolhido para o icone antes da v1.4
 * (`presentation.iconTone`). O editor nao oferece mais a escolha — no mockup o
 * icone sempre acompanha o estado —, mas o valor salvo continua respeitado.
 */
export type IconTone = 'gray' | 'blue' | 'green' | 'yellow' | 'orange' | 'red';

export interface IconEntry {
  /** Chave dentro do pack, estavel para sempre: e o que fica salvo. */
  name: string;
  /** Nome exibido no seletor. */
  label: string;
  art: IconArt;
  /** Agrupamento dentro do pack (Rede, Segurança...), quando o pack tem. */
  group?: string;
  /** Termos extras de busca — sinonimos e o nome em ingles. */
  keywords?: string[];
}

/**
 * Uma "pasta" de icones. O `id` entra na chave salva (`infra/roteador`), entao
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
