import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, useTheme2 } from '@grafana/ui';

import { DEFAULT_ICON_REF, ICON_PACKS, ResolvedIcon, TopoIcon, isKnownIcon, listIcons, resolveIcon } from '../icons';
import { FONT_MONO, FONT_SANS, TfPalette, tfMix, tfPalette } from '../theme/palette';

/**
 * Escolha do icone, no desenho do mockup.
 *
 * O campo mostra o desenho atual, o nome, o pack e "Trocar"; o clique abre o
 * navegador — pastas a esquerda, busca no topo, grade a direita. Escolher e
 * imediato: o icone aparece no formulario e no canvas na mesma hora.
 */
interface IconPickerProps {
  value: string | undefined;
  onChange: (ref: string) => void;
  /** Vazio esconde o rotulo visivel (o campo continua nomeado "Ícone"). */
  label?: string;
}

export function IconPicker({ value, onChange, label = 'Ícone' }: IconPickerProps) {
  const styles = useStyles2(getStyles);
  const [aberto, setAberto] = useState(false);
  const inputId = React.useId();

  // Chave desconhecida cai no generico, como no canvas.
  const atual = resolveIcon(isKnownIcon(value) ? value : DEFAULT_ICON_REF);

  return (
    <div className={styles.field}>
      {label && (
        <label className={styles.label} htmlFor={inputId}>
          {label}
        </label>
      )}
      <button
        id={inputId}
        type="button"
        className={styles.trigger}
        aria-label={label ? undefined : 'Ícone'}
        onClick={() => setAberto(true)}
      >
        <span className={styles.triggerIcon}>
          <TopoIcon icon={atual} size={32} />
        </span>
        <span className={styles.triggerText}>
          <span className={styles.triggerName}>{atual.label}</span>
          <span className={styles.triggerPack}>{atual.packLabel}</span>
        </span>
        <span className={styles.triggerAction}>Trocar</span>
      </button>

      {aberto && (
        <IconBrowser
          selected={isKnownIcon(value) ? atual.ref : ''}
          onSelect={(ref) => {
            onChange(ref);
            setAberto(false);
          }}
          onDismiss={() => setAberto(false)}
        />
      )}
    </div>
  );
}

/** Pasta virtual: tudo, de todos os packs. */
const TODOS = '*';

interface IconBrowserProps {
  selected: string;
  onSelect: (ref: string) => void;
  onDismiss: () => void;
}

