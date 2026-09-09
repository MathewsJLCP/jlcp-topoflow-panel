import React from 'react';
import { render, screen } from '@testing-library/react';
import { DataFrame, FieldType, createTheme, getDisplayProcessor, toDataFrame } from '@grafana/data';

import { MetricChart, toChartFrame } from './MetricChart';

/**
 * O desenho em si e do uPlot, que nao roda em jsdom — o `<TimeSeries>` sai vazio
 * aqui, e testa-lo seria testar o Grafana. O que e nosso, e esta coberto: qual
 * serie vai para o grafico, e o que aparece no lugar dela quando nao ha serie.
 */

const theme = createTheme();

/**
 * Como o Grafana entrega os frames ao painel: com `field.display` ja instalado
 * por `applyFieldOverrides`. Sem isso o cabecalho nao teria valor a exibir — e
 * seria uma falha do teste, nao do componente.
 */
const serie = (nome: string, valores: number[] = [1, 2, 3]): DataFrame => {
  const frame = toDataFrame({
    fields: [
      { name: 'Time', type: FieldType.time, values: valores.map((_, i) => 1000 + i) },
      { name: nome, type: FieldType.number, values: valores },
    ],
  });

  for (const field of frame.fields) {
    field.display = getDisplayProcessor({ field, theme });
  }

  return frame;
};

describe('toChartFrame', () => {
  it('reduz o frame a duas colunas: o tempo e o field escolhido', () => {
    const frame = toDataFrame({
      fields: [
        { name: 'Time', type: FieldType.time, values: [1, 2] },
        { name: 'cpu', type: FieldType.number, values: [10, 20] },
        { name: 'mem', type: FieldType.number, values: [30, 40] },
      ],
    });

    const chart = toChartFrame(frame, frame.fields[1], [frame])!;

    // Sem o corte, o gráfico de um elemento vinculado a `cpu` mostraria `mem`
    // junto — e nada na tela diria qual linha é qual.
    expect(chart.fields.map((f) => f.name)).toEqual(['Time', 'cpu']);
    expect(chart.length).toBe(2);
  });

  /**
   * `field.config.custom` chega vazio porque o painel usa `.useFieldConfig()`
   * sem opcoes de grafico, e e dali que o GraphNG le como desenhar a linha.
   */
  it('preenche a configuração de desenho, que o painel não fornece', () => {
    const frame = serie('cpu');
    const chart = toChartFrame(frame, frame.fields[1], [frame])!;

    expect(chart.fields[1].config.custom).toMatchObject({ drawStyle: 'line', showPoints: 'never' });
  });

  /** Unidade, casas decimais e mapeamentos são configuração do usuário. */
  it('não mexe no resto da configuração do field', () => {
    const frame = serie('cpu');
    frame.fields[1].config = { ...frame.fields[1].config, unit: 'percent', decimals: 1 };

    const chart = toChartFrame(frame, frame.fields[1], [frame])!;

    expect(chart.fields[1].config).toMatchObject({ unit: 'percent', decimals: 1 });
  });

  /**
   * Dado tabular — uma query de instantaneo, o frame de Problems do Zabbix — tem
   * valor mas nao tem "ao longo de".
   */
  it('sem coluna de tempo não há série a desenhar', () => {
    const frame = toDataFrame({ fields: [{ name: 'cpu', type: FieldType.number, values: [10] }] });

    expect(toChartFrame(frame, frame.fields[0], [frame])).toBeUndefined();
  });

  it('field que não é número não vira gráfico', () => {
    const frame = toDataFrame({
      fields: [
        { name: 'Time', type: FieldType.time, values: [1] },
        { name: 'estado', type: FieldType.string, values: ['UP'] },
      ],
    });

    expect(toChartFrame(frame, frame.fields[1], [frame])).toBeUndefined();
  });
});

/**
 * As tres ausencias sao diferentes e mandam procurar em lugares diferentes — o
 * vinculo, a query, ou o tipo do dado. Uma mensagem generica faria o usuario
 * abrir o formulario quando o problema esta na query.
 */
describe('MetricChart — o que aparece quando não há curva', () => {
  it('sem métrica vinculada, aponta para o vínculo', () => {
    render(<MetricChart frames={[serie('cpu')]} field={undefined} />);

    expect(screen.getByText(/Nenhuma métrica vinculada/)).toBeInTheDocument();
  });

  it('métrica que sumiu das séries, aponta para o painel', () => {
    render(<MetricChart frames={[serie('cpu')]} field="mem" />);

    expect(screen.getByText(/não está nas séries/)).toBeInTheDocument();
  });

  it('série sem tempo, aponta para o formato do dado', () => {
    const tabular = toDataFrame({ fields: [{ name: 'cpu', type: FieldType.number, values: [10] }] });

    render(<MetricChart frames={[tabular]} field="cpu" />);

    expect(screen.getByText(/coluna de tempo/)).toBeInTheDocument();
  });

  /** O número que o elemento exibe, ao lado da curva que o explica. */
  it('mostra o nome da métrica e o último valor no cabeçalho', () => {
    render(<MetricChart frames={[serie('cpu', [10, 20, 42])]} field="cpu" />);

    expect(screen.getByText('cpu')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });
});
