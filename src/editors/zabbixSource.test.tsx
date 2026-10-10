import React from 'react';
import { ComboboxOption } from '@grafana/ui';
import { act, renderHook } from '@testing-library/react';

import { ZabbixSourceProvider, encurtar, useZabbixCatalog } from './zabbixSource';

/**
 * O que este modulo decide e **de que lista o combo escolhe**. Testar isso pelo
 * DOM seria testar o `Combobox`, cujo menu e virtualizado e nao renderiza opcao
 * nenhuma no jsdom — pela mesma razao ja registrada em `TriggerBindingFields`.
 */

jest.mock('../data/zabbixApi', () => ({
  resolveZabbixUid: (configurado?: string) => (configurado === 'nenhum' ? undefined : 'zbx'),
  searchHosts: (...args: unknown[]) => searchHosts(...args),
  listTriggers: (...args: unknown[]) => listTriggers(...args),
}));

const searchHosts = jest.fn();
const listTriggers = jest.fn();

const ANY: ComboboxOption<string> = { value: '', label: 'Qualquer trigger do host' };
const HOSTS_DOS_FRAMES: Array<ComboboxOption<string>> = [{ value: 'MMV-FW', label: 'MMV-FW' }];
const TRIGGERS_DOS_FRAMES: Array<ComboboxOption<string>> = [{ value: 'ICMP', label: 'ICMP' }];

function catalogo(datasource?: string, host = 'AGLIN-FW') {
  return renderHook(
    () =>
      useZabbixCatalog({
        host,
        hostsFromFrames: HOSTS_DOS_FRAMES,
        triggersFromFrames: TRIGGERS_DOS_FRAMES,
        triggerLeading: [ANY],
      }),
    {
      wrapper: ({ children }) => <ZabbixSourceProvider datasource={datasource}>{children}</ZabbixSourceProvider>,
    }
  );
}

const valores = (options: Array<ComboboxOption<string>>) => options.map((option) => option.value);

beforeEach(() => {
  searchHosts.mockReset();
  listTriggers.mockReset();
});

describe('sem Zabbix disponivel', () => {
  /**
   * E o comportamento anterior inteiro, e o mesmo caminho de quem tem o Zabbix
   * fora do ar: lista sincrona, sem estado de carregamento e sem promessa.
   */
  it('entrega as listas dos frames, prontas', () => {
    const { result } = catalogo('nenhum');

    expect(result.current.hostOptions).toBe(HOSTS_DOS_FRAMES);
    expect(valores(result.current.triggerOptions as Array<ComboboxOption<string>>)).toEqual(['', 'ICMP']);
    expect(searchHosts).not.toHaveBeenCalled();
  });
});

describe('com catalogo do Zabbix', () => {
  it('poe o Zabbix na frente e mantem o que so existe nos frames', async () => {
    searchHosts.mockResolvedValue([{ hostid: '1', name: 'AGLIN-FW', host: 'aglin.local' }]);

    const { result } = catalogo();
    const carregar = result.current.hostOptions as (input: string) => Promise<Array<ComboboxOption<string>>>;

    // O host dos frames nao casa com o termo, entao some da lista filtrada — o
    // filtro dos frames e nosso, o do Zabbix e do proprio `host.get`.
    expect(valores(await carregar('AGLIN'))).toEqual(['AGLIN-FW']);
    // Sem termo, os dois mundos convivem sem repetir.
    expect(valores(await carregar(''))).toEqual(['AGLIN-FW', 'MMV-FW']);
  });

  it('nao repete o host que existe nos dois lados', async () => {
    searchHosts.mockResolvedValue([{ hostid: '1', name: 'MMV-FW' }]);

    const { result } = catalogo();
    const carregar = result.current.hostOptions as (input: string) => Promise<Array<ComboboxOption<string>>>;

    expect(valores(await carregar(''))).toEqual(['MMV-FW']);
  });

  /** "Qualquer trigger do host" e o default do campo: nunca sai do topo. */
  it('mantem a opcao padrao na frente do catalogo', async () => {
    listTriggers.mockResolvedValue([{ triggerid: '5', description: 'Unavailable by ICMP ping' }]);

    const { result } = catalogo();
    const carregar = result.current.triggerOptions as (input: string) => Promise<Array<ComboboxOption<string>>>;

    expect(valores(await carregar(''))).toEqual(['', 'Unavailable by ICMP ping', 'ICMP']);
  });

  it('sem host escolhido nao pergunta triggers ao Zabbix', async () => {
    const { result } = catalogo(undefined, '');
    const carregar = result.current.triggerOptions as (input: string) => Promise<Array<ComboboxOption<string>>>;

    expect(valores(await carregar(''))).toEqual(['', 'ICMP']);
    expect(listTriggers).not.toHaveBeenCalled();
  });

  /**
   * Falhar consultando o Zabbix nao pode tirar do usuario o que ele ja tinha: as
   * listas voltam a ser as dos frames e o erro vira aviso na tela, nao excecao
   * dentro do combo.
   */
  it('erro na API cai para os frames e reporta', async () => {
    searchHosts.mockRejectedValue(new Error('403 sem permissão'));

    const { result } = catalogo();
    const carregar = result.current.hostOptions as (input: string) => Promise<Array<ComboboxOption<string>>>;

    // Dentro de `act` porque o proprio carregamento grava o erro no estado: sem
    // isso o React avisa (com razao) que houve atualizacao fora do fluxo.
    await act(async () => {
      expect(valores(await carregar(''))).toEqual(['MMV-FW']);
    });

    expect(result.current.error).toBe('403 sem permissão');
  });
});

/** O menu do Combobox toma a largura da opção mais longa: a chave não pode esticá-lo. */
describe('encurtar', () => {
  it('texto curto fica como está', () => {
    expect(encurtar('system.cpu.util')).toBe('system.cpu.util');
  });

  it('chave longa encurta pelo meio, mantendo o começo e o fim', () => {
    const chave = 'perf_counter_en["\PhysicalDisk(0 C:)\Avg. Disk Write Queue Length",60]';
    const curta = encurtar(chave);

    expect(curta).toHaveLength(40);
    expect(curta.startsWith('perf_counter_en')).toBe(true);
    expect(curta.endsWith('Queue Length",60]')).toBe(true);
    expect(curta).toContain('…');
  });
});
