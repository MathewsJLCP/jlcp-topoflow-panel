import React from 'react';
import { DataFrame, Field, FieldType, toDataFrame } from '@grafana/data';
import { fireEvent, render, screen } from '@testing-library/react';

import { ZabbixProblem } from '../data/problems';
import { TriggerBinding } from '../model/types';
import { TriggerBindingField, hostOptionsFrom, isHostUnknown, triggerOptionsFrom } from './TriggerBindingFields';

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

const enabled: TriggerBinding = { enabled: true, host: HOST };

function setup(props: Partial<React.ComponentProps<typeof TriggerBindingField>> = {}) {
  const onChange = jest.fn();
  render(
    <TriggerBindingField frames={[problemsFrame(PROBLEMS)]} value={undefined} onChange={onChange} {...props} />
  );
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

    expect(onChange).toHaveBeenCalledWith({ enabled: true, host: '' });
  });

  /**
   * O ponto do campo opcional em vez de discriminated union: voltar para
   * Métrica desliga a flag e **preserva host e trigger escolhidos**.
   */
  it('voltar para Métrica preserva a configuração da trigger', () => {
    const value: TriggerBinding = { enabled: true, host: HOST, name: 'Unavailable by ICMP ping' };
    const { onChange } = setup({ value });

    fireEvent.click(screen.getByLabelText('Métrica'));

    expect(onChange).toHaveBeenCalledWith({ ...value, enabled: false });
  });

  it('vínculo desligado mostra Métrica sem perder os campos salvos', () => {
    setup({ value: { enabled: false, host: HOST } });

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
    // `''` e o que `onChange` converte de volta para `name: undefined`.
    expect(primeira.value).toBe('');
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
    setup({ value: { enabled: true, host: 'SRV-QUE-NAO-EXISTE' } });

    expect(screen.getByText(/sem correspondência nos dados/i)).toBeInTheDocument();
  });

  it('não avisa para host presente, nem pelo nome técnico', () => {
    setup({ value: enabled });
    expect(screen.queryByText(/sem correspondência nos dados/i)).not.toBeInTheDocument();
  });

  it('não avisa pelo nome técnico do host', () => {
    setup({ value: { enabled: true, host: 'AGLIN-FW-STARTI-aglin.stsec.com.br' } });

    expect(screen.queryByText(/sem correspondência nos dados/i)).not.toBeInTheDocument();
  });

  /** Sem dados de Problems tudo e desconhecido; o aviso util e o outro. */
  it('não empilha o aviso de host sobre o empty state', () => {
    setup({ frames: [metricFrame], value: { enabled: true, host: 'SRV-QUALQUER' } });

    expect(screen.getByText(/Nenhuma query de Problems/)).toBeInTheDocument();
    expect(screen.queryByText(/sem correspondência nos dados/i)).not.toBeInTheDocument();
  });
});
