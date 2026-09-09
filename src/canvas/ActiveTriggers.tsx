import React from 'react';
import { css, cx } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { ElementColor } from '../data/elementColor';
import { ActiveProblem } from '../data/triggerState';
import { TriggerBinding } from '../model/types';
import { alpha } from './tokens';

/**
 * As triggers em PROBLEM, listadas logo abaixo do elemento.
 *
 * E a resposta a lacuna que o hover nao fecha: num telao de parede ninguem
 * passa o mouse, e um elemento vermelho sozinho diz que algo caiu, nunca **o
 * que** caiu. O painel de hover continua existindo para o detalhe (tempo,
 * severidade escrita, lista inteira); isto aqui e o que fica na tela.
 *
 * Tres decisoes que a forma carrega:
 *
 *   - **Dois formatos, uma decisao do usuario.** `list` mostra os nomes (o
 *     default de sempre); `count` mostra so "4 incidentes ativos", numa linha
 *     de altura fixa, para a topologia densa em que o operador quer saber
 *     **quanto** esta caindo e vai ao hover para saber **o que**.
 *   - **Teto de tres linhas.** Um NOC em pico tem elementos com dez ou quinze
 *     alarmes, e sem teto a lista de um no cobriria os elementos abaixo dele —
 *     justamente quando a topologia precisa continuar legivel. O que sobra vira
 *     uma linha `+N outras`, e o hover tem a lista completa.
 *   - **Uma linha por trigger, cortada no fim.** Altura previsivel importa mais
 *     que o nome inteiro: com quebra, dois alarmes de nome longo empurram o
 *     dobro de altura sobre a cena. O nome completo esta a um hover de distancia.
 *   - **Nao recebe ponteiro.** `pointerEvents: 'none'` mantem o arraste, a
 *     selecao e o gesto de conexao pertencendo ao elemento: a extensao e
 *     legenda, nao alvo.
 */

/** Acima disto, o resto vira uma linha so. */
const MAX_LINHAS = 3;

/**
 * O que a extensao deve listar neste elemento — vazio quando nao ha alarme ou
 * quando o usuario desligou a lista.
 *
 * Vive aqui, e nao repetida em cada componente de elemento, porque foi
 * duplicando decisoes assim que no, point e imagem divergiram antes.
 */
export function activeProblems(accent: ElementColor, trigger: TriggerBinding | undefined): ActiveProblem[] {
  // `!== false` e nao `=== true`: o default do schema e ligado, e um vinculo
  // montado a mao (ou vindo de JSON antigo) nao pode nascer mudo.
  return accent.state === 'trigger' && trigger?.showActive !== false ? accent.problems : [];
}

/** De que lado do elemento a pilha pousa. Ausente e o `bottom` de sempre. */
export type ActivePosition = NonNullable<TriggerBinding['activePosition']>;

/** Nomes das triggers, ou so a contagem. Ausente e a `list` de sempre. */
export type ActiveDisplay = NonNullable<TriggerBinding['activeDisplay']>;

/**
 * O texto da contagem. Uma linha para qualquer numero de alarmes — que e o
 * ponto: quem escolhe `count` quer altura fixa sob o elemento.
 */
export function activeCountLabel(total: number): string {
  return `${total} ${total === 1 ? 'incidente ativo' : 'incidentes ativos'}`;
}

interface ActiveTriggersProps {
  problems: ActiveProblem[];
  position?: ActivePosition;
  /** Nomes (default) ou so o total de incidentes ativos. */
  display?: ActiveDisplay;
  /**
   * Largura do elemento, em px. A extensao pode ser mais larga que ele (nomes de
   * trigger sao longos), mas nao ilimitada — dai o teto derivar do proprio
   * elemento em vez de ser um numero solto.
   */
  width?: number;
}

