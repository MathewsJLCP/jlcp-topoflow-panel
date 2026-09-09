# PRD — Vínculo direto com a API do Zabbix

Rodada aberta em **2026-09-09**, a pedido do cliente, depois da demonstração do
plugin. Substitui nada do que já existe: tudo aqui é **aditivo**, e o modo atual
(vínculo alimentado pelas queries do painel) continua sendo o comportamento de
quem não configurar nada.

Executado em **quatro blocos**, com aprovação explícita antes de cada um. Os
blocos 1 e 2 foram aprovados em 2026-09-09.

| Bloco | Estado |
| --- | --- |
| 1 — Cliente da API | **feito** em 2026-09-09 |
| 2 — Métrica por host + item | **feito** em 2026-09-09 |
| 3 — Query própria | depois do backup |
| 4 — `triggerid` como chave | a aprovar |

---

## 1. O problema

Para vincular um elemento a uma trigger hoje, o cliente precisa, **antes**,
adicionar o host na query do painel (Query Mode _Problems_). Só depois o combo do
editor oferece aquele host, porque o formulário lê os frames e nada mais —
está escrito no cabeçalho de [`TriggerBindingFields.tsx`](../src/editors/TriggerBindingFields.tsx):
"o plugin nunca fala com a API do Zabbix".

É o padrão dos plugins de topologia, mas cobra o preço em cima da mão de obra
que mais custa: montar uma topologia de 40 elementos significa 40 idas ao editor
de queries antes de desenhar qualquer coisa. Pior, um host sem problema ativo
**não aparece em lista nenhuma** — o operador tem que digitar o nome exato e
torcer.

O que o cliente pediu: escolher Host/Item/Trigger direto nas opções do painel,
com busca por digitação, e que a query se resolva sozinha.

## 2. O fluxo alvo

```
Modo Trigger   → digita/seleciona o host → seleciona a(s) trigger(s) → pronto
Modo Métrica   → digita/seleciona o host → seleciona o item          → pronto
```

Sem passar pelo editor de queries em momento nenhum.

---

## 3. Viabilidade: o que dá e o que não dá

