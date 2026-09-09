import React from 'react';
import { css, cx } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, useTheme2 } from '@grafana/ui';
import { Handle, HandleType, NodeProps, NodeResizer, Position } from '@xyflow/react';

import { resolveTemplate, stateFieldName } from '../../data/dimensions';
import { ElementColor, resolveElementColor } from '../../data/elementColor';
import { IMAGE_DEFAULT } from '../../model/sizes';
import { ImageBackground } from '../../model/types';
import { TopoIcon, isKnownIcon, resolveIcon } from '../../icons';
import { ActiveTriggers, activeProblems } from '../ActiveTriggers';
import { DrilldownSurface } from '../DrilldownSurface';
import { MetricChart } from '../MetricChart';
import { hasDrilldown } from '../drilldown';
import { alertClass } from '../alertAnimation';
import { iconTone } from '../iconTone';
import { ImageFlowNode } from '../flowTypes';
import { stateFill } from '../stateFill';
import { ElementHover } from '../ElementHover';
import { HANDLE_SIZE, TRANSITION_FAST, alpha, selectionRing } from '../tokens';

const HANDLE_CLASS = 'topo-image-handle';
const BOX_CLASS = 'topo-image-box';

const HANDLES: Array<{ position: Position; type: HandleType }> = [
  { position: Position.Top, type: 'target' },
  { position: Position.Right, type: 'source' },
  { position: Position.Bottom, type: 'target' },
  { position: Position.Left, type: 'source' },
];

/**
 * Imagem enviada pelo usuario, com legenda opcional e fundo opcional.
 *
 * E o unico elemento cujo conteudo principal vem de fora do painel — um arquivo
 * —, e isso muda uma coisa: **a cor de estado nao pousa nele**. Pintar por cima
 * de um logo o descaracteriza, e um icone de fabricante tingido de vermelho nao
 * se le como alarme, se le como imagem quebrada. Por isso o estado pousa na
 * **placa atras** da figura, que so existe quando o usuario a liga.
 *
 * Sem placa, a imagem e decoracao pura e nao resolve estado nenhum. Com placa em
 * `state`, ela vira o rotulo de um estado — que e como os mapas do Zabbix usam
 * icone: o desenho identifica o equipamento, o fundo diz como ele esta.
 */
