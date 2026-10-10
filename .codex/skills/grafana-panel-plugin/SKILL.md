---
name: grafana-panel-plugin
description: Receituário para desenvolver plugins de painel do Grafana em React — modelagem com Zod sem migrador, vínculo com DataFrames, cadeia de cor e tema, React Flow, e as armadilhas de plataforma que não estão na documentação oficial. Use ao criar ou manter um panel plugin, ao modelar panel.options, ao resolver cor/estado a partir de dados, ao integrar com o datasource Zabbix, ou ao depurar "o painel não deixa editar", "o elemento nasceu branco", "o dado congelou", "o parse quebrou depois do save".
---

# Plugin de painel do Grafana: o que fazer e o que evita retrabalho

Destilado da construção do **TopoFlow** (`mdomingos-topoflow-panel`), um painel de
topologia editável com ~730 testes. Cada regra aqui corrigiu um bug real.

> **Sua memória sobre a API do Grafana está desatualizada.** Busque a
> documentação em grafana.com — o índice é
> https://grafana.com/developers/plugin-tools/llms.txt e qualquer página vira
> markdown puro acrescentando `.md` ao caminho.

## Antes de escrever a primeira linha

1. **`.useFieldConfig()` é obrigatório** no `PanelPlugin`, mesmo que você não
   queira as opções que ele adiciona. É o que faz o Grafana rodar
   `applyFieldOverrides` e popular `field.display` — sem ele **não existe vínculo
   de dados**, e o sintoma é `field.display === undefined` sem nenhuma mensagem.

   ```ts
   export const plugin = new PanelPlugin<Options>(Panel).useFieldConfig().setPanelOptions(addOptions);
   ```

2. **Não modifique `.config/`.** É do `@grafana/create-plugin` e é sobrescrito no
   próximo update. Estenda pelos arquivos da raiz, que já herdam de lá.

3. **Não mude `id` nem `type` do `plugin.json`**, e lembre que **qualquer**
   alteração nesse arquivo exige reiniciar o Grafana (o `module.js` recarrega
   sozinho; o `plugin.json` não).

## Modelagem: Zod é a fonte da verdade

```ts
// schema.ts — declare aqui
export const nodeSchema = z.object({ id: z.string().min(1), /* … */ });
// types.ts — derive, nunca escreva à mão
export type Node = z.infer<typeof nodeSchema>;
```

`panel.options` fica dentro do JSON do dashboard, que **viaja inteiro em toda
leitura**. Isso decide coisas de arquitetura: dado repetido por elemento (um logo
em base64, por exemplo) deve virar uma biblioteca no nível do painel.

### Evoluir sem migrador — a disciplina que vale ouro

Um plugin inteiro pode ser construído com `schemaVersion: 1` do início ao fim:

- **Campo novo é `.optional()` ou tem `.default()`.** Use `.optional()` quando
  *ausente já significa alguma coisa* ("ausente = desligado" dispensa uma flag
  separada para manter em sincronia). Use `.default(x)` quando ausente é
  indistinguível de `x`.
- **Coleção nova ganha `.default([])`** — assim uma topologia salva sem ela ainda
  valida.
- **Ampliar enum é retrocompatível.** Estreitar não é. Para chaves de catálogo
  (ícones, temas), use `z.string()` e resolva desconhecido para um fallback: assim
  renomear um item não invalida o que está salvo.
- **Modo novo vira campo paralelo, não `discriminatedUnion` sobre um `mode`.**
  Dá retrocompatibilidade de graça **e** permite alternar entre modos sem
  descartar configuração — que é o que o usuário espera.

⚠️ **Zod 4 aplica `.default()` DEPOIS de rotear pelo discriminador.** Um
`z.literal('x').default('x')` dentro de `discriminatedUnion` **não** salva o
objeto legado: o parse falha com "No matching discriminator" antes de chegar lá.
Quando o union for inevitável, carimbe antes:

```ts
z.preprocess((raw) => (typeof raw === 'object' && raw && !('type' in raw) ? { ...raw, type: 'legado' } : raw),
             z.discriminatedUnion('type', [...]));
```

