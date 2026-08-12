import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { Field, Input } from '@grafana/ui';

import { FieldLabel } from './FieldLabel';

/**
 * O padrao unico de tooltip do painel (0.7). O que se protege aqui sao as duas
 * armadilhas que o `Tooltip` do Grafana tem quando o gatilho e um icone dentro
 * de um `<label>` — as duas ja custaram um criterio de aceite em outros paineis.
 */

describe('FieldLabel', () => {
  const icone = () => screen.getByRole('button', { name: 'Mais informações' });

  it('sem info, é o rótulo cru — nada de ícone', () => {
    render(<FieldLabel>Largura</FieldLabel>);

    expect(screen.getByText('Largura')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mais informações' })).not.toBeInTheDocument();
  });

  it('com info, o ícone entra ao lado do rótulo', () => {
    render(<FieldLabel info="O último valor da métrica.">Valor</FieldLabel>);

    expect(screen.getByText('Valor')).toBeInTheDocument();
    expect(icone()).toBeInTheDocument();
  });

  /**
   * O gatilho e um `<button>` justamente por isto: foco de teclado sem depender
   * de o `Icon` repassar `tabIndex`, coisa que ele nao faz de forma confiavel.
   */
  it('o gatilho é alcançável pelo teclado', () => {
    render(<FieldLabel info="Explicação">Campo</FieldLabel>);

    icone().focus();

    expect(icone()).toHaveFocus();
  });

  it('o foco abre o tooltip', () => {
    render(<FieldLabel info="Métrica que alimenta as regras.">Campo</FieldLabel>);

    fireEvent.focus(icone());

    expect(screen.getByText('Métrica que alimenta as regras.')).toBeInTheDocument();
  });

  /**
   * O icone vive dentro do `<label>`, e clicar em qualquer ponto de um label
   * ativa o controle associado. Sem o `preventDefault`, ler a explicacao de um
   * checkbox o marcaria.
   */
  it('clicar no ícone não aciona o controle do campo', () => {
    render(
      <Field label={<FieldLabel info="Explicação">Ligado</FieldLabel>} htmlFor="alvo">
        <Input id="alvo" type="checkbox" />
      </Field>
    );

    const alvo = screen.getByRole('checkbox');
    fireEvent.click(icone());

    expect(alvo).not.toBeChecked();
  });
});
