/*
  eslint-disable @typescript-eslint/no-deprecated --
  `getDataSourceSrv` e seus metodos estao marcados como deprecados em favor de
  `@grafana/runtime/unstable` e `/internal`. Aquele modulo abre dizendo, em
  letras maiusculas, que **nao deve ser usado em plugins da comunidade**: a
  depreciacao aponta para uma porta fechada. Enquanto o substituto nao for
  publico, esta e a via publica — e o dia em que o singleton sumir, o typecheck
  avisa, porque a exportacao deixa de existir.
*/
import { DataSourceApi, DataSourceInstanceSettings } from '@grafana/data';
import { getDataSourceSrv, getTemplateSrv } from '@grafana/runtime';

/**
 * Leitura da API do Zabbix a partir do painel, para o autocomplete do editor.
 *
 * O datasource Zabbix publica a API do Zabbix como **resource endpoint** do
 * proprio Grafana:
 *
 *     POST /api/datasources/uid/<uid>/resources/zabbix-api   { method, params }
 *
 * E o mesmo caminho que o Query Editor dele usa para preencher os combos de
 * grupo/host/item. Do nosso lado o acesso e publico: `getDataSourceSrv().get()`
 * devolve a instancia e `DataSourceWithBackend.postResource` fala com o
 * endpoint. **Credencial nenhuma passa por aqui** — token, usuario e senha ficam
 * no backend do datasource Zabbix, e a permissao exigida e a mesma que o usuario
 * ja precisa ter para consultar aquele datasource.
 *
 * A alternativa seria chamar `ds.zabbix.getAllHosts(...)`, o objeto interno do
 * plugin do Zabbix, que traz cache e tratamento de versao de graca. Foi
 * descartada: e o formato interno de um plugin de terceiros, sem contrato nenhum
 * com a gente. O que este modulo depende e do endpoint de recurso (contrato
 * publico do datasource) e dos nomes de metodo da API do Zabbix, que o proprio
 * Zabbix versiona.
 *
 * Este modulo nao conhece React nem `DataFrame`: quem junta o que vem daqui com
 * o que vem dos frames e `editors/zabbixSource.tsx`.
 */

/** `type` do datasource Zabbix. E a chave que o `DataSourcePicker` filtra. */
export const ZABBIX_DS_TYPE = 'alexanderzobnin-zabbix-datasource';

/** Caminho do recurso, relativo a `/api/datasources/uid/<uid>/resources/`. */
const RESOURCE_PATH = 'zabbix-api';

/**
 * Quanto tempo uma resposta vale. Curto de proposito: o catalogo do Zabbix muda
 * quando alguem cadastra um host, e 30s e o bastante para uma sessao de
 * digitacao inteira nao repetir a mesma pergunta.
 */
const CACHE_TTL_MS = 30_000;

/** Teto de resultados. O combo nao e lugar de rolar mil linhas. */
const LIMIT = 300;

export interface ZabbixHost {
  hostid: string;
  /** Nome visivel. E o que `matchesHost` compara com `hosts[].name`. */
  name: string;
  /** Nome tecnico. `matchesHost` tambem aceita este. */
  host?: string;
}

export interface ZabbixTriggerOption {
  triggerid: string;
  /** Descricao ja expandida (`expandDescription`) — o que aparece no problema. */
  description: string;
  /** Severidade Zabbix como string, `'0'` a `'5'`. */
  priority?: string;
}

export interface ZabbixItemOption {
  itemid: string;
  /** Nome ja expandido — ver `expandItemName`. */
  name: string;
  key_?: string;
  units?: string;
}

interface CacheEntry {
  at: number;
  value: Promise<unknown>;
}

const cache = new Map<string, CacheEntry>();

/** Esvazia o cache. Existe para os testes: nada no produto precisa disso. */
export function clearZabbixCache(): void {
  cache.clear();
}

