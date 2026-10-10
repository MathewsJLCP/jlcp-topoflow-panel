import React from 'react';
import { render, screen } from '@testing-library/react';
import {
  DataFrame,
  FieldType,
  cacheFieldDisplayNames,
  createTheme,
  getDisplayProcessor,
  toDataFrame,
} from '@grafana/data';

import { StateMetric } from '../data/elementColor';
import { MetricChart } from './MetricChart';

/**
 * O grafico e SVG nosso (o desenho do mockup), entao da para conferir o que
 * importa em jsdom: quais series entram, as linhas de threshold, a legenda e o
 * que aparece no lugar da serie quando ela nao existe.
 */
const theme = createTheme();

const serie = (nome: string, valores: number[] = [10, 20, 30]): DataFrame => {
  const frame = toDataFrame({
    fields: [
      { name: 'Time', type: FieldType.time, values: valores.map((_, i) => 1000 + i * 1000) },
      { name: nome, type: FieldType.number, values: valores },
    ],
  });
  for (const field of frame.fields) {
    field.display = getDisplayProcessor({ field, theme });
  }
  cacheFieldDisplayNames([frame]);
  return frame;
};

const metric = (field: string, thresholds: number[] = []): StateMetric => ({
  dim: { field },
  thresholds: { steps: thresholds.map((value) => ({ type: 'threshold' as const, value, color: 'red' })) },
});

describe('MetricChart', () => {
  it('sem métrica vinculada, diz isso', () => {
    render(<MetricChart frames={[]} metrics={[{ dim: {} }]} />);

    expect(screen.getByText('Nenhuma métrica vinculada a este elemento.')).toBeInTheDocument();
  });

  it('métrica fora das séries do painel', () => {
    render(<MetricChart frames={[serie('outra')]} metrics={[metric('cpu')]} />);

    expect(screen.getByText('A métrica não está nas séries deste painel.')).toBeInTheDocument();
  });

  /** Uma métrica: a legenda Name / Last / Max / Mean, como no mockup. */
  it('uma métrica: desenha a série e a legenda com último, máximo e média', () => {
    const { container } = render(<MetricChart frames={[serie('cpu')]} metrics={[metric('cpu')]} />);

    expect(container.querySelector('polyline')).toBeInTheDocument();
    expect(screen.getByText('Last *')).toBeInTheDocument();
    expect(screen.getByText('cpu')).toBeInTheDocument();
    // Último 30, máximo 30 e média 20 na legenda (e os mesmos números nos ticks do eixo).
    const legenda = container.querySelectorAll('[class*="css"] > span');
    const textos = Array.from(legenda).map((el) => el.textContent);
    expect(textos.filter((t) => t === '30').length).toBeGreaterThanOrEqual(2);
    expect(textos).toContain('20');
  });

  it('as regras de threshold viram linhas tracejadas com rótulo', () => {
    const { container } = render(<MetricChart frames={[serie('cpu')]} metrics={[metric('cpu', [25])]} />);

    expect(container.querySelector('line[stroke-dasharray="4 3"]')).toBeInTheDocument();
    expect(screen.getByText('≥ 25')).toBeInTheDocument();
  });

  /** Várias métricas: um gráfico por métrica, sem a legenda única. */
  it('várias métricas: um gráfico para cada, com nome no topo', () => {
    const { container } = render(
      <MetricChart frames={[serie('cpu'), serie('mem', [1, 2, 3])]} metrics={[metric('cpu'), metric('mem')]} />
    );

    expect(container.querySelectorAll('polyline')).toHaveLength(2);
    expect(screen.getByText('mem')).toBeInTheDocument();
    expect(screen.queryByText('Last *')).not.toBeInTheDocument();
  });
});
