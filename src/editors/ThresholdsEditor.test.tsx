import React from 'react';
import { createTheme } from '@grafana/data';
import { fireEvent, render, screen } from '@testing-library/react';

import { ColorDimension, ElementAlert, ElementRule, ElementThresholds } from '../model/types';
import { writeSeverityLadder } from '../data/thresholds';
import { ThresholdsEditor } from './ThresholdsEditor';

/**
 * O editor e exercitado **sem passar por formulario nenhum**: e o que prova o
 * criterio do Bloco 2 de que ele nao depende do no. As props sao `ColorDimension`
 * e `ElementThresholds` crus, os dois tipos que Conexao e Point tambem terao no
 * Bloco 3.
 */

const BASE: ColorDimension = { fixed: 'green', field: 'cpu' };

function setup(
  thresholds?: ElementThresholds,
  color: ColorDimension = BASE,
  axis: 'metric' | 'trigger' = 'metric',
  alert?: ElementAlert
) {
  const onColorChange = jest.fn<void, [ColorDimension]>();
  const onThresholdsChange = jest.fn<void, [ElementThresholds | undefined]>();
  const onAlertChange = jest.fn<void, [ElementAlert | undefined]>();

  render(
    <ThresholdsEditor
      axis={axis}
      color={color}
      thresholds={thresholds}
      alert={alert}
      onColorChange={onColorChange}
      onThresholdsChange={onThresholdsChange}
      onAlertChange={onAlertChange}
    />
  );

  return {
    onColorChange,
    onThresholdsChange,
    onAlertChange,
    rules: () => onThresholdsChange.mock.calls.at(-1)?.[0]?.steps,
    /** O que sobrou na última escrita de cor — a linha Base grava aqui. */
    color: () => onColorChange.mock.calls.at(-1)?.[0],
  };
}

const addRule = (tipo: string) => {
  fireEvent.click(screen.getByRole('button', { name: /Adicionar regra/ }));
  fireEvent.click(screen.getByRole('menuitem', { name: new RegExp(tipo) }));
};

const withRule = (rule: ElementRule): ElementThresholds => ({ steps: [rule] });

