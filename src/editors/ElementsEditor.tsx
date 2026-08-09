import React, { useEffect, useMemo, useRef, useState } from 'react';
import { css, cx } from '@emotion/css';
import { DataFrame, GrafanaTheme2, IconName, StandardEditorProps } from '@grafana/data';
import { Button, Dropdown, Icon, IconButton, Menu, useStyles2 } from '@grafana/ui';

import { addElement, duplicateElement, removeElements } from '../model/mutations';
import { ElementKind, TopoFlowOptions, Topology } from '../model/types';
import { TopoInstanceState } from '../panel/instanceState';
import { EdgeForm, NodeForm, PointForm, PostitForm, TextForm } from './ElementForms';

/**
 * O "layer": lista plana dos elementos da topologia com o formulario de cada um
 * em acordeao, mais a lista de conexoes abaixo.
 *
 * A selecao e sincronizada com o canvas pelo `instanceState` do `PanelContext`
 * (ver `../panel/instanceState.ts`). O canal e opcional: sem ele o acordeao
 * volta a ser puramente local, que era o comportamento anterior.
 */
export function ElementsEditor({
  value,
  onChange,
  context,
}: StandardEditorProps<Topology, unknown, TopoFlowOptions, TopoInstanceState>) {
  const styles = useStyles2(getStyles);
  const [openId, setOpenId] = useState<string | undefined>();

  const canvas = context.instanceState;
  const selectedOnCanvas = canvas?.selected;

  /**
   * Selecionar no canvas abre o formulario do elemento — e o que torna o clique
   * util, e nao so um realce. Deselecionar (clique no vazio) nao fecha nada:
   * fechar o formulario a cada clique perdido seria hostil.
   *
   * Ajuste durante o render, e nao em efeito: `openId` tem duas fontes (o clique
   * na lista e a selecao no canvas) e por isso continua sendo estado, nao valor
   * derivado. E o padrao que o React documenta para esse caso — em efeito, a
   * lista renderizaria uma vez com a linha errada aberta antes de corrigir.
   */
  const [syncedSelection, setSyncedSelection] = useState(selectedOnCanvas);
  if (selectedOnCanvas && selectedOnCanvas !== syncedSelection) {
    setSyncedSelection(selectedOnCanvas);
    setOpenId(selectedOnCanvas);
  }

  const frames = context.data ?? [];
  const rows = useMemo(() => listElements(value), [value]);
  const edgeRows = useMemo(() => listEdges(value), [value]);

  const handleAdd = (kind: ElementKind) => {
    const next = addElement(value, kind, NEW_ELEMENT_POSITION);
    onChange(next);
    // Abre o formulario do recem-criado: quem adiciona quase sempre quer
    // configurar em seguida.
    setOpenId(newestId(value, next));
  };

  /** Abrir uma linha tambem seleciona no canvas — a outra ponta da sincronia. */
  const handleToggle = (id: string) => {
    const next = id === openId ? undefined : id;
    setOpenId(next);
    if (next) {
      canvas?.select(next);
    }
  };

  return (
    <div className={styles.root}>
      <Dropdown
        overlay={
          <Menu>
            <Menu.Item label="Nó" icon="sitemap" onClick={() => handleAdd('node')} />
            <Menu.Item label="Point" icon="circle" onClick={() => handleAdd('point')} />
            <Menu.Item label="Postit" icon="apps" onClick={() => handleAdd('postit')} />
            <Menu.Item label="Texto" icon="text-fields" onClick={() => handleAdd('text')} />
          </Menu>
        }
      >
        <Button variant="secondary" icon="plus" fullWidth>
          Adicionar elemento
        </Button>
      </Dropdown>

      {rows.length === 0 ? (
        <div className={styles.empty}>Nenhum elemento ainda.</div>
      ) : (
        <div className={styles.list}>
          {rows.map((row) => (
            <Accordion
              key={row.id}
              icon={KIND_ICON[row.kind]}
              label={row.label}
              open={row.id === openId}
              highlight={row.id === selectedOnCanvas}
              onToggle={() => handleToggle(row.id)}
              onDuplicate={() => onChange(duplicateElement(value, row.id))}
              onDelete={() => {
                setOpenId(undefined);
                onChange(removeElements(value, [row.id]));
              }}
            >
              <ElementForm row={row} topology={value} frames={frames} onChange={onChange} />
            </Accordion>
          ))}
        </div>
      )}

      <div className={styles.sectionTitle}>Conexões</div>
      {edgeRows.length === 0 ? (
        <div className={styles.empty}>Arraste de um handle a outro no canvas para conectar.</div>
      ) : (
        <div className={styles.list}>
          {edgeRows.map((row) => (
            <Accordion
              key={row.id}
              icon="link"
              label={row.label}
              open={row.id === openId}
              highlight={row.id === selectedOnCanvas}
              onToggle={() => handleToggle(row.id)}
              onDelete={() => {
                setOpenId(undefined);
                onChange(removeElements(value, [row.id]));
              }}
            >
              <EdgeForm element={row.element} topology={value} frames={frames} onChange={onChange} />
            </Accordion>
          ))}
        </div>
      )}
    </div>
  );
}

