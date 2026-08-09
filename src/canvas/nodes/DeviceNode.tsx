import React from 'react';
import { css, cx } from '@emotion/css';
import { DisplayValue, GrafanaTheme2 } from '@grafana/data';
import { useStyles2, useTheme2 } from '@grafana/ui';
import { Handle, HandleType, NodeProps, Position } from '@xyflow/react';

import { formatDisplayValue, resolveDisplayValue, resolveText } from '../../data/dimensions';
import { ElementColor, accentColor, resolveElementColor } from '../../data/elementColor';
import { DeviceFlowNode } from '../flowTypes';
import { TopoIcon, resolveTopoIcon } from '../icons';
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
 * A cor resolvida pinta **so o icone, a capsula e o badge** (Anexo A.2). Card,
 * borda e texto ficam sempre neutros: um no DOWN continua sendo um card cinza
 * `background.secondary`, e o que fica vermelho e o icone. E isso que mantem
 * uma topologia de 200 nos legivel quando 30 estao em alerta — preencher o card
 * inteiro transformaria a cena em letreiro.
 */
export function DeviceNode({ data, selected }: NodeProps<DeviceFlowNode>) {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const { element, frames, editable } = data;

  const accent = resolveElementColor(element.color, frames, theme, element.trigger);
  const primary = resolveText(element.presentation.primaryText, frames);
  const secondary = element.presentation.secondaryText && resolveText(element.presentation.secondaryText, frames);

  // `tint` so existe nos niveis 0, 1 e 2 da cadeia. Sem ele a capsula fica
  // `background.primary` e o icone `text.secondary` — o estado neutro de A.3.
  // Uma trigger alarmando pousa exatamente onde o threshold pousa: icone,
  // capsula e badge. O card continua `background.secondary` — encher o card
  // inteiro de vermelho e o que transforma um NOC com 30 alarmes em letreiro.
  const tint = accentColor(accent);
  const iconColor =
    tint ?? (accent.state === 'nodata' ? theme.colors.text.disabled : theme.colors.text.secondary);

  const display = resolveDisplayValue(frames, element.value?.field);
  const badge = resolveBadge(accent, theme, element.value?.field, display);

  return (
    <div className={styles.root} data-editable={editable || undefined} data-link={data.link}>
      {/* A origem do gesto usa o mesmo tratamento de selecionado: durante a
          linkagem ela e, de fato, o elemento em foco. */}
      <div
        className={cx(styles.card, CARD_CLASS, (selected || data.link === 'source') && styles.cardSelected)}
      >
        {/* Sem icone, a capsula tambem sai — uma caixa vazia no lugar dele
            deixaria o texto desalinhado por um motivo invisivel. */}
        {element.presentation.showIcon && (
          <span
            className={styles.iconBox}
            style={
              tint
                ? { background: alpha(tint, 0.12), boxShadow: `inset 0 0 0 1px ${alpha(tint, 0.3)}` }
                : undefined
            }
          >
            <TopoIcon name={resolveTopoIcon(element.presentation.icon)} size={ICON_SIZE} style={{ color: iconColor }} />
          </span>
        )}

        <div className={styles.textBlock}>
          <div className={styles.primary}>{primary}</div>
          {secondary && <div className={styles.secondary}>{secondary}</div>}
        </div>

        {badge &&
          (badge.label ? (
            <span
              className={styles.badge}
              style={{
                color: badge.color,
                background: alpha(badge.color, 0.15),
                borderColor: alpha(badge.color, 0.35),
              }}
            >
              {badge.label}
            </span>
          ) : (
            // Step colorido mas sem nome e sem metrica: um dot basta, e uma
            // pilula vazia so ocuparia o canto sem dizer nada.
            <span className={styles.badgeDot} style={{ background: badge.color }} />
          ))}
      </div>

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
 * Conteudo do badge, em ordem de precedencia:
 *
 *   1. trigger alarmando          -> o nome da severidade (`HIGH`, `DISASTER`)
 *   2. binding de cor sem dado    -> `NO DATA` em `text.disabled`
 *   3. step de threshold nomeado  -> o nome do step
 *   4. metrica em `value.field`   -> o valor formatado
 *   5. threshold sem nome nem metrica -> so o dot
 *
 * O item 4 preserva a pilula de metrica anterior ao Bloco 1: ela mudou de lugar
 * e de peso visual, mas o no nao perdeu a capacidade de exibir um numero.
 *
 * A trigger vem primeiro porque e o nivel 0 da cadeia. Ela tambem **substitui**
 * a metrica no badge em vez de disputar espaco: com a trigger no comando, o
 * numero da CPU ao lado da severidade sugeriria que os dois pintam o no.
 */
export function resolveBadge(
  accent: ElementColor,
  theme: GrafanaTheme2,
  valueField: string | undefined,
  display: DisplayValue | undefined
): { color: string; label: string } | undefined {
  if (accent.state === 'trigger') {
    return { color: accent.color, label: accent.label };
  }

  if (accent.state === 'nodata') {
    return { color: theme.colors.text.disabled, label: NO_DATA_LABEL };
  }

  if (accent.state === 'threshold') {
    return { color: accent.color, label: accent.label ?? (valueField ? formatDisplayValue(display) : '') };
  }

  if (valueField) {
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
