import React from 'react';
import { render, screen } from '@testing-library/react';
import { FieldType, cacheFieldDisplayNames, standardEditorsRegistry, toDataFrame } from '@grafana/data';

import { TopoFieldPicker } from './TopoFieldPicker';

/**
 * Fora do Grafana o `standardEditorsRegistry` nunca e populado — o core so o
 * preenche em runtime. Entao estes testes exercitam exatamente o caminho de
 * fallback, que e o que precisa continuar de pe se o registry mudar.
 */
describe('TopoFieldPicker (fallback)', () => {
  const frames = [
    toDataFrame({
      fields: [
        { name: 'Time', type: FieldType.time, values: [1] },
        { name: 'CPU utilization', type: FieldType.number, values: [92], labels: { host: 'srv-a' } },
      ],
    }),
    toDataFrame({
      fields: [
        { name: 'Time', type: FieldType.time, values: [1] },
        { name: 'CPU utilization', type: FieldType.number, values: [40], labels: { host: 'srv-b' } },
      ],
    }),
  ];

  beforeAll(() => cacheFieldDisplayNames(frames));

  it('confirma a pre-condicao: o editor nativo nao existe neste ambiente', () => {
    expect(standardEditorsRegistry.getIfExists('field-name')).toBeUndefined();
  });

  it('renderiza sem quebrar quando o editor nativo esta ausente', () => {
    render(<TopoFieldPicker frames={frames} onChange={jest.fn()} placeholder="Sem métrica" />);
    expect(screen.getByPlaceholderText('Sem métrica')).toBeInTheDocument();
  });

  it('mostra o valor selecionado', () => {
    render(<TopoFieldPicker frames={frames} value="CPU utilization srv-a" onChange={jest.fn()} />);
    expect(screen.getByDisplayValue('CPU utilization srv-a')).toBeInTheDocument();
  });

  it('aceita frames vazios', () => {
    render(<TopoFieldPicker frames={[]} onChange={jest.fn()} placeholder="Vazio" />);
    expect(screen.getByPlaceholderText('Vazio')).toBeInTheDocument();
  });
});
