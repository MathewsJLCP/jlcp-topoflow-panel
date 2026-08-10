import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { defaultTopology } from '../model/defaults';
import { TopoNode, Topology } from '../model/types';
import { NodeForm } from './ElementForms';

/**
 * O que se testa aqui e o contrato dos campos opcionais: ligar e desligar um
 * toggle escreve (ou apaga) o campo certo na topologia. A aparencia dos
 * controles e do Grafana; o que e nosso e o que sai no `onChange`.
 */

const [node] = defaultTopology.nodes;

function setup(overrides: Partial<TopoNode> = {}) {
  const element: TopoNode = { ...node, ...overrides };
  const topology: Topology = { ...defaultTopology, nodes: [element], edges: [] };
  const onChange = jest.fn<void, [Topology]>();

  render(<NodeForm element={element} topology={topology} frames={[]} onChange={onChange} />);

  /** O nó como ficou depois da última escrita. */
  const result = () => onChange.mock.calls.at(-1)?.[0].nodes[0];

  return { onChange, result };
}

const toggle = (label: string) => screen.getByRole('switch', { name: label });

describe('NodeForm — texto secundário', () => {
  it('nasce desligado num nó que não tem o campo', () => {
    setup({ presentation: { ...node.presentation, secondaryText: undefined } });

    expect(toggle('Texto secundário')).not.toBeChecked();
    // Primário e secundário usam o mesmo placeholder; o que distingue é a
    // contagem — desligado, só o campo do texto primário está na tela.
    expect(screen.getAllByPlaceholderText('Texto')).toHaveLength(1);
  });

  /** O `ToggleField` já nomeia o campo na linha do switch. */
  it('o rótulo não aparece duas vezes quando o campo está ligado', () => {
    setup({ presentation: { ...node.presentation, secondaryText: { mode: 'fixed', fixed: '' } } });

    expect(screen.getAllByText('Texto secundário')).toHaveLength(1);
  });

  it('ligado, o campo aparece ao lado do primário', () => {
    setup({ presentation: { ...node.presentation, secondaryText: { mode: 'fixed', fixed: '10.0.0.1' } } });

    expect(screen.getAllByPlaceholderText('Texto')).toHaveLength(2);
  });

  it('vem ligado num nó salvo com o campo preenchido', () => {
    setup({ presentation: { ...node.presentation, secondaryText: { mode: 'fixed', fixed: '10.0.0.1' } } });

    expect(toggle('Texto secundário')).toBeChecked();
  });

  it('ligar cria o campo vazio', () => {
    const { result } = setup({ presentation: { ...node.presentation, secondaryText: undefined } });

    fireEvent.click(toggle('Texto secundário'));

    expect(result()?.presentation.secondaryText).toEqual({ mode: 'fixed', fixed: '' });
  });

  it('desligar apaga o campo', () => {
    const { result } = setup({
      presentation: { ...node.presentation, secondaryText: { mode: 'fixed', fixed: '10.0.0.1' } },
    });

    fireEvent.click(toggle('Texto secundário'));

    expect(result()?.presentation.secondaryText).toBeUndefined();
  });
});

describe('NodeForm — valor exibido', () => {
  it('nasce desligado num nó sem métrica', () => {
    setup({ value: undefined });

    expect(toggle('Valor exibido')).not.toBeChecked();
  });

  it('o rótulo não aparece duas vezes quando o campo está ligado', () => {
    setup({ value: { field: 'cpu' } });

    expect(screen.getAllByText('Valor exibido')).toHaveLength(1);
  });

  it('ligar cria o vínculo ainda sem field', () => {
    const { result } = setup({ value: undefined });

    fireEvent.click(toggle('Valor exibido'));

    expect(result()?.value).toEqual({});
  });

  it('desligar apaga o vínculo inteiro, não só o field', () => {
    const { result } = setup({ value: { field: 'cpu' } });

    expect(toggle('Valor exibido')).toBeChecked();
    fireEvent.click(toggle('Valor exibido'));

    expect(result()?.value).toBeUndefined();
  });
});

