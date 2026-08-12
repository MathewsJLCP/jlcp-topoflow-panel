import { ElementColor } from '../data/elementColor';
import { ElementAlert, Severity } from '../model/types';
import { alertClass, edgeAlertClass, isAlerting, resolveAlertAnimation } from './alertAnimation';

/**
 * O predicado e o que decide se o elemento se mexe. Errar aqui e silencioso: o
 * painel nao quebra, so deixa de avisar — ou avisa quando nao devia.
 */

const alarme = (severity: Severity): ElementColor => ({
  state: 'trigger',
  color: '#f00',
  severity,
  label: 'qualquer',
});

const alerta = (fromSeverity: Severity): ElementAlert => ({ animation: 'pulse', fromSeverity });

describe('isAlerting', () => {
  it('sem configuração de alerta, nada se mexe', () => {
    expect(isAlerting(alarme(5), undefined)).toBe(false);
  });

  it('alarme na severidade configurada anima', () => {
    expect(isAlerting(alarme(4), alerta(4))).toBe(true);
  });

  it('alarme acima da severidade configurada anima', () => {
    expect(isAlerting(alarme(5), alerta(4))).toBe(true);
  });

  it('alarme mais brando que o configurado não anima', () => {
    expect(isAlerting(alarme(2), alerta(4))).toBe(false);
  });

  it('`fromSeverity: 0` anima qualquer alarme', () => {
    expect(isAlerting(alarme(0), alerta(0))).toBe(true);
    expect(isAlerting(alarme(5), alerta(0))).toBe(true);
  });

  it('estado sem alarme não anima, mesmo com alerta configurado', () => {
    const outros: ElementColor[] = [
      { state: 'fixed', color: '#00f' },
      { state: 'nodata' },
      { state: 'neutral' },
    ];

    for (const accent of outros) {
      expect(isAlerting(accent, alerta(0))).toBe(false);
    }
  });
});

/**
 * No eixo de métrica quem carrega a animação é a **regra que casou**, e não o
 * elemento. É o que permite `>= 75` pulsar e `> 90` fazer radar no mesmo campo —
 * e o que responde à pergunta que travava a extensão para métrica: nem toda
 * regra é problema, e quem separa as que são é o usuário.
 */
describe('animação vinda da regra de métrica', () => {
  it('regra sem animação não mexe nada — é o default', () => {
    expect(resolveAlertAnimation({ state: 'threshold', color: '#f00' }, undefined)).toBeUndefined();
  });

  it('a animação da regra é a que roda', () => {
    expect(resolveAlertAnimation({ state: 'threshold', color: '#f00', animation: 'radar' }, undefined)).toBe('radar');
  });

  /** O pipeline nativo do Grafana não tem o campo, então nunca anima. */
  it('cor vinda do field, sem regra própria, fica parada', () => {
    expect(isAlerting({ state: 'threshold', color: '#0f0' }, undefined)).toBe(false);
  });

  /**
   * O `alert` do elemento é do eixo de trigger. Ele não pode vazar para uma cor
   * resolvida por métrica, senão toda regra passaria a animar de uma vez.
   */
  it('o alerta do elemento não vale para o eixo de métrica', () => {
    expect(resolveAlertAnimation({ state: 'threshold', color: '#f00' }, alerta(0))).toBeUndefined();
  });
});

describe('alertClass', () => {
  it('devolve classe só quando o elemento está alarmando', () => {
    expect(alertClass(alarme(5), alerta(0))).toBeTruthy();
    expect(alertClass(alarme(5), undefined)).toBeUndefined();
    expect(alertClass({ state: 'neutral' }, alerta(0))).toBeUndefined();
  });

  it('cada animação produz uma classe diferente', () => {
    const pulse = alertClass(alarme(5), { animation: 'pulse', fromSeverity: 0 });
    const blink = alertClass(alarme(5), { animation: 'blink', fromSeverity: 0 });
    const radar = alertClass(alarme(5), { animation: 'radar', fromSeverity: 0 });

    expect(new Set([pulse, blink, radar]).size).toBe(3);
  });
});

describe('edgeAlertClass', () => {
  it('sem accent não há alarme a anunciar', () => {
    expect(edgeAlertClass(undefined, alerta(0))).toBeUndefined();
  });

  /**
   * A aresta não escala nem recebe anel; `radar` cai na respiração do traço. O
   * editor não oferece a combinação, mas uma topologia salva pode trazê-la.
   */
  it('radar numa aresta cai na mesma classe de pulse', () => {
    const pulse = edgeAlertClass(alarme(5), { animation: 'pulse', fromSeverity: 0 });
    const radar = edgeAlertClass(alarme(5), { animation: 'radar', fromSeverity: 0 });

    expect(radar).toBe(pulse);
  });
});
