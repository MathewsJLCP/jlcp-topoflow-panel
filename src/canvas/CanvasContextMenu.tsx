import React from 'react';
import { ContextMenu, Menu } from '@grafana/ui';

import { OrderCommand } from '../model/mutations';
import { ElementKind } from '../model/types';

/**
 * Onde o menu foi aberto. `elementKind` vem junto porque os itens mudam por
 * tipo — um postit nao linka, um texto nao reordena.
 */
export type MenuState =
  | { kind: 'pane'; x: number; y: number }
  | { kind: 'element'; elementKind: ElementKind; x: number; y: number; id: string; label: string }
  | { kind: 'edge'; x: number; y: number; id: string; label: string };

interface Props {
  state: MenuState;
  onClose: () => void;
  onAdd: (kind: ElementKind) => void;
  onLink: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onReorder: (id: string, command: OrderCommand) => void;
  onReverse: (id: string) => void;
}

export function CanvasContextMenu({
  state,
  onClose,
  onAdd,
  onLink,
  onDuplicate,
  onDelete,
  onReorder,
  onReverse,
}: Props) {
  const items = () => {
    switch (state.kind) {
      case 'pane':
        // Sem "Colar": nao ha clipboard implementado, e item morto e pior que
        // item ausente. Volta quando copiar/colar existir.
        return (
          <Menu>
            <Menu.Item label="Adicionar nó aqui" icon="sitemap" onClick={() => onAdd('node')} />
            <Menu.Item label="Adicionar point aqui" icon="circle" onClick={() => onAdd('point')} />
            <Menu.Item label="Adicionar postit aqui" icon="apps" onClick={() => onAdd('postit')} />
            <Menu.Item label="Adicionar texto aqui" icon="text-fields" onClick={() => onAdd('text')} />
            <Menu.Item label="Adicionar imagem aqui" icon="gf-layout-simple" onClick={() => onAdd('image')} />
          </Menu>
        );

      case 'edge':
        return (
          <Menu>
            <Menu.Item label="Inverter direção" icon="exchange-alt" onClick={() => onReverse(state.id)} />
            <Menu.Divider />
            <Menu.Item label="Excluir" icon="trash-alt" destructive onClick={() => onDelete(state.id)} />
          </Menu>
        );

      case 'element':
        return <Menu>{elementItems()}</Menu>;
    }
  };

  const elementItems = () => {
    if (state.kind !== 'element') {
      return null;
    }

    // Nós, points e imagens aceitam conexão; postits e textos nunca.
    const linkable = state.elementKind === 'node' || state.elementKind === 'point' || state.elementKind === 'image';

    // Ordenar só faz diferença no postit, o único que se sobrepõe aos demais
    // por natureza — os outros já vivem numa camada acima dele.
    const orderable = state.elementKind === 'postit';

    return (
      <>
        {linkable && <Menu.Item label="Linkar" icon="link" onClick={() => onLink(state.id)} />}

        {orderable && (
          <>
            <Menu.Item label="Trazer para frente" icon="arrow-up" onClick={() => onReorder(state.id, 'front')} />
            <Menu.Item label="Enviar para trás" icon="arrow-down" onClick={() => onReorder(state.id, 'back')} />
          </>
        )}

        <Menu.Item label="Duplicar" icon="copy" onClick={() => onDuplicate(state.id)} />
        <Menu.Divider />
        <Menu.Item label="Excluir" icon="trash-alt" destructive onClick={() => onDelete(state.id)} />
      </>
    );
  };

  return (
    <ContextMenu
      x={state.x}
      y={state.y}
      onClose={onClose}
      renderHeader={state.kind === 'pane' ? undefined : () => <Menu.Item label={state.label} disabled />}
      renderMenuItems={items}
    />
  );
}