export function ImageNode({ data, selected, dragging }: NodeProps<ImageFlowNode>) {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const { element, frames, editable } = data;

  /**
   * A cadeia de cor so e consultada no modo `state`. Nos outros a resolucao nao
   * teria onde pousar, e rodar `resolveElementColor` a toa faria uma imagem
   * decorativa varrer os frames a cada render.
   */
  const stateMode = element.background?.mode === 'state';
  const accent: ElementColor = stateMode
    ? resolveElementColor(element.color, frames, theme, {
        trigger: element.trigger,
        thresholds: element.thresholds,
      })
    : { state: 'neutral' };

  const fill = stateMode ? stateFill(accent, theme) : undefined;
  const surface = backgroundColor(element.background, accent, fill?.background, theme);

  const caption = element.text ? resolveTemplate(element.text, frames) : '';

  const ativas = activeProblems(accent, element.trigger);
  const abaixo = (element.trigger?.activePosition ?? 'bottom') === 'bottom';

  /**
   * O `src` guarda tres coisas — data URI, URL e chave da biblioteca — e so a
   * ultima precisa ser traduzida. `isKnownIcon` e o que separa: ele so reconhece
   * o que existe no catalogo, entao uma URL nunca e confundida com um icone.
   */
  const icon = isKnownIcon(element.src) ? resolveIcon(element.src) : undefined;
  const tone = iconTone(accent, element.iconTone, theme);

  return (
    <div className={styles.root} data-editable={editable || undefined} data-link={data.link}>
      {editable && (
        <NodeResizer
          isVisible={selected}
          color={theme.colors.primary.main}
          minWidth={IMAGE_DEFAULT.minWidth}
          minHeight={IMAGE_DEFAULT.minHeight}
          // A proporcao nao e travada: o `fit` ja protege a figura de distorcer,
          // e travar impediria a placa retangular que uma legenda longa pede.
        />
      )}

      {/* O gatilho e a caixa da placa, nao a legenda: sem placa a imagem nao
          resolve estado nenhum, e o `ElementHover` se cala sozinho. E tambem a
          superficie do drill-down — a legenda fica de fora, porque ela vive
          abaixo da caixa e um clique nela seria um clique fora da figura. */}
      <ElementHover
        accent={accent}
        title={element.trigger?.host}
        editable={editable}
        linked={hasDrilldown(element.drilldown)}
        dragging={dragging}
        // So no modo Estado: sem placa a imagem nao resolve metrica nenhuma, e o
        // grafico anunciaria um vinculo que nao existe.
        chart={
          element.chart && stateMode ? (
            <MetricChart frames={frames} field={stateFieldName(element.color, frames)} />
          ) : undefined
        }
      >
        <DrilldownSurface
          drilldown={element.drilldown}
          editable={editable}
          className={cx(
            styles.box,
            BOX_CLASS,
            (selected || data.link === 'source') && styles.selected,
            stateMode && alertClass(accent, element.alert)
          )}
          style={{
            background: surface,
            // Alimenta o `currentColor` dos aneis do radar: eles saem na cor do
            // estado que anunciam, e nao na cor de texto herdada.
            color: fill?.background ?? theme.colors.text.primary,
          }}
        >
          {icon ? (
            /*
              O icone da biblioteca preenche a caixa em vez de sair num tamanho
              fixo: aqui quem manda no tamanho e o elemento, que o usuario
              redimensiona com a alca. `TopoIcon` cobre as tres naturezas — o
              glifo sai em SVG e herda a cor do estado, a figura em `<img>`.
            */
            <TopoIcon icon={icon} tone={tone} size="100%" className={styles.image} />
          ) : element.src ? (
            <img
              className={styles.image}
              src={element.src}
              // A imagem e decorativa: quem nomeia o elemento e a legenda, e
              // repeti-la no `alt` faria o leitor de tela anunciar duas vezes.
              alt=""
              style={{ objectFit: element.fit }}
              draggable={false}
            />
          ) : (
            <div className={styles.placeholder}>Sem imagem</div>
          )}
        </DrilldownSurface>
      </ElementHover>

      {/*
        A legenda e **irma** da caixa, nao filha: dentro dela, cada linha de
        texto roubava altura da figura, e escrever tres metricas encolhia a
        imagem ate sumir. Fora, a figura fica com a caixa inteira e o texto
        transborda para os lados e para baixo, que e o que se quer de um rotulo.

        A lista de triggers desce junto, no mesmo empilhamento: sao os dois
        rotulos que a imagem tem, e posicionados de forma independente um
        cobriria o outro.
      */}
      <div className={styles.below}>
        {caption && (
          <div className={styles.caption} style={{ fontSize: element.fontSize }}>
            {caption}
          </div>
        )}

        {/*
          Embaixo, a lista entra **aqui dentro**, empilhada sob a legenda: as
          duas disputam o mesmo lugar, e ancoradas cada uma por conta propria uma
          cobriria a outra. Nos outros lados nao ha disputa, e a lista se ancora
          no elemento como nos demais tipos — foi por viver sempre neste
          container que a posicao nao saia de baixo.
        */}
        {abaixo && (
          <ActiveTriggers
            problems={ativas}
            position="bottom"
            display={element.trigger?.activeDisplay}
            width={element.size.width}
          />
        )}
      </div>

      {!abaixo && (
        <ActiveTriggers
          problems={ativas}
          position={element.trigger?.activePosition}
          display={element.trigger?.activeDisplay}
          width={element.size.width}
        />
      )}

      {HANDLES.map(({ position, type }) => (
        <Handle
          key={position}
          id={position}
          type={type}
          position={position}
          className={cx(styles.handle, HANDLE_CLASS)}
        />
      ))}
    </div>
  );
}

/**
 * Cor da placa, ja com a opacidade aplicada. `undefined` quando nao ha placa.
 *
 * No modo `state` a cor vem do estado resolvido, e os dois casos sem estado sao
 * tratados **diferente** de proposito:
 *
 *   - `nodata` cai em `text.disabled`, o mesmo cinza que o no e o point usam
 *     para dizer "ha vinculo, falta dado";
 *   - `neutral` cai no fundo neutro do tema, uma placa visivel que nao sinaliza
 *     nada — o usuario ligou o fundo, entao ele tem de aparecer, mas ainda nao
 *     ha estado a comunicar.
 *
 * Sumir com a placa nesses casos seria pior: o toggle ligado sem nada na tela se
 * le como bug, e um elemento sem dado ficaria indistinguivel de um saudavel.
 */
