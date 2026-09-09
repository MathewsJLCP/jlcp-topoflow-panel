# 02 — Modelo e persistência

## A regra de ouro

> **O tipo nasce do schema Zod. Nunca escreva um tipo do modelo à mão.**

`src/model/schema.ts` é a fonte da verdade; `src/model/types.ts` só faz
`z.infer`. Se as duas coisas fossem escritas separadamente, elas divergiriam — e
a divergência apareceria em produção, na forma de um campo que o TypeScript
aceita e o parse descarta em silêncio.

```ts
// schema.ts
export const topoNodeSchema = z.object({ id: z.string().min(1) /* … */ });

// types.ts
export type TopoNode = z.infer<typeof topoNodeSchema>;
```

## Onde os dados vivem

Tudo o que o usuário configura fica em **`panel.options`**, dentro do JSON do
dashboard:

```json
{
  "options": {
    "schemaVersion": 1,
    "topology": { "nodes": [], "edges": [], "points": [], "postits": [], "texts": [], "images": [] },
    "canvas": { "showGrid": true, "snapToGrid": true, "gridSize": 16, "inlineEditing": false }
  }
}
```

Consequências que moldaram o desenho:

- **O JSON inteiro do dashboard viaja em toda leitura.** Foi por isso que o
  upload de imagem virou biblioteca do painel em vez de cópia por elemento: o
  mesmo logo em 20 nós entraria 20 vezes no dashboard.
- **Não há backend para onde subir arquivo.** O upload vira data URI dentro do
  JSON, daí o teto de tamanho no editor e daí a URL continuar existindo como
  saída para imagem grande.
- **Qualquer escrita do canvas é indistinguível de qualquer outra** para o
  dashboard. É por isso que o painel se cala quando a topologia salva não valida
  — ver "O caminho de erro" abaixo.

## Evoluir o schema sem migrador

`SCHEMA_VERSION` é `1` desde o começo e **nunca precisou subir**, em uma v1.0
que ganhou seis tipos de elemento, biblioteca de ícones, triggers, drill-down,
animação e gráfico de hover. Isso não foi sorte: é uma disciplina de três
regras.

### 1. Campo novo é opcional, ou tem `.default()`

```ts
// Topologia salva antes de `images` existir continua validando.
images: z.array(topoImageSchema).default([]),

// Nó salvo antes de `showIcon` continua exibindo o ícone, que era o único
// comportamento possível até então.
showIcon: z.boolean().default(true),
```

A escolha entre `.optional()` e `.default(x)` não é estética:

| Use           | Quando                                                                                                                                            |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.optional()` | **Ausente já significa alguma coisa.** `secondaryText` ausente = desligado; `drilldown` ausente = não navega; `background` ausente = transparente |
| `.default(x)` | Ausente é indistinguível de `x`, e ter o valor explícito simplifica quem lê                                                                       |

O padrão "ausente significa desligado" evita uma classe inteira de bug: não
existe flag separada para manter em sincronia com o objeto que ela liga.

### 2. Campo paralelo, nunca `discriminatedUnion` sobre um modo

O vínculo de trigger é um campo **opcional ao lado** do vínculo de métrica, e
não um union discriminado por `mode`. Duas razões:

- Retrocompatibilidade sai de graça: topologia antiga não tem `trigger` e
  carrega idêntica.
- **A alternativa óbvia não funciona.** Um `z.literal('metric').default('metric')`
  dentro de `discriminatedUnion` não salva o objeto legado: o **zod 4 aplica o
  default depois de rotear pelo discriminador**, então o parse falha com "No
  matching discriminator" antes de chegar ao default.

O mesmo `z.preprocess` resolve o **campo que virou lista**: `trigger.name`
(uma trigger) virou `trigger.names` (várias), e `foldLegacyTriggerName` dobra o
nome antigo no único item da lista antes do parse. Um `.default([])` sozinho não
serviria — o objeto legado não chega com o campo _vazio_, chega com o campo
_antigo_, e sem alguém para traduzir, a trigger escolhida sumiria calada no
primeiro parse e o elemento passaria a acender com qualquer problema do host.
`name` em branco vira lista vazia, e não `['']`, porque em branco sempre
significou "qualquer trigger do host".

Quando o union discriminado é mesmo necessário (as regras de threshold, que
ganharam `type` depois de já existirem salvas), a saída é um `z.preprocess` que
carimba o discriminador antes do roteamento:

```ts
export const elementRuleSchema = z.preprocess(
  (raw) =>
    typeof raw === 'object' && raw !== null && !('type' in raw)
      ? { ...raw, type: 'threshold' } // regras antigas eram todas threshold
      : raw,
  z.discriminatedUnion('type', [/* … */])
);
```

Efeito colateral do mesmo mecanismo: as duas configurações (métrica e trigger)
**coexistem no JSON**, então alternar Métrica ↔ Trigger no editor nunca descarta
nada — nem depois de salvar e recarregar. Isso virou uma regra de produto.

### 3. Ampliar enum é retrocompatível; estreitar não é

Adicionar `'radar'` a `z.enum(['pulse','blink'])` não quebra nada salvo. Remover
um valor sim. O mesmo vale para strings livres: `presentation.icon` é
`z.string()` e não um enum justamente para que **remover ou renomear um ícone
não invalide topologias salvas** — chave desconhecida cai no genérico.

### E quando um campo é aposentado?

`elementAlertSchema` (`alert: { animation, fromSeverity }`) foi substituído pela
animação por regra. Ele **continua no schema, só para leitura**: topologias
salvas antes ainda trazem o campo e ele segue animando até a primeira edição da
escada de severidades, que o dobra para dentro das regras e o apaga. Nenhuma UI
o escreve mais.

Aposentar assim custa um comentário e zero migrador. Remover do schema custaria
um erro de parse em todo dashboard que ainda tem o campo.

## Validação por seção, não pelo objeto inteiro

`parseTopoFlowOptions` valida `topology` e `canvas` **independentemente**:

```
topology corrompida  → topology = default, canvas preservado, issue reportada
canvas corrompido    → canvas = default, topology preservada, issue reportada
```

São dados sem relação. Um `gridSize: "grande"` não pode derrubar o mapa que
alguém passou uma tarde desenhando.

E **ausente é diferente de corrompido**, com tratamentos diferentes:

| Situação                  | Resultado | Avisa?                                     |
| ------------------------- | --------- | ------------------------------------------ |
| Seção ausente             | default   | não — é o caminho normal de um painel novo |
| Seção presente e inválida | default   | **sim** — significa dado perdido           |

## O caminho de erro: `topologyInvalid`

Esta é a decisão de robustez mais importante do plugin.

Quando a topologia salva **existe e não valida**, `parsed.topology` é o default.
Se o canvas pudesse escrever a partir dali, **um arraste sem querer gravaria o
default por cima do desenho do usuário** — e o dashboard não tem como distinguir
essa escrita de qualquer outra. Um único campo fora do schema apagaria o
trabalho inteiro.

Então:

```ts
// TopoFlowPanel.tsx
const handleTopologyChange = useCallback((topology: Topology) => {
  if (topologyInvalid) { return; }              // o canvas se cala
  onOptionsChange({ ...parsed, topology });
}, [onOptionsChange, parsed, topologyInvalid]);

