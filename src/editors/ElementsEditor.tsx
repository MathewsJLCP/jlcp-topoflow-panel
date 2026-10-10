import React, { useEffect, useMemo, useRef, useState } from 'react';
import { css } from '@emotion/css';
import { DataFrame, GrafanaTheme2, StandardEditorProps } from '@grafana/data';
import { useStyles2, useTheme2 } from '@grafana/ui';

import { ElementColor, accentColor, resolveElementColor } from '../data/elementColor';
import { defaultTopology } from '../model/defaults';
import { addElement, duplicateElement, removeElements } from '../model/mutations';
import { topologySchema } from '../model/schema';
import {
  ColorDimension,
  ElementKind,
  ElementThresholds,
  MetricBinding,
  TopoEdge,
  TopoFlowOptions,
  Topology,
  TriggerBinding,
} from '../model/types';
import { TopoInstanceState } from '../panel/instanceState';
import { FONT_MONO, FONT_SANS, TfPalette, tfMix, tfPalette } from '../theme/palette';
import { BulkEdgeForm, BulkPointForm } from './BulkForms';
import { EdgeForm, ImageForm, NodeForm, PointForm, PostitForm, TextForm } from './ElementForms';
import { editorSkin } from './ui/skin';
import { ZabbixSourceProvider } from './zabbixSource';

/**
 * A categoria **Layer** do painel de opcoes, no desenho do mockup.
 *
 *   - "+ Adicionar elemento", com o menu de tipos;
 *   - o **cartao** do elemento aberto — cabecalho com o tipo, o id e as acoes, e
 *     o formulario em secoes —, ou os blocos de edicao em massa quando a
 *     selecao no canvas tem mais de uma conexao (ou point);
 *   - a lista **Elementos**, agrupada por tipo, com a cor do estado de cada um.
 *
 * O editor recebe o valor salvo CRU (o Grafana nao passa pelo nosso Zod), entao
 * normaliza com o mesmo schema antes de qualquer coisa — e, se o salvo nao
 * valida, nao deixa editar: qualquer escrita apagaria o original.
 */
export function ElementsEditor(props: StandardEditorProps<Topology, unknown, TopoFlowOptions, TopoInstanceState>) {
  const parsed = useMemo(() => topologySchema.safeParse(props.value ?? defaultTopology), [props.value]);
  const theme = useTheme2();

  if (!parsed.success) {
    return (
      <div className={editorSkin(theme)}>
        <InvalidTopology />
      </div>
    );
  }

  return (
    <ZabbixSourceProvider
      enabled={props.context.options?.zabbix?.enabled === true}
      datasource={props.context.options?.zabbix?.datasource}
      topology={parsed.data}
    >
      <ElementsLayer {...props} value={parsed.data} />
    </ZabbixSourceProvider>
  );
}

function InvalidTopology() {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.invalid}>
      <span className={styles.invalidTitle}>A topologia salva não é válida</span>
      <span className={styles.invalidBody}>
        Corrija-a em Panel JSON. A edição fica desligada para não sobrescrever o que está salvo.
      </span>
    </div>
  );
}

/** O que o mockup chama de glifo de cada tipo, no cartao e na lista. */
const GLYPH: Record<ElementKind | 'edge', string> = {
  node: 'N',
  point: '•',
  postit: '▭',
  text: 'T',
  image: '▣',
  edge: '—',
};

const TYPE_NAME: Record<ElementKind | 'edge', string> = {
  node: 'Nó',
  point: 'Point',
  postit: 'Postit',
  text: 'Texto',
  image: 'Imagem',
  edge: 'Conexão',
};

/** O menu "Adicionar elemento" do mockup. O Point saiu: o trajeto das conexoes o substitui. */
const ADD_KINDS: ElementKind[] = ['node', 'postit', 'text', 'image'];