/**
 * Qual datasource Zabbix este painel consulta. `undefined` significa "nenhum" —
 * e o editor volta a listar so o que esta nos frames.
 *
 * Duas vias, nessa ordem:
 *
 *   1. o uid escolhido no painel (`options.zabbix.datasource`), interpolado para
 *      aceitar variavel de datasource (`${zbx}`);
 *   2. **nenhum escolhido e existe exatamente um Zabbix na instancia** — o caso
 *      da esmagadora maioria dos ambientes, em que perguntar seria burocracia.
 *
 * Com dois ou mais Zabbix e nenhum escolhido nao ha adivinhacao: o editor pede a
 * escolha. Chutar o primeiro faria o combo listar hosts de outro ambiente, que e
 * pior que nao listar nada.
 *
 * Nao ha uma terceira via "detectar pelo target da query do painel" apesar de o
 * dado existir (`data.request.targets[].datasource`): ele so existe do lado do
 * **painel**, e o editor de opcoes recebe frames, nao a request. Levar o uid de
 * la ate aqui exigiria publicar no `instanceState`, que hoje pertence a selecao
 * do canvas — duas fontes escrevendo no mesmo canal e bug garantido.
 */
export function resolveZabbixUid(configured?: string): string | undefined {
  try {
    const srv = getDataSourceSrv();
    const wanted = configured ? getTemplateSrv().replace(configured).trim() : '';

    if (wanted) {
      const settings = srv.getInstanceSettings(wanted);
      return settings?.type === ZABBIX_DS_TYPE ? settings.uid : undefined;
    }

    return unicoZabbix()?.uid;
  } catch {
    // Fora de um Grafana (teste, storybook) os servicos nem existem. Sem
    // catalogo, e nao com o editor quebrado.
    return undefined;
  }
}

/**
 * Datasources Zabbix da instancia. **Nao use `getList({ type })` para isto.**
 *
 * `getList` filtra por tipo e, depois de filtrar, **acrescenta `-- Grafana --`
 * ao resultado** — o `push` acontece fora do filtro, e `sorted` e o mesmo array
 * que `base` (o `.sort` ordena no lugar). Ou seja: numa instancia sem nenhum
 * Zabbix, `getList({ type: ZABBIX_DS_TYPE })` volta com pelo menos um item.
 *
 * O estrago disso aqui seria silencioso e grave: a via "existe exatamente um
 * Zabbix, adote-o" acharia esse um, e todo `host.get` iria parar no datasource
 * embutido do Grafana. Foi o e2e no browser que mostrou o sintoma — o campo
 * anunciando "ha mais de um Zabbix nesta instancia" num Grafana que nao tem
 * nenhum.
 *
 * `pluginId` corrige os dois lados: filtra pelo id do plugin **e** e a condicao
 * que faz o `getList` pular o bloco que acrescenta os embutidos. O filtro por
 * `type` fica como cinto e suspensorio.
 */
export function listZabbixDatasources(): DataSourceInstanceSettings[] {
  try {
    return getDataSourceSrv()
      .getList({ pluginId: ZABBIX_DS_TYPE })
      .filter((ds) => ds.type === ZABBIX_DS_TYPE);
  } catch {
    return [];
  }
}

function unicoZabbix(): DataSourceInstanceSettings | undefined {
  const found = listZabbixDatasources();
  return found.length === 1 ? found[0] : undefined;
}

/**
 * Uma chamada JSON-RPC, com cache por (uid, metodo, params).
 *
 * O cache guarda a **promise**, e nao o valor: duas linhas do formulario pedindo
 * a mesma lista ao mesmo tempo viram uma requisicao so. Erro nao fica cacheado —
 * a proxima digitacao tenta de novo, que e o que o usuario espera depois de o
 * Zabbix voltar.
 */
async function request<T>(uid: string, method: string, params: unknown): Promise<T> {
  const key = `${uid}|${method}|${JSON.stringify(params)}`;
  const hit = cache.get(key);

  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return hit.value as Promise<T>;
  }

  const value = call<T>(uid, method, params);
  value.catch(() => cache.delete(key));
  cache.set(key, { at: Date.now(), value });

  return value;
}

async function call<T>(uid: string, method: string, params: unknown): Promise<T> {
  const ds = await getDataSourceSrv().get(uid);
  const post = (ds as DataSourceApi & { postResource?: unknown }).postResource;

  /*
    Duck typing em vez de `instanceof DataSourceWithBackend`: um datasource sem
    backend (ou uma versao do plugin do Zabbix que mude de base) nao pode
    derrubar o editor com um TypeError vindo de dentro do combo.
  */
  if (typeof post !== 'function') {
    throw new Error('O datasource selecionado nao expoe a API do Zabbix.');
  }

  const body = await (post as (path: string, data: unknown) => Promise<unknown>).call(ds, RESOURCE_PATH, {
    method,
    params,
  });

  return unwrap<T>(body);
}

