import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { ComboboxOption } from '@grafana/ui';

import { listItems, listTriggers, resolveZabbixUid, searchHosts } from '../data/zabbixApi';
import { metricBindings, metricFieldName, triggerHosts } from '../data/zabbixQuery';
import { Topology } from '../model/types';

/**
 * De onde os combos do editor tiram host e trigger.
 *
 * Ate aqui, so dos frames: o formulario lia o que as queries do painel tinham
 * trazido, e um host sem problema ativo nao aparecia em lista nenhuma. Com um
 * datasource Zabbix configurado, a lista passa a ser o **catalogo do Zabbix**, e
 * os frames viram complemento.
 *
 * O uid chega por contexto React, e nao por prop: `TriggerBindingField` esta a
 * quatro componentes de distancia do `ElementsEditor` (que e quem tem
 * `context.options`), e as formas de elemento ja carregam `frames` na mao. Uma
 * segunda prop atravessando os seis formularios seria custo sem beneficio —
 * ninguem no meio do caminho tem o que fazer com ela.
 *
 * Sem provider, `undefined`: os combos voltam a listar so os frames, que e
 * exatamente o comportamento anterior. E o mesmo caminho de quem nao tem Zabbix,
 * nao tem permissao, ou tem o Zabbix fora do ar.
 */
const ZabbixSourceContext = createContext<string | undefined>(undefined);

/**
 * Os nomes de serie que o painel vai buscar sozinho — `"<host>: <item>"`, um por
 * vinculo de metrica da topologia.
 *
 * Existem porque os seletores de field do editor listam **os frames das queries
 * do dashboard**, e com a secao Zabbix ligada a serie que o elemento observa nao
 * esta la: ela so passa a existir quando o painel roda a propria query. Sem esta
 * lista, "Inserir metrica" nao teria o que oferecer justamente no modo em que
 * mais se precisa dela.
 */
const ZabbixMetricNamesContext = createContext<string[]>([]);

/** Hosts que a topologia menciona, por trigger ou por metrica. */
const ZabbixHostsContext = createContext<string[]>([]);

export function ZabbixSourceProvider({
  enabled = true,
  datasource,
  topology,
  children,
}: {
  /** O interruptor da secao Zabbix. Desligado, o editor nao consulta nada. */
  enabled?: boolean;
  datasource?: string;
  /** De onde saem os nomes de serie que o painel busca. */
  topology?: Topology;
  children: React.ReactNode;
}) {
  /*
    Resolve aqui, uma vez, e nao em cada combo: `resolveZabbixUid` consulta o
    catalogo de datasources e interpola variavel. O valor so muda quando a opcao
    do painel muda.
  */
  const uid = useMemo(() => (enabled ? resolveZabbixUid(datasource) : undefined), [enabled, datasource]);
  const metricas = useMemo(
    () => (enabled && topology ? metricBindings(topology).map(metricFieldName) : SEM_NOMES),
    [enabled, topology]
  );
  const hosts = useMemo(() => {
    if (!enabled || !topology) {
      return SEM_NOMES;
    }

    return [...new Set([...triggerHosts(topology), ...metricBindings(topology).map((b) => b.host)])];
  }, [enabled, topology]);

  return (
    <ZabbixSourceContext.Provider value={uid}>
      <ZabbixMetricNamesContext.Provider value={metricas}>
        <ZabbixHostsContext.Provider value={hosts}>{children}</ZabbixHostsContext.Provider>
      </ZabbixMetricNamesContext.Provider>
    </ZabbixSourceContext.Provider>
  );
}

const SEM_NOMES: string[] = [];

/**
 * Nomes de serie que o painel busca por conta propria, para os seletores de
 * field oferecerem junto com o que veio dos frames.
 */
export function useZabbixMetricNames(): string[] {
  return useContext(ZabbixMetricNamesContext);
}

/**
 * Carregador do **catalogo de itens dos hosts que a topologia usa**, para os
 * seletores de field oferecerem mais do que o que ja esta vinculado.
 *
 * `undefined` quando nao ha secao Zabbix ligada ou quando a topologia nao
 * menciona host nenhum — e ai o seletor volta a listar so os frames.
 *
 * So itens **numericos**, que e o que `listItems` traz: um item de texto no
 * combo prometeria uma serie que a query de metrica do painel nao busca.
 *
 * Os hosts sao consultados em **lotes**, e nao todos de uma vez: um mapa com
 * quarenta hosts dispararia oitenta requisicoes no instante em que alguem abre o
 * combo, e do outro lado ha um Zabbix de producao. O cache de 30s de
 * `data/zabbixApi.ts` faz a segunda abertura sair de graca.
 */
