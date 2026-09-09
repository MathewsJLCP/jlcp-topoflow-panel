import React from 'react';
import { css, cx } from '@emotion/css';
import { DisplayValue, GrafanaTheme2 } from '@grafana/data';
import { useStyles2, useTheme2 } from '@grafana/ui';
import { Handle, HandleType, NodeProps, Position } from '@xyflow/react';

import { formatDisplayValue, resolveDisplayValue, resolveText, stateFieldName } from '../../data/dimensions';
import { ElementColor, resolveElementColor } from '../../data/elementColor';
import { DeviceFlowNode } from '../flowTypes';
import { ResolvedIcon, TopoIcon, resolveIcon } from '../../icons';
import { alertClass } from '../alertAnimation';
import { iconTone } from '../iconTone';
import { StateFill, stateFill } from '../stateFill';
import { ActiveTriggers, activeProblems } from '../ActiveTriggers';
import { DrilldownSurface } from '../DrilldownSurface';
import { MetricChart } from '../MetricChart';
import { hasDrilldown } from '../drilldown';
import { ElementHover } from '../ElementHover';
import { HANDLE_SIZE, ICON_BOX_SIZE, ICON_SIZE, TRANSITION_FAST, alpha } from '../tokens';

/** Ganchos estaveis para os seletores: o nome do Emotion muda entre builds. */
const HANDLE_CLASS = 'topo-handle';
const CARD_CLASS = 'topo-card';

const HANDLES: Array<{ position: Position; type: HandleType }> = [
  { position: Position.Top, type: 'target' },
  { position: Position.Right, type: 'source' },
  { position: Position.Bottom, type: 'target' },
  { position: Position.Left, type: 'source' },
];

const NO_DATA_LABEL = 'no data';

/**
 * No de dispositivo: capsula de icone + bloco de texto + badge de estado.
 *
 * **O card inteiro assume a cor de estado** (doc de estilo §8). Um no com
 * severidade High e um retangulo vermelho de 180x60, nao um card cinza com um
 * icone vermelho.
 *
 * Isto reverte a regra A.2 original, que restringia a cor a icone, capsula e
 * badge para nao transformar um NOC com 30 alarmes em letreiro. A reversao e
 * deliberada e vem do PRD 6.2: numa topologia de parede, lida a metros de
 * distancia, um icone de 20px nao carrega o sinal — a area carrega. O custo
 * conhecido e o excesso de saturacao com muitos alarmes simultaneos.
 *
 * O que impede o preenchimento de virar ilegibilidade e o `stateFill`: ele
 * devolve o fundo **e** a cor de texto que o tema garante legivel sobre ele. Com
 * o card preenchido, texto, icone, capsula e badge derivam todos de `fill.text`
 * — nenhum deles pode mais assumir que o fundo e escuro.
 */
