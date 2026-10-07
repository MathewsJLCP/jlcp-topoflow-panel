# 03 — Estado e cor

O documento mais importante do produto: é aqui que o painel decide o que ele
está dizendo ao operador. Tudo isso vive num helper único,
`resolveElementColor` em `src/data/elementColor.ts`, reaproveitado por **todos**
os elementos. Nunca duplicar a lógica por componente — foi exatamente a
duplicação que permitiu a divergência original entre nó, aresta e point.

## A cadeia de precedência

```
0. trigger do Zabbix alarmando   → estado
1. regra do bloco Thresholds do próprio elemento → estado
2. color.fixed (a linha "Base" no editor)        → identidade visual
3. token neutro do tema                          → fallback
```

**Branco nunca é fallback de nada.** Antes do helper único, o fallback era
`getColorByName('text')` — e `'text'` é um nome de cor **válido** do Grafana que
resolve para `text.primary`, quase branco no tema escuro. Era essa a causa de
todo elemento novo (nó, point, texto e aresta) nascer branco.

Os estados possíveis:

```ts
type ElementColor =
  | { state: 'trigger'; color; severity; label; problems; animation? }
  | { state: 'threshold'; color; label?; animation? }
  | { state: 'nodata' } // binding configurado, sem dado que sirva
  | { state: 'fixed'; color }
  | { state: 'neutral' }; // sem binding e sem acento
```

### Qual série o nível 1 observa

O vínculo por métrica tem dois formatos salvos — `color.field` (o display name do
frame) e `color.metric` (host + item do Zabbix) —, e **um único lugar** traduz um
no outro: `stateFieldName`, em `src/data/dimensions.ts`. Quem resolve cor,
gráfico ou aviso de editor chama essa função, nunca `color.field` direto.

A tradução tem duas respostas possíveis porque o datasource nomeia a série com o
nome do item e só prefixa `"<host>: "` quando **aquela query casou mais de um
host** — ou seja, o mesmo item muda de nome conforme a query cresce. As duas são
tentadas, da mais específica para a menos.

Não achar nenhuma **não é** o mesmo que não ter vínculo: a função devolve o nome
qualificado assim mesmo, para a cadeia cair em `nodata`. Devolver `undefined` ali
faria o elemento exibir a Base — dizendo "nada acontecendo" sobre algo que
ninguém está medindo.

Com a seção **Zabbix** ligada não há ambiguidade nenhuma: o painel renomeia as
séries que busca para exatamente `"<host>: <item>"`, com a grafia de host que o
vínculo guardou — o primeiro candidato sempre casa.

`nodata` e `neutral` não carregam cor de propósito: não são ausência por
descuido, são estados cujo tratamento visual é decisão de cada elemento (o point
cai em `primary.main`, o texto em `text.primary`, a aresta em `border.medium`).

### Nível 0 não concorre com o nível 1

Com o vínculo de trigger **ligado**, o nível 1 é pulado por inteiro. São duas
fontes de estado, e deixar as duas ativas significaria um elemento vermelho por
CPU e verde por trigger ao mesmo tempo — o operador não teria como saber qual
está lendo.

Nada é perdido: as duas configurações continuam no JSON e voltam a valer ao
desligar a flag.

## O pipeline nativo do Grafana **não** pinta elemento

Mudança de 2026-09-02, e a decisão mais contra-intuitiva do plugin.

Havia um nível entre 1 e 2: sem regra própria, o elemento era pintado pelos
**thresholds do field** — os configurados no painel de opções do Grafana. Ele
existia de quando o elemento não tinha bloco de Thresholds próprio, e virou a
armadilha que a cadeia dizia querer evitar: uma **Base laranja escolhida no
elemento era ignorada** em favor do step base azul configurado em outro painel,
sem nada na tela do elemento dizer isso.

Hoje: **lista vazia = sem estado = Base.**

Os thresholds e value mappings nativos seguem valendo para o que sempre foram:

- **formatar o valor** — o texto "UP" de um value mapping ainda vem de lá;
- **colorir o `MetricChart`**, que é um `TimeSeries` nativo com o pipeline
  nativo inteiro.

O que eles não fazem mais é decidir a cor do elemento pelas costas do editor.

> **Consequência a conhecer ao atualizar:** um elemento que dependia do
> threshold do field para acender passa a exibir a Base até ganhar a regra
> equivalente no bloco dele.