interface AccordionProps {
  icon: IconName;
  label: string;
  open: boolean;
  /** Este e o elemento selecionado no canvas. */
  highlight?: boolean;
  onToggle: () => void;
  onDuplicate?: () => void;
  onDelete: () => void;
  children: React.ReactNode;
}

function Accordion({ icon, label, open, highlight, onToggle, onDuplicate, onDelete, children }: AccordionProps) {
  const styles = useStyles2(getStyles);
  const ref = useRef<HTMLDivElement>(null);

  /**
   * Numa topologia de dezenas de elementos a linha correspondente costuma estar
   * fora da area visivel — sem isto, o realce existiria mas ninguem veria.
   * `nearest` rola o minimo necessario, em vez de jogar a linha para o topo.
   */
  useEffect(() => {
    if (highlight) {
      ref.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlight]);

  return (
    <div ref={ref} className={cx(styles.item, highlight && styles.itemHighlight)}>
      <div
        className={styles.header}
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onToggle();
          }
        }}
      >
        <Icon name={open ? 'angle-down' : 'angle-right'} />
        <Icon name={icon} />
        <span className={styles.label}>{label}</span>
        {onDuplicate && (
          <IconButton
            name="copy"
            tooltip="Duplicar"
            onClick={(event) => {
              event.stopPropagation();
              onDuplicate();
            }}
          />
        )}
        <IconButton
          name="trash-alt"
          tooltip="Excluir"
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
        />
      </div>

      {open && <div className={styles.form}>{children}</div>}
    </div>
  );
}

/**
 * O editor de opcoes nao alcanca a viewport do canvas (sao arvores React
 * separadas), entao o elemento nasce numa posicao fixa em vez de no centro do
 * que esta visivel. Quem quer precisao usa o menu de contexto do canvas, que
 * nasce exatamente sob o ponteiro.
 */
const NEW_ELEMENT_POSITION = { x: 100, y: 100 };

/** Id que existe em `next` e nao existia em `before`. */
function newestId(before: Topology, next: Topology): string | undefined {
  const known = new Set(listElements(before).map((row) => row.id));
  return listElements(next).find((row) => !known.has(row.id))?.id;
}

type Row = ReturnType<typeof listElements>[number];

interface ElementFormProps {
  row: Row;
  topology: Topology;
  frames: DataFrame[];
  onChange: (next: Topology) => void;
}

function ElementForm({ row, topology, frames, onChange }: ElementFormProps) {
  const common = { topology, frames, onChange };

  switch (row.kind) {
    case 'node':
      return <NodeForm element={row.element} {...common} />;
    case 'point':
      return <PointForm element={row.element} {...common} />;
    case 'postit':
      return <PostitForm element={row.element} {...common} />;
    case 'text':
      return <TextForm element={row.element} {...common} />;
  }
}

const KIND_ICON: Record<ElementKind, IconName> = {
  node: 'sitemap',
  point: 'circle',
  postit: 'apps',
  text: 'text-fields',
};

/**
 * Lista plana na mesma ordem em que os elementos aparecem na topologia.
 * Arestas saem em `listEdges`: tem secao propria e formulario diferente.
 */
function listElements(topology: Topology) {
  return [
    ...topology.nodes.map((element) => ({
      kind: 'node' as const,
      id: element.id,
      element,
      label: element.presentation.primaryText.fixed || element.id,
    })),
    ...topology.points.map((element, index) => ({
      kind: 'point' as const,
      id: element.id,
      element,
      label: `Point ${index + 1}`,
    })),
    ...topology.postits.map((element) => ({
      kind: 'postit' as const,
      id: element.id,
      element,
      label: element.title || element.id,
    })),
    ...topology.texts.map((element) => ({
      kind: 'text' as const,
      id: element.id,
      element,
      label: element.content.fixed || element.id,
    })),
  ];
}

/** Rotula a conexao pelos rotulos das pontas, nao pelos ids. */
function listEdges(topology: Topology) {
  const labels = new Map(listElements(topology).map((row) => [row.id, row.label]));

  return topology.edges.map((element) => ({
    id: element.id,
    element,
    label: `${labels.get(element.source) ?? element.source} → ${labels.get(element.target) ?? element.target}`,
  }));
}

const getStyles = (theme: GrafanaTheme2) => ({
  root: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  }),
  list: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
  }),
  sectionTitle: css({
    marginTop: theme.spacing(1),
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  }),
  item: css({
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    background: theme.colors.background.secondary,
  }),
  // Mesma cor de selecao do canvas, para que os dois lados leiam como o mesmo
  // estado. Borda, e nao fundo: o fundo do item ja distingue a lista do painel.
  itemHighlight: css({
    borderColor: theme.colors.primary.main,
  }),
  header: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(0.5, 1),
    cursor: 'pointer',
    '&:hover': {
      background: theme.colors.action.hover,
    },
  }),
  label: css({
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
  form: css({
    padding: theme.spacing(1),
    borderTop: `1px solid ${theme.colors.border.weak}`,
  }),
  empty: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
});
