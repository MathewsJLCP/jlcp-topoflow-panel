import React, { useId, useMemo } from 'react';
import { css } from '@emotion/css';
import { DataFrame, GrafanaTheme2 } from '@grafana/data';
import { Combobox, ComboboxOption, Field, useStyles2 } from '@grafana/ui';

import { extractProblems, hasProblemsFrame, listHosts, listTriggers, matchesHost } from '../data/problems';
import { TriggerBinding } from '../model/types';
import { FONT_SANS, TfPalette, tfPalette } from '../theme/palette';
import { FieldLabel } from './FieldLabel';
import { ToggleField } from './ToggleField';
import { useZabbixCatalog, useZabbixSource } from './zabbixSource';
import { DashedButton, Note } from './ui/Section';
import { Segmented } from './ui/Segmented';
import { TfSelect } from './ui/TfSelect';

/**
 * O vinculo de trigger do elemento: o radio Metrica | Trigger e, em Trigger, o
 * host, as triggers (relacao OU), a lista de ativas — formato e posicao —, no
 * desenho do mockup.
 */

const MODE_OPTIONS = [
  { label: 'Métrica', value: 'metric' as const },
  { label: 'Trigger', value: 'trigger' as const },
];

const ANY_TRIGGER = '';
const ANY_TRIGGER_OPTION: ComboboxOption<string> = { value: ANY_TRIGGER, label: 'Qualquer trigger do host' };

const NOVO_VINCULO = { host: '', names: [], enabled: true, showActive: true };

type Format = 'inside' | 'strip' | 'counter' | 'list' | 'total';

/** Os formatos do mockup. Os tres primeiros vivem dentro do cartao, entao so existem no no. */
const NODE_FORMATS: Array<{ value: Format; label: string }> = [
  { value: 'inside', label: 'Dentro do nó' },
  { value: 'strip', label: 'Faixa' },
  { value: 'counter', label: 'Contador' },
];
const COMMON_FORMATS: Array<{ value: Format; label: string }> = [
  { value: 'list', label: 'Lista' },
  { value: 'total', label: 'Total' },
];

const POSITION_OPTIONS = [
  { value: 'top' as const, label: 'Acima' },
  { value: 'bottom' as const, label: 'Abaixo' },
  { value: 'left' as const, label: 'Esquerda' },
  { value: 'right' as const, label: 'Direita' },
];

interface TriggerBindingFieldProps {
  frames: DataFrame[];
  value?: TriggerBinding;
  onChange: (next: TriggerBinding) => void;
  /** No: os formatos de dentro do cartao. Ausente, so Lista e Total. */
  isNode?: boolean;
  /** Conexao: sem lista de ativas (a aresta nao tem onde pendura-la). */
  showList?: boolean;
}

