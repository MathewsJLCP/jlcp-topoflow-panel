import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { ElementColor } from '../data/elementColor';
import { ActiveProblem } from '../data/triggerState';
import { ElementHover, countLabel, formatAge } from './ElementHover';

/**
 * O painel e a resposta a "qual trigger caiu?" — a pergunta que o cliente
 * levantou. O que se protege aqui e o contrato de abertura: hover no modo de
 * exibicao, clique que prende, e silencio absoluto no modo de edicao, onde o
 * elemento e alvo de arraste.
 */

const PROBLEMS: ActiveProblem[] = [
  { name: 'Unavailable by ICMP ping', severity: 4, label: 'High', color: '#f00', since: 1_700_000_000 },
  { name: 'CPU load too high', severity: 3, label: 'Average', color: '#f80' },
];

const alarme = (problems = PROBLEMS): ElementColor => ({
  state: 'trigger',
  color: '#f00',
  severity: 4,
  label: 'High',
  problems,
});

const card = () => screen.getByTestId('card');

function montar(
  accent: ElementColor,
  props: { editable?: boolean; dragging?: boolean; linked?: boolean; chart?: React.ReactElement } = {}
) {
  return render(
    <ElementHover accent={accent} title="CORE-SW-01" {...props}>
      <div data-testid="card">CORE-SW-01</div>
    </ElementHover>
  );
}

/** Faz as vezes do `MetricChart`, que tem testes proprios. */
const GRAFICO = <div data-testid="grafico">curva</div>;