### Por que divergir do Canvas nativo

O painel é usado em NOC, onde **verde significa "verificado OK"**. Herdar o step
base verde do Grafana faria todo nó com binding nascer verde sem nenhuma regra
definida — mentira operacional. O custo de divergir do Canvas nativo é menor que
o de um falso "tudo OK".

Pelo mesmo motivo, **"sem dado" tem que ser visualmente distinto de
"saudável"**: `text.disabled` mais badge `NO DATA`, nunca `defaultColor` e nunca
verde.

## O bloco de regras

Um bloco só, que funde os dois mecanismos que o Grafana mantém separados —
**Thresholds** (faixa aberta) e **Value mappings** (valor exato, faixa fechada,
regex, especiais). Separados, configurar um elemento exigia visitar dois lugares
que produzem a mesma coisa, com precedências que só quem conhece o core prevê.

Seis tipos de regra:

| `type`      | Casa quando                                     | Eixo        |
| ----------- | ----------------------------------------------- | ----------- |
| `threshold` | `valor >= value`                                | métrica     |
| `value`     | `String(valor) === match`                       | métrica     |
| `range`     | `from <= valor <= to`                           | métrica     |
| `regex`     | `pattern` casa com o valor                      | métrica     |
| `special`   | valor é `null`, `NaN`, `true`, `false` ou vazio | métrica     |
| `severity`  | `severidade do alarme >= atLeast`               | **trigger** |

Três desvios deliberados em relação ao core:

1. **Não existe step base dentro da lista.** No core o base é `-Infinity`, que
   pinta tudo abaixo da primeira regra — é a fonte do "verde por omissão". Aqui,
   valor abaixo de todas as regras significa "sem estado", e a cadeia segue para
   a **Base** (`color.fixed`), apresentada ao pé da lista.
2. **Cor é obrigatória em toda regra.** No Value mappings do core ela é
   opcional. Uma regra sem cor só produziria texto, e num elemento de topologia
   o texto é o acessório: quem carrega o estado é a cor.
3. **Só modo absoluto.** O modo percentual do core depende de min/max do field,
   que nem sempre existe; um seletor que só funciona às vezes é pior que não ter
   seletor.

Por isso `getActiveThreshold` do `@grafana/data` **não é usado**: ela assume o
step base em `-Infinity` e sempre devolve algum step.

### Dois eixos na mesma lista

Regras de métrica e de severidade convivem no mesmo array. A resolução consulta
só o eixo que está valendo naquele momento (`data/thresholds.ts`). Sem essa
separação, uma regra `>= 90` casaria com uma severidade 5 e um elemento em
_Disaster_ sairia pintado por uma regra de CPU.

`hasOwnThresholds` conta **só o eixo de métrica**, pelo mesmo motivo.

## Triggers do Zabbix

### O frame de Problems não é colunar

Não existem colunas `Host`, `Severity` ou `Status`. O datasource devolve **um
único field de objetos**:

```
{ name: 'problems', refId, length: N,
  fields: [{ name: 'Problems', type: FieldType.other,
             config: { custom: { type: 'problems' } },
             values: ProblemDTO[] }] }
```

A consequência que importa: `applyFieldOverrides`, `field.display`, thresholds e
value mappings **não se aplicam** a este field. Nada do pipeline nativo de cor
passa por aqui — o mapa de severidade é do plugin.

O critério de detecção espelha o `isProblemsDataFrame` do próprio grafana-zabbix
(mesmo critério do painel oficial de Problems), com um `?.` a mais em
`config.custom`, que o original assume existir.

### Mapa de severidade

| #   | Nome           | Cor                                             |
| --- | -------------- | ----------------------------------------------- |
| 0   | Not classified | `text.secondary` (não é nome de cor do Grafana) |
| 1   | Information    | `blue`                                          |
| 2   | Warning        | `yellow`                                        |
| 3   | Average        | `orange`                                        |
| 4   | High           | `red`                                           |
| 5   | Disaster       | `dark-red`                                      |

Cores por **nome**, resolvidas com `theme.visualization.getColorByName` — nunca
hex —, a mesma via do acento fixo. É o que mantém o tema no controle nos dois
modos.

`0` é `undefined` no mapa de propósito: o neutro certo é `text.secondary`, e o
nome que existiria (`'text'`) resolve para `text.primary`, quase branco no dark.

