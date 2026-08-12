import React from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { Icon, PopoverContent, Tooltip, useStyles2 } from '@grafana/ui';

/**
 * Rotulo com o "porque" atras de um icone de info — o **unico** padrao de
 * tooltip do painel (decisao 0.7 do PRD).
 *
 * Os quatro candidatos nativos foram avaliados e este e o unico que serve ao
 * layout daqui: `InlineField tooltip` exige linha com `labelWidth` fixo e ainda
 * faz `Omit<..., 'description'>`, incompativel com um painel vertical e estreito;
 * `Field description` e `Label description` empurram o texto para o corpo, que e
 * exatamente o que o bloco quer tirar de la. Como `Field.label` aceita
 * `ReactNode`, compor aqui nao custa nenhuma API nova.
 *
 * Tres detalhes que nao sao decorativos:
 *
 *   - **O gatilho e um `<button>`, nao o `Icon`.** O `Tooltip` do Grafana abre
 *     no foco, mas so se o filho for focavel — e `Icon` renderiza um `<svg>`,
 *     que nao e. Pendurar `tabIndex` no proprio `Icon` parecia resolver e nao
 *     resolve: ele nao repassa props de SVG de forma confiavel (no ambiente de
 *     teste, o mock de `react-inlinesvg` do scaffolding descarta todos), entao o
 *     atributo sumia sem aviso. Num botao o foco vem de graca, o nome acessivel
 *     tambem, e nada disso depende do que o `Icon` decide encaminhar.
 *   - **`preventDefault` no clique.** O botao vive dentro do `<label>` do
 *     `Field`, e clicar em qualquer ponto de um label ativa o controle
 *     associado. Sem isto, ler a explicacao de um checkbox o **marcaria**.
 *   - **`Icon` fica `aria-hidden`.** Quem carrega o nome e o botao; o glifo
 *     repetiria a informacao no leitor de tela.
 */

interface FieldLabelProps {
  children: React.ReactNode;
  /** Ausente devolve o rotulo cru — nem todo campo precisa de explicacao. */
  info?: PopoverContent;
}

export function FieldLabel({ children, info }: FieldLabelProps) {
  const styles = useStyles2(getStyles);

  if (!info) {
    return <>{children}</>;
  }

  return (
    <span className={styles.label}>
      {children}
      <Tooltip content={info} placement="top">
        <button
          type="button"
          className={styles.trigger}
          aria-label="Mais informações"
          onClick={(event) => event.preventDefault()}
        >
          <Icon name="info-circle" size="sm" aria-hidden />
        </button>
      </Tooltip>
    </span>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  label: css({
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
  }),
  // Um botao que nao parece um botao: o realce fica por conta do `:focus-visible`
  // do tema, que e o que um usuario de teclado precisa enxergar.
  trigger: css({
    display: 'inline-flex',
    alignItems: 'center',
    padding: 0,
    border: 'none',
    background: 'none',
    color: theme.colors.text.secondary,
    cursor: 'help',

    '&:hover': {
      color: theme.colors.text.primary,
    },
    '&:focus-visible': {
      color: theme.colors.text.primary,
      outline: `2px solid ${theme.colors.primary.main}`,
      outlineOffset: 2,
      borderRadius: theme.shape.radius.default,
    },
  }),
});
