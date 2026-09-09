import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { sampleTopology } from '../model/sampleTopology';
import { TopoEdge, TopoPoint, Topology } from '../model/types';
import { EdgeForm, PointForm } from './ElementForms';

/**
 * Regressao do item 9 do PRD: em Conexao e Point, escolher `Metrica` em
 * **Estado** nao trazia seletor de metrica nenhum a tela.
 *
 * A causa nao era condicao invertida — o bloco simplesmente nao existia nesses
 * dois formularios. O seletor morava dentro do `ThresholdsEditor`, que so o no
 * renderiza. O unico controle capaz de gravar `color.field` ali era o radio
 * Fixo|Field de "Cor", que fala de cor e nao de estado.
 *
 * O que estes testes fixam e a simetria: os tres formularios mostram o mesmo
 * seletor sob a mesma condicao, e nenhum deles oferece um segundo controle para
 * o mesmo `color.field`.
 */

const point: TopoPoint = { id: 'ponto', position: { x: 0, y: 0 }, color: {}, zIndex: 0 };
const [edge] = sampleTopology.edges;

const TRIGGER_ON = { enabled: true, showActive: true, host: 'AGLIN-FW-STARTI', names: [] };

function setupPoint(overrides: Partial<TopoPoint> = {}) {
  const element: TopoPoint = { ...point, ...overrides };
  const topology: Topology = { ...sampleTopology, points: [element] };
  const onChange = jest.fn<void, [Topology]>();

  render(<PointForm element={element} topology={topology} frames={[]} onChange={onChange} />);

  return { result: () => onChange.mock.calls.at(-1)?.[0].points[0] };
}

function setupEdge(overrides: Partial<TopoEdge> = {}) {
  const element: TopoEdge = { ...edge, ...overrides };
  const topology: Topology = { ...sampleTopology, edges: [element] };
  const onChange = jest.fn<void, [Topology]>();

  render(<EdgeForm element={element} topology={topology} frames={[]} onChange={onChange} />);

  return { result: () => onChange.mock.calls.at(-1)?.[0].edges[0] };
}

describe('PointForm — seletor de métrica', () => {
  it('em modo Métrica, o seletor aparece', () => {
    setupPoint();

    expect(screen.getByRole('radio', { name: 'Métrica' })).toBeChecked();
    expect(screen.getByText('Campo')).toBeInTheDocument();
  });

  it('em modo Trigger, o seletor sai da tela', () => {
    setupPoint({ trigger: TRIGGER_ON });

    expect(screen.queryByText('Campo')).not.toBeInTheDocument();
  });

  /**
   * D2: a cor fixa virou a linha Base do editor de regras. Um dado, um controle
   * — o radio Fixo|Field que tambem gravava em `color.field` saiu de cena.
   */
  it('a cor fixa aparece como a linha Base, sem segundo caminho para o field', () => {
    setupPoint();

    expect(screen.getByText('Base')).toBeInTheDocument();
    expect(screen.queryByText('Cor')).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Field' })).not.toBeInTheDocument();
  });

  /**
   * A cor fixa não some em modo Trigger: ela é o que o elemento veste enquanto
   * não há alarme (nível 2 da cadeia). Só mudou de lugar — deixou de ser um
   * campo "Cor" solto e passou a ser a linha Base do editor de regras, que grava
   * no mesmo `color.fixed`.
   */
  it('em modo Trigger, a cor fixa continua editável, agora como Base', () => {
    setupPoint({ trigger: TRIGGER_ON });

    expect(screen.getByText('Base')).toBeInTheDocument();
    expect(screen.queryByText('Cor')).not.toBeInTheDocument();
  });

  /** O bloco de regras vale nos dois modos; muda o que ele oferece. */
  it('em modo Trigger, o bloco é a escada de severidades', () => {
    setupPoint({ trigger: TRIGGER_ON });

    expect(screen.getByText('Disaster')).toBeInTheDocument();
    expect(screen.getByText('Not classified')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Adicionar regra/ })).not.toBeInTheDocument();
  });
});