### Match de host

Exato e case-insensitive, contra `hosts[].name` **e** `hosts[].host`. Nunca
`contains`: `MMV-FW-STARTI-01` casaria com `MMV-FW-STARTI-011` e o elemento
acenderia por um problema que não é dele.

Host vazio não casa com nada — um vínculo ainda não configurado não pode herdar
o problema do primeiro host da lista.

### Regra própria de severidade vence o mapa do Zabbix

Mesma lógica que tirou o pipeline nativo da cadeia: quem escreveu regra para
aquele elemento tem autoridade sobre ele. Sem nenhuma regra de severidade, o
alarme é pintado pelo mapa padrão acima.

### Severidade desligável

Uma regra de severidade tem `enabled?: boolean` (ausente = ligada). O nível
desligado é descartado **antes** da severidade máxima, então não acende, não
conta no badge e não entra na lista — o elemento fica na Base.

Filtrar só a cor deixaria dois lugares contando histórias diferentes sobre o
mesmo elemento.

Serve para o ruído conhecido: um parque cheio de _Information_ que ninguém
atende deixaria o mapa inteiro aceso o tempo todo, e um mapa sempre aceso não
avisa nada.

> Atenção numa escada **esparsa** (JSON editado à mão): a regra é "a partir de",
> então desligar `atLeast: 1` alcança todos os níveis acima. O editor
> materializa as seis linhas justamente por isso.

### Os quatro silêncios

`resolveTriggerState` devolve `undefined` — o elemento segue a cadeia normal — em
cinco situações, todas levando ao mesmo lugar:

1. vínculo desligado;
2. nenhuma query de Problems no painel;
3. host sem correspondência nos frames;
4. host correspondente, sem trigger em PROBLEM (o caso saudável);
5. só há alarmes de severidade que o elemento desligou.

(2) e (3) são **ambíguos por natureza**: com `showProblems: problems`, um host
saudável e um host digitado errado produzem exatamente o mesmo frame — nenhuma
linha. Não dá para distingui-los no canvas sem inventar estado, então o aviso
vive **no editor**, onde quem pode corrigir está olhando.

## O que a cor não responde

Cor e severidade dizem **o quão ruim** está. Não dizem **o que** está ruim — e um
elemento vermelho por quinze motivos é indistinguível de um vermelho por um.

Por isso `resolveTriggerState` devolve `problems: ActiveProblem[]` com **todas**
as triggers alarmando, e não só a que definiu a cor. A cor continua sendo a do
pior caso: a lista informa, ela não arbitra.

Ordem da lista: severidade desc, **depois nome**. O desempate por nome é
deliberadamente estático — ordenar por horário seria mais informativo por um
instante e pior no uso, porque a lista se reorganizaria a cada refresh, debaixo
do olho de quem está lendo.

O tempo ("há 4m") vem de `timestamp` do DTO. **Não é `lastchange`**: o
`joinTriggersWithProblems` do grafana-zabbix monta o objeto com
`timestamp: Number(clock)` e descarta o `lastchange` que a trigger trazia.
`lastchange` fica como fallback.

Três superfícies mostram isso, em ordem de esforço do operador:

| Superfície                 | Onde                                                     | Para quem                                  |
| -------------------------- | -------------------------------------------------------- | ------------------------------------------ |
| Badge/chip                 | no elemento                                              | telão: "algo caiu aqui"                    |
| `ActiveTriggers` (`list`)  | fixa junto ao elemento, até 3 linhas + `+N outras`       | telão: "o que caiu"                        |
| `ActiveTriggers` (`count`) | fixa junto ao elemento, uma linha: "4 incidentes ativos" | telão denso: "quanto caiu"                 |
| `ElementHover`             | hover/clique                                             | operador que se aproxima: tabela com tempo |

Na **conexão** não existe `ActiveTriggers` — é um traço, não tem "embaixo" — e
por isso ela é o único elemento em que o chip ainda carrega severidade e
contador.

## Contraste: por que não basta `getContrastText`

Quando a cor de estado preenche o fundo de um elemento, a cor do texto tem que
vir junto. `stateFill.ts` resolve as duas no mesmo lugar — escolher o fundo sem
escolher o texto foi o que deixou nó amarelo com texto quase branco.