⚠️ **Remover um campo do schema não dá erro** — o Zod faz strip. Mas o campo some
do JSON no primeiro save, em silêncio. Decida isso conscientemente.

### Validação: por seção, e o caminho de erro importa mais que o feliz

```ts
// Cada seção valida sozinha: um `gridSize` corrompido não pode derrubar
// o desenho que alguém passou uma tarde fazendo.
const topology = parseSection('topology', topologySchema, source.topology, defaults.topology, issues);
const canvas   = parseSection('canvas',   canvasSchema,   source.canvas,   defaults.canvas,   issues);
```

E **ausente ≠ corrompido**: seção ausente cai no default *em silêncio* (é o painel
recém-adicionado); seção presente que não valida cai no default *com aviso*
(significa dado perdido).

**A regra que salva o trabalho do usuário:** se o que está salvo não validou, o
componente exibe o default — e **qualquer escrita a partir dali apagaria o
original**. O dashboard não distingue essa escrita de nenhuma outra. Então:

```ts
if (dadoSalvoInvalido) { return; }        // não escreva
const editable = !dadoSalvoInvalido && …; // e não deixe editar
```

Mais um `<Alert>` dizendo que o dado continua no JSON e não será sobrescrito.

**Integridade referencial por descarte, não por erro.** Referência quebrada e id
duplicado devem ser filtrados; rejeitar o objeto inteiro perde tudo por causa de
uma linha.

**Default de item novo: vazio.** Não semeie um exemplo em `defaultValue` — quem
adiciona o painel para desenhar a própria coisa começa apagando a de outra
pessoa, e o exemplo também aparece pelo caminho de erro, sugerindo que o trabalho
foi substituído. Guarde o exemplo como fixture de teste e ponha uma dica discreta
no estado vazio.

## Dados: DataFrames e o pipeline nativo

- **Aqueça `cacheFieldDisplayNames(data.series)` uma vez**, no ponto mais alto que
  consome as séries. `getFieldDisplayName` recalcula a cada chamada e pode
  desambiguar diferente entre elas — dois hosts na mesma query recebem nomes
  instáveis e um vínculo salvo para de encontrar o field.
- **`field.display(value)`** já devolve texto, unidade, prefixo, sufixo e cor com
  thresholds **e** value mappings aplicados. Não reimplemente formatação.
- **Ao exibir, use prefixo e sufixo**, não `display.text` cru: é neles que a
  unidade viaja. Uma métrica em porcentagem vira `92` em vez de `92%`, e nada na
  tela diz que faltou algo.
- **`getActiveThreshold` sempre devolve um step** (o base em `-Infinity`). Se o
  produto precisa do estado "nenhuma regra casou", escreva a avaliação — é curta.
- **Distinga três ausências**: field que não existe nas séries, field que existe
  sem valor, e valor abaixo de todas as regras. São três estados com
  apresentações diferentes. Em monitoramento, **"sem dado" tem que ser
  visivelmente distinto de "saudável"** — senão um painel mudo passa por painel
  saudável.

## Cor e tema

⚠️ **`'text'` é um nome de cor válido do Grafana** e resolve para
`theme.colors.text.primary` — quase branco no dark. Usá-lo como fallback de "sem
cor" pinta tudo de branco, e não falha ruidosamente. Elemento sem cor guarda
`{}`, não `{ fixed: 'text' }`.

**Zero cor literal em componente.** Só token de `theme.colors.*` via `useStyles2`,
ou a cor resolvida pela sua cadeia. Ao revisar, dê `grep` por `#`, `rgb` e nomes
CSS antes de aprovar.

**Guarde nome de cor, nunca o valor resolvido.** Resolver na hora de salvar
congela o tema vigente na edição, e a placa fica clara num dashboard escuro.

