import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { ColorDimension, ElementRule, ElementThresholds } from '../model/types';
import { ThresholdsEditor } from './ThresholdsEditor';

/**
 * O editor e exercitado **sem passar por formulario nenhum**: e o que prova o
 * criterio do Bloco 2 de que ele nao depende do no. As props sao `ColorDimension`
 * e `ElementThresholds` crus, os dois tipos que Conexao e Point tambem terao no
 * Bloco 3.
 */

const BASE: ColorDimension = { fixed: 'green', field: 'cpu' };

function setup(thresholds?: ElementThresholds, color: ColorDimension = BASE, axis: 'metric' | 'trigger' = 'metric') {
  const onColorChange = jest.fn<void, [ColorDimension]>();
  const onThresholdsChange = jest.fn<void, [ElementThresholds | undefined]>();

  render(
    <ThresholdsEditor
      axis={axis}
      color={color}
      thresholds={thresholds}
      onColorChange={onColorChange}
      onThresholdsChange={onThresholdsChange}
    />
  );

  return {
    onColorChange,
    onThresholdsChange,
    rules: () => onThresholdsChange.mock.calls.at(-1)?.[0]?.steps,
    /** O que sobrou na última escrita de cor — a linha Base grava aqui. */
    color: () => onColorChange.mock.calls.at(-1)?.[0],
  };
}

const addRule = (tipo: string) => {
  fireEvent.click(screen.getByRole('button', { name: /Adicionar regra/ }));
  fireEvent.click(screen.getByRole('menuitem', { name: new RegExp(tipo) }));
};

const withRule = (rule: ElementRule): ElementThresholds => ({ steps: [rule] });

describe('ThresholdsEditor — contrato de edição', () => {
  it('adicionar cria a regra', () => {
    const { rules } = setup(undefined);

    addRule('Threshold');

    expect(rules()).toEqual([{ type: 'threshold', value: 80, color: 'yellow' }]);
  });

  it('editar a condição reescreve só ela', () => {
    const { rules } = setup(withRule({ type: 'threshold', value: 90, color: 'red', label: 'crítico' }));

    fireEvent.change(screen.getByLabelText('Valor da regra 1'), { target: { value: '95' } });

    expect(rules()).toEqual([{ type: 'threshold', value: 95, color: 'red', label: 'crítico' }]);
  });

  it('editar o rótulo reescreve só ele', () => {
    const { rules } = setup(withRule({ type: 'threshold', value: 90, color: 'red' }));

    fireEvent.change(screen.getByLabelText('Texto exibido da regra 1'), { target: { value: 'crítico' } });

    expect(rules()).toEqual([{ type: 'threshold', value: 90, color: 'red', label: 'crítico' }]);
  });

  /** Zero regras devolve o elemento ao pipeline nativo do Grafana (D8). */
  it('remover a última regra apaga o objeto inteiro', () => {
    const { onThresholdsChange } = setup(withRule({ type: 'threshold', value: 90, color: 'red' }));

    fireEvent.click(screen.getByRole('button', { name: 'Remover regra' }));

    expect(onThresholdsChange).toHaveBeenCalledWith(undefined);
  });
});

