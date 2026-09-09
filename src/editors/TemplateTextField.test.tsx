import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { DataFrame, FieldType, cacheFieldDisplayNames, toDataFrame } from '@grafana/data';

import { TemplateTextField } from './TemplateTextField';

/**
 * O campo que combina palavra e metrica, como nos mapas do Zabbix. O que se fixa
 * aqui e o que o editor faz com o **texto**: a interpolacao em si esta em
 * `dimensions.test.ts`, e o canvas nao passa por aqui.
 */

function buildFrames(names: string[]): DataFrame[] {
  const frames = names.map((name) => toDataFrame({ fields: [{ name, type: FieldType.number, values: [1] }] }));

  cacheFieldDisplayNames(frames);
  return frames;
}

const FRAMES = buildFrames(['traffic in', 'traffic out']);

function setup(value = '') {
  const onChange = jest.fn<void, [string]>();

  const { rerender } = render(
    <TemplateTextField frames={FRAMES} value={value} aria-label="Rótulo" onChange={onChange} />
  );

  return {
    onChange,
    campo: () => screen.getByLabelText('Rótulo') as HTMLTextAreaElement,
    /** O texto como ficou na última escrita. */
    texto: () => onChange.mock.calls.at(-1)?.[0],
    rerender: (next: string) =>
      rerender(<TemplateTextField frames={FRAMES} value={next} aria-label="Rótulo" onChange={onChange} />),
  };
}

describe('TemplateTextField — escrever o texto', () => {
  it('aceita várias linhas: é um textarea, não um input', () => {
    const { campo } = setup('IN:\nOUT:');

    expect(campo().tagName).toBe('TEXTAREA');
    expect(campo()).toHaveValue('IN:\nOUT:');
  });

  it('digitar escreve o texto cru, sem interpolar', () => {
    const { campo, texto } = setup('');

    fireEvent.change(campo(), { target: { value: 'IN: ${traffic in}' } });

    expect(texto()).toBe('IN: ${traffic in}');
  });
});

/**
 * O nome de exibicao real e algo como `ACRILICO-SRV-AD: ICMP ping`. Acertar isso
 * de cabeca, com espacos e dois-pontos no lugar certo, e a diferenca entre o
 * recurso funcionar e o usuario achar que nao funciona — dai o seletor.
 *
 * A **escolha** nele nao e exercitada aqui: o menu do `Combobox` e virtualizado
 * e nao renderiza opcao nenhuma no jsdom, entao um teste sobre ele exercitaria a
 * biblioteca. O que e nosso esta em `insertTemplateField` (`dimensions.test.ts`).
 */
describe('TemplateTextField — inserir métrica pelo seletor', () => {
  it('o seletor está na tela, e vazio: é um botão de inserir, não um vínculo', () => {
    setup('IN: ${traffic in}');

    expect(screen.getByPlaceholderText('Inserir métrica')).toHaveValue('');
  });
});

describe('TemplateTextField — aviso de métrica inexistente', () => {
  it('cala quando todas as métricas citadas existem', () => {
    setup('IN: ${traffic in}');

    expect(screen.queryByText(/Sem correspondência/)).not.toBeInTheDocument();
  });

  /**
   * Aviso, e não erro: o texto continua válido. O que ele diz é que aquele
   * `${...}` vai aparecer cru no canvas — que é como `resolveTemplate` trata um
   * nome que nenhuma série tem.
   */
  it('nomeia as que nenhuma série tem', () => {
    setup('IN: ${traffic in}\nOUT: ${nao-existe}');

    expect(screen.getByText(/Sem correspondência nas séries: nao-existe/)).toBeInTheDocument();
  });
});