export function useZabbixItemCatalog(): (() => Promise<string[]>) | undefined {
  const uid = useZabbixSource();
  const hosts = useContext(ZabbixHostsContext);

  return useMemo(() => {
    if (!uid || hosts.length === 0) {
      return undefined;
    }

    return async () => {
      const nomes: string[] = [];

      for (let inicio = 0; inicio < hosts.length; inicio += LOTE) {
        const lote = hosts.slice(inicio, inicio + LOTE);
        const listas = await Promise.all(
          lote.map(async (host) => {
            try {
              return (await listItems(uid, host)).map((item) => `${host}: ${item.name}`);
            } catch {
              // Um host que falhou nao pode levar o combo inteiro junto: o
              // resto do catalogo continua util.
              return [];
            }
          })
        );

        nomes.push(...listas.flat());
      }

      return nomes;
    };
  }, [uid, hosts]);
}

const LOTE = 4;

/** Uid do Zabbix em uso, ou `undefined` quando o catalogo nao esta disponivel. */
export function useZabbixSource(): string | undefined {
  return useContext(ZabbixSourceContext);
}

/**
 * O que o `Combobox` recebe em `options`: a lista pronta, ou uma funcao que o
 * componente chama ao abrir o menu e a cada tecla.
 *
 * A funcao so entra em cena quando ha Zabbix. Sem ele entregamos o array de
 * sempre — nao por simetria, mas porque a forma sincrona nao tem estado de
 * carregamento nenhum, e transformar a lista de hoje numa promise adicionaria um
 * piscar de "carregando" a um dado que ja esta na memoria.
 */
export type ComboOptions = Array<ComboboxOption<string>> | ((input: string) => Promise<Array<ComboboxOption<string>>>);

export interface ZabbixCatalog {
  hostOptions: ComboOptions;
  triggerOptions: ComboOptions;
  /** Mensagem quando a consulta ao Zabbix falhou. Os combos seguem funcionando. */
  error?: string;
}

interface CatalogInput {
  host: string;
  /** Opcoes vindas dos frames, ja no formato do combo. */
  hostsFromFrames: Array<ComboboxOption<string>>;
  triggersFromFrames: Array<ComboboxOption<string>>;
  /**
   * Opcoes fixas no topo da lista de triggers — hoje so "qualquer trigger do
   * host", que e o default do campo.
   *
   * Entram por aqui, e nao dentro de `triggersFromFrames`, porque a uniao poe o
   * catalogo do Zabbix na frente: o default do campo iria parar depois de
   * trezentas triggers, onde ninguem o encontraria. Nao passam pelo filtro de
   * digitacao pelo mesmo motivo.
   */
  triggerLeading?: Array<ComboboxOption<string>>;
}

/**
 * Junta catalogo do Zabbix e frames num par de listas para os combos.
 *
 * O que vem do Zabbix vem primeiro: e a lista completa, e e o que o usuario foi
 * procurar. O que veio dos frames e acrescentado depois **sem repetir** — um
 * host que aparece nos dados mas nao voltou da API (limite de resultados,
 * permissao no Zabbix, host removido de la mas ainda no frame) continua
 * escolhivel. Nenhuma escolha ja possivel deixa de ser possivel.
 */
/**
 * O carregador de hosts, compartilhado pelos dois formularios que perguntam host
 * (Trigger e Metrica). Sao a mesma pergunta ao mesmo catalogo — duplicar daria
 * duas listas com criterios de busca livres para divergir.
 *
 * O rotulo mostra o nome visivel e a descricao o nome tecnico quando os dois
 * diferem: e a unica forma de distinguir dois hosts homonimos, e o nome tecnico
 * e o que muita gente digita.
 *
 * A descricao entra **so quando existe**, e nao como `undefined`: o `Combobox`
 * decide a altura da linha com `'description' in option` — presenca da chave, e
 * nao do valor. Mandar `undefined` fazia toda linha da lista ganhar altura de
 * duas, com a segunda em branco, e a lista inteira parecia espacada demais.
 */
function useHostLoader(
  uid: string | undefined,
  fallback: Array<ComboboxOption<string>>,
  setError: (mensagem?: string) => void
) {
  return useCallback(
    async (input: string) => {
      if (!uid) {
        return filtrar(fallback, input);
      }

      try {
        const hosts = await searchHosts(uid, input);
        setError(undefined);

        const doZabbix = hosts.map((h) => {
          const tecnico = h.host && h.host !== h.name ? h.host : undefined;
          return tecnico ? { value: h.name, label: h.name, description: tecnico } : { value: h.name, label: h.name };
        });

        return unir(doZabbix, filtrar(fallback, input));
      } catch (err) {
        setError(mensagem(err));
        return filtrar(fallback, input);
      }
    },
    [uid, fallback, setError]
  );
}

