import {
  DEFAULT_ICON_REF,
  ICON_PACKS,
  STARTER_ICON_REF,
  iconRef,
  isKnownIcon,
  listIcons,
  resolveIcon,
  splitRef,
} from './index';
import { LEGACY } from './registry';

/**
 * O registry e o unico lugar que traduz a chave salva em arte. Errar aqui e
 * silencioso da pior forma: o no nao quebra, so passa a mostrar outro desenho.
 */

describe('splitRef', () => {
  it('separa pack e nome', () => {
    expect(splitRef('zabbix/server')).toEqual(['zabbix', 'server']);
  });

  /** Chave sem pack e o formato de tudo que foi salvo antes de existirem pastas. */
  it('chave sem pack pertence aos clássicos (que saíram — ver LEGACY)', () => {
    expect(splitRef('router')).toEqual(['classic', 'router']);
    expect(splitRef(undefined)).toEqual(['classic', '']);
  });

  /** Nome com barra (um caminho de arquivo, num pack de assets) fica inteiro. */
  it('divide só na primeira barra', () => {
    expect(splitRef('zabbix/rede/switch')).toEqual(['zabbix', 'rede/switch']);
  });
});

describe('resolveIcon', () => {
  /** Os Clássicos saíram na v1.4: a chave curta resolve no desenho equivalente. */
  it('aceita a chave curta que já está salva nos dashboards', () => {
    expect(resolveIcon('firewall').ref).toBe('padrao/firewall');
    expect(resolveIcon('load-balancer').ref).toBe('planos/load-balancer');
    expect(resolveIcon('generic').ref).toBe(DEFAULT_ICON_REF);
  });

  it('aceita a chave canônica, com pack', () => {
    expect(resolveIcon('padrao/roteador').name).toBe('roteador');
    expect(resolveIcon('padrao/roteador').packLabel).toBe('Padrão');
    expect(resolveIcon('classic/router').ref).toBe('padrao/roteador');
  });

  /**
   * O schema guarda a chave como string livre justamente para tolerar isto: um
   * icone removido, um pack que saiu ou um JSON editado a mao nao podem fazer o
   * no sumir da topologia.
   */
  it('cai no genérico para chave desconhecida, vazia ou ausente', () => {
    expect(resolveIcon('nao-existe').ref).toBe(DEFAULT_ICON_REF);
    expect(resolveIcon('').ref).toBe(DEFAULT_ICON_REF);
    expect(resolveIcon(undefined).ref).toBe(DEFAULT_ICON_REF);
  });

  /** Regressão: as chaves antigas vinham do `@grafana/ui`, que não tem ativos de rede. */
  it('um ícone do Grafana salvo antes da biblioteca própria não quebra o nó', () => {
    expect(resolveIcon('sitemap').ref).toBe(DEFAULT_ICON_REF);
  });

  /**
   * Um pack que ainda não existe (ou que saiu do plugin) não pode explodir.
   *
   * O exemplo aqui era `zabbix/server` até o pack Zabbix entrar de fato, em
   * 2026-09-10 — o fixture de "pack que não existe" tem de ser um id que nunca
   * vai virar pack de verdade, senão o teste passa a afirmar o contrário do que
   * o nome dele diz no dia em que alguém adicionar aquele pack.
   */
  it('pack desconhecido cai no genérico', () => {
    expect(resolveIcon('pack-inexistente/server').ref).toBe(DEFAULT_ICON_REF);
  });

  it('o próprio fallback resolve', () => {
    expect(resolveIcon(DEFAULT_ICON_REF).ref).toBe(DEFAULT_ICON_REF);
  });
});

describe('isKnownIcon', () => {
  it('separa o que existe do que só parece existir', () => {
    expect(isKnownIcon('server')).toBe(true);
    expect(isKnownIcon('classic/server')).toBe(true);
    expect(isKnownIcon('infra/servidor')).toBe(true);
    expect(isKnownIcon('sitemap')).toBe(false);
    expect(isKnownIcon('pack-inexistente/server')).toBe(false);
    expect(isKnownIcon('zabbix/server')).toBe(true);
    expect(isKnownIcon(undefined)).toBe(false);
  });
});

describe('catálogo', () => {
  it('toda chave é única entre os packs', () => {
    const refs = listIcons().map((icon) => icon.ref);

    expect(new Set(refs).size).toBe(refs.length);
  });

  it('todo ícone listado resolve de volta para ele mesmo', () => {
    for (const icon of listIcons()) {
      expect(resolveIcon(icon.ref).ref).toBe(icon.ref);
      expect(icon.label.length).toBeGreaterThan(0);
    }
  });

  it('o genérico está no catálogo — é o fallback de todos', () => {
    expect(listIcons().some((icon) => icon.ref === DEFAULT_ICON_REF)).toBe(true);
  });

  /** O `id` do pack entra na chave salva: renomeá-lo quebraria topologias. */
  it('os packs têm id e rótulo', () => {
    for (const pack of ICON_PACKS) {
      expect(pack.id).toMatch(/^[a-z0-9-]+$/);
      expect(pack.label.length).toBeGreaterThan(0);
      expect(pack.icons.length).toBeGreaterThan(0);
    }
  });

  it('iconRef monta a chave canônica', () => {
    expect(iconRef('padrao', 'roteador')).toBe('padrao/roteador');
  });
});

describe('catálogo do mockup (v1.4)', () => {
  /** As pastas e as contagens do mockup — sai um desenho, cai o teste. */
  it('traz os packs do mockup, na ordem dele', () => {
    expect(ICON_PACKS.map((pack) => [pack.id, pack.icons.length])).toEqual([
      ['padrao', 28],
      ['infra', 43],
      ['petro', 9],
      ['formas', 15],
      ['planos', 164],
    ]);
  });

  it('todo ícone é svg tingível', () => {
    for (const icon of listIcons()) {
      expect(icon.art.kind).toBe('svg');
    }
  });

  /** Nó novo nasce com o Roteador do pack Padrão, como no mockup. */
  it('o ícone inicial é o Roteador do Padrão', () => {
    expect(STARTER_ICON_REF).toBe('padrao/roteador');
  });
});

describe('chaves anteriores à v1.4', () => {
  /**
   * Um destino que não existe cairia no genérico em silêncio — o dashboard
   * abriria com um quadrado onde havia um rack.
   */
  it('todo destino da tabela existe no catálogo', () => {
    for (const [antiga, nova] of Object.entries(LEGACY)) {
      expect([antiga, resolveIcon(antiga).ref]).toEqual([antiga, nova]);
    }
  });

  it('os packs em PNG resolvem para o desenho equivalente', () => {
    expect(resolveIcon('topoflow/router').ref).toBe('padrao/roteador');
    expect(resolveIcon('zabbix/rack-42-with-door').ref).toBe('infra/rack-42u-porta');
    expect(resolveIcon('petrolifera/unifi-ac-mesh').ref).toBe('petro/unifi');
    expect(isKnownIcon('topoflow/world')).toBe(true);
  });

  /** O pack Zabbix virou Infra: `zabbix/<nome>` sem entrada na tabela vai para `infra/<nome>`. */
  it('chave do Zabbix resolve no Infra', () => {
    expect(resolveIcon('zabbix/switch').ref).toBe('infra/switch');
    expect(resolveIcon('zabbix/notebook').ref).toBe('infra/notebook');
    expect(resolveIcon('zabbix/switch').packLabel).toBe('Infra');
  });
});
