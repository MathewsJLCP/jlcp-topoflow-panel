import React, { useId, useMemo } from 'react';
import { DataFrame } from '@grafana/data';
import { Alert, Combobox, ComboboxOption, Field, RadioButtonGroup } from '@grafana/ui';

import { extractProblems, hasProblemsFrame, listHosts, listTriggers, matchesHost } from '../data/problems';
import { TriggerBinding } from '../model/types';

/**
 * Vinculo do elemento a uma trigger do Zabbix.
 *
 * Os dados vem do Query Editor nativo do painel: o usuario adiciona uma query
 * com Query Mode *Problems* e este formulario so le os frames resultantes. O
 * plugin nunca fala com a API do Zabbix.
 *
 * Consequencia que a UI precisa comunicar: as listas so contem **o que esta nos
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

interface TriggerBindingFieldProps {
  frames: DataFrame[];
  value?: TriggerBinding;
  onChange: (next: TriggerBinding) => void;
}

export function TriggerBindingField({ frames, value, onChange }: TriggerBindingFieldProps) {
  // O `Field` do Grafana so associa `label` e controle quando recebe o `htmlFor`
  // — o `Combobox` nao herda id sozinho, e sem isso o campo fica sem rotulo
  // acessivel (e sem `getByLabelText` no teste).
  const ids = useId();
  const hostId = `${ids}-host`;
  const triggerId = `${ids}-trigger`;

  const mode = value?.enabled ? 'trigger' : 'metric';
  const host = value?.host ?? '';

  const hasProblems = useMemo(() => hasProblemsFrame(frames), [frames]);
  const hostOptions = useMemo(() => hostOptionsFrom(frames), [frames]);
  const triggerOptions = useMemo(() => triggerOptionsFrom(frames, host), [frames, host]);
  const hostUnknown = useMemo(() => isHostUnknown(frames, host), [frames, host]);

  const patch = (changes: Partial<TriggerBinding>) => onChange({ host: '', ...value, ...changes, enabled: true });

  const handleMode = (next: 'metric' | 'trigger') => {
    if (next === 'trigger') {
      onChange({ host: '', ...value, enabled: true });
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
        label="Fonte de estado"
        description="No modo Trigger a cor vem do Zabbix e o vínculo por métrica fica inativo. A cor fixa continua valendo como identidade."
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

          <Field label="Host" description="Nome do host no Zabbix. Aceita valor digitado." htmlFor={hostId}>
            <Combobox
              id={hostId}
              options={hostOptions}
              value={host || null}
              onChange={(option) => patch({ host: option?.value ?? '' })}
              createCustomValue
              customValueDescription="Usar este nome de host"
              isClearable
              placeholder="Selecione ou digite o host"
              noOptionsMessage="Nenhum host nos dados"
            />
          </Field>

          {hostUnknown && (
            <Alert
              severity="warning"
              title="Host sem correspondência nos dados. Confira o nome — ou ele simplesmente não tem problema ativo agora."
            />
          )}

          <Field
            label="Trigger"
            description="Deixe em “qualquer” para acender com qualquer problema do host."
            htmlFor={triggerId}
          >
            <Combobox
              id={triggerId}
              options={triggerOptions}
              value={value?.name ?? ANY_TRIGGER}
              onChange={(option) => patch({ name: option.value || undefined })}
              createCustomValue
              customValueDescription="Usar esta descrição de trigger"
              placeholder="Qualquer trigger do host"
              noOptionsMessage="Nenhuma trigger nos dados"
            />
          </Field>
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

/** A opcao "qualquer" vem sempre primeiro: e o default do campo. */
export function triggerOptionsFrom(frames: DataFrame[], host: string): Array<ComboboxOption<string>> {
  return [
    { value: ANY_TRIGGER, label: 'Qualquer trigger do host' },
    ...toOptions(listTriggers(frames, host || undefined)),
  ];
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