/**
 * Host e item do vinculo por metrica. `undefined` quando nao ha catalogo — e o
 * sinal de que o formulario deve mostrar o seletor de field de sempre.
 *
 * Nao ha lista vinda dos frames aqui, ao contrario do vinculo por trigger: a
 * alternativa ao catalogo, no modo Metrica, e o proprio seletor de field, que ja
 * lista os frames e sabe filtrar por tipo numerico.
 */
export interface ZabbixMetricOptions {
  hostOptions: (input: string) => Promise<Array<ComboboxOption<string>>>;
  itemOptions: (input: string) => Promise<Array<ComboboxOption<string>>>;
  error?: string;
}

const SEM_FRAMES: Array<ComboboxOption<string>> = [];

export function useZabbixMetric(host: string): ZabbixMetricOptions | undefined {
  const uid = useZabbixSource();
  const [error, setError] = useState<string | undefined>();

  const hostOptions = useHostLoader(uid, SEM_FRAMES, setError);

  const itemOptions = useCallback(
    async (input: string) => {
      if (!uid || !host) {
        return [];
      }

      try {
        const items = await listItems(uid, host);
        setError(undefined);

        // A chave entra como descricao: dois itens podem ter o mesmo nome
        // visivel em templates diferentes, e a chave e o que os separa.
        return filtrar(
          items.map((item) =>
            item.key_
              ? { value: item.name, label: item.name, description: item.key_ }
              : { value: item.name, label: item.name }
          ),
          input
        );
      } catch (err) {
        setError(mensagem(err));
        return [];
      }
    },
    [uid, host]
  );

  return useMemo(() => (uid ? { hostOptions, itemOptions, error } : undefined), [uid, hostOptions, itemOptions, error]);
}

export function useZabbixCatalog({
  host,
  hostsFromFrames,
  triggersFromFrames,
  triggerLeading = [],
}: CatalogInput): ZabbixCatalog {
  const uid = useZabbixSource();
  const [error, setError] = useState<string | undefined>();

  const hostOptions = useHostLoader(uid, hostsFromFrames, setError);

  const triggerOptions = useCallback(
    async (input: string) => {
      if (!uid || !host) {
        return [...triggerLeading, ...filtrar(triggersFromFrames, input)];
      }

      try {
        const triggers = await listTriggers(uid, host);
        setError(undefined);
        const doZabbix = triggers.map((t) => ({ value: t.description, label: t.description }));

        // Filtra os dois lados: `trigger.get` traz o host inteiro de uma vez
        // (cacheado), e quem filtra por digitacao aqui somos nos.
        return [...triggerLeading, ...unir(filtrar(doZabbix, input), filtrar(triggersFromFrames, input))];
      } catch (err) {
        setError(mensagem(err));
        return [...triggerLeading, ...filtrar(triggersFromFrames, input)];
      }
    },
    [uid, host, triggersFromFrames, triggerLeading]
  );

  return useMemo(
    () =>
      uid
        ? { hostOptions, triggerOptions, error }
        : {
            hostOptions: hostsFromFrames,
            triggerOptions: [...triggerLeading, ...triggersFromFrames],
            error: undefined,
          },
    [uid, hostOptions, triggerOptions, error, hostsFromFrames, triggersFromFrames, triggerLeading]
  );
}

/**
 * Filtro local, sem acento e sem caixa — o mesmo criterio da busca da biblioteca
 * de icones. O `Combobox` nao filtra o que vem de funcao: quem recebe o texto
 * digitado e quem devolve a lista ja filtrada.
 */
function filtrar(options: Array<ComboboxOption<string>>, input: string): Array<ComboboxOption<string>> {
  const termo = normalizar(input);

  if (!termo) {
    return options;
  }

  return options.filter((option) => normalizar(option.label ?? option.value).includes(termo));
}

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** Concatena preservando a ordem e descartando repetidos pelo `value`. */
function unir(
  primeiro: Array<ComboboxOption<string>>,
  segundo: Array<ComboboxOption<string>>
): Array<ComboboxOption<string>> {
  const vistos = new Set(primeiro.map((option) => option.value));

  return [...primeiro, ...segundo.filter((option) => !vistos.has(option.value))];
}

function mensagem(err: unknown): string {
  const detalhe = err instanceof Error ? err.message : String(err);
  return detalhe || 'Erro desconhecido';
}
