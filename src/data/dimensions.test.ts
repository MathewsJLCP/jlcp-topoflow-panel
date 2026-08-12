import {
  DataFrame,
  FieldType,
  ThresholdsMode,
  cacheFieldDisplayNames,
  createTheme,
  getDisplayProcessor,
  toDataFrame,
} from '@grafana/data';

import { formatDisplayValue, getLastNotNullValue, isFieldMissing, resolveDisplayValue, resolveText } from './dimensions';

const theme = createTheme();

/**
 * Monta frames como o Grafana os entrega ao painel: com `field.display` ja
 * instalado. E o que `applyFieldOverrides` faz por causa de `.useFieldConfig()`.
 */
function buildFrames(specs: Array<{ name: string; values: unknown[]; labels?: Record<string, string> }>): DataFrame[] {
  const frames = specs.map((spec) =>
    toDataFrame({
      fields: [
        {
          name: spec.name,
          type: FieldType.number,
          values: spec.values,
          labels: spec.labels,
          config: {
            unit: 'percent',
            thresholds: {
              mode: ThresholdsMode.Absolute,
              steps: [
                { value: -Infinity, color: 'green' },
                { value: 85, color: 'red' },
              ],
            },
          },
        },
      ],
    })
  );

  for (const frame of frames) {
    for (const field of frame.fields) {
      field.display = getDisplayProcessor({ field, theme });
    }
  }

  cacheFieldDisplayNames(frames);
  return frames;
}

describe('getLastNotNullValue', () => {
  it('pula os nulos do fim da serie', () => {
    const frames = buildFrames([{ name: 'cpu', values: [10, 42, null, null] }]);
    expect(getLastNotNullValue(frames, 'cpu')?.value).toBe(42);
  });

  it('devolve o hit com valor nulo quando a serie inteira e nula', () => {
    const frames = buildFrames([{ name: 'cpu', values: [null, null] }]);
    const hit = getLastNotNullValue(frames, 'cpu');

    // Hit presente com valor nulo e o que distingue "field sem dado" de
    // "field ausente" — dois dos tres estados de ausencia do PRD.
    expect(hit).toBeDefined();
    expect(hit?.value).toBeNull();
  });

  it('devolve undefined quando o field nao existe', () => {
    const frames = buildFrames([{ name: 'cpu', values: [1] }]);
    expect(getLastNotNullValue(frames, 'nao-existe')).toBeUndefined();
  });
});

describe('resolveDisplayValue', () => {
  it('aplica unit e threshold via field.display', () => {
    const frames = buildFrames([{ name: 'cpu', values: [92] }]);
    const display = resolveDisplayValue(frames, 'cpu');

    expect(display?.suffix?.trim()).toBe('%');
    expect(formatDisplayValue(display)).toContain('92');
    expect(display?.color).toBe(theme.visualization.getColorByName('red'));
  });

  it('usa a cor do step de baixo quando o valor esta abaixo do limite', () => {
    const frames = buildFrames([{ name: 'cpu', values: [40] }]);
    expect(resolveDisplayValue(frames, 'cpu')?.color).toBe(theme.visualization.getColorByName('green'));
  });

  it('devolve undefined sem field name', () => {
    expect(resolveDisplayValue(buildFrames([{ name: 'cpu', values: [1] }]), undefined)).toBeUndefined();
  });
});

describe('dois hosts na mesma query', () => {
  // O cenario Zabbix: mesmo nome de metrica, hosts diferentes em labels.
  const frames = buildFrames([
    { name: 'CPU utilization', values: [92], labels: { host: 'srv-a' } },
    { name: 'CPU utilization', values: [40], labels: { host: 'srv-b' } },
  ]);

  it('gera display names distintos para os dois hosts', () => {
    const names = frames.flatMap((frame) => frame.fields.map((field) => field.state?.displayName));
    expect(new Set(names).size).toBe(2);
  });

  it('cada nome resolve o valor e a cor do seu proprio host', () => {
    const [a, b] = frames.map((frame) => frame.fields[0].state!.displayName!);

    expect(formatDisplayValue(resolveDisplayValue(frames, a))).toContain('92');
    expect(resolveDisplayValue(frames, a)?.color).toBe(theme.visualization.getColorByName('red'));

    expect(formatDisplayValue(resolveDisplayValue(frames, b))).toContain('40');
    expect(resolveDisplayValue(frames, b)?.color).toBe(theme.visualization.getColorByName('green'));
  });
});

// A resolucao de cor mudou de modulo no Bloco 1: ver `elementColor.test.ts`.

describe('resolveText', () => {
  const frames = buildFrames([{ name: 'cpu', values: [92] }]);

  it('modo fixed devolve o literal', () => {
    expect(resolveText({ mode: 'fixed', fixed: 'srv-app-01' }, frames)).toBe('srv-app-01');
  });

  it('modo field devolve o texto formatado', () => {
    expect(resolveText({ mode: 'field', field: 'cpu' }, frames)).toContain('92');
  });

  /**
   * A unidade vive no `suffix` do `DisplayValue`, nunca no `text`. Lendo so
   * `.text`, um texto vinculado a uma metrica em porcentagem saia como `92` —
   * o numero certo, sem o `%` que o torna legivel, e sem sinal de que faltava
   * algo. Era o bug relatado no elemento Texto.
   */
  it('modo field aplica a unidade configurada no field', () => {
    expect(resolveText({ mode: 'field', field: 'cpu' }, frames)).toBe('92%');
  });

  it('modo field com field ausente devolve vazio', () => {
    expect(resolveText({ mode: 'field', field: 'nao-existe' }, frames)).toBe('');
  });
});

describe('formatDisplayValue e isFieldMissing', () => {
  const frames = buildFrames([{ name: 'cpu', values: [92] }]);

  it('sem display, mostra o tracinho', () => {
    expect(formatDisplayValue(undefined)).toBe('—');
  });

  it('distingue field ausente de field presente', () => {
    expect(isFieldMissing(frames, 'nao-existe')).toBe(true);
    expect(isFieldMissing(frames, 'cpu')).toBe(false);
    expect(isFieldMissing(frames, undefined)).toBe(false);
  });
});
