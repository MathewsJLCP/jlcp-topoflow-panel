# 08 — Histórico de decisões

Cronologia da v1.0: o que foi decidido, quando, e — o que importa de verdade —
**por quê**. Serve para não reabrir discussão encerrada, e para entender o
estado atual do código sem arqueologia de git.

O trabalho foi executado em **blocos com aprovação explícita antes de cada um**.
Nenhum push automático: todos os commits e pushes foram feitos manualmente pelo
autor.

---

## Marco 0 — Scaffold (2026-08-03)

`@grafana/create-plugin`, painel puro frontend, Grafana 13.1.0, React Flow como
canvas. Duas decisões estruturais tomadas aqui e nunca revistas:

- **Zod é a fonte da verdade do modelo**, com tipos derivados por `z.infer`.
- **`.useFieldConfig()` é obrigatório** (ADR-P03): é o que faz o Grafana rodar
  `applyFieldOverrides` e popular `field.display`. Sem ele não existe vínculo de
  dados.

## Marco 1 — Painel, binding de trigger e primeira rodada de UX

Nasceram: os seis tipos de elemento, o Layer, a cadeia de cor e o vínculo com
triggers do Zabbix.

**A cadeia de cor (Anexo A do briefing).** Precedência `trigger > regra do
elemento > Base > neutro`. **Branco nunca é fallback.** O bug que motivou o
helper único: `getColorByName('text')` — `'text'` é nome de cor válido do
Grafana e resolve para `text.primary`, quase branco no dark. Todo elemento novo
nascia branco.

**Regra derivada e permanente:** zero cor literal em componente. Só token de
`theme.colors.*` via `useStyles2` ou a cor resolvida pela cadeia. E a cadeia vive
em **um helper único** (`data/elementColor.ts`), reaproveitado por todos os
elementos — duplicá-la por componente foi o que permitiu a divergência original.

**"Sem dado" ≠ "saudável"** (A.4). `text.disabled` + badge `NO DATA`, nunca
`defaultColor` e nunca verde. O painel é usado em NOC: um painel mudo não pode
passar por painel saudável.

## Marco 2 — PRD "Refino do Editor de Elementos" (2026-08-11)

Seis blocos, com as decisões D1–D5 fechadas na auditoria do Bloco 0:

|        | Decisão                                                              | Por quê                                                                                                                                                                                           |
| ------ | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **D1** | `Fonte de estado` → **Estado**; `Campo de estado` → **Campo**        | "Métrica" repetiria a palavra logo abaixo do botão `Métrica`. Só rótulos — não há campo de schema com esses nomes                                                                                 |
| **D2** | Cor fixa de Conexão/Point vira a linha **Base** ao pé dos thresholds | uniformidade com o Nó; `color.fixed` continua o mesmo dado                                                                                                                                        |
| **D3** | Background do Texto: **cor + opacidade**, espelhando o Postit        |                                                                                                                                                                                                   |
| **D4** | (respondida por evidência) renomear só os rótulos                    |                                                                                                                                                                                                   |
| **D5** | **Remover** trigger do Texto, da UI e do schema                      | o Texto tem só o glifo como superfície; um texto que muda de cor sozinho se lê como erro de renderização, não como alarme. O Zod faz strip, então o campo some no primeiro save sem erro de parse |

## Marco 3 — Cores de trigger e animação (2026-08-11)

Dois blocos, **A antes de B**, porque o `fromSeverity` do B dependia do
vocabulário que o A criava.

**Bloco A — cores por severidade.** Severidade entrou como **sexto tipo de regra
na lista existente**, não como bloco separado. Não existe modo "Simple /
Customized": nenhuma regra = mapa padrão do Zabbix, uma regra = cor única, várias
= mapa customizado. Mesma lógica da métrica.

A lista passou a conter regras de métrica **e** de severidade ao mesmo tempo,
porque alternar Métrica ↔ Trigger nunca descarta configuração. Quem separa os
dois eixos é a resolução, não o armazenamento.

**Bloco B — animação de alerta.** Pulsar, piscar (**versão suave**, fade lento,
não liga-desliga) e radar com ondas circulares. Obrigatórios:
`prefers-reduced-motion` e só `transform`/`opacity`.

O `blink` não pisca de verdade de propósito: liga-desliga duro, repetido num
telão aberto o dia inteiro, cansa e acaba fazendo o operador desligar o painel —
o oposto do objetivo.