⚠️ **`theme.colors.getContrastText()` usa `contrastThreshold: 3`** — o critério
WCAG AA para texto **grande** (24px). Para 12–14px o critério é **4.5**, e sobre
o `red` e o `blue` da paleta o helper escolhe branco quando o preto contrasta
quase o dobro. Meça os dois candidatos e escolha o maior. Para obtê-los sem
escrever `#fff`/`#000`, chame o helper com limiar `1` e `22`.

**Resolva a cor em UM helper**, reaproveitado por todos os elementos. Cada
componente decide só em qual superfície a cor pousa, nunca como ela é escolhida —
duplicar a decisão é o que faz dois elementos divergirem.

**Em monitoramento, cuidado com verde.** Herdar o step base verde do Grafana faz
todo elemento com binding nascer verde sem nenhuma regra definida: mentira
operacional. Prefira "sem regra = cor de repouso" a "sem regra = o que o pipeline
nativo achar".

## Interação e ciclo de vida

⚠️ **Para saber se está no editor, leia a URL — não `usePanelContext().app`.**
No Grafana 13 o `VizPanel` do `@grafana/scenes` constrói o panel context uma vez
com `app: CoreApp.Unknown`, e o core **muta** `context.app` depois, sem re-render.
O sintoma é cruel: o painel funciona ao chegar por URL direta e nasce inerte ao
chegar navegando.

```ts
const editable = locationService.getSearchObject().editPanel !== undefined;
```

É o que o canvas nativo faz. Leia a cada render — é de graça e dispensa sincronia.

⚠️ **O editor de opções recebe o valor salvo CRU**, sem passar pelo seu Zod.
Todo `.default([])` que existe para aceitar dado antigo não vale nada ali:
normalize com o mesmo schema no topo do editor, ou a aba inteira cai com
`Cannot read properties of undefined (reading 'map')`.

⚠️ **O Grafana consome o `Esc`** antes que ele chegue a um listener de bubbling.

**`instanceState` do `PanelContext`** é o único canal entre o componente do painel
e o editor de opções (árvores React separadas). A API é `@alpha` e vale só em
dashboard: **todo acesso a ela tem que ser opcional dos dois lados**. E publique
referências estáveis, ou você republica a cada quadro de um arraste.

**Escrita em `options` durante gesto contínuo pede debounce curto (~80ms).** Longo
demais abre uma janela em que o commit ainda não aconteceu: se o painel desmontar
ali (fechar o editor, salvar o dashboard), o cleanup descarta o gesto.

**Estado de UI (seleção, acordeão aberto) não vai para `options`** — mas
sobreviva à reconstrução: case por **id**, nunca por posição.

## Componentes do `@grafana/ui`

- **`Tooltip` aninhado ancora no canto da tela.** Ele clona o filho e ancora por
  ref; o de fora acaba ancorando num componente de função, que engole a ref em
  silêncio. Um `Tooltip` por elemento, com o conteúdo decidido dentro.
- **`RadioButtonGroup` com `icon` + `ariaLabel` fica mudo.** Use `label` (o glifo)
  + `description`, que vira tooltip.
- **`Combobox` mede texto com canvas** e **`ScrollContainer` usa
  `IntersectionObserver`** — os dois quebram no jsdom. Ver os stubs abaixo.
- **O menu do `Combobox` é virtualizado**: no jsdom não renderiza opção nenhuma.
  Extraia a lógica que ele dispara para uma função pura e teste-a diretamente.

## React Flow (se o painel for um canvas)

| Faça | Em vez de | Porque |
| --- | --- | --- |
| `width`/`height` **do nó** | dimensão em `style` | é onde o `NodeResizer` escreve; `style` é inline e vence |
| `elevateNodesOnSelect={false}` | o default `true` | ele reescreve o `zIndex` ao selecionar e quebra suas camadas |
| `nodeTypes` como constante de módulo | objeto novo a cada render | remonta todos os nós |
| `position: relative` + `width`/`height` do `PanelProps` | `height: 100%` | `100%` mede zero na primeira renderização |
| provider externo | usar `screenToFlowPosition` direto | ela só existe dentro do `ReactFlowProvider` |

