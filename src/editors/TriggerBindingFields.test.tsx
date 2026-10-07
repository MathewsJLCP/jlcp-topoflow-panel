import React from 'react';
import { DataFrame, Field, FieldType, toDataFrame } from '@grafana/data';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { ZabbixProblem } from '../data/problems';
import { TriggerBinding } from '../model/types';
import { TriggerBindingField, hostOptionsFrom, isHostUnknown, triggerOptionsFrom } from './TriggerBindingFields';
import { ZabbixSourceProvider } from './zabbixSource';

/*
  O catalogo do Zabbix so entra nos testes que o pedem explicitamente, dentro do
  provider; sem ele o componente se comporta como sempre — que e o que todos os
  outros testes deste arquivo continuam exercitando.
*/
jest.mock('../data/zabbixApi', () => ({
  resolveZabbixUid: () => 'zbx',
  searchHosts: async () => [],
  listTriggers: async () => [],
  listItems: async () => [],
}));

const HOST = 'AGLIN-FW-STARTI';

function problemsFrame(values: ZabbixProblem[]): DataFrame {
  const field: Field = {
    name: 'Problems',
    type: FieldType.other,
    values,
    config: { custom: { type: 'problems' } },
  };

  return { name: 'problems', refId: 'B', length: values.length, fields: [field] };
}

const metricFrame = toDataFrame({ fields: [{ name: 'cpu', type: FieldType.number, values: [92] }] });

const PROBLEMS: ZabbixProblem[] = [
  { hosts: [{ name: HOST, host: 'AGLIN-FW-STARTI-aglin.stsec.com.br' }], name: 'Unavailable by ICMP ping', value: '1' },
  { hosts: [{ name: HOST }], name: 'Zabbix agent is not available', value: '1' },
  { hosts: [{ name: 'MMV-FW-STARTI-01' }], name: 'SLA abaixo do SLO', value: '1' },
];

const enabled: TriggerBinding = { enabled: true, host: HOST, names: [], showActive: true };

function setup(props: Partial<React.ComponentProps<typeof TriggerBindingField>> = {}) {
  const onChange = jest.fn();
  render(<TriggerBindingField frames={[problemsFrame(PROBLEMS)]} value={undefined} onChange={onChange} {...props} />);
  return { onChange };
}

describe('TriggerBindingField — alternância de modo', () => {
  it('começa em Métrica quando não há vínculo', () => {
    setup();

    expect(screen.getByRole('radio', { name: 'Métrica' })).toBeChecked();
    expect(screen.queryByLabelText('Host')).not.toBeInTheDocument();
  });

  it('escolher Trigger cria o vínculo ligado', () => {
    const { onChange } = setup();

    fireEvent.click(screen.getByLabelText('Trigger'));

    expect(onChange).toHaveBeenCalledWith({ enabled: true, showActive: true, host: '', names: [] });
  });

  /**
   * O ponto do campo opcional em vez de discriminated union: voltar para
   * Métrica desliga a flag e **preserva host e trigger escolhidos**.
   */
  it('voltar para Métrica preserva a configuração da trigger', () => {
    const value: TriggerBinding = { enabled: true, showActive: true, host: HOST, names: ['Unavailable by ICMP ping'] };
    const { onChange } = setup({ value });

    fireEvent.click(screen.getByLabelText('Métrica'));

    expect(onChange).toHaveBeenCalledWith({ ...value, enabled: false });
  });

  it('vínculo desligado mostra Métrica sem perder os campos salvos', () => {
    setup({ value: { enabled: false, showActive: true, host: HOST, names: [] } });

    expect(screen.getByRole('radio', { name: 'Métrica' })).toBeChecked();
    expect(screen.queryByLabelText('Host')).not.toBeInTheDocument();
  });
});