## Marco 4 — Pedidos do cliente: visibilidade de triggers (2026-08-29)

**Item 1 — "qual trigger alarmou?"** Um elemento vermelho diz que algo caiu, não
**o que** caiu.

Entregue em três superfícies, por esforço do operador: badge/chip no elemento →
lista fixa ao lado (`ActiveTriggers`) → painel de hover com tabela de incidentes.

Ajustes pedidos sobre o que já tinha sido entregue, todos aplicados:

- **O badge do nó parou de exibir a severidade.** No modo trigger ele segue as
  mesmas regras dos outros modos. Quem diz o que caiu passou a ser a lista.
- **Lista ligada por padrão** (`trigger.showActive` com `.default(true)`): sem
  ela, a lacuna relatada voltaria para quem já tinha topologia salva.
- **Posição escolhível** entre quatro **lados** (não cantos): a topologia decide
  onde há espaço.
- **Severidade desligável**, descartada **antes** da severidade máxima — filtrar
  só a cor deixaria badge e lista contando histórias diferentes.
- **Hover redesenhado como tabela de incidentes.** A versão anterior, com
  bolinha e texto solto, era legível com um alarme e ilegível com dez.

Fora de escopo por decisão: marca de "reconhecido" (`acknowledged`) e link para o
problema no Zabbix.

**Duas falhas desta rodada eram invisíveis para o jsdom** — o campo de tempo (o
datasource entrega `timestamp`, não `lastchange`) e o `Esc`, consumido pelo
Grafana antes de chegar a um listener de bubbling. Daí a regra: **validar no
browser antes de entregar**.

## Marco 5 — O bug do `editable` (2026-09-01)

O canvas nascia inerte quando se chegava ao editor **navegando**, e funcionava
por URL direta. Causa: `usePanelContext().app` não é confiável no Grafana 13 — o
`VizPanel` do `@grafana/scenes` constrói o panel context uma vez e o core **muta**
`context.app` depois, sem re-render.

Correção: ler `editPanel` do `locationService`, como o canvas nativo faz.

**O bug atravessou 5 commits.** Foi ele que motivou os testes de interação em
Playwright (`canvas-interaction.spec.ts`): seleção, arraste e menu de contexto
não têm como ser cobertos em jsdom, e diante do relato não havia nada que
respondesse sim ou não.

## Marco 6 — Biblioteca de ícones (2026-08-31 a 2026-09-02)

Aprovada com pastas (packs), chave `pack/nome`, e o seletor valendo para Nó e
Imagem.

A **natureza do ícone** governa o desenho todo: `glyph` (herda `currentColor`,
acende com o estado) ou `image` (arte colorida, não tingível). Não existe campo
`tint` separado — seria derivável de `kind` nos dois sentidos, e campo derivável
é convite a duas fontes de verdade discordando.

**Terceira natureza, descoberta no material do cliente:** os ícones eram 11
famílias × 4 cores, no estilo mapa do Zabbix. Virou `variants` — a figura não é
tingível mas **troca de arquivo** conforme o estado. Isso desfez a oposição
glifo × figura que estruturava o desenho original.

Laranja e verde foram **derivados por rotação de matiz** dos arquivos existentes,
girando **só a cor dominante**: sem a janela de ±45°, o display azul do servidor
e a lente da câmera giravam junto e o ícone deixava de ser o mesmo desenho. O
codec PNG foi escrito à mão — não há Pillow nem ImageMagick na máquina.

**O tom sai da cor já resolvida pela cadeia, por matiz** (pedido do usuário em
2026-09-01), e não da severidade: vale igual em modo Trigger e em threshold de
métrica, e o ícone acompanha **exatamente a cor que a regra pintou**.

Terceiro pack, `petrolifera` (2026-09-02): ativos do ramo do cliente (sonda,
estação, religador, sensor, torre) e rádios de campo. São `image` — uma sonda de
outra cor não é "a sonda em alarme". O material vinha com a mesma arte repetida
em vários tamanhos; entrou **um arquivo por família**, nas dimensões de origem.

## Marco 7 — O pipeline nativo sai da cadeia de cor (2026-09-02)

A mudança conceitualmente mais importante da v1.0, e a mais contra-intuitiva.

Havia um nível entre "regra do elemento" e "Base": sem regra própria, o elemento
era pintado pelos **thresholds do field**. Ele virou a armadilha que a cadeia
dizia querer evitar — uma Base laranja escolhida no elemento era ignorada em
favor do step base azul configurado no painel de opções, sem nada na tela do
elemento dizer isso.