O helper do tema usa `contrastThreshold`, que vale **3**: o critério WCAG AA para
_texto grande_ (24px). O texto do nó é 14px e 12px, então o critério aplicável é
**4.5**. A diferença não é acadêmica:

| Fundo           | Branco | Preto  | O helper escolhe | Deveria |
| --------------- | ------ | ------ | ---------------- | ------- |
| `red` `#F2495C` | 3.57 ✗ | 5.88 ✓ | branco           | preto   |
| `blue`          | 3.03 ✗ | 6.92 ✓ | branco           | preto   |

São justamente as duas cores mais frequentes num NOC. Então `stateFill` mede os
**dois** candidatos e escolhe o de maior contraste, em vez de aceitar o primeiro
que passe de 3. O truque para obter os dois tokens sem escrever `#fff`/`#000`:
chamar `getContrastText` com limiar `1` (sempre claro) e `22` (sempre escuro) —
nenhuma razão de contraste é menor que 1 nem maior que 21.

`stateFill.test.ts` prova que toda a paleta alcançável passa de 4.5 nos dois
temas.

## Ícones que acompanham o estado

Um ícone tem **natureza**, e ela decide se ele pode acender:

| `kind`     | O que é                                       | Acende?                            |
| ---------- | --------------------------------------------- | ---------------------------------- |
| `glyph`    | SVG inline que herda `currentColor`           | sim, pela cor                      |
| `image`    | arte colorida (PNG, logo, foto de produto)    | não — quem anuncia é a placa atrás |
| `variants` | a mesma figura em vários arquivos, um por tom | sim, **trocando de arquivo**       |

`variants` é a terceira natureza, descoberta com o material do cliente (11
famílias × 4-6 cores, no estilo mapa do Zabbix), e ela desfaz a oposição
glifo × figura que estruturava o desenho original.

O tom sai da **cor já resolvida pela cadeia, por matiz** (`canvas/iconTone.ts`),
e não da severidade. É o que faz a regra valer nos dois modos: o ícone acompanha
exatamente a cor que a regra pintou. Cada cor nomeada do Grafana cai no tom
homônimo; roxo vai para azul e magenta para vermelho (vizinhos cromáticos);
saturação < 15% cai em cinza.

> Usa saturação **HSV**, não HSL. Com HSL, `dark-red` (Disaster) viraria cinza.

## Animação de alerta

Cor sozinha não chama atenção num telão: dez elementos vermelhos parados não
dizem qual acabou de cair. O movimento é o que separa "está ruim" de "acabou de
ficar ruim".

Três animações: **pulsar** (escala), **piscar** e **radar** (duas ondas
circulares defasadas). A aresta é um `<path>` — escalar deformaria o traço, então
ela só respira; e radar numa aresta cairia na mesma coisa que o pulse, por isso
não é oferecido lá.

Duas restrições obrigatórias moldaram tudo:

- **Só `transform` e `opacity`.** São as duas propriedades que o compositor
  resolve sozinho, sem recálculo de layout nem repintura. Animar `width` ou
  `box-shadow` derrubaria o quadro numa topologia com dezenas de elementos
  alarmados — exatamente o momento em que o painel precisa continuar fluido.
- **Tudo sob `prefers-reduced-motion`**, via o helper `motionOnly`.

O `blink` **não pisca de verdade**. Liga-desliga duro, repetido em vários
elementos num telão aberto o dia inteiro, cansa e acaba fazendo o operador
desligar o painel — o oposto do objetivo. É uma respiração lenta de opacidade.

A animação é **coluna da regra**, nos dois eixos: cada faixa e cada severidade
anima do seu jeito (`>= 75` pulsa, `> 90` faz radar; _High_ pulsa, _Disaster_ faz
radar). Onde a regra estiver, está a animação dela.

## Regras de estilo que valem para todo o canvas

1. **Zero cor literal em componente.** Só token de `theme.colors.*` via
   `useStyles2`, ou a cor resolvida pela cadeia. Ao revisar qualquer componente,
   dar `grep` por `#`, `rgb` e nomes CSS antes de aprovar.
2. **Cuidado com `'text'`.** É um nome de cor válido do Grafana que resolve para
   `text.primary`. Foi a causa-raiz de nós e arestas nascerem brancos.

Detalhe completo em [estilo-elementos-canvas.md](estilo-elementos-canvas.md).
