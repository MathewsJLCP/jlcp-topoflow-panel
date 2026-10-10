# 04 — Canvas e editor

## O canvas é React Flow

`TopologyCanvas.tsx` monta um `<ReactFlow>` e converte a `Topology` do modelo
nos arrays que ele consome (`useFlowElements`). Cada elemento vira um `Node`
carregando o objeto do modelo inteiro em `data` — os componentes leem dali em
vez de receberem props espalhadas, o que mantém a conversão num lugar só.

Coisas do React Flow que não são óbvias e custaram tempo:

| Assunto                       | O que fazer                             | Por quê                                                                                                                              |
| ----------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Tamanho de nó redimensionável | `width`/`height` **do nó**, não `style` | são os atributos que o `NodeResizer` escreve ao arrastar a alça; em `style` a dimensão inline vence e o elemento não muda de tamanho |
| Altura do nó de device        | `style: { minHeight }`                  | `size.height` é **piso**: o card cresce quando o nome quebra em linhas. Com altura fixa o nome era truncado                          |
| `elevateNodesOnSelect`        | `false`                                 | o default `true` reescreve o `zIndex` ao selecionar e quebra a ordem de camadas que `useFlowElements` monta                          |
| `nodeTypes`                   | constante de módulo                     | recriar a cada render **remonta todos os nós** — bug de performance clássico                                                         |
| Dados que mudam (`frames`)    | dentro do `data` do nó                  | ver a armadilha do `withNodeData` no [doc 05](05-armadilhas-grafana.md)                                                              |
| `screenToFlowPosition`        | só dentro do `ReactFlowProvider`        | por isso o componente é um wrapper com provider + `CanvasInner`                                                                      |
| Ordem de camadas              | offsets por tipo em `flowTypes.ts`      | postits sempre atrás, arestas numa faixa própria                                                                                     |

## Escrita em `panel.options`: debounce de 80ms

A alça de resize emite dezenas de mudanças por arraste, e cada uma viraria uma
escrita em `options`. O commit é adiado até o gesto esfriar.

O número é um equilíbrio entre duas perdas: curto demais e cada gesto vira
várias escritas; longo demais e cresce a janela em que o commit ainda não
aconteceu — se o painel desmontar dentro dela (fechar o editor, salvar o
dashboard, trocar de painel), o `clearTimeout` do cleanup descarta o gesto e o
elemento volta para onde estava.

80ms fecha essa janela para algo que ninguém alcança entre soltar o mouse e
clicar em outra coisa, e continua muito acima da cadência de um gesto contínuo
(~16ms por frame). Era 200ms.

## Seleção sobrevive à escrita

O efeito de ressincronia remonta nós e arestas do zero a partir da topologia, e
`toFlowNodes`/`toFlowEdges` não conhecem seleção — ela é estado de UI e nunca foi
para `options`. Sem `keepSelection`, **toda escrita apagaria a seleção**.

O caso que expôs isso foi a edição em massa (mudar o estilo de quatro conexões
desfazia a seleção e obrigava a refazê-la para o campo seguinte), mas o incômodo
já existia com um elemento só: editar um nó pelo Layer o desmarcava no canvas.

Casa por **id**, nunca por posição: entre as duas listas pode ter entrado ou
saído elemento.

## `editable`: a URL, não o panel context

```ts
const editable =
  !topologyInvalid && (locationService.getSearchObject().editPanel !== undefined || parsed.canvas.inlineEditing);
```

No editor de painel a edição vem ligada; no dashboard depende do toggle "Edição
inline". Assim quem só visualiza não arrasta a topologia por acidente.

A leitura vem da **URL** e não de `usePanelContext().app` — o porquê está no
[doc 05](05-armadilhas-grafana.md), é uma das armadilhas mais caras do projeto.

## O painel de Layers e a ponte `instanceState`

O canvas e o painel de Layers vivem em **árvores React separadas** — um dentro
do painel, outro dentro do editor de opções — e não há props entre eles. O único
caminho que o Grafana oferece é o `instanceState` do `PanelContext`:

```
canvas  --onInstanceStateChange({ selected, select })-->  Grafana
Layer   <--context.instanceState--------------------------
```

O objeto carrega **uma função**, e não só o id selecionado, porque a direção
Layer → canvas precisa de um efeito imperativo: além de marcar a seleção, o
canvas tem de trazer o elemento para a área visível, e só ele conhece a viewport.