describe('opções oferecidas aos combos', () => {
  const frames = [problemsFrame(PROBLEMS)];
  const labels = (options: Array<{ label?: string }>) => options.map((option) => option.label);

  it('lista os hosts presentes nos frames, sem repetir', () => {
    expect(labels(hostOptionsFrom(frames))).toEqual([HOST, 'MMV-FW-STARTI-01']);
  });

  it('sem query de Problems não há host a oferecer', () => {
    expect(hostOptionsFrom([metricFrame])).toEqual([]);
  });

  it('"Qualquer trigger do host" vem primeiro e limpa o filtro', () => {
    const [primeira] = triggerOptionsFrom(frames, HOST);

    expect(primeira.label).toBe('Qualquer trigger do host');
    // `''` e o que a lista trata como "sem filtro de nome".
    expect(primeira.value).toBe('');
  });

  /**
   * Numa lista de duas linhas, "qualquer" nao seria uma escolha entre triggers e
   * sim a revogacao das outras — o combo entao so oferece triggers.
   */
  it('"Qualquer trigger do host" some quando ha mais de uma linha', () => {
    expect(labels(triggerOptionsFrom(frames, HOST, false))).toEqual([
      'Unavailable by ICMP ping',
      'Zabbix agent is not available',
    ]);
  });

  it('lista só as triggers do host escolhido', () => {
    expect(labels(triggerOptionsFrom(frames, HOST))).toEqual([
      'Qualquer trigger do host',
      'Unavailable by ICMP ping',
      'Zabbix agent is not available',
    ]);
  });

  it('sem host escolhido, oferece as triggers de todos', () => {
    expect(labels(triggerOptionsFrom(frames, ''))).toContain('SLA abaixo do SLO');
  });
});

describe('isHostUnknown', () => {
  const frames = [problemsFrame(PROBLEMS)];

  it('acusa host que não aparece em nenhum problema', () => {
    expect(isHostUnknown(frames, 'SRV-QUE-NAO-EXISTE')).toBe(true);
  });

  it('aceita o host pelo nome de exibição e pelo nome técnico', () => {
    expect(isHostUnknown(frames, HOST)).toBe(false);
    expect(isHostUnknown(frames, 'AGLIN-FW-STARTI-aglin.stsec.com.br')).toBe(false);
  });

  it('cala quando não há host escolhido ou não há query de Problems', () => {
    expect(isHostUnknown(frames, '')).toBe(false);
    expect(isHostUnknown([metricFrame], 'SRV-QUALQUER')).toBe(false);
  });
});

describe('TriggerBindingField — orientação ao usuário', () => {
  it('sem query de Problems, explica como adicioná-la', () => {
    setup({ frames: [metricFrame], value: enabled });

    expect(screen.getByText(/Nenhuma query de Problems/)).toBeInTheDocument();
    expect(screen.getByText(/Query Mode/)).toBeInTheDocument();
  });

  it('o empty state não aparece quando há query de Problems', () => {
    setup({ value: enabled });

    expect(screen.queryByText(/Nenhuma query de Problems/)).not.toBeInTheDocument();
  });

  /** Criterio 7: host errado e host saudavel sao indistinguiveis nos dados. */
  it('avisa quando o host digitado não aparece nos dados', () => {
    setup({ value: { enabled: true, showActive: true, host: 'SRV-QUE-NAO-EXISTE', names: [] } });

    expect(screen.getByText(/sem correspondência nos dados/i)).toBeInTheDocument();
  });

  it('não avisa para host presente, nem pelo nome técnico', () => {
    setup({ value: enabled });
    expect(screen.queryByText(/sem correspondência nos dados/i)).not.toBeInTheDocument();
  });

  it('não avisa pelo nome técnico do host', () => {
    setup({ value: { enabled: true, showActive: true, host: 'AGLIN-FW-STARTI-aglin.stsec.com.br', names: [] } });

    expect(screen.queryByText(/sem correspondência nos dados/i)).not.toBeInTheDocument();
  });

  /** Sem dados de Problems tudo e desconhecido; o aviso util e o outro. */
  it('não empilha o aviso de host sobre o empty state', () => {
    setup({ frames: [metricFrame], value: { enabled: true, showActive: true, host: 'SRV-QUALQUER', names: [] } });

    expect(screen.getByText(/Nenhuma query de Problems/)).toBeInTheDocument();
    expect(screen.queryByText(/sem correspondência nos dados/i)).not.toBeInTheDocument();
  });
});

/**
 * Mais de uma trigger no mesmo vinculo: uma linha por trigger, na relacao OU.
 *
 * O menu do `Combobox` e virtualizado e nao abre em jsdom — o que da para provar
 * aqui e a estrutura da lista (quantas linhas, o que some com uma so) e o que
 * cada botao grava. A escolha dentro do menu esta coberta por
 * `triggerOptionsFrom`.
 */
