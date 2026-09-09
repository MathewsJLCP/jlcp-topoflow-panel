import React, { useCallback, useEffect, useRef, useState } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { Tooltip, useStyles2 } from '@grafana/ui';

import { ElementColor } from '../data/elementColor';
import { ActiveProblem } from '../data/triggerState';
import { alpha } from './tokens';

/**
 * O painel que abre ao passar o mouse sobre um elemento.
 *
 * **Um por elemento**, e o conteudo depende de qual fonte de estado esta
 * configurada — que e a razao de este componente ter deixado de se chamar
 * `TriggerDetails`:
 *
 *   - **modo Trigger, alarmando** -> a lista de triggers em PROBLEM;
 *   - **modo Metrica, com grafico ligado** -> a serie da metrica no tempo;
 *   - nenhum dos dois -> nao ha painel, e o elemento renderiza sozinho.
 *
 * Os dois conteudos nunca competem: a lista so existe quando `resolveElementColor`
 * devolve estado `trigger`, e o toggle do grafico so aparece no modo Metrica. Um
 * `Tooltip` so, e nao um por conteudo, tambem e uma necessidade tecnica — o
 * `Tooltip` do Grafana clona o filho e ancora nele por ref, e dois aninhados
 * fariam o de fora ancorar num componente de funcao, que engole a ref em
 * silencio e abre o painel no canto da tela.
 *
 * ## A lista de triggers
 *
 * O card diz **o quao ruim** esta (cor, severidade, contador); a lista diz
 * **o que** esta ruim. Sao dois publicos e dois momentos: o telao de parede, que
 * ninguem toca, e o operador que se aproxima para atender. Por isso o nome da
 * trigger vive aqui e nao no elemento — a descricao tipica do Zabbix nao cabe em
 * 180px, e trunca-la ate caber devolveria "Zabbix agent is not…", que nao
 * identifica nada.
 *
 * ## Como abre
 *
 * O `Tooltip` do Grafana e controlado por `show`, com tres estados que dao
 * exatamente o comportamento pedido, sem overlay proprio:
 *
 *   - `undefined` — o proprio Tooltip cuida do hover (o caso normal);
 *   - `true`      — preso aberto, e o que o clique liga;
 *   - `false`     — nunca abre.
 *
 * Em modo de edicao o hover continua valendo — quem esta montando a topologia
 * tambem quer saber o que caiu, e foi o primeiro tropeco de quem testou a
 * feature: o painel ficava mudo justamente na tela em que se experimenta. O que
 * some ali e o **pin**: no editor o clique ja seleciona o elemento, e acumular
 * um segundo significado no mesmo gesto deixaria um painel preso por cima do
 * que se esta editando.
 *
 * Durante o arraste o painel sai do caminho (`dragging`), que era a objecao
 * legitima ao hover no editor: o tooltip seguindo o elemento pelo canvas.
 *
 * O `useDismiss` interno do Tooltip fecha no Esc e no clique fora, mas so
 * mexendo no estado **dele** — que fica ignorado enquanto `show` e `true`. Por
 * isso o pin tem os seus proprios ouvintes: sem eles, um painel fixado nao
 * fecharia mais.
 */

