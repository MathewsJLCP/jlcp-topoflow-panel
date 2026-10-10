/** Formato do catalogo gerado por `scripts/gen-icon-catalog.js`. */
export interface CatalogIcon {
  pack: string;
  key: string;
  name: string;
  grp: string;
  vb: string;
  body: string;
}

export interface Catalog {
  packs: Array<{ id: string; label: string }>;
  groups: Record<string, string>;
  icons: CatalogIcon[];
}