⚠️ **O `data` do nó congela.** O React Flow guarda nós em estado local e só os
reconstrói quando os dados de origem mudam — então tudo que muda por fora
(`frames`, `editable`) precisa ser reinjetado a cada render, e **um tipo de nó
esquecido nessa função congela em silêncio**. Sintomas relatados como "cache":
valor parado no tempo, alça de resize que não aparece.

- Para valores iguais no canvas inteiro (janela de tempo, tema): use **React
  context** — ele não tem esse modo de falha.
- Para valores por nó: mantenha a reinjeção, mas escreva um `switch`
  **exaustivo** sobre a união de tipos, para o TypeScript cobrar o caso novo.

## Testes

**O jsdom não faz hit-testing.** Seleção, arraste e menu de contexto **não podem**
ser testados nele. Um bug de "não dá para editar" pode atravessar meia dúzia de
commits sem nenhum teste falhar. **Valide no browser antes de entregar** qualquer
coisa que toque interação, e cubra as três com Playwright.

Stubs obrigatórios em `jest-setup.js`:

```js
// `getContext` existe no jsdom mas devolve null: substitua INCONDICIONALMENTE
// (um guard por existência não pega o caso). Proxy, não objeto: o uPlot chama
// dezenas de métodos, e enumerá-los é lista para manter em dia.
HTMLCanvasElement.prototype.getContext = function () { /* Proxy */ };
globalThis.IntersectionObserver ??= class { observe(){} unobserve(){} disconnect(){} takeRecords(){return []} };
```

Imports de imagem precisam de transform próprio — e ele deve devolver o **nome do
arquivo**, não um stub genérico: com stub único, um teste que escolhe entre
`icone-vermelho.png` e `icone-cinza.png` passa **inclusive quando escolhe
errado**.

E2E com `@grafana/plugin-e2e`:

- `waitUntil: 'domcontentloaded'` é obrigatório — o default `'load'` não resolve,
  porque o app mantém conexões abertas;
- ancore em classe própria (`.meu-card`), não em estrutura do DOM (`> div`);
- provisione um dashboard que **fixe os contratos** que você não quer quebrar
  (cada elemento dele provando uma regra) e trate-o como código.

**Escreva sempre estes testes:** (1) carregar um objeto salvo **sem** o campo
novo — é o que prova que não há migrador necessário; (2) cada estado de ausência;
(3) contraste, se mexeu em cor.

## Empacotar e instalar

`dist/` **é** o plugin — nada mais precisa ir para lá. O zip precisa ter uma
pasta com o **id do plugin** na raiz:

```bash
npm ci && npm run build
mkdir -p /tmp/pkg/<id> && cp -r dist/. /tmp/pkg/<id>/
(cd /tmp/pkg && zip -qr ~/<id>-<versão>.zip <id>)
```

⚠️ **Não apague o diretório de saída** se ele estiver montado num container de
desenvolvimento: o bind mount resolve o inode na criação, e `rm -rf dist` deixa o
container com um mount órfão (`no such file or directory` no próximo `up`). Limpe
o conteúdo (`rm -rf dist/*`) ou recrie com `docker compose up -d --force-recreate`.

Sem assinatura, o Grafana precisa de
`allow_loading_unsigned_plugins = <id>` (ou
`GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS`) — liste **só os ids necessários** —
e de um **restart**. Antes de assinar para distribuir, resolva a licença de
qualquer asset de terceiro embutido.

## Princípios de produto que couberam no código

1. **Nunca descarte configuração do usuário.** Alternar entre modos deve preservar
   os dois lados no JSON.
2. **Ausente significa desligado** — não crie uma flag separada para manter em
   sincronia com o objeto que ela liga.
3. **A decisão mora em um lugar só.** Toda divergência entre elementos parecidos
   vem de decisão duplicada.
4. **O aviso vive onde quem pode corrigir está olhando** — no editor, não na
   visualização.
5. **Item morto é pior que item ausente.** Não deixe menu com opção que não faz
   nada "para implementar depois".