`selected` é uma **lista** desde que o Layer passou a editar conexões em massa: o
Ctrl+clique do React Flow já selecionava vários e o canal só publicava o
primeiro. A identidade do array é estável enquanto o conteúdo não muda — sem
isso o canvas republicaria o estado a cada quadro de um arraste, e o painel de
opções re-renderizaria junto.

> **A API é `@alpha`** e documentada como suportada apenas em contexto de
> dashboard. Por isso todo acesso a ela é opcional dos dois lados: sem o canal,
> cada lado continua funcionando isolado. O que se perde é a sincronia, nunca a
> edição.

## O editor normaliza antes de renderizar

O `ElementsEditor` recebe `panel.options.topology` **cru** — o Grafana entrega o
que está salvo, sem passar pelo Zod que o painel usa do outro lado. Duas coisas
dependiam disso e nenhuma estava garantida:

- uma topologia salva antes de `points`/`postits`/`texts`/`images` existirem
  (o schema aceita isso de propósito, via `.default([])`) derrubava a aba inteira
  de opções com `Cannot read properties of undefined (reading 'map')`;
- o que o formulário escrevia podia diferir do que o canvas desenhava — a origem
  da sensação de configuração que "volta ao default".

A correção é uma linha: `topologySchema.safeParse(props.value ?? defaultTopology)`
no topo do editor. Os dois lados passam a ler exatamente o mesmo objeto.

## Edição em massa

Dois formulários — Conexão e Point — porque os tipos não têm os mesmos campos.
Selecionando os dois juntos aparecem os dois blocos, cada um dizendo quantos
edita.

**O problema que ela resolve:** um caminho montado com points não é uma conexão,
são várias. Ligar A a B passando por três âncoras cria quatro arestas e três
âncoras, que representam **um** enlace e por isso precisam da mesma configuração.
Configurar uma a uma não é só trabalhoso: basta esquecer um segmento para o
caminho acender pela metade, e o mapa passa a mentir.

**A regra que governa tudo ali:** só o campo que o usuário mexe é escrito. O
formulário não é um retrato de uma aresta que, ao salvar, cai por cima das
outras — cada controle escreve o seu próprio campo em todas as selecionadas e
não toca em mais nada. É o que permite mudar a espessura de quatro conexões sem
achatar os rótulos, que são diferentes em cada uma. Quando as selecionadas
divergem, o controle mostra isso em vez de escolher um valor por elas.

## O bloco de Estado é compartilhado

`StateSection` reúne as três peças que só fazem sentido juntas — fonte do estado
(Métrica | Trigger), campo observado e regras. É um bloco só, e não três campos
que cada formulário monta a seu gosto, porque foi montando-as separadamente que
Nó, Conexão e Point acabaram com três comportamentos diferentes para a mesma
pergunta.

Nomenclatura (decisão D1): `Fonte de estado` → **Estado**; `Campo de estado` →
**Campo** (não "Métrica", para não repetir a palavra logo abaixo do botão
`Métrica`). São só rótulos — não há campo de schema com esses nomes.

### Duas formas de dizer qual métrica

Desde 2026-09-09 o modo Métrica tem dois formulários, e o `StateFieldPicker`
mostra um de cada vez:

| Formulário | Grava | Quando aparece |
| --- | --- | --- |
| **Host + Item** | `color.metric` | a seção **Zabbix** das opções do painel está ligada |
| **Campo** | `color.field` | não há Zabbix, ou o usuário pediu esse caminho |

O par host+item existe porque escolher pelo nome do field exige que a query já
traga aquela métrica — a ordem invertida do trabalho real, em que o usuário sabe
o host e o item muito antes de haver query. As opções vêm da API do Zabbix
(`data/zabbixApi.ts`); ver [o PRD da rodada](prd-zabbix-direto.md).

Três decisões que o formulário carrega:

- **Gravar um lado apaga o outro.** Não é descuido com a configuração (o modo
  Trigger, por exemplo, preserva tudo ao alternar): aqui os dois campos são dois
  nomes para a mesma série, e mantê-los juntos deixaria salvo um nome que a tela
  não mostra e que a resolução ignora.
- **O modo é estado local derivado do que está salvo**, e não campo do schema —
  a mesma escolha já feita entre Biblioteca e Arquivo no formulário da Imagem.
  Com um `field` salvo, o formulário abre no seletor de campo: mostrar host e
  item vazios pareceria que a configuração se perdeu.
