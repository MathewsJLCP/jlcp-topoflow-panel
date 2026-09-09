import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { sampleTopology } from '../model/sampleTopology';
import { TopoEdge, TopoPoint, Topology } from '../model/types';
import { EdgeForm, PointForm } from './ElementForms';

/**
 * O toggle do grafico de hover, no bloco Estado.
 *
 * Os dois formularios aqui sao os que respondem as duas perguntas de escopo: o
 * Point mostra o toggle (tem superficie de hover), a Conexao nao (o painel dela
 * pendura no chip de alarme, que so existe alarmando). No e Imagem seguem o
 * mesmo `StateSection` do Point.
 */

const point: TopoPoint = { id: 'ponto', position: { x: 0, y: 0 }, color: {}, zIndex: 0 };
const [edge] = sampleTopology.edges;

const TRIGGER_ON = { enabled: true, showActive: true, host: 'AGLIN-FW-STARTI', names: [] };

function setupPoint(overrides: Partial<TopoPoint> = {}) {
  const onChange = jest.fn<void, [Topology]>();

  function Harness() {
    const [topology, setTopology] = React.useState<Topology>({
      ...sampleTopology,
      points: [{ ...point, ...overrides }],
    });

    return (
      <PointForm
        element={topology.points[0]}
        topology={topology}
        frames={[]}
        onChange={(next) => {
          onChange(next);
          setTopology(next);
        }}
      />
    );
  }

  render(<Harness />);

  return { result: () => onChange.mock.calls.at(-1)?.[0].points[0] };
}

function setupEdge(overrides: Partial<TopoEdge> = {}) {
  const topology: Topology = { ...sampleTopology, edges: [{ ...edge, ...overrides }] };

  render(<EdgeForm element={topology.edges[0]} topology={topology} frames={[]} onChange={jest.fn()} />);
}

const toggle = () => screen.getByRole('switch', { name: 'Gráfico' });

describe('toggle do gráfico', () => {
  /** Um painel de parede com trinta elementos não quer um gráfico a cada movimento. */
  it('nasce desligado', () => {
    setupPoint();

    expect(toggle()).not.toBeChecked();
  });

  it('ligar grava no elemento; desligar apaga o campo', () => {
    const { result } = setupPoint({ color: { field: 'cpu' } });

    fireEvent.click(toggle());
    expect(result()?.chart).toBe(true);

    fireEvent.click(toggle());
    // `undefined` e não `false`: ausente já significa desligado, e gravar o
    // valor explícito só encheria o JSON do dashboard.
    expect(result()?.chart).toBeUndefined();
  });

  /**
   * No modo Trigger nao existe field escolhido — nao ha serie para desenhar — e
   * o hover do elemento ja tem dono: a lista de triggers em PROBLEM.
   */
  it('não aparece no modo Trigger', () => {
    setupPoint({ trigger: TRIGGER_ON });

    expect(screen.queryByRole('switch', { name: 'Gráfico' })).not.toBeInTheDocument();
  });

  /**
   * O toggle ligado sem campo prometeria um grafico que nunca viria. O texto nao
   * repete a abertura do aviso das regras, logo acima — duas linhas comecando
   * igual se leem como uma duplicada, e nao como duas coisas diferentes.
   */
  it('ligado sem campo, avisa que não há série para desenhar', () => {
    setupPoint({ chart: true });

    expect(screen.getByText(/não há série para desenhar/)).toBeInTheDocument();
  });

  it('com campo escolhido, não há aviso', () => {
    setupPoint({ chart: true, color: { field: 'cpu' } });

    expect(screen.queryByText(/não há série para desenhar/)).not.toBeInTheDocument();
  });

  /**
   * A aresta e um traco: o painel de hover dela pendura no chip de alarme, que
   * so existe quando ha alarme. Oferecer o toggle prometeria um grafico sem
   * lugar para abrir — mesma razao pela qual ela nao recebe o radar.
   */
  it('a Conexão não oferece o toggle', () => {
    setupEdge();

    expect(screen.queryByRole('switch', { name: 'Gráfico' })).not.toBeInTheDocument();
  });
});
