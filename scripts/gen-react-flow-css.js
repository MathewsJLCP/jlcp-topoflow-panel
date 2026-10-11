/**
 * Gera `src/canvas/reactFlowCss.generated.ts` a partir do `style.css` do
 * `@xyflow/react` instalado.
 *
 *   node scripts/gen-react-flow-css.js
 *
 * O catalogo do Grafana recusa importar arquivo CSS direto (regra `no-direct-css-imports`
 * do plugin-validator), entao o CSS do React Flow entra como string e e aplicado
 * por uma classe do Emotion no wrapper do canvas. Cada seletor ganha o prefixo
 * `:where(&)`: fica restrito ao canvas, mas com especificidade zero no prefixo —
 * a mesma do import global, e os estilos dos nos continuam vencendo como antes.
 *
 * Rode de novo sempre que atualizar o `@xyflow/react`.
 */
const fs = require('fs');
const path = require('path');
const postcss = require('postcss');

const pkg = require('@xyflow/react/package.json');
const source = require.resolve('@xyflow/react/dist/style.css');
const root = postcss.parse(fs.readFileSync(source, 'utf8'));

root.walkComments((comment) => comment.remove());
root.walkRules((rule) => {
  if (rule.parent.type === 'atrule' && /keyframes$/.test(rule.parent.name)) {
    return;
  }
  rule.selectors = rule.selectors.map((selector) => `:where(&) ${selector}`);
});

const out = path.resolve('src/canvas/reactFlowCss.generated.ts');
fs.writeFileSync(
  out,
  `// Gerado por scripts/gen-react-flow-css.js a partir de @xyflow/react ${pkg.version}\n` +
    `// (dist/style.css, licenca MIT, (c) webkid GmbH). Nao edite a mao.\n\n` +
    `export const REACT_FLOW_CSS = ${JSON.stringify(root.toString().replace(/\n\s*\n/g, '\n'))};\n`
);
console.log(`@xyflow/react ${pkg.version} -> ${path.relative(process.cwd(), out)}`);
