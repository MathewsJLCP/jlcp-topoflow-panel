/**
 * Gera `src/icons/svg/catalog.generated.ts` a partir da biblioteca de icones do
 * mockup (`topoflow-icons.js`, exportado pelo Claude Design).
 *
 *   node scripts/gen-icon-catalog.js [caminho/para/topoflow-icons.js]
 *
 * O padrao e `temp/topoflow_new_design/topoflow-icons.js`. Sai um modulo `.ts`, e
 * nao `.json`, porque o webpack do `.config` copia todo `.json` de `src/` para o
 * `dist` — o catalogo iria duplicado no pacote.
 */
const fs = require('fs');
const path = require('path');

const source = path.resolve(process.argv[2] || 'temp/topoflow_new_design/topoflow-icons.js');
global.window = {};
require(source);
const T = window.TFIcons;

const icons = T.ICONS.map(({ pack, key, name, grp, vb, body }) => ({ pack, key, name, grp, vb, body }));
const catalog = { packs: T.PACKS.map((p) => ({ id: p.k, label: p.n })), groups: T.GROUPS, icons };

const out = path.resolve('src/icons/svg/catalog.generated.ts');
fs.writeFileSync(
  out,
  `// Gerado por scripts/gen-icon-catalog.js a partir do mockup. Nao edite a mao.\n` +
    `import type { Catalog } from './catalogTypes';\n\n` +
    `export const CATALOG: Catalog = ${JSON.stringify(catalog)};\n`
);
console.log(`${icons.length} icones -> ${path.relative(process.cwd(), out)}`);
