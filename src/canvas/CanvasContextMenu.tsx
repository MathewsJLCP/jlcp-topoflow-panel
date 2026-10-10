import React, { useEffect, useRef } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { OrderCommand } from '../model/mutations';
import { ElementKind } from '../model/types';
import { FONT_MONO, FONT_SANS, TfPalette, tfPalette } from '../theme/palette';

/**
 * Menu do clique direito, no desenho do mockup: um cartao com o id do alvo no
 * topo (ou "canvas") e os itens em texto, sem icones; "Excluir" em vermelho.
 *
 * `x`/`y` sao relativos ao canvas; o menu se encolhe para dentro dele.
 */
export type MenuState =
  | { kind: 'pane'; x: number; y: number }
  | {
      kind: 'element';
      elementKind: ElementKind;
      x: number;
      y: number;
      id: string;
      label: string;
      /** Selecao que o "Agrupar" juntaria. Ausente = nao ha o que agrupar. */
      selection?: string[];
      /** O elemento ja esta num grupo: oferece "Desagrupar". */
      grouped?: boolean;
    }
  | { kind: 'edge'; x: number; y: number; id: string; label: string; hasWaypoints: boolean }
  | { kind: 'vertex'; x: number; y: number; id: string; label: string; index: number };

interface Props {
  state: MenuState;
  /** Tamanho do canvas, para o menu nao vazar pela borda. */
  bounds: { width: number; height: number };
  onClose: () => void;
  onAdd: (kind: ElementKind) => void;
  onLink: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onReorder: (id: string, command: OrderCommand) => void;
  onReverse: (id: string) => void;
  onGroup: (ids: string[]) => void;
  onUngroup: (id: string) => void;
  onAddVertex: (id: string) => void;
  onRemoveVertex: (id: string, index: number) => void;
  onClearPath: (id: string) => void;
}

type Item = { label: string; run: () => void; danger?: boolean } | 'sep';

export function CanvasContextMenu(props: Props) {
  const { state, bounds, onClose } = props;
  const styles = useStyles2(getStyles);
  const ref = useRef<HTMLDivElement>(null);

  // Fecha no clique fora e no Esc. O Grafana consome o `Esc` antes do bubbling,
  // entao o listener e de captura.
  useEffect(() => {
    const down = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose();
      }
    };
    const key = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('mousedown', down, true);
    window.addEventListener('keydown', key, true);
    return () => {
      window.removeEventListener('mousedown', down, true);
      window.removeEventListener('keydown', key, true);
    };
  }, [onClose]);

  const items = menuItems(props);
  const height = items.length * 32 + 50;

  return (
    <div
      ref={ref}
      className={styles.menu}
      style={{
        left: Math.max(0, Math.min(state.x, bounds.width - 220)),
        top: Math.max(0, Math.min(state.y, bounds.height - height)),
      }}
      onContextMenu={(event) => event.preventDefault()}
      role="menu"
    >
      <div className={styles.title}>{state.kind === 'pane' ? 'canvas' : state.label}</div>
      {items.map((item, i) =>
        item === 'sep' ? (
          <div key={i} className={styles.sep} />
        ) : (
          <button
            key={i}
            type="button"
            role="menuitem"
            className={styles.item}
            data-danger={item.danger || undefined}
            onClick={() => {
              onClose();
              item.run();
            }}
          >
            {item.label}
          </button>
        )
      )}
    </div>
  );
}

function menuItems(p: Props): Item[] {
  const { state } = p;
  switch (state.kind) {
    case 'pane':
      return [
        { label: 'Adicionar nó aqui', run: () => p.onAdd('node') },
        { label: 'Adicionar postit aqui', run: () => p.onAdd('postit') },
        { label: 'Adicionar texto aqui', run: () => p.onAdd('text') },
        { label: 'Adicionar imagem aqui', run: () => p.onAdd('image') },
      ];
    case 'vertex':
      return [
        { label: 'Remover vértice', run: () => p.onRemoveVertex(state.id, state.index) },
        { label: 'Limpar trajeto', run: () => p.onClearPath(state.id) },
      ];
    case 'edge':
      return [
        { label: 'Adicionar vértice aqui', run: () => p.onAddVertex(state.id) },
        ...(state.hasWaypoints ? [{ label: 'Limpar trajeto', run: () => p.onClearPath(state.id) }] : []),
        { label: 'Inverter direção', run: () => p.onReverse(state.id) },
        'sep',
        { label: 'Excluir', run: () => p.onDelete(state.id), danger: true },
      ];
    case 'element': {
      const linkable = state.elementKind === 'node' || state.elementKind === 'point' || state.elementKind === 'image';
      const selection = state.selection;
      return [
        ...(selection ? [{ label: `Agrupar (${selection.length})`, run: () => p.onGroup(selection) }] : []),
        ...(state.grouped ? [{ label: 'Desagrupar', run: () => p.onUngroup(state.id) }] : []),
        ...(selection || state.grouped ? ['sep' as const] : []),
        ...(linkable ? [{ label: 'Linkar', run: () => p.onLink(state.id) }] : []),
        ...(state.elementKind === 'postit'
          ? [
              { label: 'Trazer para frente', run: () => p.onReorder(state.id, 'front') },
              { label: 'Enviar para trás', run: () => p.onReorder(state.id, 'back') },
            ]
          : []),
        { label: 'Duplicar', run: () => p.onDuplicate(state.id) },
        'sep',
        { label: 'Excluir', run: () => p.onDelete(state.id), danger: true },
      ];
    }
  }
}

const getStyles = (theme: GrafanaTheme2) => {
  const p: TfPalette = tfPalette(theme);
  return {
    menu: css({
      position: 'absolute',
      minWidth: 210,
      background: p.sup,
      border: `1px solid ${p.borda}`,
      borderRadius: 9,
      boxShadow: `0 12px 32px ${p.shadow}`,
      padding: 4,
      zIndex: 8,
    }),
    title: css({
      padding: '6px 10px 5px',
      font: `500 10.5px ${FONT_MONO}`,
      color: p.apa,
      letterSpacing: '0.04em',
    }),
    sep: css({ height: 1, background: p.linha, margin: '4px 6px' }),
    item: css({
      display: 'block',
      width: '100%',
      textAlign: 'left',
      border: 0,
      background: 'transparent',
      padding: '7px 10px',
      borderRadius: 6,
      font: `13px ${FONT_SANS}`,
      color: p.tx,
      cursor: 'pointer',
      '&:hover': { background: p.elev },
      '&[data-danger]': { color: p['cr-t'] },
    }),
  };
};
