import React, { useMemo, useState } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { Field, Icon, Input, Modal, useStyles2 } from '@grafana/ui';

import {
  DEFAULT_ICON_REF,
  ICON_PACKS,
  IconTone,
  ResolvedIcon,
  TopoIcon,
  isKnownIcon,
  listIcons,
  resolveIcon,
} from '../icons';
import { IconToneChoice } from '../canvas/iconTone';

/**
 * Escolha do icone, com as pastas da biblioteca.
 *
 * Substituiu um `Select` de dez linhas. Ele servia enquanto a biblioteca cabia
 * numa lista: com pastas, busca e a perspectiva de packs de cem icones, um
 * dropdown de texto obriga a abrir e fechar dez vezes para comparar dois
 * desenhos — e escolher icone e uma decisao **visual**.
 *
 * O campo no formulario mostra o icone atual e abre o navegador; a comparacao
 * acontece na grade, com espaco, e nao no painel de opcoes, que tem 300px.
 */

interface IconPickerProps {
  value: string | undefined;
  onChange: (ref: string) => void;
  /** Ausente significa `state` — ver `presentation.iconTone` no schema. */
  tone?: IconToneChoice;
  onToneChange?: (tone: IconToneChoice | undefined) => void;
  /** O campo nao se chama "Ícone" em todo elemento — na Imagem, o icone e a figura. */
  label?: string;
}

export function IconPicker({ value, onChange, tone, onToneChange, label = 'Ícone' }: IconPickerProps) {
  const styles = useStyles2(getStyles);
  const [aberto, setAberto] = useState(false);
  const inputId = React.useId();

  // Chave desconhecida cai no generico na tela, como sempre caiu no canvas — o
  // campo nao pode aparecer vazio por causa de um icone que deixou de existir.
  const atual = resolveIcon(isKnownIcon(value) ? value : DEFAULT_ICON_REF);

  return (
    <Field label={label} htmlFor={inputId}>
      <>
        {/* `<button>` e um elemento rotulavel, entao o `label` do `Field` o
            alcanca com `htmlFor` — sem isso o campo ficaria sem rotulo
            acessivel, como aconteceu com o `Switch` do vinculo de trigger. */}
        <button id={inputId} type="button" className={styles.trigger} onClick={() => setAberto(true)}>
          <TopoIcon icon={atual} size={18} />
          <span className={styles.triggerLabel}>{atual.label}</span>
          <Icon name="angle-down" />
        </button>

        {aberto && (
          <IconBrowser
            // Vazio quando nada foi escolhido: o campo mostra o generico porque
            // e o que o canvas desenha, mas a grade nao pode marcar como
            // escolhido um icone que o usuario nunca escolheu.
            selected={isKnownIcon(value) ? atual.ref : ''}
            onSelect={(ref) => {
              onChange(ref);
              setAberto(false);
            }}
            onDismiss={() => setAberto(false)}
          />
        )}

        {/* So aparece para icone que tem variantes: nos demais nao ha o que
            escolher, e um campo desabilitado so ocuparia o formulario. */}
        {onToneChange && atual.art.kind === 'variants' && (
          <IconToneField icon={atual} value={tone} onChange={onToneChange} />
        )}
      </>
    </Field>
  );
}

interface IconToneFieldProps {
  icon: ResolvedIcon;
  value: IconToneChoice | undefined;
  onChange: (tone: IconToneChoice | undefined) => void;
}

/**
 * Cor do icone, entre as que **aquele icone** tem.
 *
 * As opcoes sao as proprias miniaturas, e nao uma lista de nomes de cor: e a
 * mesma razao pela qual o seletor de icone virou grade — a escolha e visual, e
 * "Amarelo" escrito nao mostra o amarelo do desenho.
 *
 * `Pelo estado` vem primeiro e e o padrao. Ele e o que da sentido a um pack de
 * figuras coloridas: fixar a cor transforma o icone em decoracao, e um roteador
 * vermelho continua vermelho com a rede inteira em ordem.
 */
function IconToneField({ icon, value, onChange }: IconToneFieldProps) {
  const styles = useStyles2(getStyles);
  const disponiveis = icon.art.kind === 'variants' ? (Object.keys(icon.art.tones) as IconTone[]) : [];
  const atual = value ?? 'state';

  return (
    <div className={styles.toneField}>
      <span className={styles.toneLabel}>Cor do ícone</span>
      <div className={styles.tones} role="radiogroup" aria-label="Cor do ícone">
        <button
          type="button"
          className={styles.toneAuto}
          role="radio"
          aria-checked={atual === 'state'}
          data-selected={atual === 'state' || undefined}
          // `undefined`, e nao `'state'`: ausente ja significa automatico, e
          // gravar o valor explicito so encheria o JSON do dashboard.
          onClick={() => onChange(undefined)}
        >
          Pelo estado
        </button>

        {TONE_ORDER.filter((tom) => disponiveis.includes(tom)).map((tom) => (
          <button
            type="button"
            key={tom}
            className={styles.tone}
            role="radio"
            aria-checked={atual === tom}
            aria-label={TONE_LABEL[tom]}
            title={TONE_LABEL[tom]}
            data-selected={atual === tom || undefined}
            onClick={() => onChange(tom)}
          >
            <TopoIcon icon={icon} tone={tom} size={20} />
          </button>
        ))}
      </div>
    </div>
  );
}