- **Trocar de host limpa o item**, que são itens daquele host.

Com a seção **Zabbix** ligada, o painel busca a série ele mesmo — e por isso o
formulário não avisa nada sobre queries ausentes: seria mandar resolver o que a
seção acabou de resolver.

Os seletores de field do editor (o "Inserir métrica" dos textos, o "Exibir valor"
do nó, o modo _Field_ das dimensões de texto) listam os frames das queries do
dashboard, onde essas séries **não estão** — elas só existem quando o painel
desenha. Com a seção ligada eles passam a oferecer, em ordem:

1. o que já está vinculado na topologia (`useZabbixMetricNames`);
2. o que veio das queries do dashboard;
3. o **catálogo** de itens numéricos dos hosts que o mapa usa
   (`useZabbixItemCatalog`), carregado ao abrir o combo.

A ordem é deliberada: são dezenas de itens por host, e o que o usuário já usa não
pode afundar no meio deles. O catálogo é carregado em lotes de quatro hosts —
um mapa com quarenta hosts dispararia oitenta requisições no instante em que
alguém abre o combo, e do outro lado há um Zabbix de produção.

O aviso de "sem correspondência nas séries" desconta o que o painel busca.

## Vínculo de trigger: o que a UI precisa comunicar

**Com a seção Zabbix desligada** — o padrão —, as listas de host e de trigger só
contêm o que está nos dados agora. Um host sem nenhum problema ativo não aparece
em lista nenhuma, porque o Query Mode _Problems_ só devolve problemas.

Daí duas decisões de UI, que continuam valendo nos dois casos:

- os dois combos aceitam valor digitado (`createCustomValue`);
- host desconhecido é **aviso**, nunca erro.

**Com a seção ligada**, a lista passa a ser o catálogo do Zabbix e os
frames viram complemento: o que veio dos dados e não voltou da API (limite de
resultados, permissão, host removido de lá mas ainda no frame) continua
escolhível. Nenhuma escolha já possível deixa de ser possível, e falha na API cai
para o comportamento acima com um aviso — nunca com exceção dentro do combo.

### Mais de uma trigger no mesmo vínculo

Um host no topo e **uma lista de triggers** abaixo dele (`trigger.names`), com
`+ Adicionar trigger` e um `x` por linha. A relação entre as linhas é **OU**:
basta uma alarmar para o elemento acender, e as que alarmarem juntas entram
todas na lista sob o elemento e no contador.

Três regras que o formulário sustenta:

- **Lista vazia = qualquer trigger do host.** É o default de quem só escolhe o
  host, e o que o campo único dizia quando ficava em branco. Por isso a UI
  sempre mostra ao menos uma linha: um campo ausente não se preenche.
- **A opção "Qualquer trigger do host" some a partir da segunda linha.** Ali ela
  não seria uma escolha entre triggers e sim a revogação das outras — um
  controle que apaga em silêncio a escolha vizinha. O caminho de volta é remover
  linhas até sobrar uma.
- **Linha em branco é rascunho, e o resolver a ignora.** Se ela valesse
  "qualquer", clicar em adicionar alargaria o vínculo para o host inteiro antes
  de o usuário escolher qualquer coisa.

Duas armadilhas de componente, ambas custaram teste vermelho: o `Combobox` só
repassa `aria-labelledby` (um `aria-label` nele não chega ao input, daí o
`<label>` escondido por linha), e o `IconButton` deriva o rótulo acessível do
`tooltip` e ignora `aria-label` — por isso o número da linha vive no texto do
próprio tooltip.

## Biblioteca de ícones

Chave salva: **`pack/nome`** (`padrao/roteador`). Continuam válidas para sempre:

- **sem pack** (`router`) ou **dos Clássicos** (`classic/router`) — o pack de
  glifos saiu na v1.4; cada chave vai ao desenho equivalente;
- **anterior à v1.4** (`topoflow/router`, `zabbix/rack-42`,
  `petrolifera/unifi-ac-mesh`) — a tabela `LEGACY` em `icons/registry.ts` leva
  cada chave dos packs em PNG ao desenho equivalente. Um teste garante que todo
  destino existe;
- **do pack Zabbix** (`zabbix/switch`) — o pack virou **Infra**; sem entrada na
  tabela, `zabbix/<nome>` resolve em `infra/<nome>`;
- **desconhecida** — cai no Desconhecido (`padrao/desconhecido`) em vez de sumir.