export function ActiveTriggers({ problems, position = 'bottom', display = 'list', width }: ActiveTriggersProps) {
  const styles = useStyles2(getStyles);

  if (problems.length === 0) {
    return null;
  }

  const visiveis = display === 'count' ? [] : problems.slice(0, MAX_LINHAS);
  const resto = display === 'count' ? 0 : problems.length - visiveis.length;

  /*
    A pilha e uma so nos dois formatos — inclusive o teto de largura, que
    dependia do elemento e nao do conteudo. Dois `return` com o mesmo wrapper
    davam duas chances de a ancora e a largura divergirem.
  */
  return (
    <div className={cx(styles.stack, styles[position])} style={{ maxWidth: Math.max(width ?? 0, MIN_WIDTH) * 1.5 }}>
      {/*
        O total usa a mesma linha da lista, e nao um formato proprio: a borda
        colorida continua sendo a maior severidade em curso (os problemas ja
        chegam ordenados por severidade), entao trocar de formato muda quanto se
        le, nunca o que a cor diz. O nome de cada trigger vai para o `title`, que
        e o que sobra de resposta a "o que caiu" sem abrir o hover.
      */}
      {display === 'count' && (
        <div
          className={styles.line}
          style={{ borderLeftColor: problems[0].color, background: alpha(problems[0].color, 0.12) }}
          title={problems.map((problem) => `${problem.label}: ${problem.name}`).join('\n')}
        >
          {activeCountLabel(problems.length)}
        </div>
      )}

      {visiveis.map((problem, index) => (
        <div
          className={styles.line}
          key={`${problem.name}-${index}`}
          style={{ borderLeftColor: problem.color, background: alpha(problem.color, 0.12) }}
          // A cor sozinha nao carrega a severidade para quem nao distingue
          // vermelho de laranja; o nome dela vai para o leitor de tela e para o
          // tooltip nativo, sem ocupar pixel nenhum.
          title={`${problem.label}: ${problem.name}`}
        >
          {problem.name}
        </div>
      ))}

      {resto > 0 && <div className={styles.more}>{`+${resto} ${resto === 1 ? 'outra' : 'outras'}`}</div>}
    </div>
  );
}

/** Piso do teto de largura: um point tem 14px, e 21px nao caberia uma palavra. */
const MIN_WIDTH = 160;

const getStyles = (theme: GrafanaTheme2) => ({
  /**
   * Fora do fluxo, centrada sob o elemento — o mesmo tratamento da legenda da
   * imagem, e pelo mesmo motivo: dentro do card, cada linha roubaria altura do
   * conteudo; fora, o elemento fica intacto e o texto transborda para os lados.
   */
  stack: css({
    position: 'absolute',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    width: 'max-content',
    pointerEvents: 'none',
  }),
  /**
   * Um lado por classe, e nao estilo inline calculado: sao quatro combinacoes
   * fixas de ancora e deslocamento, e em CSS estatico elas ficam legiveis lado a
   * lado — que e como se confere se a de baixo e a de cima sao simetricas.
   */
  bottom: css({
    top: '100%',
    left: '50%',
    transform: 'translateX(-50%)',
    marginTop: theme.spacing(0.5),
  }),
  top: css({
    bottom: '100%',
    left: '50%',
    transform: 'translateX(-50%)',
    marginBottom: theme.spacing(0.5),
  }),
  /** Nas laterais as linhas crescem **para longe** do elemento: a borda colorida
   *  fica sempre do lado de dentro, apontando para quem esta alarmando. */
  left: css({
    right: '100%',
    top: '50%',
    transform: 'translateY(-50%)',
    marginRight: theme.spacing(0.5),
    alignItems: 'flex-end',
  }),
  right: css({
    left: '100%',
    top: '50%',
    transform: 'translateY(-50%)',
    marginLeft: theme.spacing(0.5),
    alignItems: 'flex-start',
  }),
  line: css({
    borderLeft: '3px solid',
    borderRadius: theme.shape.radius.sm,
    padding: '1px 6px',
    // Fundo proprio, e nao so texto colorido: a extensao pousa sobre o canvas,
    // que pode ter um postit ou outro elemento atras.
    backdropFilter: 'blur(2px)',
    color: theme.colors.text.primary,
    fontSize: 11,
    lineHeight: 1.5,
    // Uma linha, cortada no fim. Altura previsivel vale mais que o nome inteiro.
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  }),
  more: css({
    padding: '0 6px',
    color: theme.colors.text.secondary,
    fontSize: 11,
    lineHeight: 1.4,
    fontStyle: 'italic',
  }),
});