/** Do repouso ao alarme — a mesma leitura de gravidade da escada de severidades. */
const TONE_ORDER: IconTone[] = ['gray', 'green', 'blue', 'yellow', 'orange', 'red'];

const TONE_LABEL: Record<IconTone, string> = {
  gray: 'Cinza',
  green: 'Verde',
  blue: 'Azul',
  yellow: 'Amarelo',
  orange: 'Laranja',
  red: 'Vermelho',
};

/** Pasta virtual: tudo, de todos os packs. */
const TODOS = '*';

interface IconBrowserProps {
  selected: string;
  onSelect: (ref: string) => void;
  onDismiss: () => void;
}

/**
 * O navegador: pastas a esquerda, busca no topo, grade a direita.
 *
 * A escolha e **imediata** — clicar seleciona e fecha, sem rodape de
 * confirmacao. O icone escolhido aparece no formulario e no canvas na mesma
 * hora, entao um "Confirmar" so adicionaria um clique para dizer o que a tela
 * ja mostra; e o desfazer do dashboard cobre o arrependimento.
 */
export function IconBrowser({ selected, onSelect, onDismiss }: IconBrowserProps) {
  const styles = useStyles2(getStyles);
  // Sem escolha previa, abre no primeiro pack — o Padrao, que e o que o produto
  // recomenda. Cair nos Classicos por serem o pack do fallback seria acidente.
  const [pasta, setPasta] = useState(() => (isKnownIcon(selected) ? resolveIcon(selected).pack : ICON_PACKS[0].id));
  const [busca, setBusca] = useState('');

  const todos = useMemo(() => listIcons(), []);
  const daPasta = useMemo(() => todos.filter((icon) => pasta === TODOS || icon.pack === pasta), [todos, pasta]);
  const visiveis = useMemo(() => filtrar(daPasta, busca), [daPasta, busca]);

  /**
   * Quantos a busca encontraria fora da pasta aberta.
   *
   * Sem isto, procurar "wifi" dentro de uma pasta que nao o tem devolve "nada
   * encontrado" — e o icone existe, uma pasta ao lado. A saida fica na propria
   * tela de vazio, em vez de obrigar o usuario a repetir a busca pasta por pasta.
   */
  const foraDaPasta = useMemo(
    () => (busca && visiveis.length === 0 ? filtrar(todos, busca).length : 0),
    [busca, visiveis.length, todos]
  );

  return (
    <Modal title="Escolher ícone" isOpen onDismiss={onDismiss} className={styles.modal}>
      <Input
        autoFocus
        value={busca}
        placeholder="Buscar por nome — servidor, switch, wifi…"
        prefix={<Icon name="search" />}
        onChange={(event) => setBusca(event.currentTarget.value)}
      />

      <div className={styles.body}>
        {/*
          A coluna de pastas aparece mesmo com um pack so. Ela e a estrutura da
          biblioteca, e nao um menu que so vale a pena quando ha muitos itens:
          escondida ate o segundo pack chegar, o usuario descobriria a
          organizacao da tela justamente quando ela ficasse mais complexa.
        */}
        <nav className={styles.folders} aria-label="Pastas de ícones">
          <FolderButton
            label="Todos os ícones"
            count={todos.length}
            active={pasta === TODOS}
            onClick={() => setPasta(TODOS)}
          />
          {ICON_PACKS.map((pack) => (
            <FolderButton
              key={pack.id}
              label={pack.label}
              count={pack.icons.length}
              active={pasta === pack.id}
              onClick={() => setPasta(pack.id)}
            />
          ))}
        </nav>

        <div className={styles.gridWrapper}>
          {visiveis.length > 0 ? (
            <div className={styles.grid} role="listbox" aria-label="Ícones">
              {visiveis.map((icon) => (
                <button
                  type="button"
                  key={icon.ref}
                  className={styles.cell}
                  role="option"
                  aria-selected={icon.ref === selected}
                  data-selected={icon.ref === selected || undefined}
                  title={icon.label}
                  onClick={() => onSelect(icon.ref)}
                >
                  <TopoIcon icon={icon} size={28} />
                  <span className={styles.cellLabel}>{icon.label}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className={styles.empty}>
              <p>Nenhum ícone para “{busca}” nesta pasta.</p>
              {foraDaPasta > 0 && (
                <button type="button" className={styles.link} onClick={() => setPasta(TODOS)}>
                  {foraDaPasta === 1 ? 'Há 1 em outra pasta' : `Há ${foraDaPasta} em outras pastas`}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

interface FolderButtonProps {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}

function FolderButton({ label, count, active, onClick }: FolderButtonProps) {
  const styles = useStyles2(getStyles);

  return (
    <button type="button" className={styles.folder} data-active={active || undefined} onClick={onClick}>
      <span className={styles.folderLabel}>{label}</span>
      <span className={styles.folderCount}>{count}</span>
    </button>
  );
}

/**
 * Busca por rotulo, chave e sinonimos, sem acento e sem caixa.
 *
 * Os acentos saem dos dois lados: quem procura "generico" tem de achar
 * "Genérico", e quem procura "Genérico" tambem. Sem isso, metade das buscas do
 * usuario brasileiro falha em silencio.
 */
export function filtrar(icons: ResolvedIcon[], busca: string): ResolvedIcon[] {
  const termo = normalizar(busca);
  if (!termo) {
    return icons;
  }

  return icons.filter((icon) =>
    [icon.label, icon.name, ...(icon.keywords ?? [])].some((campo) => normalizar(campo).includes(termo))
  );
}

function normalizar(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

const getStyles = (theme: GrafanaTheme2) => ({
  trigger: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    width: '100%',
    minHeight: 32,
    padding: theme.spacing(0, 1),
    background: theme.components.input.background,
    border: `1px solid ${theme.components.input.borderColor}`,
    borderRadius: theme.shape.radius.default,
    color: theme.colors.text.primary,
    fontSize: theme.typography.body.fontSize,
    textAlign: 'left',
    cursor: 'pointer',

    '&:hover': { borderColor: theme.components.input.borderHover },
    '&:focus-visible': { outline: `2px solid ${theme.colors.primary.main}`, outlineOffset: 1 },
  }),
  triggerLabel: css({
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
  toneField: css({
    marginTop: theme.spacing(1),
  }),
  toneLabel: css({
    display: 'block',
    marginBottom: theme.spacing(0.5),
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
  tones: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    flexWrap: 'wrap',
  }),
  tone: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    padding: 0,
    background: theme.colors.background.secondary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    cursor: 'pointer',

    '&:hover': { borderColor: theme.colors.border.medium },
    '&[data-selected]': { borderColor: theme.colors.primary.border, background: theme.colors.action.selected },
  }),
  toneAuto: css({
    height: 32,
    padding: theme.spacing(0, 1),
    background: theme.colors.background.secondary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    cursor: 'pointer',

    '&:hover': { borderColor: theme.colors.border.medium, color: theme.colors.text.primary },
    '&[data-selected]': {
      borderColor: theme.colors.primary.border,
      background: theme.colors.action.selected,
      color: theme.colors.text.primary,
    },
  }),
  /** Largura fixa: a grade nao pode reflowar a cada letra digitada na busca. */
  modal: css({
    width: '100%',
    maxWidth: 760,
  }),
  body: css({
    display: 'flex',
    gap: theme.spacing(2),
    marginTop: theme.spacing(2),
    // Teto de altura: a lista rola, o modal nao cresce ate sair da tela.
    height: 380,
  }),
  folders: css({
    flex: '0 0 180px',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    overflowY: 'auto',
    borderRight: `1px solid ${theme.colors.border.weak}`,
    paddingRight: theme.spacing(1),
  }),
  folder: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(0.75, 1),
    background: 'transparent',
    border: 'none',
    borderRadius: theme.shape.radius.default,
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    textAlign: 'left',
    cursor: 'pointer',

    '&:hover': { background: theme.colors.action.hover, color: theme.colors.text.primary },
    '&[data-active]': {
      background: theme.colors.action.selected,
      color: theme.colors.text.primary,
      fontWeight: theme.typography.fontWeightMedium,
    },
  }),
  folderLabel: css({
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
  folderCount: css({
    color: theme.colors.text.disabled,
    fontVariantNumeric: 'tabular-nums',
  }),
  gridWrapper: css({
    flex: 1,
    overflowY: 'auto',
  }),
  /**
   * `auto-fill` com piso de 96px: a grade se ajusta a largura do modal sem
   * numero magico de colunas, e uma pasta de cem icones nao muda o layout.
   */
  grid: css({
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))',
    gap: theme.spacing(1),
  }),
  cell: css({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(0.75),
    minHeight: 88,
    padding: theme.spacing(1, 0.5),
    background: theme.colors.background.secondary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    color: theme.colors.text.secondary,
    cursor: 'pointer',

    '&:hover': {
      background: theme.colors.action.hover,
      borderColor: theme.colors.border.medium,
      color: theme.colors.text.primary,
    },
    '&:focus-visible': { outline: `2px solid ${theme.colors.primary.main}`, outlineOffset: 1 },
    '&[data-selected]': {
      borderColor: theme.colors.primary.border,
      background: theme.colors.action.selected,
      color: theme.colors.text.primary,
    },
  }),
  cellLabel: css({
    fontSize: theme.typography.bodySmall.fontSize,
    lineHeight: 1.2,
    textAlign: 'center',
    // Dois nomes longos lado a lado nao podem esticar a celula.
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
  }),
  empty: css({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(1),
    height: '100%',
    color: theme.colors.text.secondary,
  }),
  link: css({
    background: 'none',
    border: 'none',
    padding: 0,
    color: theme.colors.text.link,
    cursor: 'pointer',
    textDecoration: 'underline',
  }),
});
