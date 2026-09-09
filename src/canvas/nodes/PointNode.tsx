import React from 'react';
import { css, cx } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, useTheme2 } from '@grafana/ui';
import { Handle, NodeProps, Position, useConnection } from '@xyflow/react';

import { stateFieldName } from '../../data/dimensions';
import { accentColor, resolveElementColor } from '../../data/elementColor';
import { POINT_NODE_SIZE } from '../../model/sizes';
import { ActiveTriggers, activeProblems } from '../ActiveTriggers';
import { alertClass } from '../alertAnimation';
import { PointFlowNode } from '../flowTypes';
import { stateFill } from '../stateFill';
import { ElementHover } from '../ElementHover';
import { MetricChart } from '../MetricChart';
import { ACCENT_VAR, HANDLE_SIZE, TRANSITION_FAST, accentVar, alpha, selectionRing } from '../tokens';

const HANDLE_CLASS = 'topo-point-handle';

/**
 * Ancora de roteamento: circulo pequeno, sem texto, sem valor.
 *
 * O halo permanente e o que torna um alvo de 14px clicavel sem aumentar o
 * diametro. Ele tem tres niveis de opacidade (repouso / hover / selecionado) e
 * **so a opacidade muda** — crescer o circulo faria a topologia inteira
 * "respirar" ao passar o mouse.
 */
