import React from 'react';
import { FieldType, toDataFrame } from '@grafana/data';
import { fireEvent, render, screen } from '@testing-library/react';

import { ColorDimension } from '../model/types';
import { StateFieldPicker, faltaNaQuery, writeMetric } from './StateFieldPicker';
import { ZabbixSourceProvider } from './zabbixSource';

/**
 * O que o bloco 2 acrescentou: escolher a metrica por **host + item** do
 * catalogo do Zabbix, em vez do display name do field.
 *
 * A escolha em si nao e testavel por DOM — o menu do `Combobox` e virtualizado e
 * nao renderiza opcao nenhuma no jsdom. Por isso as regras de escrita saem em
 * funcoes exportadas, e o DOM cobre so o que ele de fato mostra: qual dos dois
 * formularios esta na tela.
 */

jest.mock('../data/zabbixApi', () => ({
  resolveZabbixUid: (configurado?: string) => (configurado === 'nenhum' ? undefined : 'zbx'),
  searchHosts: async () => [],
  listItems: async () => [],
  listTriggers: async () => [],
}));

const HOST = 'AGLIN-FW-STARTI';
const ITEM = 'CPU utilization';

function setup(value: ColorDimension, datasource?: string) {
  const onChange = jest.fn<void, [ColorDimension]>();
  const frames = [toDataFrame({ fields: [{ name: 'cpu', type: FieldType.number, values: [1] }] })];

  render(
    <ZabbixSourceProvider datasource={datasource}>
      <StateFieldPicker frames={frames} value={value} onChange={onChange} />
    </ZabbixSourceProvider>
  );

  return { onChange };
}

describe('qual formulário aparece', () => {
  it('sem Zabbix configurado, só existe o seletor de campo', () => {
    setup({}, 'nenhum');

    expect(screen.getByText('Campo')).toBeInTheDocument();
    expect(screen.queryByText('Host')).not.toBeInTheDocument();
    // Sem catalogo nao ha para onde trocar, e o botao seria uma porta para lugar
    // nenhum.
    expect(screen.queryByRole('button', { name: /Escolher host e item/ })).not.toBeInTheDocument();
  });

  it('com Zabbix e vínculo novo, pergunta host e item', () => {
    setup({});

    expect(screen.getByText('Host')).toBeInTheDocument();
    expect(screen.getByText('Item')).toBeInTheDocument();
    expect(screen.queryByText('Campo')).not.toBeInTheDocument();
  });

  /**
   * Mostrar host e item vazios a quem ja tinha um field salvo pareceria que a
   * configuracao se perdeu — e o usuario iria reconfigurar o que estava certo.
   */
  it('com um field já salvo, abre no seletor de campo mesmo havendo Zabbix', () => {
    setup({ field: 'cpu' });

    expect(screen.getByText('Campo')).toBeInTheDocument();
    expect(screen.queryByText('Host')).not.toBeInTheDocument();
  });

  it('o botão troca de formulário sem gravar nada', () => {
    const { onChange } = setup({ field: 'cpu' });

    fireEvent.click(screen.getByRole('button', { name: /Escolher host e item/ }));

    expect(screen.getByText('Host')).toBeInTheDocument();
    // Trocar de formulario e uma decisao de tela: so a escolha seguinte grava.
    expect(onChange).not.toHaveBeenCalled();
  });

  it('com host e item salvos, avisa que a métrica não está nas queries', () => {
    setup({ metric: { host: HOST, item: ITEM } });

    expect(screen.getByText('Essa métrica não está nas queries do painel')).toBeInTheDocument();
  });
});

describe('writeMetric', () => {
  /** Dois nomes para a mesma serie nao podem conviver salvos. */
  it('gravar host e item apaga o field', () => {
    expect(writeMetric({ field: 'cpu', fixed: 'blue' }, { host: HOST, item: ITEM })).toEqual({
      fixed: 'blue',
      field: undefined,
      metric: { host: HOST, item: ITEM },
    });
  });

  it('esvaziar os dois apaga o vínculo, em vez de salvar um par vazio', () => {
    expect(writeMetric({ metric: { host: HOST, item: ITEM } }, { host: '', item: '' })).toEqual({
      field: undefined,
      metric: undefined,
    });
  });

  /** A cor Base é de outro assunto e nunca é tocada aqui. */
  it('preserva a cor fixa', () => {
    expect(writeMetric({ fixed: 'red' }, { host: HOST, item: '' }).fixed).toBe('red');
  });
});

describe('faltaNaQuery', () => {
  const frames = [
    toDataFrame({
      name: `${HOST}: ${ITEM}`,
      fields: [{ name: `${HOST}: ${ITEM}`, type: FieldType.number, values: [42] }],
    }),
  ];

  it('vínculo incompleto não avisa nada', () => {
    expect(faltaNaQuery({ metric: { host: HOST, item: '' } }, frames)).toBe(false);
    expect(faltaNaQuery({ field: 'cpu' }, frames)).toBe(false);
  });

  it('a série presente nos frames não avisa', () => {
    expect(faltaNaQuery({ metric: { host: HOST, item: ITEM } }, frames)).toBe(false);
  });

  it('a série ausente avisa', () => {
    expect(faltaNaQuery({ metric: { host: HOST, item: 'Memory' } }, frames)).toBe(true);
  });
});