describe('TriggerBindingField — lista de triggers', () => {
  const adicionar = () => screen.getByRole('button', { name: /Adicionar trigger/ });

  it('vinculo sem trigger escolhida mostra uma linha só, sem remover', () => {
    setup({ value: enabled });

    expect(screen.getByLabelText('Trigger 1')).toBeInTheDocument();
    expect(screen.queryByLabelText('Trigger 2')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Remover a trigger/ })).not.toBeInTheDocument();
  });

  it('uma linha por trigger salva', () => {
    setup({ value: { ...enabled, names: ['Unavailable by ICMP ping', 'Zabbix agent is not available'] } });

    expect(screen.getByLabelText('Trigger 1')).toHaveValue('Unavailable by ICMP ping');
    expect(screen.getByLabelText('Trigger 2')).toHaveValue('Zabbix agent is not available');
  });

  /** O rotulo acompanha a contagem: "Trigger" com uma, "Triggers" com varias. */
  it('o rótulo vira plural com mais de uma linha', () => {
    setup({ value: enabled });
    expect(screen.queryByText('Triggers')).not.toBeInTheDocument();

    cleanup();

    setup({ value: { ...enabled, names: ['a', 'b'] } });
    expect(screen.getByText('Triggers')).toBeInTheDocument();
  });

  it('"Adicionar trigger" acrescenta uma linha em branco no fim', () => {
    const { onChange } = setup({ value: { ...enabled, names: ['Unavailable by ICMP ping'] } });

    fireEvent.click(adicionar());

    expect(onChange).toHaveBeenCalledWith({ ...enabled, names: ['Unavailable by ICMP ping', ''] });
  });

  /** Sem nenhuma salva, a linha em branco que ja esta na tela e a primeira. */
  it('adicionar a partir do vínculo vazio grava as duas linhas visíveis', () => {
    const { onChange } = setup({ value: enabled });

    fireEvent.click(adicionar());

    expect(onChange).toHaveBeenCalledWith({ ...enabled, names: ['', ''] });
  });

  it('remover tira só a linha pedida', () => {
    const names = ['Unavailable by ICMP ping', 'Zabbix agent is not available'];
    const { onChange } = setup({ value: { ...enabled, names } });

    fireEvent.click(screen.getByRole('button', { name: 'Remover a trigger 1' }));

    expect(onChange).toHaveBeenCalledWith({ ...enabled, names: ['Zabbix agent is not available'] });
  });

  /** Voltar a uma linha e o caminho de volta para "qualquer trigger do host". */
  it('a lista some inteira quando a última linha nomeada é removida', () => {
    const { onChange } = setup({ value: { ...enabled, names: ['Unavailable by ICMP ping', ''] } });

    fireEvent.click(screen.getByRole('button', { name: 'Remover a trigger 2' }));

    expect(onChange).toHaveBeenCalledWith({ ...enabled, names: ['Unavailable by ICMP ping'] });
  });

  it('não aparece no modo Métrica', () => {
    setup({ value: { ...enabled, enabled: false } });

    expect(screen.queryByLabelText('Trigger 1')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Adicionar trigger/ })).not.toBeInTheDocument();
  });
});

/**
 * Liga e desliga a lista de triggers abaixo do elemento. Nasce ligada: sem ela,
 * o elemento vermelho diz que algo caiu e nao o que caiu.
 */
describe('TriggerBindingField — exibir triggers ativas', () => {
  const rotulo = 'Exibir triggers ativas';
  /**
   * Por papel, e nao por `getByLabelText`: o `Switch` do Grafana ja traz um
   * `<label>` proprio para o input, entao o rotulo do campo e o dele apontam
   * para o mesmo controle e a busca por texto acha dois.
   */
  const toggle = () => screen.getByRole('switch', { name: new RegExp(rotulo) });

  it('aparece só no modo Trigger', () => {
    setup({ value: { enabled: false, showActive: true, host: HOST, names: [] } });
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();

    cleanup();

    setup({ value: enabled });
    expect(toggle()).toBeInTheDocument();
  });

  it('vem marcado por padrão e desliga sem levar o vínculo junto', () => {
    const { onChange } = setup({ value: enabled });

    expect(toggle()).toBeChecked();

    fireEvent.click(toggle());

    expect(onChange).toHaveBeenCalledWith({ ...enabled, showActive: false });
  });

  it('vínculo salvo sem a flag aparece ligado', () => {
    setup({ value: { enabled: true, host: HOST, names: [] } as unknown as TriggerBinding });

    expect(toggle()).toBeChecked();
  });
});