function ElementsLayer({
  value,
  onChange,
  context,
}: StandardEditorProps<Topology, unknown, TopoFlowOptions, TopoInstanceState>) {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const [openId, setOpenId] = useState<string | undefined>();
  const [menu, setMenu] = useState(false);
  const [listOpen, setListOpen] = useState(true);

  const canvas = context.instanceState;
  const selectedOnCanvas = canvas?.selected ?? EMPTY_SELECTION;
  const selectedSet = useMemo(() => new Set(selectedOnCanvas), [selectedOnCanvas]);
  const onlySelected = selectedOnCanvas.length === 1 ? selectedOnCanvas[0] : undefined;

  // Selecionar no canvas abre o cartao do selecionado. Ajuste durante o render,
  // casado por id (a reconstrucao do editor nao pode perder o cartao aberto).
  const selectionKey = selectedOnCanvas.join('\u0000');
  const [syncedSelection, setSyncedSelection] = useState(selectionKey);
  if (selectedOnCanvas.length > 0 && selectionKey !== syncedSelection) {
    setSyncedSelection(selectionKey);
    setOpenId(onlySelected);
  }

  const frames = context.data ?? [];
  const rows = useMemo(() => listRows(value), [value]);

  const bulkEdges = useMemo(() => value.edges.filter((edge) => selectedSet.has(edge.id)), [value.edges, selectedSet]);
  const bulkPoints = useMemo(
    () => value.points.filter((point) => selectedSet.has(point.id)),
    [value.points, selectedSet]
  );
  const bulkMode = bulkEdges.length > 1 || bulkPoints.length > 1;

  const outside =
    selectedOnCanvas.length -
    (bulkEdges.length > 1 ? bulkEdges.length : 0) -
    (bulkPoints.length > 1 ? bulkPoints.length : 0);
  const multiNote = bulkMode
    ? outside > 0
      ? `${outside} outro${outside > 1 ? 's' : ''} elemento${outside > 1 ? 's' : ''} da seleção fica${outside > 1 ? 'm' : ''} de fora da edição em massa.`
      : ''
    : selectedOnCanvas.length > 1
      ? `${selectedOnCanvas.length} elementos selecionados. Para edição em massa, selecione só conexões.`
      : '';

  const open = !bulkMode && openId ? rows.find((row) => row.id === openId) : undefined;

  const handleAdd = (kind: ElementKind) => {
    setMenu(false);
    const next = addElement(value, kind, NEW_ELEMENT_POSITION);
    onChange(next);
    setOpenId(newestId(value, next));
  };

  const openRow = (id: string) => {
    setOpenId(id);
    canvas?.select(id);
  };

  const remove = (id: string) => {
    if (openId === id) {
      setOpenId(undefined);
    }
    onChange(removeElements(value, [id]));
  };

  return (
    <div className={`${editorSkin(theme)} ${styles.root}`}>
      <div className={styles.addWrap}>
        <button type="button" className={styles.addButton} onClick={() => setMenu((m) => !m)} aria-expanded={menu}>
          <span className={styles.addPlus}>+</span>Adicionar elemento
        </button>
        {menu && (
          <div className={styles.addMenu} role="menu">
            {ADD_KINDS.map((kind) => (
              <button
                key={kind}
                type="button"
                role="menuitem"
                className={styles.addItem}
                onClick={() => handleAdd(kind)}
              >
                <span className={styles.addGlyph}>{GLYPH[kind]}</span>
                {TYPE_NAME[kind]}
              </button>
            ))}
          </div>
        )}
      </div>

      {multiNote && <div className={styles.multiNote}>{multiNote}</div>}

      {/* No topo: e a resposta imediata ao gesto que acabou de acontecer no canvas. */}
      {bulkMode && (
        <BulkSelection selectionKey={selectionKey}>
          {bulkEdges.length > 1 && (
            <BulkEdgeForm edges={bulkEdges} topology={value} frames={frames} onChange={onChange} />
          )}
          {bulkPoints.length > 1 && (
            <BulkPointForm points={bulkPoints} topology={value} frames={frames} onChange={onChange} />
          )}
        </BulkSelection>
      )}

      {open && (
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.cardGlyph}>{GLYPH[open.kind]}</span>
            <div className={styles.cardTitleBox}>
              <span className={styles.cardTitle}>{open.label}</span>
              <span className={styles.cardSub}>
                {TYPE_NAME[open.kind]} <span className={styles.cardId}>{open.id}</span>
              </span>
            </div>
            {open.kind !== 'edge' && (
              <button
                type="button"
                className={styles.headButton}
                title="Duplicar"
                onClick={() => onChange(duplicateElement(value, open.id))}
              >
                Duplicar
              </button>
            )}
            <button type="button" className={styles.headButtonDanger} title="Excluir" onClick={() => remove(open.id)}>
              Excluir
            </button>
            <button
              type="button"
              className={styles.close}
              title="Fechar"
              aria-label="Fechar"
              onClick={() => setOpenId(undefined)}
            >
              ×
            </button>
          </div>
          <div className={styles.cardBody}>
            <ElementForm row={open} topology={value} frames={frames} onChange={onChange} />
          </div>
        </div>
      )}

      <button type="button" className={styles.listToggle} onClick={() => setListOpen((o) => !o)}>
        <span>{listOpen ? '▾' : '▸'}</span>Elementos
      </button>

      {listOpen && (
        <div className={styles.groups}>
          {rows.filter((row) => row.kind !== 'edge').length === 0 && (
            <div className={styles.empty}>Nenhum elemento ainda.</div>
          )}
          {GROUPS.map(({ kind, label }) => {
            const items = rows.filter((row) => row.kind === kind);
            if (!items.length && kind !== 'edge') {
              return null;
            }
            return (
              <div key={kind} className={styles.group}>
                <div className={styles.groupHead}>
                  <span className={styles.groupName}>{label}</span>
                  <span className={styles.groupCount}>{items.length}</span>
                </div>
                {!items.length && (
                  <div className={styles.groupEmpty}>Arraste de um handle a outro no canvas para conectar.</div>
                )}
                {items.map((row) => (
                  <ListRow
                    key={row.id}
                    row={row}
                    frames={frames}
                    highlight={selectedSet.has(row.id)}
                    reveal={!bulkMode}
                    onOpen={() => openRow(row.id)}
                    onDuplicate={row.kind === 'edge' ? undefined : () => onChange(duplicateElement(value, row.id))}
                    onDelete={() => remove(row.id)}
                  />
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const GROUPS: Array<{ kind: Row['kind']; label: string }> = [
  { kind: 'node', label: 'Nós' },
  { kind: 'point', label: 'Points' },
  { kind: 'postit', label: 'Postits' },
  { kind: 'text', label: 'Textos' },
  { kind: 'image', label: 'Imagens' },
  { kind: 'edge', label: 'Conexões' },
];

function BulkSelection({ selectionKey, children }: { selectionKey: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView({ block: 'nearest' });
  }, [selectionKey]);
  return <div ref={ref}>{children}</div>;
}

interface ListRowProps {
  row: Row;
  frames: DataFrame[];
  highlight: boolean;
  reveal: boolean;
  onOpen: () => void;
  onDuplicate?: () => void;
  onDelete: () => void;
}

/** Uma linha da lista: glifo, nome, a cor do estado, duplicar e excluir. */
function ListRow({ row, frames, highlight, reveal, onOpen, onDuplicate, onDelete }: ListRowProps) {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const p = tfPalette(theme);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (highlight && reveal) {
      ref.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlight, reveal]);

  const accent = rowAccent(row, frames, theme);
  const dot = accent ? accentColor(accent) : undefined;
  const dotBorder =
    accent?.state === 'nodata'
      ? `1px dashed ${p.apa}`
      : accent?.state === 'neutral'
        ? `1px solid ${p.linha}`
        : '1px solid transparent';

  return (
    <div
      ref={ref}
      className={styles.row}
      data-selected={highlight || undefined}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen();
        }
      }}
    >
      <span className={styles.rowGlyph}>{GLYPH[row.kind]}</span>
      <span className={styles.rowName}>{row.label}</span>
      {accent && <span className={styles.rowDot} style={{ background: dot ?? 'transparent', border: dotBorder }} />}
      {onDuplicate && (
        <button
          type="button"
          className={styles.rowAction}
          title="Duplicar"
          aria-label="Duplicar"
          onClick={(event) => {
            event.stopPropagation();
            onDuplicate();
          }}
        >
          ⧉
        </button>
      )}
      <button
        type="button"
        className={styles.rowActionX}
        title="Excluir"
        aria-label="Excluir"
        onClick={(event) => {
          event.stopPropagation();
          onDelete();
        }}
      >
        ×
      </button>
    </div>
  );
}

function rowAccent(row: Row, frames: DataFrame[], theme: GrafanaTheme2): ElementColor | undefined {
  if (row.kind === 'postit' || row.kind === 'text') {
    return undefined;
  }
  const el = row.element as {
    color: ColorDimension;
    trigger?: TriggerBinding;
    thresholds?: ElementThresholds;
    extraMetrics?: MetricBinding[];
  };
  return resolveElementColor(el.color, frames, theme, {
    trigger: el.trigger,
    thresholds: el.thresholds,
    extraMetrics: el.extraMetrics,
  });
}

const NEW_ELEMENT_POSITION = { x: 100, y: 100 };
const EMPTY_SELECTION: string[] = [];

function newestId(before: Topology, next: Topology): string | undefined {
  const known = new Set(listRows(before).map((row) => row.id));
  return listRows(next).find((row) => !known.has(row.id))?.id;
}

type Row = ReturnType<typeof listRows>[number];

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
    case 'image':
      return <ImageForm element={row.element} {...common} />;
    case 'edge':
      return <EdgeForm element={row.element} {...common} />;
  }
}

/** Nome de cada elemento na lista e no cartao, como no mockup (`rowName`). */
function listRows(topology: Topology) {
  const elements = [
    ...topology.nodes.map((element) => ({
      kind: 'node' as const,
      id: element.id,
      element,
      label:
        (element.presentation.primaryText.mode === 'fixed' && element.presentation.primaryText.fixed) || element.id,
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
      label: (element.content.mode === 'fixed' && element.content.fixed) || element.id,
    })),
    ...topology.images.map((element) => ({
      kind: 'image' as const,
      id: element.id,
      element,
      label: element.text || element.id,
    })),
  ];
  const names = new Map(elements.map((row) => [row.id, row.label]));
  const edges = topology.edges.map((element: TopoEdge) => ({
    kind: 'edge' as const,
    id: element.id,
    element,
    label: `${names.get(element.source) ?? '?'} → ${names.get(element.target) ?? '?'}`,
  }));
  return [...elements, ...edges];
}

const getStyles = (theme: GrafanaTheme2) => {
  const p: TfPalette = tfPalette(theme);
  const small = {
    border: `1px solid ${p.borda}`,
    background: p.sup,
    borderRadius: 6,
    padding: '4px 7px',
    font: `12px ${FONT_SANS}`,
    cursor: 'pointer',
  };
  return {
    root: css({ display: 'flex', flexDirection: 'column', gap: 12 }),
    invalid: css({
      padding: '10px 12px',
      border: `1px solid ${tfMix(p.cr, 60)}`,
      background: tfMix(p.cr, 9),
      borderRadius: 8,
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
    }),
    invalidTitle: css({ font: `600 12.5px ${FONT_SANS}`, color: p['cr-t'] }),
    invalidBody: css({ font: `12px/1.45 ${FONT_SANS}`, color: p.tx }),
    addWrap: css({ position: 'relative' }),
    addButton: css({
      width: '100%',
      border: `1px solid ${p.ac}`,
      background: tfMix(p.ac, 14),
      color: p.tf,
      borderRadius: 7,
      padding: '8px 10px',
      font: `600 13px ${FONT_SANS}`,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    }),
    addPlus: css({ fontSize: 15, color: p['ac-t'] }),
    addMenu: css({
      position: 'absolute',
      left: 0,
      right: 0,
      top: 'calc(100% + 4px)',
      background: p.sup,
      border: `1px solid ${p.borda}`,
      borderRadius: 8,
      boxShadow: `0 10px 28px ${p.shadow}`,
      padding: 4,
      zIndex: 10,
    }),
    addItem: css({
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      width: '100%',
      border: 0,
      background: 'transparent',
      padding: '7px 9px',
      borderRadius: 6,
      font: `13px ${FONT_SANS}`,
      color: p.tx,
      cursor: 'pointer',
      textAlign: 'left',
      '&:hover': { background: p.elev },
    }),
    addGlyph: css({
      width: 20,
      height: 20,
      border: `1px solid ${p.borda}`,
      borderRadius: 5,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      font: `600 11px ${FONT_MONO}`,
      color: p.tx2,
    }),
    multiNote: css({ font: `12px/1.45 ${FONT_SANS}`, color: p.tx2 }),
    card: css({ border: `1px solid ${p.ac}`, borderRadius: 10, background: p.fundo, overflow: 'hidden' }),
    cardHead: css({
      display: 'flex',
      alignItems: 'center',
      gap: 9,
      padding: '9px 10px',
      background: tfMix(p.ac, 10, p.sup),
      borderBottom: `1px solid ${p.borda}`,
    }),
    cardGlyph: css({
      flex: 'none',
      width: 24,
      height: 24,
      borderRadius: 6,
      background: p.ac,
      color: p['on-ac'],
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      font: `600 12px ${FONT_MONO}`,
    }),
    cardTitleBox: css({ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }),
    cardTitle: css({
      font: `600 13px ${FONT_SANS}`,
      color: p.tf,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    }),
    cardSub: css({ font: `11px ${FONT_SANS}`, color: p.tx2 }),
    cardId: css({ fontFamily: FONT_MONO, color: p.apa }),
    headButton: css({ ...small, color: p.tx2 }),
    headButtonDanger: css({ ...small, color: p['cr-t'] }),
    close: css({
      border: 0,
      background: 'transparent',
      color: p.tx2,
      font: `16px ${FONT_SANS}`,
      cursor: 'pointer',
      padding: '0 2px',
    }),
    cardBody: css({ display: 'flex', flexDirection: 'column', gap: 12, padding: 12 }),
    listToggle: css({
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      border: 0,
      background: 'transparent',
      padding: '4px 0 0',
      cursor: 'pointer',
      font: `600 10px ${FONT_MONO}`,
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      color: p.rot,
    }),
    groups: css({ display: 'flex', flexDirection: 'column', gap: 10 }),
    empty: css({ font: `12.5px ${FONT_SANS}`, color: p.apa }),
    group: css({ display: 'flex', flexDirection: 'column', gap: 1 }),
    groupHead: css({ display: 'flex', alignItems: 'center', gap: 6, padding: '0 4px 4px' }),
    groupName: css({ font: `600 11.5px ${FONT_SANS}`, color: p.tx2 }),
    groupCount: css({ font: `11px ${FONT_MONO}`, color: p.apa }),
    groupEmpty: css({ font: `12px ${FONT_SANS}`, color: p.apa, padding: '2px 4px' }),
    row: css({
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '5px 6px',
      borderRadius: 6,
      cursor: 'pointer',
      '&:hover': { background: p.elev },
      '&[data-selected]': { background: tfMix(p.ac, 16) },
    }),
    rowGlyph: css({
      flex: 'none',
      width: 18,
      height: 18,
      border: `1px solid ${p.borda}`,
      borderRadius: 4,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      font: `600 10px ${FONT_MONO}`,
      color: p.tx2,
    }),
    rowName: css({
      flex: 1,
      minWidth: 0,
      font: `12.5px ${FONT_SANS}`,
      color: p.tx,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      '[data-selected] > &': { color: p.tf },
    }),
    rowDot: css({ flex: 'none', width: 8, height: 8, borderRadius: 2 }),
    rowAction: css({
      border: 0,
      background: 'transparent',
      color: p.apa,
      font: `12px ${FONT_SANS}`,
      cursor: 'pointer',
      padding: '0 2px',
    }),
    rowActionX: css({
      border: 0,
      background: 'transparent',
      color: p.apa,
      font: `14px ${FONT_SANS}`,
      cursor: 'pointer',
      padding: '0 2px',
    }),
  };
};
