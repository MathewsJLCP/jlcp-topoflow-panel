import { createTheme } from '@grafana/data';

import { ElementColor } from '../data/elementColor';
import { iconTone, toneForColor } from './iconTone';

const theme = createTheme();
const cor = (nome: string) => theme.visualization.getColorByName(nome);

/**
 * A regra que faz um PNG acompanhar o alarme. Errar aqui é do tipo de erro que
 * ninguém percebe: o ícone continua desenhando, só que a cor errada — e cor
 * errada num NOC é informação errada.
 */

describe('toneForColor', () => {
  /**
   * Cada cor nomeada da paleta do Grafana cai no seu tom homônimo. É o que faz
   * o ícone obedecer à regra: a severidade que o usuário deixou laranja produz
   * ícone laranja, e trocar aquela linha para verde vira verde junto.
   */
  it('a paleta do editor de regras cai nos tons de mesmo nome', () => {
    expect(toneForColor(cor('dark-red'), theme)).toBe('red');
    expect(toneForColor(cor('red'), theme)).toBe('red');
    expect(toneForColor(cor('orange'), theme)).toBe('orange');
    expect(toneForColor(cor('semi-dark-orange'), theme)).toBe('orange');
    expect(toneForColor(cor('yellow'), theme)).toBe('yellow');
    expect(toneForColor(cor('green'), theme)).toBe('green');
    expect(toneForColor(cor('dark-green'), theme)).toBe('green');
    expect(toneForColor(cor('blue'), theme)).toBe('blue');
  });

  /**
   * O padrão do Zabbix para *Average* é laranja. Antes ele caía em vermelho por
   * falta de um tom laranja no pack; hoje o ícone acompanha a linha da escada.
   */
  it('Average laranja produz ícone laranja, não vermelho', () => {
    expect(toneForColor('#ff7700', theme)).toBe('orange');
    expect(toneForColor('#FFA059', theme)).toBe('orange');
  });

  it('roxo vai para o vizinho cromático, e magenta para o vermelho', () => {
    expect(toneForColor('#A352CC', theme)).toBe('blue');
    expect(toneForColor('#FF00AA', theme)).toBe('red');
  });

  /** Sem matiz não há o que classificar: qualquer faixa seria sorte. */
  it('cor dessaturada cai em cinza', () => {
    expect(toneForColor('#888888', theme)).toBe('gray');
    expect(toneForColor('#ffffff', theme)).toBe('gray');
    expect(toneForColor('#000000', theme)).toBe('gray');
  });

  /**
   * Regressão: com saturação HSL, `dark-red` (a severidade mais grave) ficaria
   * perto de zero e seria tratado como cinza — o alarme mais sério do painel
   * apagaria o ícone.
   */
  it('vermelho escuro continua vermelho', () => {
    expect(toneForColor('#8B0000', theme)).toBe('red');
  });
});

describe('iconTone', () => {
  const alarme: ElementColor = {
    state: 'trigger',
    color: cor('red'),
    severity: 4,
    label: 'High',
    problems: [{ name: 'ICMP', severity: 4, label: 'High', color: cor('red') }],
  };

  it('em automático, o tom vem da cor do estado', () => {
    expect(iconTone(alarme, undefined, theme)).toBe('red');
    expect(iconTone(alarme, 'state', theme)).toBe('red');
  });

  /**
   * A mesma regra nos dois modos: um elemento pintado por `>= 90` e um pintado
   * por *High* são a mesma urgência para quem olha o painel.
   */
  it('threshold de métrica move o ícone como a trigger move', () => {
    expect(iconTone({ state: 'threshold', color: cor('yellow') }, undefined, theme)).toBe('yellow');
    expect(iconTone({ state: 'threshold', color: cor('dark-red') }, undefined, theme)).toBe('red');
    expect(iconTone({ state: 'threshold', color: cor('orange') }, undefined, theme)).toBe('orange');
    expect(iconTone({ state: 'threshold', color: cor('green') }, undefined, theme)).toBe('green');
  });

  it('a escolha manual vence o estado', () => {
    expect(iconTone(alarme, 'blue', theme)).toBe('blue');
    expect(iconTone(alarme, 'gray', theme)).toBe('gray');
    expect(iconTone(alarme, 'orange', theme)).toBe('orange');
  });

  /**
   * Ausência de dado não pode passar por saudável, e um ícone colorido "por
   * padrão" seria exatamente isso.
   */
  it('sem estado, o ícone fica em repouso', () => {
    expect(iconTone({ state: 'neutral' }, undefined, theme)).toBe('gray');
    expect(iconTone({ state: 'nodata' }, undefined, theme)).toBe('gray');
  });

  /** O acento fixo é identidade visual, e o ícone acompanha. */
  it('acento fixo também define o tom', () => {
    expect(iconTone({ state: 'fixed', color: cor('blue') }, undefined, theme)).toBe('blue');
  });
});