describe('ThresholdsEditor — a linha Base', () => {
  it('não é uma regra: não tem lixeira própria', () => {
    setup(undefined);

    expect(screen.getByText('Base')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remover regra' })).not.toBeInTheDocument();
  });

  it('o aviso de "sem regra própria" vive no tooltip, não no corpo', () => {
    setup(undefined);

    // Fora do tooltip o texto não ocupa linha nenhuma do formulário.
    expect(screen.queryByText(/segue os thresholds configurados no field/)).not.toBeInTheDocument();

    fireEvent.focus(screen.getByRole('button', { name: 'Mais informações' }));

    expect(screen.getByText(/segue os thresholds configurados no field/)).toBeInTheDocument();
  });
});

/**
 * O caso de dois campos foi o risco levantado no Bloco 0: `[cor][de][ate][rotulo]
 * [lixeira]` sao cinco controles, e num painel estreito eles nao cabem numa linha
 * so. A quebra e resolvida no CSS (`flex-wrap`), entao o que se garante aqui e o
 * que o jsdom alcanca: nenhum controle foi perdido no caminho.
 */
describe('ThresholdsEditor — regra de dois campos', () => {
  it('faixa mantém os dois campos e o rótulo', () => {
    setup(withRule({ type: 'range', from: 1, to: 5, color: 'blue' }));

    expect(screen.getByLabelText('Início da faixa da regra 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Fim da faixa da regra 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Texto exibido da regra 1')).toBeInTheDocument();
  });

  it('editar cada ponta da faixa não mexe na outra', () => {
    const { rules } = setup(withRule({ type: 'range', from: 1, to: 5, color: 'blue' }));

    fireEvent.change(screen.getByLabelText('Fim da faixa da regra 1'), { target: { value: '9' } });

    expect(rules()).toEqual([{ type: 'range', from: 1, to: 9, color: 'blue' }]);
  });
});

/**
 * A regra e o rotulo passaram a viver na mesma linha. O jsdom nao calcula
 * layout, entao o que da para fixar e a estrutura que o CSS assume: os quatro
 * controles da regra sao irmaos sob um unico elemento de linha.
 */
describe('ThresholdsEditor — uma regra, uma linha', () => {
  it('condição, rótulo e lixeira compartilham a mesma linha', () => {
    setup(withRule({ type: 'threshold', value: 90, color: 'red' }));

    const condicao = screen.getByLabelText('Valor da regra 1');
    const rotulo = screen.getByLabelText('Texto exibido da regra 1');
    const lixeira = screen.getByRole('button', { name: 'Remover regra' });

    const linha = lixeira.parentElement!;

    expect(linha).toContainElement(condicao);
    expect(linha).toContainElement(rotulo);
    // Antes do Bloco 2 a lixeira vivia num `ruleTop` que não continha o rótulo.
    expect(linha).toHaveStyle({ display: 'flex', flexWrap: 'wrap' });
  });
});

/**
 * A animacao virou coluna da linha da regra: `[cor] [condicao] [rotulo]
 * [animacao] [lixeira]`. So no eixo de metrica — em Trigger ela e do elemento.
 */
describe('ThresholdsEditor — animação por regra', () => {
  const seletor = () => screen.getByLabelText('Animação da regra 1');

  it('regra nasce parada', () => {
    setup(withRule({ type: 'threshold', value: 90, color: 'red' }));

    expect(seletor()).toHaveValue('Parado');
  });

  it('reflete a animação salva na regra', () => {
    setup(withRule({ type: 'threshold', value: 90, color: 'red', animation: 'radar' }));

    expect(seletor()).toHaveValue('Radar');
  });

  /**
   * A escolha em si não é exercitada aqui: o menu do `Combobox` é virtualizado e
   * não renderiza opção nenhuma no jsdom — um teste sobre ele exercitaria a
   * biblioteca, não este código. O que é nosso está coberto nos dois lados: o
   * schema aceita `animation` na regra (`parse.test.ts`) e a resolução escolhe a
   * animação da regra que casou (`alertAnimation.test.ts`).
   */
  it('cada regra tem o seu próprio seletor', () => {
    setup({
      steps: [
        { type: 'threshold', value: 90, color: 'red', animation: 'radar' },
        { type: 'threshold', value: 75, color: 'orange', animation: 'pulse' },
      ],
    });

    expect(screen.getByLabelText('Animação da regra 1')).toHaveValue('Radar');
    expect(screen.getByLabelText('Animação da regra 2')).toHaveValue('Pulsar');
  });

  it('em modo Trigger não há coluna de animação na regra', () => {
    setup(withRule({ type: 'severity', atLeast: 4, color: 'red' }), BASE, 'trigger');

    expect(screen.queryByLabelText('Animação da regra 1')).not.toBeInTheDocument();
  });
});
