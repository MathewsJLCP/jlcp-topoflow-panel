import React, { useEffect, useMemo, useRef, useState } from 'react';
import { css, cx } from '@emotion/css';
import { DataFrame, GrafanaTheme2, IconName, StandardEditorProps } from '@grafana/data';
import { Button, Dropdown, Icon, IconButton, Menu, useStyles2 } from '@grafana/ui';

import { defaultTopology } from '../model/defaults';
import { addElement, duplicateElement, removeElements } from '../model/mutations';
import { topologySchema } from '../model/schema';
import { ElementKind, TopoFlowOptions, Topology } from '../model/types';
import { TopoInstanceState } from '../panel/instanceState';
import { BulkEdgeForm, BulkPointForm } from './BulkForms';
import { EdgeForm, ImageForm, NodeForm, PointForm, PostitForm, TextForm } from './ElementForms';
import { ZabbixSourceProvider } from './zabbixSource';

/**
 * O "layer": lista plana dos elementos da topologia com o formulario de cada um
 * em acordeao, mais a lista de conexoes abaixo.
 *
 * A selecao e sincronizada com o canvas pelo `instanceState` do `PanelContext`
 * (ver `../panel/instanceState.ts`). O canal e opcional: sem ele o acordeao
 * volta a ser puramente local, que era o comportamento anterior.
 */
export function ElementsEditor(props: StandardEditorProps<Topology, unknown, TopoFlowOptions, TopoInstanceState>) {
  /**
   * O editor recebe `panel.options.topology` **cru** — o Grafana entrega o que
   * esta salvo, sem passar pelo Zod que o painel usa do outro lado. Duas coisas
   * dependiam disso e nenhuma estava garantida:
   *
   *   - uma topologia salva antes de `points`, `postits`, `texts` ou `images`
   *     existirem (o schema aceita isso de proposito, via `.default([])`)
   *     derrubava a aba inteira de opcoes com "Cannot read properties of
   *     undefined (reading 'map')" — a lista percorre as seis colecoes;
   *   - o que o formulario escrevia podia diferir do que o canvas desenhava, que
   *     e a origem da sensacao de configuracao que "volta ao default".
   *
   * Normalizar aqui faz o editor e o canvas lerem exatamente o mesmo objeto.
   */
  const parsed = useMemo(() => topologySchema.safeParse(props.value ?? defaultTopology), [props.value]);

  if (!parsed.success) {
    return <InvalidTopology />;
  }

  /*
    O provider fica aqui, e nao dentro de cada formulario, porque este e o unico
    componente do editor que ve `context.options` — os formularios recebem so o
    elemento e os frames.
  */
  return (
    <ZabbixSourceProvider datasource={props.context.options?.zabbix?.datasource}>
      <ElementsLayer {...props} value={parsed.data} />
    </ZabbixSourceProvider>
  );
}

function InvalidTopology() {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.empty}>
      A topologia salva neste painel não é válida e o canvas está mostrando o exemplo padrão. Corrija-a em{' '}
      <strong>Panel JSON</strong> — a edição fica desligada para não sobrescrever o que está salvo.
    </div>
  );
}

