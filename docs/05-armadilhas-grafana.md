# 05 — Armadilhas do Grafana (e das libs)

Cada item aqui custou tempo real de desenvolvimento da v1.0. Nenhum está na
documentação oficial. O formato é sempre o mesmo: **sintoma → causa → correção**,
porque é pelo sintoma que você vai chegar nesta página da próxima vez.

- [Plataforma Grafana](#plataforma-grafana)
- [Cor e tema](#cor-e-tema)
- [Pipeline de dados](#pipeline-de-dados)
- [Zabbix](#zabbix)
- [Componentes do `@grafana/ui`](#componentes-do-grafanaui)
- [Zod 4](#zod-4)
- [React Flow](#react-flow)
- [Testes](#testes)
- [Build e ambiente](#build-e-ambiente)

---

## Plataforma Grafana

### `usePanelContext().app` não é confiável no Grafana 13

**Sintoma.** O canvas inteiro nasce inerte quando se chega ao editor
**navegando** (dashboard → Edit → menu do painel → Edit): sem menu de contexto,
sem seleção e sem arraste. O mesmo editor alcançado por URL direta (F5, deep
link) funciona.

**Causa.** O `VizPanel` do `@grafana/scenes` constrói o panel context **uma única
vez**, com `app: CoreApp.Unknown`. O `setDashboardPanelContext` do core depois
**muta** `context.app` dentro de um `subscribeToState` — mutação de objeto, sem
re-render e sem propagação garantida até o plugin. Uma só entrada errada
desligava sete props de interação do `<ReactFlow>` de uma vez.

**Correção.** Ler a URL:

```ts
const editable = locationService.getSearchObject().editPanel !== undefined;
```

É o que o canvas nativo do Grafana faz, pelo mesmo motivo
(`public/app/plugins/panel/canvas/CanvasPanel.tsx`). Ler a cada render (e não uma
vez, como o core) é de graça e dispensa qualquer sincronia: entrar e sair do
editor sempre re-renderiza o painel.

**Custo real.** Passou por 5 commits sem ser notado, porque o jsdom não faz
hit-testing e nenhum teste de unidade poderia pegá-lo.

### O editor de opções recebe o valor salvo **cru**

**Sintoma.** A aba de opções inteira cai com
`Cannot read properties of undefined (reading 'map')` ao abrir um dashboard
salvo por uma versão anterior do plugin. E, mais sutil: o que o formulário
escreve difere do que o canvas desenha — a sensação de configuração que "volta ao
default".

**Causa.** O Grafana entrega ao `addCustomEditor` exatamente o que está em
`panel.options`, **sem passar pelo Zod** que o painel usa do outro lado. Todo
`.default([])` do schema (que existe justamente para aceitar topologia antiga)
não vale nada aqui.

**Correção.** Normalizar no topo do editor, com o mesmo schema:

```ts
const parsed = useMemo(() => topologySchema.safeParse(props.value ?? defaultTopology), [props.value]);
```

### O Grafana consome o `Esc` antes do plugin

**Sintoma.** Um listener de `keydown` para fechar um painel com Esc simplesmente
nunca dispara.

**Causa.** O Grafana captura a tecla antes que ela chegue a um listener de
bubbling.

**Correção.** Registrar na fase de **captura**, ou usar o mecanismo do próprio
componente do `@grafana/ui` quando houver.

**Nota.** Esse bug é invisível no jsdom: só apareceu ao validar no browser real.

### `instanceState` é `@alpha` e só vale em dashboard

É o único canal entre o canvas (dentro do painel) e o editor de opções (fora
dele). Funciona, mas:

- a API é `@alpha` e documentada como suportada **apenas em contexto de
  dashboard**;
- então **todo acesso a ela tem que ser opcional dos dois lados**. Sem o canal,
  cada lado continua funcionando isolado; o que se perde é a sincronia, nunca a
  edição.

Cuidado extra: publique uma referência **estável**. Se a lista de selecionados
for um array novo a cada render, o canvas republica a cada quadro de um arraste e
o painel de opções re-renderiza junto.

### Mudar `plugin.json` exige reiniciar o Grafana

Não é hot-reload. Alterou id, nome, dependência ou qualquer metadado: reinicie o
servidor (`docker compose restart` no ambiente de desenvolvimento). O `module.js`
recarrega sozinho; o `plugin.json` não.

E **nunca mude o `id` nem o `type`** de um plugin já instalado: dashboards
referenciam o id.

### Não modifique `.config/`

A pasta é gerenciada pelo `@grafana/create-plugin` e é sobrescrita a cada
`update`. Para estender webpack, jest, eslint ou prettier, use os arquivos da
raiz que já herdam de lá:

```js
// jest.config.js (raiz)
const base = require('./.config/jest.config');
module.exports = { ...base, transform: { ...base.transform, /* o seu */ } };
```

### `getList({ type })` devolve datasources que não são do tipo pedido

`getDataSourceSrv().getList()` filtra por tipo e, **depois de filtrar**,
acrescenta `-- Grafana --` ao resultado — o `push` acontece fora do filtro, e o
`sorted` que a função retorna é o mesmo array que o `base` (o `.sort` ordena no
lugar). Numa instância sem nenhum Zabbix instalado:

```ts
getDataSourceSrv().getList({ type: 'alexanderzobnin-zabbix-datasource' })
// → [ -- Grafana -- ]      um item, e nenhum deles é um Zabbix
```

O estrago é silencioso: a regra "se existe exatamente um Zabbix, adote-o" acha
esse um e passa a mandar `host.get` para o datasource embutido do Grafana. O
sintoma que apareceu foi outro — o campo anunciando "há mais de um Zabbix nesta
instância" num Grafana que não tinha nenhum.

Use **`pluginId`**, que filtra pelo id do plugin e é a condição que faz o
`getList` pular o bloco que acrescenta os embutidos, e ainda assim peneire o
resultado por `type` (`data/zabbixApi.ts`, `listZabbixDatasources`).

Só o browser mostrou isso: em jsdom o `getDataSourceSrv` nem existe.

### A depreciação do `getDataSourceSrv` aponta para uma porta fechada

`getDataSourceSrv`, `.get()`, `.getList()` e `.getInstanceSettings()` estão todos
marcados `@deprecated` em favor de `@grafana/runtime/unstable` e
`@grafana/runtime/internal`. Só que o `unstable.d.ts` abre com:

> THESE APIS MUST NOT BE USED IN COMMUNITY PLUGINS.

Ou seja: para um plugin da comunidade, a API depreciada **é** a via pública. O
aviso do eslint fica silenciado com um `eslint-disable` documentado no topo do
módulo, e não migrado. O dia em que o singleton sumir, o typecheck avisa — a
exportação deixa de existir.

---

## Cor e tema

### `'text'` é um nome de cor válido — e resolve para quase branco

**Sintoma.** Todo elemento novo (nó, point, texto, aresta) nasce **branco** no
tema escuro.

**Causa.** `getColorByName('text')` resolve para `theme.colors.text.primary`.
Usado como fallback de "sem cor", ele pinta tudo de branco em vez de deixar
neutro. E não falha ruidosamente: é um nome válido.

**Correção.** Fallback é o token neutro do tema, escolhido por elemento. Elemento
sem cor guarda `color: {}` — objeto vazio, não `{ fixed: 'text' }`.

**Regra derivada.** Ao revisar qualquer componente do canvas, dar `grep` por
`#`, `rgb` e nomes CSS antes de aprovar. Zero cor literal em componente: só
token de `theme.colors.*` via `useStyles2`, ou a cor resolvida pela cadeia.

### `getContrastText` usa o limiar de texto **grande**

**Sintoma.** Texto quase ilegível sobre fundo de estado vermelho ou azul.

**Causa.** `theme.colors.getContrastText()` usa `contrastThreshold: 3` — o
critério WCAG AA para texto **grande** (24px, ou 18.66px em negrito). Texto de
14px e 12px exige **4.5**.

| Fundo | Branco | Preto | O helper devolve |
| --- | --- | --- | --- |
| `red` `#F2495C` | 3.57 ✗ | 5.88 ✓ | branco |
| `blue` | 3.03 ✗ | 6.92 ✓ | branco |

São as duas cores mais frequentes num NOC.

**Correção.** Medir os **dois** candidatos e escolher o de maior contraste. Para
obtê-los sem escrever `#fff`/`#000`, chame o helper com limiar `1` (sempre
devolve o claro) e `22` (sempre o escuro) — nenhuma razão de contraste é menor
que 1 nem maior que 21.

### Saturação HSL descarta cores escuras

**Sintoma.** `dark-red` (a cor de *Disaster*) classificada como "cinza" por uma
heurística de matiz.

**Causa.** Em HSL, uma cor escura tem lightness baixa e a saturação computada
despenca.

**Correção.** Usar saturação **HSV** para decidir se uma cor tem matiz.

---

## Pipeline de dados

### Sem `.useFieldConfig()` não existe vínculo de dados

**Sintoma.** `field.display` é `undefined`; nada de unidade, casas decimais,
value mappings ou thresholds.

**Causa.** É `.useFieldConfig()` no `PanelPlugin` que faz o Grafana rodar
`applyFieldOverrides` antes de entregar `data.series` — e é `applyFieldOverrides`
quem instala `field.display`.

**Correção.**

```ts
export const plugin = new PanelPlugin<Options>(Panel)
  .useFieldConfig()          // obrigatório
  .setPanelOptions(addOptions);
```

Bônus: isso também é o que faz aparecer a aba padrão com unit, decimals, min/max,
thresholds, value mappings e overrides.

### `getFieldDisplayName` pode desambiguar diferente entre chamadas

**Sintoma.** Dois hosts na mesma query recebem nomes de exibição que mudam entre
uma chamada e outra; um vínculo salvo para de encontrar o field.

**Causa.** A função recalcula a cada chamada e a desambiguação depende do
conjunto visto.

**Correção.** Aquecer o cache **uma vez**, no ponto mais alto que consome as
séries:

```ts
const series = useMemo(() => { cacheFieldDisplayNames(data.series); return data.series; }, [data.series]);
```

### `getActiveThreshold` sempre devolve um step

**Sintoma.** "Verde por omissão": um valor abaixo de todas as regras ainda sai
colorido.

**Causa.** A função do `@grafana/data` assume o step base em `-Infinity`, que
pinta tudo abaixo da primeira regra.

**Correção.** Se o produto precisa de um estado "nenhuma regra casou", escreva a
avaliação (é curta) e devolva `undefined` nesse caso.

### `field.config.custom` chega vazio se você não configurou opções de gráfico

**Sintoma.** Um `TimeSeries` embutido desenha a linha com defaults aleatórios.

**Causa.** `.useFieldConfig()` sem `useCustomConfig` não popula `custom`, e é
dali que o `GraphNG` lê como desenhar.

**Correção.** Montar o frame do gráfico à mão, preenchendo `config.custom` com as
decisões que você quer (draw style, interpolação, gradiente, eixo).

---

## Zabbix

### O frame de Problems não é colunar

**Sintoma.** Você procura colunas `Host`, `Severity`, `Status` e não encontra
nenhuma.

**Causa.** O datasource devolve **um único field de objetos**:

```
fields: [{ name: 'Problems', type: FieldType.other,
           config: { custom: { type: 'problems' } },
           values: ProblemDTO[] }]
```

**Consequências.** `applyFieldOverrides`, `field.display`, thresholds e value
mappings **não se aplicam**. Qualquer mapa de cor por severidade é seu.

**Detecção.** Espelhe o `isProblemsDataFrame` do próprio grafana-zabbix (é o
critério que o painel oficial usa), mas com `config.custom?.` — o original assume
que `custom` existe, o que é verdade nos frames dele e não em qualquer outro
frame do painel.

### O tempo do problema é `timestamp`, não `lastchange`

**Sintoma.** A hora do alarme simplesmente nunca aparece, embora `lastchange`
exista na resposta da API do Zabbix.

**Causa.** O `joinTriggersWithProblems` do grafana-zabbix monta o objeto do frame
com `timestamp: Number(clock)` — o clock do **evento** — e **descarta** o
`lastchange` que a trigger trazia.

**Correção.** Ler `timestamp ?? lastchange`, e validar (`Number.isFinite && > 0`)
antes de somar ao epoch: um `Number('')` vira `0` e a lista exibiria "há 56
anos".

### Host saudável e host digitado errado são indistinguíveis

Com `showProblems: problems`, os dois produzem exatamente o mesmo frame: nenhuma
linha. Não dá para distingui-los no canvas sem inventar estado.

**Decisão de produto que segue disso:** o aviso vive **no editor**, onde quem
pode corrigir está olhando, e os combos de host/trigger aceitam valor digitado —
um host 100% saudável nunca aparece na lista.

### A série de métrica vem com o nome do item — e dois hosts colidem

O backend do Zabbix nomeia cada frame de métrica com o **nome do item**, e põe o
resto em labels do field:

```
frame.name          = 'CPU Usage'
field.config.displayNameFromDS = 'CPU Usage'
field.labels        = { host: 'TESTE-PLUGIN', item: 'CPU Usage', item_key: 'cpu.usage' }
```

Dois hosts com `CPU Usage` produzem duas séries homônimas. `getFieldDisplayName`
devolve o mesmo nome para as duas, e `getLastNotNullValue` para na primeira: o
elemento do segundo host exibe, **em silêncio**, o valor do primeiro. É o pior
tipo de bug num painel de NOC — plausível e errado.

Quando o painel monta a própria query, ele renomeia cada série para
`"<host>: <item>"` (`nameMetricFields`) a partir dos **labels**, e não do nome:
label é dado estruturado, nome é texto que a próxima versão do datasource pode
formatar diferente.

### Filtro de grupo vazio devolve **nenhum** problema

Ao montar um alvo de Problems na mão (o que o painel faz em
`data/zabbixQuery.ts`), a tentação é deixar o filtro de grupo em branco para
dizer "todos os grupos". O efeito é o oposto:

```
findByFilter(grupos, '')  →  findByName(grupos, '')  →  []
zabbixAPI.getHosts([])    →  params.groupids = []     // [] é truthy em JS
```

E `groupids: []` na API do Zabbix significa "nenhum grupo", não "todos". A query
volta vazia, sempre, sem erro nenhum. O filtro que quer dizer "todos" é a regex
`/.*/`.

### O filtro de host do datasource só testa o nome **visível**

`filterByRegex` roda sobre `zbx_obj.name`. O vínculo do TopoFlow, porém, aceita
nome visível **ou** técnico — `matchesHost` compara com os dois, porque o combo
lista um e quem digita costuma digitar o outro.

Consequência: montar o filtro de host direto com o que está salvo deixaria de
fora todo elemento vinculado pelo nome técnico, e ele ficaria eternamente
apagado. Por isso `useZabbixProblems` traduz os nomes com um `host.get`
(`filter` + `searchByAny`, uma chamada para a lista inteira) antes de montar a
regex.

### Match de host tem que ser exato

`contains` faria `MMV-FW-STARTI-01` casar com `MMV-FW-STARTI-011`. Exato,
case-insensitive, contra `hosts[].name` **e** `hosts[].host` (o Select lista
`name`, mas a entrada livre convida a digitar o nome técnico).

---

## Componentes do `@grafana/ui`

### `Tooltip` aninhado ancora no canto da tela

**Sintoma.** O painel de hover abre no canto superior esquerdo da janela em vez
de junto do elemento.

**Causa.** O `Tooltip` clona o filho e ancora nele **por ref**. Dois aninhados
fazem o de fora ancorar num componente de função, que engole a ref em silêncio.

**Correção.** Um `Tooltip` só por elemento, com o conteúdo decidido dentro dele.

### `RadioButtonGroup` com `icon` + `ariaLabel` fica mudo

**Sintoma.** Botões de ícone sem nenhuma dica do que fazem.

**Correção.** Usar `label` (o glifo) + `description` — que o componente
transforma em **tooltip**.

### `Combobox` mede texto com canvas

**Sintoma.** Em jest, qualquer teste que renderize um `Combobox` quebra.

**Causa.** Ele se auto-dimensiona medindo texto com `getContext('2d')`, e o jsdom
devolve `null` sem o pacote `canvas`.

**Correção.** Stub incondicional em `jest-setup.js` (um guard por existência não
pega o caso, já que a função existe). Ver [doc 06](06-testes.md).

### `ScrollContainer` precisa de `IntersectionObserver`

O menu aberto do `Combobox` vive dentro dele, e ele usa a API para decidir quando
mostrar as sombras de rolagem. Sem stub, qualquer teste que abra um dropdown cai
com `IntersectionObserver is not defined`.

### `description: undefined` engorda **todas** as linhas do `Combobox`

A altura de cada linha do menu é decidida assim:

```js
const hasDescription = 'description' in options[index];   // a CHAVE, não o valor
```

Presença de chave, não de valor. Uma lista montada com
`{ value, label, description: talvez }` tem a chave em todas as opções, então
**toda** linha recebe a altura de duas — a segunda em branco — e a lista inteira
parece espaçada demais sem que nada apareça ali.

Monte a opção sem a chave quando não houver descrição:

```ts
tecnico ? { value, label, description: tecnico } : { value, label }
```

### O menu do `Combobox` é virtualizado

**Sintoma.** Um teste que tenta clicar numa opção não encontra opção nenhuma.

**Causa.** Nada é renderizado no jsdom.

**Correção.** Extraia a lógica que o menu dispara para uma função pura e teste-a
diretamente. Foi o que motivou `insertTemplateField` viver em `data/dimensions.ts`
e não dentro do componente.

---

## Zod 4

### `discriminatedUnion` aplica `.default()` **depois** de rotear

**Sintoma.** `No matching discriminator` ao carregar um objeto salvo antes de o
discriminador existir — mesmo tendo `.default()` nele.

**Causa.** O zod 4 roteia pelo discriminador primeiro; o default só é aplicado
dentro do ramo escolhido, que nunca é alcançado.

**Correção.** Carimbar o discriminador **antes**, com `z.preprocess`:

```ts
z.preprocess(
  (raw) => (typeof raw === 'object' && raw !== null && !('type' in raw)
    ? { ...raw, type: 'threshold' } : raw),
  z.discriminatedUnion('type', [ /* … */ ])
);
```

**Alternativa melhor ainda:** não usar union discriminado para modos que podem
coexistir. Dois campos opcionais paralelos (`trigger` ao lado de `color.field`)
dão retrocompatibilidade de graça **e** permitem alternar entre modos sem
descartar configuração.

### O strip do Zod apaga campo removido no primeiro save

Ao remover um campo do schema, dados salvos que ainda o têm **não** dão erro de
parse — o Zod simplesmente descarta. Mas: o campo some do JSON no primeiro save
do dashboard, silenciosamente e sem volta.

Isso é aceitável (foi a decisão D5, remover `trigger` do Texto), desde que seja
uma decisão consciente e não um efeito colateral notado depois.

---

## React Flow

### Nó redimensionável: `width`/`height`, não `style`

**Sintoma.** A alça de resize se move e o elemento não muda de tamanho.

**Causa.** O `NodeResizer` escreve nos atributos `width`/`height` do nó. Uma
dimensão em `style` é inline e vence.

### `elevateNodesOnSelect` quebra a ordem de camadas

O default é `true`, e ele **reescreve o `zIndex`** do nó ao selecioná-lo. Se você
monta camadas por zIndex (postits atrás, arestas numa faixa), passe `false`.

### `nodeTypes` recriado a cada render remonta tudo

Clássico, mas fácil de reintroduzir: qualquer dado dinâmico capturado por closure
dentro dos componentes de nó empurra você a recriar o mapa. Não faça — passe o
dado pelo `data` do nó.

### O `data` do nó **congela** se você esquecer um tipo

**Sintoma.** Um tipo de elemento para de acompanhar os dados: legenda com
`${metrica}` parada no tempo, value mapping recém-criado não aplicado, alça de
redimensionamento que não aparece ao entrar em modo de edição. Só volta ao
recarregar a página. Relatado como "cache".

**Causa.** O React Flow guarda os nós em **estado local** e só os reconstrói
quando a topologia muda. Por isso existe uma função que reinjeta `frames`,
`editable` etc. no `data` a cada render — e **um tipo de nó esquecido naquela
função congela em silêncio**, caindo no `default: return node`.

**Correções, em ordem de preferência:**

1. Para valores que são iguais para o canvas inteiro (a janela de tempo, por
   exemplo), use **React context**. Ele não tem esse modo de falha: quem consome
   re-renderiza quando o valor muda, sem lista nenhuma para manter em dia.
2. Para valores por nó (os `frames`, que cada elemento lê diferente e que
   permitem pular o render de quem não mudou), mantenha a reinjeção — mas escreva
   a função com um `switch` **exaustivo** sobre a união de tipos, para que o
   TypeScript cobre o caso novo.

### `100%` de altura mede zero na primeira renderização

O React Flow mede o container. Dentro de um painel redimensionável do Grafana,
`height: 100%` rende zero na primeira medição. Use `position: relative` e as
dimensões que o `PanelProps` entrega (`width`, `height`).

### `screenToFlowPosition` só existe dentro do provider

Se você precisa dela (para criar elemento no ponto do clique), o componente
público tem que ser um wrapper: `<ReactFlowProvider><Inner/></ReactFlowProvider>`.

### O `Background` herda a cor do container

Sem `& .react-flow__background { color: … }`, os pontos da grade saem com a cor
própria da lib (`#91919a` no claro, `#333` no escuro) e destoam do painel.

---

## Testes

### O jsdom não faz hit-testing — e essa cegueira tem custo

Seleção, arraste e menu de contexto **não têm como ser testados** em jsdom. Foi
exatamente essa cegueira que deixou um bug de `editable` passar por 5 commits:
diante de um relato de "não dá mais para mover nem clicar com o botão direito"
não havia nada que respondesse sim ou não, e a resposta teve que ser
reconstruída à mão no navegador.

**Regra derivada: valide no browser antes de entregar.** Duas falhas de uma
única rodada eram invisíveis para o jsdom — o campo de tempo do Zabbix e o Esc
consumido pelo Grafana.

### Playwright: `waitUntil: 'domcontentloaded'` é obrigatório

O default do `@grafana/plugin-e2e` é `'load'`, que **não resolve** neste Grafana:
o app mantém conexões abertas após o primeiro render.

### `getVisualizationName()` não existe no Grafana 13.1.0

O seletor que o `plugin-e2e` usa a partir da 12.4.0 não está lá. Use
`panelEditPage.setVisualization('TopoFlow')`, que abre o viz picker e seleciona
pelo nome — e falha se o plugin não estiver listado, que é o que o teste quer.

### E2E: medir a superfície certa

**Sintoma.** O teste reporta `rgb(204, 204, 220)` para qualquer coisa.

**Causa.** `.locator('> div')` pega o wrapper de hover, cuja borda é neutra em
todos os nós. A cor de estado pousa no **fundo do card**, não na borda.

**Correção.** Ancorar numa classe estável (`.topo-card`), e não na estrutura do
DOM.

### Imports de imagem quebram o jest

O webpack os trata como `asset/resource` e devolve uma URL; o jest tenta parsear
o PNG como JavaScript. Um transformer resolve — mas devolva o **nome do
arquivo**, não um stub genérico: um pack de variantes escolhe entre
`router-gray-96.png` e `router-red-96.png`, e com stub único os dois casos passam
idênticos, **inclusive o errado**.

---

## Build e ambiente

### Chromium do Playwright não sobe sem libs do sistema (WSL/Ubuntu sem sudo)

**Sintoma.** Faltam `libnspr4.so`, `libnss3.so`, `libnssutil3.so`,
`libasound.so.2`; e `npx playwright install-deps` exige root.

**Contorno sem tocar no sistema:**

```bash
cd <scratch>/libs
apt-get download libnspr4 libnss3 libasound2t64   # não precisa de root
for d in *.deb; do dpkg-deb -x "$d" extracted; done
LD_LIBRARY_PATH=$PWD/extracted/usr/lib/x86_64-linux-gnu npx playwright test
```

Verificado com as versões que o noble entrega (`libnspr4 2:4.35`,
`libnss3 2:3.98-1ubuntu0.2`, `libasound2t64 1.2.11-1ubuntu0.3`) — não é preciso
fixar versão.

### `html-to-image` serializa estilos **computados**

**Sintoma.** O screenshot sai com o elemento alarmado meio apagado — justamente
o elemento por causa do qual alguém tirou o screenshot.

**Causa.** A captura congela o instante: o `blink` desce a opacidade 0.45, as
ondas do radar começam em 0.55.

**Correção.** Marcar o container durante a captura e zerar animações:

```ts
'&[data-capturing] *': { animation: 'none !important' }
```

### `<a href="">` recarrega a página

Se o endereço do drill-down está vazio, **não renderize o link** — devolva
`undefined` e renderize o elemento sem `<a>`.

### URL sem esquema é caminho relativo

`www.google.com` num `href` não é um endereço: o browser resolve contra a página
atual e o operador cai em `/d/uid/www.google.com`. Complete com `https://` (não
`http://`: o erro que ele produz é visível e corrigível, enquanto o contrário
manda credencial em claro) e **mostre o endereço completado no editor**, para que
a suposição não seja silenciosa.

### `rm -rf dist` quebra o bind mount do container de desenvolvimento

**Sintoma.** Depois de um `rm -rf dist && npm run build`, o Grafana de
desenvolvimento não vê mais o plugin, e um `docker compose up -d` falha com:

```
error mounting "/run/desktop/mnt/host/wsl/docker-desktop-bind-mounts/…"
to rootfs at "/var/lib/grafana/plugins/…": no such file or directory
```

**Causa.** O bind mount resolve o **inode** do diretório na criação do
container. Apagar `dist/` e recriá-lo produz um inode novo; o mount continua
apontando para o antigo, que não existe mais. O container fica com o diretório
vazio (e, no restart, morre com exit 127).

**Correção.**

```bash
docker compose up -d --force-recreate
```

**Prevenção.** Prefira limpar o **conteúdo** a apagar o diretório:
`rm -rf dist/*`. O `npm run build` sozinho já sobrescreve o que precisa.

### Não há Pillow nem ImageMagick na máquina de desenvolvimento

Derivar variantes de cor de PNGs exigiu escrever o codec à mão. Se você precisar
manipular imagem no build, verifique as ferramentas disponíveis **antes** de
desenhar a solução.
