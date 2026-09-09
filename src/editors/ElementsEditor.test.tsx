import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { StandardEditorProps } from '@grafana/data';

import { sampleTopology } from '../model/sampleTopology';
import { TopoFlowOptions, Topology } from '../model/types';
import { TopoInstanceState } from '../panel/instanceState';
import { ElementsEditor } from './ElementsEditor';

/**
 * O editor recebe `panel.options.topology` **cru**: o Grafana entrega o que esta
 * salvo no dashboard, sem o Zod que o painel roda do outro lado. Estes testes
 * cobrem o que chega por ali e nao e uma `Topology` completa — que e o caso
 * normal de um dashboard antigo, nao uma excecao.
 */

/** O que o Grafana passa ao editor customizado; so `value` e `onChange` importam aqui. */
function props(value: unknown, onChange = jest.fn(), selected: string[] = []) {
  return {
    value,
    onChange,
    item: {},
    // O canal de selecao com o canvas. `select` nao e exercitado aqui: quem o
    // chama e o clique numa linha da lista, e o que muda de lado e o canvas.
    context: { data: [], instanceState: { selected, select: jest.fn() } },
  } as unknown as StandardEditorProps<Topology, unknown, TopoFlowOptions, TopoInstanceState>;
}

describe('ElementsEditor', () => {
  /**
   * O schema aceita de proposito uma topologia sem as colecoes novas (`.default([])`),
   * porque foi assim que os dashboards anteriores a elas ficaram salvos. A lista
   * do editor percorre as seis colecoes: sem normalizar, a aba inteira de opcoes
   * morria com "Cannot read properties of undefined (reading 'map')".
   */
  it('abre uma topologia salva antes das coleções novas existirem', () => {
    const antiga = { nodes: sampleTopology.nodes, edges: sampleTopology.edges };

    render(<ElementsEditor {...props(antiga)} />);

    expect(screen.getByText('rtr-borda-01')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Adicionar elemento/ })).toBeInTheDocument();
  });

  /**
   * Corrompida e diferente de incompleta: aqui nao ha o que normalizar, e o
   * editor se cala em vez de oferecer formularios que escreveriam por cima do
   * que esta salvo.
   */
  it('não oferece edição quando a topologia salva não valida', () => {
    render(<ElementsEditor {...props({ nodes: 'não é uma lista' })} />);

    expect(screen.queryByRole('button', { name: /Adicionar elemento/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Panel JSON/)).toBeInTheDocument();
  });

  /**
   * Painel recem-adicionado: nao ha topologia salva e o default e vazio. O
   * editor tem de abrir na lista em branco, com o botao de adicionar — e nao
   * cair num exemplo que o usuario teria de apagar antes de comecar.
   */
  it('abre vazio, e editável, quando o painel ainda não tem topologia', () => {
    render(<ElementsEditor {...props(undefined)} />);

    expect(screen.getByText('Nenhum elemento ainda.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Adicionar elemento/ })).toBeInTheDocument();
  });
});

/**
 * O Ctrl+clique do React Flow ja selecionava varias arestas; o que faltava era o
 * canal `instanceState` publicar mais de um id, e o Layer fazer algo com isso.
 * Estes testes cobrem a ponta do Layer — a do canvas esta em `keepSelection` e na
 * publicacao da selecao.
 */
describe('ElementsEditor — edição em massa', () => {
  const [a, b] = sampleTopology.edges;
  const [node] = sampleTopology.nodes;

  it('com duas conexões selecionadas, oferece a edição em massa', () => {
    render(<ElementsEditor {...props(sampleTopology, jest.fn(), [a.id, b.id])} />);

    expect(screen.getByText('2 conexões selecionadas')).toBeInTheDocument();
  });

  /** Uma só tem formulário próprio; o bloco em massa não teria o que somar. */
  it('uma conexão sozinha não abre o bloco', () => {
    render(<ElementsEditor {...props(sampleTopology, jest.fn(), [a.id])} />);

    expect(screen.queryByText(/conexões selecionadas/)).not.toBeInTheDocument();
  });

  it('sem seleção nenhuma, o Layer é o de sempre', () => {
    render(<ElementsEditor {...props(sampleTopology)} />);

    expect(screen.queryByText(/conexões selecionadas/)).not.toBeInTheDocument();
  });

  /**
   * Um no que entrou na selecao nao pode calar o bloco: o usuario nao teria como
   * saber por que. O rotulo diz **conexoes**, e o no fica de fora da escrita.
   */
  it('nó junto na seleção não impede a edição das conexões', () => {
    render(<ElementsEditor {...props(sampleTopology, jest.fn(), [node.id, a.id, b.id])} />);

    expect(screen.getByText('2 conexões selecionadas')).toBeInTheDocument();
  });

  /**
   * O realce acompanha a selecao **inteira**, e nao so o primeiro id — era isso
   * que o canal antigo permitia, e era o sintoma visivel de que o Layer nao
   * sabia da selecao multipla.
   */
  it('realça todas as linhas selecionadas, nó e conexão juntos', () => {
    const { container } = render(<ElementsEditor {...props(sampleTopology, jest.fn(), [node.id, a.id])} />);

    expect(container.querySelectorAll('[data-selected]')).toHaveLength(2);
  });

  it('sem seleção, nenhuma linha fica realçada', () => {
    const { container } = render(<ElementsEditor {...props(sampleTopology)} />);

    expect(container.querySelectorAll('[data-selected]')).toHaveLength(0);
  });

  /**
   * Regressao do defeito relatado: "so a primeira que clico aplica as mudancas".
   *
   * O clique inicial numa conexao abre o formulario **dela**. Quando o
   * Ctrl+clique seguinte fazia o bloco em massa nascer no topo, aquele
   * formulario continuava aberto logo abaixo — e era nele que o usuario estava
   * olhando. Ele editava o que via, e so a primeira conexao mudava.
   *
   * O contrato agora e um so: **uma superficie de edicao por vez**.
   */
  it('selecionar a segunda conexão fecha o formulário individual da primeira', () => {
    // Comeca sem selecao e seleciona depois, como no uso real: o painel de
    // opcoes ja esta montado quando o clique acontece no canvas.
    const { rerender, container } = render(<ElementsEditor {...props(sampleTopology)} />);

    rerender(<ElementsEditor {...props(sampleTopology, jest.fn(), [a.id])} />);
    // Com uma só, o formulário dela abre — é o comportamento de sempre.
    expect(screen.getByLabelText('Rótulo')).toBeInTheDocument();

    rerender(<ElementsEditor {...props(sampleTopology, jest.fn(), [a.id, b.id])} />);

    expect(screen.getByText('2 conexões selecionadas')).toBeInTheDocument();
    expect(container.querySelectorAll('[data-selected]')).toHaveLength(2);

    // A asserção que importa: sobra **um** campo Rótulo na tela, o do bloco em
    // massa. Com o defeito eram dois — o individual da primeira continuava
    // aberto embaixo, e era nele que o usuário editava.
    expect(screen.getAllByLabelText('Rótulo')).toHaveLength(1);
  });

  /** Voltar a uma só devolve o formulário individual daquela. */
  it('reduzir a seleção a uma reabre o formulário dela', () => {
    const { rerender } = render(<ElementsEditor {...props(sampleTopology, jest.fn(), [a.id, b.id])} />);
    expect(screen.getByText('2 conexões selecionadas')).toBeInTheDocument();

    rerender(<ElementsEditor {...props(sampleTopology, jest.fn(), [b.id])} />);

    expect(screen.queryByText(/conexões selecionadas/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Rótulo')).toBeInTheDocument();
  });

  /**
   * Deselecionar (clique no vazio do canvas) nao fecha nada: fechar o formulario
   * a cada clique perdido seria hostil, e essa decisao e anterior a edicao em
   * massa. A correcao acima nao podia atropela-la.
   */
  it('perder a seleção não fecha o formulário aberto', () => {
    const { rerender } = render(<ElementsEditor {...props(sampleTopology)} />);

    rerender(<ElementsEditor {...props(sampleTopology, jest.fn(), [a.id])} />);
    expect(screen.getByLabelText('Rótulo')).toBeInTheDocument();

    rerender(<ElementsEditor {...props(sampleTopology, jest.fn(), [])} />);

    expect(screen.getByLabelText('Rótulo')).toBeInTheDocument();
  });

  /**
   * O caminho inverso: abrir uma linha pela lista foca aquele elemento no canvas
   * — e e o que dissolve a selecao multipla, devolvendo a tela ao formulario
   * individual. Sem isso nao haveria como sair da edicao em massa pelo Layer.
   */
  /**
   * O bloco nasce no **topo** de uma lista longa. Quem rolou ate a secao de
   * Conexoes para clicar nelas nao o veria aparecer — e foi assim que a primeira
   * versao falhou, com o usuario editando o formulario que tinha diante dos
   * olhos.
   */
  describe('rolagem', () => {
    /** Devolve os elementos em que `scrollIntoView` foi chamado, na ordem. */
    function espiarRolagem() {
      const alvos: Element[] = [];
      jest.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(function (this: Element) {
        alvos.push(this);
      });
      return alvos;
    }

    afterEach(() => jest.restoreAllMocks());

    it('traz o bloco de edição em massa para a vista quando ele aparece', () => {
      const alvos = espiarRolagem();
      const { rerender } = render(<ElementsEditor {...props(sampleTopology)} />);

      rerender(<ElementsEditor {...props(sampleTopology, jest.fn(), [a.id, b.id])} />);

      expect(alvos.some((el) => el.textContent?.includes('2 conexões selecionadas'))).toBe(true);
    });

    /**
     * O defeito relatado: as duas rolagens disputavam. O bloco subia a tela, e
     * logo depois a linha recem-realcada a trazia de volta para baixo — os
     * efeitos das linhas rodam depois do dele, entao a lista sempre vencia.
     */
    it('as linhas da lista não disputam a rolagem durante a edição em massa', () => {
      const alvos = espiarRolagem();
      const { rerender } = render(<ElementsEditor {...props(sampleTopology)} />);

      rerender(<ElementsEditor {...props(sampleTopology, jest.fn(), [a.id, b.id])} />);

      expect(alvos.filter((el) => el.hasAttribute('data-selected'))).toHaveLength(0);
    });

    /** Somar a terceira conexão devolve o bloco à vista, e não só a primeira vez. */
    it('cada conexão somada traz o bloco de volta', () => {
      const { rerender } = render(<ElementsEditor {...props(sampleTopology)} />);
      rerender(<ElementsEditor {...props(sampleTopology, jest.fn(), [a.id, b.id])} />);

      const alvos = espiarRolagem();
      rerender(<ElementsEditor {...props(sampleTopology, jest.fn(), [a.id, b.id, node.id])} />);

      expect(alvos.some((el) => el.textContent?.includes('2 conexões selecionadas'))).toBe(true);
    });

    /** Com um só selecionado, quem vai à vista é a linha dele — como sempre foi. */
    it('fora da edição em massa, a linha realçada continua se revelando', () => {
      const alvos = espiarRolagem();
      const { rerender } = render(<ElementsEditor {...props(sampleTopology)} />);

      rerender(<ElementsEditor {...props(sampleTopology, jest.fn(), [a.id])} />);

      expect(alvos.filter((el) => el.hasAttribute('data-selected')).length).toBeGreaterThan(0);
    });
  });

  /**
   * Os dois lados do caminho: os segmentos e as ancoras entre eles. Selecionar
   * os dois tipos juntos e o caso normal de quem montou um caminho por points, e
   * cada bloco anuncia quantos edita.
   */
  describe('points', () => {
    const pontos = [
      { id: 'p1', position: { x: 0, y: 0 }, color: {}, zIndex: 0 },
      { id: 'p2', position: { x: 0, y: 0 }, color: {}, zIndex: 0 },
    ];
    const comPontos = { ...sampleTopology, points: pontos };

    it('dois points selecionados abrem a edição em massa deles', () => {
      const { rerender } = render(<ElementsEditor {...props(comPontos)} />);

      rerender(<ElementsEditor {...props(comPontos, jest.fn(), ['p1', 'p2'])} />);

      expect(screen.getByText('2 points selecionados')).toBeInTheDocument();
    });

    it('um point sozinho não abre o bloco', () => {
      const { rerender } = render(<ElementsEditor {...props(comPontos)} />);

      rerender(<ElementsEditor {...props(comPontos, jest.fn(), ['p1'])} />);

      expect(screen.queryByText(/points selecionados/)).not.toBeInTheDocument();
    });

    it('conexões e points juntos abrem os dois blocos', () => {
      const { rerender } = render(<ElementsEditor {...props(comPontos)} />);

      rerender(<ElementsEditor {...props(comPontos, jest.fn(), [a.id, b.id, 'p1', 'p2'])} />);

      expect(screen.getByText('2 conexões selecionadas')).toBeInTheDocument();
      expect(screen.getByText('2 points selecionados')).toBeInTheDocument();
    });

    /** Um tipo com dois e outro com um: só o que tem massa ganha bloco. */
    it('só o tipo com mais de um selecionado ganha bloco', () => {
      const { rerender } = render(<ElementsEditor {...props(comPontos)} />);

      rerender(<ElementsEditor {...props(comPontos, jest.fn(), [a.id, b.id, 'p1'])} />);

      expect(screen.getByText('2 conexões selecionadas')).toBeInTheDocument();
      expect(screen.queryByText(/points selecionados/)).not.toBeInTheDocument();
    });
  });

  it('abrir uma linha na lista pede ao canvas para focar só ela', () => {
    const select = jest.fn();
    const p = props(sampleTopology, jest.fn(), [a.id, b.id]);
    (p.context as unknown as { instanceState: { select: jest.Mock } }).instanceState.select = select;

    render(<ElementsEditor {...p} />);
    fireEvent.click(screen.getByText('rtr-borda-01'));

    expect(select).toHaveBeenCalledWith('edge-router');
  });
});
