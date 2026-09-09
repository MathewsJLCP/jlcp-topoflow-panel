import {
  DataFrame,
  FieldType,
  ThresholdsMode,
  cacheFieldDisplayNames,
  createTheme,
  getDisplayProcessor,
  toDataFrame,
} from '@grafana/data';

import {
  formatDisplayValue,
  getLastNotNullValue,
  insertTemplateField,
  isDisplayableField,
  isFieldMissing,
  isNumericField,
  missingTemplateFields,
  resolveDisplayValue,
  resolveTemplate,
  resolveText,
  hasStateBinding,
  stateFieldName,
  templateFields,
} from './dimensions';

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

  /** O texto fixo e um template: e o que estende o recurso ao elemento Texto. */
  it('modo fixed interpola a métrica citada', () => {
    expect(resolveText({ mode: 'fixed', fixed: 'CPU: ${cpu}' }, frames)).toBe('CPU: 92%');
  });
});

/**
 * O pedido do cliente: combinar palavra e valor num rotulo so, como nos mapas do
 * Zabbix. Quem formata o valor e o `field.display()` do proprio Grafana — e por
 * isso que unidade, casas decimais e value mappings saem prontos, sem traducao
 * nossa.
 */
describe('resolveTemplate', () => {
  const frames = buildFrames([
    { name: 'traffic in', values: [92] },
    { name: 'traffic out', values: [40] },
    { name: 'sem dado', values: [null] },
  ]);

  it('texto sem placeholder atravessa intacto', () => {
    expect(resolveTemplate('IN:', frames)).toBe('IN:');
  });

  it('troca o placeholder pelo valor formatado, com unidade', () => {
    expect(resolveTemplate('IN: ${traffic in}', frames)).toBe('IN: 92%');
  });

  it('resolve várias métricas, em várias linhas', () => {
    expect(resolveTemplate('IN: ${traffic in}\nOUT: ${traffic out}', frames)).toBe('IN: 92%\nOUT: 40%');
  });

  /** Nome com espaço e dois-pontos é o caso real: `ACRILICO-SRV-AD: ICMP ping`. */
  it('aceita nome de field com espaço', () => {
    expect(resolveTemplate('${traffic in}', frames)).toBe('92%');
  });

  /**
   * As duas ausências não são a mesma coisa, e a tela não pode dizer que são:
   * field inexistente é erro de configuração, field sem valor é o "sem dado"
   * que o resto do painel já mostra como travessão.
   */
  it('field que não existe fica cru na tela, para o erro ser visível', () => {
    expect(resolveTemplate('IN: ${nao-existe}', frames)).toBe('IN: ${nao-existe}');
  });

  it('field existente e sem valor vira o travessão', () => {
    expect(resolveTemplate('IN: ${sem dado}', frames)).toBe('IN: —');
  });

  it('placeholder vazio não é placeholder', () => {
    expect(resolveTemplate('${}', frames)).toBe('${}');
  });
});

/** O que o botão "inserir métrica" do editor faz com o texto. */
describe('insertTemplateField', () => {
  it('insere na posição do cursor, com as chaves', () => {
    expect(insertTemplateField('IN: \nOUT: ', 4, 'traffic in')).toBe('IN: ${traffic in}\nOUT: ');
  });

  it('posição fora do texto vira o fim dele', () => {
    expect(insertTemplateField('IN: ', 999, 'cpu')).toBe('IN: ${cpu}');
    expect(insertTemplateField('IN: ', -1, 'cpu')).toBe('${cpu}IN: ');
  });

  /** O nome real tem espaço e dois-pontos; as chaves são o que o delimita. */
  it('preserva o nome do field como ele é', () => {
    expect(insertTemplateField('', 0, 'ACRILICO-SRV-AD: ICMP ping')).toBe('${ACRILICO-SRV-AD: ICMP ping}');
  });
});

