import React from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, useTheme2 } from '@grafana/ui';
import { NodeProps } from '@xyflow/react';

import { POSTIT_DEFAULT } from '../../model/sizes';
import { PostitFlowNode } from '../flowTypes';
import { TRANSITION_FAST, alpha, selectionRing } from '../tokens';

/**
 * Retangulo de agrupamento, sempre atras dos demais elementos.
 *
 * Preenchimento leve em vez de solido: um retangulo saturado atras dos nos
 * compete com eles pela atencao e tapa a grade. A opacidade configurada modula
 * o tint, nao o elemento inteiro — modular o elemento apagaria tambem o titulo
 * e a borda.
 *
 * O titulo nao fica dentro do retangulo: e uma tag flutuando **sobre a borda**,
 * com fundo `background.canvas` que corta o traco. Assim ele nomeia o grupo sem
 * consumir a area util onde os nos ficam.
 *
 * Nao tem handles: postit nunca participa de conexao. Nao tem binding de dados
 * — `color` e uma string simples no schema, justamente para tornar isso
 * impossivel de configurar por engano.
 */
export function PostitNode({ data, selected }: NodeProps<PostitFlowNode>) {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const { element } = data;

  const accent = theme.visualization.getColorByName(element.color);

  return (
    <div
      className={styles.wrapper}
      style={{
        background: alpha(accent, element.opacity),
        // A borda nao muda ao selecionar: antes ela saturava para a cor do
        // proprio postit, o que dizia "colorido", nao "selecionado" — e num
        // postit azul o resultado era indistinguivel do estado de repouso. O
        // sinal de selecao e o anel, na cor de selecao do tema.
        border: `1.5px ${element.borderStyle} ${alpha(accent, 0.3)}`,
        boxShadow: selected ? selectionRing(theme.colors.primary.main) : undefined,
      }}
    >
      {element.title && (
        <div className={styles.title} style={{ color: accent, borderColor: alpha(accent, 0.35) }}>
          {element.title}
        </div>
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    position: 'relative',
    width: '100%',
    height: '100%',
    // Piso do relatorio (§4). Abaixo disso a tag de titulo nao cabe sobre a
    // borda e o retangulo deixa de comportar qualquer no.
    minWidth: POSTIT_DEFAULT.minWidth,
    minHeight: POSTIT_DEFAULT.minHeight,
    padding: theme.spacing(2),
    borderRadius: theme.shape.radius.default,
    transition: `border-color ${TRANSITION_FAST}, box-shadow ${TRANSITION_FAST}`,
  }),
  title: css({
    position: 'absolute',
    top: -11,
    left: 12,
    maxWidth: 'calc(100% - 24px)',
    padding: '2px 8px',
    // O fundo opaco e o que corta a borda do retangulo por baixo da tag.
    background: theme.colors.background.canvas,
    border: '1px solid',
    borderRadius: theme.shape.radius.default,
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.bodySmall.fontSize,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    lineHeight: 1.4,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  }),
});
