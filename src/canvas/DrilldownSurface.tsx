import React from 'react';
import { css, cx } from '@emotion/css';
import { useStyles2 } from '@grafana/ui';

import { Drilldown } from '../model/types';
import { drilldownHref, navigateInApp, shouldNavigateInApp } from './drilldown';

/**
 * A superficie clicavel de um elemento com drill-down.
 *
 * Renderiza um `<a>` quando ha para onde ir e um `<div>` quando nao ha — mesma
 * classe, mesmo estilo, mesmo lugar na arvore. Trocar a **tag** e nao adicionar
 * um `onClick` e o que entrega de graca o ctrl+clique, o clique do meio, o
 * endereco na barra de status, o foco por Tab e o anuncio como link.
 *
 * ## Por que em modo de edicao nunca vira link
 *
 * No editor o clique ja tem dono: ele seleciona o elemento e abre o formulario
 * dele no painel de Layers. Um segundo significado no mesmo gesto tiraria o
 * usuario do dashboard no meio da configuracao — e o `<a>` ainda brigaria com o
 * arraste do React Flow, porque ancora e nativamente arrastavel.
 *
 * O preco e que o link so pode ser experimentado fora do editor, e o formulario
 * diz isso em vez de deixar o usuario concluir que nao funcionou.
 *
 * ## Por que `forwardRef`
 *
 * No `DeviceNode` e na `ImageNode` esta superficie e filha do `ElementHover`,
 * e o `Tooltip` do Grafana ancora nela por ref. Um componente de funcao sem
 * `forwardRef` engoliria essa ref em silencio e o painel de triggers passaria a
 * abrir no canto da tela.
 */

interface DrilldownSurfaceProps extends React.HTMLAttributes<HTMLElement> {
  /** Ausente (ou sem `url`) significa desligado: sai um `div`. */
  drilldown?: Drilldown;
  /** Em modo de edicao o clique seleciona; o link nao existe. */
  editable?: boolean;
  children: React.ReactNode;
}

export const DrilldownSurface = React.forwardRef<HTMLElement, DrilldownSurfaceProps>(function DrilldownSurface(
  { drilldown, editable, className, onClick, children, ...rest },
  ref
) {
  const styles = useStyles2(getStyles);
  const href = editable ? undefined : drilldownHref(drilldown);

  if (!href) {
    return (
      <div ref={ref as React.Ref<HTMLDivElement>} className={className} onClick={onClick} {...rest}>
        {children}
      </div>
    );
  }

  const targetBlank = Boolean(drilldown?.targetBlank);

  return (
    <a
      ref={ref as React.Ref<HTMLAnchorElement>}
      className={cx(className, styles.link)}
      href={href}
      target={targetBlank ? '_blank' : undefined}
      // Sem `noopener` a pagina aberta recebe `window.opener` e pode navegar a
      // aba do dashboard para onde quiser. E o telao de um NOC.
      rel={targetBlank ? 'noopener noreferrer' : undefined}
      // Ancora e arrastavel por padrao no HTML. Sem isto, arrastar o elemento no
      // dashboard (onde a edicao inline pode estar ligada) iniciaria o arraste
      // nativo do link em vez do gesto do canvas.
      draggable={false}
      onClick={(event) => {
        onClick?.(event);
        if (shouldNavigateInApp(href, targetBlank, event)) {
          event.preventDefault();
          navigateInApp(href);
        }
      }}
      {...rest}
    >
      {children}
    </a>
  );
});

const getStyles = () => ({
  /**
   * O link nao pode **parecer** um link: o elemento ja tem a sua identidade
   * visual, e azul-sublinhado por cima de um card de estado seria ruido. O que
   * sinaliza a acao e o cursor, que e o que o operador ve ao passar o ponteiro.
   *
   * `color: inherit` importa mais do que parece — sem ele o `<a>` tingiria de
   * azul o texto do no e da legenda da imagem, apagando a cor de contraste que
   * o `stateFill` calculou para ser legivel sobre o fundo do estado.
   */
  link: css({
    '&&': {
      color: 'inherit',
      textDecoration: 'none',
      cursor: 'pointer',
    },
  }),
});