Hoje: **lista vazia = sem estado = Base.** Os thresholds/value mappings nativos
seguem formatando o valor e colorindo o gráfico do hover.

O custo de divergir do Canvas nativo é menor que o de um falso "tudo OK": em NOC,
verde significa "verificado OK".

**Armadilha irmã, corrigida no mesmo dia.** A amostra de cor da linha **Base**
mostrava `color.fixed ?? 'green'`. Como `color.fixed` nasce indefinido, ligar o
Background de uma Imagem e passar para o modo Estado deixava a placa no neutro
enquanto o editor exibia verde. Foi relatado como "bug/cache"; medindo no Grafana
real, a placa mudava na hora — o que mentia era a amostra. Verde é a pior cor
possível para um placeholder aqui, pelo mesmo motivo de sempre.

## Marco 8 — Fechamento da v1.0 (2026-09-02)

- **A topologia de exemplo saiu do default.** Ela chegava por dois caminhos e
  atrapalhava nos dois: painel novo (quem quer desenhar a própria rede começava
  apagando a de outra pessoa) e caminho de erro (topologia corrompida desenhava
  três nós que nunca existiram). Virou fixture de teste em `sampleTopology.ts`.
  O canvas vazio ganhou uma dica discreta, só em modo de edição.
- Documentação em `docs/`, README voltado ao usuário final, `plugin.json` com
  descrição e keywords, `CHANGELOG` com notas de atualização.
- Pacote instalável gerado a partir de `dist/`.

## Marco 9 — Mais de uma trigger por elemento (2026-09-09)

Segunda metade do pedido do cliente de 2026-08-29. A decisão que estava aberta —
vínculos de **um mesmo host** ou **pares host+trigger independentes** — fechou no
mesmo host: cobre o caso real ("este equipamento, estas 3 triggers") num
formulário que cabe nos 300px do painel de opções.

- `trigger.name` virou `trigger.names`, com relação **OU** entre as linhas: basta
  uma em PROBLEM para acender, e a severidade que pinta é a maior entre as que
  estão alarmando. A lista sob o elemento e o contador já trabalhavam sobre o
  conjunto de problemas casados, e não mudaram.
- **Sem migrador, de novo**: `foldLegacyTriggerName` dobra o `name` antigo no
  único item da lista, no mesmo `z.preprocess` já usado nas regras de threshold.
- **Lista vazia continua significando "qualquer trigger do host"**, e linha em
  branco é rascunho ignorado — um clique em "Adicionar trigger" não pode alargar
  o vínculo para o host inteiro antes de o usuário escolher.

No mesmo dia, e do mesmo cliente: **o total de incidentes como formato da
lista** (`trigger.activeDisplay`). Em `count`, as até três linhas viram uma só,
"4 incidentes ativos". O que decidiu a forma foi não inventar uma superfície
nova: é a mesma linha da lista, vestindo a maior severidade em curso, no mesmo
lugar e com a mesma posição escolhível. Trocar de formato muda **quanto** se lê,
nunca o que a cor diz.

Fica pendente a outra metade do pedido anterior: listar também as triggers
configuradas que estão **OK** (ver [09](09-pendencias-e-roadmap.md)).

---

## Padrões que atravessaram o projeto inteiro

São eles que explicam a maior parte das escolhas acima.

1. **Nunca descartar configuração do usuário.** Alternar Métrica ↔ Trigger,
   Biblioteca ↔ Arquivo, ligar e desligar um fundo: nada disso apaga o que já
   estava configurado. Os dois lados coexistem no JSON.
2. **Ausente significa desligado.** Sem flag separada para manter em sincronia
   com o objeto que ela liga.
3. **Sem migrador.** `SCHEMA_VERSION` continua em 1 depois de uma v1.0 inteira,
   por disciplina de `.optional()`/`.default()` e campos paralelos.
4. **A decisão mora em um lugar só.** Cor em `elementColor.ts`, geometria em
   `sizes.ts`, "o que a lista deve mostrar" em `ActiveTriggers`. Toda divergência
   entre elementos veio de decisão duplicada.
5. **O aviso vive onde quem pode corrigir está olhando** — no editor, não no
   canvas.
6. **Item morto é pior que item ausente.** Sem "Colar" no menu enquanto não
   houver clipboard.
7. **Validar no browser antes de entregar.** O jsdom não faz hit-testing.