export function IconBrowser({ selected, onSelect, onDismiss }: IconBrowserProps) {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const [pasta, setPasta] = useState(() => (isKnownIcon(selected) ? resolveIcon(selected).pack : ICON_PACKS[0].id));
  const [busca, setBusca] = useState('');

  const todos = useMemo(() => listIcons(), []);
  const daPasta = useMemo(() => todos.filter((icon) => pasta === TODOS || icon.pack === pasta), [todos, pasta]);
  const visiveis = useMemo(() => filtrar(daPasta, busca), [daPasta, busca]);
  const foraDaPasta = useMemo(
    () => (busca && visiveis.length === 0 ? filtrar(todos, busca).length : 0),
    [busca, visiveis.length, todos]
  );

  // O Grafana consome o Esc antes do bubbling: listener de captura.
  useEffect(() => {
    const tecla = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onDismiss();
      }
    };
    document.addEventListener('keydown', tecla, true);
    return () => document.removeEventListener('keydown', tecla, true);
  }, [onDismiss]);

  return createPortal(
    <div className={styles.overlay} onMouseDown={onDismiss} style={{ fontFamily: FONT_SANS }}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-label="Escolher ícone"
        onMouseDown={(event) => event.stopPropagation()}
        data-theme={theme.isDark ? 'dark' : 'light'}
      >
        <div className={styles.head}>
          <span className={styles.title}>Escolher ícone</span>
          <input
            autoFocus
            className={styles.search}
            value={busca}
            placeholder="Buscar por nome — servidor, switch, wifi…"
            onChange={(event) => setBusca(event.currentTarget.value)}
          />
          <button type="button" className={styles.close} title="Fechar" aria-label="Fechar" onClick={onDismiss}>
            ×
          </button>
        </div>

        <div className={styles.body}>
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
                    title={icon.packLabel}
                    onClick={() => onSelect(icon.ref)}
                  >
                    <span className={styles.cellIcon}>
                      <TopoIcon icon={icon} size={icon.art.kind === 'svg' ? 44 : 24} />
                    </span>
                    <span className={styles.cellLabel}>{icon.label}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className={styles.empty}>
                <span>{`Nenhum ícone para “${busca}” nesta pasta.`}</span>
                {foraDaPasta > 0 && (
                  <button type="button" className={styles.link} onClick={() => setPasta(TODOS)}>
                    {foraDaPasta === 1 ? 'Há 1 em outra pasta' : `Há ${foraDaPasta} em outras pastas`}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
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

export function filtrar(icons: ResolvedIcon[], busca: string): ResolvedIcon[] {
  const termos = normalizar(busca).split(/\s+/).filter(Boolean);
  if (!termos.length) {
    return icons;
  }
  return icons.filter((icon) => {
    const palheiro = normalizar([icon.label, icon.name, icon.packLabel, ...(icon.keywords ?? [])].join(' '));
    return termos.every((termo) => palheiro.includes(termo));
  });
}

function normalizar(texto: string): string {
  return texto.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

const getStyles = (theme: GrafanaTheme2) => {
  const p: TfPalette = tfPalette(theme);
  return {
    field: css({ display: 'flex', flexDirection: 'column', gap: 8 }),
    label: css({ '&&': { font: `500 11.5px ${FONT_SANS}`, color: p.rot } }),
    trigger: css({
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      width: '100%',
      background: p.elev,
      border: `1px solid ${p.borda}`,
      borderRadius: 7,
      padding: '6px 8px',
      cursor: 'pointer',
      textAlign: 'left',
      '&:hover': { borderColor: p.linha },
      '&:focus-visible': { outline: `2px solid ${p.ac}`, outlineOffset: 1 },
    }),
    triggerIcon: css({
      flex: 'none',
      width: 32,
      height: 32,
      borderRadius: 7,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: p.tx2,
    }),
    triggerText: css({ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }),
    triggerName: css({ font: `500 13px ${FONT_SANS}`, color: p.tx }),
    triggerPack: css({ font: `11px ${FONT_SANS}`, color: p.apa }),
    triggerAction: css({ font: `12px ${FONT_SANS}`, color: p['ac-t'] }),
    overlay: css({
      position: 'fixed',
      inset: 0,
      background: 'rgba(5,5,10,.55)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000,
    }),
    dialog: css({
      width: 'min(820px, 94vw)',
      height: 'min(560px, 88vh)',
      display: 'flex',
      flexDirection: 'column',
      background: p.sup,
      border: `1px solid ${p.borda}`,
      borderRadius: 12,
      boxShadow: `0 24px 60px ${p.shadow}`,
      overflow: 'hidden',
    }),
    head: css({
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px 14px',
      borderBottom: `1px solid ${p.borda}`,
    }),
    title: css({ font: `600 14px ${FONT_SANS}`, color: p.tf, whiteSpace: 'nowrap' }),
    search: css({
      flex: 1,
      background: p.elev,
      border: `1px solid ${p.borda}`,
      borderRadius: 7,
      padding: '7px 10px',
      font: `13px ${FONT_SANS}`,
      color: p.tx,
      outline: 'none',
      '&:focus': { borderColor: p.ac },
      '&::placeholder': { color: p.apa },
    }),
    close: css({
      border: 0,
      background: 'transparent',
      color: p.tx2,
      font: `18px ${FONT_SANS}`,
      cursor: 'pointer',
    }),
    body: css({ flex: 1, minHeight: 0, display: 'flex' }),
    folders: css({
      flex: 'none',
      width: 190,
      borderRight: `1px solid ${p.borda}`,
      padding: 8,
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
      overflowY: 'auto',
    }),
    folder: css({
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      border: 0,
      borderRadius: 6,
      background: 'transparent',
      padding: '7px 9px',
      cursor: 'pointer',
      textAlign: 'left',
      color: p.tx2,
      '&[data-active]': { background: tfMix(p.ac, 16), color: p.tf },
      '&:not([data-active]):hover': { background: p.elev },
    }),
    folderLabel: css({ flex: 1, font: `500 13px ${FONT_SANS}`, color: 'inherit' }),
    folderCount: css({ font: `11px ${FONT_MONO}`, color: p.apa }),
    gridWrapper: css({ flex: 1, minWidth: 0, overflowY: 'auto', padding: 12 }),
    grid: css({ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(104px, 1fr))', gap: 8 }),
    cell: css({
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 6,
      padding: '10px 6px',
      border: `1px solid ${p.borda}`,
      borderRadius: 9,
      background: 'transparent',
      cursor: 'pointer',
      '&:hover': { background: p.elev },
      '&[data-selected]': { border: `2px solid ${p.ac}`, background: tfMix(p.ac, 12) },
      '&:focus-visible': { outline: `2px solid ${p.ac}`, outlineOffset: 1 },
    }),
    cellIcon: css({
      width: 44,
      height: 44,
      borderRadius: 9,
      border: `1px solid ${p.borda}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: p.tx2,
    }),
    cellLabel: css({ font: `11.5px/1.25 ${FONT_SANS}`, color: p.tx, textAlign: 'center' }),
    empty: css({
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 8,
      padding: '60px 20px',
      textAlign: 'center',
      font: `13px ${FONT_SANS}`,
      color: p.tx2,
    }),
    link: css({
      border: 0,
      background: 'transparent',
      color: p['ac-t'],
      font: `500 13px ${FONT_SANS}`,
      cursor: 'pointer',
      textDecoration: 'underline',
      textUnderlineOffset: 3,
    }),
  };
};