describe('NodeForm — ícone', () => {
  it('vem ligado por padrão', () => {
    setup();

    expect(toggle('Exibir ícone')).toBeChecked();
    expect(screen.getByRole('button', { name: 'Servidor' })).toBeInTheDocument();
  });

  it('desligar grava a flag', () => {
    const { result } = setup();

    fireEvent.click(toggle('Exibir ícone'));

    // O formulário é controlado: quem re-renderiza é o painel, com a topologia
    // nova. Aqui só cabe verificar o que foi escrito — o efeito na tela é o
    // caso de `showIcon: false` abaixo.
    expect(result()?.presentation.showIcon).toBe(false);
  });

  it('com a flag desligada, a grade não aparece', () => {
    setup({ presentation: { ...node.presentation, showIcon: false } });

    expect(toggle('Exibir ícone')).not.toBeChecked();
    expect(screen.queryByRole('button', { name: 'Servidor' })).not.toBeInTheDocument();
  });

  it('escolher um ícone grava a chave da biblioteca', () => {
    const { result } = setup();

    fireEvent.click(screen.getByRole('button', { name: 'Firewall' }));

    expect(result()?.presentation.icon).toBe('firewall');
  });

  /** Sem `icon` salvo, a grade precisa marcar o genérico — nunca nada. */
  it('marca o ícone selecionado, e o genérico quando não há nenhum', () => {
    setup({ presentation: { ...node.presentation, icon: undefined } });

    expect(screen.getByRole('button', { name: 'Genérico' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Switch' })).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('NodeForm — thresholds do elemento', () => {
  /** O botão abre um menu de tipos; a regra só nasce ao escolher um deles. */
  const addRule = (tipo: string) => {
    fireEvent.click(screen.getByRole('button', { name: /Adicionar regra/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: new RegExp(tipo) }));
  };

  it('sem regra própria, avisa que o field continua mandando', () => {
    setup({ thresholds: undefined });

    expect(screen.getByText(/segue os thresholds configurados no field/)).toBeInTheDocument();
  });

  it('a cor de repouso aparece como a linha Base, ao pé da lista', () => {
    setup();

    expect(screen.getByText('Base')).toBeInTheDocument();
    // O rótulo antigo saiu: a Base ocupa o lugar dele.
    expect(screen.queryByText('Cor de repouso')).not.toBeInTheDocument();
  });

  it('adicionar o primeiro threshold cria a regra', () => {
    const { result } = setup({ thresholds: undefined });

    addRule('Threshold');

    expect(result()?.thresholds?.steps).toEqual([{ type: 'threshold', value: 80, color: 'yellow' }]);
  });

  it('os thresholds ficam ordenados do maior para o menor', () => {
    const { result } = setup({
      thresholds: { steps: [{ type: 'threshold' as const, value: 70, color: 'orange' }] },
    });

    addRule('Threshold');

    // `flatMap` em vez de `map`: a lista é uma união de tipos de regra, e só a
    // de threshold tem `value`.
    const valores = result()?.thresholds?.steps.flatMap((rule) => (rule.type === 'threshold' ? [rule.value] : []));

    expect(valores).toEqual([80, 70]);
  });

  /** Voltar a zero regras devolve o elemento ao pipeline nativo (D8). */
  it('remover a última regra apaga o objeto inteiro', () => {
    const { result } = setup({
      thresholds: { steps: [{ type: 'threshold' as const, value: 90, color: 'red' }] },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Remover regra' }));

    expect(result()?.thresholds).toBeUndefined();
  });

  it('editar o valor de uma regra reescreve só ela', () => {
    const { result } = setup({
      thresholds: { steps: [{ type: 'threshold' as const, value: 90, color: 'red', label: 'crítico' }] },
    });

    fireEvent.change(screen.getByLabelText('Valor da regra 1'), { target: { value: '95' } });

    expect(result()?.thresholds?.steps).toEqual([
      { type: 'threshold', value: 95, color: 'red', label: 'crítico' },
    ]);
  });

  it('o campo de estado continua acima das regras', () => {
    setup();

    expect(screen.getByText('Campo de estado')).toBeInTheDocument();
  });
});

/**
 * A fusão pedida na rodada de correções: os tipos que no Grafana vivem no
 * Value mappings entram na mesma lista dos thresholds.
 */
describe('NodeForm — tipos de regra vindos do Value mappings', () => {
  const addRule = (tipo: string) => {
    fireEvent.click(screen.getByRole('button', { name: /Adicionar regra/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: new RegExp(tipo) }));
  };

  it('valor exato', () => {
    const { result } = setup({ thresholds: undefined });

    addRule('Valor');

    expect(result()?.thresholds?.steps).toEqual([{ type: 'value', match: '', color: 'blue' }]);
  });

  it('faixa', () => {
    const { result } = setup({ thresholds: undefined });

    addRule('Faixa');

    expect(result()?.thresholds?.steps).toEqual([{ type: 'range', from: 0, to: 10, color: 'blue' }]);
  });

  it('regex', () => {
    const { result } = setup({ thresholds: undefined });

    addRule('Regex');

    expect(result()?.thresholds?.steps).toEqual([{ type: 'regex', pattern: '', color: 'blue' }]);
  });

  it('especial', () => {
    const { result } = setup({ thresholds: undefined });

    addRule('Especial');

    expect(result()?.thresholds?.steps).toEqual([{ type: 'special', match: 'null', color: 'blue' }]);
  });

  it('cada tipo mostra a condição que lhe cabe', () => {
    setup({
      thresholds: {
        steps: [
          { type: 'range' as const, from: 1, to: 5, color: 'blue' },
          { type: 'threshold' as const, value: 90, color: 'red' },
        ],
      },
    });

    expect(screen.getByLabelText('Início da faixa da regra 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Fim da faixa da regra 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Valor da regra 2')).toBeInTheDocument();
  });

  it('o texto exibido é o mesmo campo para todos os tipos', () => {
    const { result } = setup({
      thresholds: { steps: [{ type: 'value' as const, match: '200', color: 'green' }] },
    });

    fireEvent.change(screen.getByLabelText('Texto exibido da regra 1'), { target: { value: 'UP' } });

    expect(result()?.thresholds?.steps).toEqual([
      { type: 'value', match: '200', color: 'green', label: 'UP' },
    ]);
  });
});

/**
 * Decisão D5: em modo Trigger a cor vem do mapa de severidade e nenhum controle
 * de threshold teria efeito. Esconder, e não desabilitar — um bloco inteiro
 * acinzentado ocupa mais espaço do que a informação "não se aplica" merece.
 */
describe('NodeForm — thresholds com fonte em Trigger', () => {
  it('o bloco de estado por métrica sai da tela', () => {
    setup({ trigger: { enabled: true, host: 'AGLIN-FW-STARTI' } });

    expect(screen.queryByText('Campo de estado')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Adicionar regra/ })).not.toBeInTheDocument();
  });

  it('com o vínculo desligado, o bloco volta', () => {
    setup({ trigger: { enabled: false, host: 'AGLIN-FW-STARTI' } });

    expect(screen.getByText('Campo de estado')).toBeInTheDocument();
  });
});