/**
 * Nomes ou so o total. `list` e o default porque era o unico formato possivel
 * ate aqui — nenhuma topologia salva muda de aparencia.
 */
describe('TriggerBindingField — formato da lista', () => {
  const formato = (rotulo: string) => screen.getByRole('radio', { name: rotulo });

  it('aparece com a lista ligada e some com ela desligada', () => {
    setup({ value: enabled });
    expect(screen.getByText('Formato da lista')).toBeInTheDocument();

    cleanup();

    setup({ value: { ...enabled, showActive: false } });
    expect(screen.queryByText('Formato da lista')).not.toBeInTheDocument();
  });

  it('vínculo sem formato salvo mostra Lista marcado', () => {
    setup({ value: enabled });

    expect(formato('Lista')).toBeChecked();
  });

  it('escolher Total grava no vínculo', () => {
    const { onChange } = setup({ value: enabled });

    fireEvent.click(formato('Total'));

    expect(onChange).toHaveBeenCalledWith({ ...enabled, activeDisplay: 'count' });
  });

  it('vínculo salvo em Total volta marcado nele', () => {
    setup({ value: { ...enabled, activeDisplay: 'count' } });

    expect(formato('Total')).toBeChecked();
  });
});

/**
 * A topologia decide onde há espaço: um elemento na borda inferior joga a lista
 * para fora da área visível, e um nó com vizinho logo abaixo cobre o vizinho.
 */
describe('TriggerBindingField — posição da lista', () => {
  /** O rótulo visível é a seta; o nome completo vive no tooltip, como no postit. */
  const posicao = (seta: string) => screen.getByRole('radio', { name: seta });

  it('aparece com a lista ligada e some com ela desligada', () => {
    setup({ value: enabled });
    expect(screen.getByText('Posição da lista')).toBeInTheDocument();

    cleanup();

    setup({ value: { ...enabled, showActive: false } });
    expect(screen.queryByText('Posição da lista')).not.toBeInTheDocument();
  });

  /** `bottom` era o único lugar possível até aqui — daí ser o padrão. */
  it('vínculo sem posição salva mostra Inferior marcado', () => {
    setup({ value: enabled });

    expect(posicao('↓')).toBeChecked();
  });

  it('escolher um lado grava no vínculo', () => {
    const { onChange } = setup({ value: enabled });

    fireEvent.click(posicao('→'));

    expect(onChange).toHaveBeenCalledWith({ ...enabled, activePosition: 'right' });
  });

  it('os quatro lados estão na tela', () => {
    setup({ value: enabled });

    for (const seta of ['↑', '↓', '←', '→']) {
      expect(posicao(seta)).toBeInTheDocument();
    }
  });
});

/**
 * O aviso de "nenhuma query de Problems" so faz sentido para quem depende das
 * queries do dashboard. Com a secao Zabbix ligada, ele mandava o usuario
 * resolver um problema que ele acabou de dispensar — e aparecia num painel
 * funcionando, cheio de incidentes na tela.
 */
describe('aviso de query ausente', () => {
  const semProblemas = [metricFrame];

  it('sem catálogo, o aviso aparece', () => {
    render(<TriggerBindingField frames={semProblemas} value={enabled} onChange={jest.fn()} />);

    expect(screen.getByText('Nenhuma query de Problems neste painel')).toBeInTheDocument();
  });

  it('com a seção Zabbix ligada, o aviso some', () => {
    render(
      <ZabbixSourceProvider enabled datasource="zbx">
        <TriggerBindingField frames={semProblemas} value={enabled} onChange={jest.fn()} />
      </ZabbixSourceProvider>
    );

    expect(screen.queryByText('Nenhuma query de Problems neste painel')).not.toBeInTheDocument();
  });
});