/**
 * O endpoint devolve o **envelope** JSON-RPC — `{ result: [...] }` —, e nao o
 * resultado direto.
 *
 * Custou uma rodada de teste no browser: `postResource` ja desembrulha a
 * resposta HTTP, entao era facil supor que o que chega e a lista. Nao e, e o
 * sintoma foi um `r.map is not a function` dentro do combo. O jsdom nunca diria:
 * quem escreve o mock escreve a suposicao errada junto.
 *
 * O `error` do envelope tambem e tratado aqui. Nem toda falha do Zabbix vira
 * HTTP nao-2xx, e sem isto uma mensagem de erro perfeitamente legivel ("No
 * permissions to referred object") chegaria ao usuario como `undefined` sem
 * `.map`.
 */
function unwrap<T>(body: unknown): T {
  if (body && typeof body === 'object') {
    const envelope = body as { result?: unknown; error?: { message?: string; data?: string } };

    if (envelope.error) {
      const { message, data } = envelope.error;
      throw new Error([message, data].filter(Boolean).join(' ') || 'Erro na API do Zabbix.');
    }

    if ('result' in envelope) {
      return envelope.result as T;
    }
  }

  return body as T;
}

/**
 * Hosts que casam com o termo digitado, por nome visivel **ou** nome tecnico.
 *
 * Os dois porque `matchesHost` tambem aceita os dois: o combo lista o que o
 * operador ve, mas quem digita costuma digitar o nome tecnico.
 *
 * Termo vazio devolve os primeiros `LIMIT` hosts em ordem — e o que o combo
 * mostra ao abrir, antes de qualquer digitacao.
 */
export async function searchHosts(uid: string, term: string): Promise<ZabbixHost[]> {
  const busca = term.trim();

  return request<ZabbixHost[]>(uid, 'host.get', {
    output: ['hostid', 'name', 'host'],
    sortfield: 'name',
    limit: LIMIT,
    ...(busca ? { search: { name: busca, host: busca }, searchByAny: true } : {}),
  });
}

/**
 * `hostid` do host escolhido no vinculo, que guarda **nome** e nao id.
 *
 * `trigger.get` e `item.get` filtram por `hostids`, entao toda listagem paga
 * este `host.get` antes — cacheado, e por isso barato depois da primeira vez.
 * E a razao economica de o bloco 4 passar a salvar o `hostId` no vinculo.
 *
 * `searchByAny` faz o `filter` casar nome visivel **ou** tecnico; sem ele os
 * dois campos seriam exigidos juntos e nada casaria.
 */
async function hostId(uid: string, host: string): Promise<string | undefined> {
  const nome = host.trim();

  if (!nome) {
    return undefined;
  }

  const found = await request<ZabbixHost[]>(uid, 'host.get', {
    output: ['hostid', 'name', 'host'],
    filter: { name: [nome], host: [nome] },
    searchByAny: true,
    limit: 1,
  });

  return found[0]?.hostid;
}

/**
 * Nomes **visiveis** dos hosts, a partir do que o vinculo guardou.
 *
 * O vinculo aceita nome visivel ou tecnico (`matchesHost` compara com os dois),
 * mas o filtro de host do datasource so testa a regex contra o nome **visivel**
 * (`filterByRegex`, sobre `zbx_obj.name`). Sem esta traducao, um elemento
 * vinculado por nome tecnico — `sysConcilia` no lugar de
 * `AGLIN-SRV-CONCILIACAO` — nunca entraria na query que o painel monta, e o
 * elemento ficaria eternamente apagado sem nada explicando.
 *
 * Uma chamada so para a lista inteira: `searchByAny` faz o `filter` casar
 * qualquer um dos dois campos, em qualquer dos hosts pedidos.
 *
 * Host que nao existe no Zabbix simplesmente nao volta — e nao ha o que buscar
 * por ele mesmo.
 */
export async function resolveHostNames(uid: string, hosts: string[]): Promise<Map<string, string>> {
  const nomes = hosts.map((host) => host.trim()).filter(Boolean);
  const mapa = new Map<string, string>();

  if (nomes.length === 0) {
    return mapa;
  }

  const found = await request<ZabbixHost[]>(uid, 'host.get', {
    output: ['hostid', 'name', 'host'],
    filter: { name: nomes, host: nomes },
    searchByAny: true,
    limit: LIMIT,
  });

  /*
    Devolve um **mapa**, e nao uma lista, porque quem chama precisa saber de qual
    nome salvo veio cada nome visivel: e assim que a serie de metrica recebe
    depois o nome que o elemento vai procurar. Ambas as grafias entram como
    chave, ja que o vinculo pode ter guardado qualquer uma das duas.
  */
  for (const host of found) {
    if (!host.name) {
      continue;
    }

    mapa.set(host.name, host.name);

    if (host.host) {
      mapa.set(host.host, host.name);
    }
  }

  return mapa;
}