export function backgroundColor(
  background: ImageBackground | undefined,
  accent: ElementColor,
  stateColor: string | undefined,
  theme: GrafanaTheme2
): string | undefined {
  if (!background) {
    return undefined;
  }

  if (background.mode === 'fixed') {
    return alpha(theme.visualization.getColorByName(background.color), background.opacity);
  }

  const color =
    stateColor ?? (accent.state === 'nodata' ? theme.colors.text.disabled : theme.colors.background.secondary);

  return alpha(color, background.opacity);
}

const getStyles = (theme: GrafanaTheme2) => ({
  root: css({
    position: 'relative',
    width: '100%',
    height: '100%',

    [`&[data-editable]:hover .${HANDLE_CLASS}`]: {
      opacity: 1,
      pointerEvents: 'auto',
    },

    '&&[data-link="valid"]': {
      cursor: 'crosshair',
      [`&:hover .${BOX_CLASS}`]: {
        boxShadow: selectionRing(theme.colors.primary.main),
      },
    },
    [`&[data-link="invalid"]:hover .${BOX_CLASS}`]: {
      boxShadow: 'none',
    },
  }),
  /**
   * Sem borda e sem sombra por padrao: a imagem **e** a forma, e uma moldura em
   * volta de todo logo transformaria a topologia num album de figurinhas. O que
   * a caixa oferece e o lugar onde a placa e o anel de selecao pousam.
   */
  box: css({
    position: 'relative',
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing(0.5),
    borderRadius: theme.shape.radius.default,
    cursor: 'default',
    transition: `box-shadow ${TRANSITION_FAST}`,
  }),
  selected: css({
    boxShadow: selectionRing(theme.colors.primary.main),
  }),
  /**
   * `width` e `height` de 100%, e nao `max-width`: sao eles que dao ao `<img>`
   * uma caixa **propria**, e sem caixa propria o `object-fit` nao tem o que
   * ajustar — a figura simplesmente assumia o tamanho natural e as tres opcoes
   * de Ajuste davam no mesmo. Com a caixa, cada uma faz o seu: `contain` cabe
   * inteira, `cover` preenche cortando, `fill` estica.
   */
  image: css({
    width: '100%',
    height: '100%',
    // `objectFit` vem inline, do `fit` do elemento.
    pointerEvents: 'none',
    userSelect: 'none',
  }),
  placeholder: css({
    flex: '1 1 auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    border: `1px dashed ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.default,
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    textAlign: 'center',
  }),
  /**
   * Fora do fluxo: centrada sob a caixa, livre para ser mais larga que ela.
   *
   * `position: absolute` e o que garante que o texto **nunca** dispute espaco
   * com a figura — sem ele, um rotulo de tres linhas empurraria a imagem para
   * cima ate ela sumir dentro da propria caixa.
   *
   * `pre` como no rotulo da conexao: as quebras e o alinhamento em coluna que o
   * usuario digitou sao a estrutura da leitura, e colapsar espaco desmancharia
   * um `IN: ` alinhado com um `OUT:`.
   *
   * Cor do tema, e nao a de contraste do estado: aqui embaixo o texto pousa no
   * fundo do canvas, e nao na placa — `fill.text` so vale sobre a placa.
   */
  /**
   * Empilhamento abaixo da figura: legenda e lista de triggers, nesta ordem.
   *
   * A posicao absoluta que era da legenda mudou-se para ca — com dois rotulos,
   * cada um ancorado por conta propria em `top: 100%` acabaria por cima do
   * outro. O container tambem e quem garante que nenhum dos dois dispute altura
   * com a imagem.
   */
  below: css({
    position: 'absolute',
    top: '100%',
    left: '50%',
    transform: 'translateX(-50%)',
    marginTop: theme.spacing(0.5),
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    width: 'max-content',
  }),
  caption: css({
    position: 'relative',
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamilyMonospace,
    lineHeight: 1.3,
    textAlign: 'center',
    whiteSpace: 'pre',
  }),
  handle: css({
    '&&': {
      width: HANDLE_SIZE,
      height: HANDLE_SIZE,
      background: theme.colors.background.canvas,
      border: `1px solid ${theme.colors.primary.main}`,
      borderRadius: theme.shape.radius.circle,
      opacity: 0,
      pointerEvents: 'none',
      transition: `opacity ${TRANSITION_FAST}`,
    },
  }),
});
