import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { sampleTopology } from '../model/sampleTopology';
import { TopoEdge, TopoPoint, Topology } from '../model/types';
import { BulkEdgeForm, BulkPointForm, commonValue, sameState } from './BulkForms';

/**
 * Edicao em massa das conexoes: o caminho montado com points e uma aresta por
 * segmento, e as quatro ou cinco representam **um** enlace.
 *
 * A regra que estes testes protegem e uma so, e e a que separa um formulario em
 * massa util de um destrutivo: **so o campo mexido e escrito**. Um formulario
 * que salvasse o retrato inteiro de uma aresta por cima das outras achataria
 * rotulo, trigger e thresholds que o usuario nunca tocou.
 */

const [modelo] = sampleTopology.edges;

const aresta = (id: string, overrides: Partial<TopoEdge> = {}): TopoEdge => ({
  ...modelo,
  id,
  ...overrides,
});

function setup(edges: TopoEdge[]) {
  const onChange = jest.fn<void, [Topology]>();

  function Harness() {
    const [topology, setTopology] = React.useState<Topology>({ ...sampleTopology, edges });

    return (
      <BulkEdgeForm
        edges={topology.edges}
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

  return { onChange, result: () => onChange.mock.calls.at(-1)?.[0].edges ?? [] };
}

describe('commonValue', () => {
  it('devolve o valor quando todos concordam', () => {
    expect(commonValue(['solid', 'solid', 'solid'])).toBe('solid');
  });

  /**
   * `undefined` e o que faz o controle aparecer vazio. Mostrar o valor da
   * primeira faria o usuario acreditar que ja esta tudo igual — o engano que
   * este formulario existe para desfazer.
   */
  it('devolve indefinido quando divergem', () => {
    expect(commonValue(['solid', 'dashed'])).toBeUndefined();
  });

  it('uma só é ela mesma, e nenhuma é indefinido', () => {
    expect(commonValue(['solid'])).toBe('solid');
    expect(commonValue([])).toBeUndefined();
  });
});

describe('BulkEdgeForm', () => {
  it('anuncia quantas conexões vão ser editadas', () => {
    setup([aresta('a'), aresta('b'), aresta('c')]);

    expect(screen.getByText('3 conexões selecionadas')).toBeInTheDocument();
  });

  it('aplica o estilo às selecionadas de uma vez', () => {
    const { result } = setup([aresta('a'), aresta('b')]);

    fireEvent.click(screen.getByRole('radio', { name: 'Tracejada' }));

    expect(result().map((edge) => edge.style)).toEqual(['dashed', 'dashed']);
  });

  /**
   * O teste central. Duas conexoes com rotulos diferentes: mudar o estilo nao
   * pode custar os rotulos, que sao a razao de cada segmento ser distinguivel.
   */
  it('só escreve o campo alterado — o resto de cada conexão fica intacto', () => {
    const { result } = setup([
      aresta('a', { label: 'IN', width: 2, animation: 'flow' }),
      aresta('b', { label: 'OUT', width: 5, animation: 'none' }),
    ]);

    fireEvent.click(screen.getByRole('radio', { name: 'Tracejada' }));

    expect(result()).toMatchObject([
      { id: 'a', style: 'dashed', label: 'IN', width: 2, animation: 'flow' },
      { id: 'b', style: 'dashed', label: 'OUT', width: 5, animation: 'none' },
    ]);
  });

  it('não toca nas conexões que não estão selecionadas', () => {
    const onChange = jest.fn<void, [Topology]>();
    const selecionadas = [aresta('a'), aresta('b')];
    const foraDaSelecao = aresta('c', { style: 'dotted' });
    const topology: Topology = { ...sampleTopology, edges: [...selecionadas, foraDaSelecao] };

    render(<BulkEdgeForm edges={selecionadas} topology={topology} frames={[]} onChange={onChange} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Tracejada' }));

    expect(onChange.mock.calls.at(-1)?.[0].edges.at(-1)).toMatchObject({ id: 'c', style: 'dotted' });
  });

  describe('quando as selecionadas divergem', () => {
    it('marca o campo como misto e não escolhe por conta própria', () => {
      setup([aresta('a', { style: 'solid' }), aresta('b', { style: 'dashed' })]);

      expect(screen.getAllByText('valores diferentes').length).toBeGreaterThan(0);
      // Nenhuma opção fica marcada: o controle não pode afirmar um valor que
      // não é verdade para todas.
      expect(screen.getByRole('radio', { name: 'Sólida' })).not.toBeChecked();
      expect(screen.getByRole('radio', { name: 'Tracejada' })).not.toBeChecked();
    });

    it('concordando, o valor comum aparece marcado', () => {
      setup([aresta('a', { style: 'dashed' }), aresta('b', { style: 'dashed' })]);

      expect(screen.getByRole('radio', { name: 'Tracejada' })).toBeChecked();
    });

    /** Sem valor comum, o campo de rótulo fica vazio e explica por quê. */
    it('o rótulo vazio anuncia a divergência no placeholder', () => {
      setup([aresta('a', { label: 'IN' }), aresta('b', { label: 'OUT' })]);

      const campo = screen.getByLabelText('Rótulo');
      expect(campo).toHaveValue('');
      expect(campo).toHaveAttribute('placeholder', 'Rótulos diferentes');
    });
  });

  /**
   * O vinculo de estado e o motivo do pedido: um caminho de varios segmentos so
   * acende junto se as arestas compartilharem a mesma fonte de estado.
   */
  it('o bloco de estado é aplicado por inteiro a todas', () => {
    const { result } = setup([aresta('a'), aresta('b'), aresta('c')]);

    fireEvent.click(screen.getByRole('radio', { name: 'Trigger' }));

    expect(result().map((edge) => edge.trigger?.enabled)).toEqual([true, true, true]);
  });
});

/**
 * O aviso de semente so aparece quando ha divergencia de fato. Quem acabou de
 * criar um caminho tem tudo igual, e um aviso permanente ali viraria ruido —
 * ninguem le o alerta que esta sempre aceso.
 */
describe('sameState', () => {
  const semEstado = { trigger: undefined, color: {}, thresholds: undefined, alert: undefined };

  it('reconhece configurações iguais', () => {
    expect(sameState([semEstado, { ...semEstado }])).toBe(true);
  });

  it('reconhece divergência em qualquer campo do estado', () => {
    expect(sameState([semEstado, { ...semEstado, color: { field: 'cpu' } }])).toBe(false);
    expect(
      sameState([semEstado, { ...semEstado, trigger: { enabled: true, host: 'x', names: [], showActive: true } }])
    ).toBe(false);
  });

  it('um só concorda consigo mesmo', () => {
    expect(sameState([semEstado])).toBe(true);
  });
});

/**
 * O point **e** so estado: nao tem texto, icone, valor nem geometria — o
 * formulario individual dele ja e um `StateSection` e mais nada. Por isso aqui
 * nao ha campo primitivo a comparar, e a cobertura e sobre a escrita.
 */
describe('BulkPointForm', () => {
  const point = (id: string, extras: Partial<TopoPoint> = {}): TopoPoint => ({
    id,
    position: { x: 0, y: 0 },
    color: {},
    zIndex: 0,
    ...extras,
  });

  function setupPoints(points: TopoPoint[]) {
    const onChange = jest.fn<void, [Topology]>();

    function Harness() {
      const [topology, setTopology] = React.useState<Topology>({ ...sampleTopology, points });

      return (
        <BulkPointForm
          points={topology.points}
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

    return { result: () => onChange.mock.calls.at(-1)?.[0].points ?? [] };
  }

  it('anuncia quantos points vão ser editados', () => {
    setupPoints([point('p1'), point('p2'), point('p3')]);

    expect(screen.getByText('3 points selecionados')).toBeInTheDocument();
  });

  /** O caminho por points só acende junto se as âncoras compartilharem o vínculo. */
  it('aplica o vínculo de estado a todos de uma vez', () => {
    const { result } = setupPoints([point('p1'), point('p2'), point('p3')]);

    fireEvent.click(screen.getByRole('radio', { name: 'Trigger' }));

    expect(result().map((p) => p.trigger?.enabled)).toEqual([true, true, true]);
  });

  /** A mesma regra da Conexão: cada controle escreve só o seu campo. */
  it('trocar o gráfico não mexe no resto de cada point', () => {
    const { result } = setupPoints([
      point('p1', { color: { field: 'cpu' }, thresholds: { steps: [{ type: 'threshold', value: 80, color: 'red' }] } }),
      point('p2', { color: { field: 'cpu' } }),
    ]);

    fireEvent.click(screen.getByRole('switch', { name: 'Gráfico' }));

    // O primeiro mantém os thresholds dele; o segundo continua sem nenhum.
    expect(result()[0]).toMatchObject({ chart: true, thresholds: { steps: [{ value: 80 }] } });
    expect(result()[1].chart).toBe(true);
    expect(result()[1].thresholds).toBeUndefined();
  });

  it('não toca nos points fora da seleção', () => {
    const onChange = jest.fn<void, [Topology]>();
    const selecionados = [point('p1'), point('p2')];
    const fora = point('p3', { color: { fixed: 'red' } });
    const topology: Topology = { ...sampleTopology, points: [...selecionados, fora] };

    render(<BulkPointForm points={selecionados} topology={topology} frames={[]} onChange={onChange} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Trigger' }));

    const intacto = onChange.mock.calls.at(-1)?.[0].points.at(-1);
    expect(intacto?.id).toBe('p3');
    expect(intacto?.trigger).toBeUndefined();
  });

  describe('nota de semente', () => {
    it('cala quando os selecionados já concordam', () => {
      setupPoints([point('p1'), point('p2')]);

      expect(screen.queryByText(/não têm a mesma configuração/)).not.toBeInTheDocument();
    });

    it('avisa quando divergem, porque o formulário parte do primeiro', () => {
      setupPoints([point('p1', { color: { field: 'cpu' } }), point('p2')]);

      expect(screen.getByText(/não têm a mesma configuração/)).toBeInTheDocument();
    });
  });
});