describe('ThresholdsEditor — contrato de edição', () => {
  it('adicionar cria a regra', () => {
    const { rules } = setup(undefined);

    addRule('Threshold');

    expect(rules()).toEqual([{ type: 'threshold', value: 80, color: 'yellow' }]);
  });

  it('editar a condição reescreve só ela', () => {
    const { rules } = setup(withRule({ type: 'threshold', value: 90, color: 'red', label: 'crítico' }));

    fireEvent.change(screen.getByLabelText('Valor da regra 1'), { target: { value: '95' } });

    expect(rules()).toEqual([{ type: 'threshold', value: 95, color: 'red', label: 'crítico' }]);
  });

  /**
   * O campo de rótulo saiu da linha: `[cor] [condição] [animação] [lixeira]`. O
   * `label` continua no schema e continua alimentando o badge, mas quem já o
   * tinha salvo não o perde ao editar a regra por outro campo.
   */
  it('não há campo de rótulo, e o que estava salvo sobrevive à edição', () => {
    const { rules } = setup(withRule({ type: 'threshold', value: 90, color: 'red', label: 'crítico' }));

    expect(screen.queryByLabelText('Texto exibido da regra 1')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Valor da regra 1'), { target: { value: '95' } });

    expect(rules()).toEqual([{ type: 'threshold', value: 95, color: 'red', label: 'crítico' }]);
  });

  /** Zero regras e a ausencia de regra: o objeto sai do JSON e vale a Base. */
  it('remover a última regra apaga o objeto inteiro', () => {
    const { onThresholdsChange } = setup(withRule({ type: 'threshold', value: 90, color: 'red' }));

    fireEvent.click(screen.getByRole('button', { name: 'Remover regra' }));

    expect(onThresholdsChange).toHaveBeenCalledWith(undefined);
  });
});

describe('ThresholdsEditor — a linha Base', () => {
  it('não é uma regra: não tem lixeira própria', () => {
    setup(undefined);

    expect(screen.getByText('Base')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remover regra' })).not.toBeInTheDocument();
  });

  /**
   * A amostra da Base tem de mostrar o que o elemento **exibe**, e nao um
   * placeholder. Enquanto mostrava verde fixo, ligar o Background de uma imagem
   * e passar para o modo Estado deixava a placa neutra no canvas com a linha
   * Base verde no editor — e a unica forma de faze-los concordar era abrir o
   * seletor e escolher a cor que ja parecia estar escolhida.
   */
  it('sem cor escolhida, a amostra mostra o neutro do tema — nunca verde', () => {
    const neutro = createTheme().colors.background.secondary;
    setup(undefined, { field: 'cpu' });

    const amostra = screen.getByTestId('data-testid-colorswatch').querySelector('button');

    expect(amostra?.getAttribute('aria-label')?.toLowerCase()).toContain(neutro.toLowerCase());
  });

  it('com cor escolhida, a amostra mostra a cor escolhida', () => {
    setup(undefined, { fixed: 'red', field: 'cpu' });

    const amostra = screen.getByTestId('data-testid-colorswatch').querySelector('button');

    expect(amostra?.getAttribute('aria-label')?.toLowerCase()).toContain('red');
  });

  it('o aviso de "sem regra própria" vive no tooltip, não no corpo', () => {
    setup(undefined);

    // Fora do tooltip o texto não ocupa linha nenhuma do formulário.
    expect(screen.queryByText(/Sem regra, vale a Base/)).not.toBeInTheDocument();

    fireEvent.focus(screen.getByRole('button', { name: 'Mais informações' }));

    expect(screen.getByText(/Sem regra, vale a Base/)).toBeInTheDocument();
  });
});

/**
 * O caso de dois campos foi o risco levantado no Bloco 0: `[cor][de][ate][rotulo]
 * [lixeira]` sao cinco controles, e num painel estreito eles nao cabem numa linha
 * so. A quebra e resolvida no CSS (`flex-wrap`), entao o que se garante aqui e o
 * que o jsdom alcanca: nenhum controle foi perdido no caminho.
 */
describe('ThresholdsEditor — regra de dois campos', () => {
  it('faixa mantém os dois campos e a animação', () => {
    setup(withRule({ type: 'range', from: 1, to: 5, color: 'blue' }));

    expect(screen.getByLabelText('Início da faixa da regra 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Fim da faixa da regra 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Animação da regra 1')).toBeInTheDocument();
  });

  it('editar cada ponta da faixa não mexe na outra', () => {
    const { rules } = setup(withRule({ type: 'range', from: 1, to: 5, color: 'blue' }));

    fireEvent.change(screen.getByLabelText('Fim da faixa da regra 1'), { target: { value: '9' } });

    expect(rules()).toEqual([{ type: 'range', from: 1, to: 9, color: 'blue' }]);
  });
});

/**
 * A regra e o rotulo passaram a viver na mesma linha. O jsdom nao calcula
 * layout, entao o que da para fixar e a estrutura que o CSS assume: os quatro
 * controles da regra sao irmaos sob um unico elemento de linha.
 */
describe('ThresholdsEditor — uma regra, uma linha', () => {
  it('condição, animação e lixeira compartilham a mesma linha', () => {
    setup(withRule({ type: 'threshold', value: 90, color: 'red' }));

    const condicao = screen.getByLabelText('Valor da regra 1');
    const animacao = screen.getByLabelText('Animação da regra 1');
    const lixeira = screen.getByRole('button', { name: 'Remover regra' });

    const linha = lixeira.parentElement!;

    expect(linha).toContainElement(condicao);
    expect(linha).toContainElement(animacao);
    // Antes do Bloco 2 a lixeira vivia num `ruleTop` que não continha o rótulo.
    expect(linha).toHaveStyle({ display: 'flex', flexWrap: 'wrap' });
  });
});

/**
 * A animacao e coluna da linha da regra: `[cor] [condicao] [animacao]
 * [lixeira]`. Vale nos dois eixos — em Trigger a linha e a severidade.
 */
describe('ThresholdsEditor — animação por regra', () => {
  const seletor = () => screen.getByLabelText('Animação da regra 1');

  it('regra nasce parada', () => {
    setup(withRule({ type: 'threshold', value: 90, color: 'red' }));

    expect(seletor()).toHaveValue('Parado');
  });

  it('reflete a animação salva na regra', () => {
    setup(withRule({ type: 'threshold', value: 90, color: 'red', animation: 'radar' }));

    expect(seletor()).toHaveValue('Radar');
  });

  /**
   * A escolha em si não é exercitada aqui: o menu do `Combobox` é virtualizado e
   * não renderiza opção nenhuma no jsdom — um teste sobre ele exercitaria a
   * biblioteca, não este código. O que é nosso está coberto nos dois lados: o
   * schema aceita `animation` na regra (`parse.test.ts`) e a resolução escolhe a
   * animação da regra que casou (`alertAnimation.test.ts`).
   */
  it('cada regra tem o seu próprio seletor', () => {
    setup({
      steps: [
        { type: 'threshold', value: 90, color: 'red', animation: 'radar' },
        { type: 'threshold', value: 75, color: 'orange', animation: 'pulse' },
      ],
    });

    expect(screen.getByLabelText('Animação da regra 1')).toHaveValue('Radar');
    expect(screen.getByLabelText('Animação da regra 2')).toHaveValue('Pulsar');
  });

  /** Em Trigger a linha é a severidade, e o seletor é nomeado por ela. */
  it('em modo Trigger a coluna é por severidade', () => {
    setup(withRule({ type: 'severity', atLeast: 4, color: 'red', animation: 'pulse' }), BASE, 'trigger');

    expect(screen.queryByLabelText('Animação da regra 1')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Animação de High')).toHaveValue('Pulsar');
    // `atLeast: 4` também alcança Disaster — a escada mostra o que valeria lá.
    expect(screen.getByLabelText('Animação de Disaster')).toHaveValue('Pulsar');
    expect(screen.getByLabelText('Animação de Average')).toHaveValue('Parado');
  });
});

/**
 * Em modo Trigger a lista deixou de ser montada regra a regra: as seis
 * severidades do Zabbix estao sempre na tela, e o que se edita e a cor de cada
 * uma. O `ColorPicker` abre um popover que o jsdom nao exercita de forma util —
 * a escrita da cor esta coberta em `writeSeverityLadder` (`thresholds.test.ts`).
 * O que se fixa aqui e o que so existe no componente.
 */
describe('ThresholdsEditor — escada de severidades', () => {
  const SEVERIDADES = ['Disaster', 'High', 'Average', 'Warning', 'Information', 'Not classified'];

  it('mostra as seis severidades, da mais grave para a mais branda', () => {
    setup(undefined, BASE, 'trigger');

    const nomes = SEVERIDADES.map((nome) => screen.getByText(nome));
    expect(nomes).toHaveLength(6);
    // A ordem da tela é a ordem de avaliação; um `sort` invertido passaria
    // despercebido sem esta comparação de posição.
    expect(nomes[0].compareDocumentPosition(nomes[5])).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('não oferece adicionar regra: a lista de severidades é fechada', () => {
    setup(undefined, BASE, 'trigger');

    expect(screen.queryByRole('button', { name: /Adicionar regra/ })).not.toBeInTheDocument();
  });

  it('a linha é [atende] [cor] [severidade] [animação], sem campo de rótulo', () => {
    setup(undefined, BASE, 'trigger');

    expect(screen.queryByLabelText('Texto exibido de Disaster')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Animação de Disaster')).toBeInTheDocument();
    expect(screen.getByLabelText('Atender Disaster')).toBeInTheDocument();
  });

  /**
   * Severidade desligada serve para o ruído conhecido — um parque cheio de
   * *Information* que ninguém atende deixaria o mapa inteiro aceso, e mapa
   * sempre aceso não avisa nada. O elemento passa a ficar na Base.
   */
  describe('atender ou não uma severidade', () => {
    const atender = (nome: string) => screen.getByLabelText(`Atender ${nome}`);

    it('todas nascem atendendo', () => {
      setup(undefined, BASE, 'trigger');

      for (const nome of SEVERIDADES) {
        expect(atender(nome)).toBeChecked();
      }
    });

    it('desmarcar grava `enabled: false` só naquele nível', () => {
      const { rules } = setup(undefined, BASE, 'trigger');

      fireEvent.click(atender('Information'));

      const escrita = rules() ?? [];
      expect(escrita.find((rule) => rule.type === 'severity' && rule.atLeast === 1)).toMatchObject({
        enabled: false,
      });
      // O silêncio já significa ligado: gravar `true` nos outros cinco encheria
      // o JSON do dashboard sem dizer nada novo.
      expect(escrita.filter((rule) => 'enabled' in rule)).toHaveLength(1);
    });

    it('o nível desligado reaparece desmarcado ao reabrir', () => {
      // A escada como o editor a grava: os seis níveis materializados. Uma lista
      // esparsa se comportaria diferente — a regra é "a partir de", e `atLeast:
      // 1` desligado alcançaria todos os níveis acima —, e é por isso que
      // `writeSeverityLadder` escreve os seis de uma vez.
      const escada = { steps: writeSeverityLadder(undefined, 1, { enabled: false }, '#888') };
      setup(escada, BASE, 'trigger');

      expect(atender('Information')).not.toBeChecked();
      expect(atender('Disaster')).toBeChecked();
    });

    /** Esmaecida, não escondida: sumir com a linha faria o Zabbix parecer ter cinco níveis. */
    it('a linha desligada continua na escada e continua editável', () => {
      setup({ steps: writeSeverityLadder(undefined, 1, { enabled: false }, '#888') }, BASE, 'trigger');

      expect(screen.getByText('Information')).toBeInTheDocument();
      expect(screen.getByLabelText('Animação de Information')).toBeEnabled();
    });
  });

  /**
   * O "Animação de alerta" do elemento saiu da tela, mas o que ele configurava
   * não pode sumir junto: `Radar a partir de High` reaparece como Radar nas duas
   * linhas que ele alcançava.
   */
  describe('o alerta aposentado do elemento', () => {
    const ALERT: ElementAlert = { animation: 'radar', fromSeverity: 4 };

    it('aparece nas linhas que alcançava, e só nelas', () => {
      setup(undefined, BASE, 'trigger', ALERT);

      expect(screen.getByLabelText('Animação de Disaster')).toHaveValue('Radar');
      expect(screen.getByLabelText('Animação de High')).toHaveValue('Radar');
      expect(screen.getByLabelText('Animação de Average')).toHaveValue('Parado');
    });

    /** Duas fontes de animação, uma invisível, seria o pior dos dois mundos. */
    it('é apagado na primeira escrita da escada', () => {
      const { onAlertChange } = setup(undefined, BASE, 'trigger', ALERT);

      fireEvent.click(screen.getByRole('button', { name: /Restaurar padrão do Zabbix/ }));

      expect(onAlertChange).toHaveBeenCalledWith(undefined);
    });

    it('sem alerta salvo, ninguém mexe no campo', () => {
      const { onAlertChange } = setup(withRule({ type: 'severity', atLeast: 5, color: 'purple' }), BASE, 'trigger');

      fireEvent.click(screen.getByRole('button', { name: /Restaurar padrão do Zabbix/ }));

      expect(onAlertChange).not.toHaveBeenCalled();
    });
  });

  describe('restaurar o padrão do Zabbix', () => {
    const botao = () => screen.queryByRole('button', { name: /Restaurar padrão do Zabbix/ });

    it('só aparece quando há cor customizada — é o desfazer da materialização', () => {
      setup(undefined, BASE, 'trigger');

      expect(botao()).not.toBeInTheDocument();
    });

    it('apaga as regras de severidade e devolve o elemento ao mapa do Zabbix', () => {
      const { onThresholdsChange } = setup(
        withRule({ type: 'severity', atLeast: 5, color: 'purple' }),
        BASE,
        'trigger'
      );

      fireEvent.click(botao()!);

      expect(onThresholdsChange).toHaveBeenCalledWith(undefined);
    });

    it('não leva junto as regras de métrica', () => {
      const metrica: ElementRule = { type: 'threshold', value: 90, color: 'orange' };
      const { rules } = setup({ steps: [metrica, { type: 'severity', atLeast: 5, color: 'purple' }] }, BASE, 'trigger');

      fireEvent.click(botao()!);

      expect(rules()).toEqual([metrica]);
    });
  });
});