const editable = !topologyInvalid && (/* … */);  // e a edição fica desligada
```

Mais um `<Alert>` dizendo que a topologia continua no JSON e não será
sobrescrita, e que o conserto é em _Panel JSON_.

## Integridade referencial: descarte, não erro

Aresta apontando para nó inexistente, aresta com as duas pontas no mesmo
elemento, id duplicado: tudo isso é **filtrado** no `.transform()` do
`topologySchema`, não rejeitado.

O raciocínio: uma aresta pendurada vem tipicamente de JSON editado à mão.
Rejeitar a topologia inteira faria o painel cair para o default e perder o
trabalho do usuário por causa de uma aresta. Descartar a aresta perde só a
aresta.

Ids duplicados entram na mesma regra por um motivo técnico: eles quebram a
reconciliação do React Flow. E o espaço de ids é **único para todos os tipos** —
são todos `Node` do React Flow, então um id repetido entre um nó e um texto
quebraria igual.

## O default de um painel novo

Desde a v1.0, `defaultTopology` é **vazio**. Até então era uma topologia de
exemplo (três nós, duas arestas, um postit, um título), e ela chegava por dois
caminhos, atrapalhando nos dois:

- **Painel novo**: quem adiciona o painel para desenhar a própria rede começava
  apagando a rede de outra pessoa.
- **Caminho de erro**: topologia corrompida desenhava três nós que nunca
  existiram, sugerindo que o trabalho tinha sido substituído por um mapa
  qualquer.

O exemplo continua vivo em `src/model/sampleTopology.ts` como **fixture de
teste** — os testes de modelo, editor e canvas precisam de uma topologia com um
exemplar de cada tipo. Nenhum módulo de produção o importa, então ele não entra
no bundle.

Em compensação, um canvas em branco não ensina nada. O canvas mostra uma dica
discreta (`Clique com o botão direito…`) **só em modo de edição** e só enquanto
não há nenhum elemento.

## Convenções de escrita do modelo

- **Mutação é função pura.** `src/model/mutations.ts` recebe e devolve
  `Topology`, sem tocar em React nem em `panel.options`. Quem persiste é o painel.
- **Elemento novo nasce sem cor** (`color: {}`). Um nó recém-arrastado não pode
  parecer "OK" nem "erro" antes de ter binding.
- **Geometria canônica vive em `sizes.ts`**, não no componente que desenha: os
  números são lidos pelo canvas _e_ pelas mutações. Enquanto estavam duplicados,
  o postit chegou a divergir (240x180 contra 240x280).
- **Ids são curtos e legíveis** (`node-1`, `edge-2`), únicos dentro da topologia
  e não globalmente.
