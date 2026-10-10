import {
  DataFrame,
  FieldType,
  cacheFieldDisplayNames,
  createTheme,
  getDisplayProcessor,
  toDataFrame,
} from '@grafana/data';

import { ElementColor } from '../../data/elementColor';
import { TopoNode } from '../../model/types';
import { TF_DARK } from '../../theme/palette';
import { nodeSurface, stateLook, statusBadge } from '../look';
import { nodeStats, statFields, statLabel } from '../nodeStats';

const theme = createTheme();

/**
 * O desenho do no e decidido por funcoes puras (`look`, `nodeStats`);
 * renderizar o componente exigiria o contexto do React Flow para os `Handle`s e
 * testaria layout, nao decisao.
 */
const no = (overrides: Partial<TopoNode>): TopoNode =>
  ({
    id: 'n',
    position: { x: 0, y: 0 },
    size: { width: 184, height: 64 },
    presentation: { primaryText: { mode: 'fixed', fixed: 'n' }, showIcon: true },
    color: {},
    zIndex: 0,
    ...overrides,
  }) as TopoNode;

function frames(fields: Array<{ name: string; values: unknown[]; unit?: string }>): DataFrame[] {
  const frame = toDataFrame({
    fields: fields.map(({ name, values, unit }) => ({
      name,
      type: typeof values[0] === 'string' ? FieldType.string : FieldType.number,
      values,
      config: unit ? { unit } : {},
    })),
  });
  for (const field of frame.fields) {
    field.display = getDisplayProcessor({ field, theme });
  }
  cacheFieldDisplayNames([frame]);
  return [frame];
}

const NEUTRO: ElementColor = { state: 'neutral' };

describe('statFields — quais métricas o nó exibe', () => {
  const series = frames([
    { name: 'H: CPU', values: [92] },
    { name: 'H: Ping', values: [1] },
    { name: 'H: Clientes', values: [23] },
  ]);

  it('desligado, não exibe nada', () => {
    expect(statFields(no({ color: { field: 'H: CPU' } }), series, NEUTRO)).toEqual([]);
  });

  /** "Sem dados" é aviso sobre o vínculo: aparece mesmo com o valor desligado. */
  it('desligado e sem dados, exibe as métricas do estado', () => {
    expect(statFields(no({ color: { field: 'H: CPU' } }), series, { state: 'nodata' })).toEqual(['H: CPU']);
  });

  it('ligado, exibe as métricas do estado (todas) e as extras', () => {
    const element = no({
      color: { field: 'H: Ping' },
      extraMetrics: [{ field: 'H: CPU', steps: [] }],
      value: { fromState: true, fields: ['H: Clientes'] },
    });

    expect(statFields(element, series, NEUTRO)).toEqual(['H: Ping', 'H: CPU', 'H: Clientes']);
  });

  /** Um nó salvo antes da v1.4 com field escolhido exibia só ele — e continua. */
  it('o field único de antes da v1.4 exibe só ele', () => {
    expect(statFields(no({ color: { field: 'H: CPU' }, value: { field: 'H: Ping' } }), series, NEUTRO)).toEqual([
      'H: Ping',
    ]);
  });

  it('no modo trigger, as métricas do estado não entram', () => {
    const element = no({
      color: { field: 'H: CPU' },
      trigger: { enabled: true, host: 'H', names: [], showActive: true },
      value: { fields: ['H: Clientes'] },
    });

    expect(statFields(element, series, NEUTRO)).toEqual(['H: Clientes']);
  });
});

describe('nodeStats — as linhas de valor', () => {
  it('rótulo é o item, sem o host', () => {
    expect(statLabel('CORE-SW-01: CPU')).toBe('CPU');
    expect(statLabel('H1: Interface eth3: Bits received')).toBe('Interface eth3: Bits received');
    expect(statLabel('sem host')).toBe('sem host');
  });

  it('em %, a barra vai de 0 a 100 e a regra que casou pinta o número', () => {
    const element = no({
      color: { field: 'H: CPU' },
      thresholds: { steps: [{ type: 'threshold', value: 80, color: 'red' }] },
      value: {},
    });
    const [row] = nodeStats(element, frames([{ name: 'H: CPU', values: [84], unit: 'percent' }]), NEUTRO, theme);

    expect(row).toMatchObject({ label: 'CPU', value: '84', unit: '%', bar: true, pct: 84, color: TF_DARK.cr });
    expect(row.ticks).toEqual([{ pct: 80, color: TF_DARK.cr }]);
  });

  it('sem unidade e sem regra, não há barra', () => {
    const [row] = nodeStats(
      no({ color: { field: 'H: Clientes' }, value: {} }),
      frames([{ name: 'H: Clientes', values: [23] }]),
      NEUTRO,
      theme
    );

    expect(row).toMatchObject({ value: '23', unit: '', bar: false, color: TF_DARK.tf });
  });

  it('métrica ausente vira "sem dados"', () => {
    const [row] = nodeStats(no({ color: { field: 'H: X' }, value: {} }), frames([]), NEUTRO, theme);

    expect(row).toMatchObject({ value: 'sem dados', bar: false, color: TF_DARK.tx2 });
  });
});

describe('look — como cada estado pousa no nó', () => {
  const p = TF_DARK;

  it('neutro: borda apagada e círculo vazio', () => {
    const look = stateLook(NEUTRO, undefined, theme);

    expect(nodeSurface(look, p).background).toBe(p.sup);
    expect(statusBadge(look, p).glyph).toBe('');
  });

  it('Base: borda na cor e ✓', () => {
    const look = stateLook({ state: 'fixed', color: p.ok }, undefined, theme);

    expect(nodeSurface(look, p).border).toBe(`1.5px solid ${p.ok}`);
    expect(statusBadge(look, p)).toMatchObject({ glyph: '✓', background: p.ok });
  });

  it('sem dados: hachurado, tracejado e –', () => {
    const look = stateLook({ state: 'nodata' }, undefined, theme);

    expect(nodeSurface(look, p).border).toBe(`1.5px dashed ${p.apa}`);
    expect(nodeSurface(look, p).background).toContain('repeating-linear-gradient');
    expect(statusBadge(look, p).glyph).toBe('–');
  });

  /** Disaster se separa do High pelo tratamento, não pela cor. */
  it('Disaster: borda de 2.5px, 30% de fundo e !!', () => {
    const disaster = stateLook(
      { state: 'trigger', color: p.cr, severity: 5, label: 'Disaster', problems: [] },
      undefined,
      theme
    );
    const high = stateLook(
      { state: 'trigger', color: p.cr, severity: 4, label: 'High', problems: [] },
      undefined,
      theme
    );

    expect(nodeSurface(disaster, p).border).toBe(`2.5px solid ${p.cr}`);
    expect(nodeSurface(disaster, p).background).toContain(' 30%');
    expect(statusBadge(disaster, p).glyph).toBe('!!');
    expect(nodeSurface(high, p).border).toBe(`1.5px solid ${p.cr}`);
    expect(statusBadge(high, p).glyph).toBe('!');
  });

  it('no formato Contador, o círculo mostra o número de problemas', () => {
    const look = stateLook({ state: 'threshold', color: p.at }, undefined, theme);

    expect(statusBadge(look, p, 4).glyph).toBe('4');
  });
});