describe('templateFields e missingTemplateFields', () => {
  const frames = buildFrames([{ name: 'cpu', values: [92] }]);

  it('lista os nomes citados, sem repetir', () => {
    expect(templateFields('${cpu} e ${cpu} e ${mem}')).toEqual(['cpu', 'mem']);
  });

  it('ignora espaço em volta do nome', () => {
    expect(templateFields('${ cpu }')).toEqual(['cpu']);
  });

  /** É o que o editor avisa: estes vão aparecer crus no canvas. */
  it('aponta só os que nenhuma série tem', () => {
    expect(missingTemplateFields('${cpu} ${mem}', frames)).toEqual(['mem']);
    expect(missingTemplateFields('${cpu}', frames)).toEqual([]);
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

/**
 * O que cada seletor de field pode oferecer. A pergunta e a mesma em todo
 * formulario — "o que este campo consegue exibir" —, e ate isto viver num lugar
 * so cada tela respondia de um jeito: o seletor de metrica no texto oferecia o
 * field `Problems`, um array de objetos, que inserido nao produzia texto nenhum.
 */
describe('filtros de field', () => {
  it('estado e valor só aceitam número', () => {
    expect(isNumericField({ type: FieldType.number })).toBe(true);
    expect(isNumericField({ type: FieldType.string })).toBe(false);
    expect(isNumericField({ type: FieldType.other })).toBe(false);
  });

  it('um texto interpola qualquer valor legível', () => {
    expect(isDisplayableField({ type: FieldType.number })).toBe(true);
    expect(isDisplayableField({ type: FieldType.string })).toBe(true);
    expect(isDisplayableField({ type: FieldType.boolean })).toBe(true);
    expect(isDisplayableField({ type: FieldType.enum })).toBe(true);
  });

  /** O `Problems` das queries de Problems é `FieldType.other`. */
  it('objeto e instante ficam de fora', () => {
    expect(isDisplayableField({ type: FieldType.other })).toBe(false);
    expect(isDisplayableField({ type: FieldType.time })).toBe(false);
    expect(isDisplayableField({ type: FieldType.frame })).toBe(false);
    expect(isDisplayableField({ type: FieldType.trace })).toBe(false);
  });

  it('field sem tipo declarado não é oferecido', () => {
    expect(isDisplayableField({})).toBe(false);
    expect(isNumericField({})).toBe(false);
  });
});

/**
 * A traducao do vinculo por host+item para o nome da serie. E o unico lugar do
 * codigo que conhece as duas formas de nomear a mesma metrica.
 */
describe('stateFieldName', () => {
  const HOST = 'AGLIN-FW-STARTI';
  const ITEM = 'CPU utilization';

  it('sem métrica, devolve o field salvo', () => {
    expect(stateFieldName({ field: 'cpu' }, [])).toBe('cpu');
    expect(stateFieldName({}, [])).toBeUndefined();
    // String vazia é o que o controle antigo escrevia ao trocar de modo sem
    // escolher nada, e para o resolver isso é ausência de vínculo.
    expect(stateFieldName({ field: '' }, [])).toBeUndefined();
  });

  /**
   * O datasource só prefixa `"<host>: "` quando aquela query casou mais de um
   * host. As duas formas são tentadas porque o mesmo item muda de nome conforme
   * a query cresce — e o vínculo não pode quebrar por causa disso.
   */
  it('acha a série com o nome qualificado', () => {
    const frames = buildFrames([{ name: `${HOST}: ${ITEM}`, values: [42] }]);

    expect(stateFieldName({ metric: { host: HOST, item: ITEM } }, frames)).toBe(`${HOST}: ${ITEM}`);
  });

  it('acha a série pelo nome puro do item, quando a query trouxe um host só', () => {
    const frames = buildFrames([{ name: ITEM, values: [42] }]);

    expect(stateFieldName({ metric: { host: HOST, item: ITEM } }, frames)).toBe(ITEM);
  });

  /**
   * Devolver `undefined` faria o elemento cair na cor Base — dizendo "nada
   * acontecendo" sobre uma métrica que ninguém está medindo. O nome que não
   * existe é o que leva a cadeia de cor ao NO DATA, que é a verdade.
   */
  it('série ausente ainda devolve nome, para o estado virar NO DATA', () => {
    expect(stateFieldName({ metric: { host: HOST, item: ITEM } }, [])).toBe(`${HOST}: ${ITEM}`);
  });

  it('a métrica vence o field quando os dois existem', () => {
    const frames = buildFrames([{ name: ITEM, values: [42] }]);

    expect(stateFieldName({ field: 'cpu', metric: { host: HOST, item: ITEM } }, frames)).toBe(ITEM);
  });

  /** Rascunho pela metade não é vínculo: o field salvo continua valendo. */
  it('métrica incompleta não anula o field', () => {
    expect(stateFieldName({ field: 'cpu', metric: { host: HOST, item: '  ' } }, [])).toBe('cpu');
  });
});

describe('hasStateBinding', () => {
  it('responde sobre a configuração, e não sobre os dados', () => {
    expect(hasStateBinding({})).toBe(false);
    expect(hasStateBinding({ fixed: 'red' })).toBe(false);
    expect(hasStateBinding({ field: 'cpu' })).toBe(true);
    expect(hasStateBinding({ metric: { host: 'h', item: 'i' } })).toBe(true);
    expect(hasStateBinding({ metric: { host: 'h', item: '' } })).toBe(false);
  });
});