Packs: Padrão (28), Infra (43), Petrolífera (9), Formas (15), Planos (164). O
Infra é o pack Zabbix do mockup renomeado (`RENAMED` em `icons/svg/index.ts`).
Todos são SVG do catálogo `icons/svg/catalog.generated.ts`, gerado por
`scripts/gen-icon-catalog.js` a partir do `topoflow-icons.js` do mockup. É um
`.ts`, e não `.json`, porque o webpack do `.config` copia todo `.json` de `src/`
para o `dist` — o catálogo iria duplicado no pacote.

O ícone é desenhado num `<img>` com data URI (`svgIconUri`), e não inline: vários
desenhos declaram `id` internos (filtros, gradientes) que colidiriam na página.

`icons/iconMask.ts` rasteriza o desenho uma vez (160px) para achar a silhueta:
o círculo de status da Imagem pousa no canto da tinta, e a conexão para a 4px
dela. Em jsdom a máscara não existe e tudo cai na caixa.

O seletor (`IconPicker`) é uma janela própria: pastas à esquerda, busca por
termos (ignora acento, varre rótulo, chave, pack e sinônimos), grade; escolha
imediata no clique; Esc fecha (listener de captura — o Grafana consome o Esc).

Na **Imagem**, `src` guarda data URI, URL ou chave do catálogo; quem separa é
`isKnownIcon`. O modo Biblioteca / Arquivo continua estado local derivado do
`src`, com o valor do modo abandonado guardado na sessão.

## Hover: um painel, dois conteúdos

`ElementHover` é **um por elemento**, e o conteúdo depende da fonte de estado:
alarmando → incidentes (pílula da severidade, nome, idade); métrica com gráfico
ligado → o gráfico; nenhum dos dois → nada.

Desde a v1.4 o popover é **próprio**, desenhado dentro do canvas como no mockup
(e não o `Tooltip` do Grafana, que traz moldura e fundo dele): o canvas publica o
próprio elemento em `HoverLayerContext`, e o popover nasce à direita do elemento
— à esquerda perto da borda —, encolhido para caber. Sem o canvas (testes), cai
no `document.body`.

Gatilho: hover **ou foco** abre; no dashboard, clique num elemento em alarme
fixa; Esc (captura) ou clique fora soltam. No editor o clique seleciona, e com
drill-down o clique navega — nos dois casos não há fixar. Some durante o arraste.

O gráfico (`MetricChart`) é SVG próprio no desenho do mockup: uma série por
métrica de estado, na janela de tempo do dashboard, com as regras de threshold
da métrica em linhas tracejadas. Uma métrica: legenda Name / Last / Max / Mean;
várias: um gráfico mais baixo por métrica. Os valores passam pelo `field.display`
(unidade, casas, value mappings do painel); os ticks do eixo usam no máximo uma
casa e a unidade do campo.

## Problemas junto ao elemento

Num telão ninguém passa o mouse. Desde a v1.4 há cinco formatos
(`trigger.activeDisplay`, ausente = `list`; `count` é o Total de antes), em
`canvas/Problems.tsx`:

- **Dentro do nó**, **Faixa** e **Contador** vivem dentro do cartão — só o nó os
  oferece; salvos em imagem ou point, caem na Lista;
- **Lista** é o cartão pendurado, preso por um conector, na posição escolhida;
- **Total** é uma linha, "N incidentes ativos", vestindo a maior severidade.

Continuam valendo: teto de três linhas (`+N outras`; o hover tem tudo), uma
linha por problema cortada no fim, e a extensão não recebe ponteiro — arraste,
seleção e conexão continuam do elemento. No nó, a posição só aparece no editor
para a Lista.

## Conexões: trajeto, paralelas, setas (v1.4)

A geometria é pura (`canvas/edges/path.ts`, testável sem React Flow): recorte na
borda +1.5px, curva quadrática com controle a 20%, paralelas a 20px sobre a
normal do sentido canônico do par (`parallelIndex` em `useFlowElements`), setas
no fim e no meio de cada segmento da polilinha.

O trajeto (`edge.waypoints`) é editado direto na aresta: `EdgeActionsContext`
entrega `setWaypoints`, o vértice selecionado e o menu do vértice — contexto, e
não `data` da aresta, porque o `data` congela entre reconstruções. O arraste
mantém um rascunho local e grava no `pointerup`. Delete com vértice selecionado
remove o vértice (`onBeforeDelete` devolve `false` para a aresta). Arrastar as
duas pontas pelo mesmo deslocamento leva o trajeto junto (`moveElements`);
inverter a conexão inverte a ordem dos vértices.

