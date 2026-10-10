import React, { useId, useState } from 'react';
import { DataFrame } from '@grafana/data';
import { Alert, Button, Combobox, Field } from '@grafana/ui';

import { findFieldFrame, isDisplayableField } from '../data/dimensions';
import { metricFieldName, splitMetricName } from '../data/zabbixQuery';
import { TopoFieldPicker } from './TopoFieldPicker';
import { useZabbixItemCatalog, useZabbixMetric, useZabbixMetricNames } from './zabbixSource';

/**
 * Uma metrica de "Exibir valor" do no: um campo da query **ou** host e item do
 * Zabbix — as mesmas duas formas do vinculo de Estado (`StateFieldPicker`).
 *
 * Antes so havia o seletor de campo, e no modo Trigger isso deixava o "Exibir
 * valor" preso as queries do dashboard: o elemento vinculado por trigger nao tem
 * metrica de estado, entao nao havia como chegar ao catalogo do Zabbix por
 * nenhum outro caminho.
 *
 * **O que fica salvo continua sendo um nome de serie** (`value.fields[i]`). Host
 * e item viram `"<host>: <item>"`, que e exatamente o nome com que o painel
 * batiza a serie que ele mesmo busca (`nameMetricFields`), e `metricBindings` ja
 * le esse formato de volta para montar a query. Por isso nao ha campo novo no
 * schema nem migrador.
 */
interface DisplayMetricPickerProps {
  frames: DataFrame[];
  value: string;
  onChange: (next: string | undefined) => void;
  index: number;
}

export function DisplayMetricPicker({ frames, value, onChange, index }: DisplayMetricPickerProps) {
  const ids = useId();
  const metricasDoZabbix = useZabbixMetricNames();
  const catalogoDoZabbix = useZabbixItemCatalog();

  const parsed = splitMetricName(value);
  // O host fica em estado local enquanto o item nao e escolhido: gravar so o
  // host deixaria salvo um nome de serie que nao existe.
  const [host, setHost] = useState(parsed?.host ?? '');
  // Ressincroniza quando o valor muda por fora (remover a linha de cima, undo).
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    if (value) {
      setHost(parsed?.host ?? '');
    }
  }
  const zabbix = useZabbixMetric(host);
  const item = parsed && parsed.host === host ? parsed.item : '';

  /*
    O modo e estado local derivado do salvo, como no `StateFieldPicker`. Valor que
    e um campo das queries abre em Campo; vazio ou no formato "host: item" que
    nao esta nas queries abre em Host+Item.
  */
  const [escolhido, setEscolhido] = useState<'metric' | 'field' | undefined>();
  const salvoPorCampo = Boolean(value) && (!parsed || findFieldFrame(frames, value) !== undefined);
  const porMetrica = zabbix !== undefined && (escolhido ?? (salvoPorCampo ? 'field' : 'metric')) === 'metric';

  if (!porMetrica) {
    return (
      <>
        <TopoFieldPicker
          frames={frames}
          extras={metricasDoZabbix}
          loadExtras={catalogoDoZabbix}
          value={value || undefined}
          onChange={(next) => onChange(next)}
          placeholder="Escolha uma métrica"
          filter={isDisplayableField}
        />
        {zabbix && <ModeSwitch para="metric" onClick={() => setEscolhido('metric')} />}
      </>
    );
  }

  return (
    <>
      <Field label="Host" htmlFor={`${ids}-host`}>
        <Combobox
          id={`${ids}-host`}
          aria-label={`Host da métrica ${index + 1}`}
          options={zabbix.hostOptions}
          value={host || null}
          onChange={(option) => {
            setHost(option?.value ?? '');
            // Trocar de host invalida o item.
            onChange(undefined);
          }}
          createCustomValue
          customValueDescription="Usar este nome de host"
          isClearable
          placeholder="Selecione ou digite o host"
          noOptionsMessage="Nenhum host encontrado"
        />
      </Field>
      <Field label="Item" htmlFor={`${ids}-item`}>
        <Combobox
          id={`${ids}-item`}
          aria-label={`Item da métrica ${index + 1}`}
          options={zabbix.itemOptions}
          value={item || null}
          onChange={(option) =>
            onChange(option?.value && host ? metricFieldName({ host, item: option.value }) : undefined)
          }
          createCustomValue
          customValueDescription="Usar este nome de item"
          isClearable
          placeholder={host ? 'Selecione ou digite o item' : 'Escolha o host primeiro'}
          noOptionsMessage={host ? 'Nenhum item neste host' : 'Escolha o host primeiro'}
        />
      </Field>
      {zabbix.error && (
        <Alert severity="warning" title="Não foi possível consultar o Zabbix">
          {zabbix.error} Você ainda pode digitar o host e o item à mão.
        </Alert>
      )}
      <ModeSwitch para="field" onClick={() => setEscolhido('field')} />
    </>
  );
}

function ModeSwitch({ para, onClick }: { para: 'metric' | 'field'; onClick: () => void }) {
  return (
    <Button type="button" variant="secondary" fill="text" size="sm" onClick={onClick}>
      {para === 'field' ? 'Usar um campo da query' : 'Escolher host e item no Zabbix'}
    </Button>
  );
}