interface ElementHoverProps {
  accent: ElementColor;
  /** Cabecalho do painel: o nome do elemento (ou do host). */
  title?: string;
  /** Em modo de edicao o hover vale, mas o clique nao fixa: ele ja seleciona. */
  editable?: boolean;
  /**
   * O elemento tem drill-down, entao o clique dele **leva embora**.
   *
   * Fixar o painel no mesmo gesto seria fixa-lo para ninguem ler: ou a navegacao
   * troca a pagina, ou (com `targetBlank`) o foco vai para outra aba e o painel
   * fica preso atras. O hover continua valendo, que e como o operador ve o que
   * caiu antes de decidir se quer o drill-down.
   */
  linked?: boolean;
  /** Arraste em curso. O React Flow entrega isto de graca em `NodeProps`. */
  dragging?: boolean;
  /**
   * Grafico da metrica, quando o elemento pediu um (ver `MetricChart`).
   *
   * Entra como no pronto, e nao como os dados dele: quem sabe qual campo plotar
   * e o elemento, e passar `frames` e nome de field ate aqui faria este
   * componente conhecer o modelo — que ele nunca conheceu, e e o que o mantem
   * util para os quatro tipos que o usam.
   *
   * Cede a vez para a lista de triggers: um elemento alarmando responde
   * primeiro "o que caiu". Na pratica os dois nao coexistem, porque o toggle do
   * grafico so existe no modo Metrica.
   */
  chart?: React.ReactElement;
  children: React.ReactElement<{ onClick?: React.MouseEventHandler }>;
}

export function ElementHover({ accent, title, editable, linked, dragging, chart, children }: ElementHoverProps) {
  const [pinned, setPinned] = useState(false);
  const anchorRef = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const problems = accent.state === 'trigger' ? accent.problems : EMPTY;
  const content = problems.length > 0 ? <ProblemList title={title} problems={problems} panelRef={panelRef} /> : chart;
  const silent = content === undefined;

  /**
   * Duas situacoes soltam o pin, e por motivos diferentes:
   *
   *   - o alarme fechou (o refresh seguinte nao traz mais aquele problema).
   *     Sem soltar, o pin sobreviveria ao proprio motivo e o painel reabriria
   *     sozinho no proximo alarme, sem ninguem ter clicado;
   *   - o painel entrou em modo de edicao, onde o pin nao existe.
   *
   * Ajuste durante o render, e nao num efeito: e o padrao que o React recomenda
   * para estado que deriva de uma mudanca de prop, e evita o render
   * intermediario em que o painel apareceria fixado sem ter mais por que.
   */
  /**
   * Tres situacoes soltam o pin. A terceira e o grafico: ele nao e uma leitura
   * que se interrompe, e o `interactive` do Tooltip ja permite entrar nele com o
   * ponteiro — prender um grafico por cima da topologia so atrapalharia o
   * proximo elemento que o operador quer olhar.
   */
  const pinnable = problems.length > 0;
  const unpin = silent || Boolean(editable) || Boolean(linked) || !pinnable;
  const [wasUnpinned, setWasUnpinned] = useState(unpin);
  if (unpin !== wasUnpinned) {
    setWasUnpinned(unpin);
    if (unpin) {
      setPinned(false);
    }
  }

  useEffect(() => {
    if (!pinned) {
      return;
    }

    const soltar = (event: Event) => {
      const target = event.target as Node | null;
      // Clique no proprio elemento e do `onClick` abaixo, que alterna o pin;
      // clique dentro do painel e de quem esta lendo ou selecionando texto.
      if (!target || anchorRef.current?.contains(target) || panelRef.current?.contains(target)) {
        return;
      }
      setPinned(false);
    };

    const tecla = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }
      setPinned(false);
      /**
       * O Esc para aqui. O Grafana usa a mesma tecla para sair da visualizacao
       * do painel, e sem isto um unico toque fechava o painel de triggers **e**
       * jogava o operador para fora do painel inteiro.
       */
      event.stopPropagation();
    };

    /**
     * Os dois em fase de **captura**.
     *
     * O Grafana registra o seu proprio atalho de Esc antes do nosso e nao o
     * deixa borbulhar: no browser real, o painel fixado simplesmente nao
     * fechava — e o jsdom nao pegava isso, porque ali nao existe o atalho do
     * Grafana para competir. Na captura o evento passa por nos primeiro.
     */
    document.addEventListener('pointerdown', soltar, true);
    document.addEventListener('keydown', tecla, true);

    return () => {
      document.removeEventListener('pointerdown', soltar, true);
      document.removeEventListener('keydown', tecla, true);
    };
  }, [pinned]);

  const alternar = useCallback(
    (event: React.MouseEvent) => {
      children.props.onClick?.(event);
      setPinned((atual) => !atual);
    },
    [children]
  );

  if (silent) {
    return children;
  }

  return (
    <Tooltip
      ref={anchorRef}
      // Sem `interactive` o painel some no caminho ate ele, e nao daria para
      // rolar uma lista de quinze problemas nem selecionar o nome de uma trigger.
      interactive
      placement="top"
      content={content}
      // `false` enquanto o elemento e arrastado: o painel seguindo o card pelo
      // canvas atrapalha justamente o gesto em curso.
      show={dragging ? false : pinned || undefined}
    >
      {editable || linked || !pinnable ? children : React.cloneElement(children, { onClick: alternar })}
    </Tooltip>
  );
}