/**
 * Triggers do host.
 *
 * `expandDescription` e o que faz o nome bater com o do problema que chega no
 * frame: sem ele a descricao vem com as macros cruas (`{HOST.NAME}`) e o vinculo
 * salvo nunca casaria. `monitored` deixa de fora host e item desabilitados, que
 * nunca vao alarmar.
 *
 * Host desconhecido devolve lista vazia, e nao erro: quem digitou um nome que
 * ainda nao existe no Zabbix precisa continuar podendo digitar a trigger.
 */
export async function listTriggers(uid: string, host: string): Promise<ZabbixTriggerOption[]> {
  const id = await hostId(uid, host);

  if (!id) {
    return [];
  }

  return request<ZabbixTriggerOption[]>(uid, 'trigger.get', {
    hostids: [id],
    output: ['triggerid', 'description', 'priority'],
    expandDescription: true,
    monitored: true,
    sortfield: 'description',
    limit: LIMIT,
  });
}

/**
 * Itens do host: numericos (`value_type` 0 float, 3 unsigned) **e de texto** (1
 * caractere, 2 log, 4 texto).
 *
 * Ate a v1.4 o combo so trazia numerico, porque a query do painel so buscava o
 * modo Metrics. Ela passou a buscar tambem o modo Text (ver `metricTargets`), e
 * um item de texto — status, versao, serial — e exibivel em "Exibir valor", em
 * `${...}` de rotulo e avaliavel pelas regras de Valor e Regex. Fica de fora so
 * o binario (5), que nao vira texto nenhum.
 */
export async function listItems(uid: string, host: string): Promise<ZabbixItemOption[]> {
  const id = await hostId(uid, host);

  if (!id) {
    return [];
  }

  const items = await request<ZabbixItemOption[]>(uid, 'item.get', {
    hostids: [id],
    output: ['itemid', 'name', 'key_', 'units'],
    webitems: true,
    filter: { value_type: [0, 1, 2, 3, 4] },
    sortfield: 'name',
    limit: LIMIT,
  });

  return items.map((item) => ({ ...item, name: expandItemName(item.name, item.key_ ?? '') }));
}

/**
 * Substitui os posicionais `$1..$9` do nome do item pelos parametros da chave —
 * `"CPU $2 time"` + `system.cpu.util[,system,avg1]` vira `"CPU system time"`.
 *
 * Reimplementado (e nao importado) porque o plugin do Zabbix nao e dependencia
 * deste repo. Precisa existir aqui porque o datasource faz exatamente isto antes
 * de nomear a serie (`expandItems`, em `datasource/utils.ts`): sem a mesma
 * expansao, o nome escolhido no combo nao seria o nome do field que chega no
 * frame — e o vinculo do bloco 2 apontaria para o vazio.
 */
export function expandItemName(name: string, key: string): string {
  const inicio = key.indexOf('[');
  const fim = key.lastIndexOf(']');

  if (inicio < 0 || fim < inicio) {
    return name;
  }

  const params = splitKeyParams(key.substring(inicio + 1, fim));

  // De tras para frente: com 10+ parametros, trocar `$1` antes comeria o `$1` de
  // `$10`.
  let expandido = name;
  for (let i = params.length; i >= 1; i--) {
    expandido = expandido.replace('$' + i, params[i - 1]);
  }

  return expandido;
}

/** Parametros da chave, respeitando aspas e colchetes aninhados. */
function splitKeyParams(paramStr: string): string[] {
  const params: string[] = [];
  let quoted = false;
  let inArray = false;
  let param = '';

  for (const symbol of paramStr) {
    if (symbol === '"' && inArray) {
      param += symbol;
    } else if (symbol === '"') {
      quoted = !quoted;
    } else if (symbol === '[' && !quoted) {
      inArray = true;
    } else if (symbol === ']' && !quoted) {
      inArray = false;
    } else if (symbol === ',' && !quoted && !inArray) {
      params.push(param);
      param = '';
    } else {
      param += symbol;
    }
  }

  params.push(param);
  return params;
}
