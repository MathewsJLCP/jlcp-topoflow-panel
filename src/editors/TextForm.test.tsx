import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { sampleTopology } from '../model/sampleTopology';
import { TopoText, Topology } from '../model/types';
import { TextForm } from './ElementForms';

/**
 * Bloco 6. O Texto e o elemento decorativo do painel: conteudo, cor, placa e
 * tamanho — e nada que dependa de dado.
 */

const [text] = sampleTopology.texts;

function setup(overrides: Partial<TopoText> = {}) {
  const element: TopoText = { ...text, ...overrides };
  const topology: Topology = { ...sampleTopology, texts: [element] };
  const onChange = jest.fn<void, [Topology]>();

  render(<TextForm element={element} topology={topology} frames={[]} onChange={onChange} />);

  return { onChange, result: () => onChange.mock.calls.at(-1)?.[0].texts[0] };
}

const toggle = () => screen.getByRole('switch', { name: 'Background' });

describe('TextForm — sem fonte de estado', () => {
  it('não há bloco Estado nem seletor de métrica', () => {
    setup();

    expect(screen.queryByText('Estado')).not.toBeInTheDocument();
    expect(screen.queryByText('Campo')).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Métrica' })).not.toBeInTheDocument();
  });

  /**
   * Decisão (a): a cor do Texto é fixa; o radio Fixo|Field saiu de "Cor".
   *
   * Sobra **um** Fixo|Field na tela, e ele é do Conteúdo — o que o texto diz
   * pode vir de um field, e isso nunca foi fonte de estado: muda a palavra, não
   * a cor. Se um segundo aparecer aqui, é a cor voltando a se vincular a dado.
   */
  it('só o Conteúdo oferece vínculo com field — a cor, não', () => {
    setup();

    expect(screen.getByText('Cor')).toBeInTheDocument();
    expect(screen.getAllByRole('radio', { name: 'Field' })).toHaveLength(1);
  });
});

describe('TextForm — background', () => {
  it('nasce desligado num texto sem placa', () => {
    setup({ background: undefined });

    expect(toggle()).not.toBeChecked();
  });

  it('vem ligado num texto salvo com placa', () => {
    setup({ background: { color: 'blue', opacity: 0.3 } });

    expect(toggle()).toBeChecked();
  });

  /** Cor de tema, e não hex: é o que faz a placa acompanhar claro/escuro. */
  it('ligar cria a placa com um padrão discreto e dependente do tema', () => {
    const { result } = setup({ background: undefined });

    fireEvent.click(toggle());

    expect(result()?.background).toEqual({ color: '#14141C', opacity: 0.8 });
  });

  it('desligar apaga a placa inteira — ausência é o transparente', () => {
    const { result } = setup({ background: { color: 'blue', opacity: 0.3 } });

    fireEvent.click(toggle());

    expect(result()?.background).toBeUndefined();
  });
});

describe('TextForm — tamanho da fonte', () => {
  /** A faixa do mockup: de 8 a 72, o valor escrito ao lado. */
  it('persiste o valor da faixa', () => {
    const { result } = setup({ fontSize: 16 });

    fireEvent.change(screen.getByLabelText('Tamanho da fonte'), { target: { value: '24' } });

    expect(result()?.fontSize).toBe(24);
  });

  it('a faixa vai de 8 a 72, a do schema', () => {
    setup({ fontSize: 16 });
    const faixa = screen.getByLabelText('Tamanho da fonte');

    expect(faixa).toHaveAttribute('min', '8');
    expect(faixa).toHaveAttribute('max', '72');
  });
});