Investigado em 2026-09-09 contra `@grafana/runtime` 13.1.0 e o código do
[grafana-zabbix](https://github.com/grafana/grafana-zabbix) na `main`.

### 3.1. Ler a API do Zabbix do painel: **dá**, com API pública

O datasource Zabbix publica a API do Zabbix como **resource endpoint** do próprio
Grafana:

```
POST /api/datasources/uid/<uid>/resources/zabbix-api   →  { method, params }
```

É o mesmo caminho que o Query Editor dele usa para preencher os combos
(`zabbixAPIConnector.ts`, `backendAPIRequest`). Do nosso lado:

```ts
const ds = await getDataSourceSrv().get(uid);              // @grafana/runtime
await (ds as DataSourceWithBackend).postResource('zabbix-api', {
  method: 'host.get',
  params: { output: ['hostid', 'name', 'host'], search: { name: termo }, limit: 100 },
});
```

`getDataSourceSrv` e `DataSourceWithBackend.postResource` são exportações
públicas e estáveis. Credencial nenhuma passa pelo TopoFlow: token, usuário e
senha ficam no backend do datasource Zabbix, e a permissão exigida é a mesma que
o usuário já precisa ter para consultar aquele datasource.

A alternativa seria chamar `ds.zabbix.getAllHosts(...)` — o objeto interno do
plugin do Zabbix, que traz cache e tratamento de versão de graça. **Descartada**:
é o formato interno de um plugin de terceiros, sem contrato nenhum com a gente. O
endpoint de recurso é o contrato público, e os nomes de método (`host.get`,
`item.get`, `trigger.get`) são da API do Zabbix, versionada pelo Zabbix.

### 3.2. Escrever a query do painel: **não dá**

Não existe caminho público, e foi verificado item a item:

| Onde se procurou | O que tem |
| --- | --- |
| `PanelProps` (`@grafana/data`) | `data`, `options`, `onOptionsChange`, `onFieldConfigChange`, `onChangeTimeRange`. Nada de queries. |
| `PanelContext` (`@grafana/ui`) | `onAddAdHocFilter`, `onAnnotationCreate`, `onUpdateData`… nenhum equivalente para targets. |
| `@grafana/runtime` (services) | `getBackendSrv`, `getDataSourceSrv`, `getTemplateSrv`, `locationService`, `getAppEvents`. Não há `getDashboardSrv` nem acesso ao scene. |

Ler dá: `data.request.targets` traz as queries em execução, com o `datasource` de
cada uma — e isso é usado no bloco 1. **Escrever, não.** Qualquer forma de
escrever passa por alcançar o grafo de scenes do core por dentro, que é
exatamente o tipo de acesso que a migração para Dashboard Scenes quebrou nos
plugins que o faziam, e que pesa contra na revisão da loja.

Descartadas junto, para não voltarem à mesa sozinhas:

- **Salvar o dashboard via `/api/dashboards/db`** — conflita com o estado não
  salvo do editor: o painel gravaria por cima do que o usuário está editando.
- **Manter uma variável de template sincronizada por URL** (`locationService`
  escreve `var-x`, e isso funciona) — o valor não persiste no dashboard, exige
  que o usuário crie a variável e ponha `$x` no filtro de host da query, e a
  explicação para o cliente fica pior que o problema original.

### 3.3. A inversão

Se a query não pode vir até o painel, o painel vai até o dado.
`DataSourceApi.query()` é público e chamável de um painel — é o bloco 3.

---

## 4. Desenho

### Bloco 1 — Cliente da API (aprovado)

Módulo novo, `src/data/zabbixApi.ts`, sem nenhuma dependência de React nem de
componente. Só ele conhece o endpoint.

**Superfície:**

```ts
searchHosts(uid: string, termo: string): Promise<ZbxHost[]>
listTriggers(uid: string, hostId: string): Promise<ZbxTriggerOption[]>
listItems(uid: string, hostId: string): Promise<ZbxItemOption[]>
```

**De onde vem o `uid`.** Nova opção no nível do painel, `options.zabbix.datasource`,
na categoria **Zabbix** (`ZabbixSourceField`). Duas vias, nesta ordem:

1. o uid escolhido, passado por `getTemplateSrv().replace()` para aceitar
   variável de datasource (`${zbx}`), e conferido: um uid salvo que hoje aponta
   para um Prometheus é recusado, não consultado;
2. nenhum escolhido e **existe exatamente um Zabbix na instância** — o caso da
   esmagadora maioria dos ambientes, em que perguntar seria burocracia.

Com dois ou mais e nenhum escolhido não há adivinhação: o campo pede a escolha.
Chutar o primeiro faria o combo listar hosts de outro ambiente, que é pior que
não listar nada.

Não há uma terceira via "detectar pelo target da query", apesar de o dado existir
em `data.request.targets[].datasource`: ele só existe do lado do **painel**, e o
editor de opções recebe frames, não a request. Levar o uid de lá até aqui exigiria
publicar no `instanceState`, que hoje pertence à seleção do canvas — duas fontes
escrevendo no mesmo canal é bug garantido.

**Armadilha encontrada aqui**, e que só o browser mostrou: `getList({ type })`
acrescenta `-- Grafana --` ao resultado **depois** de filtrar, então "existe
exatamente um Zabbix" dava verdadeiro numa instância sem Zabbix nenhum. Ver
[05](05-armadilhas-grafana.md#getlist-type-devolve-datasources-que-não-são-do-tipo-pedido).

**Chamadas concretas:**

| Busca | Método | Observação |
| --- | --- | --- |
| Hosts | `host.get` | `search: { name }`, `sortfield: 'name'`, `limit: 100` |
| Triggers do host | `trigger.get` | `hostids`, `expandDescription: true`, `monitored: true`, saída com `triggerid`, `description`, `priority` |
| Itens do host | `item.get` | `hostids`, `webitems: true`, `filter: { value_type: [0, 3] }` — só numérico, que é o que o modo Métrica consegue ler |

`trigger.get` e `item.get` pedem `hostids`, e o que o vínculo guarda é o **nome**
do host. Então cada busca resolve o hostid antes, com um `host.get` cacheado.
É a razão econômica de o bloco 4 passar a salvar o `hostId`.

**Cache e digitação.** Mapa em memória por `(uid, método, params)` com TTL curto
(30 s), mais debounce de 300 ms no combo. O datasource do Zabbix tem cache
próprio, mas ele vive no objeto interno dele, que não usamos.

**Degradação — requisito, não detalhe.** Sem datasource escolhido, sem permissão,
Zabbix fora do ar ou plugin não instalado: os combos voltam a listar **o que está
nos frames**, que é o comportamento de hoje, com uma mensagem discreta dizendo
por quê. A digitação livre (`createCustomValue`) continua valendo em qualquer
cenário. O plugin **não** declara o Zabbix em `dependencies.plugins` do
`plugin.json`: a dependência é opcional, e declarar a tornaria obrigatória.

### Bloco 2 — Modo Métrica por host + item (feito)

Mesmos combos no vínculo por métrica. **D1 decidida**: o elemento salva
`color.metric = { host, item }`, e o seletor de "Campo" sai da tela enquanto esse
formulário está ativo — com um botão de volta, porque um painel pode ter Zabbix
configurado para o autocomplete **e** queries de outro datasource.

Os dois nunca convivem salvos: são dois nomes para a mesma série, e mantê-los
juntos deixaria gravado um nome que a tela não mostra e que a resolução ignora.
`color.field` continua válido para sempre — é o formato de tudo o que já está em
produção.

**A resolução, enquanto os dados ainda vêm da query do painel.** O datasource
nomeia a série com o **nome do item**, e só prefixa `"<host>: "` quando aquela
query casou **mais de um host** (`responseHandler.ts`, `if (_.keys(hosts).length > 1)`).
Ou seja: o mesmo item muda de nome conforme a query cresce. `stateFieldName`
(em `data/dimensions.ts`) tenta as duas, nesta ordem, e é o **único** lugar do
código que conhece os dois formatos — `resolveElementColor`, o gráfico do hover e
os avisos do editor passam todos por ele.

Quando nada bate, o elemento vai para NO DATA — que é o estado correto — e o
editor mostra "essa métrica não está nas queries do painel". Esse aviso é a
cicatriz visível de o bloco 3 ainda não existir, e some sozinho quando ele
existir.

**Duas armadilhas que só o browser mostrou**, e que valem para o bloco 3 também:

- **O resource endpoint devolve o envelope** `{ result: [...] }`, e não a lista.
  `postResource` já desembrulha a resposta HTTP, então era fácil supor que o que
  chega é o resultado — o sintoma foi um `r.map is not a function` dentro do
  combo. O jest não pegaria nunca: quem escreve o mock escreve a suposição errada
  junto. O `error` do envelope agora também vira exceção legível.
- **`parseTopoFlowOptions` precisa conhecer cada seção nova.** O objeto que sai
  dele é o que o canvas devolve ao dashboard em `onOptionsChange`; uma seção que
  o parse ignora **some do JSON** no primeiro arraste, sem erro e sem aviso. O
  `options.zabbix` teria evaporado no primeiro elemento movido.

### Bloco 3 — O painel executa a própria query (depois do backup)

Interruptor separado: `options.zabbix.selfQuery` (ausente = desligado). Escolher
o datasource no bloco 1 serve ao autocomplete; buscar dado sozinho é outra
decisão, e o usuário tem que poder tomar uma sem a outra.

**Montagem dos targets.** O painel junta os vínculos de todos os elementos e
monta o conjunto mínimo:

- **Trigger:** um único target para o mapa inteiro. O filtro de host do Zabbix
  aceita regex (`utils.buildRegex`), então N elementos viram
  `host: { filter: '/^(host-a|host-b|host-c)$/' }` com `queryType: '5'` (Problems)
  e `refId: 'TOPO_PROBLEMS'`.
- **Métrica:** um target por host (`refId: 'TOPO_M_<n>'`, `queryType: '0'`), com os
  itens daquele host em regex. Um target por host, e não um só para tudo, porque
  o filtro é produto cartesiano — host × item — e agrupar por host mantém o
  produto dentro do host. De quebra, com um host por target o nome da série é
  sempre o nome puro do item (§ bloco 2), o que torna a leitura previsível.

**Execução e integração:**

```ts
const ds = await getDataSourceSrv().get(uid);
ds.query({ requestId, range, targets, intervalMs, scopedVars, ... })
```

Os frames que voltam são **os mesmos** que hoje chegam pela query do dashboard —
o de Problems inclusive traz `config.custom.type === 'problems'`. Então
`extractProblems`, `resolveTriggerState`, a cadeia de cor e a lista de incidentes
não mudam uma linha: as séries próprias são concatenadas às do painel antes do
`cacheFieldDisplayNames`, e o resto do pipeline nem sabe da diferença.

**Field config.** Unidade, value mapping e `field.display()` vêm hoje do
`applyFieldOverrides` que o Grafana roda no query runner. Dado buscado por conta
própria não passa por lá — quem chama passa a ser o painel:

```ts
applyFieldOverrides({ data, fieldConfig, theme, replaceVariables, timeZone })
```

Sem isso, o "UP" que hoje vem do value mapping nativo some — e o contrato disso
está fixado no dashboard provisionado do e2e ([03](03-estado-e-cor.md)). O plugin
usa `.useFieldConfig()` sem config customizada, então o registry padrão basta.

**Refresh.** Re-executar em: mudança de time range, refresh do dashboard
(`RefreshEvent` no `props.eventBus`, público em `@grafana/runtime`) e mudança dos
vínculos. Cancelar a inscrição no unmount. **Este é o item que exige validação no
browser** — o jsdom não diz se o evento chega, e a memória do projeto já tem duas
cicatrizes exatamente desse tipo ([05](05-armadilhas-grafana.md)).

**O que se perde, e é preciso dizer ao cliente:**

1. **Transformações e alerting** não valem para esses elementos — o dado não passa
   pelo query runner do painel. Alerting num painel de topologia não faz sentido;
   transformação, para quem usa, é regressão. É por isso que os dois modos
   convivem e o novo é opt-in.
2. **Query Inspector** não mostra essas requisições como queries do painel.
3. **Snapshot** de dashboard congela `data.series`; o que o painel busca sozinho
   não é congelado junto.

### Bloco 4 — `triggerid` como chave

Hoje o casamento elemento ↔ problema é por **nome de trigger**
(`matchesName`, em [`problems.ts`](../src/data/problems.ts)). Renomear a trigger
no Zabbix apaga o vínculo em silêncio.

Com o `trigger.get` do bloco 1, o editor tem o `triggerid` em mãos, e o
`ProblemDTO` que chega nos frames também o traz. Então o vínculo passa a guardar
`hostId` e `triggerIds`, opcionais, e a resolução prefere id quando houver — o
nome continua valendo como fallback e como rótulo exibido. Sem migrador, no
mesmo espírito do `foldLegacyTriggerName`.

**Cai junto uma pendência do roadmap:** "ver as triggers configuradas que estão
OK" ([09](09-pendencias-e-roadmap.md)). O Query Mode _Problems_ por definição não
devolve trigger saudável, e era essa a fonte de dados que faltava; um
`trigger.get` pelos ids configurados devolve `value` 0 ou 1 para todas.

---

## 5. Schema

Tudo opcional, tudo aditivo, **sem migrador** — a regra de
[02](02-modelo-e-persistencia.md) segue valendo.

```ts
// panel.options
zabbix?: {
  datasource?: string;   // uid; ausente = auto-detecta pelos targets do painel
  selfQuery?: boolean;   // ausente = false (bloco 3)
}

// elemento, modo Trigger (bloco 4)
trigger: { ..., hostId?: string, triggerIds?: string[] }

// elemento, modo Métrica (bloco 2 — ver D1)
metric?: { host: string, item: string }
```

`color.field` continua válido para sempre: é o formato de tudo que já está salvo
em produção, exatamente como a chave curta de ícone e o `name` único de trigger.

## 6. Backup e publicação

Estratégia definida pelo usuário em 2026-09-09, e a razão de ela existir: o
deploy nos clientes é **manual**, feito por ele, então a loja não bloqueia
ninguém hoje.

1. Blocos 1 e 2 usam **só API pública** e não mudam de onde o dado vem. É a
   versão de menor risco de revisão.
2. Ao fim do bloco 2: `git tag` + branch de release + o `.zip` empacotado,
   guardados como **a candidata à loja**. O push é dele — nunca meu.
3. Bloco 3 entra depois, em cima disso.
4. Terminado o bloco 3, começa a submissão à loja. Se a revisão barrar por causa
   do painel consultar o datasource por conta própria, submete-se a versão do
   backup.

Sobre o risco real dessa revisão: um painel consultar um datasource é permitido e
tem precedentes — `getDataSourceSrv` existe para isso. O que a revisão costuma
cobrar é comportamento sadio **sem** o datasource instalado, e é o que o requisito
de degradação do bloco 1 já garante.

## 7. Decisões

- **D1 — o que o modo Métrica salva. Decidida em 2026-09-09:** salva
  `color.metric = { host, item }`, e o seletor de field sai da tela enquanto o
  formulário do Zabbix está ativo, com um botão de volta para o painel que tem
  Zabbix configurado e queries de outro datasource. Gravar um lado apaga o outro.

Em aberto:
- **D2 — escopo do bloco 3.** Trigger e métrica de uma vez, ou trigger primeiro?
  Métrica traz junto o trabalho de `applyFieldOverrides`.
- **D3 — `useTimeRange` nos problemas do bloco 3.** Hoje quem decide é a query do
  dashboard. Manter o default do datasource e expor a opção depois, ou expor já.

## 8. Testes

- **Jest:** o cliente da API com `postResource` mockado — método e parâmetros de
  cada chamada, cache (pergunta repetida vira uma requisição, erro não fica
  guardado), host desconhecido, e a expansão do nome do item; a fusão catálogo ×
  frames em `zabbixSource`. **Feito no bloco 1** (26 testes). Falta: a resolução
  host+item → nome de série (bloco 2) e a montagem dos targets do bloco 3 (regex
  escapada, agrupamento por host, mapa vazio não gera query).
- **Browser (obrigatório):** o refresh do bloco 3 e o value mapping continuar
  pintando "UP" depois do `applyFieldOverrides` — o fixture disso é o dashboard
  provisionado ([06](06-testes.md)).

  **Feito no bloco 1:** o e2e cobre a seção Zabbix e o `DataSourcePicker` dentro
  do painel de opções (checando o controle, e não quantos Zabbix a instância
  tem — isso é propriedade do ambiente). E as quatro chamadas do cliente foram
  verificadas contra o Zabbix real do ambiente de desenvolvimento: busca de host
  por nome visível e técnico, resolução de `hostid`, 62 triggers e 135 itens
  numéricos de um host — exatamente o volume que torna inútil a lista "só o que
  está nos dados".
