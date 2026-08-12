import React from 'react';
import { css, cx } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, useTheme2 } from '@grafana/ui';
import { NodeProps, NodeResizer } from '@xyflow/react';

import { POSTIT_DEFAULT } from '../../model/sizes';
import { TopoPostit } from '../../model/types';
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
  const { element, editable } = data;

  const accent = theme.visualization.getColorByName(element.color);

  return (
    <>
      {/*
        A alca de redimensionamento so aparece com o postit selecionado e em modo
        de edicao: num dashboard publicado nao ha o que redimensionar, e alcas
        permanentes em todo postit poluiriam a cena.

        Os minimos sao os mesmos do CSS (`POSTIT_DEFAULT`), senao a alca deixaria
        arrastar ate um tamanho que o proprio retangulo se recusa a assumir — e o
        que fica salvo divergiria do que se ve.
      */}
      {editable && (
        <NodeResizer
          isVisible={selected}
          color={theme.colors.primary.main}
          minWidth={POSTIT_DEFAULT.minWidth}
          minHeight={POSTIT_DEFAULT.minHeight}
        />
      )}

      <div
        className={styles.wrapper}
        style={{
          background: alpha(accent, element.opacity),
          // A borda nao muda ao selecionar: antes ela saturava para a cor do
          // proprio postit, o que dizia "colorido", nao "selecionado" — e num
          // postit azul o resultado era indistinguivel do estado de repouso. O
          // sinal de selecao e o anel, na cor de selecao do tema.
          border: `${element.borderWidth}px ${element.borderStyle} ${alpha(accent, 0.3)}`,
          boxShadow: selected ? selectionRing(theme.colors.primary.main) : undefined,
        }}
      >
        {element.title && (
          <div
            className={cx(styles.title, TITLE_POSITION[element.titlePosition])}
            style={{ color: accent, borderColor: alpha(accent, 0.35) }}
          >
            {element.title}
          </div>
        )}
      </div>
    </>
  );
}

/** Deslocamento da tag para que ela fique montada sobre o traco da borda. */
const TITLE_OFFSET = -11;
const TITLE_INSET = 12;

const TITLE_POSITION: Record<TopoPostit['titlePosition'], string> = {
  'top-left': css({ top: TITLE_OFFSET, left: TITLE_INSET }),
  'top-right': css({ top: TITLE_OFFSET, right: TITLE_INSET }),
  'bottom-left': css({ bottom: TITLE_OFFSET, left: TITLE_INSET }),
  'bottom-right': css({ bottom: TITLE_OFFSET, right: TITLE_INSET }),
};

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
  /**
   * A tag flutua **sobre** a borda, e nao dentro do retangulo: e o deslocamento
   * de 11px (metade da altura da tag) que faz o fundo opaco cortar o traco.
   * O canto vem de `TITLE_POSITION`, que so troca quais dos quatro lados sao
   * fixados — as medidas sao as mesmas nos quatro.
   */
  title: css({
    position: 'absolute',
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
