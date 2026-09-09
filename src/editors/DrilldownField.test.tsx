import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { Drilldown } from '../model/types';
import { DrilldownField } from './DrilldownField';

/**
 * O campo escreve `Drilldown | undefined`, e a ausencia **e** o desligado — a
 * mesma convencao do `secondaryText` do no e da placa do texto. Um segundo campo
 * `enabled` seria um estado a manter em sincronia com a presenca do objeto,
 * livre para discordar dele.
 */

function setup(value?: Drilldown) {
  const onChange = jest.fn<void, [Drilldown | undefined]>();

  function Harness() {
    const [atual, setAtual] = React.useState(value);

    return (
      <DrilldownField
        value={atual}
        onChange={(next) => {
          onChange(next);
          setAtual(next);
        }}
      />
    );
  }

  render(<Harness />);

  return { onChange, result: () => onChange.mock.calls.at(-1)?.[0] };
}

const toggle = () => screen.getByRole('switch', { name: 'Drill-down' });
const campo = () => screen.getByLabelText('Link do drill-down');

describe('DrilldownField', () => {
  it('desligado, não há campo nenhum a preencher', () => {
    setup();

    expect(toggle()).not.toBeChecked();
    expect(screen.queryByLabelText('Link do drill-down')).not.toBeInTheDocument();
  });

  it('ligar cria o vínculo vazio, pronto para receber o endereço', () => {
    const { result } = setup();

    fireEvent.click(toggle());

    expect(result()).toEqual({ url: '' });
    expect(campo()).toBeInTheDocument();
  });

  it('desligar apaga o vínculo — ausência é o desligado', () => {
    const { result } = setup({ url: '/d/uid/detalhe' });

    fireEvent.click(toggle());

    expect(result()).toBeUndefined();
  });

  it('o endereço digitado vira o link', () => {
    const { result } = setup({ url: '' });

    fireEvent.change(campo(), { target: { value: '/d/uid/host?var-host=$host' } });

    expect(result()).toEqual({ url: '/d/uid/host?var-host=$host' });
  });

  /**
   * `undefined` e nao `false`: ausente ja significa mesma aba, e gravar o valor
   * explicito so encheria o JSON do dashboard com o default.
   */
  it('nova aba só aparece no JSON quando está ligada', () => {
    const { result } = setup({ url: '/d/uid' });
    const nova = screen.getByRole('switch', { name: 'Abrir em nova aba' });

    fireEvent.click(nova);
    expect(result()).toEqual({ url: '/d/uid', targetBlank: true });

    fireEvent.click(nova);
    expect(result()).toEqual({ url: '/d/uid', targetBlank: undefined });
  });

  /**
   * A linha do alvo e o que impede a conclusao do esquema de virar suposicao
   * silenciosa: quem precisa de `http://` ve `https://` na tela e corrige.
   */
  it('mostra o endereço que vai de fato abrir, com o esquema completado', () => {
    setup({ url: 'www.google.com' });

    expect(screen.getByText('https://www.google.com')).toBeInTheDocument();
  });

  it('distingue quem sai do Grafana de quem fica', () => {
    setup({ url: '/d/uid/detalhe' });
    expect(screen.getByText(/Abre neste Grafana/)).toBeInTheDocument();
  });

  it('anuncia a saída para outra plataforma', () => {
    setup({ url: 'https://zabbix.corp/tr_events.php' });
    expect(screen.getByText(/Sai do Grafana para/)).toBeInTheDocument();
  });

  it('sem endereço não há alvo a mostrar', () => {
    setup({ url: '' });

    expect(screen.queryByText(/Abre neste Grafana/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Sai do Grafana para/)).not.toBeInTheDocument();
  });

  /** Sem esta linha, quem configura clica no editor, nada acontece, e desiste. */
  it('explica que o link não abre dentro do editor', () => {
    setup({ url: '/d/uid' });

    expect(screen.getByText(/só abre no dashboard/)).toBeInTheDocument();
  });
});
