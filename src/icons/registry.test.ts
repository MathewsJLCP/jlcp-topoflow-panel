import { DEFAULT_ICON_REF, ICON_PACKS, iconRef, isKnownIcon, listIcons, resolveIcon, splitRef } from './index';

/**
 * O registry e o unico lugar que traduz a chave salva em arte. Errar aqui e
 * silencioso da pior forma: o no nao quebra, so passa a mostrar outro desenho.
 */

describe('splitRef', () => {
  it('separa pack e nome', () => {
    expect(splitRef('zabbix/server')).toEqual(['zabbix', 'server']);
  });

  /** Chave sem pack e o formato de tudo que foi salvo antes de existirem pastas. */
  it('chave sem pack pertence aos clássicos', () => {
    expect(splitRef('router')).toEqual(['classic', 'router']);
    expect(splitRef(undefined)).toEqual(['classic', '']);
  });

  /** Nome com barra (um caminho de arquivo, num pack de assets) fica inteiro. */
  it('divide só na primeira barra', () => {
    expect(splitRef('zabbix/rede/switch')).toEqual(['zabbix', 'rede/switch']);
  });
});

describe('resolveIcon', () => {
  it('aceita a chave curta que já está salva nos dashboards', () => {
    expect(resolveIcon('firewall').ref).toBe('classic/firewall');
    expect(resolveIcon('load-balancer').ref).toBe('classic/load-balancer');
  });

  it('aceita a chave canônica, com pack', () => {
    expect(resolveIcon('classic/router').name).toBe('router');
    expect(resolveIcon('classic/router').packLabel).toBe('Clássicos');
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
    expect(iconRef('classic', 'router')).toBe('classic/router');
  });
});

describe('pack Petrolífera', () => {
  it('resolve pela chave com pack', () => {
    const sonda = resolveIcon('petrolifera/sonda');

    expect(sonda.name).toBe('sonda');
    expect(sonda.packLabel).toBe('Petrolífera');
  });

  /**
   * Sao fotos e ilustracoes de produto: nao ha a mesma arte em varios tons. E a
   * natureza que a interface consulta — o `DeviceNode` so poe a placa opaca sob
   * uma figura, e o campo "Cor do ícone" so aparece para quem tem variantes.
   */
  it('todo ícone do pack é figura, não variante', () => {
    const pack = ICON_PACKS.find((p) => p.id === 'petrolifera')!;

    for (const icon of pack.icons) {
      expect(icon.art.kind).toBe('image');
    }
  });
});

describe('pack Zabbix', () => {
  it('resolve pela chave com pack', () => {
    const router = resolveIcon('zabbix/router');

    expect(router.name).toBe('router');
    expect(router.packLabel).toBe('Zabbix');
  });

  /**
   * O pack tem `router`, `firewall` e `server`, que os *Clássicos* tambem tem.
   * Sao icones diferentes, e so o pack na chave os separa — se `splitRef` um dia
   * deixar de separar, este teste cai antes de um dashboard mostrar o desenho
   * errado calado.
   */
  it('não se confunde com o ícone homônimo dos Clássicos', () => {
    expect(resolveIcon('zabbix/router').pack).toBe('zabbix');
    expect(resolveIcon('classic/router').pack).toBe('classic');
    expect(resolveIcon('router').pack).toBe('classic');
  });

  /** Sao renderizacoes 3D com cor propria: nao ha a mesma arte em seis tons. */
  it('todo ícone do pack é figura, não variante', () => {
    const pack = ICON_PACKS.find((p) => p.id === 'zabbix')!;

    for (const icon of pack.icons) {
      expect(icon.art.kind).toBe('image');
    }
  });

  /**
   * O conjunto do Zabbix entrou inteiro (43 arquivos), por decisão do usuário em
   * 2026-09-10, mais o `ap` — a foto do UniFi que o conjunto original não tem e
   * que o usuário pediu no mesmo dia. Daí 44, e não 43.
   */
  it('traz os 43 ícones do conjunto original mais o AP', () => {
    const pack = ICON_PACKS.find((p) => p.id === 'zabbix')!;

    expect(pack.icons).toHaveLength(44);
    expect(pack.icons.filter((icon) => icon.name === 'ap')).toHaveLength(1);
  });
});