export function PointNode({ data, selected, dragging }: NodeProps<PointFlowNode>) {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);

  /**
   * O seletor devolve um booleano de proposito: sem ele, `useConnection`
   * reassinaria o ponto a cada movimento do ponteiro durante uma conexao e
   * re-renderizaria todo point da cena. Com ele, so a virada do estado importa.
   */
  const connecting = useConnection((connection) => connection.inProgress);

  const accent = resolveElementColor(data.element.color, data.frames, theme, {
    trigger: data.element.trigger,
    thresholds: data.element.thresholds,
  });
  const color =
    accentColor(accent) ?? (accent.state === 'nodata' ? theme.colors.text.disabled : theme.colors.primary.main);

  /**
   * O estado preenche o circulo, e nao so contorna.
   *
   * Num alvo de 14px a borda de 2px e quase toda a superficie visivel, mas o
   * miolo em `background.canvas` fazia o point acender como um anel vazado
   * enquanto o no ao lado acendia solido — o mesmo estado lido de duas formas na
   * mesma cena. `stateFill` devolve `undefined` sem estado, e ai o miolo volta a
   * ser o fundo do canvas: e o neutro de A.3, que precisa continuar distinto.
   */
  const fill = stateFill(accent, theme);

  // `currentColor` e o que os aneis do radar herdam; sem isto eles sairiam na
  // cor de texto do container, e nao na do estado que estao anunciando.
  const alerting = alertClass(accent, data.element.alert);

  return (
    /* O ponto nao tem badge nem texto: e o unico elemento em que a lista de
       triggers e a **unica** forma de saber o que alarmou. O titulo vem do host,
       porque nao ha nome de elemento para exibir. */
    <ElementHover
      accent={accent}
      title={data.element.trigger?.host}
      editable={data.editable}
      dragging={dragging}
      chart={
        data.element.chart ? (
          <MetricChart frames={data.frames} field={stateFieldName(data.element.color, data.frames)} />
        ) : undefined
      }
    >
      <div
        className={cx(styles.dot, alerting)}
        // A origem do gesto usa o mesmo halo de selecionado: durante a linkagem
        // ela e, de fato, o elemento em foco.
        data-selected={selected || data.link === 'source' || undefined}
        data-editable={data.editable || undefined}
        data-connecting={connecting || undefined}
        data-link={data.link}
        // A cor entra como custom property para que os tres niveis de halo
        // vivam em CSS estatico, com `:hover` e `[data-selected]`.
        style={
          {
            borderColor: color,
            background: fill?.background,
            color,
            [ACCENT_VAR]: color,
          } as React.CSSProperties
        }
      >
        {/* Um handle so: o point e pequeno demais para quatro alvos distintos, e
          com `ConnectionMode.Loose` um basta. Ele muda de tamanho conforme o
          gesto — ver o comentario de `handle` nos estilos. */}
        <Handle type="source" position={Position.Right} className={cx(styles.handle, HANDLE_CLASS)} />

        {/* Filha do circulo, e nao irma: o point nao tem container proprio — o
            wrapper e do React Flow. Como a lista e `position: absolute` e nao
            recebe ponteiro, ela sai dos 14px sem afetar o alvo de arraste. */}
        <ActiveTriggers
          problems={activeProblems(accent, data.element.trigger)}
          position={data.element.trigger?.activePosition}
          display={data.element.trigger?.activeDisplay}
        />
      </div>
    </ElementHover>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  dot: css({
    position: 'relative',
    width: POINT_NODE_SIZE,
    height: POINT_NODE_SIZE,
    borderRadius: theme.shape.radius.circle,
    background: theme.colors.background.canvas,
    border: '2px solid',
    boxShadow: `0 0 0 4px ${alpha(accentVar, 0.1)}`,
    cursor: 'default',
    transition: `box-shadow ${TRANSITION_FAST}`,

    '&:hover': {
      boxShadow: `0 0 0 4px ${alpha(accentVar, 0.22)}`,
    },
    // Depois do `:hover` de proposito: mesma especificidade, entao a ordem
    // decide, e um point selecionado sob o ponteiro deve manter o realce.
    //
    // O halo sozinho nao servia de sinal de selecao: ele so subia de 0.22 para
    // 0.28 de opacidade da propria cor do elemento, diferenca imperceptivel e
    // que ainda variava conforme a cor. O anel entra por dentro do halo, que
    // e empurrado de 4px para 6px para nao ser encoberto.
    '&[data-selected]': {
      boxShadow: `${selectionRing(theme.colors.primary.main)}, 0 0 0 6px ${alpha(accentVar, 0.28)}`,
    },
    [`&[data-editable]:hover .${HANDLE_CLASS}`]: {
      opacity: 1,
      pointerEvents: 'auto',
    },

    /**
     * Com uma conexao em curso o handle cresce e cobre o point inteiro, com
     * folga. E o alvo generoso que a versao anterior queria — mas so durante o
     * gesto em que ele serve, e nunca durante o arraste.
     *
     * Invisivel: e area de acerto, nao decoracao. O que o usuario ve continua
     * sendo o circulo, que ja tem realce proprio.
     */
    [`&[data-connecting] .${HANDLE_CLASS}`]: {
      top: '50%',
      left: '50%',
      right: 'auto',
      transform: 'translate(-50%, -50%)',
      width: POINT_NODE_SIZE + 8,
      height: POINT_NODE_SIZE + 8,
      minWidth: POINT_NODE_SIZE + 8,
      minHeight: POINT_NODE_SIZE + 8,
      opacity: 0,
      pointerEvents: 'auto',
      border: 'none',
      background: 'transparent',
    },

    // Alvo valido de linkagem: `crosshair` reverte o `not-allowed` que o
    // container aplica a todos os nos, e o hover antecipa o resultado do clique.
    '&&[data-link="valid"]': {
      cursor: 'crosshair',

      '&:hover': {
        borderColor: theme.colors.primary.main,
      },
    },
  }),
  /**
   * Em repouso o handle fica **encavalado na borda direita**, no tamanho dos
   * handles do no — nao centralizado sobre o point.
   *
   * Era essa centralizacao que impedia o point de ser arrastado: o handle cobria
   * os 14px inteiros e, no hover, ganhava `pointer-events`. Todo `mousedown`
   * caia nele, e o React Flow le `mousedown` em handle como inicio de conexao,
   * nunca como arraste. O point simplesmente nao tinha area propria para agarrar.
   *
   * Na borda, o miolo do circulo volta a ser do arraste e o handle continua
   * servindo para puxar uma conexao a partir dele.
   */
  handle: css({
    '&&': {
      width: HANDLE_SIZE,
      height: HANDLE_SIZE,
      minWidth: HANDLE_SIZE,
      minHeight: HANDLE_SIZE,
      background: theme.colors.background.canvas,
      border: `1px solid ${theme.colors.primary.main}`,
      borderRadius: theme.shape.radius.circle,
      opacity: 0,
      pointerEvents: 'none',
      transition: `opacity ${TRANSITION_FAST}`,
    },
  }),
});
