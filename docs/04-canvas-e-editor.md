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
| **Host + Item** | `color.metric` | há um datasource Zabbix configurado no painel |
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

Enquanto o painel não busca os próprios dados (bloco 3 do PRD), um vínculo por
host+item cuja série não está em nenhuma query rende um aviso no formulário e
**NO DATA** no elemento — que é a verdade: a métrica está escolhida e ninguém a
está medindo.

## Vínculo de trigger: o que a UI precisa comunicar

**Sem um datasource Zabbix configurado**, as listas de host e de trigger só
contêm o que está nos dados agora. Um host sem nenhum problema ativo não aparece
em lista nenhuma, porque o Query Mode _Problems_ só devolve problemas.

Daí duas decisões de UI, que continuam valendo nos dois casos:

- os dois combos aceitam valor digitado (`createCustomValue`);
- host desconhecido é **aviso**, nunca erro.

**Com um Zabbix configurado**, a lista passa a ser o catálogo do Zabbix e os
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

Chave salva: **`pack/nome`** (`classic/router`). Duas outras formas continuam
válidas para sempre:

- **sem pack** (`router`) — o formato de tudo que foi salvo antes de existirem
  pastas. Resolve no pack `classic`. É o que dispensa migrador.
- **desconhecida** — pack removido, ícone renomeado, JSON à mão. Cai no genérico
  em vez de sumir: um ícone que não existe mais não pode fazer o nó desaparecer.

Três packs, nesta ordem (packs de domínio vêm **depois** dos gerais):

| Pack          | Rótulo      | Natureza   | Nota                                                                        |
| ------------- | ----------- | ---------- | --------------------------------------------------------------------------- |
| `topoflow`    | Padrão      | `variants` | 11 famílias × 6 tons, estilo mapa do Zabbix                                 |
| `classic`     | Clássicos   | `glyph`    | os 10 originais; id não é `default` porque o pack padrão passou a ser outro |
| `petrolifera` | Petrolífera | `image`    | ativos do ramo do cliente + rádios de campo                                 |

Laranja e verde do pack `topoflow` foram **derivados por rotação de matiz** dos
arquivos existentes, girando só a cor dominante: sem a janela de ±45°, o display
azul do servidor e a lente da câmera giravam junto e o ícone deixava de ser o
mesmo desenho. O codec PNG foi escrito à mão — não há Pillow nem ImageMagick na
máquina de desenvolvimento.

O pack `petrolifera` é `image`: fotos e ilustrações de produto, sem a mesma arte
em seis tons (uma sonda de outra cor não é "a sonda em alarme"). Logo **não
anuncia estado** — quem anuncia é a placa opaca da cápsula — e o campo "Cor do
ícone" não aparece.

Decisões do seletor que são escolha, não acaso: escolha **imediata** no clique
(sem rodapé de confirmação — o canvas já mostra o resultado e o undo do dashboard
cobre o arrependimento); a coluna de pastas aparece **mesmo com um pack só**,
porque é a estrutura da biblioteca; a busca ignora acento nos dois sentidos e
varre rótulo, chave e sinônimos; quando não acha na pasta aberta mas acha em
outra, o vazio oferece o atalho para "Todos".

Na **Imagem**, `src` guarda três coisas — data URI, URL e chave do catálogo. Quem
separa é `isKnownIcon`, que só reconhece o que existe no catálogo, então uma URL
nunca é confundida com ícone. O modo do formulário (Biblioteca / Arquivo) é
**estado local derivado do próprio `src`**, e não campo do schema: seria uma
segunda fonte de verdade livre para discordar, e alternar não pode custar o que
já estava configurado.

## Hover: um painel, dois conteúdos

`ElementHover` é **um por elemento**, e o conteúdo depende da fonte de estado:

- **Trigger, alarmando** → tabela de incidentes (severidade, nome, tempo);
- **Métrica, com gráfico ligado** → a série da métrica no tempo;
- nenhum dos dois → não há painel.

Os dois nunca competem. Um `Tooltip` só, e não um por conteúdo, também é
necessidade técnica: o `Tooltip` do Grafana clona o filho e ancora nele por ref,
e dois aninhados fariam o de fora ancorar num componente de função, que engole a
ref em silêncio e abre o painel no canto da tela.

Gatilho: **hover abre, clique fixa**, Esc/clique fora solta. Em **modo de edição
o hover também vale** — o painel mudo no editor foi o primeiro tropeço de quem
testou. Ali o clique não fixa (já seleciona o elemento) e o painel some durante
o arraste.

O gráfico (`MetricChart`) plota a **mesma** métrica que decide a cor: não há
segundo seletor de propósito, porque ele existe para responder "de onde veio essa
cor". A janela de tempo é a do dashboard, lida de um contexto React
(`useTopoTime`) — quem mudou o time range espera que tudo na tela acompanhe.

O frame é **remontado** (tempo + valor) em vez de reaproveitado: o frame da query
costuma trazer várias métricas, e `field.config.custom` chega vazio porque
`module.ts` chama `.useFieldConfig()` sem opções de gráfico. Preenchendo, o traço
é uma decisão nossa e não um acidente.

## `ActiveTriggers`: o que fica na tela

Num telão ninguém passa o mouse. Quatro decisões carregam a forma:

- **Dois formatos, escolhidos pelo usuário** (`trigger.activeDisplay`, ausente =
  `list`): `list` mostra os nomes das triggers; `count` troca as linhas por uma
  só, **"4 incidentes ativos"**, de altura fixa para qualquer número de alarmes.
  A linha do total veste a **maior severidade em curso**, como a primeira linha
  da lista vestiria — trocar de formato muda quanto se lê, nunca o que a cor
  diz. Os nomes não se perdem: vão para o `title` da linha e para o hover.
- **Teto de três linhas.** Um NOC em pico tem elementos com dez ou quinze
  alarmes, e sem teto a lista de um nó cobriria os elementos abaixo dele. O que
  sobra vira `+N outras`, e o hover tem a lista completa.
- **Uma linha por trigger, cortada no fim.** Altura previsível importa mais que o
  nome inteiro: com quebra, dois alarmes de nome longo empurram o dobro de altura
  sobre a cena.
- **Não recebe ponteiro** (`pointerEvents: 'none'`): o arraste, a seleção e o
  gesto de conexão continuam pertencendo ao elemento. A extensão é legenda, não
  alvo.

A **posição** é escolhível entre quatro lados (não cantos), com o campo escondido
quando a lista está desligada: a topologia é que decide onde há espaço — elemento
na borda inferior joga a lista para fora. O **formato** fica no mesmo lugar, pelo
mesmo motivo, e o rótulo é "Formato da lista" e não "Formato": as seções nativas
do painel de opções já têm meia dúzia de campos chamados "Formato", e é o par com
"Posição da lista" que diz de que lista se está falando.

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