## Editor no desenho do mockup (v1.4)

O Layer é: "+ Adicionar elemento" (Nó, Postit, Texto, Imagem — o Point saiu do
menu, o trajeto o substitui), o cartão do elemento aberto (ou os cartões de
edição em massa) e a lista "Elementos" agrupada por tipo, com a cor do estado.

Controles próprios em `src/editors/ui/` mantêm a semântica que os testes e os
leitores de tela usam: o segmentado é um `radiogroup` de botões `radio` com
`aria-checked` e `aria-label`; a chave é `role="switch"` rotulada pelo `label`.
O "i" das dicas tem o glifo em `aria-hidden`, para não entrar no nome acessível do
campo. Selects nativos precisam de altura explícita — o CSS global do Grafana os
achata.

O bloco de Estado (`StateSection`) cuida das várias métricas. Remover a primeira
promove a segunda, e isso reescreve `color`, `thresholds` e `extraMetrics` numa
escrita só (`onMetricsChange`): três escritas separadas partiriam do mesmo
elemento e só a última valeria.

## Drill-down: um `<a>` de verdade

O elemento vira um `<a>` (`DrilldownSurface`), não um `div` com `onClick`. A
diferença aparece na mão do operador: ctrl+clique e clique do meio abrem noutra
aba, o endereço aparece na barra de status antes do clique, o Tab alcança o
elemento e o leitor de tela o anuncia como link. Nada disso se obtém
interceptando cliques.

`url` guarda o que o usuário digitou, **cru**. A interpolação de variáveis
acontece no clique, não no save: `/d/uid/host?var-host=$host` congelado no save
apontaria para o host de quem configurou o painel.

Endereço externo escrito sem esquema (`www.google.com`) ganha `https://`. Sem
isso, num `href` ele é um caminho relativo e o browser resolve contra a página
atual: `/d/uid/www.google.com`, um 404 do Grafana. Assume-se `https` e não
`http` porque o erro que ele produz é visível e corrigível; o contrário mandaria
credencial em claro. O editor mostra o endereço já completado, então a suposição
não é silenciosa.

## Screenshot

`html-to-image` serializa o DOM num `<foreignObject>` e desenha num canvas. O que
**não** é da biblioteca fica isolado em `screenshot.ts`, para poder ser testado:
qual retângulo cabe, em que resolução, e como o arquivo se chama.

- **Margem de 48px**: sem ela o elemento mais à esquerda encosta na borda e a
  legenda abaixo do último nó fica cortada — a caixa que o React Flow mede é a do
  nó, e legenda e lista de triggers vivem **fora** dela, em `position: absolute`.
- **Teto de 4096px no lado maior**, com a densidade caindo em vez de a imagem ser
  cortada. Uma topologia grande sai menos nítida; nenhuma sai pela metade.
- **Densidade 2x**: 1x devolveria uma imagem borrada exatamente onde ela precisa
  ser lida.
- **Animações congelam durante a captura** (`&[data-capturing] *`). A captura
  serializa os estilos **computados**, então sem isso a foto sairia com o elemento
  alarmado meio apagado — justamente o elemento por causa do qual alguém tira o
  screenshot.

## Menu de contexto

Itens variam por alvo (`pane` / `element` / `edge`) — um postit não linka, um
texto não reordena. Sem item "Colar": não há clipboard implementado, e **item
morto é pior que item ausente**.

Em modo View não há menu, mas o menu do browser também não aparece
(`preventDefault`): um menu nativo sobre o mapa não ajuda ninguém.

Desde a v1.4 o menu é **próprio** (`CanvasContextMenu`), no desenho do mockup:
título com o id do alvo (ou "canvas"), itens sem ícone, "Excluir" em vermelho.
Ganhou os alvos de trajeto — na conexão, "Adicionar vértice aqui", "Limpar
trajeto" (só com vértices) e "Inverter direção"; no vértice, "Remover vértice" e
"Limpar trajeto". O menu do canvas não oferece mais Point. Coordenadas: o estado
guarda as de tela (o clique) e o menu é desenhado relativo ao canvas, encolhido
para caber; fecha no clique fora e no Esc (listener de captura).

O resultado do screenshot virou o toast do canvas, como no mockup ("Imagem da
topologia baixada" com o nome do arquivo, ou a causa provável da falha).
