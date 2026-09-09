import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { ComboboxOption } from '@grafana/ui';

import { listItems, listTriggers, resolveZabbixUid, searchHosts } from '../data/zabbixApi';

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

export function ZabbixSourceProvider({ datasource, children }: { datasource?: string; children: React.ReactNode }) {
  /*
    Resolve aqui, uma vez, e nao em cada combo: `resolveZabbixUid` consulta o
    catalogo de datasources e interpola variavel. O valor so muda quando a opcao
    do painel muda.
  */
  const uid = useMemo(() => resolveZabbixUid(datasource), [datasource]);

  return <ZabbixSourceContext.Provider value={uid}>{children}</ZabbixSourceContext.Provider>;
}

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

        const doZabbix = hosts.map((h) => ({
          value: h.name,
          label: h.name,
          description: h.host && h.host !== h.name ? h.host : undefined,
        }));

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
          items.map((item) => ({ value: item.name, label: item.name, description: item.key_ })),
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