describe('ElementHover', () => {
  it('lista as triggers alarmando, com severidade e tempo', () => {
    montar(alarme());

    fireEvent.focus(card());

    expect(screen.getByText('Unavailable by ICMP ping')).toBeInTheDocument();
    expect(screen.getByText('CPU load too high')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(screen.getByText('CORE-SW-01', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText('2 problemas ativos')).toBeInTheDocument();
  });

  /**
   * O elemento continua sendo o que era. Envolve-lo nao pode custar o card, nem
   * as classes de animacao e de selecao que vivem nele.
   */
  it('o elemento segue no lugar, alarmando ou nao', () => {
    const { unmount } = montar({ state: 'neutral' });
    expect(card()).toBeInTheDocument();
    unmount();

    montar(alarme());
    expect(card()).toBeInTheDocument();
  });

  it('sem alarme não há painel nenhum', () => {
    montar({ state: 'threshold', color: '#f00', label: 'crítico' });

    fireEvent.focus(card());

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  /**
   * O painel ficava mudo em modo de edicao, e foi o primeiro tropeco de quem
   * testou a feature: some justamente na tela em que se experimenta. Quem monta
   * a topologia tambem quer saber o que caiu.
   */
  it('em modo de edição o hover continua abrindo', () => {
    montar(alarme(), { editable: true });

    fireEvent.focus(card());

    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });

  /** No editor o clique ja seleciona o elemento; nao pode acumular um segundo
   *  significado e deixar um painel preso sobre o que se esta editando. */
  it('em modo de edição o clique não fixa', () => {
    montar(alarme(), { editable: true });

    fireEvent.click(card());
    fireEvent.mouseLeave(card());

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  /** O tooltip seguindo o card pelo canvas atrapalharia o gesto em curso. */
  it('durante o arraste o painel sai do caminho', () => {
    montar(alarme(), { dragging: true });

    fireEvent.focus(card());
    fireEvent.mouseEnter(card());

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('o clique prende o painel, e o Esc solta', () => {
    montar(alarme());

    fireEvent.click(card());
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    // Tirar o ponteiro nao fecha mais: o painel esta fixado.
    fireEvent.mouseLeave(card());
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('o clique fora solta, o clique dentro do painel não', () => {
    montar(alarme());

    fireEvent.click(card());
    fireEvent.pointerDown(screen.getByText('Unavailable by ICMP ping'));
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  /** Segundo clique no proprio elemento desfaz o pin — mesmo gesto, ida e volta. */
  it('o segundo clique solta', () => {
    montar(alarme());

    fireEvent.click(card());
    fireEvent.click(card());
    fireEvent.mouseLeave(card());

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});

describe('countLabel', () => {
  it('escreve singular e plural por extenso', () => {
    expect(countLabel(1)).toBe('1 problema ativo');
    expect(countLabel(15)).toBe('15 problemas ativos');
  });
});

/**
 * Uma unidade so, arredondada para baixo: `ha 2h` muda a decisao de quem atende;
 * `ha 2h 14m 3s` e precisao que ninguem usa e faz a lista dancar a cada refresh.
 */
describe('formatAge', () => {
  const agora = 1_700_000_000_000;
  const segundos = (n: number) => agora / 1000 - n;

  it('resolve a maior unidade que ainda informa', () => {
    expect(formatAge(segundos(30), agora)).toBe('agora');
    expect(formatAge(segundos(59), agora)).toBe('agora');
    expect(formatAge(segundos(60), agora)).toBe('há 1m');
    expect(formatAge(segundos(59 * 60), agora)).toBe('há 59m');
    expect(formatAge(segundos(3 * 3600), agora)).toBe('há 3h');
    expect(formatAge(segundos(50 * 3600), agora)).toBe('há 2d');
  });

  /** Relogio do servidor adiantado nao pode virar um numero negativo na tela. */
  it('tempo no futuro cai em `agora`', () => {
    expect(formatAge(segundos(-300), agora)).toBe('agora');
  });
});

/**
 * O painel e **um so** por elemento, e o conteudo depende de qual fonte de
 * estado esta configurada. Foi por isso que este componente deixou de se chamar
 * `TriggerDetails`: dois `Tooltip` aninhados nao sao uma opcao — o do Grafana
 * clona o filho e ancora nele por ref, e o de fora ancoraria num componente de
 * funcao, que engole a ref em silencio.
 */
describe('ElementHover — gráfico da métrica', () => {
  it('sem alarme e com gráfico, o hover mostra o gráfico', () => {
    montar({ state: 'neutral' }, { chart: GRAFICO });

    fireEvent.focus(card());

    expect(screen.getByTestId('grafico')).toBeInTheDocument();
  });

  /**
   * Na pratica os dois nao coexistem — o toggle do grafico so existe no modo
   * Metrica —, mas a precedencia precisa estar decidida: um elemento alarmando
   * responde primeiro "o que caiu".
   */
  it('alarmando, a lista de triggers vem antes do gráfico', () => {
    montar(alarme(), { chart: GRAFICO });

    fireEvent.focus(card());

    expect(screen.getByText('Unavailable by ICMP ping')).toBeInTheDocument();
    expect(screen.queryByTestId('grafico')).not.toBeInTheDocument();
  });

  it('sem alarme e sem gráfico, não há painel nenhum', () => {
    montar({ state: 'neutral' });

    fireEvent.focus(card());

    expect(screen.queryByTestId('grafico')).not.toBeInTheDocument();
    expect(card()).toBeInTheDocument();
  });

  /**
   * O grafico nao e uma leitura que se interrompe, e o `interactive` do Tooltip
   * ja permite entrar nele com o ponteiro. Prender um grafico por cima da
   * topologia so atrapalharia o proximo elemento que o operador quer olhar.
   */
  it('o clique não prende o gráfico, como prende a lista', () => {
    montar({ state: 'neutral' }, { chart: GRAFICO });

    fireEvent.click(card());
    fireEvent.blur(card());

    expect(screen.queryByTestId('grafico')).not.toBeInTheDocument();
  });

  /** No editor o hover continua valendo: é onde o gráfico é configurado. */
  it('o gráfico aparece também no modo de edição', () => {
    montar({ state: 'neutral' }, { chart: GRAFICO, editable: true });

    fireEvent.focus(card());

    expect(screen.getByTestId('grafico')).toBeInTheDocument();
  });
});