function ElementsLayer({
  value,
  onChange,
  context,
}: StandardEditorProps<Topology, unknown, TopoFlowOptions, TopoInstanceState>) {
  const styles = useStyles2(getStyles);
  const [openId, setOpenId] = useState<string | undefined>();

  const canvas = context.instanceState;
  const selectedOnCanvas = canvas?.selected ?? EMPTY_SELECTION;
  const selectedSet = useMemo(() => new Set(selectedOnCanvas), [selectedOnCanvas]);
  /** Um so selecionado: e o caso em que abrir o formulario dele faz sentido. */
  const onlySelected = selectedOnCanvas.length === 1 ? selectedOnCanvas[0] : undefined;

  /**
   * Selecionar no canvas abre o formulario do elemento — e o que torna o clique
   * util, e nao so um realce. Deselecionar (clique no vazio) nao fecha nada:
   * fechar o formulario a cada clique perdido seria hostil.
   *
   * **Selecionar varios fecha.** Com dois ou mais, quem manda na tela e o bloco
   * de edicao em massa, e o acordeao individual precisa sair do caminho.
   *
   * Era o defeito da primeira versao da edicao em massa, e ele nao se anunciava:
   * o clique inicial numa conexao abria o formulario **dela**; o Ctrl+clique
   * seguinte fazia o bloco em massa nascer no topo, fora da vista de quem estava
   * olhando para o formulario ja aberto. O usuario editava o que via, e so a
   * primeira conexao mudava — dois formularios na mesma tela, e o errado embaixo
   * do ponteiro.
   *
   * A sincronia reage a **selecao inteira**, e nao so ao id unico: sem isso,
   * passar de `[a]` para `[a, b]` nao mexeria em `openId`, que e exatamente o
   * caso a corrigir.
   *
   * Ajuste durante o render, e nao em efeito: `openId` tem duas fontes (o clique
   * na lista e a selecao no canvas) e por isso continua sendo estado, nao valor
   * derivado. E o padrao que o React documenta para esse caso — em efeito, a
   * lista renderizaria uma vez com a linha errada aberta antes de corrigir.
   */
  const selectionKey = selectedOnCanvas.join('\u0000');
  const [syncedSelection, setSyncedSelection] = useState(selectionKey);
  if (selectedOnCanvas.length > 0 && selectionKey !== syncedSelection) {
    setSyncedSelection(selectionKey);
    // `undefined` quando ha varios: nao ha "o formulario do elemento" a abrir.
    setOpenId(onlySelected);
  }

  const frames = context.data ?? [];
  const rows = useMemo(() => listElements(value), [value]);
  const edgeRows = useMemo(() => listEdges(value), [value]);

  /**
   * O que da selecao tem edicao em massa, por tipo e na ordem da topologia.
   *
   * Conexoes e points, que sao os dois lados do caminho que motivou a feature —
   * os segmentos e as ancoras entre eles. Cada bloco anuncia **quantos** edita,
   * entao um no que tenha entrado na selecao nao confunde: ele fica de fora da
   * escrita e o rotulo diz o que esta sendo editado. Silenciar tudo por causa
   * dele seria pior — o usuario nao teria como saber por que.
   */
  const bulkEdges = useMemo(() => value.edges.filter((edge) => selectedSet.has(edge.id)), [value.edges, selectedSet]);
  const bulkPoints = useMemo(
    () => value.points.filter((point) => selectedSet.has(point.id)),
    [value.points, selectedSet]
  );

  /** Ha bloco de edicao em massa na tela — e e ele que manda na rolagem. */
  const bulkMode = bulkEdges.length > 1 || bulkPoints.length > 1;

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
      {/* No topo, acima do botao de adicionar: e a resposta imediata a um gesto
          que acabou de acontecer no canvas, e enterra-la no fim da lista faria o
          usuario selecionar tres conexoes e concluir que nada aconteceu. */}
      {bulkMode && (
        <BulkSelection selectionKey={selectionKey}>
          {/* Selecionando conexoes e points juntos aparecem os dois blocos, cada
              um dizendo quantos edita. E o caso do caminho por points, em que o
              enlace **e** os segmentos mais as ancoras. */}
          {bulkEdges.length > 1 && (
            <BulkEdgeForm edges={bulkEdges} topology={value} frames={frames} onChange={onChange} />
          )}
          {bulkPoints.length > 1 && (
            <BulkPointForm points={bulkPoints} topology={value} frames={frames} onChange={onChange} />
          )}
        </BulkSelection>
      )}

      <Dropdown
        overlay={
          <Menu>
            <Menu.Item label="Nó" icon="sitemap" onClick={() => handleAdd('node')} />
            <Menu.Item label="Point" icon="circle" onClick={() => handleAdd('point')} />
            <Menu.Item label="Postit" icon="apps" onClick={() => handleAdd('postit')} />
            <Menu.Item label="Texto" icon="text-fields" onClick={() => handleAdd('text')} />
            <Menu.Item label="Imagem" icon="gf-layout-simple" onClick={() => handleAdd('image')} />
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
              highlight={selectedSet.has(row.id)}
              reveal={!bulkMode}
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
              highlight={selectedSet.has(row.id)}
              reveal={!bulkMode}
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

/**
 * Traz o bloco de edicao em massa para a area visivel quando ele nasce.
 *
 * O Layer de uma topologia grande e uma lista longa, e o bloco nasce no **topo**
 * dela. Quem rolou ate a secao de Conexoes para clicar nelas nao veria o bloco
 * aparecer — e foi assim que a primeira versao desta feature falhou: o usuario
 * continuava editando o formulario que tinha diante dos olhos.
 *
 * Mesma tecnica que o `Accordion` ja usa para a linha realcada, e pelo mesmo
 * motivo: `nearest` rola o minimo necessario, em vez de saltar a lista.
 */
function BulkSelection({ selectionKey, children }: { selectionKey: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  /**
   * Depende da selecao, e nao so da montagem: ir somando conexoes com Ctrl nao
   * remonta o bloco, e so no nascimento ele voltaria a vista uma vez e nunca
   * mais. `nearest` nao faz nada quando ele ja esta visivel, entao acrescentar a
   * quinta conexao nao sacode a tela.
   */
  useEffect(() => {
    ref.current?.scrollIntoView({ block: 'nearest' });
  }, [selectionKey]);

  return <div ref={ref}>{children}</div>;
}

interface AccordionProps {
  icon: IconName;
  label: string;
  open: boolean;
  /** Este e o elemento selecionado no canvas. */
  highlight?: boolean;
  /** Realcar tambem rola a linha para a vista. Ver o efeito no corpo. */
  reveal?: boolean;
  onToggle: () => void;
  onDuplicate?: () => void;
  onDelete: () => void;
  children: React.ReactNode;
}

function Accordion({
  icon,
  label,
  open,
  highlight,
  reveal = true,
  onToggle,
  onDuplicate,
  onDelete,
  children,
}: AccordionProps) {
  const styles = useStyles2(getStyles);
  const ref = useRef<HTMLDivElement>(null);

  /**
   * Numa topologia de dezenas de elementos a linha correspondente costuma estar
   * fora da area visivel — sem isto, o realce existiria mas ninguem veria.
   * `nearest` rola o minimo necessario, em vez de jogar a linha para o topo.
   *
   * `reveal` desliga isso durante a edicao em massa, e foi um defeito relatado:
   * as duas rolagens disputavam. O bloco em massa subia a tela, e logo depois a
   * linha recem-realcada a trazia de volta para baixo — os efeitos das linhas
   * rodam depois do dele, entao a lista sempre vencia e o usuario terminava
   * olhando para o lugar errado. Com varios selecionados quem tem de estar na
   * vista e o bloco; o realce das linhas continua, so nao arrasta a tela.
   */
  useEffect(() => {
    if (highlight && reveal) {
      ref.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlight, reveal]);

  return (
    /* `data-selected` e gancho estavel para o seletor, como nos nos do canvas: o
       nome que o Emotion gera muda entre builds, e a classe de realce nao serve
       para afirmar nada num teste. */
    <div
      ref={ref}
      className={cx(styles.item, highlight && styles.itemHighlight)}
      data-selected={highlight || undefined}
    >
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

/** Referencia estavel para o canal ausente: sem ela, todo render recalcularia. */
const EMPTY_SELECTION: string[] = [];

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
    case 'image':
      return <ImageForm element={row.element} {...common} />;
  }
}

const KIND_ICON: Record<ElementKind, IconName> = {
  node: 'sitemap',
  point: 'circle',
  postit: 'apps',
  text: 'text-fields',
  image: 'gf-layout-simple',
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
    // O template cru, e nao o texto resolvido: a lista nao tem os frames, e um
    // rotulo que muda a cada refresh atrapalharia mais do que ajuda.
    ...topology.images.map((element) => ({
      kind: 'image' as const,
      id: element.id,
      element,
      label: element.text || element.id,
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