export function DeviceNode({ data, selected, dragging }: NodeProps<DeviceFlowNode>) {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const { element, frames, editable } = data;

  const accent = resolveElementColor(element.color, frames, theme, {
    trigger: element.trigger,
    thresholds: element.thresholds,
  });
  const primary = resolveText(element.presentation.primaryText, frames);
  const secondary = element.presentation.secondaryText && resolveText(element.presentation.secondaryText, frames);

  // `fill` so existe nos niveis 0, 1 e 2 da cadeia. Sem ele o card fica
  // `background.secondary`, a capsula `background.primary` e o icone
  // `text.secondary` — o estado neutro de A.3, que continua valendo para
  // `nodata` e `neutral`.
  const fill = stateFill(accent, theme);
  const iconColor =
    fill?.text ?? (accent.state === 'nodata' ? theme.colors.text.disabled : theme.colors.text.secondary);

  const icon = resolveIcon(element.presentation.icon);
  // A figura nao pode ser tingida, mas troca de arquivo conforme o estado.
  const tone = iconTone(accent, element.presentation.iconTone, theme);

  const display = resolveDisplayValue(frames, element.value?.field);
  // A presenca de `value` e o toggle "Exibir valor"; `value.field` e so a
  // metrica escolhida dentro dele. Quem decide se ha texto no badge e o toggle.
  const badge = resolveBadge(accent, theme, element.value !== undefined, display);
  // Sobre um card preenchido, qualquer cor propria do badge disputa com o fundo
  // — inclusive a dele mesmo, que **e** o fundo nos estados de trigger e
  // threshold. O token de contraste e o unico legivel ali por construcao.
  const badgeColor = fill ? fill.text : badge?.color;

  return (
    <div className={styles.root} data-editable={editable || undefined} data-link={data.link}>
      {/* O card e o gatilho do painel de triggers: e a superficie inteira do no,
          e o badge sozinho seria um alvo de 40x14 num telao. E, pelo mesmo
          motivo, e tambem a superficie do drill-down. */}
      <ElementHover
        accent={accent}
        title={primary}
        editable={editable}
        linked={hasDrilldown(element.drilldown)}
        dragging={dragging}
        chart={
          element.chart ? <MetricChart frames={frames} field={stateFieldName(element.color, frames)} /> : undefined
        }
      >
        {/* A origem do gesto usa o mesmo tratamento de selecionado: durante a
            linkagem ela e, de fato, o elemento em foco. */}
        <DrilldownSurface
          drilldown={element.drilldown}
          editable={editable}
          className={cx(
            styles.card,
            CARD_CLASS,
            (selected || data.link === 'source') && styles.cardSelected,
            alertClass(accent, element.alert)
          )}
          // Inline e nao classe porque a cor vem do dado. Nao toca em `border` de
          // proposito: e da borda que saem o hover e o anel de selecao, e um
          // estilo inline venceria as duas classes.
          //
          // `color` alimenta o `currentColor` dos aneis do radar: eles saem na cor
          // do estado que estao anunciando, e nao na cor de texto herdada.
          style={fill ? { background: fill.background, color: fill.background } : undefined}
        >
          {/* Sem icone, a capsula tambem sai — uma caixa vazia no lugar dele
            deixaria o texto desalinhado por um motivo invisivel. */}
          {element.presentation.showIcon && (
            <span className={styles.iconBox} style={capsule(icon, fill, theme)}>
              <TopoIcon icon={icon} tone={tone} size={ICON_SIZE} style={{ color: iconColor }} />
            </span>
          )}

          <div className={styles.textBlock}>
            <div className={styles.primary} style={fill ? { color: fill.text } : undefined}>
              {primary}
            </div>
            {/* A hierarquia entre primario e secundario e mantida por opacidade
              sobre a mesma cor de contraste, e nao por `text.secondary`, que so
              tem contraste garantido sobre o fundo neutro do tema. */}
            {secondary && (
              <div className={styles.secondary} style={fill ? { color: alpha(fill.text, 0.8) } : undefined}>
                {secondary}
              </div>
            )}
          </div>

          {badge && badgeColor && badge.label && (
            <span
              className={styles.badge}
              style={{
                color: badgeColor,
                background: alpha(badgeColor, 0.15),
                borderColor: alpha(badgeColor, 0.35),
              }}
            >
              {badge.label}
            </span>
          )}

          {/* Estado colorido sem texto: um dot basta, e uma pilula vazia so
            ocuparia o canto sem dizer nada. Com o card preenchido nem o dot se
            justifica — ele existia para dizer "ha estado aqui", e o card
            inteiro ja diz isso em 180x60. */}
          {badge && badgeColor && !badge.label && !fill && (
            <span className={styles.badgeDot} style={{ background: badgeColor }} />
          )}
        </DrilldownSurface>
      </ElementHover>

      {/* Irma do card, e nao filha: dentro dele as linhas roubariam altura do
          titulo. Fora, o card fica intacto e a lista transborda para baixo. */}
      <ActiveTriggers
        problems={activeProblems(accent, element.trigger)}
        position={element.trigger?.activePosition}
        display={element.trigger?.activeDisplay}
        width={element.size.width}
      />

      {/* Fora do card de proposito: o card sobe 1px no hover, e handles ali
          dentro subiriam junto, deslocando o alvo de conexao sob o ponteiro. */}
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
 * Superficie da capsula do icone.
 *
 * O glifo divide a cor do card: a capsula e um vinco claro sobre o fundo do
 * estado, e o desenho por cima sai no token de contraste. E o tratamento que
 * existe desde que o card inteiro passou a se pintar.
 *
 * A **figura** nao tem essa saida. Arte colorida nao herda cor, entao sobre um
 * card vermelho ela disputa com o fundo — um icone azul do Zabbix num alarme
 * Disaster se le como sujeira, nao como equipamento. Ela ganha entao uma placa
 * opaca no fundo neutro do tema: a mesma decisao ja tomada no elemento Imagem,
 * onde a cor do estado pousa **atras** da arte e nunca nela.
 */
function capsule(
  icon: ResolvedIcon,
  fill: StateFill | undefined,
  theme: GrafanaTheme2
): React.CSSProperties | undefined {
  if (icon.art.kind === 'image') {
    return {
      background: theme.colors.background.primary,
      boxShadow: `inset 0 0 0 1px ${theme.colors.border.weak}`,
    };
  }

  return fill
    ? { background: alpha(fill.text, 0.15), boxShadow: `inset 0 0 0 1px ${alpha(fill.text, 0.25)}` }
    : undefined;
}

/**
 * Conteudo do badge, em ordem de precedencia:
 *
 *   1. binding de cor sem dado  -> `NO DATA` em `text.disabled`
 *   2. estado com valor exibido -> o texto da regra, ou o valor formatado
 *   3. estado sem valor exibido -> rotulo vazio
 *   4. valor exibido sem estado -> o valor formatado
 *
 * Quem decide como um rotulo vazio aparece e o `DeviceNode`: com o card neutro
 * vira um dot, com o card preenchido nao vira nada. A cor devolvida aqui e a do
 * estado, tambem sujeita a troca pelo token de contraste quando ha fill — este
 * helper responde pelo **conteudo** do badge, nao pela superficie onde ele pousa.
 *
 * **`showValue` governa os itens 2 e 4.** O texto de uma regra e o texto do
 * valor: e o que o Value mappings do Grafana chama de *display text*, e serve
 * para substituir o numero por uma palavra (`200` -> `UP`). Com o valor
 * desligado nao ha o que substituir, entao a regra continua pintando o no mas
 * nao escreve nada — quem sinaliza o estado ali e a cor.
 *
 * **A trigger nao escreve mais aqui.** O badge chegou a exibir a severidade
 * (`HIGH`, `DISASTER`) por ser o unico texto de estado que o no tinha; com a
 * lista de triggers ativas embaixo do elemento, aquilo virou um segundo lugar
 * dizendo pior a mesma coisa — e ainda ocupava o badge, que o usuario liga para
 * ver a **metrica**. Hoje o modo trigger cai nas mesmas regras dos demais: com
 * "Exibir valor" ligado o badge mostra o valor, e sem ele nao mostra nada.
 *
 * `no data` continua fora dessa regra: nao e o valor da metrica, e sim um aviso
 * sobre o proprio vinculo — some-lo junto com o numero esconderia justamente o
 * que o operador precisa ver.
 */
export function resolveBadge(
  accent: ElementColor,
  theme: GrafanaTheme2,
  showValue: boolean,
  display: DisplayValue | undefined
): { color: string; label: string } | undefined {
  if (accent.state === 'nodata') {
    return { color: theme.colors.text.disabled, label: NO_DATA_LABEL };
  }

  if (accent.state === 'threshold') {
    // Sem `showValue` o label fica vazio e o badge vira um dot: a cor ja esta
    // no icone e na capsula, e a pilula so repetiria o que eles dizem.
    return { color: accent.color, label: showValue ? (accent.label ?? formatDisplayValue(display)) : '' };
  }

  if (showValue) {
    return { color: display?.color ?? theme.colors.text.secondary, label: formatDisplayValue(display) };
  }

  return undefined;
}

const getStyles = (theme: GrafanaTheme2) => ({
  root: css({
    position: 'relative',
    width: '100%',
    // `inherit` pega o `minHeight` que `useFlowElements` escreve no wrapper a
    // partir de `element.size.height`. Altura fixa aqui truncaria o titulo.
    minHeight: 'inherit',

    [`&[data-editable]:hover .${HANDLE_CLASS}`]: {
      opacity: 1,
      pointerEvents: 'auto',
    },

    // Alvo valido de linkagem: `crosshair` reverte o `not-allowed` que o
    // container aplica a todos os nos, e o hover antecipa o resultado do clique.
    '&&[data-link="valid"]': {
      cursor: 'crosshair',

      [`&:hover .${CARD_CLASS}`]: {
        borderColor: theme.colors.primary.main,
      },
    },
    // Alvo invalido nao ganha realce nenhum — nem o hover comum. O unico sinal
    // e o cursor `not-allowed` herdado do container.
    [`&[data-link="invalid"]:hover .${CARD_CLASS}`]: {
      transform: 'none',
      borderColor: theme.colors.border.weak,
      boxShadow: theme.shadows.z1,
    },
  }),
  card: css({
    position: 'relative',
    width: '100%',
    minHeight: 'inherit',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.25),
    padding: theme.spacing(1, 1.5),
    background: theme.colors.background.secondary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    boxShadow: theme.shadows.z1,
    cursor: 'default',
    transition: `border-color ${TRANSITION_FAST}, box-shadow ${TRANSITION_FAST}, transform ${TRANSITION_FAST}`,

    '&:hover': {
      transform: 'translateY(-1px)',
      borderColor: theme.colors.border.medium,
      boxShadow: theme.shadows.z2,
    },
  }),
  cardSelected: css({
    borderColor: theme.colors.primary.main,
    boxShadow: `0 0 0 1px ${theme.colors.primary.main}`,
    // Hover nao apaga a selecao: sem isto, passar o ponteiro sobre um no
    // selecionado trocaria o anel de selecao pela sombra de hover.
    '&:hover': {
      borderColor: theme.colors.primary.main,
      boxShadow: `0 0 0 1px ${theme.colors.primary.main}`,
    },
  }),
  iconBox: css({
    flex: `0 0 ${ICON_BOX_SIZE}px`,
    height: ICON_BOX_SIZE,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.shape.radius.default,
    background: theme.colors.background.primary,
    transition: `background ${TRANSITION_FAST}, box-shadow ${TRANSITION_FAST}`,
  }),
  textBlock: css({
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
    minWidth: 0,
  }),
  primary: css({
    color: theme.colors.text.primary,
    fontSize: theme.typography.body.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
    lineHeight: 1.3,
    // O card cresce em altura; o nome nunca e cortado.
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  }),
  secondary: css({
    color: theme.colors.text.secondary,
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.bodySmall.fontSize,
    lineHeight: 1.3,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  }),
  badge: css({
    // Fora do fluxo do flex: no canto, sem roubar largura do titulo.
    position: 'absolute',
    top: 6,
    right: 8,
    padding: '1px 6px',
    border: '1px solid',
    borderRadius: theme.shape.radius.sm,
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: 10,
    fontWeight: theme.typography.fontWeightMedium,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    lineHeight: 1.4,
    whiteSpace: 'nowrap',
  }),
  badgeDot: css({
    position: 'absolute',
    top: 6,
    right: 8,
    width: 6,
    height: 6,
    borderRadius: theme.shape.radius.circle,
  }),
  handle: css({
    // `&&` eleva a especificidade acima do CSS proprio do React Flow.
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
