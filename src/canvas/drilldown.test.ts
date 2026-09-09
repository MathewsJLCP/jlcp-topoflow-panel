import { locationService } from '@grafana/runtime';

import {
  drilldownHref,
  hasDrilldown,
  hasScheme,
  isInternal,
  navigateInApp,
  shouldNavigateInApp,
  withScheme,
} from './drilldown';

/**
 * O drill-down e um `<a>` de verdade (ver `DrilldownSurface`), entao a maior
 * parte do comportamento e do browser e nao esta aqui. O que este modulo decide
 * — e o que estes testes cobrem — sao as duas perguntas que o `<a>` sozinho nao
 * responde: qual endereco, e quem navega.
 */

/** Um clique comum de botao esquerdo, sem modificador nenhum. */
const CLIQUE = { ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, button: 0 };

describe('drilldownHref', () => {
  it('sem link não há para onde ir', () => {
    expect(drilldownHref(undefined)).toBeUndefined();
    expect(drilldownHref({ url: '' })).toBeUndefined();
    // Só espaço é o que sobra de um campo esvaziado a mão. Um `<a href="">`
    // recarregaria a página atual, que é pior do que não haver link.
    expect(drilldownHref({ url: '   ' })).toBeUndefined();
  });

  it('devolve o endereço digitado, sem as bordas', () => {
    expect(drilldownHref({ url: '  /d/uid/detalhe  ' })).toBe('/d/uid/detalhe');
  });

  /**
   * O bug que o drill-down para outra plataforma tinha: `www.google.com` num
   * `href` e um **caminho relativo**, resolvido contra a pagina atual. Num
   * dashboard isso virava `/d/uid/www.google.com` e o clique caia num 404 do
   * Grafana em vez de sair para o Google.
   */
  it('completa o esquema de um endereço externo escrito sem ele', () => {
    expect(drilldownHref({ url: 'www.google.com' })).toBe('https://www.google.com');
    expect(drilldownHref({ url: 'zabbix.corp/tr_events.php?triggerid=1' })).toBe(
      'https://zabbix.corp/tr_events.php?triggerid=1'
    );
  });

  /**
   * Fora do Grafana nao existe `TemplateSrv`, e o tipo do `getTemplateSrv()`
   * promete um objeto que nao esta la. Sem o guard, todo elemento com link
   * derrubaria o painel no primeiro render — e um link quebrado nao pode custar
   * a topologia inteira.
   */
  it('sobrevive à ausência do serviço de variáveis', () => {
    expect(drilldownHref({ url: '/d/uid/host?var-host=$host' })).toBe('/d/uid/host?var-host=$host');
  });
});

describe('hasDrilldown', () => {
  it('responde pela configuração, não pelo endereço resolvido', () => {
    expect(hasDrilldown(undefined)).toBe(false);
    expect(hasDrilldown({ url: '' })).toBe(false);
    expect(hasDrilldown({ url: '/d/uid' })).toBe(true);
  });
});

describe('isInternal', () => {
  it('caminho absoluto é deste Grafana', () => {
    expect(isInternal('/d/uid/detalhe')).toBe(true);
    expect(isInternal('/')).toBe(true);
  });

  /** `//host/x` tem barra inicial e mesmo assim sai da instalação. */
  it('protocol-relative não é interno, apesar da barra', () => {
    expect(isInternal('//exemplo.com/d/uid')).toBe(false);
  });

  it('qualquer coisa com esquema é externa', () => {
    expect(isInternal('https://exemplo.com')).toBe(false);
    expect(isInternal('mailto:noc@exemplo.com')).toBe(false);
  });
});

describe('shouldNavigateInApp', () => {
  it('caminho interno em clique comum: navegamos nós, sem recarregar a página', () => {
    expect(shouldNavigateInApp('/d/uid/detalhe', false, CLIQUE)).toBe(true);
  });

  it('endereço externo é sempre do browser', () => {
    expect(shouldNavigateInApp('https://exemplo.com', false, CLIQUE)).toBe(false);
  });

  it('com nova aba quem abre é o `target`, não nós', () => {
    expect(shouldNavigateInApp('/d/uid/detalhe', true, CLIQUE)).toBe(false);
  });

  /**
   * O defeito classico de quem troca um `<a>` por um `onClick`: o operador pede
   * uma aba nova e recebe a navegacao na aba atual, perdendo o mapa de vista.
   */
  it.each([
    ['ctrl', { ctrlKey: true }],
    ['cmd', { metaKey: true }],
    ['shift', { shiftKey: true }],
    ['alt', { altKey: true }],
    ['botão do meio', { button: 1 }],
  ])('não intercepta o gesto de abrir noutro lugar (%s)', (_nome, modificador) => {
    expect(shouldNavigateInApp('/d/uid/detalhe', false, { ...CLIQUE, ...modificador })).toBe(false);
  });
});

describe('navigateInApp', () => {
  it('navega dentro do app, sem recarregar', () => {
    const push = jest.spyOn(locationService, 'push').mockImplementation(() => {});

    navigateInApp('/d/uid/detalhe?var-host=srv01');

    expect(push).toHaveBeenCalledWith('/d/uid/detalhe?var-host=srv01');
    push.mockRestore();
  });
});

describe('withScheme', () => {
  it('não toca em quem já declarou o protocolo', () => {
    expect(withScheme('https://exemplo.com')).toBe('https://exemplo.com');
    // `http` explícito é escolha, não esquecimento: ferramenta interna sem TLS
    // continua abrindo em http.
    expect(withScheme('http://10.0.0.5/zabbix')).toBe('http://10.0.0.5/zabbix');
    expect(withScheme('mailto:noc@exemplo.com')).toBe('mailto:noc@exemplo.com');
  });

  it('não toca em caminho interno', () => {
    expect(withScheme('/d/uid/detalhe')).toBe('/d/uid/detalhe');
  });

  /**
   * Metade das ferramentas de um NOC vive em `IP:porta`. Sem separar esquema de
   * porta, `10.0.0.5:8080` passaria por endereco com esquema `10.0.0.5` e
   * continuaria quebrado depois da correcao.
   */
  it('reconhece host com porta como endereço, e não como esquema', () => {
    expect(withScheme('10.0.0.5:8080/zabbix')).toBe('https://10.0.0.5:8080/zabbix');
    expect(withScheme('localhost:3000/painel')).toBe('https://localhost:3000/painel');
  });
});

describe('hasScheme', () => {
  it('separa protocolo de porta', () => {
    expect(hasScheme('https://x')).toBe(true);
    expect(hasScheme('mailto:a@b')).toBe(true);
    expect(hasScheme('10.0.0.5:8080')).toBe(false);
    expect(hasScheme('www.google.com')).toBe(false);
  });
});