/** Referencia estavel: um array novo a cada render reiniciaria os efeitos. */
const EMPTY: ActiveProblem[] = [];

interface ProblemListProps {
  title?: string;
  problems: ActiveProblem[];
  panelRef: React.MutableRefObject<HTMLDivElement | null>;
}

/**
 * A lista, no formato de uma tabela de incidentes: uma coluna para a
 * severidade, uma para o nome, uma para o tempo.
 *
 * A primeira versao era severidade e nome soltos na mesma linha, separados por
 * um ponto colorido — legivel com um alarme, ilegivel com dez: sem colunas, o
 * olho tem de reencontrar onde comeca o nome em cada linha, e as severidades
 * nao se comparam entre si. Com as colunas alinhadas, "quais sao os graves"
 * vira uma varredura vertical.
 *
 * A pilula de severidade e a mesma do badge do no, de proposito: o operador
 * aprende uma forma de ler estado, nao uma por lugar.
 */
function ProblemList({ title, problems, panelRef }: ProblemListProps) {
  const styles = useStyles2(getStyles);

  /**
   * O relogio e lido **uma vez, na abertura**: a lista so monta quando o painel
   * abre, entao `há 4m` e a idade no instante em que o operador olhou.
   *
   * Nao ha timer para envelhecer os numeros sozinhos. Um painel aberto por dez
   * minutos e o operador atendendo o alarme, nao lendo o relogio — e um
   * `setInterval` por elemento alarmado custaria caro numa topologia com
   * dezenas deles.
   */
  const [now] = useState(() => Date.now());

  return (
    <div className={styles.panel} ref={panelRef}>
      <div className={styles.header}>
        {title && <span className={styles.title}>{title}</span>}
        <span className={styles.count}>{countLabel(problems.length)}</span>
      </div>

      <ul className={styles.list}>
        {problems.map((problem, index) => (
          <li className={styles.item} key={`${problem.name}-${index}`}>
            <span
              className={styles.severity}
              style={{
                color: problem.color,
                background: alpha(problem.color, 0.15),
                borderColor: alpha(problem.color, 0.35),
              }}
            >
              {problem.label}
            </span>
            <span className={styles.name}>{problem.name}</span>
            {/* A coluna existe mesmo vazia: sem ela, uma linha sem tempo
                encolheria e o alinhamento da tabela se perderia. */}
            <span className={styles.age}>{problem.since === undefined ? '' : formatAge(problem.since, now)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Rotulo curto do estado em alarme: a severidade e, quando ha mais de uma
 * trigger aberta, quantas.
 *
 * Sobrou para a **conexao**, que e o unico elemento sem lugar onde a lista de
 * triggers caiba: no e imagem tem o "embaixo do elemento", a aresta e um traco
 * entre dois pontos. Ali o chip continua sendo a unica sinalizacao de estado, e
 * por isso continua carregando a severidade — nos demais, quem diz o que caiu e
 * a lista, e o badge voltou a ser so do valor da metrica.
 *
 * Some com uma trigger so, em vez de exibir `·1`: ali o numero nao acrescenta
 * nada e ocuparia o meio de toda conexao alarmada do painel.
 */
export function alarmLabel(label: string, count: number): string {
  return count > 1 ? `${label} ·${count}` : label;
}

/** Singular e plural escritos por extenso: `1 problema(s)` e ruido de sistema. */
export function countLabel(count: number): string {
  return count === 1 ? '1 problema ativo' : `${count} problemas ativos`;
}

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Ha quanto tempo o problema abriu, na maior unidade que ainda informa.
 *
 * Uma unidade so, e sempre arredondada para baixo: `ha 2h` e o que muda a
 * decisao de quem atende; `ha 2h 14m 3s` e precisao que ninguem usa e que faz a
 * lista inteira dancar a cada refresh.
 *
 * Abaixo de um minuto vira `agora` — e o alarme que acabou de abrir, e um
 * `ha 0m` diria a mesma coisa pior. Tempo futuro (relogio do servidor adiantado)
 * cai no mesmo caso, em vez de virar um numero negativo.
 *
 * `now` entra por parametro em milissegundos, como `Date.now()`, para que o
 * teste nao dependa do relogio.
 */
export function formatAge(since: number, now: number): string {
  const elapsed = Math.floor(now / 1000) - since;

  if (elapsed < MINUTE) {
    return 'agora';
  }
  if (elapsed < HOUR) {
    return `há ${Math.floor(elapsed / MINUTE)}m`;
  }
  if (elapsed < DAY) {
    return `há ${Math.floor(elapsed / HOUR)}h`;
  }

  return `há ${Math.floor(elapsed / DAY)}d`;
}

const getStyles = (theme: GrafanaTheme2) => ({
  panel: css({
    // Piso e teto: estreito demais quebra todo nome em duas linhas, largo demais
    // atravessa a topologia. Entre os dois, a tabela se ajusta ao conteudo.
    minWidth: 260,
    maxWidth: 440,
  }),
  header: css({
    display: 'flex',
    alignItems: 'baseline',
    gap: theme.spacing(2),
    paddingBottom: theme.spacing(0.75),
    marginBottom: theme.spacing(0.75),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
  title: css({
    fontWeight: theme.typography.fontWeightMedium,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
  count: css({
    marginLeft: 'auto',
    color: theme.colors.text.secondary,
    whiteSpace: 'nowrap',
  }),
  /**
   * Rola a partir de ~7 linhas. Quinze problemas numa lista sem teto cobririam a
   * topologia inteira — que e justamente o que o operador esta tentando ler.
   */
  list: css({
    display: 'grid',
    gridTemplateColumns: 'auto 1fr auto',
    alignItems: 'baseline',
    columnGap: theme.spacing(1.25),
    margin: 0,
    padding: 0,
    listStyle: 'none',
    maxHeight: 232,
    overflowY: 'auto',
  }),
  item: css({
    display: 'grid',
    gridColumn: '1 / -1',
    gridTemplateColumns: 'subgrid',
    alignItems: 'baseline',
    padding: `${theme.spacing(0.5)} 0`,
    fontSize: theme.typography.bodySmall.fontSize,

    // Separador so entre linhas: uma regra acima da primeira duplicaria a borda
    // do cabecalho.
    '& + &': {
      borderTop: `1px solid ${theme.colors.border.weak}`,
    },
  }),
  /** A mesma pilula do badge do no — uma forma so de ler estado. */
  severity: css({
    justifySelf: 'start',
    minWidth: 74,
    padding: '1px 6px',
    border: '1px solid',
    borderRadius: theme.shape.radius.sm,
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: 10,
    fontWeight: theme.typography.fontWeightMedium,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    textAlign: 'center',
    lineHeight: 1.6,
  }),
  /** Quebra em vez de truncar: aqui ha espaco, e o nome e o assunto. */
  name: css({
    color: theme.colors.text.primary,
    overflowWrap: 'anywhere',
  }),
  age: css({
    color: theme.colors.text.secondary,
    whiteSpace: 'nowrap',
    fontVariantNumeric: 'tabular-nums',
  }),
});
