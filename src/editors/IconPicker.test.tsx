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
    render(<IconPicker value="padrao/switch" onChange={jest.fn()} />);

    expect(screen.getByLabelText('Ícone')).toHaveTextContent('Switch');

    abrir();

    expect(screen.getByRole('option', { name: 'Switch' })).toHaveAttribute('aria-selected', 'true');
  });

  /** Mesma tolerância do canvas: um ícone que sumiu não pode esvaziar o campo. */
  it('chave desconhecida aparece como Desconhecido', () => {
    render(<IconPicker value="tolstoi" onChange={jest.fn()} />);

    expect(screen.getByLabelText('Ícone')).toHaveTextContent('Desconhecido');
  });

  /** Sem escolha prévia, a grade abre no Padrão — o pack que o produto recomenda. */
  it('escolher devolve a chave canônica da pasta aberta', () => {
    const onChange = jest.fn();
    render(<IconPicker value={undefined} onChange={onChange} />);

    abrir();
    fireEvent.click(opcao('Roteador'));

    expect(onChange).toHaveBeenCalledWith('padrao/roteador');
  });

  it('o mesmo rótulo em outra pasta devolve outra chave', () => {
    const onChange = jest.fn();
    render(<IconPicker value="infra/switch" onChange={onChange} />);

    abrir();
    fireEvent.click(opcao('Roteador'));

    expect(onChange).toHaveBeenCalledWith('infra/roteador');
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
  const montar = (selected = 'padrao/roteador') =>
    render(<IconBrowser selected={selected} onSelect={jest.fn()} onDismiss={jest.fn()} />);

  /**
   * A coluna aparece mesmo com um pack so: ela e a estrutura da biblioteca. Se
   * so surgisse com o segundo pack, o usuario descobriria a organizacao da tela
   * justamente quando ela ficasse mais complexa.
   */
  it('lista “Todos os ícones” e cada pasta, com a contagem', () => {
    montar();

    expect(screen.getByRole('button', { name: /Todos os ícones/ })).toHaveTextContent(String(listIcons().length));
    expect(screen.getByRole('button', { name: /Infra/ })).toBeInTheDocument();
    // Os Clássicos saíram da biblioteca na v1.4.
    expect(screen.queryByRole('button', { name: /Clássicos/ })).not.toBeInTheDocument();
  });

  it('abre na pasta do ícone selecionado', () => {
    montar('infra/roteador');

    expect(screen.getByRole('button', { name: /Infra/ })).toHaveAttribute('data-active');
  });

  it('trocar de pasta troca o que a grade mostra', () => {
    montar('infra/roteador');

    const naPastaClassica = screen.getAllByRole('option').length;
    fireEvent.click(screen.getByRole('button', { name: /Todos os ícones/ }));

    expect(screen.getByRole('button', { name: /Todos os ícones/ })).toHaveAttribute('data-active');
    expect(screen.getAllByRole('option').length).toBeGreaterThan(naPastaClassica);
  });

  /**
   * `router`, `server` e `firewall` existem em mais de um pack. E o caso que a
   * chave qualificada existe para resolver: em "Todos", todos aparecem, e cada
   * um carrega a sua propria chave.
   *
   * O numero esperado sai do proprio catalogo, e nao de uma constante: escrito a
   * mao, ele quebrava a cada pack novo (e quebrou, quando o Zabbix entrou e
   * trouxe o terceiro "Servidor") num teste que nunca foi sobre quantos sao.
   */
  it('o mesmo nome em pastas diferentes convive sem ambiguidade', () => {
    const homonimos = listIcons().filter((icon) => icon.label === 'Servidor');
    expect(homonimos.length).toBeGreaterThan(1);

    montar();
    fireEvent.click(screen.getByRole('button', { name: /Todos os ícones/ }));

    expect(screen.getAllByRole('option', { name: 'Servidor' })).toHaveLength(homonimos.length);
  });
});

describe('IconBrowser — busca', () => {
  const buscar = (termo: string) =>
    fireEvent.change(screen.getByPlaceholderText(/Buscar por nome/), { target: { value: termo } });

  beforeEach(() => {
    render(<IconBrowser selected="padrao/roteador" onSelect={jest.fn()} onDismiss={jest.fn()} />);
  });

  it('filtra pelo rótulo', () => {
    buscar('fire');

    expect(opcao('Firewall')).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Roteador' })).not.toBeInTheDocument();
  });

  /**
   * A busca vale dentro da pasta aberta; o vazio oferece a saída para "Todos".
   *
   * O atalho conta quantos ficaram fora, e essa contagem muda a cada pack novo —
   * entao o teste casa com a frase, nao com o numero. O que ele afirma e que o
   * atalho apareceu, e isso vale com 1 ou com 5.
   */
  it('o que existe só em outra pasta não polui o resultado', () => {
    buscar('sonda');

    expect(screen.queryByRole('option', { name: 'Sonda' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Há \d+ em outra/ })).toBeInTheDocument();
  });

  /** O nome técnico é o que o usuário de rede tem na cabeça. */
  it('filtra pela chave e pelos sinônimos', () => {
    buscar('router');
    expect(opcao('Roteador')).toBeInTheDocument();

    buscar('wireless');
    expect(opcao('Wi-Fi')).toBeInTheDocument();
  });

  it('estado vazio diz o que houve', () => {
    buscar('geladeira');

    expect(screen.getByText(/Nenhum ícone/)).toBeInTheDocument();
  });
});

/**
 * Sem isto, metade das buscas do usuário brasileiro falha em silêncio: quem
 * digita "parabolica" não acha "Antena parabólica", e o contrário também não.
 */
describe('filtrar', () => {
  const icons = listIcons();

  it('ignora acento e caixa nos dois sentidos', () => {
    expect(filtrar(icons, 'parabolica').map((i) => i.name)).toContain('antena-parabolica');
    expect(filtrar(icons, 'PARABÓLICA').map((i) => i.name)).toContain('antena-parabolica');
    expect(filtrar(icons, 'Banco de Dados').map((i) => i.name)).toContain('banco-de-dados');
  });

  it('busca vazia devolve tudo', () => {
    expect(filtrar(icons, '   ')).toHaveLength(icons.length);
  });

  it('busca sem resultado devolve lista vazia', () => {
    expect(filtrar(icons, 'geladeira')).toHaveLength(0);
  });

  it('procura nos sinônimos, não só no rótulo', () => {
    expect(filtrar(icons, 'generico').map((i) => i.name)).toContain('desconhecido');
    expect(filtrar([resolveIcon('padrao/internet')], 'wan')).toHaveLength(1);
  });
});
