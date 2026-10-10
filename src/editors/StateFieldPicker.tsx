import React, { useId, useState } from 'react';
import { DataFrame } from '@grafana/data';
import { Alert, Button, Combobox, Field } from '@grafana/ui';

import { isDisplayableField } from '../data/dimensions';
import { ColorDimension } from '../model/types';
import { FieldLabel } from './FieldLabel';
import { TopoFieldPicker } from './TopoFieldPicker';
import { useZabbixMetric } from './zabbixSource';

/**
 * Metrica que alimenta o estado do elemento.
 *
 * Vive num componente proprio, e nao dentro do `ThresholdsEditor`, por causa de um
 * bug: era ali que ele morava, e o `ThresholdsEditor` so e renderizado pelo
 * formulario do no. Em Conexao e Point, escolher `Metrica` em **Estado** nao
 * trazia seletor nenhum a tela — o unico caminho para vincular o field era o
 * segundo radio, escondido dentro de "Cor", que grava neste mesmo `color.field`
 * mas se apresenta como escolha de cor.
 *
 * **Duas formas de dizer a mesma coisa**, e o formulario mostra uma de cada vez:
 *
 *   - **Host + Item**, escolhidos no catalogo do Zabbix (`color.metric`). E o
 *     caminho quando a secao Zabbix esta ligada — e, como ela tambem faz o
 *     painel buscar a serie, vincular deixa de depender de existir query.
 *   - **Campo**, o display name do field (`color.field`). E o formato de tudo o
 *     que ja esta salvo, continua valido para sempre, e e o unico caminho quando
 *     nao ha Zabbix configurado.
 *
 * Quem traduz um no outro na hora de pintar e `stateFieldName`.
 */

interface StateFieldPickerProps {
  frames: DataFrame[];
  value: ColorDimension;
  onChange: (next: ColorDimension) => void;
}

export function StateFieldPicker({ frames, value, onChange }: StateFieldPickerProps) {
  const ids = useId();
  const hostId = `${ids}-host`;
  const itemId = `${ids}-item`;

  const host = value.metric?.host ?? '';
  const item = value.metric?.item ?? '';
  const zabbix = useZabbixMetric(host);

  /*
    O modo e **estado local derivado do que esta salvo**, e nao campo do schema:
    seria uma segunda fonte da verdade livre para discordar do proprio vinculo. A
    mesma escolha ja feita no formulario da Imagem, entre Biblioteca e Arquivo.

    Sem catalogo so existe um modo. Com catalogo, o padrao e Host+Item — exceto
    quando o que esta salvo e um `field`: ali mostrar campos vazios pareceria que
    a configuracao se perdeu.
  */
  const [escolhido, setEscolhido] = useState<'metric' | 'field' | undefined>();
  const salvoPorField = !value.metric && Boolean(value.field);
  const porMetrica = zabbix !== undefined && (escolhido ?? (salvoPorField ? 'field' : 'metric')) === 'metric';

  /*
    Gravar um lado **apaga** o outro. Nao e descuido com a configuracao do
    usuario (o modo Trigger, por exemplo, preserva tudo ao alternar): aqui os
    dois campos sao dois nomes para a mesma serie, e mante-los juntos deixaria
    salvo um nome que a tela nao mostra e que a resolucao ignora.
  */
  const setMetric = (next: { host: string; item: string }) => onChange(writeMetric(value, next));

  if (!porMetrica) {
    return (
      <>
        <Field
          label={
            <FieldLabel info="Métrica que alimenta as regras de estado. Sem ela, o elemento não exibe estado.">
              Campo
            </FieldLabel>
          }
        >
          <TopoFieldPicker
            frames={frames}
            // String vazia e o que o radio de modo escreve ao trocar para "Field"
            // sem escolher nada; para o seletor isso e ausencia de valor.
            value={value.field || undefined}
            onChange={(field) => onChange({ ...value, field, metric: undefined })}
            placeholder="Sem vínculo"
            // Texto tambem: as regras de Valor e Regex avaliam palavras.
            filter={isDisplayableField}
          />
        </Field>

        {zabbix && <TrocaDeModo para="metric" onClick={() => setEscolhido('metric')} />}
      </>
    );
  }

  return (
    <>
      <Field label={<FieldLabel info="Host no Zabbix. Aceita valor digitado.">Host</FieldLabel>} htmlFor={hostId}>
        <Combobox
          id={hostId}
          options={zabbix.hostOptions}
          value={host || null}
          // Trocar de host invalida o item: sao itens daquele host, e manter o
          // anterior deixaria um vinculo que nao existe em lugar nenhum.
          onChange={(option) => setMetric({ host: option?.value ?? '', item: '' })}
          createCustomValue
          customValueDescription="Usar este nome de host"
          isClearable
          placeholder="Selecione ou digite o host"
          noOptionsMessage="Nenhum host encontrado"
        />
      </Field>

      <Field
        label={<FieldLabel info="Item do host. É a métrica que as regras de estado avaliam.">Item</FieldLabel>}
        htmlFor={itemId}
      >
        <Combobox
          id={itemId}
          options={zabbix.itemOptions}
          value={item || null}
          onChange={(option) => setMetric({ host, item: option?.value ?? '' })}
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

      <TrocaDeModo para="field" onClick={() => setEscolhido('field')} />
    </>
  );
}

/**
 * Gravar um lado **apaga** o outro, e o par vazio apaga o vinculo inteiro em vez
 * de deixar `{ host: '', item: '' }` no JSON do dashboard.
 *
 * Exportada para teste direto: o menu do `Combobox` e virtualizado e nao
 * renderiza opcao nenhuma em jsdom, entao um teste de DOM sobre a escolha
 * exercitaria a biblioteca, e nao esta regra. Mesmo caminho ja adotado em
 * `TriggerBindingFields`.
 */
export function writeMetric(value: ColorDimension, next: { host: string; item: string }): ColorDimension {
  return { ...value, field: undefined, metric: next.host || next.item ? next : undefined };
}

/**
 * O caminho de volta. Existe porque o painel pode ter um Zabbix configurado para
 * o autocomplete **e** queries de outro datasource — e nesse caso o vinculo por
 * field e o unico que funciona.
 */
function TrocaDeModo({ para, onClick }: { para: 'metric' | 'field'; onClick: () => void }) {
  return (
    <Button type="button" variant="secondary" fill="text" size="sm" onClick={onClick}>
      {para === 'field' ? 'Usar um campo da query' : 'Escolher host e item no Zabbix'}
    </Button>
  );
}
