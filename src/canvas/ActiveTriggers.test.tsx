import React from 'react';
import { render, screen } from '@testing-library/react';

import { ElementColor } from '../data/elementColor';
import { ActiveProblem } from '../data/triggerState';
import { TriggerBinding } from '../model/types';
import { ActiveTriggers, activeProblems } from './ActiveTriggers';

/**
 * A extensao e o que responde "qual trigger caiu?" **sem** interacao — o hover
 * nao serve a um telao de parede, onde ninguem passa o mouse.
 */

const problema = (name: string, severity: 0 | 1 | 2 | 3 | 4 | 5 = 4): ActiveProblem => ({
  name,
  severity,
  label: 'High',
  color: '#f00',
});

const lista = (quantas: number) => Array.from({ length: quantas }, (_, i) => problema(`Trigger ${i + 1}`));

describe('ActiveTriggers', () => {
  it('lista as triggers ativas embaixo do elemento', () => {
    render(<ActiveTriggers problems={[problema('Unavailable by ICMP ping'), problema('CPU load > 90%')]} />);

    expect(screen.getByText('Unavailable by ICMP ping')).toBeInTheDocument();
    expect(screen.getByText('CPU load > 90%')).toBeInTheDocument();
  });

  /**
   * Sem teto, um no com quinze alarmes cobriria os elementos abaixo dele —
   * justamente no pico, quando a topologia precisa continuar legivel.
   */
  it('acima de três linhas, o resto vira um contador', () => {
    render(<ActiveTriggers problems={lista(6)} />);

    expect(screen.getByText('Trigger 3')).toBeInTheDocument();
    expect(screen.queryByText('Trigger 4')).not.toBeInTheDocument();
    expect(screen.getByText('+3 outras')).toBeInTheDocument();
  });

  it('exatamente três não gera contador', () => {
    render(<ActiveTriggers problems={lista(3)} />);

    expect(screen.getByText('Trigger 3')).toBeInTheDocument();
    expect(screen.queryByText(/outras?$/)).not.toBeInTheDocument();
  });

  it('uma só sobrando é “outra”, não “outras”', () => {
    render(<ActiveTriggers problems={lista(4)} />);

    expect(screen.getByText('+1 outra')).toBeInTheDocument();
  });

  it('sem problemas, não ocupa espaço nenhum', () => {
    const { container } = render(<ActiveTriggers problems={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  /** A severidade tambem por texto: cor sozinha nao serve a quem nao a distingue. */
  it('a severidade viaja no title, além da cor', () => {
    render(<ActiveTriggers problems={[problema('Unavailable by ICMP ping')]} />);

    expect(screen.getByTitle('High: Unavailable by ICMP ping')).toBeInTheDocument();
  });
});

/**
 * O segundo formato: uma linha com o total, para a topologia densa em que
 * importa **quanto** esta caindo — o **que** continua no hover.
 */
describe('ActiveTriggers — total de incidentes', () => {
  it('troca os nomes por uma linha só com a contagem', () => {
    render(<ActiveTriggers problems={lista(4)} display="count" />);

    expect(screen.getByText('4 incidentes ativos')).toBeInTheDocument();
    expect(screen.queryByText('Trigger 1')).not.toBeInTheDocument();
    expect(screen.queryByText(/outras?$/)).not.toBeInTheDocument();
  });

  /** O teto de tres nao existe aqui: a contagem e uma linha para qualquer numero. */
  it('conta todos, inclusive acima do teto da lista', () => {
    render(<ActiveTriggers problems={lista(15)} display="count" />);

    expect(screen.getByText('15 incidentes ativos')).toBeInTheDocument();
  });

  it('um só é “1 incidente ativo”', () => {
    render(<ActiveTriggers problems={lista(1)} display="count" />);

    expect(screen.getByText('1 incidente ativo')).toBeInTheDocument();
  });

  it('sem alarme, continua sem ocupar espaço', () => {
    const { container } = render(<ActiveTriggers problems={[]} display="count" />);

    expect(container).toBeEmptyDOMElement();
  });

  /** Trocar de formato muda quanto se le, nunca o que a cor diz. */
  it('a linha veste a maior severidade em curso', () => {
    const disaster: ActiveProblem = { name: 'Disaster', severity: 5, label: 'Disaster', color: '#00f' };
    const { container } = render(<ActiveTriggers problems={[disaster, problema('outra')]} display="count" />);

    // A linha e a filha da pilha; `container` e o wrapper do testing-library.
    expect(container.firstElementChild?.firstElementChild).toHaveStyle({ borderLeftColor: '#00f' });
  });

  /** O nome de cada trigger nao se perde: vai para o title, e para o hover. */
  it('os nomes viajam no title', () => {
    render(<ActiveTriggers problems={[problema('ICMP'), problema('CPU')]} display="count" />);

    // O `getByTitle` normaliza a quebra de linha em espaco; no DOM sao duas linhas.
    expect(screen.getByTitle('High: ICMP High: CPU')).toBeInTheDocument();
  });

  /** Default explicito: quem nao escolheu formato continua vendo os nomes. */
  it('sem formato pedido, lista os nomes', () => {
    render(<ActiveTriggers problems={lista(2)} />);

    expect(screen.getByText('Trigger 1')).toBeInTheDocument();
    expect(screen.queryByText(/incidentes? ativos?/)).not.toBeInTheDocument();
  });
});

describe('activeProblems', () => {
  const alarme: ElementColor = {
    state: 'trigger',
    color: '#f00',
    severity: 4,
    label: 'High',
    problems: lista(2),
  };
  const binding = (showActive: boolean): TriggerBinding => ({ enabled: true, host: 'HOST', names: [], showActive });

  it('lista quando há alarme e o toggle está ligado', () => {
    expect(activeProblems(alarme, binding(true))).toHaveLength(2);
  });

  it('cala com o toggle desligado', () => {
    expect(activeProblems(alarme, binding(false))).toHaveLength(0);
  });

  /** Vínculo montado à mão ou vindo de JSON antigo não pode nascer mudo. */
  it('sem a flag, vale ligado', () => {
    expect(activeProblems(alarme, { enabled: true, host: 'HOST' } as TriggerBinding)).toHaveLength(2);
  });

  it('sem alarme não há o que listar', () => {
    expect(activeProblems({ state: 'threshold', color: '#f00' }, binding(true))).toHaveLength(0);
  });
});

/**
 * De que lado a pilha pousa. É `bottom` por padrão porque era o único lugar
 * possível até aqui — e por isso nenhuma topologia salva muda de aparência.
 */
describe('ActiveTriggers — posição', () => {
  const pilha = (container: HTMLElement) => container.firstElementChild as HTMLElement;

  it('sem posição pedida, fica embaixo do elemento', () => {
    const { container } = render(<ActiveTriggers problems={lista(1)} />);

    expect(pilha(container)).toHaveStyle({ top: '100%' });
  });

  it('cada lado ancora no seu', () => {
    const { container: cima } = render(<ActiveTriggers problems={lista(1)} position="top" />);
    expect(pilha(cima)).toHaveStyle({ bottom: '100%' });

    const { container: esq } = render(<ActiveTriggers problems={lista(1)} position="left" />);
    expect(pilha(esq)).toHaveStyle({ right: '100%' });

    const { container: dir } = render(<ActiveTriggers problems={lista(1)} position="right" />);
    expect(pilha(dir)).toHaveStyle({ left: '100%' });
  });

  /** Nas laterais as linhas crescem para longe do elemento. */
  it('à esquerda, as linhas alinham pela borda de dentro', () => {
    const { container } = render(<ActiveTriggers problems={lista(3)} position="left" />);

    expect(pilha(container)).toHaveStyle({ alignItems: 'flex-end' });
  });
});
