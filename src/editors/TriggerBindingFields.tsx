import React, { useId, useMemo } from 'react';
import { css } from '@emotion/css';
import { DataFrame, GrafanaTheme2, SelectableValue } from '@grafana/data';
import {
  Alert,
  Button,
  Combobox,
  ComboboxOption,
  Field,
  IconButton,
  RadioButtonGroup,
  Switch,
  useStyles2,
} from '@grafana/ui';

import { extractProblems, hasProblemsFrame, listHosts, listTriggers, matchesHost } from '../data/problems';
import { TriggerBinding } from '../model/types';
import { FieldLabel } from './FieldLabel';
import { useZabbixCatalog, useZabbixSource } from './zabbixSource';

/**
 * Vinculo do elemento a uma trigger do Zabbix.
 *
 * **Os dados continuam vindo das queries do painel** — o Query Mode *Problems* e
 * quem acende o elemento, e este formulario le os frames resultantes para saber
 * o que ja esta na tela.
 *
 * O que mudou: com um datasource Zabbix configurado no painel, os dois combos
 * passam a sugerir o **catalogo do Zabbix** (`./zabbixSource.tsx`), e nao apenas
 * o que os frames trouxeram. E a diferenca entre escolher entre os hosts que
 * estao com problema agora e escolher entre todos os hosts que existem.
 *
 * Sem Zabbix configurado nada disso muda: as listas so contem **o que esta nos
 * dados agora**. Um host sem nenhum problema ativo nao aparece em lista nenhuma
 * — dai os dois combos aceitarem valor digitado (`createCustomValue`) e dai o
 * aviso de host desconhecido ser aviso, e nunca erro.
 */

const MODE_OPTIONS = [
  { label: 'Métrica', value: 'metric' as const },
  { label: 'Trigger', value: 'trigger' as const },
];

/** Opcao default do combo de trigger: qualquer trigger do host. */
const ANY_TRIGGER = '';
const ANY_TRIGGER_OPTION: ComboboxOption<string> = { value: ANY_TRIGGER, label: 'Qualquer trigger do host' };

/**
 * Vinculo recem-criado, para quando o usuario abre o modo Trigger e ainda nao ha
 * objeto salvo. Espelha os defaults do schema — que e quem manda depois do
 * primeiro parse; isto aqui so cobre o instante entre o clique e o save.
 */
const NOVO_VINCULO = { host: '', names: [], enabled: true, showActive: true };

/**
 * Seta e nao texto, no mesmo formato do "Posicao do titulo" do postit:
 * "Superior | Inferior | Esquerda | Direita" nao cabe nos 300px do painel de
 * opcoes sem truncar, e o glifo diz a mesma coisa sem traducao.
 *
 * O nome completo vai em `description`, que o `RadioButtonGroup` transforma em
 * tooltip — sem ele o botao fica mudo para quem nao adivinha a seta, que era o
 * defeito da primeira versao deste campo.
 */
const DISPLAY_OPTIONS: Array<SelectableValue<'list' | 'count'>> = [
  { value: 'list', label: 'Lista' },
  { value: 'count', label: 'Total' },
];

const POSITION_OPTIONS: Array<SelectableValue<'top' | 'bottom' | 'left' | 'right'>> = [
  { value: 'top', label: '↑', description: 'Acima do elemento' },
  { value: 'bottom', label: '↓', description: 'Abaixo do elemento' },
  { value: 'left', label: '←', description: 'À esquerda do elemento' },
  { value: 'right', label: '→', description: 'À direita do elemento' },
];

interface TriggerBindingFieldProps {
  frames: DataFrame[];
  value?: TriggerBinding;
  onChange: (next: TriggerBinding) => void;
}