describe('EdgeForm — seletor de métrica', () => {
  it('em modo Métrica, o seletor aparece', () => {
    setupEdge();

    expect(screen.getByRole('radio', { name: 'Métrica' })).toBeChecked();
    expect(screen.getByText('Campo')).toBeInTheDocument();
  });

  it('em modo Trigger, o seletor sai da tela', () => {
    setupEdge({ trigger: TRIGGER_ON });

    expect(screen.queryByText('Campo')).not.toBeInTheDocument();
  });

  it('a cor fixa aparece como a linha Base, sem segundo caminho para o field', () => {
    setupEdge();

    expect(screen.getByText('Base')).toBeInTheDocument();
    expect(screen.queryByText('Cor')).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Field' })).not.toBeInTheDocument();
  });

  /**
   * A cor fixa não some em modo Trigger: ela é o que o elemento veste enquanto
   * não há alarme (nível 2 da cadeia). Só mudou de lugar — deixou de ser um
   * campo "Cor" solto e passou a ser a linha Base do editor de regras, que grava
   * no mesmo `color.fixed`.
   */
  it('em modo Trigger, a cor fixa continua editável, agora como Base', () => {
    setupEdge({ trigger: TRIGGER_ON });

    expect(screen.getByText('Base')).toBeInTheDocument();
    expect(screen.queryByText('Cor')).not.toBeInTheDocument();
  });

  /** O bloco de regras vale nos dois modos; muda o que ele oferece. */
  it('em modo Trigger, o bloco é a escada de severidades', () => {
    setupEdge({ trigger: TRIGGER_ON });

    expect(screen.getByText('Disaster')).toBeInTheDocument();
    expect(screen.getByText('Not classified')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Adicionar regra/ })).not.toBeInTheDocument();
  });

  /** Em Trigger não há field a escolher; o aviso de métrica não cabe. */
  it('em modo Trigger, não pede para escolher um campo', () => {
    setupEdge({ trigger: TRIGGER_ON, color: {} });

    expect(screen.queryByText(/Escolha um campo acima/)).not.toBeInTheDocument();
  });

  /**
   * A escrita da escada em si está coberta em `writeSeverityLadder`; o que só
   * este nível prova é o destino — que ela pousa na conexão certa, e sem
   * atropelar o que o eixo de métrica tinha configurado.
   */
  it('restaurar o padrão preserva as regras de métrica da conexão', () => {
    const metrica = { type: 'threshold' as const, value: 90, color: 'orange' };
    const severidade = { type: 'severity' as const, atLeast: 5 as const, color: 'purple' };
    const { result } = setupEdge({ trigger: TRIGGER_ON, thresholds: { steps: [metrica, severidade] } });

    fireEvent.click(screen.getByRole('button', { name: /Restaurar padrão do Zabbix/ }));

    expect(result()?.thresholds?.steps).toEqual([metrica]);
  });
});

/**
 * Uma conexao salva com `color.field` foi configurada pelo radio de "Cor", o
 * unico caminho que existia. O seletor novo le o mesmo campo — se lesse outro, a
 * configuracao antiga sumiria da tela sem sumir do JSON.
 */
describe('compatibilidade com o que já estava salvo', () => {
  it('o field escolhido pelo controle antigo aparece no seletor novo', () => {
    setupEdge({ color: { field: 'cpu_usage', fixed: 'blue' } });

    expect(screen.getByDisplayValue('cpu_usage')).toBeInTheDocument();
  });
});

/**
 * Bloco 3: as regras de threshold, que so o no tinha, chegaram aos outros dois.
 * O que se verifica e o destino da escrita — que a regra pousa no elemento certo
 * da topologia, e nao que o editor funciona, ja coberto em `ThresholdsEditor`.
 */
describe('thresholds em Conexão e Point', () => {
  const addRule = (tipo: string) => {
    fireEvent.click(screen.getByRole('button', { name: /Adicionar regra/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: new RegExp(tipo) }));
  };

  it('o point aceita regra própria', () => {
    const { result } = setupPoint();

    addRule('Threshold');

    expect(result()?.thresholds?.steps).toEqual([{ type: 'threshold', value: 80, color: 'yellow' }]);
  });

  it('a conexão aceita regra própria', () => {
    const { result } = setupEdge();

    addRule('Threshold');

    expect(result()?.thresholds?.steps).toEqual([{ type: 'threshold', value: 80, color: 'yellow' }]);
  });

  /** A Base grava em `color.fixed`, o mesmo campo que o antigo controle "Cor". */
  it('a Base da conexão continua escrevendo em `color.fixed`', () => {
    const { result } = setupEdge({ color: { fixed: 'purple' } });

    addRule('Threshold');

    expect(result()?.color).toEqual({ fixed: 'purple' });
  });
});

/**
 * A animacao deixou de ser um campo do elemento e virou coluna da escada de
 * severidades. O `alert` salvo continua sendo lido — o que sumiu e o controle
 * que o escrevia.
 */
describe('animação de alerta', () => {
  it('não há mais campo de animação do elemento', () => {
    setupPoint({ trigger: TRIGGER_ON, alert: { animation: 'radar', fromSeverity: 4 } });

    expect(screen.queryByRole('switch', { name: 'Animação de alerta' })).not.toBeInTheDocument();
    expect(screen.queryByText('A partir de')).not.toBeInTheDocument();
  });

  /** Um elemento salvo com "Radar a partir de High" tem de aparecer assim. */
  it('o alerta salvo aparece nas linhas da escada que ele alcançava', () => {
    setupPoint({ trigger: TRIGGER_ON, alert: { animation: 'radar', fromSeverity: 4 } });

    expect(screen.getByLabelText('Animação de Disaster')).toHaveValue('Radar');
    expect(screen.getByLabelText('Animação de High')).toHaveValue('Radar');
    expect(screen.getByLabelText('Animação de Average')).toHaveValue('Parado');
  });

  it('a conexão também tem a coluna, uma por severidade', () => {
    setupEdge({ trigger: TRIGGER_ON });

    expect(screen.getByLabelText('Animação de Disaster')).toHaveValue('Parado');
    expect(screen.getByLabelText('Animação de Not classified')).toHaveValue('Parado');
  });
});
