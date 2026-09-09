import { readFileSync } from 'fs';
import { join } from 'path';

import { parseTopoFlowOptions } from './parse';
import { topoFlowOptionsSchema } from './schema';

/**
 * Os dashboards de `examples/` sao entregues para importar direto no Grafana:
 * se um deles deixar de validar, quem descobre e o usuario, com o painel ja
 * aberto e a topologia caida no default. Este teste e o que impede isso —
 * qualquer mudanca de schema que os invalide falha aqui primeiro.
 */
const EXEMPLOS = ['topoflow-exemplo-estatico.json', 'topoflow-modelo-datacenter.json', 'topoflow-modelo-wan.json'];

describe.each(EXEMPLOS)('%s', (arquivo) => {
  const dash = JSON.parse(readFileSync(join(__dirname, '../../examples', arquivo), 'utf8'));
  const options = dash.panels[0].options;

  it('valida no schema sem nenhum ajuste', () => {
    const r = topoFlowOptionsSchema.safeParse(options);
    if (!r.success) {
      throw new Error(JSON.stringify(r.error.issues, null, 1));
    }
  });

  it('o parse do painel nao reporta problema nem descarta elemento', () => {
    const { issues, topologyInvalid, options: parsed } = parseTopoFlowOptions(options);
    expect(issues).toEqual([]);
    expect(topologyInvalid).toBe(false);

    const t = options.topology;
    expect(parsed.topology.nodes).toHaveLength(t.nodes.length);
    expect(parsed.topology.points).toHaveLength(t.points.length);
    expect(parsed.topology.texts).toHaveLength(t.texts.length);
    expect(parsed.topology.postits).toHaveLength(t.postits.length);
    // Aresta descartada aqui significa ponta inexistente ou id repetido.
    expect(parsed.topology.edges).toHaveLength(t.edges.length);
  });

  it('toda chave de icone usada existe no catalogo', () => {
    const { isKnownIcon } = require('../icons');

    // As figuras dos dispositivos sao elementos Imagem com a chave do catalogo
    // em `src` — e o mesmo campo que guarda data URI e URL.
    for (const img of options.topology.images) {
      expect([img.id, isKnownIcon(img.src)]).toEqual([img.id, true]);
    }
    for (const n of options.topology.nodes) {
      if (n.presentation.icon) {
        expect([n.id, isKnownIcon(n.presentation.icon)]).toEqual([n.id, true]);
      }
    }
  });

  it('toda aresta liga pontas que existem', () => {
    const ids = new Set(
      [...options.topology.nodes, ...options.topology.points, ...options.topology.images].map(
        (e: { id: string }) => e.id
      )
    );

    for (const e of options.topology.edges) {
      expect([e.id, ids.has(e.source), ids.has(e.target)]).toEqual([e.id, true, true]);
    }
  });
});