export function TriggerBindingField({ frames, value, onChange }: TriggerBindingFieldProps) {
  // O `Field` do Grafana so associa `label` e controle quando recebe o `htmlFor`
  // — o `Combobox` nao herda id sozinho, e sem isso o campo fica sem rotulo
  // acessivel (e sem `getByLabelText` no teste).
  const styles = useStyles2(getStyles);
  const ids = useId();
  const hostId = `${ids}-host`;
  const triggerId = `${ids}-trigger`;
  const activeId = `${ids}-active`;

  const mode = value?.enabled ? 'trigger' : 'metric';
  const host = value?.host ?? '';

  /*
    Uma linha em branco quando nao ha nenhuma: e o estado "qualquer trigger do
    host", e ele precisa de um combo na tela para deixar de ser — um campo
    ausente nao se preenche. Por isso a UI trabalha sobre `rows`, e nunca sobre
    `names` cru.
  */
  const names = value?.names ?? [];
  const rows = names.length > 0 ? names : [''];

  const hasProblems = useMemo(() => hasProblemsFrame(frames), [frames]);
  // So para as mensagens de lista vazia: com catalogo, "nao ha nos dados" seria
  // mentira — a lista veio do Zabbix inteiro e mesmo assim nao achou nada.
  const temCatalogo = useZabbixSource() !== undefined;
  const hostsFromFrames = useMemo(() => hostOptionsFrom(frames), [frames]);
  const triggersFromFrames = useMemo(() => triggerOptionsFrom(frames, host, false), [frames, host]);
  // A opcao "qualquer" so existe enquanto ha uma linha so: numa lista de duas,
  // escolhe-la na segunda abrangeria todo o host e faria a primeira nao querer
  // dizer nada — um controle que apaga em silencio a escolha vizinha.
  const triggerLeading = useMemo(() => (rows.length === 1 ? [ANY_TRIGGER_OPTION] : []), [rows.length]);
  const {
    hostOptions,
    triggerOptions,
    error: zabbixError,
  } = useZabbixCatalog({ host, hostsFromFrames, triggersFromFrames, triggerLeading });
  const hostUnknown = useMemo(() => isHostUnknown(frames, host), [frames, host]);

  const patch = (changes: Partial<TriggerBinding>) =>
    onChange({ ...NOVO_VINCULO, ...value, ...changes, enabled: true });

  /*
    As tres escritas na lista. Todas passam por `rows` — e nao por `names` — para
    que a primeira edicao feita sobre a linha em branco virtual grave uma lista
    de verdade, em vez de escrever no indice de uma lista que nao existe.
  */
  const setName = (index: number, next: string) => patch({ names: rows.map((name, i) => (i === index ? next : name)) });
  const removeName = (index: number) => patch({ names: rows.filter((_, i) => i !== index) });
  const addName = () => patch({ names: [...rows, ''] });

  const handleMode = (next: 'metric' | 'trigger') => {
    if (next === 'trigger') {
      onChange({ ...NOVO_VINCULO, ...value, enabled: true });
      return;
    }

    // So alcancavel com o vinculo ligado — o radio nao dispara para a opcao ja
    // marcada, entao aqui `value` sempre existe. Desligar preserva host e nome:
    // e o que faz alternar entre os modos nao custar nada, mesmo apos salvar.
    if (value) {
      onChange({ ...value, enabled: false });
    }
  };

  return (
    <>
      <Field
        label={
          <FieldLabel info="Em Trigger, a cor vem do Zabbix e o vínculo por métrica fica inativo. A cor fixa segue valendo como identidade.">
            Estado
          </FieldLabel>
        }
      >
        <RadioButtonGroup options={MODE_OPTIONS} value={mode} onChange={handleMode} size="sm" fullWidth />
      </Field>

      {mode === 'trigger' && (
        <>
          {!hasProblems && (
            <Alert severity="info" title="Nenhuma query de Problems neste painel">
              Adicione uma query com Query Mode <strong>Problems</strong> no editor de queries do painel para vincular
              triggers.
            </Alert>
          )}

          {/*
            Falhar consultando o Zabbix nao pode travar a configuracao: os combos
            seguem oferecendo o que veio dos frames e aceitando valor digitado. O
            aviso existe para o usuario nao concluir que o host sumiu do Zabbix.
          */}
          {zabbixError && (
            <Alert severity="warning" title="Não foi possível consultar o Zabbix">
              {zabbixError} As sugestões abaixo vêm apenas das queries do painel.
            </Alert>
          )}

          <Field
            label={<FieldLabel info="Nome do host no Zabbix. Aceita valor digitado.">Host</FieldLabel>}
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
            <Alert
              severity="warning"
              title="Host sem correspondência nos dados. Confira o nome, ou ele simplesmente não tem problema ativo agora."
            />
          )}

          {/*
            Uma linha por trigger, na relacao **OU**: basta uma alarmar para o
            elemento acender, e as que alarmarem juntas aparecem todas na lista
            abaixo do elemento. Com uma linha so, e exatamente o campo unico de
            antes — inclusive a opcao "qualquer trigger do host".
          */}
          <Field
            label={
              <FieldLabel info="Cada linha é uma trigger que acende o elemento; basta uma alarmar. Com uma linha só, deixe em “qualquer” para acender com qualquer problema do host.">
                {rows.length > 1 ? 'Triggers' : 'Trigger'}
              </FieldLabel>
            }
            htmlFor={`${triggerId}-0`}
          >
            <div className={styles.triggerList}>
              {rows.map((name, index) => (
                // Pelo indice de proposito: o nome nao e unico (duas linhas em
                // branco convivem enquanto o usuario escolhe) e a lista so muda
                // por acao dele, nunca por reordenacao vinda dos dados.
                <div className={styles.triggerRow} key={index}>
                  {/* Rotulo proprio, escondido: o `Combobox` do Grafana so
                      repassa `aria-labelledby` — um `aria-label` nele nao chega
                      ao input, e a linha 2 em diante ficaria muda para leitor de
                      tela (o `htmlFor` do `Field` alcanca so a primeira). */}
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
                  {/* Some com uma linha so: remove-la levaria o campo inteiro, e
                      o caminho para "qualquer trigger" e a opcao do combo. */}
                  {rows.length > 1 && (
                    // O `IconButton` deriva o rotulo acessivel do `tooltip` e
                    // ignora um `aria-label` proprio — dai o numero da linha vir
                    // no proprio texto, que e tambem o que distingue os botoes.
                    <IconButton
                      name="times"
                      tooltip={`Remover a trigger ${index + 1}`}
                      onClick={() => removeName(index)}
                    />
                  )}
                </div>
              ))}

              <Button
                type="button"
                variant="secondary"
                fill="text"
                size="sm"
                icon="plus"
                onClick={addName}
                className={styles.addTrigger}
              >
                Adicionar trigger
              </Button>
            </div>
          </Field>

          {/*
            Fica ligado por padrao: sem a lista, o elemento vermelho diz que algo
            caiu e nao o que caiu. O desligar existe para a topologia densa, em
            que o nome de cada trigger cobriria os elementos vizinhos.

            E um `Switch` solto, e nao um `ToggleField`, porque nao ha nada para
            revelar embaixo — o `ToggleField` existe para campos que escondem um
            controle.
          */}
          <div className={styles.switchRow}>
            {/* `label` explicito, e nao o `Field` do Grafana: com um `Switch`
                dentro, o `Field` renderiza o rotulo num `<span>` e o controle
                fica sem rotulo acessivel — sem `htmlFor`, sem leitor de tela e
                sem `getByLabelText` no teste. Mesmo padrao do `ToggleField`. */}
            <label className={styles.switchLabel} htmlFor={activeId}>
              <FieldLabel info="Mostra o que está em PROBLEM logo abaixo do elemento, na topologia — os nomes das triggers ou só o total, conforme o formato escolhido.">
                Exibir triggers ativas
              </FieldLabel>
            </label>
            <Switch
              id={activeId}
              value={value?.showActive !== false}
              onChange={(event) => patch({ showActive: event.currentTarget.checked })}
            />
          </div>

          {/* Os dois campos abaixo so fazem pergunta a quem tem o que exibir:
              com a lista desligada, perguntariam o formato e o lugar de uma
              coisa que nao aparece. */}
          {/* "Formato da lista", e nao "Formato": o painel de opcoes do Grafana ja
              tem meia duzia de campos chamados "Formato" nas secoes nativas, e o
              par com "Posicao da lista" logo abaixo e o que diz de que lista se
              esta falando aqui. */}
          {value?.showActive !== false && (
            <Field
              label={
                <FieldLabel info="Lista mostra o nome de cada trigger em PROBLEM — até três, e o restante vira “+N outras”. Total troca as linhas por uma só, “4 incidentes ativos”: use quando importa quanto está caindo, e o nome de cada uma cabe no hover.">
                  Formato da lista
                </FieldLabel>
              }
            >
              <RadioButtonGroup
                options={DISPLAY_OPTIONS}
                value={value?.activeDisplay ?? 'list'}
                onChange={(activeDisplay) => patch({ activeDisplay })}
                size="sm"
                fullWidth
              />
            </Field>
          )}

          {value?.showActive !== false && (
            <Field
              label={
                <FieldLabel info="De que lado do elemento a lista aparece. Escolha pelo espaço que a sua topologia tem — um elemento na borda inferior joga a lista para fora da área visível.">
                  Posição da lista
                </FieldLabel>
              }
            >
              <RadioButtonGroup
                options={POSITION_OPTIONS}
                value={value?.activePosition ?? 'bottom'}
                onChange={(activePosition) => patch({ activePosition })}
                size="sm"
                fullWidth
              />
            </Field>
          )}
        </>
      )}
    </>
  );
}

/**
 * As tres funcoes abaixo sao exportadas para teste direto.
 *
 * O menu do `Combobox` e virtualizado e nao renderiza opcao nenhuma em jsdom —
 * um teste de DOM sobre ele exercitaria a biblioteca, nao este codigo. Testar a
 * lista que entregamos ao componente cobre o que e nosso.
 */

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

const getStyles = (theme: GrafanaTheme2) => ({
  triggerList: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
  }),
  triggerRow: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    // O combo carrega a linha inteira; o botao de remover fica no seu tamanho.
    // O rotulo escondido nao ocupa lugar no flex, entao a conta e sobre o combo.
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
  addTrigger: css({
    alignSelf: 'flex-start',
    paddingLeft: 0,
  }),
  switchRow: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(2),
  }),
  switchLabel: css({
    color: theme.colors.text.primary,
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
    cursor: 'pointer',
  }),
});
