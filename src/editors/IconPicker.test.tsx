import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { listIcons, resolveIcon } from '../icons';
import { IconBrowser, IconPicker, filtrar } from './IconPicker';

/**
 * O navegador e a tela onde a biblioteca deixa de ser uma lista e vira pastas.
 * O que se protege aqui e a navegacao — abrir, filtrar, escolher — e o contrato
 * com quem persiste: o que sai daqui e a chave canonica, nunca o rotulo.
 */

const abrir = () => fireEvent.click(screen.getByLabelText('Ícone'));
const opcao = (nome: string) => screen.getByRole('option', { name: nome });

describe('IconPicker', () => {
  it('o campo mostra o ícone atual e abre o navegador', () => {
    render(<IconPicker value="classic/switch" onChange={jest.fn()} />);

    expect(screen.getByLabelText('Ícone')).toHaveTextContent('Switch');

    abrir();

    expect(screen.getByRole('option', { name: 'Switch' })).toHaveAttribute('aria-selected', 'true');
  });

  /** Mesma tolerância do canvas: um ícone que sumiu não pode esvaziar o campo. */
  it('chave desconhecida aparece como Genérico', () => {
    render(<IconPicker value="tolstoi" onChange={jest.fn()} />);

    expect(screen.getByLabelText('Ícone')).toHaveTextContent('Genérico');
  });

  /** Sem escolha prévia, a grade abre no Padrão — o pack que o produto recomenda. */
  it('escolher devolve a chave canônica da pasta aberta', () => {
    const onChange = jest.fn();
    render(<IconPicker value={undefined} onChange={onChange} />);

    abrir();
    fireEvent.click(opcao('Roteador'));

    expect(onChange).toHaveBeenCalledWith('topoflow/router');
  });

  it('o mesmo rótulo em outra pasta devolve outra chave', () => {
    const onChange = jest.fn();
    render(<IconPicker value="classic/switch" onChange={onChange} />);

    abrir();
    fireEvent.click(opcao('Roteador'));

    expect(onChange).toHaveBeenCalledWith('classic/router');
  });

  /** Nada escolhido não pode aparecer como escolha — o campo mostra o que o
   *  canvas desenha, a grade mostra o que o usuário decidiu. */
  it('sem ícone escolhido, a grade não marca nenhum', () => {
    render(<IconPicker value={undefined} onChange={jest.fn()} />);

    abrir();

    expect(screen.queryByRole('option', { selected: true })).not.toBeInTheDocument();
  });
});

describe('IconBrowser — pastas', () => {
  const montar = (selected = 'classic/router') =>
    render(<IconBrowser selected={selected} onSelect={jest.fn()} onDismiss={jest.fn()} />);

  /**
   * A coluna aparece mesmo com um pack so: ela e a estrutura da biblioteca. Se
   * so surgisse com o segundo pack, o usuario descobriria a organizacao da tela
   * justamente quando ela ficasse mais complexa.
   */
  it('lista “Todos os ícones” e cada pasta, com a contagem', () => {
    montar();

    expect(screen.getByRole('button', { name: /Todos os ícones/ })).toHaveTextContent(String(listIcons().length));
    expect(screen.getByRole('button', { name: /Clássicos/ })).toBeInTheDocument();
  });

  it('abre na pasta do ícone selecionado', () => {
    montar('classic/router');

    expect(screen.getByRole('button', { name: /Clássicos/ })).toHaveAttribute('data-active');
  });

  it('trocar de pasta troca o que a grade mostra', () => {
    montar('classic/router');

    const naPastaClassica = screen.getAllByRole('option').length;
    fireEvent.click(screen.getByRole('button', { name: /Todos os ícones/ }));

    expect(screen.getByRole('button', { name: /Todos os ícones/ })).toHaveAttribute('data-active');
    expect(screen.getAllByRole('option').length).toBeGreaterThan(naPastaClassica);
  });

  /**
   * `router`, `server` e `firewall` existem nos dois packs. E o caso que a chave
   * qualificada existe para resolver: em "Todos", os dois aparecem, e cada um
   * carrega a sua propria chave.
   */
  it('o mesmo nome em pastas diferentes convive sem ambiguidade', () => {
    montar();
    fireEvent.click(screen.getByRole('button', { name: /Todos os ícones/ }));

    expect(screen.getAllByRole('option', { name: 'Servidor' })).toHaveLength(2);
  });
});

describe('IconBrowser — busca', () => {
  const buscar = (termo: string) =>
    fireEvent.change(screen.getByPlaceholderText(/Buscar por nome/), { target: { value: termo } });

  beforeEach(() => {
    render(<IconBrowser selected="classic/router" onSelect={jest.fn()} onDismiss={jest.fn()} />);
  });

  it('filtra pelo rótulo', () => {
    buscar('fire');

    expect(opcao('Firewall')).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Roteador' })).not.toBeInTheDocument();
  });

  /** A busca vale dentro da pasta aberta; o vazio oferece a saída para "Todos". */
  it('o que existe só em outra pasta não polui o resultado', () => {
    buscar('impressora');

    expect(screen.queryByRole('option', { name: 'Impressora' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Há 1 em outra pasta/ })).toBeInTheDocument();
  });

  /** O nome técnico é o que o usuário de rede tem na cabeça. */
  it('filtra pela chave e pelos sinônimos', () => {
    buscar('router');
    expect(opcao('Roteador')).toBeInTheDocument();

    buscar('wifi');
    expect(opcao('Access point')).toBeInTheDocument();
  });

  it('estado vazio diz o que houve', () => {
    buscar('geladeira');

    expect(screen.getByText(/Nenhum ícone/)).toBeInTheDocument();
  });
});

/**
 * Sem isto, metade das buscas do usuário brasileiro falha em silêncio: quem
 * digita "generico" não acha "Genérico", e quem digita "Genérico" também não.
 */
describe('filtrar', () => {
  const icons = listIcons();

  it('ignora acento e caixa nos dois sentidos', () => {
    expect(filtrar(icons, 'generico').map((i) => i.name)).toContain('generic');
    expect(filtrar(icons, 'GENÉRICO').map((i) => i.name)).toContain('generic');
    expect(filtrar(icons, 'Banco de Dados').map((i) => i.name)).toContain('database');
  });

  it('busca vazia devolve tudo', () => {
    expect(filtrar(icons, '   ')).toHaveLength(icons.length);
  });

  it('busca sem resultado devolve lista vazia', () => {
    expect(filtrar(icons, 'geladeira')).toHaveLength(0);
  });

  it('procura nos sinônimos, não só no rótulo', () => {
    expect(filtrar(icons, 'lb').map((i) => i.name)).toContain('load-balancer');
    expect(filtrar([resolveIcon('cloud')], 'internet')).toHaveLength(1);
  });
});