export function TriggerBindingField({ frames, value, onChange, isNode, showList = true }: TriggerBindingFieldProps) {
  const styles = useStyles2(getStyles);
  const ids = useId();
  const hostId = `${ids}-host`;
  const triggerId = `${ids}-trigger`;

  const mode = value?.enabled ? 'trigger' : 'metric';
  const host = value?.host ?? '';

  // Uma linha em branco quando nao ha nenhuma: e o estado "qualquer trigger do
  // host", e ele precisa de um combo na tela para deixar de ser.
  const names = value?.names ?? [];
  const rows = names.length > 0 ? names : [''];

  const hasProblems = useMemo(() => hasProblemsFrame(frames), [frames]);
  const temCatalogo = useZabbixSource() !== undefined;
  const hostsFromFrames = useMemo(() => hostOptionsFrom(frames), [frames]);
  const triggersFromFrames = useMemo(() => triggerOptionsFrom(frames, host, false), [frames, host]);
  const triggerLeading = useMemo(() => (rows.length === 1 ? [ANY_TRIGGER_OPTION] : []), [rows.length]);
  const {
    hostOptions,
    triggerOptions,
    error: zabbixError,
  } = useZabbixCatalog({ host, hostsFromFrames, triggersFromFrames, triggerLeading });
  const hostUnknown = useMemo(() => isHostUnknown(frames, host), [frames, host]);

  const patch = (changes: Partial<TriggerBinding>) =>
    onChange({ ...NOVO_VINCULO, ...value, ...changes, enabled: true });

  const setName = (index: number, next: string) => patch({ names: rows.map((name, i) => (i === index ? next : name)) });
  const removeName = (index: number) => patch({ names: rows.filter((_, i) => i !== index) });
  const addName = () => patch({ names: [...rows, ''] });

  const handleMode = (next: 'metric' | 'trigger') => {
    if (next === 'trigger') {
      onChange({ ...NOVO_VINCULO, ...value, enabled: true });
      return;
    }
    if (value) {
      onChange({ ...value, enabled: false });
    }
  };

  // `count` e o "Total" de antes da v1.4; formato de no salvo fora do no cai na Lista.
  const formats = isNode ? [...NODE_FORMATS, ...COMMON_FORMATS] : COMMON_FORMATS;
  const raw = value?.activeDisplay === 'count' ? 'total' : (value?.activeDisplay ?? 'list');
  const format: Format = formats.some((f) => f.value === raw) ? raw : 'list';
  const showPosition = !isNode || format === 'list';

  return (
    <>
      <Field
        label={
          <FieldLabel info="Como este elemento decide o próprio estado. Alternar preserva a configuração do outro modo.">
            Estado
          </FieldLabel>
        }
      >
        <Segmented options={MODE_OPTIONS} value={mode} onChange={handleMode} />
      </Field>

      {mode === 'trigger' && (
        <>
          {!hasProblems && !temCatalogo && (
            <Note tone="info" title="Nenhuma query de Problems neste painel">
              Adicione uma query com Query Mode Problems no editor de queries do painel para vincular triggers — ou
              ligue Consultar o Zabbix diretamente nas opções do painel.
            </Note>
          )}

          {zabbixError && (
            <Note tone="warn" title="Não foi possível consultar o Zabbix">
              {`${zabbixError} As sugestões abaixo vêm apenas das queries do painel.`}
            </Note>
          )}

          <Field
            label={
              <FieldLabel info="Casamento exato, sem diferenciar maiúsculas, contra o nome visível ou técnico.">
                Host
              </FieldLabel>
            }
            htmlFor={hostId}
          >
            <Combobox
              id={hostId}
              options={hostOptions}
              value={host || null}
              onChange={(option) => patch({ host: option?.value ?? '' })}
              createCustomValue
              customValueDescription="Usar este nome de host"
              isClearable
              placeholder="Selecione ou digite o host"
              noOptionsMessage={temCatalogo ? 'Nenhum host encontrado' : 'Nenhum host nos dados'}
            />
          </Field>

          {hostUnknown && (
            <Note tone="warn">
              Host sem correspondência nos dados. Confira o nome, ou ele simplesmente não tem problema ativo agora.
            </Note>
          )}

          <Field
            label={
              <FieldLabel info="Relação OU: basta uma alarmar. Vazio = qualquer trigger do host.">
                {rows.length > 1 ? 'Triggers' : 'Trigger'}
              </FieldLabel>
            }
            htmlFor={`${triggerId}-0`}
          >
            <div className={styles.triggerList}>
              {rows.map((name, index) => (
                <div className={styles.triggerRow} key={index}>
                  {/* O `Combobox` so repassa `aria-labelledby`: rotulo proprio,
                      escondido, para a linha 2 em diante nao ficar muda. */}
                  <label className={styles.srOnly} htmlFor={`${triggerId}-${index}`}>
                    {`Trigger ${index + 1}`}
                  </label>
                  <Combobox
                    id={`${triggerId}-${index}`}
                    options={triggerOptions}
                    value={name ?? ANY_TRIGGER}
                    onChange={(option) => setName(index, option?.value ?? ANY_TRIGGER)}
                    createCustomValue
                    customValueDescription="Usar esta descrição de trigger"
                    placeholder={rows.length > 1 ? 'Selecione ou digite a trigger' : 'Qualquer trigger do host'}
                    noOptionsMessage={temCatalogo ? 'Nenhuma trigger encontrada' : 'Nenhuma trigger nos dados'}
                  />
                  {rows.length > 1 && (
                    <button
                      type="button"
                      className={styles.remove}
                      title="Remover"
                      aria-label={`Remover a trigger ${index + 1}`}
                      onClick={() => removeName(index)}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              <DashedButton onClick={addName}>+ Adicionar trigger</DashedButton>
            </div>
          </Field>

          {showList && (
            <ToggleField
              label="Exibir triggers ativas"
              description="Mostra a lista de alarmes fixa junto ao elemento."
              enabled={value?.showActive !== false}
              onToggle={(showActive) => patch({ showActive })}
            >
              <TfSelect
                label="Formato dos problemas"
                info="Dentro do nó: seção no cartão. Faixa: barra segmentada + pior problema. Contador: número no círculo + pior problema. Lista: cartão preso ao elemento. Total: uma linha com a contagem."
                value={format}
                options={formats}
                onChange={(activeDisplay) => patch({ activeDisplay })}
              />

              {showPosition && (
                <Field label="Posição da lista">
                  <Segmented
                    options={POSITION_OPTIONS}
                    value={value?.activePosition ?? 'bottom'}
                    onChange={(activePosition) => patch({ activePosition })}
                  />
                </Field>
              )}
            </ToggleField>
          )}
        </>
      )}
    </>
  );
}

function toOptions(values: string[]): Array<ComboboxOption<string>> {
  return values.map((value) => ({ value, label: value }));
}

export function hostOptionsFrom(frames: DataFrame[]): Array<ComboboxOption<string>> {
  return toOptions(listHosts(frames));
}

/**
 * A opcao "qualquer" vem sempre primeiro: e o default do campo.
 *
 * `includeAny` a esconde nas listas de duas linhas ou mais, onde ela nao seria
 * uma escolha entre triggers e sim a revogacao de todas as outras.
 */
export function triggerOptionsFrom(
  frames: DataFrame[],
  host: string,
  includeAny = true
): Array<ComboboxOption<string>> {
  const triggers = toOptions(listTriggers(frames, host || undefined));

  return includeAny ? [ANY_TRIGGER_OPTION, ...triggers] : triggers;
}

/**
 * Host digitado que nao aparece em nenhum problema.
 *
 * Nao e erro: com `showProblems: problems` um host saudavel tambem nao aparece.
 * Usa `matchesHost` — e nao a lista de hosts — para aceitar tambem o nome
 * tecnico, que o combo nao oferece mas o usuario pode ter digitado.
 *
 * Sem nenhuma query de Problems tudo seria desconhecido, e o aviso util e o
 * outro: nesse caso este fica calado para nao empilhar dois alertas.
 */
export function isHostUnknown(frames: DataFrame[], host: string): boolean {
  if (!host || !hasProblemsFrame(frames)) {
    return false;
  }

  return !extractProblems(frames).some((problem) => matchesHost(problem, host));
}

const getStyles = (theme: GrafanaTheme2) => {
  const p: TfPalette = tfPalette(theme);
  return {
    triggerList: css({ display: 'flex', flexDirection: 'column', gap: 6 }),
    triggerRow: css({
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      '& > div': { flex: 1, minWidth: 0 },
    }),
    srOnly: css({
      position: 'absolute',
      width: 1,
      height: 1,
      overflow: 'hidden',
      clip: 'rect(0, 0, 0, 0)',
      whiteSpace: 'nowrap',
    }),
    remove: css({
      border: 0,
      background: 'transparent',
      color: p.apa,
      font: `15px ${FONT_SANS}`,
      cursor: 'pointer',
      padding: '0 2px',
    }),
  };
};
